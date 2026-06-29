const assert = require('assert');
const fs = require('fs');

function loadGeoJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}

const appSource = fs.readFileSync('js/app.js', 'utf8');
const adapterSource = fs.readFileSync('js/gridlyCrossingPackageAdapter.js', 'utf8');
const providerSource = fs.readFileSync('js/gridlyCrossingProvider.js', 'utf8');
const harris = loadGeoJson('Crossing-Packages/harris/harris-crossings.geojson');

assert.strictEqual(harris.features.length, 1159, 'Harris raw_fetch fixture remains 1159 crossings');
assert.strictEqual(harris.features[0].properties.COUNTYNAME, 'HARRIS', 'Harris raw_fetch first county remains HARRIS');
assert.strictEqual(harris.features[harris.features.length - 1].properties.COUNTYNAME, 'HARRIS', 'Harris raw_fetch last county remains HARRIS');

assert.ok(
  adapterSource.includes('buildAdaptedCrossingGeojson(sourcePath, alreadyFetchedGeojson)'),
  'adapter can receive already-fetched active county GeoJSON'
);
assert.ok(
  adapterSource.includes('alreadyFetchedGeojson && typeof alreadyFetchedGeojson === "object"'),
  'adapter uses provided GeoJSON instead of re-fetching a hardcoded source'
);

assert.ok(
  providerSource.includes('function resolveRuntimeCrossingSource'),
  'provider resolves the runtime crossing source dynamically'
);
assert.ok(
  providerSource.includes('window.gridlyGetCountyRuntimeSources(countyId)?.crossingSource'),
  'provider can load the active county runtime crossing path'
);
assert.ok(
  providerSource.includes('buildAdaptedCrossingGeojson(runtimeSource'),
  'provider passes the active runtime source into the adapter'
);
assert.ok(
  !providerSource.includes('Crossing-Packages/liberty/Production/liberty-production-crossings.geojson'),
  'provider no longer hardcodes the Liberty production crossing source'
);

assert.ok(
  appSource.includes('sourcePath: activeSources?.crossingSource || null'),
  'runtime provider invocation passes the active county crossing source path'
);
assert.ok(
  appSource.includes('await window.gridlyCrossingPackageAdapter.buildAdaptedCrossingGeojson(runtimeCrossingSourcePath, rawGeojson)'),
  'V826 trace refreshes adapter_input from the already-fetched active county GeoJSON'
);
assert.ok(
  appSource.includes('localCrossingsPath: "Crossing-Packages/harris/harris-crossings.geojson"'),
  'Harris runtime crossing source remains Harris-owned'
);
assert.ok(
  !appSource.slice(appSource.indexOf('async function gridlyCrossingLoadTraceAudit'), appSource.indexOf('window.gridlyCrossingLoadTraceAudit = gridlyCrossingLoadTraceAudit')).includes('Crossing-Packages/liberty/Production/liberty-production-crossings.geojson'),
  'Harris trace helper cannot inject the Liberty production path into adapter_input'
);

console.log('v827CrossingAdapterSourceOverride.test.js passed');
