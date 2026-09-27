import {accessDecision} from './gridly-entitlement.mjs';
import {createAppleStoreKit} from './gridly-apple-storekit.mjs';
import {createGooglePlayBilling} from './gridly-google-play-billing.mjs';

export function nativeStore(capacitor) {
  if (capacitor?.isNativePlatform?.() !== true) return null;
  return ({ios:'apple', android:'google'})[capacitor.getPlatform?.()] || null;
}

// Only trusted composition supplies ports. No persisted state or window unlock port.
export function createPaidAccess({capacitor, plugin, authority, publicKey, now=Date.now,
  crypto=globalThis.crypto, timeoutMs=15000, purchaseTimeoutMs=120000,
  schedule=setTimeout, cancel=clearTimeout}={}) {
  const platform=nativeStore(capacitor), subscribers=new Set(), handles=[];
  let snapshot=null, state='initializing', action=null, product=null, errorCategory='none';
  let session, tail=Promise.resolve(), signalTask, startTask, expiryTimer, stopped=false;
  const allowed=()=>!stopped && state==='entitled' && accessDecision(snapshot,{platform,now:now()}).allowed;
  const read=()=>Object.freeze({state, action, platform, product, errorCategory, allowed:allowed()});
  const publish=()=>{const value=read(); for(const fn of subscribers) {try {fn(value);} catch { /* UI must not change authority. */ }} return value;};
  const clear=()=>{cancel(expiryTimer); snapshot=null;};
  const classify=row=>row?.errorCategory==='purchase_pending' ? 'pending'
    : row?.errorCategory==='user_canceled' ? 'not_entitled'
    : row?.entitlementState==='not_entitled' ? 'not_entitled'
    : row?.errorCategory==='invalid_authority' ? 'unknown' : 'temporarily_unavailable';
  const queue=work=>{const next=tail.then(work,work);tail=next.catch(()=>{});return next;};
  async function bounded(work) {
    let timer;
    try {return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('unavailable')),timeoutMs);})]);}
    finally {clearTimeout(timer);}
  }
  const discard=handle=>{try {void Promise.resolve(handle.remove()).catch(()=>{});} catch {}};
  if(platform) {
    const create=platform==='apple' ? createAppleStoreKit : createGooglePlayBilling;
    session=create({capacitor,plugin,authority,publicKey,now,crypto,timeoutMs,purchaseTimeoutMs,
      environment:'production', deliverEntitlement:async(row,guard)=>{
        // Delivery into volatile authority state precedes Apple finish. UI admission
        // waits for the bridge operation to complete successfully below.
        if(stopped || !guard.isCurrent() || !accessDecision(row,{platform,now:now()}).allowed) return false;
        snapshot=row; return true;
      }});
  }
  async function run(method) {
    clear(); action=method; errorCategory='none';
    state=platform ? 'initializing' : 'unsupported_platform'; publish();
    if(stopped || !session) {action=null; return publish();}
    try {
      const row=await session[method]();
      if(stopped) return read();
      // Even a delivered proof cannot unlock if Apple finish subsequently failed.
      if(row===snapshot && accessDecision(snapshot,{platform,now:now()}).allowed) {
        state='entitled';
        expiryTimer=schedule(()=>{clear();state='unknown';errorCategory='verification_unavailable';publish();void refresh();},
          Math.max(1,Date.parse(row.expiresAt)-now()));
      } else {clear();state=classify(row);}
      errorCategory=['none','store_unavailable','verification_unavailable','invalid_authority','purchase_pending','user_canceled','platform_unavailable','network_unavailable'].includes(row?.errorCategory)
        ? row.errorCategory : 'verification_unavailable';
    } catch {clear();state='temporarily_unavailable';errorCategory='verification_unavailable';}
    action=null; return publish();
  }
  // One owner of lifecycle listeners; do not call the adapters' start() methods.
  const refresh=()=>{
    if(!signalTask) signalTask=queue(()=>run('refresh')).finally(()=>{signalTask=null;});
    return signalTask;
  };
  function start() {
    if(startTask) return startTask;
    startTask=queue(async()=>{
      if(stopped) return read();
      if(!session || !plugin) {state=platform?'temporarily_unavailable':'unsupported_platform';return publish();}
      let active=true;
      try {
        await bounded(async()=>{
          for(const event of [platform==='apple'?'transactionUpdate':'purchaseUpdate','appForeground']) {
            const handle=await plugin.addListener(event,()=>{if(!stopped) void refresh();});
            if(!active||stopped) {discard(handle);throw Error('unavailable');}
            handles.push(handle);
          }
          await plugin.startObserving();
          if(!active||stopped) {try {void Promise.resolve(plugin.stopObserving()).catch(()=>{});} catch {} throw Error('unavailable');}
        });
        product=await session.lookupProduct();
      } catch {
        for(const handle of handles.splice(0)) discard(handle);
        try {void Promise.resolve(plugin.stopObserving()).catch(()=>{});} catch {}
        clear();state=stopped?'unknown':'temporarily_unavailable';errorCategory='store_unavailable';return publish();
      } finally {active=false;}
      return run('launch');
    }); return startTask;
  }
  async function stop() {
    stopped=true;clear();state='unknown';action=null;publish();
    for(const handle of handles.splice(0)) discard(handle);
    try {await bounded(()=>session?.stop());} catch {}
    subscribers.clear();
  }
  return Object.freeze({read,allowed,start,refresh,resume:refresh,
    initializeRuntime:work=>queue(async()=>{if(!allowed()) throw Error('verification_required');await work(allowed);if(!allowed()) throw Error('verification_required');}),
    purchase:()=>queue(()=>run('purchase')),restore:()=>queue(()=>run('restore')),
    subscribe(fn){subscribers.add(fn);fn(read());return ()=>subscribers.delete(fn);},stop});
}
