const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

const sandbox = { Object, String, Boolean };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_COUNTY_REGISTRY, GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyNormalizeCountyId, gridlyIsKnownCountyId, gridlyIsCountyOperational, gridlyGetCountyRuntimeStatus, gridlyGetCountyRuntimeSources, gridlyValidateCountyContainment, gridlyReportMatchesActiveCounty, gridlyGetCountyScopedReportMetadata };`, sandbox);

const api = sandbox.api;
const registry = api.GRIDLY_COUNTY_REGISTRY;
const liberty = registry['liberty-tx'];
const montgomery = registry['montgomery-tx'];
const sanJacinto = registry['san-jacinto-tx'];
const sanSources = api.GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY['san-jacinto-tx'];

// Activation audit.
assert.ok(sanJacinto, 'San Jacinto registration exists');
assert.strictEqual(sanJacinto.stage, 'operational', 'San Jacinto is operationally staged');
assert.strictEqual(sanJacinto.operational, true, 'San Jacinto is operational');
assert.strictEqual(sanJacinto.productionEnabled, true, 'San Jacinto production status is active');
assert.strictEqual(sanJacinto.selectable, true, 'San Jacinto is selectable');
assert.strictEqual(sanJacinto.productionActivationBlocked, false, 'San Jacinto activation block is removed');
assert.strictEqual(api.gridlyIsKnownCountyId('san-jacinto-tx'), true, 'San Jacinto is known');
assert.strictEqual(api.gridlyIsCountyOperational('san-jacinto-tx'), true, 'San Jacinto is operational through helper');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('san-jacinto-tx'))), {
  known: true,
  countyId: 'san-jacinto-tx',
  operational: true,
  stage: 'operational',
  productionEnabled: true,
  selectable: true
}, 'San Jacinto status is audit-observable');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.controlledActivation)), { milestone: 'V646', reversible: true, auditable: true, contained: true, failClosed: true }, 'controlled activation metadata is present');

// Awareness ownership audit.
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.defaultAwarenessAreas)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'only approved San Jacinto awareness areas are active');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanSources.defaultAwarenessAreas)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'runtime source registry exposes only approved awareness areas');
['san-jacinto-county', 'coldspring', 'shepherd', 'point-blank', 'oakhurst'].forEach((key) => {
  assert.ok(source.includes(`{ key: "${key}"`) && source.includes('countyId: "san-jacinto-tx"'), `${key} is San Jacinto-owned`);
});
assert.strictEqual(source.includes('{ key: "camilla"'), false, 'unapproved San Jacinto area Camilla is not activated');
assert.ok(source.includes('"san-jacinto-tx": [GRIDLY_SAN_JACINTO_COUNTY_WIDE_HOME_TOWN, "Coldspring", "Shepherd", "Point Blank", "Oakhurst"]'), 'San Jacinto selectable home areas match V643 approvals');
assert.ok(index.includes('<option value="san-jacinto-tx" data-gridly-county-option="san-jacinto-tx">San Jacinto County</option>'), 'San Jacinto appears in selectable county onboarding');

// Boundary audit.
assert.strictEqual(sanSources.owner, 'san-jacinto-owned', 'San Jacinto source ownership is explicit');
assert.strictEqual(sanSources.boundarySource, 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'San Jacinto boundary source is county-owned');
assert.strictEqual(sanSources.availability.boundary, 'available', 'San Jacinto boundary is activated');
assert.ok(source.includes('const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]);'), 'active county boundary registry includes San Jacinto');
assert.ok(source.includes('"san-jacinto-tx": "48407"'), 'San Jacinto boundary GEOID is registered');
assert.ok(source.includes('weight: active ? 1.5 : passiveCountyWeight'), 'passive boundary suppression remains configured');
assert.ok(source.includes('gridlyCountyBoundaryOverlaySourceMetadataById[countyId] = { sourceType: "county_specific_active"'), 'active boundary rendering uses county-specific geometry when available');

// County containment and cross-county validation audit.
assert.strictEqual(api.gridlyNormalizeCountyId('liberty-tx'), 'liberty-tx', 'Liberty normalizes to Liberty');
assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery normalizes to Montgomery');
assert.strictEqual(api.gridlyNormalizeCountyId('san-jacinto-tx'), 'san-jacinto-tx', 'San Jacinto normalizes to San Jacinto');
assert.strictEqual(api.gridlyNormalizeCountyId('unknown-county'), 'liberty-tx', 'Unknown county fails closed to default normalization');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'san-jacinto-tx').allowed, true, 'San Jacinto PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-county' }, 'san-jacinto-tx').allowed, false, 'Unknown county FAIL-CLOSED');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'liberty-tx'), false, 'San Jacinto does not leak to Liberty');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'montgomery-tx'), false, 'San Jacinto does not leak to Montgomery');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'san-jacinto-tx'), false, 'Liberty does not leak to San Jacinto');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'san-jacinto-tx'), false, 'Montgomery does not leak to San Jacinto');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('san-jacinto-tx').county_id, 'san-jacinto-tx', 'San Jacinto report metadata is county-scoped');

// Regression and protected systems audit.
assert.strictEqual(liberty.operational, true, 'Liberty remains operational');
assert.strictEqual(liberty.selectable, true, 'Liberty remains selectable');
assert.strictEqual(montgomery.operational, true, 'Montgomery remains operational');
assert.strictEqual(montgomery.selectable, true, 'Montgomery remains selectable');
['historicalReadsEnabled: false', 'historyUiEnabled: false', 'DriveTexasPaused: true', 'TransportationIntelligenceEnabled: false', 'TransportationIntelligenceDisplay: false', 'TransportationIntelligenceActivation: false'].forEach((needle) => {
  assert.ok(source.includes(needle), `${needle} remains protected`);
});

// Rollback validation: reverting registry status and awareness activation would make San Jacinto non-operational/non-selectable and remove active awareness exposure.
const rollbackStatus = { stage: 'runtime-onboarded', operational: false, productionEnabled: false, selectable: false, productionActivationBlocked: true, defaultAwarenessAreas: [] };
assert.strictEqual(rollbackStatus.operational, false, 'rollback disables San Jacinto operations');
assert.strictEqual(rollbackStatus.selectable, false, 'rollback removes San Jacinto selection');
assert.deepStrictEqual(rollbackStatus.defaultAwarenessAreas, [], 'rollback removes San Jacinto awareness activation');

console.log('sanJacintoControlledActivationV646.test.js passed');
