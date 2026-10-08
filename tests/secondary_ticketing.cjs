const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const translations=JSON.parse(fs.readFileSync('src/constants/customerTranslations.json','utf8'));
function moduleAt(path,requireMock={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(!(name in requireMock))throw Error('Unexpected import '+name);return requireMock[name];},Date,URLSearchParams,setTimeout:fn=>fn()});return exports;}
const {validateFamilyRecipients:validate}=moduleAt('src/lib/familyRecipients.ts');
const tickets=[0,1,2,3].map(i=>({id:String(i),ticket_products:{code:'family_sat'}}));const names={'0':'Adult A','1':'Adult B','2':'Child A','3':'Child B'},births={'2':'2015-03-14','3':'2020-02-29'};
assert.equal(validate(tickets,names,births),null);
assert.equal(validate(tickets.slice(1),names,births),'familyIncomplete');
assert.equal(validate(tickets,{...names,'0':''},births),'invalidContact');
assert.equal(validate(tickets,{...names,'0':'a'.repeat(121)},births),'invalidContact');
assert.equal(validate(tickets,names,{...births,'3':'2020-02-30'}),'birthError');
assert.equal(validate(tickets,names,{...births,'2':'2015-03-13'}),'familyUnder12');
assert.equal(validate(tickets.map(t=>({...t,ticket_products:{code:'family_two_days'}})),names,births),'familyUnder12');
assert.equal(validate(tickets,names,{...births,'3':'2027-03-14'}),'familyUnder12');
async function batchCase(){const supabase={auth:{getUser:async()=>({data:{user:{id:'fixture-user'}}})},from:()=>{const q={insert:()=>q,select:()=>q,single:async()=>({data:{id:'fixture-batch'}}),then:r=>r({data:null,error:null})};return q;},rpc:async(name,args)=>({data:args.p_ticket==='b'?{ok:false,error:'forbidden'}:{ok:true,token:'fixture-token'}})};
const mod=moduleAt('src/lib/ticketTransferBatch.ts',{'@/lib/supabase':{supabase}});
const parsed=mod.parseRecipientList('Alex ; Example ; alex@example.invalid\nalex@example.invalid\nwrong');assert.equal(parsed.valid.length,1);assert.equal(parsed.duplicates.length,1);assert.equal(parsed.invalid.length,1);
const result=await mod.createTransferBatch([{id:'a'},{id:'b'}],[{email:'a@example.invalid'},{email:'b@example.invalid'}],'ja');assert.equal(result.failedCount,1);assert.equal(result.invitationLinks.length,1);assert.ok(result.invitationLinks[0].link.startsWith('https://justedeboutapp.com/claim-ticket?'));assert.ok(result.invitationLinks[0].link.endsWith('&lang=ja'));
}
async function invitationEmail(locale,eligible=true){let handler,sent=[];const secret='isolated-fixture-dispatch-secret-32chars';const job={id:'fixture',kind:'invitation',source_id:'fixture-ticket',recipient_email:'recipient@example.invalid',attempts:0,transfer_token:'fixture-token'};
 const ticket={id:job.source_id,order_id:'fixture-order',status:'active',transfer_email:eligible?job.recipient_email:'wrong@example.invalid',transfer_status:'pending',transfer_token:job.transfer_token};
 const admin={rpc:async()=>({data:secret}),from:table=>{const q={select:()=>q,eq:()=>q,lt:()=>q,order:()=>q,limit:()=>q,update:()=>q,maybeSingle:async()=>({data:table==='ticket_orders'?{customer_locale:locale}:{id:job.id}}),single:async()=>({data:ticket}),then:r=>r({data:[job],error:null})};return q;}};
 const code=ts.transpileModule(fs.readFileSync('supabase/functions/send-ticket-emails/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports:{},require:name=>name.includes('translations')?{translations}:name.startsWith('npm:')?{createClient:()=>admin}:{},Deno:{env:{get:()=> 'fixture-key'},serve:fn=>{handler=fn;}},TextEncoder,Response,Request,Intl,fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'fixture-provider'});}});
 const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'x-jd-dispatch-token':secret}}));assert.equal(response.status,200);
 if(!eligible){assert.equal(sent.length,0);return;}
 assert.equal(sent.length,1);assert.equal(sent[0].subject,translations[locale].invitationEmailSubject);assert.equal(sent[0].text,translations[locale].claimLogin);assert.ok(sent[0].html.includes(`lang="${locale}"`));assert.ok(sent[0].html.includes(`claim-ticket?token=fixture-token&amp;lang=${locale}`));
}
async function claimCase({token,user,error}){const effects=[],messages=[],routes=[],claims=[],saved=[];let primaryEffect;
 const mod=moduleAt('src/app/claim-ticket.tsx',{'@/lib/i18n':{LANGUAGES:[],useI18n:()=>({setLocale:()=>{}})},'@/lib/customerText':{useCustomerText:()=>key=>key},'@/components/LanguagePicker':{},'expo-router':{useLocalSearchParams:()=>({token}),useRouter:()=>({push:()=>{},replace:route=>routes.push(route)})},'@react-native-async-storage/async-storage':{__esModule:true,default:{setItem:async(k,v)=>saved.push([k,v]),removeItem:async()=>{}}},'react':{useEffect:fn=>effects.push(fn),useState:v=>[v,value=>messages.push(value)]},'react-native':{StyleSheet:{create:v=>v}},'react/jsx-runtime':{jsx:()=>null,jsxs:()=>null},'@/components/ui':{},'@/lib/supabase':{supabase:{auth:{getUser:async()=>({data:{user}})}}},'@/lib/tickets':{acceptTicketTransfer:async token=>{claims.push(token);if(error)throw Error(error);}},'@/constants/brand':{Space:{}}});
 mod.default();effects[1]();for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));return {messages,routes,claims,saved};
}
(async()=>{await batchCase();for(const locale of Object.keys(translations))await invitationEmail(locale);await invitationEmail('en',false);
 let r=await claimCase({token:null,user:null});assert.ok(r.messages.includes('claimInvalid'));assert.equal(r.claims.length,0);assert.equal(r.saved.length,0);
 r=await claimCase({token:'fixture',user:null});assert.ok(r.messages.includes('claimLogin'));assert.equal(r.claims.length,0);assert.equal(r.saved.length,1);
 r=await claimCase({token:'fixture',user:{id:'fixture'},error:'wrong_recipient'});assert.ok(r.messages.includes('claimWrong'));assert.equal(r.routes.length,0);
 r=await claimCase({token:'fixture',user:{id:'fixture'}});assert.ok(r.messages.includes('claimDone'));assert.equal(r.routes[0],'/(tabs)/tickets');
 console.log('8 family validation cases, recipient import/partial failure, 10 invitation email cases and 4 claim cases passed. Fully isolated; no persistent data, emails or payments.');})().catch(e=>{console.error(e);process.exit(1);});
