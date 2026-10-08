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
      let subject = "", body = "", action = "", actionUrl = "";
      if (job.kind === "confirmation") {
        const { data: order } = await admin.from("ticket_orders").select("id,status,total_cents,currency,customer_email,user_id")
          .eq("id", job.source_id).single();
        if (!order || order.status !== "paid" || order.customer_email?.toLowerCase() !== job.recipient_email) throw Error("order_not_eligible");
        subject = "Juste Debout — Votre commande est confirmée";
        body = `Votre paiement de ${(order.total_cents / 100).toFixed(2)} ${(order.currency ?? "EUR").toUpperCase()} est confirmé. Référence : ${order.id.slice(0,8).toUpperCase()}. Après le paiement, créez votre espace ou connectez-vous avec cette même adresse e-mail pour retrouver vos billets et QR codes.`;
        const { data: orderItems, error: orderItemsError } = await admin.from("ticket_order_items")
          .select("product_code,product_name,quantity").eq("order_id",order.id);
        if (orderItemsError) throw orderItemsError;
        const multiDayItems = (orderItems ?? []).filter(item => ["three_days","four_days","internal_test_4days_1eur"].includes(item.product_code));
        if (multiDayItems.length) {
          const passDetails = multiDayItems.map(item =>
            item.product_code === "three_days"
              ? `Pass 3 jours (12, 13 et 14 mars 2027) : ${item.quantity} billet(s)`
              : item.product_code === "internal_test_4days_1eur"
                ? `TEST INTERNE — Pass 4 jours (11, 12, 13 et 14 mars 2027) : ${item.quantity} billet(s)`
                : `Pass 4 jours (11, 12, 13 et 14 mars 2027) : ${item.quantity} billet(s)`
          ).join("\n");
          body += `\n\nVOS ACCÈS MULTI-JOURS\n${passDetails}\n\nPrésélections des 11 et 12 mars : dans une autre salle à Paris, adresse communiquée ultérieurement (uniquement les dates incluses dans votre pass).\nFinales des 13 et 14 mars : Stade Pierre-de-Coubertin, Paris.\nUne entrée par jour autorisé, sortie définitive. Conservez votre QR code dans votre portefeuille.`;
        }
        action = "ACCÉDER À MES BILLETS";
        actionUrl = order.user_id ? "https://justedeboutapp.com/wallet" : "https://justedeboutapp.com/login?recover=1";
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
      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head><body style="margin:0;background-color:#eee;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#eeeeee" style="padding:24px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%"><tr><td align="center" bgcolor="#ffffff" style="padding:30px"><img src="https://juste-debout-app.vercel.app/email/vitruve.png" width="100" height="100" border="0" alt="Juste Debout" style="display:block;width:100px;height:100px"></td></tr><tr><td bgcolor="#ffffff" style="padding:30px"><h1 style="font-family:Arial,Helvetica,sans-serif;font-size:23px;line-height:30px;color:#111">${esc(subject)}</h1><p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:25px;color:#333">${esc(body).replace(/\n/g,"<br>")}</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#b5fa42" style="padding:14px"><a href="${esc(actionUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:#111;text-decoration:none">${esc(action)}</a></td></tr></table></td></tr><tr><td align="center" bgcolor="#ffffff" style="padding:24px"><img src="https://juste-debout-app.vercel.app/email/juste-debout.png" width="190" height="73" border="0" alt="Juste Debout" style="display:block;width:190px;height:73px"></td></tr></table></td></tr></table></body></html>`;
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
