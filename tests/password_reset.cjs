const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
async function run({update=false,user=true,email='person@example.test',password='fixture-pass',confirm='fixture-pass',fail=false}){
 const states=[email,password,confirm,false,!update,false,'',0],calls=[],effects=[];let tree,index;
 const jsx=(type,props)=>({type,props});
 const auth={getUser:async()=>({data:{user:user?{id:'fixture'}:null},error:null}),updateUser:async args=>{calls.push(['update',args]);return {error:fail?Error('fixture'):null}},resetPasswordForEmail:async(...args)=>{calls.push(['send',...args]);return {error:fail?Error('fixture'):null}}};
 const requireMock=n=>n==='react'?{useState:()=>{let i=index++;return[states[i],v=>states[i]=v]},useEffect:f=>effects.push(f)}:n==='react/jsx-runtime'?{jsx,jsxs:jsx}:n==='react-native'?{View:'View',TextInput:'Input',Pressable:'Button'}:n==='expo-router'?{useRouter:()=>({replace:()=>{}})}:n==='@/lib/supabase'?{supabase:{auth}}:n==='@/lib/theme'?{useColors:()=>({})}:n==='@/lib/passwordResetText'?{usePasswordResetText:()=>k=>k}:n==='@/components/ui'?{Screen:'Screen',T:'Text',PageHeader:'Header'}:n==='@/components/LanguagePicker'?{LanguagePicker:'LanguagePicker'}:{};
 const code=ts.transpileModule(fs.readFileSync('src/components/PasswordResetScreen.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,exports={};vm.runInNewContext(code,{exports,require:requireMock,Date});
 function render(){index=0;tree=exports.PasswordResetScreen({update})}render();effects[0]();await new Promise(r=>setImmediate(r));render();
 const nodes=[];function walk(n){if(!n||typeof n!=='object')return;if(n.type==='Button')nodes.push(n);[].concat(n.props?.children||[]).flat().forEach(walk)}walk(tree);if(!nodes[0].props.disabled)await nodes[0].props.onPress();return{states,calls};
}
(async()=>{
 let r=await run({});assert.equal(r.calls[0][0],'send');assert.equal(r.calls[0][2].redirectTo,'https://justedeboutapp.com/auth-callback');assert.equal(r.states[5],true);
 r=await run({email:'bad'});assert.equal(r.calls.length,0);
 r=await run({update:true});assert.equal(r.calls[0][0],'update');assert.equal(r.states[5],true);assert.equal(r.states[1],'');
 r=await run({update:true,confirm:'different'});assert.equal(r.calls.length,0);
 r=await run({update:true,user:false});assert.equal(r.calls.length,0);assert.equal(r.states[6],'expired');
 r=await run({update:true,fail:true});assert.equal(r.states[5],false);assert.equal(r.states[6],'error');
 console.log('6 isolated password recovery cases PASS; no emails sent or credentials changed.');
})().catch(e=>{console.error(e);process.exit(1)});
