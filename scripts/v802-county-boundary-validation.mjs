#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const counties = {
  liberty: { geoid: '48291', bbox: { west: -95.3, south: 29.7, east: -94.3, north: 30.7 } },
  montgomery: { geoid: '48339', bbox: { west: -96.0, south: 29.9, east: -95.0, north: 30.8 } },
  'san-jacinto': { geoid: '48407', bbox: { west: -95.4, south: 30.3, east: -94.7, north: 31.0 } },
  chambers: { geoid: '48071', bbox: { west: -95.1, south: 29.3, east: -94.2, north: 30.2 } },
  jefferson: { geoid: '48245', bbox: { west: -94.8, south: 29.4, east: -93.6, north: 30.5 } }
};

const args = process.argv.slice(2);
const requested = args.includes('--all')
  ? Object.keys(counties)
  : [args.includes('--county') ? args[args.indexOf('--county') + 1] : 'jefferson'];
const root = process.cwd();
const runtimeRoot = 'assets/county-implementation';
const sourceRoot = 'Gridly-Source-Data/Census';

function count(node) {
  return Array.isArray(node) && typeof node[0] === 'number' ? 1 : Array.isArray(node) ? node.reduce((n, x) => n + count(x), 0) : 0;
}
function bbox(node, box = { west: Infinity, south: Infinity, east: -Infinity, north: -Infinity }) {
  if (Array.isArray(node) && typeof node[0] === 'number') {
    box.west = Math.min(box.west, node[0]); box.east = Math.max(box.east, node[0]);
    box.south = Math.min(box.south, node[1]); box.north = Math.max(box.north, node[1]);
  } else if (Array.isArray(node)) node.forEach(x => bbox(x, box));
  return box;
}
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}
function hash(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
function normalizeAuditPath(path) {
  return relative(root, path).split(sep).join('/');
}
function canonicalRuntimeBoundaryPath(slug) {
  return `${runtimeRoot}/${slug}/boundary/${slug}-county-boundary.geojson`;
}
function isCanonicalRuntimeBoundary(path, slug) {
  return path === canonicalRuntimeBoundaryPath(slug);
}
function isCanonicalRuntimeBoundaryDirectory(path, slug) {
  return path.startsWith(`${runtimeRoot}/${slug}/boundary/`);
}
function findRuntimeBoundaryAssets(slug) {
  const dir = join(root, runtimeRoot, slug);
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (subdir) => {
    for (const entry of readdirSync(subdir, { withFileTypes: true })) {
      const full = join(subdir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/county-boundary.*\.geojson$/i.test(entry.name)) out.push(normalizeAuditPath(full));
    }
  };
  walk(dir);
  return out;
}

let failed = false;
const results = [];
for (const slug of requested) {
  const meta = counties[slug];
  if (!meta) throw new Error(`Unsupported county: ${slug}`);
  const runtimePath = canonicalRuntimeBoundaryPath(slug);
  const sourcePath = `${sourceRoot}/${slug}-county-2025-wgs84.geojson`;
  const runtimePresent = existsSync(runtimePath);
  const sourcePresent = existsSync(sourcePath);
  const duplicateRuntimeAssets = findRuntimeBoundaryAssets(slug).filter((path) => !isCanonicalRuntimeBoundary(path, slug));
  const staleRuntimeBoundaryLocations = duplicateRuntimeAssets.filter((path) => !isCanonicalRuntimeBoundaryDirectory(path, slug));
  let coordinateCount = 0;
  let geoid = null;
  let credibilityMode = null;
  let checks = { sourceLibraryBoundaryPresent: sourcePresent, runtimeBoundaryPresent: runtimePresent, duplicateRuntimeAssets: duplicateRuntimeAssets.length === 0, staleRuntimeBoundaryLocations: staleRuntimeBoundaryLocations.length === 0 };
  if (runtimePresent) {
    const geojson = readJson(runtimePath);
    const feature = geojson.features?.[0];
    coordinateCount = count(feature?.geometry?.coordinates);
    const actual = bbox(feature?.geometry?.coordinates);
    const props = feature?.properties || {};
    geoid = String(props.GEOID || props.geoid || '');
    credibilityMode = props.boundaryCredibilityMode || (props.boundaryManufacturingSystem ? 'manufactured-v802' : 'source-library');
    checks = {
      ...checks,
      validGeoJson: geojson.type === 'FeatureCollection' && geojson.features?.length === 1 && !!feature.geometry,
      coordinateCount: coordinateCount > 50,
      geoidMatches: geoid === meta.geoid,
      bboxPlausible: actual.west >= meta.bbox.west && actual.east <= meta.bbox.east && actual.south >= meta.bbox.south && actual.north <= meta.bbox.north,
      credibilityMode: ['manufactured-v802', 'source-library'].includes(credibilityMode)
    };
  }
  if (runtimePresent && sourcePresent) checks.sourceRuntimeConsistency = hash(runtimePath) === hash(sourcePath) || statSync(runtimePath).size === statSync(sourcePath).size;
  else checks.sourceRuntimeConsistency = false;
  const productionReady = Object.values(checks).every(Boolean);
  failed ||= !productionReady;
  results.push({ county: slug, geoid: geoid || meta.geoid, sourceLibraryBoundaryPresent: sourcePresent, runtimeBoundaryPresent: runtimePresent, coordinateCount, sourceRuntimeConsistency: checks.sourceRuntimeConsistency, credibilityMode, duplicateRuntimeAssets, staleRuntimeBoundaryLocations, productionReady, paths: { sourceLibrary: sourcePath, runtimeBoundary: runtimePath }, checks });
}
const allRuntimeDuplicates = results.flatMap((result) => result.duplicateRuntimeAssets);
const summary = {
  supportedCountyCount: Object.keys(counties).length,
  productionReadyCount: results.filter((result) => result.productionReady).length,
  sourceLibraryCount: results.filter((result) => result.sourceLibraryBoundaryPresent).length,
  runtimeBoundaryCount: results.filter((result) => result.runtimeBoundaryPresent).length,
  duplicateRuntimeBoundaryAssets: allRuntimeDuplicates,
  missingRuntimeBoundaries: results.filter((result) => !result.runtimeBoundaryPresent).map((result) => result.county),
  missingSourceLibraryBoundaries: results.filter((result) => !result.sourceLibraryBoundaryPresent).map((result) => result.county),
  boundaryArchitecture: `${sourceRoot}/<county>-county-2025-wgs84.geojson -> ${runtimeRoot}/<county>/boundary/<county>-county-boundary.geojson`,
  determination: failed ? 'FAIL' : 'PASS'
};
console.log(JSON.stringify({ validation: 'V809 county boundary library expansion validation', ok: !failed, summary, results }, null, 2));
if (failed) process.exit(1);
