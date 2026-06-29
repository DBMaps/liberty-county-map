import fs from 'node:fs';

const boundaryPath = 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-boundary.geojson';
const statewidePath = 'assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson';
const appPath = 'js/app.js';

function readJson(path) { return JSON.parse(fs.readFileSync(path, 'utf8')); }
function countCoordinates(geojson) {
  let count = 0;
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') { count += 1; return; }
    value.forEach(walk);
  };
  (geojson.features || []).forEach((feature) => walk(feature.geometry?.coordinates));
  return count;
}
function bbox(geojson) {
  const coords = [];
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (value.length >= 2 && typeof value[0] === 'number' && typeof value[1] === 'number') { coords.push(value); return; }
    value.forEach(walk);
  };
  (geojson.features || []).forEach((feature) => walk(feature.geometry?.coordinates));
  return {
    west: Math.min(...coords.map(([lng]) => lng)),
    east: Math.max(...coords.map(([lng]) => lng)),
    south: Math.min(...coords.map(([, lat]) => lat)),
    north: Math.max(...coords.map(([, lat]) => lat))
  };
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const boundary = readJson(boundaryPath);
const feature = boundary.features?.[0];
const properties = feature?.properties || {};
const box = bbox(boundary);
const coordinateCount = countCoordinates(boundary);
assert(boundary.type === 'FeatureCollection', 'Jefferson boundary must be a FeatureCollection.');
assert(boundary.features?.length === 1, 'Jefferson boundary must contain exactly one feature.');
assert(properties.GEOID === '48245' || properties.geoid === '48245', 'Jefferson boundary must identify GEOID 48245.');
assert(/Jefferson/i.test(properties.NAME || properties.name || properties.NAMELSAD || ''), 'Jefferson boundary must identify Jefferson County.');
assert(properties.sourceDataset === 'tl_2025_us_county', 'Jefferson boundary must document tl_2025_us_county lineage.');
assert(properties.bboxFallbackUsed === false, 'Jefferson boundary must not be bbox fallback geometry.');
assert(coordinateCount > 250, 'Jefferson boundary coordinate density must be non-placeholder.');
assert(box.west < -93.8 && box.west > -94.8 && box.east > -94.2 && box.east < -93.7 && box.south > 29.4 && box.south < 29.8 && box.north > 30.2 && box.north < 30.5, 'Jefferson boundary bbox must be plausible for Beaumont / Port Arthur / Nederland / Port Neches.');

const statewide = readJson(statewidePath);
const statewideJefferson = statewide.features.find((candidate) => candidate.properties?.GEOID === '48245' || candidate.properties?.geoid === '48245' || candidate.properties?.name === 'County 48245');
assert(statewideJefferson, 'Statewide asset must still contain a Jefferson placeholder feature for GEOID/geoid 48245.');
assert(countCoordinates({ type: 'FeatureCollection', features: [statewideJefferson] }) <= 5, 'Statewide Jefferson feature must be reverted away from V799 hand-edited geometry.');

const app = fs.readFileSync(appPath, 'utf8');
assert(app.includes(`boundaryPath: "${boundaryPath}"`), 'Runtime registry must point Jefferson at the county-specific boundary asset.');
assert(app.includes('activeBoundarySource: activeCountyId === "jefferson-tx" && activeBoundaryUsesCountySpecificPayload ? "Jefferson county-specific asset"'), 'Audit must report Jefferson county-specific asset as activeBoundarySource.');
assert(app.includes('activeBoundaryUsesCountySpecificPayload'), 'Audit must retain county-specific payload detection.');

const auditExpectation = {
  activeCountyId: 'jefferson-tx',
  activeCountyGeoid: '48245',
  activeBoundarySource: 'Jefferson county-specific asset',
  usesCountySpecificPayload: true,
  bboxFallbackUsed: false,
  activeBoundaryLayerCount: 1,
  passiveCountyBoundaryRendered: 0,
  visualCorrectnessPass: true
};
console.log(JSON.stringify({ ok: true, boundaryPath, coordinateCount, bbox: box, auditExpectation }, null, 2));
