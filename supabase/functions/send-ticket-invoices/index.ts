import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.110.1";
import {processTicketInvoices,probeTicketInvoicePdf} from "../_shared/ticket-invoices.ts";
import Stripe from "npm:stripe@^22";
import {reconcileInvoiceHistory} from "../_shared/invoice-history.ts";
import {sendInvoiceDetailsRequest} from "../_shared/invoice-details-email.ts";
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return new Response('method_not_allowed',{status:405});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return new Response('server_not_configured',{status:503});
 const admin=createClient(url,key,{auth:{persistSession:false}});
 const {data:secret,error}=await admin.rpc('jd_email_dispatch_secret');
 if(error||typeof secret!=='string'||secret.length<32)return new Response('dispatch_not_configured',{status:503});
 const expected=new TextEncoder().encode(secret),actual=new TextEncoder().encode(req.headers.get('x-jd-dispatch-token')??'');
 let mismatch=expected.length^actual.length;
 for(let i=0;i<expected.length;i++)mismatch|=expected[i]^(actual[i]??0);
 if(mismatch)return new Response('forbidden',{status:403});
 const apiKey=Deno.env.get('RESEND_JD_BILLETTERIE_API_KEY');
 if(!apiKey)return new Response('email_not_configured',{status:503});
 const body=await req.json().catch(()=>({}));
 if(body.operation==='reconcile_history') {
  const key=Deno.env.get('STRIPE_SECRET_KEY');
  if(!key)return new Response('payments_not_configured',{status:503});
  if(body.cursor && (typeof body.cursor!=='string'||!/^[0-9a-f-]{36}$/i.test(body.cursor)))return new Response('invalid_cursor',{status:400});
  try{return Response.json(await reconcileInvoiceHistory(admin,new Stripe(key),body.cursor));}
  catch{return Response.json({error:'invoice_history_failed'},{status:503});}
 }
 if(body.diagnostic==='pdf'||body.diagnostic==='cjk') {
  try {return Response.json(await probeTicketInvoicePdf(admin,body.diagnostic==='cjk'));}
  catch {return Response.json({ok:false,error:'invoice_probe_failed'},{status:503});}
 }
 const invoices=await processTicketInvoices(admin,apiKey);
 const details_requests=await sendInvoiceDetailsRequest(admin,apiKey);
 return Response.json({...invoices,details_requests});
});
