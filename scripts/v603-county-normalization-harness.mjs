#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const COUNTIES = {
  montgomery: { fips: '48339', title: 'Montgomery' },
  chambers: { fips: '48071', title: 'Chambers' },
  'san-jacinto': { fips: '48407', title: 'San Jacinto' },
  polk: { fips: '48373', title: 'Polk' },
  jefferson: { fips: '48245', title: 'Jefferson' },
  harris: { fips: '48201', title: 'Harris' },
};

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.county) usage(0);
if (!COUNTIES[args.county]) fail(`Unsupported county "${args.county}". Supported: ${Object.keys(COUNTIES).join(', ')}`);

const county = args.county;
const meta = COUNTIES[county];
const root = process.cwd();
const runtimeDir = join(root, 'assets', 'county-implementation', county, 'runtime-assets');
const sourceDir = join(runtimeDir, 'source');
const stem = `${county}-county`;
const roadStem = `tl_2025_${meta.fips}_roads`;
const generatedRoot = join(root, 'assets', 'county-implementation', county, 'generated', 'local-normalization-staging');
const reportPath = join(generatedRoot, `v603-${county}-validation-report.json`);
const roadOutputPath = join(generatedRoot, `${county}-roads-source-converted.geojson`);
const startedAt = new Date().toISOString();

const report = {
  version: 'V603',
  county,
  countyTitle: meta.title,
  fips: meta.fips,
  mode: { dryRun: !args.convert, convertRoads: Boolean(args.convert), writeReport: args.writeReport !== false },
  generatedStagingPath: rel(generatedRoot),
  startedAt,
  checks: [],
  outputs: [],
  warnings: [],
  finalDetermination: 'LOCAL NORMALIZATION HARNESS READY',
};

const expected = {
  roadShapefile: join(sourceDir, `${roadStem}.shp`),
  roadIndex: join(sourceDir, `${roadStem}.shx`),
  roadDatabase: join(sourceDir, `${roadStem}.dbf`),
  roadProjection: join(sourceDir, `${roadStem}.prj`),
  railCrossings: join(runtimeDir, `${stem}-rail-crossings.geojson`),
  crossingOverrides: join(runtimeDir, `${stem}-crossing-review-overrides.json`),
};

for (const [name, file] of Object.entries(expected)) {
  check(`source:${name}`, existsSync(file), existsSync(file) ? { path: rel(file), bytes: statSync(file).size, sha256: sha256(file) } : { path: rel(file) });
}

if (hasFailures()) finish();
validateCrossings(expected.railCrossings);
validateOverrides(expected.crossingOverrides);

if (args.convert) convertRoads();
else report.warnings.push('Road shapefile conversion skipped; pass --convert to run local GIS conversion when ogr2ogr is installed.');

finish();

function validateCrossings(file) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { check('fra-crossings:valid-json', false, { error: error.message }); return; }
  check('fra-crossings:type', parsed?.type === 'FeatureCollection', { type: parsed?.type });
  check('fra-crossings:features-array', Array.isArray(parsed?.features), { featureCount: Array.isArray(parsed?.features) ? parsed.features.length : null });
  if (!Array.isArray(parsed?.features)) return;
  const requiredProps = ['crossingid', 'statecode', 'countycode', 'countyname'];
  const missing = [];
  let pointCount = 0;
  for (const [index, feature] of parsed.features.entries()) {
    if (feature?.type !== 'Feature') missing.push({ index, issue: 'not Feature' });
    if (!feature || typeof feature.properties !== 'object' || feature.properties === null) missing.push({ index, issue: 'missing properties' });
    for (const prop of requiredProps) if (!(prop in (feature.properties || {}))) missing.push({ index, issue: `missing property ${prop}` });
    if (feature?.geometry?.type === 'Point') pointCount++;
    if (missing.length >= 25) break;
  }
  check('fra-crossings:required-schema', missing.length === 0, { sampledFailures: missing, requiredProperties: requiredProps, pointGeometryCount: pointCount });
}

function validateOverrides(file) {
  const raw = readFileSync(file, 'utf8').trim();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (error) { check('overrides:valid-json', false, { error: error.message }); return; }
  const exact = raw === '{}' && parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0;
  check('overrides:exact-empty-object', exact, { path: rel(file), rawLength: raw.length });
}

function convertRoads() {
  const found = spawnSync('ogr2ogr', ['--version'], { encoding: 'utf8' });
  if (found.status !== 0) { check('roads:ogr2ogr-available', false, { message: 'ogr2ogr not found; install GDAL locally to convert roads.' }); return; }
  check('roads:ogr2ogr-available', true, { version: (found.stdout || found.stderr).trim() });
  mkdirSync(dirname(roadOutputPath), { recursive: true });
  rmSync(roadOutputPath, { force: true });
  const result = spawnSync('ogr2ogr', ['-f', 'GeoJSON', roadOutputPath, expected.roadShapefile], { encoding: 'utf8' });
  check('roads:convert-shapefile-to-geojson', result.status === 0, { output: rel(roadOutputPath), stderr: result.stderr.trim() });
  if (result.status === 0) report.outputs.push({ path: rel(roadOutputPath), bytes: statSync(roadOutputPath).size, sha256: sha256(roadOutputPath), gitPolicy: 'local generated staging; ignored by Git until explicit future approval' });
}

function check(name, ok, details = {}) { report.checks.push({ name, ok, details }); }
function hasFailures() { return report.checks.some((c) => !c.ok); }
function finish() {
  report.completedAt = new Date().toISOString();
  if (hasFailures()) report.finalDetermination = 'BLOCKED';
  if (report.mode.writeReport) { mkdirSync(generatedRoot, { recursive: true }); writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`); report.reportPath = rel(reportPath); }
  console.log(JSON.stringify(report, null, 2));
  process.exit(hasFailures() ? 1 : 0);
}
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function rel(file) { return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file; }
function fail(message) { console.error(message); usage(1); }
function parseArgs(argv) {
  const out = { convert: false, writeReport: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--county') out.county = argv[++i];
    else if (arg.startsWith('--county=')) out.county = arg.split('=')[1];
    else if (arg === '--convert') out.convert = true;
    else if (arg === '--no-write-report') out.writeReport = false;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else fail(`Unknown argument: ${arg}`);
  }
  return out;
}
function usage(code) {
  console.log(`Usage: node scripts/v603-county-normalization-harness.mjs --county <county> [--convert] [--no-write-report]\n\nSupported counties: ${Object.keys(COUNTIES).join(', ')}\n\nDefault mode validates inputs, FRA crossing schema, and empty overrides, then writes a small per-county report under generated/local-normalization-staging. --convert additionally runs ogr2ogr when available.`);
  process.exit(code);
}
