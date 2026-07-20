const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/LP037.2-REGIONAL-CONSUMER-CROSSING-COUNT-REPAIR.md', 'utf8');

assert(app.includes('function gridlySelectConsumerVisibleCrossings'), 'shared consumer crossing selector is present');
assert(app.includes('gridlySelectConsumerVisibleCrossings.__gridlyConsumerCountOwner = "LP037.2 shared consumer crossing selector"'), 'selector owner is declared');
assert(app.includes('function getGridlyHomeTownCrossings(homeTownAnchor = getGridlyHomeTownAwarenessAnchor()) {\n  return gridlySelectConsumerVisibleCrossings(homeTownAnchor);\n}'), 'legacy awareness crossing accessor delegates to selector');
assert(app.includes('safeText("crossingCount", gridlySelectConsumerVisibleCrossings(getGridlySelectedAwarenessArea()).length);'), 'crossing count copy uses selector');
assert(app.includes('const selectorCount = gridlySelectConsumerVisibleCrossings(summary.selectedAwarenessArea || getGridlySelectedAwarenessArea()).length;'), 'bottom panel crossing count uses selector');
assert(app.includes('window.gridlyLp0372ConsumerCrossingCountRepairAudit = gridlyLp0372ConsumerCrossingCountRepairAudit'), 'LP037.2 browser audit is exposed');
assert(app.includes('remainingDivergence: "none"'), 'audit reports no remaining divergence');
assert(app.includes('allConsumerSurfacesUseSelector: true'), 'audit reports shared surface ownership');
const selectorBlock = app.slice(app.indexOf('function gridlySelectConsumerVisibleCrossings'), app.indexOf('gridlySelectConsumerVisibleCrossings.__gridlyConsumerCountOwner'));
assert(!/spring branch/i.test(selectorBlock), 'shared selector has no Spring Branch branch');

assert(doc.includes('gridlySelectConsumerVisibleCrossings()'), 'documentation names the shared selector');
assert(doc.includes('No Spring Branch-specific logic was added'), 'documentation covers Spring Branch verification');
assert(doc.includes('Future consumer crossing count surfaces must call `gridlySelectConsumerVisibleCrossings()`'), 'documentation covers future maintenance');

console.log('LP037.2 consumer crossing count repair checks passed');
