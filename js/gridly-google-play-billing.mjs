import {verifyAuthorityProof,accessDecision} from './gridly-entitlement.mjs';
import {storeVerificationRequest,STORE_VERIFIERS} from './gridly-store-verification.mjs';
export const GOOGLE_PRODUCT_ID=STORE_VERIFIERS.google.productId,GOOGLE_BASE_PLAN_ID=STORE_VERIFIERS.google.basePlanId;
const failure=(errorCategory='verification_unavailable')=>Object.freeze({platform:null,productId:null,environment:null,subscriptionState:'unknown',entitlementState:'unknown',currentPeriodEnd:null,lastVerifiedAt:null,verificationSource:'none',restoreAvailable:true,errorCategory});
export function createGoogleVerificationAuthority({invoke,environment='production'}) {
 return Object.freeze({reconcile:async request=>{
  if(!invoke||request?.platform!=='google'||request.environment!==environment||!['production','sandbox/test'].includes(environment))throw Error('verification_unavailable');
  const body=storeVerificationRequest(request);
  const name=environment==='sandbox/test'?'gridly-verify-google-sandbox-subscription':'gridly-verify-google-subscription';
  const result=await invoke(name,{body});
  if([401,403].includes(result?.error?.context?.status))throw Error('authority_denied');
  if(result?.error||!result?.data||Object.keys(result.data).join(',')!=='proof'||typeof result.data.proof!=='string'||result.data.proof.length>8192)throw Error('verification_unavailable');
  return result.data.proof;
 }});
}
// Explicit trusted composition only: no startup, credentials, storage or paywall activation.
export function createGooglePlayBilling({capacitor,plugin,authority,publicKey,deliverEntitlement,onNativeDenial,environment='production',crypto=globalThis.crypto,now=Date.now,timeoutMs=15000,purchaseTimeoutMs=120000}) {
 let state=failure(),tail=Promise.resolve(),stopped=false,startPromise,signalTask;
 const listeners=[];
 const android=()=>capacitor?.isNativePlatform?.()===true&&capacitor?.getPlatform?.()==='android'&&!!plugin;
 const read=()=>state,allowed=surface=>accessDecision(state,{platform:android()?'google':null,environment,surface,now:now()});
 const queue=work=>{const next=tail.then(work,work);tail=next.catch(()=>{});return next;};
 async function bounded(work,budget=timeoutMs){let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('unavailable')),budget);})]);}finally{clearTimeout(timer);}}
 async function run(method) {
  state=failure();if(stopped||!android()){state=failure('platform_unavailable');return state;}
  if(!authority||!publicKey||!['production','sandbox/test'].includes(environment))return state;
  let active=true,category='store_unavailable';
  try {state=await bounded(async()=>{
   let native=await plugin[method]();
   if(!active||stopped)return failure();
   if(native?.errorCategory==='already_owned'){native=await plugin.queryCurrentPurchases();}
   if(native?.result==='purchase_pending'||native?.errorCategory==='purchase_pending')return failure('purchase_pending');
   if(native?.errorCategory==='user_cancelled')return failure('user_canceled');
   if(native?.result==='no_evidence')return failure('no_store_evidence');
   if(native?.result!=='purchased'||native.productId!==GOOGLE_PRODUCT_ID||native.basePlanId!==GOOGLE_BASE_PLAN_ID)return failure(native?.errorCategory==='verification_failed'?'invalid_authority':'store_unavailable');
   category='verification_unavailable';
   const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
   let request=storeVerificationRequest({platform:'google',environment,nonce,evidence:{purchaseTokens:[native.purchaseToken]}});
   native=null;
   let proof;try{proof=await bounded(()=>authority.reconcile(request));}finally{request=null;}
   if(!active||stopped)return failure();
   const verified=await verifyAuthorityProof({proof,publicKey,nonce,platform:'google',environment,now:now(),crypto});
   if(!active||stopped)return failure('invalid_authority');
    if(verified.entitlementState==='unknown')return failure(verified.errorCategory==='invalid_authority'?'invalid_authority':'verification_unavailable');
   if(verified.entitlementState==='not_entitled')return verified;
   // LP244.62 sends this proof only after cache reconciliation and required server ack.
   if(!deliverEntitlement||await deliverEntitlement(verified,{isCurrent:()=>active&&!stopped,proof})!==true)return failure();
   return active&&!stopped?verified:failure();
  },method==='purchase'?purchaseTimeoutMs:timeoutMs);}catch{state=failure(category);}finally{active=false;}
  return state;
 }
 const refresh=()=>queue(()=>run('refreshEntitlement'));
 const signal=()=>{if(!signalTask)signalTask=refresh().finally(()=>{signalTask=null;});return signalTask;};
 async function stop(){stopped=true;state=failure();for(const listener of listeners.splice(0)){try{await listener.remove();}catch{}}if(android()){try{await plugin.stopObserving();}catch{}}}
 function start(){if(startPromise)return startPromise;startPromise=queue(async()=>{
  if(stopped||!android()){state=failure('platform_unavailable');return state;}
  try{for(const name of ['purchaseUpdate','appForeground'])listeners.push(await plugin.addListener(name,()=>{void signal();}));await plugin.startObserving();}
  catch{await stop();return state;}return run('queryCurrentPurchases');
 });return startPromise;}
 async function lookupProduct(){
  if(!android()||stopped)return Object.freeze({available:false,errorCategory:'platform_unavailable'});
  try{const item=await bounded(()=>plugin.getProducts());
   if(item?.result!=='available'||item.productId!==GOOGLE_PRODUCT_ID||item.basePlanId!==GOOGLE_BASE_PLAN_ID||typeof item.displayPrice!=='string'||!item.displayPrice||item.displayPrice.length>64||typeof item.displayName!=='string'||item.displayName.length>128||item.currency!=='USD'||item.billingPeriod!=='P1M'||item.storefront!=='US'||item.hasOffer!==false)return Object.freeze({available:false,errorCategory:'product_unavailable'});
   return Object.freeze({available:true,productId:item.productId,basePlanId:item.basePlanId,displayName:item.displayName,displayPrice:item.displayPrice,currency:item.currency,billingPeriod:item.billingPeriod});
  }catch{return Object.freeze({available:false,errorCategory:'store_unavailable'});}
 }
 return Object.freeze({read,allowed,lookupProduct,start,stop,launch:()=>queue(()=>run('queryCurrentPurchases')),resume:signal,refresh,restore:()=>queue(()=>run('restorePurchases')),purchase:()=>queue(()=>run('purchase'))});
}
