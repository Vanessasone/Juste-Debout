const assert=require('node:assert/strict');
const fs=require('node:fs');const ts=require('typescript');
const js=ts.transpileModule(fs.readFileSync('supabase/functions/send-ticket-emails/paris-registration.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};new Function('exports','module',js)(mod.exports,mod);
const rules='Règlement signé : respect & sécurité.';
function mockAdmin(status='confirmed') {
 const updates=[];
 return {updates,rpc:async()=>({data:[{id:'job-1',registration_id:'reg-1',recipient_email:'two@example.com',rules_version:'paris-2027-v1',attempts:1}],error:null}),from(table){
  const builder={select(){return builder},eq(){return builder},update(payload){updates.push(payload);return builder},async single(){return {error:null,data:table==='registrations'?{id:'reg-1',event_id:'eb0025ca-b597-4708-9d47-b24ebbf507b5',type:'dancer',status,paris_draft_id:'draft-1'}:table==='paris_rule_versions'?{content:rules,source_url:'https://www.juste-debout-shop.com/reglement'}:{category:'Hip Hop',payload:{dancers:[{email:'one@example.com'},{email:'two@example.com'}]}}}},then(resolve,reject){return Promise.resolve({error:null}).then(resolve,reject)}};return builder;
 }};
}
(async()=>{
 let sent=[];global.fetch=async(url,options)=>{sent.push({url,options});return {ok:true,json:async()=>({id:'provider-1'})}};
 let admin=mockAdmin();const r=await mod.exports.sendParisRegistrationEmails(admin,'FAKE_TEST_KEY');assert.equal(r.sent,1);
 const mail=JSON.parse(sent[0].options.body);assert.deepEqual(mail.to,['two@example.com']);assert.ok(mail.text.includes(rules));assert.equal(Buffer.from(mail.attachments[0].content,'base64').toString('utf8'),rules);assert.equal(sent[0].options.headers['Idempotency-Key'],'paris-registration-job-1');assert.equal(admin.updates.at(-1).status,'sent');
 admin=mockAdmin('registered');sent=[];await mod.exports.sendParisRegistrationEmails(admin,'FAKE_TEST_KEY');assert.equal(sent.length,0);assert.equal(admin.updates.at(-1).status,'pending');
 global.fetch=async()=>({ok:false,status:422});admin=mockAdmin();await mod.exports.sendParisRegistrationEmails(admin,'FAKE_TEST_KEY');assert.equal(admin.updates.at(-1).status,'failed');
 global.fetch=async()=>({ok:false,status:429});admin=mockAdmin();await mod.exports.sendParisRegistrationEmails(admin,'FAKE_TEST_KEY');assert.equal(admin.updates.at(-1).status,'pending');
 console.log('PASS: exact signed rules in body/attachment, authorized recipient, confirmed-only send, idempotency, permanent/transient errors. No real emails sent.');
})().catch(e=>{console.error(e);process.exit(1)});
