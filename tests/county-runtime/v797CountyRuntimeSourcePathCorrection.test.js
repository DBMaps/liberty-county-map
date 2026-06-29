const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const cutoff = appSource.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
assert.ok(cutoff > 0, 'runtime source registry block is present before active source URL binding');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(`${appSource.slice(0, cutoff)}\nthis.api = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyGetActiveCountyId, gridlyGetCountyRuntimeSources, gridlyGetActiveCountyRuntimeSources, gridlyCountyRuntimeSourceAvailable };`, sandbox);

sandbox.window.GRIDLY_ACTIVE_COUNTY_ID = 'jefferson-tx';
const activeSources = sandbox.api.gridlyGetActiveCountyRuntimeSources();

assert.strictEqual(activeSources.countyId, 'jefferson-tx', 'Jefferson remains the active runtime source county');
assert.strictEqual(activeSources.boundarySource, 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-boundary.geojson', 'Jefferson uses the county-specific boundary source');
assert.strictEqual(activeSources.crossingSource, 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-rail-crossings.geojson', 'Jefferson crossing source stays Jefferson-owned');
assert.strictEqual(activeSources.roadSource, null, 'Jefferson road source reports unavailable when no loadable Jefferson GeoJSON exists');
assert.strictEqual(activeSources.roadSourceLoadable, false, 'Jefferson road source is not marked loadable without GeoJSON');
assert.strictEqual(sandbox.api.gridlyCountyRuntimeSourceAvailable('roads', 'jefferson-tx'), false, 'Jefferson road availability remains gated to loadable GeoJSON');
assert.ok(!JSON.stringify(activeSources).includes('Community-Packages/liberty/'), 'Jefferson active runtime sources do not expose Liberty package paths');
assert.ok(!JSON.stringify(activeSources).includes('data/liberty-county-road-segments.geojson'), 'Jefferson active runtime sources do not expose Liberty road GeoJSON');

sandbox.window.GRIDLY_ACTIVE_COUNTY_ID = 'liberty-tx';
const libertySources = sandbox.api.gridlyGetActiveCountyRuntimeSources();
assert.strictEqual(libertySources.countyId, 'liberty-tx', 'Liberty remains the active runtime source county');
assert.strictEqual(libertySources.boundarySource, 'data/liberty-county-boundary.geojson', 'Liberty boundary source is preserved');
assert.strictEqual(libertySources.roadSource, 'data/liberty-county-road-segments.geojson', 'Liberty road source is preserved');
assert.strictEqual(libertySources.roadSourceLoadable, true, 'Liberty road source remains loadable');

assert.ok(appSource.includes('activeRuntimeSourceCountyId'), 'boundary overlay audit exposes activeRuntimeSourceCountyId');
assert.ok(appSource.includes('activeBoundaryCountyId'), 'boundary overlay audit exposes activeBoundaryCountyId');
assert.ok(appSource.includes('activeRuntimeBoundarySource'), 'boundary overlay audit exposes activeRuntimeBoundarySource');
assert.ok(appSource.includes('activeRuntimeRoadSource'), 'boundary overlay audit exposes activeRuntimeRoadSource');
assert.ok(appSource.includes('activeRuntimeCrossingSource'), 'boundary overlay audit exposes activeRuntimeCrossingSource');

const bridgeSource = fs.readFileSync('js/gridlyRuntimeSourceBridgeActivation.js', 'utf8');
assert.ok(bridgeSource.includes('runtimeSources.countyId'), 'package bridge keys overrides by active county id instead of defaulting to Liberty');
assert.ok(bridgeSource.includes('packageSources.roadSource && /\\.geojson'), 'package bridge only overrides roads with loadable GeoJSON');

console.log('v797CountyRuntimeSourcePathCorrection.test.js passed');
