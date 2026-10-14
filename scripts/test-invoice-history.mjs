import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
await fs.writeFile('/tmp/jd-invoice-test/history.ts',await fs.readFile('supabase/functions/_shared/invoice-history.ts','utf8'));
const {reconcileInvoiceHistory}=await import('/tmp/jd-invoice-test/history.ts');
const base={id:'11111111-1111-4111-8111-111111111111',currency:'eur',total_cents:4000,customer_email:'buyer@example.test',customer_name:'Buyer',billing_address:null,stripe_checkout_session_id:'cs_test',ticket_order_items:[{product_code:'day_sat'}]};
const verified={payment_status:'paid',amount_total:4000,currency:'eur',metadata:{order_id:base.id},customer_details:{email:base.customer_email,address:null},payment_intent:{payment_method:{billing_details:{name:'Card name',address:{line1:'1 Test Street',country:'FR'}}}}};
async function run(order,session){
 const writes=[];const query={data:[order],error:null};
 for(const method of ['select','eq','in','gte','order','limit','gt'])query[method]=()=>query;
 const admin={from:()=>({...query,update:values=>({eq:async()=>{writes.push(values);return {error:null};}})})};
 const result=await reconcileInvoiceHistory(admin,{checkout:{sessions:{retrieve:async()=>session}}});return {result,writes};
}
let r=await run(base,verified);assert.equal(r.result.eligible,1);assert.equal(r.writes[0].customer_name,'Buyer');assert.equal(r.writes[0].billing_address.line1,'1 Test Street');
r=await run(base,{...verified,payment_intent:null});assert.equal(r.result.missing_address,1);assert.equal(r.writes.length,0);
r=await run(base,{...verified,customer_details:{email:'someone-else@example.test'}});assert.equal(r.result.failed,1);assert.equal(r.writes.length,0);
r=await run(base,{...verified,amount_total:3500});assert.equal(r.result.failed,1);assert.equal(r.writes.length,0);
r=await run({...base,ticket_order_items:[{product_code:'internal_test_1eur'}]},verified);assert.equal(r.result.excluded_test,1);assert.equal(r.writes.length,0);
r=await run({...base,customer_name:null},verified);assert.equal(r.writes[0].customer_name,'Card name');
console.log('PASS: verified historic payment, buyer email matching, amount matching, full address fallback, missing data holds, test exclusion');
await fs.writeFile('/tmp/jd-invoice-test/details-email.ts',await fs.readFile('supabase/functions/_shared/invoice-details-email.ts','utf8'));
const {sendInvoiceDetailsRequest}=await import('/tmp/jd-invoice-test/details-email.ts');
const originalFetch=globalThis.fetch;
const detailsJob={event_id:'test-event',email:'buyer@example.test',lease_token:'test-lease'};
let completion;
const fakeAdmin={rpc:async(name,args)=>name==='claim_invoice_details_request'?{data:detailsJob,error:null}:(completion=args,{error:null})};
try{
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');const body=JSON.parse(options.body);
  assert.equal(body.to[0],detailsJob.email);assert.ok(body.text.includes('https://justedeboutapp.com/ticket-invoices?billing=1'));
  assert.ok(options.headers['Idempotency-Key'].length<100);
  return Response.json({id:'test-provider-id'});
 };
 assert.equal((await sendInvoiceDetailsRequest(fakeAdmin,'test-key')).sent,1);assert.equal(completion.p_provider,'test-provider-id');
 globalThis.fetch=async()=>Response.json({error:'temporary'},{status:500});
 assert.equal((await sendInvoiceDetailsRequest(fakeAdmin,'test-key')).failed,1);assert.equal(completion.p_error,'invoice_details_email_http_500');
}finally{globalThis.fetch=originalFetch;}
console.log('PASS: transactional billing request, intended recipient, stable idempotency, email retry');
