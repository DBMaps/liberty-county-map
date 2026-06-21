const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

const sandbox = { Object, String, Boolean };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyNormalizeCountyId, gridlyIsKnownCountyId, gridlyIsCountyOperational, gridlyGetCountyRuntimeStatus, gridlyGetCountyRuntimeSources, gridlyValidateCountyContainment, gridlyReportMatchesActiveCounty };`, sandbox);

const api = sandbox.api;
const sanJacinto = api.GRIDLY_COUNTY_REGISTRY['san-jacinto-tx'];
assert.ok(sanJacinto, 'San Jacinto is registered as County #3 candidate');
assert.strictEqual(sanJacinto.id, 'san-jacinto-tx', 'San Jacinto countyId is established');
assert.strictEqual(sanJacinto.operational, false, 'San Jacinto is not activated');
assert.strictEqual(sanJacinto.productionEnabled, false, 'San Jacinto is not production-enabled');
assert.strictEqual(sanJacinto.selectable, false, 'San Jacinto is not exposed for production selection');
assert.strictEqual(sanJacinto.productionActivationBlocked, true, 'San Jacinto activation remains blocked');
assert.strictEqual(api.gridlyIsKnownCountyId('san-jacinto-tx'), true, 'San Jacinto is recognized as a known county');
assert.strictEqual(api.gridlyIsCountyOperational('san-jacinto-tx'), false, 'San Jacinto remains non-operational in V639');
assert.strictEqual(api.gridlyNormalizeCountyId('san-jacinto-tx'), 'liberty-tx', 'San Jacinto cannot become active through normalization before activation');
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('san-jacinto-tx'))), {
  known: true,
  countyId: 'san-jacinto-tx',
  operational: false,
  stage: 'runtime-onboarded',
  productionEnabled: false,
  selectable: false
});

const sources = api.GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY['san-jacinto-tx'];
assert.ok(sources, 'San Jacinto runtime source registration exists');
assert.strictEqual(sources.countyId, 'san-jacinto-tx', 'San Jacinto source ownership is explicit');
assert.strictEqual(sources.owner, 'san-jacinto-owned', 'San Jacinto source owner does not use implicit fallback ownership');
assert.strictEqual(sources.boundarySource, 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', 'San Jacinto boundary foundation path is registered');
assert.strictEqual(sources.crossingSource, 'assets/county-implementation/san-jacinto/runtime-assets/san-jacinto-county-rail-crossings.geojson', 'San Jacinto crossing inventory path is registered');
assert.strictEqual(sources.availability.boundary, 'identified', 'San Jacinto boundary source is identified but not activated');
assert.ok(source.includes('const GRIDLY_COUNTY_BOUNDARY_OVERLAY_COUNTY_IDS = Object.freeze(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]);'), 'San Jacinto is included in boundary foundation supported IDs');
assert.ok(source.includes('\"san-jacinto-tx\": \"48407\"'), 'San Jacinto boundary GEOID is registered');

const homeOptionsBlock = source.slice(source.indexOf('const GRIDLY_HOME_AREA_OPTIONS_BY_COUNTY'), source.indexOf('const GRIDLY_TOWN_STARTUP_ZOOM'));
assert.strictEqual(homeOptionsBlock.includes('san-jacinto-tx'), false, 'San Jacinto awareness areas are not activated in production filters');
const awarenessDefinitionsBlock = source.slice(source.indexOf('const GRIDLY_AWARENESS_AREA_DEFINITIONS'), source.indexOf('const GRIDLY_AWARENESS_AREA_BY_KEY'));
assert.strictEqual(awarenessDefinitionsBlock.includes('countyId: "san-jacinto-tx"'), false, 'No active San Jacinto awareness areas were introduced');
assert.ok(Array.isArray(sanJacinto.awarenessAreaCandidates), 'San Jacinto awareness candidates are inventory-only metadata');
assert.ok(sanJacinto.awarenessAreaCandidates.includes('Coldspring'), 'San Jacinto awareness candidate ownership is documented');

assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'liberty-tx').allowed, false, 'San Jacinto rows do not leak into Liberty');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'san-jacinto-tx' }, 'montgomery-tx').allowed, false, 'San Jacinto rows do not leak into Montgomery');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'liberty-tx' }, 'liberty-tx').allowed, true, 'Liberty containment still passes');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'montgomery-tx' }, 'montgomery-tx').allowed, true, 'Montgomery containment still passes');
assert.strictEqual(api.gridlyValidateCountyContainment({ county_id: 'unknown-county' }, 'liberty-tx').allowed, false, 'Unknown county remains fail-closed');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'liberty-tx'), false, 'San Jacinto report is blocked from Liberty active context');
assert.strictEqual(api.gridlyReportMatchesActiveCounty({ county_id: 'san-jacinto-tx' }, 'montgomery-tx'), false, 'San Jacinto report is blocked from Montgomery active context');

console.log('sanJacintoRuntimeOnboardingV639.test.js passed');
