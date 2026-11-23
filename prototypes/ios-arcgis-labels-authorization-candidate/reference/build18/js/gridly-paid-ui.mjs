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
  let coordinator=createPaidAccess(await productionPaidComposition(window.Capacitor,{googleLicenseTest:GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE}));
  const googleEntry=nativeStore(window.Capacitor)==='google';
  if(googleEntry&&!GRIDLY_ANDROID_LICENSE_TEST_CANDIDATE) {
    const {withGoogleReviewAccess,productionGoogleReviewComposition}=await import('./gridly-google-review-access.mjs');
    const review=await productionGoogleReviewComposition(window.Capacitor);
    if(review)coordinator=withGoogleReviewAccess(coordinator,review);
  }
  let subscriptionOpen=false;
  let entryStatus, entryActions, entrySubscribe, entryRestore, entryRetry;
  if(googleEntry) {
    // Public presentation only. This entry never executes the protected runtime
    // or changes provider authority; subscription details require an action.
    pending.dataset.gridlyPaidEntry='google';
    pending.setAttribute('role','region');pending.setAttribute('aria-label','Gridly');
    pending.removeAttribute('aria-live');
    entryStatus=pending.querySelector('span');entryStatus.id='gridlyPaidEntryStatus';
    entryStatus.setAttribute('role','status');entryStatus.setAttribute('aria-live','polite');
    entryActions=document.createElement('div');entryActions.id='gridlyPaidEntryActions';entryActions.hidden=true;
    const note=document.createElement('p');note.textContent='A subscription is required to use Gridly.';
    entryActions.append(note);
    const button=(id,text)=>{const e=document.createElement('button');e.id=id;e.type='button';e.textContent=text;entryActions.append(e);return e;};
    entrySubscribe=button('gridlyPaidEntrySubscribe','View subscription');
    entryRestore=button('gridlyPaidEntryRestore','Check Purchase / Restore');
    entryRetry=button('gridlyPaidEntryRetry','Retry verification');
    entryActions.append(gate.querySelector('nav').cloneNode(true));pending.append(entryActions);
    const back=document.createElement('button');back.id='gridlyPaidEntryBack';back.type='button';back.textContent='Back';
    gate.querySelector('nav').before(back);
    entrySubscribe.addEventListener('click',()=>{
      if(entrySubscribe.disabled)return;
      subscriptionOpen=true;void render(coordinator.read());restore.focus();
    });
    back.addEventListener('click',()=>{
      subscriptionOpen=false;void render(coordinator.read());entrySubscribe.focus();
    });
    entryRestore.addEventListener('click',()=>{if(!entryRestore.disabled)void coordinator.restore();});
    if(typeof coordinator.enterReview==='function') {
      const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='App Review Access';details.append(summary);
      const note=document.createElement('p');note.textContent='For Google reviewers only. Reports entered during review are not published.';details.append(note);
      const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input'),submit=document.createElement('button'),message=document.createElement('p');
      input.type='password';input.id='gridlyGoogleReviewCode';input.autocomplete='off';input.maxLength=80;input.required=true;
      label.htmlFor=input.id;label.textContent='Reviewer access code';submit.type='submit';submit.textContent='Open review access';message.setAttribute('role','status');
      form.append(label,input,submit,message);details.append(form);entryActions.append(details);
      form.addEventListener('submit',async event=>{event.preventDefault();if(submit.disabled)return;submit.disabled=true;
        const code=input.value.trim();input.value='';message.textContent='Verifying review access…';
        const accepted=await coordinator.enterReview(code);message.textContent=accepted?'Review access verified.':'Review access could not be verified. Check the code and try again.';submit.disabled=false;});
    }
  }
  // The short-lived signed proof stays in this page's memory. Reporting obtains
  // a fresh proof through paid access; neither native evidence nor receipts leak.
  Object.defineProperty(window,'gridlyPaidReporting',{configurable:true,value:Object.freeze({getProof:()=>coordinator.getReportingProof(),isReviewActive:()=>coordinator.isReviewActive?.()===true,validateReviewOperation:(...args)=>coordinator.validateReviewOperation?.(...args)??Promise.resolve({status:'authorization_required'})})});
  let loading=false, started=false, wasVisible=false, loadFailed=false, closing=false;
  let tourComplete=onboardingComplete(), onboarding;
  const legal=document.createElement('details');legal.id='gridlyPaidLegalAccess';legal.hidden=true;
  const summary=document.createElement('summary');summary.textContent='Help & legal';legal.append(summary,gate.querySelector('nav').cloneNode(true));
  document.body.append(legal);
  const previousInert=new Map();
  const lock=(checking=false)=>{
    // The public Android entry must not cover the first-install tour. The tour
    // completes before render exposes subscription actions on that entry.
    const entry=googleEntry&&tourComplete&&!subscriptionOpen;
    root.classList.add('gridly-paid-locked');root.classList.toggle('gridly-paid-pending',checking||entry);gate.hidden=checking||entry;
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
    status.textContent=value.reviewAccess?'Google Play review access active.':value.temporaryAccess?'Subscription verified previously. Temporary access; reconnect to refresh.':value.errorCategory==='user_canceled'?'Purchase canceled. You can retry or restore.'
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
    if(googleEntry) {
      entryStatus.textContent=value.state==='initializing'?copy.initializing:status.textContent;
      entryActions.hidden=value.state==='initializing'||value.allowed;
      entrySubscribe.disabled=entryRestore.disabled=entryRetry.disabled=busy;
    }
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
      } catch {loadFailed=true;lock();status.textContent='Gridly could not start. Reopen the app or contact Support.';retry.disabled=false;retry.textContent='Reopen Gridly';
        if(googleEntry){entryStatus.textContent=status.textContent;entryActions.hidden=false;entryRetry.disabled=false;entryRetry.textContent=retry.textContent;}}
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
  const retryVerification=()=>{if(loadFailed) window.location.reload();else void coordinator.refresh();};
  retry.addEventListener('click',retryVerification);
  entryRetry?.addEventListener('click',()=>{if(!entryRetry.disabled)retryVerification();});
  const connectivity=()=>{if(!closing)void coordinator.refresh();};
  window.addEventListener('online',connectivity);
  window.addEventListener('pagehide',()=>{closing=true;delete window.gridlyPaidReporting;window.removeEventListener('online',connectivity);document.removeEventListener('click',settingsRestoreClick);onboarding?.dispose();lock();void coordinator.stop();},{once:true});
  window.addEventListener('pageshow',event=>{if(event.persisted) window.location.reload();});
  await coordinator.start();
}
