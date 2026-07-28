const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync('js/lp097-curated-destinations.js', 'utf8'), sandbox);
const liberty = sandbox.window.GRIDLY_LP097_CURATED_DESTINATIONS.slice();
vm.runInNewContext(fs.readFileSync('js/lp098-curated-destinations.js', 'utf8'), sandbox);
const records = sandbox.window.GRIDLY_LP098_CURATED_DESTINATIONS;
const audit = sandbox.window.gridlyLp098DestinationCoverageAudit();

assert.equal(records.length, 153, 'inventory count is derived from 18 Liberty plus 27 counties × 5');
assert.deepEqual(records.slice(0, liberty.length).map(r => JSON.stringify(r)), liberty.map(r => JSON.stringify(r)), 'Liberty reference records remain unchanged');
assert.equal(audit.supportedCountyCount, 28);
assert.equal(audit.certifiedCountyCount, 28);
assert.equal(audit.duplicateDestinationCount, 0);
assert.equal(audit.duplicateCoordinateCount, 0);
assert.equal(audit.invalidCoordinateCount, 0);
assert.equal(audit.missingCategoryCount, 0);
assert.equal(audit.missingCountyAssignmentCount, 0);
assert.equal(audit.aliasIntegrityPass, true);
assert.equal(audit.safeToMerge, true);
assert.ok(audit.countyCertification.every(county => county.certified && county.totalCuratedDestinations > 0));
for (const record of records) {
  for (const field of ['id', 'name', 'category', 'communityId', 'countyId', 'state', 'latitude', 'longitude', 'coordinateVerification', 'sourceAuthority', 'verifiedAt', 'active']) assert.notEqual(record[field], undefined, `${record.id}: ${field}`);
  assert.match(record.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(Object.isFrozen(record));
}
const html = fs.readFileSync('index.html', 'utf8');
assert.ok(html.indexOf('lp097-curated-destinations.js') < html.indexOf('lp098-curated-destinations.js'));
assert.match(fs.readFileSync('js/app.js', 'utf8'), /county: record\.county \|\| record\.countyId/);
console.log(`LP098 coverage passed: ${audit.totalCuratedDestinations} destinations across ${audit.certifiedCountyCount} counties.`);
