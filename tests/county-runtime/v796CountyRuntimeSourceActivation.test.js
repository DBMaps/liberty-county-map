const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
assert.ok(cutoff > 0, 'runtime source registry block is present before active source URL binding');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(`${source.slice(0, cutoff)}\nthis.api = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyGetActiveCountyId, gridlyGetCountyRuntimeStatus, gridlyGetCountyRuntimeSources, gridlyGetActiveCountyRuntimeSources, gridlyCountyRuntimeSourceAvailable };`, sandbox);

const { api } = sandbox;
assert.deepStrictEqual(JSON.parse(JSON.stringify(api.gridlyGetCountyRuntimeStatus('jefferson-tx'))), {
  known: true,
  countyId: 'jefferson-tx',
  operational: true,
  stage: 'operational',
  productionEnabled: true,
  selectable: true,
  validationOnly: false,
  productionActivationBlocked: false,
  reauthorizationRequired: false
});

sandbox.window.GRIDLY_ACTIVE_COUNTY_ID = 'jefferson-tx';
const activeSources = api.gridlyGetActiveCountyRuntimeSources();
assert.strictEqual(api.gridlyGetActiveCountyId(), 'jefferson-tx', 'explicit active county context switches to Jefferson');
assert.strictEqual(activeSources.countyId, 'jefferson-tx', 'active runtime source county switches to Jefferson');
assert.strictEqual(activeSources.boundarySource, 'assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson', 'Jefferson boundary source is active');
assert.strictEqual(activeSources.crossingSource, 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson', 'Jefferson crossing source is active');
assert.strictEqual(activeSources.crossingOverridesSource, 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-crossing-review-overrides.json', 'Jefferson crossing overrides source is active');
assert.strictEqual(activeSources.roadSource, 'assets/county-implementation/jefferson/runtime-assets/source/tl_2025_48245_roads.shp', 'Jefferson road source resolves to Jefferson runtime source artifact without rebuilding package contents');
assert.strictEqual(api.gridlyCountyRuntimeSourceAvailable('roads', 'jefferson-tx'), false, 'Jefferson SHP road source is exposed for ownership but not fetched through GeoJSON road loader');

sandbox.window.GRIDLY_ACTIVE_COUNTY_ID = 'liberty-tx';
assert.strictEqual(api.gridlyGetActiveCountyRuntimeSources().countyId, 'liberty-tx', 'Liberty runtime source behavior is preserved');
assert.strictEqual(api.gridlyGetActiveCountyRuntimeSources().roadSource, 'data/liberty-county-road-segments.geojson', 'Liberty road source remains loadable GeoJSON');
assert.strictEqual(api.gridlyCountyRuntimeSourceAvailable('roads', 'liberty-tx'), true, 'Liberty road availability is preserved');

assert.ok(source.includes('"jefferson-tx": "48245"'), 'Jefferson boundary overlay GEOID is registered');
assert.ok(source.includes('const activeRoadwaySegmentsUrl = activeRoadSources?.roadSourceLoadable ? activeRoadSources.roadSource : null;'), 'road loader remains limited to loadable GeoJSON runtime sources');
assert.ok(source.includes('const activeCrossingReviewOverridesUrl = gridlyGetActiveCountyRuntimeSources()?.crossingOverridesSource || null;'), 'crossing overrides resolve from active runtime context');

console.log('v796CountyRuntimeSourceActivation.test.js passed');
