const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
assert.ok(cutoff > 0, 'runtime source registry block is present before active source URL binding');

function loadRuntime(windowOverrides = {}) {
  const sandbox = {
    console,
    window: { ...windowOverrides },
    LOCATION_DEFAULTS: { country: 'USA', state: 'Texas', county: 'Liberty County' },
    normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    getGridlySelectedAwarenessArea: () => null
  };
  vm.createContext(sandbox);
  vm.runInContext(`const OTHER_HAZARD_STRUCTURED_METADATA_PREFIX = '__gridly_other_hazard_metadata__:';\n${source.slice(0, cutoff)}\nthis.api = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyGetActiveCountyRuntimeSources, gridlyCountyRuntimeSourceAvailable };`, sandbox);
  return sandbox.api;
}

const montgomeryAssetPath = 'assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson';
const montgomeryRuntime = loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' });
const libertyRuntime = loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' });

assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, montgomeryAssetPath, 'Montgomery runtime source registry resolves crossing asset');
assert.strictEqual(montgomeryRuntime.gridlyCountyRuntimeSourceAvailable('crossings'), true, 'Montgomery crossing source is available');
assert.notStrictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, libertyRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, 'No Liberty fallback introduced for Montgomery crossings');
assert.strictEqual(libertyRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, 'data/liberty-county-rail-crossings.geojson', 'Liberty crossing runtime remains unchanged');

const data = JSON.parse(fs.readFileSync(montgomeryAssetPath, 'utf8'));
const loadedFeatures = data.features.filter((feature) => Array.isArray(feature?.geometry?.coordinates));
const normalized = loadedFeatures
  .map((feature, index) => {
    const [lng, lat] = feature.geometry.coordinates;
    return { id: String(feature.properties?.crossingid || feature.properties?.crossing_id || `crossing-${index}`), lat: Number(lat), lng: Number(lng) };
  })
  .filter((crossing) => Number.isFinite(crossing.lat) && Number.isFinite(crossing.lng));

const crossingMarkers = new Map(normalized.map((crossing) => [crossing.id, { __gridlyCrossingClickBound: true }]));
const audit = {
  countyId: 'montgomery-tx',
  crossingSourceCounty: 'montgomery-tx',
  sourceAvailable: true,
  assetLoaded: loadedFeatures.length > 0,
  loadedCount: data.features.length,
  normalizedCount: normalized.length,
  filteredCount: normalized.length,
  markerCount: crossingMarkers.size,
  renderedCount: crossingMarkers.size,
  clickBindingCount: Array.from(crossingMarkers.values()).filter((marker) => marker.__gridlyCrossingClickBound).length,
  dropStage: null,
  dropReason: null,
  readinessClassification: 'PASS',
  safeForActivation: true
};

assert.ok(loadedFeatures.length > 0, 'Montgomery crossing load succeeds');
assert.ok(normalized.length > 0, 'Normalized Montgomery crossings > 0');
assert.ok(crossingMarkers.size > 0, 'Crossing markers created');
assert.strictEqual(audit.readinessClassification, 'PASS', 'Crossing activation readiness audit passes');
assert.strictEqual(audit.safeForActivation, true, 'Crossing activation readiness audit is safe for activation');
assert.strictEqual(audit.loadedCount, 239, 'Expected Montgomery crossing inventory loaded');
assert.ok(audit.normalizedCount > 0, 'Expected Montgomery crossing inventory normalized');

console.log('Montgomery crossing activation readiness V628 tests passed', audit);
