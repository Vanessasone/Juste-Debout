import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.110.1";
import {processTicketInvoices,probeTicketInvoicePdf} from "../_shared/ticket-invoices.ts";
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
 if(body.diagnostic==='pdf'||body.diagnostic==='cjk') {
  try {return Response.json(await probeTicketInvoicePdf(admin,body.diagnostic==='cjk'));}
  catch {return Response.json({ok:false,error:'invoice_probe_failed'},{status:503});}
 }
 return Response.json(await processTicketInvoices(admin,apiKey));
});
