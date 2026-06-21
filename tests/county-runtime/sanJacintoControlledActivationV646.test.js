const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
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

assert.ok(sanJacinto, 'San Jacinto registration exists');
assert.strictEqual(sanJacinto.stage, 'validation-only', 'San Jacinto is temporarily validation-only');
assert.strictEqual(sanJacinto.operational, true, 'San Jacinto is operational only for browser validation');
assert.strictEqual(sanJacinto.productionEnabled, false, 'San Jacinto production remains disabled');
assert.strictEqual(sanJacinto.selectable, true, 'San Jacinto is temporarily selectable for validation');
assert.strictEqual(sanJacinto.productionActivationBlocked, true, 'San Jacinto activation block remains in force');
assert.strictEqual(api.gridlyIsKnownCountyId('san-jacinto-tx'), true, 'San Jacinto is known');
assert.strictEqual(api.gridlyIsCountyOperational('san-jacinto-tx'), true, 'San Jacinto is operational through helper only for validation');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('san-jacinto-tx'))), {
  known: true,
  countyId: 'san-jacinto-tx',
  operational: true,
  stage: 'validation-only',
  productionEnabled: false,
  selectable: true,
  validationOnly: true,
  productionActivationBlocked: true,
  reauthorizationRequired: true
}, 'San Jacinto held status is audit-observable');

assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.defaultAwarenessAreas)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'San Jacinto validation-only awareness areas are exposed');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.awarenessAreaCandidates)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'San Jacinto candidate areas remain documented only');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanSources.defaultAwarenessAreas)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'runtime source registry exposes validation-only San Jacinto awareness areas');
['san-jacinto-county', 'coldspring', 'shepherd', 'point-blank', 'oakhurst'].forEach((key) => {
  assert.strictEqual(source.includes(`{ key: "${key}"`), true, `${key} is activated as a validation-only awareness area`);
});
assert.strictEqual(source.includes('{ key: "camilla"'), false, 'unapproved San Jacinto area Camilla is not activated');
assert.strictEqual(index.includes('value="san-jacinto-tx"'), true, 'San Jacinto is exposed in selectable county onboarding for validation only');

assert.strictEqual(sanSources.owner, 'san-jacinto-owned', 'San Jacinto source ownership is explicit');
assert.strictEqual(sanSources.boundarySource, 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'San Jacinto boundary source is county-owned');
assert.strictEqual(sanSources.availability.boundary, 'available', 'San Jacinto boundary is available for validation');
assert.ok(source.includes('const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]);'), 'boundary registry retains San Jacinto foundation entry for audit');
assert.ok(source.includes('"san-jacinto-tx": "48407"'), 'San Jacinto boundary GEOID is registered');
assert.ok(source.includes('weight: active ? 1.5 : passiveCountyWeight'), 'passive boundary suppression remains configured');

assert.strictEqual(api.gridlyNormalizeCountyId('liberty-tx'), 'liberty-tx', 'Liberty normalizes to Liberty');
assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery normalizes to Montgomery');
assert.strictEqual(api.gridlyNormalizeCountyId('san-jacinto-tx'), 'san-jacinto-tx', 'San Jacinto normalizes during validation-only activation');
assert.strictEqual(api.gridlyNormalizeCountyId('unknown-county'), 'liberty-tx', 'Unknown county fails closed to default normalization');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'san-jacinto-tx').allowed, true, 'San Jacinto containment works in validation-only mode');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-county' }, 'san-jacinto-tx').allowed, false, 'Unknown county FAIL-CLOSED');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'liberty-tx'), false, 'San Jacinto does not leak to Liberty');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'montgomery-tx'), false, 'San Jacinto does not leak to Montgomery');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'san-jacinto-tx'), false, 'Liberty does not leak to San Jacinto');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'san-jacinto-tx'), false, 'Montgomery does not leak to San Jacinto');
assert.strictEqual(api.gridlyGetCountyScopedReportMetadata('san-jacinto-tx').county_id, 'san-jacinto-tx', 'San Jacinto report metadata is county-scoped for audit-only paths');

assert.strictEqual(liberty.operational, true, 'Liberty remains operational');
assert.strictEqual(liberty.selectable, true, 'Liberty remains selectable');
assert.strictEqual(montgomery.operational, true, 'Montgomery remains operational');
assert.strictEqual(montgomery.selectable, true, 'Montgomery remains selectable');
['historicalReadsEnabled: false', 'historyUiEnabled: false', 'DriveTexasPaused: true', 'TransportationIntelligenceEnabled: false', 'TransportationIntelligenceDisplay: false', 'TransportationIntelligenceActivation: false'].forEach((needle) => {
  assert.ok(source.includes(needle), `${needle} remains protected`);
});

console.log('sanJacintoControlledActivationV646.test.js passed');
