import {createPaidAccess as fixed} from '../js/gridly-paid-access.mjs';
import {createPaidAccess as legacy} from '../baseline-js/gridly-paid-access.mjs';
const checks=[],record=(name,pass)=>{checks.push({name,result:pass?'PASS':'FAIL'});if(!pass)throw Error('check_failed');};
const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
async function fixture(factory,offset,{mode='active'}={}){
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 let extra=0;const initial=Date.now(),start=performance.now(),elapsed=()=>performance.now()-start+extra;
 const now=()=>initial+offset+elapsed(),serverNow=()=>initial+elapsed();
 const native={result:'purchased',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',purchaseToken:'synthetic-cert-token'};
 const plugin={getProducts:async()=>({result:'available',productId:native.productId,basePlanId:'monthly',displayName:'Gridly CERT',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
 addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
 queryCurrentPurchases:async()=>native,refreshEntitlement:async()=>native,restorePurchases:async()=>native,
 purchase:async()=>({result:'error',errorCategory:'already_owned'})};
 const authority={reconcile:async request=>{
  const time=Math.floor(serverNow()),expired=mode==='expired';
  const body={platform:'google',productId:native.productId,subscriptionState:expired?'expired':'active',entitlementState:expired?'not_entitled':'entitled',
  currentPeriodEnd:new Date(time+(expired?-1:86400000)).toISOString(),lastVerifiedAt:new Date(time).toISOString(),verificationSource:'gridly_server_store_api',
  environment:'production',restoreAvailable:true,errorCategory:'none',nonce:mode==='wrong_nonce'?'b'.repeat(48):request.nonce,audience:'com.gridlygo.gridly',expiresAt:new Date(time+300000).toISOString()};
  const input=encode({alg:'ES256',typ:'gridly-entitlement-v1'})+'.'+encode(body);
  const bytes=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(input)));
  if(mode==='tampered')bytes[0]^=1;
  return input+'.'+btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 }};
 const coordinator=factory({capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},plugin,authority,publicKey:keys.publicKey,now,monotonic:()=>performance.now()+extra,schedule:()=>1,cancel:()=>{}});
 return {coordinator,advance:ms=>{extra+=ms;}};
}
export async function runCertification(){
 checks.length=0;let active;
 try{
  active=await fixture(legacy,-30000);
  const before=await active.coordinator.start();record('build14_signed_active_becomes_unknown',before.state==='unknown'&&before.errorCategory==='invalid_authority'&&!before.allowed);await active.coordinator.stop();
  for(const offset of [-60000,-30000,0,30000]){
   active=await fixture(fixed,offset);record('fixed_launch_'+offset,(await active.coordinator.start()).allowed);
   record('fixed_restore_'+offset,(await active.coordinator.restore()).allowed);
   record('fixed_resume_'+offset,(await active.coordinator.resume()).allowed);
   record('fixed_already_owned_'+offset,(await active.coordinator.purchase()).allowed);
   active.advance(300001);record('fixed_expiry_'+offset,!active.coordinator.allowed());await active.coordinator.stop();
  }
  for(const mode of ['tampered','wrong_nonce','expired']){
   active=await fixture(fixed,-30000,{mode});record('security_'+mode,!(await active.coordinator.start()).allowed);await active.coordinator.stop();
  }
 }catch{if(active)await active.coordinator.stop();}
 const result={classification:'SYNTHETIC_PROOF_CLOCK_CERTIFICATION',allPassed:checks.length===24&&checks.every(row=>row.result==='PASS'),checks,
  liveProviderTested:false,productionSignerIdentityVerified:false,physicalDeviceConfirmed:false};
 window.__p0ClockCertification=result;document.getElementById('result').textContent=JSON.stringify(result,null,2);return result;
}
document.getElementById('run').addEventListener('click',()=>{void runCertification();});
