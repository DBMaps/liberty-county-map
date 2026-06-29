import fs from 'fs';

const counties = {
  liberty: { geoid: '48291', path: 'assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson', bbox: { west: -95.3, south: 29.7, east: -94.3, north: 30.7 } },
  montgomery: { geoid: '48339', path: 'assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson', bbox: { west: -96.0, south: 29.9, east: -95.0, north: 30.8 } },
  'san-jacinto': { geoid: '48407', path: 'assets/county-implementation/san-jacinto/boundary/san-jacinto-county-boundary.geojson', bbox: { west: -95.4, south: 30.3, east: -94.7, north: 31.0 } },
  chambers: { geoid: '48071', path: 'assets/county-implementation/chambers/boundary/chambers-county-boundary.geojson', bbox: { west: -95.1, south: 29.3, east: -94.2, north: 30.2 } },
  jefferson: { geoid: '48245', path: 'assets/county-implementation/jefferson/boundary/jefferson-county-boundary.geojson', bbox: { west: -94.8, south: 29.4, east: -93.6, north: 30.5 } }
};
const requested = process.argv.includes('--all') ? Object.keys(counties) : [process.argv[process.argv.indexOf('--county') + 1] || 'jefferson'];
function count(node) { return Array.isArray(node) && typeof node[0] === 'number' ? 1 : Array.isArray(node) ? node.reduce((n, x) => n + count(x), 0) : 0; }
function bbox(node, box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }) { if (Array.isArray(node) && typeof node[0] === 'number') { box.west = Math.min(box.west, node[0]); box.east = Math.max(box.east, node[0]); box.south = Math.min(box.south, node[1]); box.north = Math.max(box.north, node[1]); } else if (Array.isArray(node)) node.forEach(x => bbox(x, box)); return box; }
let failed = false; const results = [];
for (const slug of requested) {
  const meta = counties[slug];
  if (!meta) throw new Error(`Unsupported county: ${slug}`);
  const geojson = JSON.parse(fs.readFileSync(meta.path, 'utf8'));
  const feature = geojson.features?.[0]; const coordinateCount = count(feature?.geometry?.coordinates); const actual = bbox(feature?.geometry?.coordinates);
  const props = feature?.properties || {};
  const checks = {
    validGeoJson: geojson.type === 'FeatureCollection' && geojson.features?.length === 1 && !!feature.geometry,
    coordinateCount: coordinateCount > 50,
    geoidMatches: String(props.GEOID || props.geoid) === meta.geoid,
    bboxPlausible: actual.west >= meta.bbox.west && actual.east <= meta.bbox.east && actual.south >= meta.bbox.south && actual.north <= meta.bbox.north,
    noBboxFallback: props.bboxFallbackUsed === false,
    manufacturedSource: props.boundaryManufacturingSystem === 'V802 County Boundary Manufacturing System'
  };
  const ok = Object.values(checks).every(Boolean); failed ||= !ok; results.push({ slug, ok, path: meta.path, coordinateCount, bbox: actual, checks });
}
console.log(JSON.stringify({ validation: 'V802 county boundary package validation', ok: !failed, results }, null, 2));
if (failed) process.exit(1);
