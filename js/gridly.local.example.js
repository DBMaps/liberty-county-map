// Copy this file to js/gridly.local.js for local development only.
// js/gridly.local.js is gitignored; never commit real API keys.
window.GRIDLY_TXDOT_API_KEY = "YOUR_TXDOT_API_KEY_HERE";
window.GRIDLY_CONFIG = window.GRIDLY_CONFIG || {};
window.GRIDLY_CONFIG.txdot = window.GRIDLY_CONFIG.txdot || {};
window.GRIDLY_CONFIG.txdot.apiKey = window.GRIDLY_TXDOT_API_KEY || "";

// Optional LP243.I2.1S2 public-application credential. Keep the tracked example
// blank; place the real referrer-restricted value only in js/gridly.local.js.
window.GRIDLY_RUNTIME_CONFIG = Object.freeze({
  ...(window.GRIDLY_RUNTIME_CONFIG || {}),
  arcgisStaticBasemapApiKey: ""
});
