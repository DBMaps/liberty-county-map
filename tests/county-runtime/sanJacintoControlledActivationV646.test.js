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
assert.strictEqual(sanJacinto.stage, 'runtime-onboarded', 'San Jacinto remains runtime-onboarded');
assert.strictEqual(sanJacinto.operational, false, 'San Jacinto is not operational');
assert.strictEqual(sanJacinto.productionEnabled, false, 'San Jacinto production remains disabled');
assert.strictEqual(sanJacinto.selectable, false, 'San Jacinto is not selectable');
assert.strictEqual(sanJacinto.productionActivationBlocked, true, 'San Jacinto activation block remains in force');
assert.strictEqual(api.gridlyIsKnownCountyId('san-jacinto-tx'), true, 'San Jacinto is known');
assert.strictEqual(api.gridlyIsCountyOperational('san-jacinto-tx'), false, 'San Jacinto is not operational through helper');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('san-jacinto-tx'))), {
  known: true,
  countyId: 'san-jacinto-tx',
  operational: false,
  stage: 'runtime-onboarded',
  productionEnabled: false,
  selectable: false
}, 'San Jacinto held status is audit-observable');

assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.defaultAwarenessAreas)), [], 'San Jacinto active awareness areas remain empty');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanJacinto.awarenessAreaCandidates)), ['San Jacinto County', 'Coldspring', 'Shepherd', 'Point Blank', 'Oakhurst'], 'San Jacinto candidate areas remain documented only');
assert.deepStrictEqual(JSON.parse(JSON.stringify(sanSources.defaultAwarenessAreas)), [], 'runtime source registry does not expose San Jacinto awareness areas');
['san-jacinto-county', 'coldspring', 'shepherd', 'point-blank', 'oakhurst'].forEach((key) => {
  assert.strictEqual(source.includes(`{ key: "${key}"`), false, `${key} is not activated as an awareness area`);
});
assert.strictEqual(source.includes('{ key: "camilla"'), false, 'unapproved San Jacinto area Camilla is not activated');
assert.strictEqual(index.includes('<option value="san-jacinto-tx" data-gridly-county-option="san-jacinto-tx">San Jacinto County</option>'), false, 'San Jacinto is not exposed in selectable county onboarding');

assert.strictEqual(sanSources.owner, 'san-jacinto-owned', 'San Jacinto source ownership is explicit');
assert.strictEqual(sanSources.boundarySource, 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'San Jacinto boundary source is county-owned');
assert.strictEqual(sanSources.availability.boundary, 'identified', 'San Jacinto boundary remains identified but not production-available');
assert.ok(source.includes('const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]);'), 'boundary registry retains San Jacinto foundation entry for audit');
assert.ok(source.includes('"san-jacinto-tx": "48407"'), 'San Jacinto boundary GEOID is registered');
assert.ok(source.includes('weight: active ? 1.5 : passiveCountyWeight'), 'passive boundary suppression remains configured');

assert.strictEqual(api.gridlyNormalizeCountyId('liberty-tx'), 'liberty-tx', 'Liberty normalizes to Liberty');
assert.strictEqual(api.gridlyNormalizeCountyId('montgomery-tx'), 'montgomery-tx', 'Montgomery normalizes to Montgomery');
assert.strictEqual(api.gridlyNormalizeCountyId('san-jacinto-tx'), 'liberty-tx', 'San Jacinto normalization remains fail-closed while held');
assert.strictEqual(api.gridlyNormalizeCountyId('unknown-county'), 'liberty-tx', 'Unknown county fails closed to default normalization');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery PASS');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'san-jacinto-tx').allowed, false, 'San Jacinto containment remains blocked while non-operational');
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
