const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/lp101-search-quality.js', 'utf8');

const window = {
  document: { getElementById: () => null, querySelectorAll: () => [] },
  console: { table() {}, log() {} },
  setTimeout
};
vm.runInNewContext(source, { window, Object, Set, RegExp, String, Number, Array, Boolean, Date, Promise });

const missing = window.gridlyLp101AddressStatusDiagnostic();
assert.equal(missing.statusClassification, 'not_captured', 'post-reset empty DOM is not authoritative absent');
assert.equal(missing.diagnosticValid, false);
assert.equal(missing.capturePhase, 'not_captured');
assert.equal(missing.capturedBeforeCaseReset, false);

assert.match(source, /latestAddressStatusCapture = Object\.freeze\(\{ runId: certificationRunId, evidence: statusEvidence \}\);/,
  'active address evidence is retained for this certification run');
assert.ok(source.indexOf('latestAddressStatusCapture = Object.freeze') < source.indexOf('if (clear && typeof clear.click'),
  'capture occurs before case reset');
assert.match(source, /const certificationRunId = \+\+visibleCertificationRunId;\s*latestAddressStatusCapture = null;/,
  'a new certification invalidates an older run capture');
assert.doesNotMatch(JSON.stringify(missing), /statusText|rawAddress|query|coordinates|providerPayload|credentials|providerIdentity/,
  'fail-closed diagnostic is privacy safe');

console.log('LP101.5B active address status capture contracts passed.');
