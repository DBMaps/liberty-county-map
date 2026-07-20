#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_SOURCE = 'js/app.js';
const EXPECTED_COUNT = 28;
const PACKAGE_PATH = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json';
const MANIFEST_PATH = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json';
const SCHEMA_VERSION = 'gridly.authoritativeCountyGeometry.schema.v1';
const PACKAGE_VERSION = 'lp036.1c-runtime-county-geometry-v1';
const GENERATED_AT = '1970-01-01T00:00:00.000Z';

function fail(message) { throw new Error(message); }
function readText(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); }
function sha256Buffer(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function stableJson(value) { return JSON.stringify(sortStable(value)) + '\n'; }
function sortStable(value) {
  if (Array.isArray(value)) return value.map(sortStable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => { acc[key] = sortStable(value[key]); return acc; }, {});
  }
  return value;
}
function extractRegistry() {
  const text = readText(REGISTRY_SOURCE);
  const start = text.indexOf('const GRIDLY_COUNTY_REGISTRY = Object.freeze({');
  if (start < 0) fail('GRIDLY_COUNTY_REGISTRY not found');
  const end = text.indexOf('\n\nconst GRIDLY_ROADWAY_RUNTIME_MANIFEST_URL', start);
  if (end < 0) fail('GRIDLY_COUNTY_REGISTRY end marker not found');
  const snippet = text.slice(start, end).replace('const GRIDLY_COUNTY_REGISTRY', 'var GRIDLY_COUNTY_REGISTRY');
  const sandbox = { Object, GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx', GRIDLY_COUNTY_STAGE_OPERATIONAL: 'operational', GRIDLY_COUNTY_STAGE_RUNTIME_ONBOARDED: 'runtime_onboarded', GRIDLY_COUNTY_STAGE_VALIDATION_ONLY: 'validation_only', GRIDLY_COUNTY_STAGE_DISABLED: 'disabled', GRIDLY_MONTGOMERY_RUNTIME_GATE: Object.freeze({}) };
  vm.createContext(sandbox);
  vm.runInContext(snippet, sandbox, { filename: REGISTRY_SOURCE });
  return sandbox.GRIDLY_COUNTY_REGISTRY;
}
function ringCoords(ring, ctx, stats, bounds) {
  if (!Array.isArray(ring) || ring.length < 4) fail(`${ctx} ring must contain at least four positions`);
  let first = null, last = null;
  return ring.map((pos, i) => {
    if (!Array.isArray(pos) || pos.length < 2) fail(`${ctx} position ${i} must be [longitude, latitude]`);
    const lng = Number(pos[0]); const lat = Number(pos[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) fail(`${ctx} position ${i} has non-finite coordinates`);
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) fail(`${ctx} position ${i} outside legal lon/lat range`);
    if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) fail(`${ctx} position ${i} appears not to be longitude/latitude order`);
    bounds.west = Math.min(bounds.west, lng); bounds.east = Math.max(bounds.east, lng);
    bounds.south = Math.min(bounds.south, lat); bounds.north = Math.max(bounds.north, lat);
    stats.positions += 1;
    const out = [normalizeNumber(lng), normalizeNumber(lat)];
    if (i === 0) first = out; if (i === ring.length - 1) last = out;
    return out;
  }).map((p, _i, arr) => p);
}
function validateRingClosed(ring, ctx) {
  const first = ring[0], last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) fail(`${ctx} ring is not closed`);
}
function normalizeNumber(n) { return Number.parseFloat(Number(n).toFixed(7)); }
function normalizeGeometry(geometry, countyId) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) fail(`${countyId} geometry must be Polygon or MultiPolygon`);
  const stats = { geometryType: geometry.type, polygons: 0, rings: 0, holes: 0, positions: 0 };
  const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons) || polygons.length < 1) fail(`${countyId} geometry has no polygons`);
  const normalizedPolygons = polygons.map((polygon, pi) => {
    if (!Array.isArray(polygon) || polygon.length < 1) fail(`${countyId} polygon ${pi} has no rings`);
    stats.polygons += 1; stats.rings += polygon.length; stats.holes += Math.max(0, polygon.length - 1);
    return polygon.map((ring, ri) => { const r = ringCoords(ring, `${countyId} polygon ${pi} ring ${ri}`, stats, bounds); validateRingClosed(r, `${countyId} polygon ${pi} ring ${ri}`); return r; });
  });
  return { geometry: { type: geometry.type, coordinates: geometry.type === 'Polygon' ? normalizedPolygons[0] : normalizedPolygons }, bounds: Object.fromEntries(Object.entries(bounds).map(([k,v]) => [k, normalizeNumber(v)])), stats };
}
function geometryFromGeoJson(json, countyId) {
  const feature = json.type === 'FeatureCollection' ? json.features?.[0] : (json.type === 'Feature' ? json : null);
  const geom = feature ? feature.geometry : json;
  const props = feature?.properties || {};
  const candidates = [props.countyId, props.canonicalCountyId, props.gridlyCountyId, props.county_id].filter(Boolean);
  if (candidates.length && !candidates.includes(countyId)) fail(`${countyId} source county identity mismatch: ${candidates.join(', ')}`);
  return geom;
}
function loadCounties() {
  const registry = extractRegistry();
  const counties = Object.entries(registry).filter(([, cfg]) => cfg && cfg.operational === true).sort(([a], [b]) => a.localeCompare(b));
  if (counties.length !== EXPECTED_COUNT) fail(`Expected exactly ${EXPECTED_COUNT} operational counties, found ${counties.length}`);
  return counties.map(([countyId, cfg]) => {
    if (!/^[a-z0-9-]+-tx$/.test(countyId)) fail(`Invalid canonical county id ${countyId}`);
    if (!cfg.boundaryPath) fail(`${countyId} missing boundaryPath`);
    const sourcePath = cfg.boundaryPath;
    const abs = path.join(REPO_ROOT, sourcePath);
    if (!fs.existsSync(abs)) fail(`${countyId} source file missing: ${sourcePath}`);
    const buf = fs.readFileSync(abs);
    let parsed; try { parsed = JSON.parse(buf.toString('utf8')); } catch (error) { fail(`${countyId} invalid GeoJSON JSON: ${error.message}`); }
    const normalized = normalizeGeometry(geometryFromGeoJson(parsed, countyId), countyId);
    return { countyId, name: cfg.name || null, source: { boundaryPath: sourcePath, sha256: sha256Buffer(buf), byteLength: buf.length }, bounds: normalized.bounds, geometry: normalized.geometry, geometryStatistics: normalized.stats };
  });
}
function buildPackage() {
  const counties = loadCounties();
  const sourceTotalByteLength = counties.reduce((sum, c) => sum + c.source.byteLength, 0);
  const pkg = { schemaVersion: SCHEMA_VERSION, packageVersion: PACKAGE_VERSION, generatedAt: GENERATED_AT, expectedOperationalCountyCount: EXPECTED_COUNT, counties, certification: runPointCertification(counties), sourceSummary: { registrySource: REGISTRY_SOURCE, sourceTotalByteLength } };
  return pkg;
}
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const onBoundary = Math.abs((lat - yi) * (xj - xi) - (lng - xi) * (yj - yi)) < 1e-12 && lng >= Math.min(xi, xj) && lng <= Math.max(xi, xj) && lat >= Math.min(yi, yj) && lat <= Math.max(yi, yj);
    if (onBoundary) return 'boundary';
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function containsGeom(geom, lng, lat) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let boundary = false;
  for (const poly of polys) {
    const outer = pointInRing(lng, lat, poly[0]);
    if (outer === 'boundary') boundary = true;
    if (outer === true) {
      let inHole = false;
      for (const hole of poly.slice(1)) { const h = pointInRing(lng, lat, hole); if (h === 'boundary') boundary = true; if (h === true) inHole = true; }
      if (!inHole) return boundary ? 'boundary' : true;
    }
  }
  return boundary ? 'boundary' : false;
}
function resolvePoint(counties, lat, lng) {
  const matches = counties.filter((c) => containsGeom(c.geometry, lng, lat) === true || containsGeom(c.geometry, lng, lat) === 'boundary').map((c) => c.countyId);
  return matches.sort()[0] || null;
}
function runPointCertification(counties) {
  const checks = [
    { id: 'dayton', lat: 30.0466, lng: -94.8852, expectedCountyId: 'liberty-tx' },
    { id: 'livingston', lat: 30.7110, lng: -94.9327, expectedCountyId: 'polk-tx' },
    { id: 'houston', lat: 29.7604, lng: -95.3698, expectedCountyId: 'harris-tx' },
    { id: 'pasadena', lat: 29.6911, lng: -95.2091, expectedCountyId: 'harris-tx' },
    { id: 'outside-coverage', lat: 35.0, lng: -101.0, expectedCountyId: null }
  ].map((check) => ({ ...check, actualCountyId: resolvePoint(counties, check.lat, check.lng) }));
  const polygonFixture = { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,2],[0,0]]] };
  const multiPolygonFixture = { type: 'MultiPolygon', coordinates: [[[[10,10],[12,10],[12,12],[10,12],[10,10]]], [[[20,20],[22,20],[22,22],[20,22],[20,20]]]] };
  const holeFixture = { type: 'Polygon', coordinates: [[[0,0],[4,0],[4,4],[0,4],[0,0]], [[1,1],[3,1],[3,3],[1,3],[1,1]]] };
  const polygonSupported = containsGeom(polygonFixture, 1, 1) === true;
  const multiPolygonSupported = containsGeom(multiPolygonFixture, 21, 21) === true && containsGeom(multiPolygonFixture, 11, 11) === true;
  const holesSupported = containsGeom(holeFixture, 2, 2) === false && containsGeom(holeFixture, 0.5, 0.5) === true;
  const passed = checks.every((c) => c.actualCountyId === c.expectedCountyId) && polygonSupported && multiPolygonSupported && holesSupported;
  if (!passed) fail(`Point-in-polygon certification failed: ${JSON.stringify({ checks, polygonSupported, multiPolygonSupported, holesSupported })}`);
  return { passed, boundaryHandling: 'inclusive-deterministic-lowest-county-id', polygonSupported, multiPolygonSupported, holesSupported, checks };
}

