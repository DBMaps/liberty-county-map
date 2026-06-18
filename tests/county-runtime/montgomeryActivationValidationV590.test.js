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
const rollback = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/activation/montgomery-activation-rollback-v590.json', 'utf8'));
const implementation = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/activation/montgomery-activation-implementation-v590.json', 'utf8'));
const validation = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/validation/montgomery-activation-validation-v590.json', 'utf8'));
const registryArtifact = JSON.parse(fs.readFileSync('assets/county-implementation/montgomery/registry/montgomery-county-registry-artifact.json', 'utf8'));
const boundary = JSON.parse(fs.readFileSync(montgomery.boundaryPath, 'utf8'));

assert.strictEqual(api.GRIDLY_DEFAULT_COUNTY_ID, 'liberty-tx', 'Liberty remains default when no county is selected');
assert.strictEqual(api.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty remains active default');
assert.strictEqual(liberty.operational, true, 'Liberty remains operational');
assert.strictEqual(liberty.productionEnabled, true, 'Liberty remains production enabled');
assert.strictEqual(liberty.selectable, true, 'Liberty remains selectable');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty self-containment works');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'liberty-tx').allowed, false, 'Liberty remains isolated from Montgomery rows');

assert.strictEqual(api.gridlyIsKnownCountyId('montgomery-tx'), true, 'Montgomery is known');
assert.strictEqual(api.GRIDLY_MONTGOMERY_RUNTIME_GATE, true, 'Montgomery runtime gate is true');
assert.strictEqual(api.gridlyIsCountyOperational('montgomery-tx'), true, 'Montgomery is operational');
assert.strictEqual(montgomery.productionEnabled, true, 'Montgomery is production enabled');
assert.strictEqual(montgomery.selectable, true, 'Montgomery is selectable');
assert.strictEqual(montgomery.productionActivationBlocked, false, 'Montgomery activation block is removed');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('montgomery-tx'))), { known: true, countyId: 'montgomery-tx', operational: true, stage: 'operational', productionEnabled: true, selectable: true }, 'Montgomery runtime status is operational');
assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery normalizes to itself');
assert.strictEqual(loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' }).gridlyGetActiveCountyId(), 'montgomery-tx', 'Montgomery can be selected');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery self-containment works');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'montgomery-tx').allowed, false, 'Montgomery remains isolated from Liberty rows');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('montgomery-tx').county_id, 'montgomery-tx', 'Montgomery metadata is county scoped');

assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('unknown-tx'))), { known: false, operational: false, stage: 'unknown', productionEnabled: false, selectable: false }, 'Unknown county status fails closed');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'liberty-tx').allowed, false, 'Unknown county rows are blocked');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'montgomery-tx').allowed, false, 'Unknown county rows are blocked from Montgomery');

assert.strictEqual(boundary.type, 'FeatureCollection', 'Montgomery boundary loads as GeoJSON FeatureCollection');
assert.ok(Array.isArray(boundary.features) && boundary.features.length > 0, 'Montgomery boundary has features');
assert.strictEqual(registryArtifact.geoid, '48339', 'Registry preserves Montgomery GEOID');
assert.strictEqual(registryArtifact.runtime_registry_state.operational, true, 'Registry artifact records operational state');
assert.strictEqual(implementation.runtime_state.GRIDLY_MONTGOMERY_RUNTIME_GATE, true, 'Implementation artifact records gate=true');
assert.strictEqual(validation.final_determination, 'ACTIVATION IMPLEMENTATION COMPLETE', 'Validation artifact records completion');

const rolledBackMontgomery = { ...montgomery, ...rollback.rollback_restores, runtimeGateEnabled: rollback.rollback_restores.GRIDLY_MONTGOMERY_RUNTIME_GATE };
assert.strictEqual(rolledBackMontgomery.runtimeGateEnabled, false, 'Rollback restores gate=false');
assert.strictEqual(rolledBackMontgomery.operational, false, 'Rollback restores operational=false');
assert.strictEqual(rolledBackMontgomery.productionEnabled, false, 'Rollback restores productionEnabled=false');
assert.strictEqual(rolledBackMontgomery.selectable, false, 'Rollback restores selectable=false');
assert.strictEqual(rolledBackMontgomery.productionActivationBlocked, true, 'Rollback restores productionActivationBlocked=true');

console.log('montgomeryActivationValidationV590.test.js passed');
