const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');
const sandbox = { Object, String, Boolean };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, gridlyNormalizeCountyId, gridlyIsKnownCountyId, gridlyIsCountyOperational, gridlyGetCountyRuntimeStatus, gridlyValidateCountyContainment, gridlyGetActiveCountyId, gridlyGetActiveCountyConfig, gridlyReportMatchesActiveCounty };`, sandbox);

const api = sandbox.api;
assert.strictEqual(api.GRIDLY_DEFAULT_COUNTY_ID, 'liberty-tx');
assert.strictEqual(api.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty remains the active default');
assert.strictEqual(api.gridlyGetActiveCountyConfig().id, 'liberty-tx', 'Liberty config remains active by default');
assert.strictEqual(api.gridlyIsKnownCountyId('montgomery-tx'), true, 'Montgomery is recognized by registry');
assert.strictEqual(api.gridlyIsCountyOperational('montgomery-tx'), true, 'Montgomery is operational');
assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery can become active through normalization');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('montgomery-tx'))), {
  known: true,
  countyId: 'montgomery-tx',
  operational: true,
  stage: 'operational',
  productionEnabled: true,
  selectable: true
});
assert.ok(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].boundaryPath.startsWith('assets/county-implementation/montgomery/'), 'Montgomery assets stay outside data/');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'liberty-tx'), true, 'Liberty reports remain visible in Liberty context');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'liberty-tx'), false, 'Montgomery reports are blocked from Liberty context');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'liberty-tx').allowed, false, 'containment blocks staged Montgomery in Liberty');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'containment allows Liberty in Liberty');

console.log('montgomeryRuntimeRegistryV584.test.js passed');
