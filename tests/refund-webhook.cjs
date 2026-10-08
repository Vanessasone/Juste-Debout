const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let handler,event,calls=[],status='paid',refunds=[],fail=false;
class Stripe {
 static createSubtleCryptoProvider(){return {};}
 webhooks={constructEventAsync:async()=>{if(fail)throw Error('invalid');return event;}};
 charges={retrieve:async()=>({payment_intent:'pi_test',amount:39700,currency:'eur'})};
 refunds={list:()=>({async *[Symbol.asyncIterator](){yield* refunds;}})};
 paymentIntents={retrieve:async()=>({latest_charge:'ch_test'})};
}
const admin={
 rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true}};},
 from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{status}})})})})
};
const source=fs.readFileSync('supabase/functions/stripe-ticket-webhook/index.ts','utf8').replace(/^import .*;\n/gm,'');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{Stripe,createClient:()=>admin,Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},Response,console:{log(){},error(){}}});
async function send(type,object){event={type,data:{object}};return handler(new Request('https://test',{method:'POST',headers:{'Stripe-Signature':'test'},body:'{}'}));}
(async()=>{
 refunds=[{status:'succeeded',amount:1000},{status:'pending',amount:2000},{status:'failed',amount:3000}];
 assert.equal((await send('refund.updated',{charge:'ch_test'})).status,200);
 assert.equal(calls.at(-1).args.p_refunded_cents,1000);
 refunds=[{status:'succeeded',amount:39700}];
 await send('charge.refunded',{id:'ch_test'});
 assert.equal(calls.at(-1).args.p_refunded_cents,39700);
 fail=true;const before=calls.length;
 assert.equal((await send('charge.refunded',{id:'ch_test'})).status,400);
 assert.equal(calls.length,before);fail=false;
 status='refunded';
 await send('checkout.session.completed',{payment_status:'paid',metadata:{order_id:'test'},payment_intent:'pi_test'});
 assert.equal(calls.length,before);
 status='paid';refunds=[];
 await send('checkout.session.completed',{payment_status:'paid',metadata:{order_id:'test'},payment_intent:'pi_test'});
 assert.equal(calls.at(-2).name,'finalize_ticket_order');
 assert.equal(calls.at(-1).name,'record_ticket_refund');
 console.log('PASS: succeeded-only sums, full refund, signature rejection, late checkout, refund-before-checkout recovery');
})().catch(e=>{console.error(e);process.exitCode=1;});
