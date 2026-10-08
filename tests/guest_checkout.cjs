const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('supabase/functions/create-guest-ticket-checkout/index.ts','utf8').replace(/^import .*;$/gm,'');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
async function run(overrides={}){
  let handler,sessionCalls=[],rpcCalls=[],released=false;
  const admin={rpc:async(name,args)=>{
    rpcCalls.push([name,args]);
    if(name==='consume_guest_ticket_limit')return {data:!overrides.rateBlocked};
    if(name==='release_ticket_order'){released=true;return {data:{ok:true}};}
    return {data:overrides.reservationError?{ok:false,error:overrides.reservationError}:{ok:true,order_id:'fixture-order'}};
  },from:table=>{
    let mode='read';
    const builder={select:()=>builder,in:()=>builder,eq:()=>builder,order:()=>builder,update:()=>{mode='update';return builder;},maybeSingle:()=>builder,single:()=>builder,
      then:resolve=>resolve(table==='ticket_products'?{data:[{code:overrides.internal?'internal_test_4days_1eur':'day_sat'}]}:table==='ticket_order_items'?{data:[{product_id:'fixture-product',product_name:'Pass',unit_price_cents:4000,quantity:1}]}:mode==='update'?{error:null}:{data:{id:'fixture-order',currency:'EUR',subtotal_cents:4000,total_cents:overrides.mismatch?3999:4000,discount_cents:0,promo_code:null}})};
    return builder;
  }};
  class Stripe{constructor(){this.checkout={sessions:{create:async args=>{sessionCalls.push(args);return {id:'cs_fixture',url:'https://checkout.stripe.com/fixture'};},expire:async()=>{}}};}}
  vm.runInNewContext(code,{Deno:{env:{get:()=> 'isolated-fixture-secret'},serve:fn=>handler=fn},createClient:()=>admin,Stripe,Response,crypto:require('node:crypto').webcrypto,TextEncoder,console:{error(){}},Map,Date});
  const body={email:'buyer@example.invalid',name:'Isolated Buyer',eventId:'fixture-event',items:[{productId:'fixture-product',quantity:1}],locale:'en',...overrides.body};
  const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
  return {status:response.status,data:await response.json(),sessionCalls,rpcCalls,released};
}
(async()=>{
  let r=await run();assert.equal(r.status,200);assert.equal(r.sessionCalls.length,1);assert.equal(r.sessionCalls[0].customer_email,'buyer@example.invalid');assert.equal(r.sessionCalls[0].metadata.kind,'guest_ticket');assert.ok(!('user_id' in r.sessionCalls[0].metadata));assert.equal(r.rpcCalls.find(x=>x[0]==='create_ticket_order_reserved')[1].p_user,null);assert.match(r.sessionCalls[0].success_url,/justedeboutapp.com\/ticket-success/);
  r=await run({body:{email:'invalid'}});assert.equal(r.status,400);assert.equal(r.sessionCalls.length,0);
  r=await run({rateBlocked:true});assert.equal(r.status,429);assert.equal(r.sessionCalls.length,0);
  r=await run({internal:true});assert.equal(r.status,403);assert.equal(r.sessionCalls.length,0);
  for(const error of ['sales_not_started','sold_out','invalid_or_expired_promo']){r=await run({reservationError:error});assert.equal(r.status,409);assert.equal(r.sessionCalls.length,0);}
  r=await run({mismatch:true});assert.equal(r.status,500);assert.equal(r.sessionCalls.length,0);assert.equal(r.released,true);
  console.log('8 isolated guest checkout cases passed; no network, account, order or payment created.');
})().catch(e=>{console.error(e);process.exit(1);});
