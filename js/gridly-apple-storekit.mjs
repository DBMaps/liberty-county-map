import {verifyAuthorityProof,accessDecision} from './gridly-entitlement.mjs';
import {storeVerificationRequest,STORE_VERIFIERS} from './gridly-store-verification.mjs';

export const APPLE_PRODUCT_ID=STORE_VERIFIERS.apple.productId;

// Diagnostic-only observer. This never participates in an access decision.
const DIAGNOSTIC_STAGES=new Set(["tap","queue","action","native_entry","product_fetch","product_validation","purchase_call","purchase_result","restore_sync","current_enumeration","latest_lookup","native_evidence","native_invocation","native_result","authority","proof","delivery","finish","coordinator","presentation"]);
const DIAGNOSTIC_OUTCOMES=new Set(["started","queued","returned","passed","failed","accepted","rejected","success","cancelled","pending","unknown","none","match","multiple","unverified","busy","count_rejected","id_rejected","type_rejected","period_rejected","offers_rejected","storefront_rejected","verified","no_evidence","timeout","entitled","not_entitled","temporarily_unavailable","unsupported_platform","initializing","paywall","unlocked","runtime_failed","unavailable"]);
export function createStoreKitDiagnostics({enabled=false,now=()=>globalThis.performance.now()}={}) {
 const attempts=new Map(),listeners=new Set();let sequence=0,lastUser=null,last=null;
 const selected=()=>attempts.get(lastUser??last);
 const read=()=>Object.freeze([...(selected()?.events??[])]);
 const publish=()=>{for(const listener of listeners){try{listener(read());}catch{}}};
 const write=(trace,stage,outcome,details={})=>{
  if(!trace||!DIAGNOSTIC_STAGES.has(stage)||!DIAGNOSTIC_OUTCOMES.has(outcome))return;
  const value={attempt:trace.id,action:trace.action,stage,outcome,elapsedMs:Math.min(3600000,Math.max(0,Math.floor(now()-trace.start)))};
  if(Number.isInteger(details.errorCode)&&details.errorCode>=-65536&&details.errorCode<=65535)value.errorCode=details.errorCode;
  if(Number.isInteger(details.httpStatus)&&details.httpStatus>=100&&details.httpStatus<=599)value.httpStatus=details.httpStatus;
  const event=Object.freeze(value);
  if(trace.events.length===64){const index=trace.events.findIndex(item=>item!==trace.failure);trace.events.splice(index<0?0:index,1);}
  trace.events.push(event);
  if(!trace.failure&&(['failed','rejected','timeout','cancelled','pending','no_evidence','unverified','multiple','busy'].includes(outcome)||outcome.endsWith('_rejected')||stage==='latest_lookup'&&outcome==='none'))trace.failure=event;
  publish();
 };
 const emit=(id,stage,outcome,details)=>{const trace=attempts.get(id);if(!trace||trace.closed)return;write(trace,stage,outcome,details);if(outcome==='timeout')trace.closed=true;};
 return Object.freeze({enabled:enabled===true,read,
  timeout(id,fallback){const trace=attempts.get(id);emit(id,trace?.events.at(-1)?.stage??fallback,'timeout');},
  begin(action){
   if(enabled!==true||!['startup','launch','refresh','purchase','restore'].includes(action)||sequence>=1000000)return null;
   if(attempts.size>=4){const disposable=[...attempts.values()].find(trace=>trace.closed&&trace.id!==lastUser);if(!disposable)return null;attempts.delete(disposable.id);}
   const id=++sequence;attempts.set(id,{id,action,start:now(),events:[],closed:false,presented:false,failure:null});last=id;
   if(action==='purchase'||action==='restore')lastUser=id;
   publish();return id;
  },emit,
  native(value){const trace=attempts.get(value?.attempt);if(trace&&value.action===trace.action)emit(trace.id,value.stage,value.outcome,{errorCode:value.errorCode});},
  finish(id,outcome){const trace=attempts.get(id);if(!trace||trace.closed)return;write(trace,'coordinator',outcome);trace.closed=true;},
  presentation(id,outcome){const trace=attempts.get(id);if(!trace||trace.presented||!['paywall','unlocked','runtime_failed'].includes(outcome)||trace.events.some(event=>event.outcome==='timeout'))return;trace.presented=true;write(trace,'presentation',outcome);},
  subscribe(listener){listeners.add(listener);try{listener(read());}catch{}return ()=>listeners.delete(listener);},
  dispose(){attempts.clear();listeners.clear();lastUser=null;last=null;}
 });
}

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
  const httpStatus=result?.error?.context?.status;
  const denied=message=>Object.assign(Error(message),Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599?{httpStatus}:{});
  if([401,403].includes(httpStatus))throw denied('authority_denied');
  if(result?.error||!result?.data||Object.keys(result.data).join(',')!=='proof'||typeof result.data.proof!=='string'||result.data.proof.length>8192)throw denied('verification_unavailable');
  return result.data.proof;
 }});
}
// Opt-in application composition. Importing this module starts no native/store/network work.
// Caller registers GridlyStoreKit through Capacitor's registerPlugin('GridlyStoreKit').
export function createAppleStoreKit({capacitor,plugin,authority,publicKey,deliverEntitlement,onNativeDenial,environment='production',crypto=globalThis.crypto,now=Date.now,timeoutMs=15000,purchaseTimeoutMs=120000,diagnostics=null}) {
 let state=failure('verification_unavailable'),tail=Promise.resolve(),stopped=false,started=false,startPromise,signalTask;
 const listeners=[];
 const ios=()=>capacitor?.isNativePlatform?.()===true&&capacitor?.getPlatform?.()==='ios'&&!!plugin;
 const allowed=surface=>accessDecision(state,{platform:ios()?'apple':null,environment:state.environment??environment,surface,now:now()});
 const read=()=>state;
 const queue=work=>{const next=tail.then(work,work);tail=next.catch(()=>{});return next;};
 async function bounded(work,budget=timeoutMs,onTimeout=()=>{}){let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout();reject(Error('unavailable'));},budget);})]);}finally{clearTimeout(timer);}}
 async function run(method,options={},attempt=null) {
  let stage='native_invocation';
  const mark=(next,outcome,details)=>{stage=next;diagnostics?.emit(attempt,next,outcome,details);};
  const timeout=()=>diagnostics?.timeout(attempt,stage);
  state=failure('verification_unavailable');
  if(stopped||!ios()){state=failure('platform_unavailable');return state;}
  if(!['production','sandbox/test','auto'].includes(environment)||!authority||!publicKey){return state;}
  let active=true,category='store_unavailable';
  try {
   state=await bounded(async()=>{
    mark('native_invocation','started');
    let native=await plugin[method](attempt?{...options,diagnosticAttempt:attempt}:options);
    if(active&&!stopped)mark('native_result',({verified:'verified',user_cancelled:'cancelled',purchase_pending:'pending',no_evidence:'no_evidence'})[native?.result]??'failed');
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
    mark('authority','started');
    try {proof=await bounded(()=>authority.reconcile(request),timeoutMs,timeout);if(active&&!stopped)mark('authority','returned');}finally{request=null;}
    if(!active||stopped)return failure();
    mark('proof','started');
    const verified=await verifyAuthorityProof({proof,publicKey,nonce,platform:'apple',environment:storeEnvironment,now:now(),crypto});
    if(!active||stopped)return failure('invalid_authority');
    mark('proof',verified.entitlementState==='unknown'?'rejected':verified.entitlementState==='entitled'?'entitled':'not_entitled');
    if(verified.entitlementState==='unknown')return failure(verified.errorCategory==='invalid_authority'?'invalid_authority':'verification_unavailable');
    if(verified.entitlementState==='not_entitled')return verified;
    // Apple finish means delivery completed, not just receipt validation.
    // No delivery port exists in current runtime: production finishing stays blocked.
    mark('delivery','started');
    if(!deliverEntitlement||await deliverEntitlement(verified,{isCurrent:()=>active&&!stopped,proof})!==true){mark('delivery','failed');return failure('verification_unavailable');}
    mark('delivery','accepted');
    if(!active||stopped)return failure();
    // Finish only this native verified transaction, never all unfinished purchases.
    category='store_unavailable';
    mark('finish','started');
    const completion=await plugin.finishTransaction({completionHandle:handle});
    if(!active||stopped||completion?.finished!==true){mark('finish','failed');return failure('store_unavailable');}
    mark('finish','success');
    return verified;
   },['purchase','restorePurchases'].includes(method)?purchaseTimeoutMs:timeoutMs,timeout);
  } catch {mark(stage,'failed');state=failure(category);}
  finally{active=false;}
  return state;
 }
 const refresh=attempt=>queue(()=>run('refreshEntitlement',{},attempt));
 const signal=()=>{if(!signalTask){signalTask=refresh().finally(()=>{signalTask=null;});}return signalTask;};
 async function lookupProduct(){
  const attempt=diagnostics?.begin('startup');
  if(!ios()||stopped)return error('platform_unavailable');
  try {const item=await bounded(()=>attempt?plugin.getProducts({diagnosticAttempt:attempt}):plugin.getProducts());
   if(item?.result!=='available'||item.productId!==APPLE_PRODUCT_ID||typeof item.displayPrice!=='string'||!item.displayPrice||item.displayPrice.length>64||typeof item.displayName!=='string'||item.displayName.length>128||item.currency!=='USD'||item.billingPeriod!=='P1M'||item.storefront!=='US'||item.hasOffer!==false)return error('product_unavailable');
   return Object.freeze({available:true,productId:item.productId,displayName:item.displayName,displayPrice:item.displayPrice,currency:item.currency,billingPeriod:item.billingPeriod});
  }catch{return error('store_unavailable');}
  finally{diagnostics?.finish(attempt,'returned');}
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
 return Object.freeze({read,allowed,lookupProduct,start,stop,launch:attempt=>queue(()=>run('getCurrentEntitlement',{},attempt)),resume:signal,refresh,
  purchase:attempt=>queue(()=>run('purchase',{},attempt)),restore:attempt=>queue(()=>run('restorePurchases',{userInitiated:true},attempt))});
}
