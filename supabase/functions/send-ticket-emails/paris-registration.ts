import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.110.1';
const esc = (v: string) => v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function utf8Base64(text: string) { return btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join('')); }

/** Called by the existing authenticated scheduled ticket-email dispatcher. */
export async function sendParisRegistrationEmails(admin: SupabaseClient, apiKey: string) {
  const { data: jobs, error } = await admin.rpc('claim_paris_registration_email_jobs');
  // The migration is staged: don't disrupt ticket confirmations on an older database.
  if (error) return { sent: 0, failed: 0, available: false };
  let sent = 0, failed = 0;
  for (const job of jobs ?? []) {
    try {
      const [regResult, rulesResult] = await Promise.all([
        admin.from('registrations').select('id,event_id,type,status,paris_draft_id').eq('id',job.registration_id).single(),
        admin.from('paris_rule_versions').select('content,source_url').eq('version',job.rules_version).single(),
      ]);
      const reg = regResult.data, rules = rulesResult.data;
      if (regResult.error || rulesResult.error || !reg || !rules || reg.type!=='dancer' || reg.event_id!=='eb0025ca-b597-4708-9d47-b24ebbf507b5' || !['confirmed','paid'].includes(reg.status)) throw new Error('registration_not_confirmed');
      const { data: draft, error: draftError } = await admin.from('tour_registration_drafts').select('category,payload').eq('id',reg.paris_draft_id).single();
      if (draftError || !draft) throw new Error('dossier_missing');
      const recipients = draft.category==='Junior Dance Tour' ? [draft.payload.guardianEmail] : draft.payload.dancers.map((d: {email:string})=>d.email);
      if (!recipients.some((email:string)=>email.trim().toLowerCase()===job.recipient_email)) throw new Error('recipient_not_authorized');
      const subject = 'Confirmation d’inscription danseur · Juste Debout Paris 2027';
      const intro = `Ton inscription à Juste Debout Paris est confirmée.\nDiscipline : ${draft.category}\nRéférence : ${reg.id}\nPrélims : 11 et 12 mars 2027 (adresse communiquée ultérieurement).\nFinales : 13 et 14 mars 2027, Stade Pierre de Coubertin.\n\nVoici la version du règlement signée : ${job.rules_version}. Tu la retrouves intégralement ci-dessous et en pièce jointe.`;
      const text = `${intro}\n\n${rules.content}`;
      const response = await fetch('https://api.resend.com/emails',{
        method:'POST', signal:AbortSignal.timeout(15000),
        headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':`paris-registration-${job.id}`},
        body:JSON.stringify({from:'Juste Debout <billetterie@juste-debout-shop.com>',to:[job.recipient_email],subject,text,
          html:`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(subject)}</title></head><body style="font-family:Arial,sans-serif;color:#111;background:#fff;max-width:680px;margin:auto;padding:24px"><h1>${esc(subject)}</h1><p>${esc(intro).replaceAll('\n','<br>')}</p><h2>Règlement signé</h2><p>${esc(rules.content).replaceAll('\n','<br>')}</p></body></html>`,
          attachments:[{filename:`Reglement-Juste-Debout-${job.rules_version}.txt`,content:utf8Base64(rules.content)}]})
      });
      if (!response.ok) {
        const permanent=response.status>=400 && response.status<500 && response.status!==429;
        await admin.from('paris_registration_email_outbox').update({status:permanent || job.attempts>=6?'failed':'pending',last_error:`provider_http_${response.status}`,next_attempt_at:new Date(Date.now()+Math.min(2**job.attempts*60000,3600000)).toISOString()}).eq('id',job.id);
        failed++; continue;
      }
      const result=await response.json();
      const { error: finishError }=await admin.from('paris_registration_email_outbox').update({status:'sent',sent_at:new Date().toISOString(),provider_message_id:result.id,last_error:null}).eq('id',job.id);
      if (finishError) throw new Error('outbox_update_failed');
      sent++;
    } catch(e) {
      await admin.from('paris_registration_email_outbox').update({status:job.attempts>=6?'failed':'pending',last_error:e instanceof Error?e.message:'dispatch_failed',next_attempt_at:new Date(Date.now()+2**job.attempts*60000).toISOString()}).eq('id',job.id);
      failed++;
    }
  }
  return {sent,failed,available:true};
}
