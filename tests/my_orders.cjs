const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
async function run(user,method='getMyOrders',authError=null){
  let filters=[],queries=0;
  const rows=[{id:'one',profile_id:'account-a',order_items:[]},{id:'two',profile_id:'account-b',order_items:[]}];
  const supabase={auth:{getUser:async()=>({data:{user},error:authError})},from:()=>{queries++;const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},order:()=>q,limit:()=>q,then:resolve=>resolve({data:rows.filter(r=>filters.every(([k,v])=>r[k]===v)),error:null})};return q;}};
  const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/orders.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>({supabase})});
  const result=await exports[method]();return {result:JSON.parse(JSON.stringify(result)),filters,queries};
}
(async()=>{
 let r=await run({id:'account-a',roles:['admin']});assert.deepEqual(r.result.map(o=>o.id),['one']);assert.deepEqual(r.filters,[['profile_id','account-a']]);
 r=await run({id:'account-b'});assert.deepEqual(r.result.map(o=>o.id),['two']);
 r=await run(null);assert.equal(r.queries,0);assert.deepEqual(r.result,[]);
 await assert.rejects(run({id:'account-a'},'getMyOrders',new Error('invalid session')),/invalid session/);
 r=await run({id:'account-a',roles:['admin']},'getAllOrders');assert.equal(r.result.length,2);assert.equal(r.filters.length,0);
 console.log('5 isolated ownership cases passed; customer view filtered, staff console preserved.');
})().catch(e=>{console.error(e);process.exit(1);});
