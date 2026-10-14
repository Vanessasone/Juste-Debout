// Isolated Postgres + renderer tests. No real payments or emails.
// npm install --prefix /tmp/jd-invoice-test @electric-sql/pglite@0.5.10 pdf-lib@1.17.1 @pdf-lib/fontkit@1.1.1 tsx@4.21.0
// node --import /tmp/jd-invoice-test/node_modules/tsx/dist/loader.mjs scripts/test-ticket-invoices.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '/tmp/jd-invoice-test/node_modules/@electric-sql/pglite/dist/index.js';
import {PDFDocument} from '/tmp/jd-invoice-test/node_modules/pdf-lib/cjs/index.js';

const db=new PGlite();
await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table public.events(id uuid primary key,title text,starts_on date,ends_on date);
create table public.ticket_orders(id uuid primary key,user_id uuid,event_id uuid,status text,currency text,subtotal_cents int,total_cents int,discount_cents int,customer_name text,customer_email text,paid_at timestamptz);
create table public.ticket_order_items(id uuid primary key default gen_random_uuid(),order_id uuid,product_code text default 'day_sat',product_name text,unit_price_cents int,quantity int,created_at timestamptz default now(),access_date date,access_days int);
grant select on public.ticket_orders to authenticated;
insert into events values('eb0025ca-b597-4708-9d47-b24ebbf507b5','Juste Debout Paris 2027','2027-03-13','2027-03-14');
`);
await db.exec(await fs.readFile('supabase/sql/ticket_invoices.sql','utf8'));
await db.exec(await fs.readFile('supabase/sql/ticket_invoice_details.sql','utf8'));
const buyer='11111111-1111-4111-8111-111111111111';
const first='22222222-2222-4222-8222-222222222222';
const second='33333333-3333-4333-8333-333333333333';
const third='44444444-4444-4444-8444-444444444444';
const event='eb0025ca-b597-4708-9d47-b24ebbf507b5';
async function order(id,{paid=true,address=true,discount=501}={}) {
 await db.query(`insert into ticket_orders(id,user_id,event_id,status,currency,subtotal_cents,total_cents,discount_cents,customer_name,customer_email,paid_at,billing_address)
 values($1,$2,$3,$4,'eur',10000,$5,$6,'Élodie Müller','buyer@example.test',$7,$8)`,
 [id,buyer,event,paid?'paid':'pending',10000-discount,discount,paid?'2026-10-14T12:00:00Z':null,address?{line1:'3 rue de l’Est',postal_code:'75020',city:'Paris',country:'FR'}:null]);
 await db.query(`insert into ticket_order_items(order_id,product_name,unit_price_cents,quantity,access_date,access_days) values($1,'Pass week-end',5000,2,'2027-03-13',2)`,[id]);
}
async function claim(){return (await db.query('select claim_ticket_invoice() as job')).rows[0].job;}
await order(first);await order(second,{paid:false});await order(third,{address:false});
assert.equal(await claim(),null,'Disabled issuer must never create a fiscal document');
await assert.rejects(db.exec(`update ticket_invoice_issuers set enabled=true`),/check constraint/,'VAT treatment is required');
await assert.rejects(db.exec(`update ticket_invoice_issuers set enabled=true,vat_number='FR-TEST'`),/check constraint/,'NULL VAT rate cannot bypass settings validation');
await db.exec(`update ticket_invoice_issuers set vat_rate_bps=0,exemption_note='EXEMPLE DE TEST — exonération à confirmer',enabled=true`);
const job=await claim();
assert.equal(job.number,'JD-BIL-2026-000001');assert.equal(job.order_id,first);
assert.equal(await claim(),null,'No duplicate claim or unpaid/missing-address invoice');
await db.query(`select finish_ticket_invoice_job($1,$2,'temporary_email_failure')`,[first,job.lease_token]);
await db.exec(`update ticket_invoice_jobs set next_attempt_at=now()-interval '1 second'`);
const retry=await claim();assert.equal(retry.id,job.id);assert.equal(retry.number,job.number);
await db.query(`select finish_ticket_invoice_job($1,$2,null)`,[first,job.lease_token]);
assert.equal((await db.query(`select done_at from ticket_invoice_jobs where order_id=$1`,[first])).rows[0].done_at,null,'Stale lease cannot finish newer job');
await assert.rejects(db.exec(`update ticket_invoices set snapshot='{}'`),/issued_invoice_is_immutable/);
await db.query(`update ticket_orders set customer_name='Changed later',status='refunded' where id=$1`,[first]);
assert.equal((await db.query('select snapshot from ticket_invoices')).rows[0].snapshot.buyer.name,'Élodie Müller','Refund/name changes must not rewrite invoice');
await db.query(`select finish_ticket_invoice_job($1,$2,null)`,[first,retry.lease_token]);
await db.query(`update ticket_orders set billing_address=$1 where id=$2`,[{line1:'東京新宿区 1-2-3',city:'東京',country:'JP'},third]);
const next=await claim();assert.equal(next.number,'JD-BIL-2026-000002');
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${buyer}',false);`);
assert.equal((await db.query('select id from ticket_invoices')).rows.length,2);
await db.exec(`select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false)`);
assert.equal((await db.query('select id from ticket_invoices')).rows.length,0,'Invoices private to buyer');
await assert.rejects(db.query('select claim_ticket_invoice()'),/permission denied/);
await db.exec('reset role');
const missingOrder='66666666-6666-4666-8666-666666666666';
await order(missingOrder,{address:false});
await db.query('insert into auth.users values($1,now())',[buyer]);
await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false)`);
await assert.rejects(db.query('select complete_my_ticket_invoice_details($1,$2)',['Intruder',{line1:'1 Test Street',city:'Paris',country:'FR'}]),/verified_account_required/);
await db.exec('reset role');
await db.exec("insert into auth.users values('55555555-5555-4555-8555-555555555555',now());set role authenticated");
assert.equal((await db.query('select complete_my_ticket_invoice_details($1,$2) result',['Intruder',{line1:'1 Test Street',city:'Paris',postal_code:'75020',country:'FR'}])).rows[0].result.queued,0,'A verified different buyer cannot complete another buyer’s invoices');
await db.exec(`select set_config('request.jwt.claim.sub','${buyer}',false)`);
await assert.rejects(db.query('select complete_my_ticket_invoice_details($1,$2)',['Buyer',{line1:'',city:'Paris',country:'FR'}]),/invalid_billing_details/);
const completed=(await db.query('select complete_my_ticket_invoice_details($1,$2) result',['Buyer',{line1:'1 Test Street',city:'Paris',postal_code:'75020',country:'fr'}])).rows[0].result;
assert.equal(completed.queued,1,'Only the verified buyer’s missing, unissued invoice is completed');
assert.equal((await db.query('select complete_my_ticket_invoice_details($1,$2) result',['Buyer',{line1:'1 Test Street',city:'Paris',postal_code:'75020',country:'fr'}])).rows[0].result.queued,0,'Repeat submission cannot duplicate invoices or change already complete orders');
await db.exec('reset role');
assert.equal((await db.query('select billing_address from ticket_orders where id=$1',[missingOrder])).rows[0].billing_address.country,'FR');
const source=(await fs.readFile('supabase/functions/_shared/invoice-pdf.ts','utf8'))
 .replace('npm:pdf-lib@1.17.1','/tmp/jd-invoice-test/node_modules/pdf-lib/cjs/index.js')
 .replace('npm:@pdf-lib/fontkit@1.1.1','/tmp/jd-invoice-test/node_modules/@pdf-lib/fontkit/dist/fontkit.umd.js');
await fs.writeFile('/tmp/jd-invoice-test/renderer.ts',source);
const {invoiceAmounts,renderInvoicePdf}=await import('/tmp/jd-invoice-test/renderer.ts');
const amounts=invoiceAmounts(job.snapshot);
assert.equal(amounts.totals.reduce((a,b)=>a+b,0),9499);assert.equal(amounts.vat,0);
for(const rate of [210,550,1000,2000]) {
 const taxed={...job.snapshot,seller:{...job.snapshot.seller,vat_rate_bps:rate}};
 const v=invoiceAmounts(taxed);assert.equal(v.net+v.vat,taxed.total_cents);assert.equal(v.nets.reduce((a,b)=>a+b,0),v.net);
}
assert.throws(()=>invoiceAmounts({...job.snapshot,total_cents:9500}),/invoice_amount_mismatch/);
const font=await fs.readFile('/tmp/jd-invoice-font-full.ttf');
const latin=await fs.readFile('/tmp/jd-invoice-font-latin.ttf');
assert.equal((await PDFDocument.load(await renderInvoicePdf(job,latin))).getPageCount(),1,'Discounted Latin-only invoice renders without CJK fallback');
const sample={...job,snapshot:{...job.snapshot,buyer:{...job.snapshot.buyer,name:'Élodie Müller / 山田花子 / 박지민'},seller:{...job.snapshot.seller,exemption_note:'DOCUMENT DE TEST — AUCUNE VALEUR COMPTABLE'}}};
const pdf=await renderInvoicePdf(sample,latin,font);await fs.writeFile('/tmp/jd-invoice-sample.pdf',pdf);
assert.equal((await PDFDocument.load(pdf)).getPageCount(),1);
const multi={...sample,snapshot:{...sample.snapshot,items:Array.from({length:40},(_,i)=>({...sample.snapshot.items[0],name:'Billet '+(i+1)+' — '+('Long descriptif de billet '.repeat(3)),quantity:1,unit_price_cents:250}))}};
const multipdf=await renderInvoicePdf(multi,latin,font);assert.ok((await PDFDocument.load(multipdf)).getPageCount()>1);
await fs.writeFile('/tmp/jd-invoice-multipage.pdf',multipdf);
const workerSource=(await fs.readFile('supabase/functions/_shared/ticket-invoices.ts','utf8')).replace('./invoice-pdf.ts','./renderer.ts');
await fs.writeFile('/tmp/jd-invoice-test/worker.ts',workerSource);
const {processTicketInvoices}=await import('/tmp/jd-invoice-test/worker.ts');
const originalFetch=globalThis.fetch;
async function emailTest(success) {
 let updates=[],finishes=[],payload,headers;
 const stored={...job,pdf_path:job.id+'/invoice.pdf',email_sent_at:null};
 const admin={rpc:async(name,args)=>{
  if(name==='claim_ticket_invoice')return {data:stored,error:null};
  finishes.push(args);return {error:null};
 },storage:{from:()=>({download:async()=>({data:new Blob([pdf]),error:null})})},
 from:()=>({update:values=>({eq:async()=>{updates.push(values);return {error:null};}})})};
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://api.resend.com/emails');payload=JSON.parse(options.body);headers=options.headers;
  return Response.json(success?{id:'test-email-id'}:{message:'failure'},{status:success?200:500});
 };
 const result=await processTicketInvoices(admin,'test-key');
 assert.equal(payload.to[0],job.snapshot.buyer.email);
 assert.equal(headers['Idempotency-Key'],'jd-invoice-'+job.id);
 assert.deepEqual(Buffer.from(payload.attachments[0].content,'base64'),Buffer.from(pdf));
 if(success){assert.equal(result.sent,1);assert.ok(updates[0].email_sent_at);assert.equal(finishes[0].p_error,null);}
 else {assert.equal(result.failed,1);assert.equal(updates.length,0);assert.equal(finishes[0].p_error,'invoice_email_http_500');}
}
try{await emailTest(true);await emailTest(false);}finally{globalThis.fetch=originalFetch;}
await db.close();console.log('PASS: issuer validation, paid gating, numbering, retry leases, immutability, refund retention, buyer RLS, totals, Unicode PDF, pagination, email attachment, email idempotency, email retry');
