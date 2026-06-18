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
const montgomery = api.GRIDLY_COUNTY_REGISTRY['montgomery-tx'];
const liberty = api.GRIDLY_COUNTY_REGISTRY['liberty-tx'];

assert.ok(montgomery, 'Montgomery registry entry exists');
assert.strictEqual(api.gridlyIsKnownCountyId('montgomery-tx'), true, 'Montgomery is recognized by runtime');
assert.strictEqual(api.gridlyIsCountyOperational('montgomery-tx'), false, 'Montgomery remains non-operational');
assert.strictEqual(montgomery.operational, false, 'Montgomery operational flag remains false');
assert.strictEqual(montgomery.productionEnabled, false, 'Montgomery production flag remains false');
assert.strictEqual(montgomery.selectable, false, 'Montgomery selectable flag remains false');
assert.strictEqual(api.GRIDLY_MONTGOMERY_RUNTIME_GATE, false, 'Montgomery runtime gate remains false');
assert.strictEqual(montgomery.runtimeGateEnabled, false, 'Montgomery registry remains bound to the false runtime gate');
assert.strictEqual(montgomery.productionActivationBlocked, true, 'Montgomery production activation remains blocked');

assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'liberty-tx', 'Montgomery activation through normalization is blocked');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' }).gridlyGetActiveCountyId(), 'liberty-tx', 'Montgomery active-county override is blocked');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'unknown-tx' }).gridlyGetActiveCountyId(), 'liberty-tx', 'Unknown active-county override fails closed to Liberty');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('montgomery-tx').county_id, 'liberty-tx', 'Montgomery-scoped metadata request remains Liberty-scoped while disabled');

assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty ownership is preserved');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'liberty-tx').allowed, false, 'Montgomery-to-Liberty contamination is blocked');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, false, 'Montgomery self-context remains blocked while disabled');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'liberty-tx').allowed, false, 'Unknown county rows fail closed');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'liberty-tx'), false, 'Montgomery reports are not visible in Liberty context');

assert.strictEqual(api.GRIDLY_DEFAULT_COUNTY_ID, 'liberty-tx', 'Liberty remains default');
assert.strictEqual(api.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty remains active default');
assert.strictEqual(liberty.operational, true, 'Liberty remains operational');
assert.strictEqual(liberty.productionEnabled, true, 'Liberty remains production enabled');
assert.strictEqual(liberty.selectable, true, 'Liberty remains selectable');
assert.ok(liberty.boundaryPath.startsWith('data/'), 'Liberty assets remain data-owned');
assert.ok(montgomery.boundaryPath.startsWith('assets/county-implementation/montgomery/'), 'Montgomery assets remain package-owned');
assert.ok(!montgomery.boundaryPath.startsWith('data/'), 'Montgomery assets are not promoted into data/');

console.log('montgomeryControlledObservationExecutionV587.test.js passed');
