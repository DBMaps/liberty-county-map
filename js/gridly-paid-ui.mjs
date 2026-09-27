import {createPaidAccess,nativeStore} from './gridly-paid-access.mjs';
import {createPaidOnboarding,onboardingComplete} from './gridly-paid-onboarding.mjs';
import {productionPaidComposition} from './gridly-paid-config.mjs';
import {loadPaidRuntime} from './gridly-paid-startup.mjs';

const copy={initializing:'Checking your subscription…',entitled:'Subscription active.',
  not_entitled:'Subscribe or restore your store purchase to use Gridly.',
  pending:'Your purchase is pending. Check again after the store completes it.',
  unknown:'Your subscription could not be verified. Retry or restore your purchase.',
  temporarily_unavailable:'Verification is temporarily unavailable. Retry or restore your purchase.',
  unsupported_platform:'The Gridly app is available through supported Apple App Store and Google Play builds.'};

export async function bootPaidAccess() {
  const root=document.documentElement, gate=document.getElementById('gridlyPaidAccess');
  const status=document.getElementById('gridlyPaidStatus'), purchase=document.getElementById('gridlyPaidPurchase');
  const restore=document.getElementById('gridlyPaidRestore'), retry=document.getElementById('gridlyPaidRetry');
  const coordinator=createPaidAccess(productionPaidComposition(window.Capacitor));
  let loading=false, started=false, wasVisible=false, loadFailed=false, closing=false;
  let tourComplete=onboardingComplete(), onboarding;
  const legal=document.createElement('details');legal.id='gridlyPaidLegalAccess';legal.hidden=true;
  const summary=document.createElement('summary');summary.textContent='Help & legal';legal.append(summary,gate.querySelector('nav').cloneNode(true));
  document.body.append(legal);
  const previousInert=new Map();
  const lock=()=>{
    root.classList.add('gridly-paid-locked');gate.hidden=false;
    for(const child of document.body.children) if(child!==gate&&child!==legal&&child.tagName!=='SCRIPT') {
      if(!previousInert.has(child)) previousInert.set(child,child.inert);
      child.inert=true;
    }
  };
  const unlock=()=>{
    root.classList.remove('gridly-paid-locked');gate.hidden=true;
    // Admission has not set hidden attributes or changed accepted overlay markup.
    for(const [child,inert] of previousInert) child.inert=inert;
    previousInert.clear();
    wasVisible=true;
  };
  lock();root.classList.remove('gridly-prepaint-lock');
  if(nativeStore(window.Capacitor)) {
    if(!tourComplete) root.classList.add('gridly-paid-onboarding');
    legal.hidden=tourComplete;
    onboarding=await createPaidOnboarding({onComplete:()=>{
      tourComplete=true;root.classList.remove('gridly-paid-onboarding');
      legal.hidden=true;
      void render(coordinator.read());
    }});
    window.gridlyApplyPreAccessSetup=ports=>{onboarding.applyRuntimeSetup(ports);return {completed:tourComplete};};
    if(!tourComplete) onboarding.open();
  }
  const render=async value=>{
    if(closing) return;
    if(nativeStore(window.Capacitor) && !tourComplete) {
      lock();gate.hidden=true;
      const tour=document.getElementById('gridlyWelcomeOnboarding');tour.inert=false;
      return; // Even a valid store subscriber completes the first-install tour.
    }
    if(!value.allowed) {
      lock();
      // Destroy protected timers/feeds after failed re-verification. Fresh launch
      // revalidates signed native continuity or obtains fresh authority; no query unlock.
      if(wasVisible && value.state!=='initializing') {window.location.reload();return;}
    }
    status.textContent=value.temporaryAccess?'Subscription verified previously. Temporary access; reconnect to refresh.':value.errorCategory==='user_canceled'?'Purchase canceled. You can retry or restore.'
      :value.action==='purchase'?'Completing your store purchase…'
      :value.action==='restore'?'Checking your store purchase…':copy[value.state];
    const native=!!value.platform,busy=value.state==='initializing';
    purchase.hidden=restore.hidden=retry.hidden=!native;
    document.getElementById('gridlyPaidOffer').hidden=!native;
    purchase.disabled=busy||value.product?.available!==true;
    restore.disabled=retry.disabled=busy;
    restore.textContent=value.platform==='google'?'Check Purchase / Restore':'Restore Purchases';
    document.getElementById('gridlyPaidPrice').textContent=(value.product?.available?value.product.displayPrice:'$2.99')+'/month';
    document.getElementById('gridlyPaidBilling').textContent=value.platform==='google'?'Billed through Google Play.':value.platform==='apple'?'Billed through the Apple App Store.':'App-store subscription • U.S. launch';
    if(value.allowed && !loading && !started && !loadFailed) {
      loading=true;
      purchase.disabled=restore.disabled=retry.disabled=true;
      try {
        // Authorized initialization needs real layout geometry, underneath the
        // opaque admission sheet; never initialize Leaflet in display:none.
        await coordinator.initializeRuntime(async allowed=>{
          root.classList.remove('gridly-paid-locked');
          await loadPaidRuntime({document,window,allowed});
        });
        started=true;if(coordinator.allowed()) unlock();
      } catch {loadFailed=true;lock();status.textContent='Gridly could not start. Reopen the app or contact Support.';retry.disabled=false;retry.textContent='Reopen Gridly';}
      finally {loading=false;}
    } else if(value.allowed && started) unlock();
  };
  coordinator.subscribe(render);
  purchase.addEventListener('click',()=>{void coordinator.purchase();});
  restore.addEventListener('click',()=>{void coordinator.restore();});
  retry.addEventListener('click',()=>{if(loadFailed) window.location.reload();else void coordinator.refresh();});
  const connectivity=()=>{if(!closing)void coordinator.refresh();};
  window.addEventListener('online',connectivity);
  window.addEventListener('pagehide',()=>{closing=true;window.removeEventListener('online',connectivity);onboarding?.dispose();lock();void coordinator.stop();},{once:true});
  window.addEventListener('pageshow',event=>{if(event.persisted) window.location.reload();});
  await coordinator.start();
}