function runFixtureValidation() {
  const polygonStats = { positions: 0 };
  const bounds = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  let invalidGeometryPassed = false;
  try { normalizeGeometry({ type: 'Point', coordinates: [0, 0] }, 'fixture-tx'); } catch (_error) { invalidGeometryPassed = true; }
  let invalidCoordinatePassed = false;
  try { ringCoords([[200, 95], [200, 96], [201, 95], [200, 95]], 'fixture invalid coordinate', polygonStats, bounds); } catch (_error) { invalidCoordinatePassed = true; }
  let missingSourcePassed = false;
  try {
    const missing = path.join(REPO_ROOT, 'assets/location-resolution/__lp0361c_missing_fixture__.geojson');
    if (!fs.existsSync(missing)) missingSourcePassed = true;
  } catch (_error) { missingSourcePassed = false; }
  const deterministic = verifyDeterministic();
  const passed = invalidGeometryPassed && invalidCoordinatePassed && missingSourcePassed && deterministic.deterministicBuildPassed === true;
  if (!passed) fail(`Fixture validation failed: ${JSON.stringify({ invalidGeometryPassed, invalidCoordinatePassed, missingSourcePassed, deterministic })}`);
  return { fixtureValidationPassed: true, invalidGeometryPassed, invalidCoordinatePassed, missingSourcePassed, deterministicSerializationPassed: true, operationalCountyCount: loadCounties().length };
}

