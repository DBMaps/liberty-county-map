const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const swSource = fs.readFileSync('service-worker.js', 'utf8');
const manifestText = fs.readFileSync('data/roadway-runtime-manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);

const coveredCountyIds = [
  'liberty-tx', 'montgomery-tx', 'san-jacinto-tx', 'chambers-tx', 'jefferson-tx', 'hardin-tx', 'polk-tx',
  'walker-tx', 'orange-tx', 'jasper-tx', 'newton-tx', 'tyler-tx', 'galveston-tx', 'brazoria-tx',
  'fort-bend-tx', 'waller-tx', 'austin-tx', 'washington-tx', 'brazos-tx', 'grimes-tx', 'wharton-tx',
  'colorado-tx', 'fayette-tx', 'lavaca-tx', 'jackson-tx', 'matagorda-tx', 'calhoun-tx', 'harris-tx'
];
const localRuntime = ['liberty-tx', 'montgomery-tx', 'san-jacinto-tx'];
const harris = 'harris-tx';
const pendingCopiedCountyIds = coveredCountyIds.filter((id) => !localRuntime.includes(id) && id !== harris);

assert.strictEqual(manifest.contractVersion, 'LP028.4');
assert.strictEqual(Object.keys(manifest.counties).length, 28, 'manifest covers exactly 28 counties');
assert.deepStrictEqual(Object.keys(manifest.counties).sort(), [...coveredCountyIds].sort(), 'manifest county ids match LP028 coverage');
assert.strictEqual(manifest.counties['liberty-tx'].url, 'data/liberty-county-road-segments.geojson');
assert.strictEqual(manifest.counties['montgomery-tx'].url, 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson');
assert.strictEqual(manifest.counties['san-jacinto-tx'].url, 'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson');
localRuntime.forEach((id) => assert.strictEqual(manifest.counties[id].status, 'local_runtime', `${id} remains local runtime`));
pendingCopiedCountyIds.forEach((id) => {
  assert.strictEqual(manifest.counties[id].status, 'pending_external_upload', `${id} remains pending external upload`);
  assert.strictEqual(manifest.counties[id].url, null, `${id} has no placeholder URL`);
});
assert.strictEqual(manifest.counties[harris].status, 'blocked_partition_required');
assert.strictEqual(manifest.counties[harris].url, null);
assert.ok(manifest.counties[harris].blockReason.includes('partitioning'));
assert.ok(!/[A-Z]:\\/.test(manifestText), 'manifest does not contain Windows paths');
assert.ok(!/(example\.com|placeholder|TODO|supabase\.co)/i.test(manifestText), 'manifest has no placeholder/vendor URLs');

const cutoff = appSource.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
const noop = () => {};
const element = new Proxy({ dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; } }, { get(target, prop) { return prop in target ? target[prop] : (prop === 'textContent' || prop === 'innerHTML' || prop === 'value' ? '' : noop); } });
const documentStub = new Proxy({ addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return element; }, createElement() { return element; }, body: element, documentElement: element }, { get(target, prop) { return prop in target ? target[prop] : noop; } });
const sandbox = { console, window: {}, document: documentStub, navigator: {}, URL, setTimeout: noop, clearTimeout: noop, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
vm.createContext(sandbox);
vm.runInContext(`${appSource.slice(0, cutoff)}\nthis.api = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyGetActiveCountyRuntimeSources, gridlyGetCountyRuntimeSources, gridlyCountyRuntimeSourceAvailable, gridlyInstallRoadwayRuntimeManifest, gridlyValidateRoadwayRuntimeAssetUrl, gridlyResolveRoadwayRuntimeSource };`, sandbox);
const api = sandbox.api;

assert.strictEqual(api.gridlyValidateRoadwayRuntimeAssetUrl('https://static.assets.example/county.geojson'), true, 'HTTPS GeoJSON accepted');
assert.strictEqual(api.gridlyValidateRoadwayRuntimeAssetUrl('data/liberty-county-road-segments.geojson', { allowLocalhostHttp: true }), true, 'relative GeoJSON accepted');
['http://evil.example/county.geojson', 'file:///tmp/county.geojson', 'C:\\tmp\\county.geojson', 'javascript:alert(1)', 'data:application/json,{}', 'blob:https://x', 'roads.shp', 'roads.dbf', 'roads.shx', 'roads.prj'].forEach((url) => {
  assert.strictEqual(api.gridlyValidateRoadwayRuntimeAssetUrl(url), false, `${url} rejected`);
});

api.gridlyInstallRoadwayRuntimeManifest(manifest);
assert.strictEqual(api.gridlyGetCountyRuntimeSources('liberty-tx').roadSource, 'data/liberty-county-road-segments.geojson');
assert.strictEqual(api.gridlyGetCountyRuntimeSources('montgomery-tx').roadSource, 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-raw.geojson');
assert.strictEqual(api.gridlyGetCountyRuntimeSources('san-jacinto-tx').roadSource, 'assets/county-implementation/san-jacinto/runtime-assets/source/san-jacinto-county-road-segments.geojson');
assert.strictEqual(api.gridlyResolveRoadwayRuntimeSource('polk-tx').url, null, 'pending entries cannot resolve a fetch URL');
assert.strictEqual(api.gridlyResolveRoadwayRuntimeSource('harris-tx').url, null, 'blocked Harris cannot resolve a fetch URL');
assert.strictEqual(api.gridlyResolveRoadwayRuntimeSource('liberty-tx').cacheKey, 'liberty-tx::legacy::data/liberty-county-road-segments.geojson');

assert.ok(appSource.includes('gridlyRoadwayPackageRuntimeState.currentLoadPromise'), 'duplicate simultaneous load promise is tracked');
assert.ok(appSource.includes('duplicateLoadDetected = true'), 'duplicate loads are detected');
assert.ok(appSource.includes('roadwaySegmentFeatures = [];\n      roadwayDatasetLoaded = false;'), 'failed loads clear stale prior-county geometry');
assert.ok(appSource.includes('gridlyResolveRoadwayRuntimeSource()'), 'loader resolves one active county source');
assert.ok(!/Object\.values\([^)]*counties[^)]*\).*fetch/s.test(appSource), 'no all-county package preload loop found');
assert.ok(!/function\s+render[\s\S]{0,500}fetch\([^)]*road/i.test(appSource), 'renderers do not fetch roadway packages');
const lp023Index = appSource.indexOf('function gridlyLp023');
const lp028Index = appSource.indexOf('function gridlyLp028RegionalRoadwayRuntimeAudit');
assert.ok(lp023Index >= 0 && !appSource.slice(lp023Index, lp023Index + 5000).includes('fetch('), 'LP023 audit area does not fetch roadway packages');
assert.ok(lp028Index >= 0 && !appSource.slice(lp028Index, lp028Index + 3500).includes('fetch('), 'LP028 audit does not fetch roadway packages');
assert.ok(!swSource.includes('roadway-runtime-manifest.json'), 'service worker does not precache roadway manifest');
assert.ok(!/road-segments.*geojson/i.test(swSource), 'service worker does not precache roadway packages');

console.log('LP028.4 external roadway asset contract static tests passed');
