import {createPaidAccess,nativeStore} from './gridly-paid-access.mjs';
import {createPaidOnboarding,onboardingComplete} from './gridly-paid-onboarding.mjs';
import {productionPaidComposition} from './gridly-paid-config.mjs';
import {loadPaidRuntime} from './gridly-paid-startup.mjs';

// Native staging changes this exact constant only for the signed V5 license-test AAB.
const GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE = false;

const copy={initializing:'Checking your subscription…',entitled:'Subscription active.',
  not_entitled:'Subscribe or restore your store purchase to use Gridly.',
  pending:'Your purchase is pending. Check again after the store completes it.',
  unknown:'Your subscription could not be verified. Retry or restore your purchase.',
  temporarily_unavailable:'Verification is temporarily unavailable. Retry or restore your purchase.',
  unsupported_platform:'The Gridly app is available through supported Apple App Store and Google Play builds.'};

export async function bootPaidAccess() {
  const root=document.documentElement, gate=document.getElementById('gridlyPaidAccess');
  const pending=document.getElementById('gridlyPaidPending');
  const status=document.getElementById('gridlyPaidStatus'), purchase=document.getElementById('gridlyPaidPurchase');
  const restore=document.getElementById('gridlyPaidRestore'), retry=document.getElementById('gridlyPaidRetry');
  const settingsRestore=document.getElementById('gridlySettingsRestore');
  const coordinator=createPaidAccess(await productionPaidComposition(window.Capacitor,{googleLicenseTest:GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE}));
  // The short-lived signed proof stays in this page's memory. Reporting obtains
  // a fresh proof through paid access; neither native evidence nor receipts leak.
  Object.defineProperty(window,'gridlyPaidReporting',{configurable:true,value:Object.freeze({getProof:()=>coordinator.getReportingProof()})});
  let loading=false, started=false, wasVisible=false, loadFailed=false, closing=false;
  let tourComplete=onboardingComplete(), onboarding;
  const legal=document.createElement('details');legal.id='gridlyPaidLegalAccess';legal.hidden=true;
  const summary=document.createElement('summary');summary.textContent='Help & legal';legal.append(summary,gate.querySelector('nav').cloneNode(true));
  document.body.append(legal);
  const previousInert=new Map();
  const lock=(checking=false)=>{
    root.classList.add('gridly-paid-locked');root.classList.toggle('gridly-paid-pending',checking);gate.hidden=checking;
    for(const child of document.body.children) if(child!==gate&&child!==pending&&child!==legal&&child.tagName!=='SCRIPT') {
      if(!previousInert.has(child)) previousInert.set(child,child.inert);
      child.inert=true;
    }
  };
  const unlock=()=>{
    root.classList.remove('gridly-paid-locked','gridly-paid-pending');gate.hidden=true;
    // Admission has not set hidden attributes or changed accepted overlay markup.
    for(const [child,inert] of previousInert) child.inert=inert;
    previousInert.clear();
    wasVisible=true;
  };
  lock(true);root.classList.remove('gridly-prepaint-lock');
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
      lock(value.state==='initializing');
      // Destroy protected timers/feeds after failed re-verification. Fresh launch
      // revalidates signed native continuity or obtains fresh authority; no query unlock.
      if(wasVisible && value.state!=='initializing') {window.location.reload();return;}
    }
    status.textContent=value.temporaryAccess?'Subscription verified previously. Temporary access; reconnect to refresh.':value.errorCategory==='user_canceled'?'Purchase canceled. You can retry or restore.'
      :value.product?.errorCategory==='product_unavailable'?`Subscription product is unavailable from ${value.platform==='google'?'Google Play':'the App Store'}. Retry later.`
      :value.product?.errorCategory==='store_unavailable'?value.platform==='google'?'Google Play is unavailable. Retry later.':'The App Store is unavailable. Retry later.'
      :value.action==='purchase'?'Completing your store purchase…'
      :value.action==='restore'?'Checking your store purchase…':copy[value.state];
    const native=!!value.platform,busy=value.state==='initializing'||!!value.action;
    purchase.hidden=restore.hidden=retry.hidden=!native;
    if(settingsRestore){settingsRestore.hidden=!native;settingsRestore.disabled=busy;}
    for(const button of document.querySelectorAll('#gridlyPortraitV2SheetBody [data-gridly-settings-restore]'))button.disabled=busy;
    document.getElementById('gridlyPaidOffer').hidden=!native;
    purchase.disabled=busy||value.product?.available!==true||value.verificationReady!==true;
    restore.disabled=retry.disabled=busy;
    restore.textContent=value.platform==='google'?'Check Purchase / Restore':'Restore Purchases';
    document.getElementById('gridlyPaidPrice').textContent=value.product?.available?value.product.displayPrice+'/month':value.platform==='google'&&!value.productLoading?'Price unavailable':'Price loading…';
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
  const settingsRestoreClick=event=>{
    const button=event.target?.closest?.('[data-gridly-settings-restore]');
    if(!button||button.disabled)return;
    button.disabled=true;void coordinator.restore().finally(()=>{if(button.isConnected)button.disabled=false;});
  };
  document.addEventListener('click',settingsRestoreClick);
  retry.addEventListener('click',()=>{if(loadFailed) window.location.reload();else void coordinator.refresh();});
  const connectivity=()=>{if(!closing)void coordinator.refresh();};
  window.addEventListener('online',connectivity);
  window.addEventListener('pagehide',()=>{closing=true;delete window.gridlyPaidReporting;window.removeEventListener('online',connectivity);document.removeEventListener('click',settingsRestoreClick);onboarding?.dispose();lock();void coordinator.stop();},{once:true});
  window.addEventListener('pageshow',event=>{if(event.persisted) window.location.reload();});
  await coordinator.start();
}