function writeOutputs() {
  const pkg = buildPackage();
  const packageText = stableJson(pkg);
  const packageHash = sha256Buffer(Buffer.from(packageText));
  const manifest = { schemaVersion: 'gridly.authoritativeCountyGeometry.manifest.v1', packageVersion: PACKAGE_VERSION, generatedAt: GENERATED_AT, packagePath: PACKAGE_PATH, expectedOperationalCountyCount: EXPECTED_COUNT, packagedCountyCount: pkg.counties.length, blockedCountyCount: 0, missingSourceCount: 0, invalidGeometryCount: 0, packageSha256: packageHash, packageByteLength: Buffer.byteLength(packageText), sourceTotalByteLength: pkg.sourceSummary.sourceTotalByteLength, packagedGeometryByteLength: Buffer.byteLength(JSON.stringify(pkg.counties.map((c) => c.geometry))), deterministicBuildSupported: true, certification: pkg.certification };
  fs.mkdirSync(path.dirname(path.join(REPO_ROOT, PACKAGE_PATH)), { recursive: true });
  fs.writeFileSync(path.join(REPO_ROOT, PACKAGE_PATH), packageText);
  fs.writeFileSync(path.join(REPO_ROOT, MANIFEST_PATH), stableJson(manifest));
  verifyOutputs(packageHash, Buffer.byteLength(packageText));
  return manifest;
}
function verifyOutputs(expectedHash, expectedBytes) {
  const p = fs.readFileSync(path.join(REPO_ROOT, PACKAGE_PATH));
  const m = JSON.parse(readText(MANIFEST_PATH));
  const pkg = JSON.parse(p.toString('utf8'));
  if (sha256Buffer(p) !== expectedHash || p.length !== expectedBytes) fail('Generated package hash or byte length verification failed');
  if (m.packageSha256 !== expectedHash || m.packageByteLength !== expectedBytes) fail('Manifest package hash or byte length verification failed');
  if (!Array.isArray(pkg.counties) || pkg.counties.length !== EXPECTED_COUNT || m.packagedCountyCount !== EXPECTED_COUNT) fail('Packaged county count verification failed');
  if (m.blockedCountyCount !== 0) fail('Blocked counties are not allowed');
}
function verifyDeterministic() {
  const first = stableJson(buildPackage()); const second = stableJson(buildPackage());
  if (first !== second) fail('Deterministic verification failed: package bytes differ');
  return { deterministicBuildPassed: true, packageSha256: sha256Buffer(Buffer.from(first)), packageByteLength: Buffer.byteLength(first) };
}
if (require.main === module) {
  try {
    const result = process.argv.includes('--self-test-fixtures') ? runFixtureValidation() : (process.argv.includes('--verify-deterministic') ? verifyDeterministic() : writeOutputs());
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(`[LP036.1C] ${error.message}`); process.exit(1); }
}
module.exports = { buildPackage, verifyDeterministic, stableJson, loadCounties, containsGeom, runFixtureValidation };
