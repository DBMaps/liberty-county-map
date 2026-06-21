#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boundaryPath = 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson';
const validationPath = 'assets/county-implementation/san-jacinto/validation/san-jacinto-authoritative-boundary-extraction-v653.json';
const app = readFileSync('js/app.js', 'utf8');
const boundary = JSON.parse(readFileSync(boundaryPath, 'utf8'));
const validation = JSON.parse(readFileSync(validationPath, 'utf8'));

function flattenCoordinates(value, out = []) {
  if (!Array.isArray(value)) return out;
  if (value.length >= 2 && value.slice(0, 2).every((item) => Number.isFinite(Number(item)))) out.push(value);
  else value.forEach((item) => flattenCoordinates(item, out));
  return out;
}

const feature = boundary.features?.[0];
const properties = feature?.properties || {};
const coordinates = flattenCoordinates(feature?.geometry?.coordinates);
const bbox = [
  Math.min(...coordinates.map((coordinate) => coordinate[0])),
  Math.min(...coordinates.map((coordinate) => coordinate[1])),
  Math.max(...coordinates.map((coordinate) => coordinate[0])),
  Math.max(...coordinates.map((coordinate) => coordinate[1]))
];

assert.equal(boundary.type, 'FeatureCollection', 'San Jacinto boundary must parse as a GeoJSON FeatureCollection');
assert.equal(boundary.features.length, 1, 'San Jacinto boundary extraction must contain exactly one county feature');
assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry?.type), 'San Jacinto boundary must be Polygon or MultiPolygon');
assert.equal(properties.STATEFP, '48', 'San Jacinto STATEFP must be 48');
assert.equal(properties.COUNTYFP, '407', 'San Jacinto COUNTYFP must be 407');
assert.equal(properties.GEOID, '48407', 'San Jacinto GEOID must be 48407');
assert.equal(properties.NAMELSAD, 'San Jacinto County', 'San Jacinto NAMELSAD must match Census county name');
assert.equal(properties.sourceDataset, 'tl_2025_us_county', 'San Jacinto boundary source must be tl_2025_us_county');
assert.ok(coordinates.length > 100, 'San Jacinto boundary coordinate count must exceed placeholder-level geometry');
assert.notEqual(coordinates.length, 5, 'San Jacinto boundary must not be a five-coordinate rectangle');
assert.ok(bbox[0] < -94.8 && bbox[0] > -95.5 && bbox[2] > -95.0 && bbox[2] < -94.7 && bbox[1] > 30.2 && bbox[1] < 30.4 && bbox[3] > 30.8 && bbox[3] < 31.0, 'San Jacinto bbox must be plausible for East Texas / Coldspring / Shepherd / Lake Livingston');
assert.equal(validation.geometryChanged, true, 'V653 follow-up must confirm geometry changed from the metadata-only V653 commit');
assert.equal(validation.sourceDataset, 'tl_2025_us_county', 'V653 validation evidence must record source dataset');
assert.equal(validation.GEOID, '48407', 'V653 validation evidence must record GEOID 48407');
assert.equal(validation.validationStatus, 'PASS', 'V653 validation evidence must pass');
assert.equal(validation.checks.sourceAssetRecommendedForProduction, true, 'V653 validation evidence must recommend the boundary asset for production');
assert.match(app, /validationOnly: true/, 'San Jacinto validation-only posture must be preserved');
assert.match(app, /productionEnabled: false/, 'San Jacinto production must remain disabled');
assert.match(app, /productionActivationBlocked: true/, 'San Jacinto production activation must remain blocked');
assert.match(app, /reauthorizationRequired: true/, 'San Jacinto reauthorization must remain required');
assert.match(app, /sourceDataset === "tl_2025_us_county"/, 'Boundary audit must require tl_2025_us_county source');
assert.match(app, /properties\?\.GEOID === "48407"/, 'Boundary audit must require GEOID 48407');

console.log(JSON.stringify({
  audit: 'V653 San Jacinto authoritative boundary extraction',
  sourceDataset: properties.sourceDataset,
  geoid: properties.GEOID,
  geometryType: feature.geometry.type,
  coordinateCount: coordinates.length,
  bbox,
  sourceAssetRecommendedForProduction: validation.checks.sourceAssetRecommendedForProduction,
  validationOnlyPreserved: true,
  productionEnabled: false,
  productionActivationBlocked: true,
  reauthorizationRequired: true
}, null, 2));
