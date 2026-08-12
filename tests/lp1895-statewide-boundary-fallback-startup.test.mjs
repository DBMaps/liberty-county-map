import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { run } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const geometryPackage = JSON.parse(fs.readFileSync(new URL('../assets/location-resolution/gridly-authoritative-county-geometry-v1.json', import.meta.url)));
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json', import.meta.url)));
const loaderSource = appSource.slice(appSource.indexOf('async function loadGridlyCountyBoundaryOverlay()'), appSource.indexOf('\nfunction gridlyGetStaleRuntimeBoundaryAssetPaths'));

async function runOverlay({ activeCountyId, pkg = geometryPackage, boundaryPath = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json', fallbackPayload = null }) {
  const warnings = [];
  const fetches = [];
  let packageLoads = 0;
  const registry = Object.fromEntries(pkg.counties.map((county) => [county.countyId, { name: county.countyId }]));
  registry[activeCountyId] ||= { name: activeCountyId };
  const sandbox = {
    window: { gridlyLp0361cRuntimeCountyGeometryPackageLoader: { load: async () => { packageLoads += 1; return pkg; } } },
    console: { warn: (...args) => warnings.push(args) },
    fetch: async (path) => { fetches.push(path); return { ok: true, json: async () => fallbackPayload }; },
    GRIDLY_COUNTY_REGISTRY: registry,
    GRIDLY_AUTHORITATIVE_PRODUCTION_COUNTY_GEOMETRY_PATH: 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
    GRIDLY_ACTIVE_COUNTY_BOUNDARY_PAYLOAD_SCOPE: 'county_specific_runtime_geojson',
    gridlyCountyBoundaryOverlayGeoJsonById: {},
    gridlyCountyBoundaryOverlaySourceMetadataById: {},
    gridlyCountyBoundaryGeoJson: null,
    getGridlyCountyBoundaryOverlaySupportedCountyIds: () => Object.keys(registry),
    gridlyGetActiveCountyId: () => activeCountyId,
    gridlyGetCountyRuntimeSources: () => ({ boundarySource: boundaryPath }),
    getGridlyCountyBoundaryOverlayCountyGeoid: (countyId) => pkg.counties.find((county) => county.countyId === countyId)?.countyFips || '48999',
    getGridlyCountyBoundaryOverlayFeatureGeoid: (feature) => String(feature?.properties?.geoid || ''),
    renderGridlyCountyBoundaryOverlay: () => null,
    Set, String, Array, Object
  };
  vm.createContext(sandbox);
  vm.runInContext(`${loaderSource}\nthis.loadOverlay = loadGridlyCountyBoundaryOverlay;`, sandbox);
  await sandbox.loadOverlay();
  return { warnings, fetches, packageLoads, overlays: sandbox.gridlyCountyBoundaryOverlayGeoJsonById, metadata: sandbox.gridlyCountyBoundaryOverlaySourceMetadataById };
}

test('promoted and existing counties use the one authoritative package without fallback work or warnings', async () => {
  let warningCountAfter = 0;
  for (const countyId of ['parker-tx', 'liberty-tx']) {
    const result = await runOverlay({ activeCountyId: countyId });
    assert.equal(result.packageLoads, 1, `${countyId} did not use exactly one shared package load`);
    assert.equal(result.fetches.length, 0, `${countyId} launched county fallback work`);
    assert.equal(result.warnings.length, 0, `${countyId} emitted a county fallback warning`);
    warningCountAfter += result.warnings.length;
    assert.equal(result.overlays[countyId].features[0].properties.countyId, countyId);
    assert.equal(result.metadata[countyId].sourceType, 'authoritative_production_package');
  }
  const warningCountBefore = ['parker-tx', 'liberty-tx'].filter(() => !Array.isArray(geometryPackage.features)).length;
  assert.equal(warningCountBefore, 2, 'legacy per-county filtering would warn once for each targeted package request');
  assert.equal(warningCountAfter, 0, 'repaired targeted startup warning count');
});

test('a genuinely absent active county alone follows the existing fail-closed county fallback', async () => {
  const missingPackage = structuredClone(geometryPackage);
  missingPackage.counties = missingPackage.counties.filter((county) => county.countyId !== 'parker-tx');
  const result = await runOverlay({ activeCountyId: 'parker-tx', pkg: missingPackage, boundaryPath: 'counties/parker-boundary.geojson', fallbackPayload: { type: 'FeatureCollection', features: [] } });
  assert.deepEqual(result.fetches, ['counties/parker-boundary.geojson']);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0][0], /County-specific boundary fallback failed for parker-tx/);
  assert.equal(result.overlays['parker-tx'], undefined);
});

test('LP189 membership and authoritative resolver contracts remain unchanged', () => {
  const verification = run('verify');
  assert.equal(verification.operationalUniqueFips, 243);
  assert.equal(verification.restrictedExcluded, true);
  assert.equal(geometryPackage.counties.some((county) => county.countyId === 'dallas-tx' || county.countyFips === '48113'), false);
  assert.equal(geometryPackage.counties.length, 243);
  assert.equal(manifest.packagedCountyCount, 243);
  assert.equal(manifest.packageSha256.length, 64);
  assert.match(appSource, /const boundsMatches[\s\S]*getCandidateGeometries\(boundsMatches\.map/);
  assert.match(appSource, /const selected = polygonMatches\.length === 1/);
});
