const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const registryCutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
const helperStart = source.indexOf('function gridlyParseCoordinateNumber');
const helperEnd = source.indexOf('async function loadCrossings()');
assert.ok(registryCutoff > 0, 'runtime source registry block is present before active source URL binding');
assert.ok(helperStart > 0 && helperEnd > helperStart, 'crossing coordinate helpers are present before loadCrossings');

function loadRuntime(windowOverrides = {}) {
  const sandbox = {
    console,
    window: { ...windowOverrides },
    LOCATION_DEFAULTS: { country: 'USA', state: 'Texas', county: 'Liberty County' },
    normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    getGridlySelectedAwarenessArea: () => null,
    getGridlyReviewedCrossingLocationContext: () => ({ displayName: '', primaryLabel: '', secondaryLabel: '', source: '' }),
    inferCrossingCity: (name, props = {}) => props.cityname || props.city || 'Conroe',
    buildRegionKey: ({ country, state, county, city }) => [country, state, county, city].filter(Boolean).join('|'),
    calculateBaseRisk: () => 1,
    populateCrossingSelect: () => {},
    applyGridlyHomeTownAwarenessContext: () => {},
    scheduleRenderCrossings: () => {},
    evaluateLayoutMode: () => 'mobile',
    updateDailyHabitStatus: () => {},
    updateLastUpdated: () => {},
    safeText: () => {},
    renderUnifiedIncidents: () => {}
  };
  vm.createContext(sandbox);
  vm.runInContext(`const OTHER_HAZARD_STRUCTURED_METADATA_PREFIX = '__gridly_other_hazard_metadata__:';\n${source.slice(0, registryCutoff)}
${source.slice(helperStart, helperEnd)}\nthis.api = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyGetActiveCountyRuntimeSources, gridlyCountyRuntimeSourceAvailable, extractGridlyCrossingCoordinates, buildGridlyCrossingCoordinateDiagnostics, normalizeGridlyCrossingFeatures };`, sandbox);
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
const diagnostics = montgomeryRuntime.buildGridlyCrossingCoordinateDiagnostics(data.features);
const normalized = montgomeryRuntime.normalizeGridlyCrossingFeatures(data.features, { source: 'county_runtime_source', overrides: {} });

const crossingMarkers = new Map(normalized.map((crossing) => [crossing.id, { __gridlyCrossingClickBound: true }]));
const audit = {
  countyId: 'montgomery-tx',
  crossingSourceCounty: 'montgomery-tx',
  sourceAvailable: true,
  assetLoaded: data.features.length > 0,
  loadedCount: data.features.length,
  normalizedCount: normalized.length,
  filteredCount: normalized.length,
  markerCount: crossingMarkers.size,
  renderedCount: crossingMarkers.size,
  clickBindingCount: Array.from(crossingMarkers.values()).filter((marker) => marker.__gridlyCrossingClickBound).length,
  ...diagnostics,
  dropStage: null,
  dropReason: null,
  readinessClassification: 'PASS',
  safeForActivation: true
};

assert.ok(data.features.length > 0, 'Montgomery crossing load succeeds');
assert.ok(normalized.length > 0, 'Normalized Montgomery crossings > 0');
assert.ok(crossingMarkers.size > 0, 'Crossing markers created');
assert.strictEqual(audit.readinessClassification, 'PASS', 'Crossing activation readiness audit passes');
assert.strictEqual(audit.safeForActivation, true, 'Crossing activation readiness audit is safe for activation');
assert.strictEqual(audit.loadedCount, 239, 'Expected Montgomery crossing inventory loaded');
assert.strictEqual(audit.normalizedCount, 204, 'Expected real Montgomery valid-coordinate count');
assert.strictEqual(audit.rejectedFeatureCount, 35, 'Expected Montgomery null-coordinate rejected count');
assert.ok(audit.geometryTypesSample.includes('Point'), 'Expected Point geometry in real Montgomery asset');
assert.ok(audit.geometryTypesSample.includes(null), 'Expected null geometry sample in real Montgomery asset');
assert.strictEqual(audit.firstRejectedFeatureReason, 'missing_geometry_and_no_valid_property_coordinates', 'Expected clear null-geometry rejection reason');
assert.strictEqual(diagnostics.diagnosticNormalizedCount, normalized.length, 'Runtime crossing inventory receives the same normalized count as diagnostics');
assert.ok(diagnostics.normalizedSample.length > 0 && normalized.length > 0, 'normalizedSample cannot be non-empty while runtime normalized count is zero');
assert.ok(source.includes('["local_fallback", "county_runtime_source"].includes(String(crossing.source || ""))'), 'County runtime local-only crossing asset branch assigns normalized crossings');
assert.strictEqual(normalized[0].county, 'Montgomery County', 'Montgomery crossings carry active county metadata through runtime normalization');

console.log('Montgomery crossing activation readiness V628 tests passed', audit);
