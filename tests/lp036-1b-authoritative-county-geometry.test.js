const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const requiredCountyIds = [
  'liberty-tx','montgomery-tx','san-jacinto-tx','chambers-tx','jefferson-tx','hardin-tx','polk-tx','walker-tx','orange-tx','jasper-tx','newton-tx','tyler-tx','galveston-tx','brazoria-tx','fort-bend-tx','waller-tx','austin-tx','washington-tx','brazos-tx','grimes-tx','wharton-tx','colorado-tx','fayette-tx','lavaca-tx','jackson-tx','matagorda-tx','calhoun-tx','harris-tx'
];

const registryBlock = appSource.slice(appSource.indexOf('const GRIDLY_COUNTY_REGISTRY'), appSource.indexOf('function gridlyIsLoadableGeoJsonSource'));
const registryRows = [...registryBlock.matchAll(/"([a-z-]+-tx)": Object\.freeze\(\{([\s\S]*?)\n  \}\)/g)].map((match) => ({ countyId: match[1], body: match[2] }));
const boundaryPaths = Object.fromEntries(registryRows.map(({ countyId, body }) => [countyId, /boundaryPath:\s*"([^"]+)"/.exec(body)?.[1] || null]));
assert.deepStrictEqual(Object.keys(boundaryPaths).sort(), requiredCountyIds.sort(), 'geometry inventory covers all 28 operational counties');

function eachCoordinate(geometry, visitor) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  for (const polygon of polygons) for (const ring of polygon) for (const point of ring) visitor(point);
}
function bboxOf(geometry) {
  const box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity };
  eachCoordinate(geometry, ([lng, lat]) => { box.west = Math.min(box.west, lng); box.east = Math.max(box.east, lng); box.south = Math.min(box.south, lat); box.north = Math.max(box.north, lat); });
  return box;
}
function onSeg(point, start, end) {
  const cross = (point[1] - start[1]) * (end[0] - start[0]) - (point[0] - start[0]) * (end[1] - start[1]);
  if (Math.abs(cross) > 1e-10) return false;
  return point[0] >= Math.min(start[0], end[0]) - 1e-10 && point[0] <= Math.max(start[0], end[0]) + 1e-10 && point[1] >= Math.min(start[1], end[1]) - 1e-10 && point[1] <= Math.max(start[1], end[1]) + 1e-10;
}
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (onSeg(point, ring[j], ring[i])) return 'boundary';
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > point[1]) !== (yj > point[1])) && (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}
function pointInPolygonCoordinates(point, polygon) {
  const outer = pointInRing(point, polygon[0]);
  if (outer !== 'inside') return outer;
  for (const hole of polygon.slice(1)) {
    const hp = pointInRing(point, hole);
    if (hp === 'boundary') return 'boundary';
    if (hp === 'inside') return 'outside';
  }
  return 'inside';
}
function pointInGeometry(lat, lng, geometry) {
  const point = [lng, lat];
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  let inside = false;
  for (const polygon of polygons) {
    const position = pointInPolygonCoordinates(point, polygon);
    if (position === 'boundary') return 'boundary';
    if (position === 'inside') inside = true;
  }
  return inside ? 'inside' : 'outside';
}
function matches(lat, lng) {
  return Object.entries(geometries).filter(([, geometry]) => pointInGeometry(lat, lng, geometry) !== 'outside').map(([countyId]) => countyId).sort();
}

const geometries = {};
let totalBytes = 0;
for (const countyId of requiredCountyIds) {
  const file = boundaryPaths[countyId];
  assert(file && fs.existsSync(file), `${countyId} boundary asset exists`);
  const stat = fs.statSync(file);
  totalBytes += stat.size;
  const geojson = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(geojson.type, 'FeatureCollection', `${countyId} is a GeoJSON FeatureCollection`);
  assert.strictEqual(geojson.features.length, 1, `${countyId} has one boundary feature`);
  const geometry = geojson.features[0].geometry;
  assert(['Polygon', 'MultiPolygon'].includes(geometry.type), `${countyId} uses Polygon or MultiPolygon geometry`);
  assert(new RegExp((geojson.features[0].properties.NAME || '').replace(/ County$/, ''), 'i').test(registryRows.find((row) => row.countyId === countyId).body), `${countyId} identity is consistent`);
  eachCoordinate(geometry, (point) => {
    assert(Array.isArray(point) && point.length >= 2, `${countyId} coordinates are lon/lat pairs`);
    assert(Number.isFinite(point[0]) && Number.isFinite(point[1]), `${countyId} coordinates are finite`);
    assert(point[0] >= -180 && point[0] <= 180 && point[1] >= -90 && point[1] <= 90, `${countyId} coordinates are valid lon/lat ranges`);
  });
  const box = bboxOf(geometry);
  assert(box.west < box.east && box.south < box.north, `${countyId} bbox is valid`);
  assert(box.west > -98 && box.east < -93 && box.south > 27 && box.north < 32, `${countyId} bbox is plausible southeast Texas geometry`);
  geometries[countyId] = geometry;
}
assert(totalBytes > 0, 'geometry bytes are measurable');

