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
 await coordinator?.stop();canaryCount=0;
 if(!platform||!vault)throw Error('native_required');
 const prior=await vault.beginVerification();if((await vault.revoke({attempt:prior.attempt}))?.revoked!==true)throw Error('native_write_failed');
 const context=await vault.beginVerification();
 const response=await fetch('http://127.0.0.1:8765/seed',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,platform,binding:context.binding})});
 if(!response.ok)throw Error('fixture_issuer_unavailable');const fixture=await response.json();
 // Negative cases deliberately store invalid synthetic material in THIS separate
 // certification app's real vault; the unmodified runtime must reject it.
 if(scenario==='A'&&!await verifyContinuity({proof:fixture.proof,publicKey:key,binding:context.binding,platform,now:context.nowMs}))throw Error('fixture_invalid');
 if((await vault.commit({attempt:context.attempt,proof:fixture.proof,verifiedAt:fixture.verifiedAt}))?.saved!==true)throw Error('native_write_failed');
 show({scenario,seeded:true,expected:scenario==='A'?'temporary admission':'denied',protectedInitializations:canaryCount});
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
for(const button of document.querySelectorAll('[data-seed]'))button.addEventListener('click',()=>{void seed(button.dataset.seed).catch(()=>show({errorCategory:'certification_operation_failed'}));});
document.getElementById('check').addEventListener('click',()=>{void check().catch(()=>show({errorCategory:'certification_operation_failed'}));});
document.getElementById('inspect').addEventListener('click',()=>{void inspect().catch(()=>show({errorCategory:'certification_operation_failed'}));});
show({native:!!platform&&!!vault,protectedInitializations:0});
