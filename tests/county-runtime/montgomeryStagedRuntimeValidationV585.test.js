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
assert.strictEqual(api.GRIDLY_MONTGOMERY_RUNTIME_GATE, true, 'Montgomery runtime gate is enabled');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].runtimeGateEnabled, true, 'Montgomery registry gate is enabled');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].operational, true, 'Montgomery is operational');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].productionEnabled, true, 'Montgomery is production enabled');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].selectable, true, 'Montgomery is selectable');
assert.strictEqual(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].productionActivationBlocked, false, 'Montgomery production activation block is removed');
assert.ok(api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].boundaryPath.startsWith('assets/county-implementation/montgomery/'), 'Montgomery assets remain package-scoped');
assert.ok(!api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].boundaryPath.startsWith('data/'), 'Montgomery assets are not placed in data/');

assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('montgomery-tx'))), {
  known: true,
  countyId: 'montgomery-tx',
  operational: true,
  stage: 'operational',
  productionEnabled: true,
  selectable: true
}, 'Montgomery runtime status is operational');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('unknown-tx'))), {
  known: false,
  operational: false,
  stage: 'unknown',
  productionEnabled: false,
  selectable: false
}, 'unknown county status fails closed');

assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery can become active through normalization');
assert.strictEqual(api.gridlyNormalizeCountyId('unknown-tx'), 'liberty-tx', 'unknown county falls back to Liberty default instead of activation');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' }).gridlyGetActiveCountyId(), 'montgomery-tx', 'Montgomery can become active through window override');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'unknown-tx' }).gridlyGetActiveCountyId(), 'liberty-tx', 'unknown override cannot become active county');

assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'liberty-tx'), true, 'Liberty reports remain visible in Liberty context');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'liberty-tx'), false, 'Montgomery reports cannot leak into Liberty context');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'unknown-tx' }, 'liberty-tx'), false, 'unknown county reports are blocked');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty containment allows Liberty rows');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'liberty-tx').allowed, false, 'containment blocks Montgomery rows in Liberty context');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'liberty-tx').allowed, false, 'containment blocks unknown county rows');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery self-containment is allowed');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('montgomery-tx').county_id, 'montgomery-tx', 'report metadata is Montgomery-scoped when Montgomery is requested');

console.log('montgomeryStagedRuntimeValidationV585.test.js passed');
