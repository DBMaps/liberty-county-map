const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');

const travelStart = source.indexOf('function gridlyTravelBriefCleanLine');
const travelEnd = source.indexOf('function gridlyBuildTravelBriefModel', travelStart);
assert(travelStart > 0 && travelEnd > travelStart, 'Travel Brief presentation helpers are present');

const travelSandbox = {
  gridlyEvidenceExperienceSafeText: (value) => String(value || '').trim(),
  gridlyStoryTransportationImpact: (record) => record.impact || null
};
vm.createContext(travelSandbox);
vm.runInContext(source.slice(travelStart, travelEnd), travelSandbox);

const roadwayLines = travelSandbox.gridlyTravelBriefDriveTexasLines([
  { title: 'Construction on US 59', routeName: 'US 59', impact: { detail: 'Construction may affect travel.' } },
  { title: 'Lane closure on US 59', routeName: 'US 59', impact: { detail: 'Lane closure may affect travel.' } },
  { title: 'Road closed on SH 146', routeName: 'SH 146', impact: { detail: 'Road closure may affect travel.' } }
]);
assert.strictEqual(roadwayLines[0], 'Construction and lane closure on US 59', 'Travel Brief consolidates duplicate roadway references without changing first roadway priority');
assert.strictEqual(roadwayLines[1], 'Road closed on SH 146', 'Travel Brief keeps next priority roadway after consolidated group');
assert.strictEqual(roadwayLines.filter((line) => /US 59/.test(line)).length, 1, 'Travel Brief suppresses duplicate US 59 roadway lines');

const crossingStart = source.indexOf('function gridlyConsumerCrossingClassificationLabel');
const crossingEnd = source.indexOf('function getGridlyCrossingPopupReportCount', crossingStart);
assert(crossingStart > 0 && crossingEnd > crossingStart, 'Crossing popup presentation helpers are present');

const crossingSandbox = {
  gridlyNowMs: () => 0,
  gridlyAddPopupAuditDuration: () => {},
  getGridlySpecificCrossingLocation: () => null,
  normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
  normalizeGridlyLightweightLocationLabelText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
  standardizeGridlyAlertHeadline: (value) => String(value || '').replace(/\b\w/g, (letter) => letter.toUpperCase())
};
vm.createContext(crossingSandbox);
vm.runInContext(source.slice(crossingStart, crossingEnd), crossingSandbox);

assert.strictEqual(crossingSandbox.gridlyConsumerCrossingClassificationLabel('PRIVATE'), 'Private Crossing', 'PRIVATE classification is converted to consumer language');
assert.strictEqual(crossingSandbox.gridlyConsumerCrossingClassificationLabel('PRIVATE_ROAD'), 'Private Crossing', 'PRIVATE_ROAD classification is converted to consumer language');
assert.strictEqual(crossingSandbox.resolveGridlyCrossingPopupLocationLabel({ crossingName: 'PRIVATE' }), 'Private Crossing', 'Crossing popup does not expose raw PRIVATE classification');
assert.strictEqual(crossingSandbox.gridlyConsumerCrossingClassificationLabel('PUBLIC_ROADWAY'), '', 'Non-meaningful internal crossing classification can be suppressed');

console.log('LP018 consumer language polish regression passed');
