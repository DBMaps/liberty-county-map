import {accessDecision} from './gridly-entitlement.mjs';
import {verifyContinuity,continuityDecision} from './gridly-continuity.mjs';
import {createAppleStoreKit} from './gridly-apple-storekit.mjs';
import {createGooglePlayBilling} from './gridly-google-play-billing.mjs';

export function nativeStore(capacitor) {
 if(capacitor?.isNativePlatform?.()!==true)return null;
 return ({ios:'apple',android:'google'})[capacitor.getPlatform?.()]||null;
}
// Trusted composition only. The native binding is anti-replay context, not ownership.
export function createPaidAccess({capacitor,plugin,authority,publicKey,continuityVault,now=Date.now,
 crypto=globalThis.crypto,timeoutMs=15000,purchaseTimeoutMs=120000,monotonic=()=>globalThis.performance.now(),
 schedule=setTimeout,cancel=clearTimeout}={}) {
 const platform=nativeStore(capacitor),subscribers=new Set(),handles=[];
 let snapshot=null,continuity=null,state='initializing',action=null,product=null,errorCategory='none';
 let session,tail=Promise.resolve(),signalTask,startTask,expiryTimer,stopped=false,context=null,denied=false;
 let clockAnchor=null, generation=0;
 const effectiveNow=()=>clockAnchor===null?now():Math.max(now(),clockAnchor.utc+Math.max(0,monotonic()-clockAnchor.tick));
 const continuityAllowed=()=>clockAnchor!==null&&now()>=clockAnchor.wall&&continuityDecision(continuity,{platform,now:effectiveNow()});
 const allowed=()=>!stopped&&state==='entitled'&&(accessDecision(snapshot,{platform,now:effectiveNow()}).allowed||continuityAllowed());
 const read=()=>Object.freeze({state,action,platform,product,errorCategory,allowed:allowed(),temporaryAccess:allowed()&&!accessDecision(snapshot,{platform,now:effectiveNow()}).allowed});
 const publish=()=>{const value=read();for(const fn of subscribers){try{fn(value);}catch{}}return value;};
 const clear=()=>{cancel(expiryTimer);snapshot=null;};
 const classify=row=>row?.errorCategory==='purchase_pending'?'pending':row?.errorCategory==='user_canceled'?'not_entitled':row?.entitlementState==='not_entitled'?'not_entitled':row?.errorCategory==='invalid_authority'?'unknown':'temporarily_unavailable';
 const queue=work=>{const next=tail.then(work,work);tail=next.catch(()=>{});return next;};
 async function bounded(work){let timer;try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('unavailable')),timeoutMs);})]);}finally{clearTimeout(timer);}}
 const discard=handle=>{try{void Promise.resolve(handle.remove()).catch(()=>{});}catch{}};
 async function revoke() {
  denied=true;continuity=null;clockAnchor=null;clear();
  state='not_entitled';errorCategory='none';publish();
  // beginVerification durably blocks the old record before any network request.
  // A failed revoke write leaves that pending barrier intact across restart.
  if(context&&continuityVault&&(await bounded(()=>continuityVault.revoke({attempt:context.attempt})))?.revoked!==true)throw Error('continuity_unavailable');
 }
 const boundAuthority=authority?{reconcile:async request=>{
  const operation=generation;
  try{return await authority.reconcile({...request,...(context?{continuityBinding:context.binding}:{})});}
  catch(error){if(error?.message==='authority_denied'&&operation===generation&&!stopped)await revoke();throw Error('verification_unavailable');}
 }}:null;
 if(platform) {
  session=(platform==='apple'?createAppleStoreKit:createGooglePlayBilling)({capacitor,plugin,authority:boundAuthority,publicKey,now,crypto,timeoutMs,purchaseTimeoutMs,environment:'production',
   onNativeDenial:revoke,deliverEntitlement:async(row,guard)=>{
    if(stopped||denied||!guard.isCurrent()||!accessDecision(row,{platform,now:now()}).allowed)return false;
    snapshot=row;return true;
   }});
 }
 async function begin() {
  context=null;
  if(!continuityVault||!publicKey||!authority)return;
  try {
   const value=await bounded(()=>continuityVault.beginVerification());
   if(!value||!/^[a-f0-9]{64}$/.test(value.binding)||typeof value.attempt!=='string'||!Number.isFinite(value.nowMs))throw Error();
   context=value;
   clockAnchor={utc:value.nowMs,wall:now(),tick:monotonic()};
   if(value.clockTrusted!==true){continuity=null;return;}
   continuity=await verifyContinuity({proof:value.proof,publicKey,binding:value.binding,platform,now:effectiveNow(),crypto});
  }catch{continuity=null;clockAnchor=null;}
 }
 function arm(fresh=false) {
  cancel(expiryTimer);
  const current=effectiveNow(),end=continuityAllowed()?Date.parse(continuity.continuityExpiresAt):snapshot?Date.parse(snapshot.expiresAt):current;
  const deadline=fresh&&snapshot?Math.min(end,Date.parse(snapshot.expiresAt)):Math.min(end,current+60000);
  expiryTimer=schedule(()=>{
   if(!accessDecision(snapshot,{platform,now:effectiveNow()}).allowed&&!continuityAllowed()){clear();state='unknown';errorCategory='verification_unavailable';publish();}
   void refresh();
  },Math.max(1,deadline-current));
 }
 async function run(method) {
  generation++;cancel(expiryTimer);const wasAllowed=allowed();snapshot=null;denied=false;
  action=method;errorCategory='none';state=platform?(wasAllowed&&continuityAllowed()?'entitled':'initializing'):'unsupported_platform';publish();
  if(stopped||!session){action=null;return publish();}
  await begin();
  if(wasAllowed){state=continuityAllowed()?'entitled':'initializing';publish();}
  try {
   const row=await session[method]();if(stopped)return read();
   if(!denied&&row===snapshot&&accessDecision(row,{platform,now:now()}).allowed) {
    // Only after bridge completion/Apple finish succeeds is durable authority saved.
    clockAnchor={utc:now(),wall:now(),tick:monotonic()};
    continuity=null;
    if(context) {
     const candidate=await verifyContinuity({proof:row.continuityAuthorization,publicKey,binding:context.binding,platform,now:effectiveNow(),crypto});
     if(candidate) {
      if((await bounded(()=>continuityVault.commit({attempt:context.attempt,proof:row.continuityAuthorization,verifiedAt:Date.parse(candidate.lastVerifiedAt)})))?.saved!==true)throw Error('continuity_unavailable');
      continuity=candidate;
     }else await bounded(()=>continuityVault.revoke({attempt:context.attempt}));
    }
    state='entitled';arm(true);
   }else if(row?.entitlementState==='not_entitled'||row?.errorCategory==='invalid_authority'||denied) {
    const explicitDenial=denied||row?.entitlementState==='not_entitled';if(!denied)await revoke();state=explicitDenial?'not_entitled':classify(row);
   }else {
    snapshot=null;
    const temporary=['store_unavailable','verification_unavailable','network_unavailable'].includes(row?.errorCategory);
    if(context&&temporary&&!denied){
     if((await bounded(()=>continuityVault.retain({attempt:context.attempt})))?.retained!==true)continuity=null;
    }else if(context)await revoke();
    if(temporary&&!denied&&continuityAllowed()){state='entitled';arm();}else {continuity=null;state=classify(row);}
   }
   errorCategory=['none','store_unavailable','verification_unavailable','invalid_authority','purchase_pending','user_canceled','platform_unavailable','network_unavailable'].includes(row?.errorCategory)?row.errorCategory:'verification_unavailable';
  }catch{
   // Never recover from an uncertain native persistence write or denial failure.
   clear();continuity=null;state='temporarily_unavailable';errorCategory='verification_unavailable';
  }
  action=null;return publish();
 }
 const refresh=()=>{if(!signalTask)signalTask=queue(()=>run('refresh')).finally(()=>{signalTask=null;});return signalTask;};
 function start() {
  if(startTask)return startTask;
  startTask=queue(async()=>{
   if(stopped)return read();
   if(!session||!plugin){state=platform?'temporarily_unavailable':'unsupported_platform';return publish();}
   let active=true;
   try {
    await bounded(async()=>{
     for(const event of [platform==='apple'?'transactionUpdate':'purchaseUpdate','appForeground']) {
      const handle=await plugin.addListener(event,()=>{if(!stopped)void refresh();});
      if(!active||stopped){discard(handle);throw Error();}handles.push(handle);
     }
     await plugin.startObserving();if(!active||stopped){try{void Promise.resolve(plugin.stopObserving()).catch(()=>{});}catch{}throw Error();}
    });
    product=await session.lookupProduct();
   }catch{
    for(const handle of handles.splice(0))discard(handle);
    try{void Promise.resolve(plugin.stopObserving()).catch(()=>{});}catch{}
    // Native/store observation failure is transient; still attempt the signed vault.
    if(!stopped){await begin();if(context)try{if((await bounded(()=>continuityVault.retain({attempt:context.attempt})))?.retained!==true)continuity=null;}catch{continuity=null;}}
    clear();state=stopped?'unknown':continuityAllowed()?'entitled':'temporarily_unavailable';errorCategory='store_unavailable';if(state==='entitled')arm();return publish();
   }finally{active=false;}
   return run('launch');
  });return startTask;
 }
 async function stop(){stopped=true;clear();continuity=null;state='unknown';action=null;publish();for(const handle of handles.splice(0))discard(handle);try{await bounded(()=>session?.stop());}catch{}subscribers.clear();}
 return Object.freeze({read,allowed,start,refresh,resume:refresh,
  initializeRuntime:work=>queue(async()=>{if(!allowed())throw Error('verification_required');await work(allowed);if(!allowed())throw Error('verification_required');}),
  purchase:()=>queue(()=>run('purchase')),restore:()=>queue(()=>run('restore')),
  subscribe(fn){subscribers.add(fn);fn(read());return ()=>subscribers.delete(fn);},stop});
}
