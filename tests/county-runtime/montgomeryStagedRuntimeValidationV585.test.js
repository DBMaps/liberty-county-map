const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

function loadRuntime(windowOverrides = {}) {
  const sandbox = { Object, String, Boolean, window: windowOverrides };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, GRIDLY_MONTGOMERY_RUNTIME_GATE, gridlyNormalizeCountyId, gridlyIsKnownCountyId, gridlyIsCountyOperational, gridlyGetCountyRuntimeStatus, gridlyValidateCountyContainment, gridlyGetActiveCountyId, gridlyGetActiveCountyConfig, gridlyReportMatchesActiveCounty, gridlyGetCountyScopedReportMetadata };`, sandbox);
  return sandbox.api;
}

const api = loadRuntime();

assert.strictEqual(api.GRIDLY_DEFAULT_COUNTY_ID, 'liberty-tx', 'Liberty remains the default county');
assert.strictEqual(api.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty remains active by default');
assert.strictEqual(api.gridlyGetActiveCountyConfig().id, 'liberty-tx', 'Liberty config remains active by default');
assert.strictEqual(api.gridlyIsCountyOperational('liberty-tx'), true, 'Liberty remains operational');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['liberty-tx'].productionEnabled, true, 'Liberty remains production enabled');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['liberty-tx'].selectable, true, 'Liberty remains selectable');
assert.ok(api.GRIDLY_COUNTY_REGISTRY['liberty-tx'].boundaryPath.startsWith('data/'), 'Liberty assets remain Liberty runtime data assets');

assert.strictEqual(api.gridlyIsKnownCountyId('montgomery-tx'), true, 'Montgomery registry entry exists');
assert.strictEqual(api.GRIDLY_MONTGOMERY_RUNTIME_GATE, false, 'Montgomery runtime gate defaults false');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].runtimeGateEnabled, false, 'Montgomery registry gate is false');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].operational, false, 'Montgomery remains non-operational');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].productionEnabled, false, 'Montgomery remains production disabled');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].selectable, false, 'Montgomery remains non-selectable');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].productionActivationBlocked, true, 'Montgomery production activation remains blocked');
assert.ok(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].boundaryPath.startsWith('assets/county-implementation/montgomery/'), 'Montgomery assets remain package-scoped');
assert.ok(!api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].boundaryPath.startsWith('data/'), 'Montgomery assets are not placed in data/');

assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('montgomery-tx'))), {
  known: true,
  countyId: 'montgomery-tx',
  operational: false,
  stage: 'disabled-staged',
  productionEnabled: false,
  selectable: false
}, 'Montgomery runtime status remains disabled staged');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('unknown-tx'))), {
  known: false,
  operational: false,
  stage: 'unknown',
  productionEnabled: false,
  selectable: false
}, 'unknown county status fails closed');

assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'liberty-tx', 'Montgomery cannot become active through normalization');
assert.strictEqual(api.gridlyNormalizeCountyId('unknown-tx'), 'liberty-tx', 'unknown county falls back to Liberty default instead of activation');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' }).gridlyGetActiveCountyId(), 'liberty-tx', 'Montgomery cannot become active through window override while disabled');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'unknown-tx' }).gridlyGetActiveCountyId(), 'liberty-tx', 'unknown override cannot become active county');

assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'liberty-tx'), true, 'Liberty reports remain visible in Liberty context');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'liberty-tx'), false, 'Montgomery reports cannot leak into Liberty context');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'unknown-tx' }, 'liberty-tx'), false, 'unknown county reports are blocked');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty containment allows Liberty rows');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'liberty-tx').allowed, false, 'containment blocks Montgomery rows in Liberty context');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'liberty-tx').allowed, false, 'containment blocks unknown county rows');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, false, 'Montgomery cannot self-activate containment while staged disabled');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('montgomery-tx').county_id, 'liberty-tx', 'report metadata remains Liberty-scoped when Montgomery is requested while disabled');

console.log('montgomeryStagedRuntimeValidationV585.test.js passed');
