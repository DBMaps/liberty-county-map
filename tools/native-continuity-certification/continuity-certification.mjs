// SYNTHETIC_CONTINUITY_CERTIFICATION — never a consumer/runtime module.
import {createPaidAccess} from './js/gridly-paid-access.mjs';
import {verifyContinuity} from './js/gridly-continuity.mjs';
const config=await (await fetch('./continuity-fixture-config.json')).json();
const key=await crypto.subtle.importKey('jwk',config.publicJwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
const cap=window.Capacitor,platform=cap?.getPlatform?.()==='ios'?'apple':cap?.getPlatform?.()==='android'?'google':null;
const vault=cap?.Plugins?.GridlyContinuity;
const result=document.getElementById('result');let coordinator,canaryCount=0;
const show=data=>{result.textContent=JSON.stringify({classification:'SYNTHETIC CERTIFICATION ONLY',...data},null,2);};
const unavailable=async()=>{throw Error('verification_unavailable');};
const syntheticStore={addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},getProducts:async()=>({result:'error'}),getCurrentEntitlement:unavailable,refreshEntitlement:unavailable,queryCurrentPurchases:unavailable,purchase:unavailable,restorePurchases:unavailable};
async function seed(scenario) {
 const categories={native_reset:'native_reset_failed',native_context:'native_context_failed',issuer_fetch:'issuer_fetch_failed',issuer_http:'issuer_http_error',issuer_response:'issuer_response_invalid',fixture_verification:'fixture_verification_failed',native_commit:'native_commit_failed'};
 const safeScenario=['A','B','C','D','E'].includes(scenario)?scenario:'unknown';
 let stage='native_reset',httpStatus;canaryCount=0;
 const progress=()=>show({scenario:safeScenario,stage,...(httpStatus===undefined?{}:{httpStatus}),protectedInitializations:canaryCount});
 try {
  progress();await coordinator?.stop();
  if(safeScenario==='unknown'||!platform||!vault)throw Error();
  const prior=await vault.beginVerification();if((await vault.revoke({attempt:prior.attempt}))?.revoked!==true)throw Error();
  stage='native_context';progress();const context=await vault.beginVerification();
  if(!context||!/^[a-f0-9]{64}$/.test(context.binding)||typeof context.attempt!=='string'||!context.attempt||!Number.isFinite(context.nowMs))throw Error();
  stage='issuer_fetch';progress();let response;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {response=await fetch('http://127.0.0.1:8765/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,platform,binding:context.binding}),signal:controller.signal});}
  finally {clearTimeout(timer);}
  stage='issuer_http';httpStatus=Number.isInteger(response.status)&&response.status>=100&&response.status<=599?response.status:undefined;
  if(!response.ok)throw Error();
  stage='issuer_response';progress();const fixture=await response.json();
  if(!fixture||Object.keys(fixture).sort().join(',')!=='proof,verifiedAt'||typeof fixture.proof!=='string'||!fixture.proof||fixture.proof.length>4096||!Number.isFinite(fixture.verifiedAt)||fixture.verifiedAt<0)throw Error();
  // B–E deliberately store invalid synthetic authority; the real runtime must reject it.
  stage='fixture_verification';progress();
  if(scenario==='A'&&!await verifyContinuity({proof:fixture.proof,publicKey:key,binding:context.binding,platform,now:context.nowMs}))throw Error();
  stage='native_commit';progress();
  if((await vault.commit({attempt:context.attempt,proof:fixture.proof,verifiedAt:fixture.verifiedAt}))?.saved!==true)throw Error();
  show({scenario:safeScenario,stage:'complete',seeded:true,httpStatus,protectedInitializations:canaryCount});
 }catch {
  show({scenario:safeScenario,stage,errorCategory:categories[stage],...(httpStatus===undefined?{}:{httpStatus}),protectedInitializations:canaryCount});
 }
}
async function check() {
 await coordinator?.stop();canaryCount=0;
 coordinator=createPaidAccess({capacitor:cap,plugin:syntheticStore,authority:{reconcile:unavailable},publicKey:key,continuityVault:vault});
 const state=await coordinator.start();
 if(state.allowed)await coordinator.initializeRuntime(async()=>{const {canary}=await import('./continuity-protected-canary.mjs');canaryCount=canary();});
 show({allowed:state.allowed,temporaryAccess:state.temporaryAccess,state:state.state,protectedInitializations:canaryCount});
}
async function inspect() {
 const context=await vault.beginVerification();
 const valid=await verifyContinuity({proof:context.proof,publicKey:key,binding:context.binding,platform,now:context.nowMs});
 await vault.retain({attempt:context.attempt});
 show({clockTrusted:context.clockTrusted,recordPresent:!!context.proof,signatureAndBoundsValid:!!valid,protectedInitializations:canaryCount});
}
for(const button of document.querySelectorAll('[data-seed]'))button.addEventListener('click',()=>{void seed(button.dataset.seed);});
document.getElementById('check').addEventListener('click',()=>{void check().catch(()=>show({errorCategory:'certification_operation_failed'}));});
document.getElementById('inspect').addEventListener('click',()=>{void inspect().catch(()=>show({errorCategory:'certification_operation_failed'}));});
show({native:!!platform&&!!vault,protectedInitializations:0});
