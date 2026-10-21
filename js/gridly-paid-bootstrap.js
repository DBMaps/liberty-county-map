// No protected module is executed if imports or production composition fail.
(async function() {
  try {const {bootPaidAccess}=await import('./gridly-paid-ui.mjs');await bootPaidAccess();}
  catch {const root=document.documentElement;
    if(window.Capacitor?.isNativePlatform?.()===true&&window.Capacitor?.getPlatform?.()==='android') {
      root.classList.add('gridly-paid-locked');
      root.classList.remove('gridly-paid-onboarding','gridly-android-paid-onboarding');
      const tour=document.getElementById('gridlyWelcomeOnboarding');if(tour){tour.hidden=true;tour.inert=true;}
      const legal=document.getElementById('gridlyPaidLegalAccess');if(legal)legal.hidden=true;
      for(const id of ['gridlyPaidPurchase','gridlyPaidRestore']) {const button=document.getElementById(id);if(button)button.disabled=true;}
      const retry=document.getElementById('gridlyPaidRetry');
      if(retry){retry.hidden=false;retry.disabled=false;retry.textContent='Retry startup';retry.onclick=()=>window.location.reload();}
    }
    root.classList.remove('gridly-prepaint-lock','gridly-paid-pending');
    document.getElementById('gridlyPaidAccess').hidden=false;
    document.getElementById('gridlyPaidStatus').textContent='Subscription verification is unavailable. Please contact Support or reopen Gridly.';}
})();
