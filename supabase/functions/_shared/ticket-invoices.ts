import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.1";
import { renderInvoicePdf, type InvoiceDocument } from "./invoice-pdf.ts";

// Pinned open-source font covers all languages offered by the ticket app.
// A failing download never interrupts ticket delivery; invoice jobs retry.
const fonts={
 latin:{url:'https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac/hinted/ttf/NotoSans/NotoSans-Regular.ttf',sha:'b85c38ecea8a7cfb39c24e395a4007474fa5a4fc864f6ee33309eb4948d232d5'},
 cjk:{url:'https://raw.githubusercontent.com/notofonts/noto-cjk/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/Variable/TTF/NotoSansCJKsc-VF.ttf',sha:'990c807e79c25662a5a9ecf7f971baeb2bf2eab9a559e5ecf15cdfdb8561d21f'}
};
const fontCache:Partial<Record<keyof typeof fonts,Uint8Array>>={};
async function invoiceFont(name:keyof typeof fonts) {
 if(fontCache[name])return fontCache[name]!;
 const response=await fetch(fonts[name].url,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('invoice_font_unavailable');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length<100000||bytes.length>50000000)throw Error('invoice_font_invalid');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));
 if(Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('')!==fonts[name].sha)throw Error('invoice_font_invalid');
 fontCache[name]=bytes;return bytes;
}
function base64(bytes:Uint8Array) {
 let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return btoa(text);
}
type Job=InvoiceDocument & {order_id:string;lease_token:string;pdf_path:string|null;email_sent_at:string|null};

export async function processTicketInvoices(admin:SupabaseClient,apiKey:string) {
 let sent=0,failed=0;
 // Dedicated worker: expensive PDF rendering never competes with ticket emails.
 for(let count=0;count<1;count++) {
  const {data,error}=await admin.rpc('claim_ticket_invoice');
  if(error) {console.error('invoice_claim_failed',error.code);failed++;break;}
  if(!data)break;
  const job=data as Job;
  try {
   let bytes:Uint8Array;
   if(job.pdf_path) {
    const {data:file,error}=await admin.storage.from('ticket-invoices').download(job.pdf_path);
    if(error||!file)throw Error('invoice_download_failed');bytes=new Uint8Array(await file.arrayBuffer());
   } else {
    const hasCjk=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(JSON.stringify(job.snapshot));
    bytes=await renderInvoicePdf(job,await invoiceFont('latin'),hasCjk?await invoiceFont('cjk'):undefined);
    const path=job.id+'/'+job.number+'.pdf';
    // Deterministic immutable path. Retry after an uncertain upload checks its existence.
    const {error:uploadError}=await admin.storage.from('ticket-invoices').upload(path,bytes,{contentType:'application/pdf',upsert:false});
    if(uploadError) {
     const {data:existing,error}=await admin.storage.from('ticket-invoices').download(path);
     if(error||!existing)throw Error('invoice_upload_failed');
     bytes=new Uint8Array(await existing.arrayBuffer());
    }
    const {error}=await admin.from('ticket_invoices').update({pdf_path:path,ready_at:new Date().toISOString()}).eq('id',job.id);
    if(error)throw Error('invoice_save_failed');
   }
   if(!job.email_sent_at) {
    const s=job.snapshot;
    const text='Bonjour,\n\nVous trouverez en pièce jointe votre facture '+job.number+' pour votre achat de billets '+s.event.title+'.\n\nYour paid invoice is attached to this email.\n\nVos factures sont aussi disponibles dans l’application, dans Mes billets → Mes factures, avec le compte associé à votre achat.\n\nhttps://justedeboutapp.com/ticket-invoices\n\nL’équipe Juste Debout';
    const response=await fetch('https://api.resend.com/emails',{
     method:'POST',signal:AbortSignal.timeout(20000),
     headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'jd-invoice-'+job.id},
     body:JSON.stringify({from:'Juste Debout <billetterie@juste-debout-shop.com>',to:[s.buyer.email],
      subject:'Votre facture / Your invoice — '+job.number,text,
      attachments:[{filename:job.number+'.pdf',content:base64(bytes)}]})
    });
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error('invoice_email_http_'+response.status);
    const {error}=await admin.from('ticket_invoices').update({email_sent_at:new Date().toISOString(),provider_message_id:result.id??null}).eq('id',job.id);
    if(error)throw Error('invoice_email_save_failed');
   }
   const {error}=await admin.rpc('finish_ticket_invoice_job',{p_order:job.order_id,p_token:job.lease_token,p_error:null});
   if(error)throw Error('invoice_finish_failed');sent++;
  } catch(error) {
   // Error codes only: never log names, addresses, PDF contents or API responses.
   const code=error instanceof Error?error.message:'invoice_processing_failed';
   await admin.rpc('finish_ticket_invoice_job',{p_order:job.order_id,p_token:job.lease_token,p_error:code});failed++;
  }
 }
 return {sent,failed};
}