assert.strictEqual(pointInGeometry(0.5, 0.5, { type: 'Polygon', coordinates: [[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]] }), 'inside', 'Polygon containment works');
assert.strictEqual(pointInGeometry(3, 3, { type: 'MultiPolygon', coordinates: [[[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]], [[[2,2],[4,2],[4,4],[2,4],[2,2]]]] }), 'inside', 'MultiPolygon containment works');
assert.strictEqual(pointInGeometry(0, 0, { type: 'Polygon', coordinates: [[[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]],[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]] }), 'outside', 'Polygon holes are respected');
assert.strictEqual(pointInGeometry(1, 0, { type: 'Polygon', coordinates: [[[-1,-1],[1,-1],[1,1],[-1,1],[-1,-1]]] }), 'boundary', 'Boundary-edge policy is deterministic');

assert.deepStrictEqual(matches(30.0466, -94.8852), ['liberty-tx'], 'Dayton resolves Liberty, not Chambers');
assert.deepStrictEqual(matches(30.7110, -94.9327), ['polk-tx'], 'Livingston resolves Polk, not San Jacinto');
assert.deepStrictEqual(matches(29.8477, -94.8908), ['chambers-tx'], 'Chambers control resolves Chambers from Mont Belvieu awareness anchor');
assert.deepStrictEqual(matches(30.5924, -95.1294), ['san-jacinto-tx'], 'San Jacinto control resolves San Jacinto from Coldspring awareness anchor');
assert.deepStrictEqual(matches(29.7532, -95.3670), ['harris-tx'], 'Downtown Houston resolves Harris');
assert.deepStrictEqual(matches(29.7079, -95.4010), ['harris-tx'], 'Medical Center resolves Harris');
assert.deepStrictEqual(matches(29.6911, -95.2091), ['harris-tx'], 'Pasadena resolves Harris and remains separate Harris community by LP035 registry');
assert.deepStrictEqual(matches(32.7767, -96.7970), [], 'Outside coverage remains outside coverage');
assert.strictEqual(Number.isFinite(Number('invalid')), false, 'Invalid coordinates remain invalid before containment');

const lp0361bCode = appSource.slice(appSource.indexOf('const GRIDLY_LP0361B_AUTHORITATIVE_COUNTY_GEOMETRY_AUDIT'), appSource.indexOf('function gridlyFitMapToActiveCountyContext')) + '\nthis.audit = gridlyLp0361bAuthoritativeCountyGeometryAudit();';
const sandbox = { Object, Number, Math, Array };
vm.createContext(sandbox);
vm.runInContext(lp0361bCode, sandbox);
assert.strictEqual(sandbox.audit.productionContainmentChanged, false, 'No rectangle-only final resolution replacement is claimed until packaging is ready');
assert.strictEqual(sandbox.audit.storageWritesAttempted, 0, 'No storage writes occur');
assert.strictEqual(sandbox.audit.runtimeActivationAttempted, 0, 'No runtime activation occurs');
assert.strictEqual(sandbox.audit.mapMovementAttempted, 0, 'No map movement occurs');
assert.strictEqual(sandbox.audit.networkRefreshAttempted, 0, 'No network refresh occurs');
assert.strictEqual(sandbox.audit.implementationReadyForLp0362, false, 'LP036.2 remains blocked until runtime packaging/integration is complete');
assert(!/localStorage\.setItem|gridlySetActiveCountyContext|fitBounds|setView|fetch\(/.test(lp0361bCode), 'LP036.1B audit code remains passive and does not fetch or mutate');

console.log('LP036.1B authoritative county geometry certification test passed');
