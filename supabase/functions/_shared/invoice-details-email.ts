import type {SupabaseClient} from "npm:@supabase/supabase-js@2.110.1";
export async function sendInvoiceDetailsRequest(admin:SupabaseClient,key:string) {
 const {data:job,error}=await admin.rpc('claim_invoice_details_request');
 if(error)return {sent:0,failed:1};if(!job)return {sent:0,failed:0};
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(job.event_id+'|'+job.email)));
 const idempotency='jd-invoice-details-'+Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
 let provider:string|null=null,code:string|null=null;
 try {
  const response=await fetch('https://api.resend.com/emails',{
   method:'POST',signal:AbortSignal.timeout(20000),
   headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':idempotency},
   body:JSON.stringify({from:'Juste Debout <billetterie@juste-debout-shop.com>',to:[job.email],
    subject:'Votre facture Juste Debout / Your invoice — coordonnées à compléter',
    text:'Bonjour,\n\nPour établir et vous envoyer la facture de vos billets Juste Debout Paris 2027, nous avons besoin de votre nom et de votre adresse de facturation. Ces informations n’étaient pas demandées lors de votre achat.\n\nConnectez-vous à l’application avec l’adresse email utilisée pour votre achat, puis complétez le formulaire dans « Mes factures » :\nhttps://justedeboutapp.com/ticket-invoices?billing=1\n\nLa facture sera ensuite créée et envoyée automatiquement par email. Un seul formulaire suffit pour vos achats concernés.\n\nHello,\nTo issue your invoice for Juste Debout Paris 2027 tickets, please sign in with your purchase email address and complete your billing name and address here:\nhttps://justedeboutapp.com/ticket-invoices?billing=1\nYour PDF invoice will then be generated and emailed automatically. One form covers your eligible purchases.\n\nL’équipe Juste Debout'})
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error('invoice_details_email_http_'+response.status);
  provider=result.id??null;
 } catch(e){code=e instanceof Error&&e.message.startsWith('invoice_details_')?e.message:'invoice_details_email_failed';}
 const {error:save}=await admin.rpc('finish_invoice_details_request',{p_event:job.event_id,p_email:job.email,p_token:job.lease_token,p_provider:provider,p_error:code});
 return {sent:!code&&!save?1:0,failed:code||save?1:0};
}
