const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const roadGeojsonPath = 'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson';
const validationPath = 'assets/county-implementation/san-jacinto/validation/san-jacinto-road-geometry-runtime-wiring-v650r10.json';
const cutoff = appSource.indexOf('const GRIDLY_REMOTE_CROSSING_FETCH_OPTIONS');
assert(cutoff > 0, 'runtime registry and URL binding block is available');

function loadRuntime(activeCountyId) {
  const sandbox = {
    Object,
    String,
    Boolean,
    RegExp,
    console,
    window: { GRIDLY_ACTIVE_COUNTY_ID: activeCountyId }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${appSource.slice(0, cutoff)}
this.api = {
  GRIDLY_COUNTY_REGISTRY,
  GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY,
  ROADWAY_SEGMENTS_URL,
  gridlyGetCountyRuntimeSources,
  gridlyGetActiveCountyRuntimeSources,
  gridlyCountyRuntimeSourceAvailable,
  gridlyGetCountyRuntimeStatus
};`, sandbox);
  return sandbox.api;
}

const sanJacintoRuntime = loadRuntime('san-jacinto-tx');
const libertyRuntime = loadRuntime('liberty-tx');
const montgomeryRuntime = loadRuntime('montgomery-tx');
const sanJacintoConfig = sanJacintoRuntime.GRIDLY_COUNTY_REGISTRY['san-jacinto-tx'];
const sanJacintoSources = sanJacintoRuntime.gridlyGetCountyRuntimeSources('san-jacinto-tx');

assert.strictEqual(sanJacintoConfig.roadSegmentsPathPrevious, 'assets/county-implementation/san-jacinto/runtime-assets/source/tl_2025_48407_roads.shp', 'old San Jacinto shapefile registration is documented');
assert.strictEqual(sanJacintoConfig.roadSegmentsPath, roadGeojsonPath, 'San Jacinto runtime path is registered to normalized GeoJSON');
assert.strictEqual(sanJacintoSources.roadSource, roadGeojsonPath, 'San Jacinto roadSegmentsPath populates runtime road source');
assert.strictEqual(sanJacintoConfig.runtimeSourceAvailability.roads, 'available', 'San Jacinto road runtime availability is available after wiring');
assert.strictEqual(sanJacintoRuntime.gridlyCountyRuntimeSourceAvailable('roads', 'san-jacinto-tx'), true, 'San Jacinto roads resolve as loadable through shared availability helper');
assert.strictEqual(sanJacintoRuntime.ROADWAY_SEGMENTS_URL, roadGeojsonPath, 'active San Jacinto ROADWAY_SEGMENTS_URL resolves through shared runtime source registry');
assert(fs.existsSync(roadGeojsonPath), 'San Jacinto normalized GeoJSON exists');
const geojson = JSON.parse(fs.readFileSync(roadGeojsonPath, 'utf8'));
assert.strictEqual(Array.isArray(geojson.features), true, 'San Jacinto GeoJSON exposes feature array');
assert.strictEqual(geojson.features.length, 3906, 'San Jacinto GeoJSON feature count remains 3,906');

assert.strictEqual(libertyRuntime.GRIDLY_COUNTY_REGISTRY['liberty-tx'].roadSegmentsPath, 'data/liberty-county-road-segments.geojson', 'Liberty road path unchanged');
assert.strictEqual(libertyRuntime.GRIDLY_COUNTY_REGISTRY['liberty-tx'].runtimeSourceAvailability.roads, 'available', 'Liberty road availability unchanged');
assert.strictEqual(libertyRuntime.ROADWAY_SEGMENTS_URL, 'data/liberty-county-road-segments.geojson', 'Liberty active runtime URL unchanged');
assert.strictEqual(montgomeryRuntime.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].roadSegmentsPath, null, 'Montgomery road path remains null');
assert.strictEqual(montgomeryRuntime.GRIDLY_COUNTY_REGISTRY['montgomery-tx'].runtimeSourceAvailability.roads, 'missing', 'Montgomery roads remain missing');
assert.strictEqual(montgomeryRuntime.ROADWAY_SEGMENTS_URL, null, 'Montgomery active runtime URL remains unavailable');

const status = sanJacintoRuntime.gridlyGetCountyRuntimeStatus('san-jacinto-tx');
assert.strictEqual(status.validationOnly, true, 'San Jacinto remains validation-only');
assert.strictEqual(status.productionEnabled, false, 'San Jacinto remains production disabled');
assert.strictEqual(status.productionActivationBlocked, true, 'San Jacinto remains production activation blocked');
assert.strictEqual(status.reauthorizationRequired, true, 'San Jacinto still requires reauthorization');

assert(appSource.includes('const ROADWAY_SEGMENTS_URL = gridlyGetActiveCountyRuntimeSources().roadSource;'), 'ROADWAY_SEGMENTS_URL uses county-aware runtime source registry');
assert(appSource.includes('async function loadRoadwayDataset()'), 'shared roadway loader remains present');
assert(appSource.includes('fetch(ROADWAY_SEGMENTS_URL, { cache: "no-store" })'), 'shared roadway loader fetches active runtime road source');
assert(appSource.includes('function collectNearbyRoadCandidates'), 'shared nearby road resolver remains present');
assert(appSource.includes('function buildGridlyAlertCardConsumerModel'), 'shared alert consumer model remains present');
assert(appSource.includes('function buildGridlyLightweightActiveAwareness'), 'shared active awareness model remains present');

const evidence = JSON.parse(fs.readFileSync(validationPath, 'utf8'));
assert.strictEqual(evidence.runtimeRegistrationStatus.oldRegistration.roads, 'inventory-only', 'validation evidence documents old inventory-only roads status');
assert.strictEqual(evidence.runtimeRegistrationStatus.newRegistration.roads, 'available', 'validation evidence documents new road availability');
assert.strictEqual(evidence.roadwaySourcePath, roadGeojsonPath, 'validation evidence documents roadway source path');
assert.strictEqual(evidence.validationStatus, 'pass', 'validation evidence is passing');
assert.strictEqual(evidence.activationStatus.validationOnly, true, 'validation evidence preserves validation-only status');
assert.strictEqual(evidence.activationStatus.productionEnabled, false, 'validation evidence preserves production disabled status');
assert.strictEqual(evidence.protectedSystemsPreserved.historicalReadsEnabled, false, 'validation evidence preserves historicalReadsEnabled false');
assert.strictEqual(evidence.protectedSystemsPreserved.DriveTexasPaused, true, 'validation evidence preserves DriveTexas paused');

console.log('sanJacintoRoadGeometryRuntimeWiringV650R10.test.js passed');
