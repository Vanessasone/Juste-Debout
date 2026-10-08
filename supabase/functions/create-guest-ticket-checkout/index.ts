import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@^22";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405, headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    // Stripe revient directement sur l'application. Les anciennes sessions
    // utilisant les URL Supabase restent prises en charge par les redirects 303.
    const successUrl = "https://justedeboutapp.com/ticket-success";
    const cancelUrl = "https://justedeboutapp.com/ticket-cancel";
    if (!supabaseUrl || !serviceKey || !stripeKey || !successUrl || !cancelUrl) throw new Error("Missing server configuration");

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const body = await req.json() as {
      eventId?: string;
      email?: string;
      name?: string;
      locale?: string;
      items?: Array<{ productId: string; quantity: number }>;
      promoCode?: string | null;
    };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || name.length < 2 || name.length > 120)
      return Response.json({ error: "invalid_contact" }, { status: 400, headers: cors });
    const locale = ["fr","en","de","it","es","pt","zh","ko","ja"].includes(body.locale ?? "") ? body.locale : "fr";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serviceKey + value)))).map(b => b.toString(16).padStart(2,"0")).join("");
    for (const [value, limit] of [[email,5],["ip:"+ip,20]] as const) {
      const { data: allowed, error } = await admin.rpc("consume_guest_ticket_limit", { p_bucket: await hash(value), p_limit: limit });
      if (error || !allowed) return Response.json({ error: "too_many_attempts" }, { status: 429, headers: cors });
    }
    const eventId = body.eventId?.trim();
    const rawItems = Array.isArray(body.items) ? body.items : [];
    if (!eventId || rawItems.length === 0) return Response.json({ error: "invalid_cart" }, { status: 400, headers: cors });

    const compact = new Map<string, number>();
    for (const item of rawItems) {
      const q = Math.max(0, Math.floor(Number(item.quantity)));
      if (!item.productId || q < 1) continue;
      compact.set(item.productId, (compact.get(item.productId) ?? 0) + q);
    }
    if (!compact.size) return Response.json({ error: "invalid_cart" }, { status: 400, headers: cors });


    // Produit technique réel à 1 € : jamais accessible à un spectateur ni combinable à une autre commande.
    const { data: cartProducts, error: cartProductsError } = await admin
      .from("ticket_products").select("id,code").in("id", [...compact.keys()]);
    if (cartProductsError) throw cartProductsError;
    if (cartProducts?.some(p => p.code.startsWith("internal_test_"))) {
      return Response.json({ error: "internal_test_forbidden" }, { status: 403, headers: cors });
    }
    const rpcItems = [...compact.entries()].map(([productId, quantity]) => ({ productId, quantity }));
    const { data: created, error: createError } = await admin.rpc("create_ticket_order_reserved", {
      p_user: null,
      p_event: eventId,
      p_email: email,
      p_items: rpcItems,
      p_promo_code: body.promoCode?.trim() || null,
    });
    if (createError) throw createError;
    if (!created?.ok) {
      const code = created?.error ?? "order_create_failed";
      const status = ["ticket_sales_closed","sold_out","sales_not_started","sales_ended","invalid_or_expired_promo","minimum_quantity_not_met","sold_out_for_day"].includes(code) ? 409 : 400;
      return Response.json({ error: code }, { status, headers: cors });
    }

    const orderId = created.order_id as string;
    const { error: contactError } = await admin.from("ticket_orders").update({customer_name:name,customer_locale:locale}).eq("id",orderId);
    if (contactError) { await admin.rpc("release_ticket_order",{p_order:orderId,p_status:"cancelled"}); throw contactError; }
    try {
      const { data: order, error: orderError } = await admin
        .from("ticket_orders")
        .select("id,event_id,currency,subtotal_cents,total_cents,discount_cents,customer_email,promo_code")
        .eq("id", orderId)
        .single();
      if (orderError || !order) throw orderError ?? new Error("order_not_found");

      const { data: items, error: itemsError } = await admin
        .from("ticket_order_items")
        .select("product_id,product_name,unit_price_cents,quantity")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (itemsError || !items?.length) throw itemsError ?? new Error("order_items_missing");

      let promoDiscountPerUnit = 0;
      const eligible = new Map<string, number>();
      if (order.promo_code) {
        const { data: promo } = await admin
          .from("ticket_promotions")
          .select("id,discount_type,discount_value")
          .eq("code", order.promo_code)
          .maybeSingle();

        if (promo?.discount_type === "fixed_per_unit") {
          promoDiscountPerUnit = promo.discount_value;
          const { data: links } = await admin
            .from("ticket_promotion_products")
            .select("product_id,discount_value")
            .eq("promotion_id", promo.id);
          for (const link of links ?? []) eligible.set(link.product_id, link.discount_value ?? promoDiscountPerUnit);
        }
      }

      const stripeLineItems = items.map((item) => {
        const discount = eligible.get(item.product_id) ?? 0;
        const discounted = Math.max(0, item.unit_price_cents - discount);
        return {
          quantity: item.quantity,
          price_data: {
            currency: order.currency.toLowerCase(),
            unit_amount: discounted,
            product_data: { name: item.product_name },
          },
        };
      });

      const computedTotal = stripeLineItems.reduce((sum, li) => sum + li.price_data.unit_amount * li.quantity, 0);
      if (computedTotal !== order.total_cents) throw new Error("checkout_total_mismatch");

      const stripe = new Stripe(stripeKey);
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        client_reference_id: orderId,
        customer_email: email,
        locale: locale === "zh" ? "zh" : locale as Stripe.Checkout.SessionCreateParams.Locale,
        // Stripe remplace ce marqueur après paiement. Le client vérifie la commande côté Supabase.
        success_url: successUrl + (successUrl.includes("?") ? "&" : "?") + "session_id={CHECKOUT_SESSION_ID}",
        cancel_url: cancelUrl,
        expires_at: expiresAt,
        metadata: {
          order_id: orderId,
          event_id: eventId,
          kind: "guest_ticket",
          promo_code: order.promo_code ?? "",
        },
        line_items: stripeLineItems,
      });

      const { error: sessionError } = await admin.from("ticket_orders")
        .update({ stripe_checkout_session_id: session.id, updated_at: new Date().toISOString() }).eq("id", orderId);
      if (sessionError) { await stripe.checkout.sessions.expire(session.id); throw sessionError; }

      return Response.json(
        {
          url: session.url,
          orderId,
          expiresAt,
          subtotalCents: order.subtotal_cents,
          discountCents: order.discount_cents,
          totalCents: order.total_cents,
          promoCode: order.promo_code,
        },
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    } catch (stripeError) {
      await admin.rpc("release_ticket_order", { p_order: orderId, p_status: "cancelled" });
      throw stripeError;
    }
  } catch (error) {
    console.error(error);
    return Response.json({ error: "checkout_failed" }, { status: 500, headers: cors });
  }
});
