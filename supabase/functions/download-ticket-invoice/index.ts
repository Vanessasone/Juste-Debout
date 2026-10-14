import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.1";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers:cors});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return Response.json({error:'server_not_configured'},{status:503,headers:cors});
 const admin=createClient(url,key,{auth:{persistSession:false}});
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')??'';
 const {data:{user},error:authError}=await admin.auth.getUser(token);
 if(authError||!user)return Response.json({error:'unauthorized'},{status:401,headers:cors});
 try {
  const {invoiceId}=await req.json();
  if(typeof invoiceId!=='string'||!/^[0-9a-f-]{36}$/i.test(invoiceId))return Response.json({error:'invalid_invoice'},{status:400,headers:cors});
  const {data:invoice,error}=await admin.from('ticket_invoices').select('pdf_path,number,ticket_orders!inner(user_id)').eq('id',invoiceId).maybeSingle();
  const order=invoice?.ticket_orders as unknown as {user_id:string|null}|undefined;
  if(error||!invoice||order?.user_id!==user.id||!invoice.pdf_path)return Response.json({error:'invoice_not_found'},{status:404,headers:cors});
  const {data:link,error:linkError}=await admin.storage.from('ticket-invoices').createSignedUrl(invoice.pdf_path,60,{download:invoice.number+'.pdf'});
  if(linkError||!link)return Response.json({error:'download_unavailable'},{status:503,headers:cors});
  return Response.json({url:link.signedUrl},{headers:{...cors,'Cache-Control':'no-store'}});
 } catch {return Response.json({error:'download_unavailable'},{status:500,headers:cors});}
});
