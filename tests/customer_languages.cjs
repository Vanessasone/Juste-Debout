const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const translations=JSON.parse(fs.readFileSync('src/constants/customerTranslations.json','utf8'));
const languages=['fr','en','de','it','es','pt','zh','ko','ja'];
const keys=Object.keys(translations.fr).sort();
for(const locale of languages){
 assert.deepEqual(Object.keys(translations[locale]).sort(),keys);
 for(const key of keys){assert.ok(translations[locale][key]?.trim(),`${locale}:${key}`);const vars=s=>(s.match(/\{\w+\}/g)||[]).sort();assert.deepEqual(vars(translations[locale][key]),vars(translations.fr[key]),`${locale}:${key} placeholders`);}
}
const exportsText={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/customerText.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsText,require:name=>name.includes('customerTranslations')?translations:{useI18n:()=>({locale:'en'})}});
assert.equal(exportsText.customerText('en','places',{n:4,max:112}),'4 places remaining out of 112');
assert.equal(exportsText.customerText('unsupported','paid'),translations.en.paid);
const productExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/ticketProductText.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:productExports,require:()=>exportsText,Intl,Date});
for(const locale of languages){
 for(const code of ['day_sat','day_sun','two_days','vip_sat','vip_sun','vip_two_days','family_sat','family_sun','family_two_days','mjc_sat','mjc_sun','black_card','three_days','four_days']){
 const result=productExports.ticketProductText(code,locale,{name:'source'});assert.notEqual(result.name,'source');assert.ok(result.description);
 }
 const black=productExports.ticketProductText('black_card',locale,{name:'source'});assert.ok(black.description.includes('56'));assert.ok(black.description.includes('2027'));
}
async function emailCase(locale,authorized=true){
 let handler,sent=[];const secret='isolated-fixture-dispatch-secret-32chars';
 const job={id:'fixture',kind:'confirmation',source_id:'fixture-order',recipient_email:'fixture@example.invalid',attempts:0};
 const order={id:'fixture-order',status:'paid',total_cents:7000,currency:'EUR',customer_email:job.recipient_email,user_id:null,customer_locale:locale};
 const admin={rpc:async()=>({data:secret,error:null}),from:table=>{const q={select:()=>q,eq:()=>q,lt:()=>q,order:()=>q,limit:()=>q,update:()=>q,maybeSingle:async()=>({data:{id:job.id}}),single:async()=>({data:order}),then:resolve=>resolve({data:table==='ticket_email_outbox'?[job]:[],error:null})};return q;}};
 const source=fs.readFileSync('supabase/functions/send-ticket-emails/index.ts','utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports:{},require:name=>name.includes('translations')?{translations}:name.startsWith('npm:')?{createClient:()=>admin}:{},Deno:{env:{get:()=> 'isolated-fixture-key'},serve:fn=>{handler=fn;}},TextEncoder,Response,Request,Intl,fetch:async(url,options)=>{sent.push(JSON.parse(options.body));return Response.json({id:'fixture-provider'});}});
 const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'x-jd-dispatch-token':authorized?secret:'wrong'}}));
 if(!authorized){assert.equal(response.status,403);assert.equal(sent.length,0);return;}
 assert.equal(response.status,200);assert.equal(sent.length,1);assert.equal(sent[0].subject,translations[locale].emailSubject);assert.ok(sent[0].html.includes(`lang="${locale}"`));assert.ok(sent[0].html.includes(`lang=${locale}`));assert.ok(sent[0].text.includes(translations[locale].paidBody));assert.ok(sent[0].html.includes('vitruve.png'));assert.ok(sent[0].html.includes('juste-debout.png'));
}
(async()=>{for(const locale of languages)await emailCase(locale);await emailCase('en',false);console.log(`9 languages × ${keys.length} texts verified; 126 product labels and 10 isolated email cases passed. No email, account, order or payment created.`);})().catch(e=>{console.error(e);process.exit(1);});
