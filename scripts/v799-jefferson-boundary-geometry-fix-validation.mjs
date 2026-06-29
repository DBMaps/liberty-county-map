import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const boundaryPath = 'assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson';
const appPath = 'js/app.js';
const boundary = JSON.parse(readFileSync(boundaryPath, 'utf8'));
const app = readFileSync(appPath, 'utf8');

function countCoordinates(value) {
  let count = 0;
  const walk = (node) => {
    if (!Array.isArray(node)) return;
    if (node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      count += 1;
      return;
    }
    node.forEach(walk);
  };
  walk(value);
  return count;
}

const jefferson = boundary.features.find((feature) => String(feature.properties?.GEOID || feature.properties?.geoid) === '48245');
assert.equal(boundary.features.length, 254, 'standard Texas boundary source must retain 254 county features');
assert.ok(jefferson, 'Jefferson County feature must resolve by GEOID 48245');
assert.equal(jefferson.properties.GEOID, '48245', 'Jefferson rendered feature must expose canonical GEOID 48245');
assert.match(String(jefferson.properties.name || jefferson.properties.NAME), /Jefferson/i, 'Jefferson feature name must be county-specific and not town-ambiguous');
assert.ok(['Polygon', 'MultiPolygon'].includes(jefferson.geometry?.type), 'Jefferson boundary must be polygonal');
const coordinateCount = countCoordinates(jefferson.geometry?.coordinates);
assert.ok(coordinateCount > 250, `Jefferson coordinate count must exceed production minimum; got ${coordinateCount}`);
assert.notEqual(coordinateCount, 5, 'Jefferson boundary must not remain a five-point bbox placeholder');
assert.equal(jefferson.properties.bboxFallbackUsed, false, 'Jefferson source feature must declare bbox fallback was not used');
assert.match(app, /"jefferson-tx": "48245"/, 'runtime GEOID registry must map jefferson-tx to 48245');
assert.match(app, /activeBoundaryAuthoritativeJefferson/, 'runtime audit must include Jefferson-specific authoritative geometry review');
assert.match(app, /activeCountySourceFeatureCoordinateCount/, 'runtime audit must expose source feature coordinate count');
assert.match(app, /activeCountyRenderedCoordinateCount/, 'runtime audit must expose rendered feature coordinate count');
assert.match(app, /bboxFallbackUsed/, 'runtime audit must expose bbox fallback state');

console.log(JSON.stringify({
  audit: 'V799 Jefferson boundary geometry fix validation',
  boundaryPath,
  geoid: '48245',
  coordinateCount,
  bboxFallbackUsed: jefferson.properties.bboxFallbackUsed,
  passed: true
}, null, 2));
