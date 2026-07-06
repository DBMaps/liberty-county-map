const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const docSource = fs.readFileSync('docs/audits/GRIDLY-V894A-BETA-INTERACTION-LATENCY-AUDIT.md', 'utf8');

assert(appSource.includes('function gridlyBetaInteractionLatencyAudit()'), 'V894A browser-console audit helper exists');
assert(appSource.includes('window.gridlyBetaInteractionLatencyAudit = gridlyBetaInteractionLatencyAudit;'), 'V894A audit helper is exposed on window');
assert(appSource.includes('exposeGridlyAuditHelper("gridlyBetaInteractionLatencyAudit", gridlyBetaInteractionLatencyAudit);'), 'V894A audit helper is registered');
assert(appSource.includes('productBehaviorChanged: false'), 'V894A helper confirms product behavior is unchanged');
assert(appSource.includes('protectedSystemsUnchanged: true'), 'V894A helper confirms protected systems are unchanged');
assert(appSource.includes('panelsWaitOnDataBeforeOpening: false'), 'V894A helper reports panel open data-wait assessment');
assert(appSource.includes('localOptimisticUiPossible: true'), 'V894A helper reports optimistic UI assessment');
assert(appSource.includes('startupBlocking'), 'V894A helper classifies startup blocking delays');
assert(appSource.includes('panelOpenBlocking'), 'V894A helper classifies panel open blocking delays');
assert(appSource.includes('postSubmitRefreshBlocking'), 'V894A helper classifies post-submit refresh blocking delays');
assert(appSource.includes('postClearRefreshBlocking'), 'V894A helper classifies post-clear refresh blocking delays');
assert(appSource.includes('propagationRerenderDelay'), 'V894A helper classifies propagation/re-render delays');

assert(docSource.includes('window.gridlyBetaInteractionLatencyAudit?.()'), 'V894A doc names the console helper');
assert(docSource.includes('No product behavior was changed'), 'V894A doc confirms audit-only behavior');
assert(docSource.includes('Smallest safe follow-up patch recommendation'), 'V894A doc recommends smallest safe patch');
assert(docSource.includes('Post-clear refresh blocking'), 'V894A doc classifies post-clear delays');

console.log('v894a-beta-interaction-latency-audit.test.js passed');
