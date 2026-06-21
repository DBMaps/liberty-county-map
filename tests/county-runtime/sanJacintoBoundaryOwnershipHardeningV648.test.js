const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');
const boundary = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'utf8'));
const evidence = JSON.parse(fs.readFileSync('assets/county-implementation/san-jacinto/validation/san-jacinto-boundary-ownership-hardening-v648.json', 'utf8'));

const feature = boundary.features[0];
assert.strictEqual(boundary.gridlySource.countyId, 'san-jacinto-tx', 'boundary gridly source is San Jacinto-owned');
assert.strictEqual(feature.properties.geoid, '48407', 'boundary GEOID is San Jacinto County');
assert.strictEqual(feature.properties.countyId, 'san-jacinto-tx', 'boundary countyId matches San Jacinto');
assert.strictEqual(evidence.boundaryProvenanceReview.geoidAlignment.result, 'PASS', 'GEOID evidence passes');
assert.strictEqual(evidence.boundaryCorrectnessDetermination.result, 'FAIL_NOT_PRODUCTION_READY', 'boundary credibility remains blocked without authoritative provenance');
assert.strictEqual(evidence.ownershipAuditResults.operational, false, 'San Jacinto remains non-operational');
assert.strictEqual(evidence.ownershipAuditResults.selectable, false, 'San Jacinto remains non-selectable');
assert.deepStrictEqual(evidence.visibilityPipelineFindings.pipeline, ['submit', 'ownership', 'storage', 'filtering', 'alert', 'marker', 'awareness'], 'visibility pipeline is documented');

assert.ok(source.includes('function gridlySanJacintoReportSubmissionAudit()'), 'San Jacinto audit helper is dedicated');
assert.ok(!source.includes('window.gridlySanJacintoReportSubmissionAudit = gridlyMontgomeryReportSubmissionAudit;'), 'San Jacinto audit is not aliased to Montgomery audit');
['activeCounty', 'reportSubmitCounty', 'reportRegistrationStatus', 'lastReportAccepted', 'lastReportVisible', 'markerVisible', 'alertVisible', 'awarenessVisible'].forEach((field) => {
  assert.ok(source.includes(field), `${field} is exposed in report submission audit`);
});
assert.ok(source.includes('visibilityPipeline: {'), 'San Jacinto audit reports visibility pipeline transitions');
assert.ok(source.includes('inFilteredActiveCountySet'), 'San Jacinto audit traces active-county filtering');

console.log('sanJacintoBoundaryOwnershipHardeningV648.test.js passed');
