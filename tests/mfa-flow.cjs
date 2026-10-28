const {test}=require('node:test'),assert=require('node:assert/strict'),ts=require('typescript'),fs=require('node:fs');
const source=ts.transpileModule(fs.readFileSync('lib/mfa-flow.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const out={exports:{}};
new Function('require','module','exports',source)(()=>({TotpMultiFactorGenerator:{FACTOR_ID:'totp',assertionForSignIn:(uid,code)=>({uid,code})}}),out,out.exports);
const resolve=out.exports.resolveTotpChallenge;
test('MFA rejects incomplete codes and unsupported or foreign factors without authenticating',async()=>{
 let called=false;const resolver={hints:[{uid:'mine',factorId:'totp'},{uid:'phone',factorId:'phone'}],resolveSignIn:async()=>{called=true;}};
 for(const [id,code] of [['mine','123'],['mine','abcdef'],['other','123456'],['phone','123456']])await assert.rejects(resolve(resolver,id,code));
 assert.equal(called,false);
});
test('MFA returns a user only after Firebase accepts the selected factor; failed codes stay rejected',async()=>{
 const user={uid:'p'},hints=[{uid:'mine',factorId:'totp'}];
 await assert.rejects(resolve({hints,resolveSignIn:async()=>{throw Error('invalid-code');}},'mine','123456'));
 const result=await resolve({hints,resolveSignIn:async a=>{assert.deepEqual(a,{uid:'mine',code:'654321'});return {user};}},'mine','654321');
 assert.equal(result.user,user);
});
