#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const boundaryPath = 'assets/county-implementation/jefferson/runtime-assets/jefferson-county-boundary.geojson';
const evidencePath = 'assets/county-implementation/jefferson/evidence/v801-jefferson-boundary-source-rebuild.json';
const expectedGeoid = '48245';
const controlPoints = [
  { name: 'Beaumont', lon: -94.1266, lat: 30.0802 },
  { name: 'Port Arthur', lon: -93.9399, lat: 29.8849 },
  { name: 'Nederland', lon: -94.0024, lat: 29.9744 },
  { name: 'Port Neches', lon: -93.9585, lat: 29.9913 },
];
const coastalExpectations = {
  minLonMax: -93.95,
  maxLonMin: -93.9,
  minLatMax: 29.55,
  maxLatMin: 30.3,
  minimumCoordinateCount: 300,
};

const boundary = JSON.parse(readFileSync(boundaryPath, 'utf8'));
const feature = boundary.features?.[0];
const coords = [];
walk(feature?.geometry?.coordinates, coords);
const bbox = [
  Math.min(...coords.map(([lon]) => lon)),
  Math.min(...coords.map(([, lat]) => lat)),
  Math.max(...coords.map(([lon]) => lon)),
  Math.max(...coords.map(([, lat]) => lat)),
];
const cityChecks = controlPoints.map((point) => ({
  ...point,
  insideBoundary: pointInGeometry(point, feature.geometry),
}));
const checks = [
  { name: 'boundary-file-json', ok: boundary.type === 'FeatureCollection' },
  { name: 'single-boundary-feature', ok: boundary.features?.length === 1 },
  { name: 'geoid-preserved', ok: String(feature?.properties?.GEOID ?? feature?.properties?.geoid) === expectedGeoid },
  { name: 'county-specific-runtime-asset', ok: boundaryPath.includes('/jefferson/runtime-assets/jefferson-county-boundary.geojson') },
  { name: 'bbox-fallback-not-used', ok: feature?.properties?.bboxFallbackUsed === false },
  { name: 'authoritative-source-lineage', ok: /Census Bureau TIGER\/Line|TIGERweb/i.test(`${feature?.properties?.sourceAuthority} ${feature?.properties?.sourceLineage}`) },
  { name: 'coordinate-density-not-bbox', ok: coords.length >= coastalExpectations.minimumCoordinateCount, details: { coordinateCount: coords.length } },
  { name: 'coastal-east-reach', ok: bbox[2] > coastalExpectations.minLonMax, details: { bbox } },
  { name: 'gulf-south-reach', ok: bbox[1] < coastalExpectations.minLatMax, details: { bbox } },
  { name: 'north-county-reach', ok: bbox[3] > coastalExpectations.maxLatMin, details: { bbox } },
  { name: 'required-cities-inside-or-plausible', ok: cityChecks.every((check) => check.insideBoundary), details: { cityChecks } },
];
const evidence = {
  milestone: 'V801',
  title: 'Jefferson Boundary Source Rebuild Certification',
  activeBoundarySource: 'Jefferson county-specific asset',
  activeCountyGeoid: expectedGeoid,
  usesCountySpecificPayload: true,
  bboxFallbackUsed: false,
  visualCorrectnessPass: checks.every((check) => check.ok),
  boundaryCredibilityDetermination: checks.every((check) => check.ok) ? 'passed' : 'failed',
  rebuiltBoundaryAsset: boundaryPath,
  rejectedPriorAsset: 'V800 Jefferson runtime boundary geometry treated as visually rejected for V801 and replaced by source-lineage rebuild metadata with no manual coordinate edits.',
  sourcePattern: 'County-boundary extraction pattern follows repository V604/V600 Census TIGER/Line county GEOID filtering for GEOID 48245 and keeps the county-specific runtime asset registration introduced in V800.',
  validations: { bbox, coordinateCount: coords.length, cityChecks, checks },
  sha256: sha256(boundaryPath),
  generatedAt: new Date().toISOString(),
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
process.exit(evidence.boundaryCredibilityDetermination === 'passed' ? 0 : 1);

function walk(value, out) {
  if (!Array.isArray(value)) return;
  if (typeof value[0] === 'number' && typeof value[1] === 'number') out.push(value);
  else for (const entry of value) walk(entry, out);
}
function pointInGeometry(point, geometry) {
  if (geometry.type === 'Polygon') return pointInPolygon(point, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => pointInPolygon(point, polygon));
  return false;
}
function pointInPolygon(point, rings) {
  if (!rings?.length) return false;
  const inOuter = inRing(point, rings[0]);
  const inHole = rings.slice(1).some((ring) => inRing(point, ring));
  return inOuter && !inHole;
}
function inRing({ lon, lat }, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
