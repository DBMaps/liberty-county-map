// No protected module is executed if imports or production composition fail.
(async function() {
  try {const {bootPaidAccess}=await import('./gridly-paid-ui.mjs');await bootPaidAccess();}
  catch {document.documentElement.classList.remove('gridly-prepaint-lock','gridly-paid-pending');
    document.getElementById('gridlyPaidAccess').hidden=false;
    document.getElementById('gridlyPaidStatus').textContent='Subscription verification is unavailable. Please contact Support or reopen Gridly.';}
})();
