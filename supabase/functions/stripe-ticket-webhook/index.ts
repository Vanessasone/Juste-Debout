import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@^22";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");
const cryptoProvider = Stripe.createSubtleCryptoProvider();


async function syncRefund(admin: ReturnType<typeof createClient>, chargeId: string) {
 const charge = await stripe.charges.retrieve(chargeId);
 const paymentIntent = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
 if (!paymentIntent) return;
 let refunded = 0;
 for await (const refund of stripe.refunds.list({charge: chargeId, limit:100})) {
  if (refund.status === "succeeded") refunded += refund.amount;
 }
 const {data,error} = await admin.rpc("record_ticket_refund", {
  p_payment_intent:paymentIntent,p_amount:charge.amount,p_currency:charge.currency,p_refunded_cents:refunded
 });
 if (error) throw error;
 if (!data?.ok) throw new Error("refund_reconciliation_failed");
}
async function syncPaymentRefund(admin: ReturnType<typeof createClient>, paymentIntentId: string) {
 const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
 const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
 if (chargeId) await syncRefund(admin,chargeId);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

  const signature = req.headers.get("Stripe-Signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) return new Response("missing_signature_configuration", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, undefined, cryptoProvider);
  } catch (error) {
    console.error("Stripe signature verification failed", error);
    return new Response("bad_signature", { status: 400 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status !== "paid") return Response.json({ received: true, ignored: "not_paid" });

      const orderId = session.metadata?.order_id;
      if (!orderId) return new Response("missing_order_id", { status: 400 });

      if (session.metadata?.kind === "shop_order") {
        const { error } = await admin.from("orders").update({
          status: "paid",
          stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", orderId).eq("status", "pending");
        if (error) throw error;
        console.log("shop order finalized", orderId);
      } else {
        const { data: existingOrder, error: orderError } = await admin.from("ticket_orders").select("status").eq("id",orderId).maybeSingle();
        if (orderError) throw orderError;
        if (existingOrder?.status === "refunded") return Response.json({received:true,ignored:"already_refunded"});
        const { data, error } = await admin.rpc("finalize_ticket_order", {
          p_order: orderId,
          p_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
          p_customer_email: session.customer_details?.email ?? session.customer_email ?? null,
        });
        if (error) throw error;
        if (!data?.ok) throw new Error("ticket_finalization_rejected:" + (data?.error ?? "unknown"));
        console.log("ticket order finalized", orderId, data);
        if (typeof session.payment_intent === "string") await syncPaymentRefund(admin,session.payment_intent);
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.order_id;
      if (orderId) {
        if (session.metadata?.kind === "shop_order") {
          const { error } = await admin.from("orders").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", orderId).eq("status", "pending");
          if (error) throw error;
        } else {
          const { error } = await admin.rpc("release_ticket_order", { p_order: orderId, p_status: "expired" });
          if (error) throw error;
        }
      }
    }

    if (event.type === "charge.refunded") {
      await syncRefund(admin,(event.data.object as Stripe.Charge).id);
    }
    if (["refund.created","refund.updated","refund.failed"].includes(event.type)) {
      const refund = event.data.object as Stripe.Refund;
      const chargeId = typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
      if (chargeId) await syncRefund(admin,chargeId);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(error);
    return new Response("webhook_processing_failed", { status: 500 });
  }
});