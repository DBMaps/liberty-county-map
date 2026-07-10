const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const audit = fs.readFileSync('js/gridlyEndToEndPerformanceAudit.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V920-MAIN-THREAD-PERFORMANCE-REPAIR.md', 'utf8');

[
  'gridlyMainThreadAttributionAudit',
  'gridlyListenerLifecycleAudit',
  'gridlyPerformanceInstrumentationOverheadAudit'
].forEach((name) => assert(audit.includes(`globalScope.${name}`), `${name} is exposed`));

[
  'functionName', 'category', 'callCount', 'totalDuration', 'averageDuration', 'medianDuration',
  'p95Duration', 'maxDuration', 'largestItemCount', 'latestItemCount', 'triggeredBy',
  'layerClearDetected', 'layerRebuildDetected', 'domReplacementDetected',
  'listenerWiringDetected', 'layoutReadAfterWriteDetected'
].forEach((field) => assert(audit.includes(field), `attribution record includes ${field}`));

assert(app.includes('panelShellVisibleBeforeHeavyContent'), 'panel shell visibility is tracked before heavy content');
assert(app.includes('panelOpenSkippedMapMarkerRendering'), 'panel open avoids unrelated marker rendering');
assert(app.includes('alertRenderFilteredCollectionBuiltOnce'), 'alert rendering tracks one filtered collection');
assert(app.includes('dataset.gridlyV920AlertSignature'), 'alert DOM replacement is skipped when signature is unchanged');
assert(app.includes('alertFocusBound'), 'alert delegated listener guard is preserved');
assert(app.includes('crossingIconCache'), 'crossing marker icon reuse cache exists');
assert(app.includes('crossingNormalizationCache'), 'crossing normalization cache exists');
assert(app.includes('crossingPopupContentCache'), 'crossing popup content cache exists');
assert(app.includes('v920-unchanged-marker-signature'), 'unchanged crossing marker layer rebuild is skipped');
assert(app.includes('crossingLayer.clearLayers'), 'crossing layer clearing remains explicit and auditable');
assert(app.includes('__gridlyV920MapMoveFrame'), 'map terminal move/zoom work is coalesced');
assert(app.includes('staleChunkedRenderWorkCannotOverwriteCurrentState'), 'stale render generation protection is audited');
assert(audit.includes('instrumentationOverheadAcceptable'), 'lightweight instrumentation overhead audit reports acceptability');
assert(audit.includes('repeatedRegistrationAttempts'), 'listener lifecycle proves repeated registration attempts');
assert(doc.includes('Original V919 evidence'), 'V920 doc includes original evidence');
assert(doc.includes('Clear merge recommendation'), 'V920 doc includes merge recommendation');
assert(doc.includes('window.gridlyRunPerformanceSimulation?.({'), 'V920 doc includes browser simulation command');

console.log('v920-main-thread-performance-repair.test.js passed');
