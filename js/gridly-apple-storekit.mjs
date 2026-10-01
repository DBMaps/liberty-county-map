import {verifyAuthorityProof,accessDecision} from './gridly-entitlement.mjs';
import {storeVerificationRequest,STORE_VERIFIERS} from './gridly-store-verification.mjs';

export const APPLE_PRODUCT_ID=STORE_VERIFIERS.apple.productId;
// An unproven local failure can never pass shared accessDecision.
const failure=(category='invalid_authority')=>Object.freeze({platform:null,productId:null,environment:null,subscriptionState:'unknown',entitlementState:'unknown',currentPeriodEnd:null,lastVerifiedAt:null,verificationSource:'none',restoreAvailable:true,errorCategory:category});
const error=category=>Object.freeze({available:false,errorCategory:category});
// Use a trusted Supabase functions.invoke adapter carrying future native admission.
// An anon key alone is not request authorization; no secrets or HTTP bodies are logged.
export function createAppleVerificationAuthority({invoke}) {
 return Object.freeze({reconcile:async request=>{
  if(!invoke||request?.platform!=='apple')throw Error('verification_unavailable');
  const body=storeVerificationRequest(request);
  const result=await invoke('gridly-verify-apple-subscription',{body});
  if([401,403].includes(result?.error?.context?.status))throw Error('authority_denied');
  if(result?.error||!result?.data||Object.keys(result.data).join(',')!=='proof'||typeof result.data.proof!=='string'||result.data.proof.length>8192)throw Error('verification_unavailable');
  return result.data.proof;
 }});
}
// Opt-in application composition. Importing this module starts no native/store/network work.
// Caller registers GridlyStoreKit through Capacitor's registerPlugin('GridlyStoreKit').
export function createAppleStoreKit({capacitor,plugin,authority,publicKey,deliverEntitlement,onNativeDenial,environment='production',crypto=globalThis.crypto,now=Date.now,timeoutMs=15000,purchaseTimeoutMs=120000}) {
 let state=failure('verification_unavailable'),tail=Promise.resolve(),stopped=false,started=false,startPromise,signalTask;
 const listeners=[];
 const ios=()=>capacitor?.isNativePlatform?.()===true&&capacitor?.getPlatform?.()==='ios'&&!!plugin;
 const allowed=surface=>accessDecision(state,{platform:ios()?'apple':null,environment:state.environment??environment,surface,now:now()});
 const read=()=>state;
 const queue=work=>{const next=tail.then(work,work);tail=next.catch(()=>{});return next;};
 async function bounded(work,budget=timeoutMs){let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('unavailable')),budget);})]);}finally{clearTimeout(timer);}}
 async function run(method,options={}) {
  state=failure('verification_unavailable');
  if(stopped||!ios()){state=failure('platform_unavailable');return state;}
  if(!['production','sandbox/test','auto'].includes(environment)||!authority||!publicKey){return state;}
  let active=true,category='store_unavailable';
  try {
   state=await bounded(async()=>{
    let native=await plugin[method](options);
    if(!active||stopped)return failure();
    if(native?.result==='user_cancelled')return failure('user_canceled');
    if(native?.result==='purchase_pending')return failure('purchase_pending');
    if(native?.result==='no_evidence')return failure('no_store_evidence');
    // No-evidence is a native hint; never issue a backend-confirmed denial from it.
    if(native?.result!=='verified')return failure(native?.errorCategory==='verification_failed'?'invalid_authority':'store_unavailable');
    const storeEnvironment=environment==='auto'?native.environment:environment;
    if(native.productId!==APPLE_PRODUCT_ID||native.environment!==storeEnvironment||
      !['production','sandbox/test'].includes(storeEnvironment)||typeof native.completionHandle!=='string'||native.completionHandle.length>64)return failure();
    if(native.revoked===true && onNativeDenial)await onNativeDenial();
    category='verification_unavailable';
    const nonce=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
    let request=storeVerificationRequest({platform:'apple',environment:storeEnvironment,nativeAuthorizationEnvironment:'production',nonce,evidence:{signedTransactions:[native.signedTransaction]}});
    const handle=native.completionHandle;
    native=null; // Do not retain native evidence in session/read/UI state.
    let proof;
    try {proof=await bounded(()=>authority.reconcile(request));}finally{request=null;}
    if(!active||stopped)return failure();
    const verified=await verifyAuthorityProof({proof,publicKey,nonce,platform:'apple',environment:storeEnvironment,now:now(),crypto});
    if(!active||stopped)return failure('invalid_authority');
    if(verified.entitlementState==='unknown')return failure(verified.errorCategory==='invalid_authority'?'invalid_authority':'verification_unavailable');
    if(verified.entitlementState==='not_entitled')return verified;
    // Apple finish means delivery completed, not just receipt validation.
    // No delivery port exists in current runtime: production finishing stays blocked.
    if(!deliverEntitlement||await deliverEntitlement(verified,{isCurrent:()=>active&&!stopped,proof})!==true)return failure('verification_unavailable');
    if(!active||stopped)return failure();
    // Finish only this native verified transaction, never all unfinished purchases.
    category='store_unavailable';
    const completion=await plugin.finishTransaction({completionHandle:handle});
    if(!active||stopped||completion?.finished!==true)return failure('store_unavailable');
    return verified;
   },['purchase','restorePurchases'].includes(method)?purchaseTimeoutMs:timeoutMs);
  } catch {state=failure(category);}
  finally{active=false;}
  return state;
 }
 const refresh=()=>queue(()=>run('refreshEntitlement'));
 const signal=()=>{if(!signalTask){signalTask=refresh().finally(()=>{signalTask=null;});}return signalTask;};
 async function lookupProduct(){
  if(!ios()||stopped)return error('platform_unavailable');
  try {const item=await bounded(()=>plugin.getProducts());
   if(item?.result!=='available'||item.productId!==APPLE_PRODUCT_ID||typeof item.displayPrice!=='string'||!item.displayPrice||item.displayPrice.length>64||typeof item.displayName!=='string'||item.displayName.length>128||item.currency!=='USD'||item.billingPeriod!=='P1M'||item.storefront!=='US'||item.hasOffer!==false)return error('product_unavailable');
   return Object.freeze({available:true,productId:item.productId,displayName:item.displayName,displayPrice:item.displayPrice,currency:item.currency,billingPeriod:item.billingPeriod});
  }catch{return error('store_unavailable');}
 }
 async function stop(){stopped=true;started=false;state=failure('verification_unavailable');for(const listener of listeners.splice(0)){try{await listener.remove();}catch{}}
  if(ios()){try{await plugin.stopObserving();}catch{}}
 }
 function start(){
  if(startPromise)return startPromise;
  startPromise=queue(async()=>{
   if(started||stopped||!ios())return read();
   try{
    listeners.push(await plugin.addListener('transactionUpdate',()=>{void signal();}));
    listeners.push(await plugin.addListener('appForeground',()=>{void signal();}));
    await plugin.startObserving();started=true;
   }catch{await stop();state=failure('store_unavailable');return state;}
   return run('getCurrentEntitlement');
  });return startPromise;
 }
 return Object.freeze({read,allowed,lookupProduct,start,stop,launch:()=>queue(()=>run('getCurrentEntitlement')),resume:signal,refresh,
  purchase:()=>queue(()=>run('purchase')),restore:()=>queue(()=>run('restorePurchases',{userInitiated:true}))});
}
