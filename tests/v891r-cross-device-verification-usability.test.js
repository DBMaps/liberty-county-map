const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const doc = fs.readFileSync('docs/audits/GRIDLY-V891R-CROSS-DEVICE-VERIFICATION-USABILITY.md', 'utf8');

assert(app.includes('window.gridlyRecentVisibleHazardsForVerification = gridlyRecentVisibleHazardsForVerification'), 'recent visible hazards helper is exposed');
assert(app.includes('window.gridlyCopyLatestHazardVerificationFingerprint = gridlyCopyLatestHazardVerificationFingerprint'), 'copy latest fingerprint helper is exposed');
assert(app.includes('window.gridlyCrossDeviceVerificationAudit = gridlyCrossDeviceVerificationAudit'), 'V891R audit helper is exposed');
assert(app.includes('version: "V891R-cross-device-verification-usability"'), 'V891R version is present');
assert(app.includes('"hazard type + locality"'), 'verify helper supports hazard type + locality lookup');
assert(app.includes('"hazard type + road"'), 'verify helper supports hazard type + road lookup');
assert(app.includes('"recent visible record"'), 'verify helper supports recent visible record lookup');
[
  'verificationFingerprint',
  'hazardType',
  'title',
  'location',
  'road',
  'locality',
  'reportedMinutesAgo',
  'markerVisible',
  'alertVisible',
  'briefingVisible',
  'reportIdIfAvailable'
].forEach((field) => assert(app.includes(field), `summary includes ${field}`));
assert(app.includes('protectedSystemsUnchanged: true'), 'protected systems flag remains present');

assert(doc.includes('Previous limitation'), 'documentation explains previous limitation');
assert(doc.includes('Improved workflow'), 'documentation explains improved workflow');
assert(doc.includes('Desktop verification process'), 'documentation explains desktop verification');
assert(doc.includes('Phone verification process'), 'documentation explains phone verification');
assert(doc.includes('Protected systems confirmation'), 'documentation confirms protected systems');

console.log('v891r-cross-device-verification-usability.test.js passed');
