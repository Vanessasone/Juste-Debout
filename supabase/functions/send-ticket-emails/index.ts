import { translations } from "./translations.ts";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = Deno.env.get("RESEND_JD_BILLETTERIE_API_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!key || !url) return new Response("server_not_configured", { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: secret, error: secretError } = await admin.rpc("jd_email_dispatch_secret");
  if (secretError || typeof secret !== "string" || secret.length < 32) return new Response("dispatch_not_configured", { status: 503 });
  const submitted = req.headers.get("x-jd-dispatch-token") ?? "";
  const encoder = new TextEncoder();
  const expectedBytes = encoder.encode(secret);
  const actualBytes = encoder.encode(submitted);
  let mismatch = expectedBytes.length ^ actualBytes.length;
  for (let i = 0; i < expectedBytes.length; i++) mismatch |= expectedBytes[i] ^ (actualBytes[i] ?? 0);
  if (mismatch !== 0) return new Response("forbidden", { status: 403 });
  if (!apiKey) return Response.json({ error: "RESEND_JD_BILLETTERIE_API_KEY_not_configured", processed: 0 }, { status: 503 });
  const { data: pending, error } = await admin.from("ticket_email_outbox")
    .select("id,kind,source_id,recipient_email,attempts,transfer_token")
    .eq("status", "pending").lt("attempts", 4).order("created_at").limit(20);
  if (error) return new Response("outbox_query_failed", { status: 500 });
  let sent = 0, failed = 0;
  for (const job of pending ?? []) {
    const { data: claimed } = await admin.from("ticket_email_outbox")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id).eq("status", "pending").select("id").maybeSingle();
    if (!claimed) continue;
    try {
      let subject = "", body = "", action = "", actionUrl = "", locale = "fr";
      if (job.kind === "confirmation") {
        const { data: order } = await admin.from("ticket_orders").select("id,status,total_cents,currency,customer_email,user_id,customer_locale")
          .eq("id", job.source_id).single();
        if (!order || order.status !== "paid" || order.customer_email?.toLowerCase() !== job.recipient_email) throw Error("order_not_eligible");
        locale = Object.hasOwn(translations, order.customer_locale) ? order.customer_locale : "fr";
        const language = translations[locale as keyof typeof translations];
        const ct = (key: keyof typeof translations.fr, values: Record<string, string | number> = {}) => {
          let result: string = language[key];
          for (const [name,value] of Object.entries(values)) result = result.replaceAll(`{${name}}`, String(value));
          return result;
        };
        subject = ct("emailSubject");
        const amount = new Intl.NumberFormat(locale, {style:"currency", currency:order.currency ?? "EUR"}).format(order.total_cents/100);
        body = `${ct("emailReceipt", {amount, reference:order.id.slice(0,8).toUpperCase()})}\n\n${ct("paidBody")}`;
        const { data: orderItems, error: orderItemsError } = await admin.from("ticket_order_items")
          .select("product_code,product_name,quantity").eq("order_id",order.id);
        if (orderItemsError) throw orderItemsError;
        const multiDayItems = (orderItems ?? []).filter(item => ["three_days","four_days","internal_test_4days_1eur"].includes(item.product_code));
        if (multiDayItems.length) {
          const passDetails = multiDayItems.map(item => {
            const days = item.product_code === "three_days" ? [12,13,14] : [11,12,13,14];
            const dates = days.map(day => new Intl.DateTimeFormat(locale,{day:"numeric",month:"long",year:"numeric",timeZone:"Europe/Paris"}).format(new Date(Date.UTC(2027,2,day,12)))).join(" · ");
            return `${item.product_code === "internal_test_4days_1eur" ? "TEST INTERNE · " : ""}${ct(item.product_code === "three_days" ? "passThree" : "passFour")} · ${item.quantity}\n${dates}\n${ct("accessMulti", {n:days.length})}`;
          }).join("\n");
          body += `\n\n${passDetails}\n${ct("presels")} · ${ct("preselVenue")}\n${ct("finalDays")} · Stade Pierre-de-Coubertin · Paris`;
        }
        action = ct("recover");
        actionUrl = order.user_id ? "https://justedeboutapp.com/wallet" : `https://justedeboutapp.com/login?recover=1&lang=${encodeURIComponent(locale)}`;
      } else {
        const { data: ticket } = await admin.from("tickets")
          .select("id,transfer_email,transfer_status,transfer_token,status")
          .eq("id", job.source_id).single();
        if (!ticket || ticket.status !== "active" || ticket.transfer_status !== "pending" || ticket.transfer_email?.toLowerCase() !== job.recipient_email || !ticket.transfer_token || ticket.transfer_token !== job.transfer_token) throw Error("invitation_not_eligible");
        subject = "Juste Debout — Un billet vous attend";
        body = "Un billet Juste Debout vous a été attribué. Connectez-vous avec cette adresse e-mail pour le récupérer.";
        action = "RÉCUPÉRER MON BILLET";
        actionUrl = `https://juste-debout-app.vercel.app/claim-ticket?token=${encodeURIComponent(ticket.transfer_token)}`;
      }
      const esc = (v: string) => v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      const html = `<!DOCTYPE html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background-color:#eee;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#eeeeee" style="padding:24px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%"><tr><td align="center" bgcolor="#ffffff" style="padding:30px"><img src="https://juste-debout-app.vercel.app/email/vitruve.png" width="100" height="100" border="0" alt="Juste Debout" style="display:block;width:100px;height:100px"></td></tr><tr><td bgcolor="#ffffff" style="padding:30px"><h1 style="font-family:Arial,Helvetica,sans-serif;font-size:23px;line-height:30px;color:#111">${esc(subject)}</h1><p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#333">${esc(body).replace(/\n/g,"<br>")}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#b5fa42" style="padding:14px"><a href="${esc(actionUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#111;text-decoration:none">${esc(action)}</a></td></tr></table></td></tr><tr><td align="center" bgcolor="#ffffff" style="padding:24px"><img src="https://juste-debout-app.vercel.app/email/juste-debout.png" width="190" height="73" border="0" alt="Juste Debout" style="display:block;width:190px;height:73px"></td></tr></table></td></tr></table></body></html>`;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `jd-email-${job.id}` },
        body: JSON.stringify({ from: "Juste Debout <billetterie@juste-debout-shop.com>", to: [job.recipient_email], subject, html, text: body }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw Error(`resend_http_${res.status}`);
      await admin.from("ticket_email_outbox").update({ status: "sent", provider_message_id: result.id ?? null, sent_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
      sent++;
    } catch (e) {
      await admin.from("ticket_email_outbox").update({ status: job.attempts + 1 >= 4 ? "failed" : "pending", last_error: String(e).slice(0,250) }).eq("id", job.id);
      failed++;
    }
  }
  return Response.json({ processed: (pending ?? []).length, sent, failed });
});
