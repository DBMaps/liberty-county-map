#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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
if (args.extract && args.convert) fail('Use only one extraction flag: --extract or --convert.');

const county = args.county;
const meta = COUNTIES[county];
const root = process.cwd();
const implementationDir = join(root, 'assets', 'county-implementation', county);
const boundaryDir = join(implementationDir, 'boundary');
const committedBoundaryPath = join(boundaryDir, `${county}-county-boundary.geojson`);
const generatedRoot = join(implementationDir, 'generated', 'boundary-staging');
const stagedBoundaryPath = join(generatedRoot, `${county}-county-boundary.geojson`);
const reportPath = join(generatedRoot, `v604-${county}-boundary-report.json`);
const extractionRequested = Boolean(args.extract || args.convert);

const report = {
  version: 'V604',
  county,
  countyTitle: meta.title,
  fips: meta.fips,
  mode: {
    dryRun: !extractionRequested,
    extractBoundary: extractionRequested,
    extractionFlag: args.extract ? '--extract' : args.convert ? '--convert' : null,
    writeReport: args.writeReport !== false,
  },
  paths: {
    implementationDir: rel(implementationDir),
    boundaryDir: rel(boundaryDir),
    committedBoundary: rel(committedBoundaryPath),
    generatedStagingPath: rel(generatedRoot),
    stagedBoundary: rel(stagedBoundaryPath),
  },
  checks: [],
  outputs: [],
  warnings: [],
  startedAt: new Date().toISOString(),
  finalDetermination: 'COUNTY BOUNDARY EXTRACTION HARNESS READY',
};

check('county:supported-slug', true, { supportedCounties: Object.keys(COUNTIES) });
check('county:expected-fips-mapping', Boolean(meta.fips), { fips: meta.fips });
check('county:implementation-directory-exists', existsSync(implementationDir), { path: rel(implementationDir) });
check('county:boundary-directory-exists', existsSync(boundaryDir), { path: rel(boundaryDir) });
checkGeneratedStagingIgnored();

if (!hasFailures()) {
  if (existsSync(committedBoundaryPath)) validateBoundaryGeoJson(committedBoundaryPath, 'committed-boundary');
  else markMissingBoundary();
}

if (!hasFailures() && extractionRequested) extractBoundary();
else if (!extractionRequested) report.warnings.push('Dry-run validation only; pass --extract or --convert with --source <local-path> to run optional local ogr2ogr extraction.');

finish();

function validateBoundaryGeoJson(file, prefix) {
  let parsed;
  try { parsed = JSON.parse(readFileSync(file, 'utf8')); }
  catch (error) { check(`${prefix}:valid-json`, false, { path: rel(file), error: error.message }); return; }

  check(`${prefix}:exists`, true, { path: rel(file), bytes: statSync(file).size, sha256: sha256(file) });
  check(`${prefix}:feature-collection`, parsed?.type === 'FeatureCollection', { type: parsed?.type });
  check(`${prefix}:has-features`, Array.isArray(parsed?.features) && parsed.features.length > 0, { featureCount: Array.isArray(parsed?.features) ? parsed.features.length : null });

  if (!Array.isArray(parsed?.features)) return;
  const polygonFeatures = parsed.features.filter((feature) => ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type));
  check(`${prefix}:polygon-or-multipolygon-geometry`, polygonFeatures.length > 0, { polygonOrMultiPolygonCount: polygonFeatures.length });

  const fipsMatches = parsed.features.flatMap((feature, index) => {
    const properties = feature?.properties || {};
    const candidates = ['GEOID', 'geoid', 'GEOID10', 'GEOID20', 'COUNTYFP', 'countyfp', 'FIPS', 'fips'];
    return candidates
      .filter((property) => property in properties)
      .map((property) => ({ index, property, value: String(properties[property]) }));
  });
  const exactMatch = fipsMatches.some(({ value }) => value === meta.fips);
  const countyFpMatch = fipsMatches.some(({ property, value }) => ['COUNTYFP', 'countyfp'].includes(property) && `${meta.fips.slice(0, 2)}${value.padStart(3, '0')}` === meta.fips);
  check(`${prefix}:expected-fips-or-geoid-present-when-available`, exactMatch || countyFpMatch || fipsMatches.length === 0, {
    expectedFips: meta.fips,
    observedFipsLikeProperties: fipsMatches.slice(0, 20),
    note: fipsMatches.length === 0 ? 'No FIPS/GEOID-like property was available to validate.' : undefined,
  });
}

function markMissingBoundary() {
  check('committed-boundary:missing-is-safe', true, { path: rel(committedBoundaryPath), status: 'READY_FOR_LOCAL_EXTRACTION' });
  report.warnings.push('Committed county boundary GeoJSON is missing. Supply a national or state county boundary source locally and run explicit extraction; V604 does not download Census data or commit national/state shapefile sources.');
}

function checkGeneratedStagingIgnored() {
  const probe = join(generatedRoot, '.v604-gitignore-probe');
  const result = spawnSync('git', ['check-ignore', '--quiet', rel(probe)], { cwd: root, encoding: 'utf8' });
  check('generated-staging:path-ignored-by-git', result.status === 0, {
    path: rel(generatedRoot),
    probe: rel(probe),
    policy: 'generated boundary staging must remain ignored by Git',
  });
}

function extractBoundary() {
  if (!args.source) { check('extract:local-source-provided', false, { message: 'Pass --source <local national/state county boundary dataset> for local extraction.' }); return; }
  const source = resolve(root, args.source);
  check('extract:local-source-exists', existsSync(source), { source: rel(source) });
  if (!existsSync(source)) return;
  const found = spawnSync('ogr2ogr', ['--version'], { encoding: 'utf8' });
  check('extract:ogr2ogr-available', found.status === 0, { version: (found.stdout || found.stderr || '').trim() || null });
  if (found.status !== 0) return;
  mkdirSync(dirname(stagedBoundaryPath), { recursive: true });
  rmSync(stagedBoundaryPath, { force: true });
  const result = spawnSync('ogr2ogr', ['-f', 'GeoJSON', stagedBoundaryPath, source, '-where', `GEOID='${meta.fips}'`], { encoding: 'utf8' });
  check('extract:ogr2ogr-county-filter', result.status === 0, { output: rel(stagedBoundaryPath), stderr: result.stderr.trim() });
  if (result.status !== 0) return;
  report.outputs.push({ path: rel(stagedBoundaryPath), bytes: statSync(stagedBoundaryPath).size, sha256: sha256(stagedBoundaryPath), gitPolicy: 'local generated staging; ignored by Git; never overwrites committed boundary' });
  validateBoundaryGeoJson(stagedBoundaryPath, 'staged-boundary');
}

function check(name, ok, details = {}) { report.checks.push({ name, ok, details }); }
function hasFailures() { return report.checks.some((checkResult) => !checkResult.ok); }
function finish() {
  report.completedAt = new Date().toISOString();
  const missingBoundary = report.checks.some((checkResult) => checkResult.name === 'committed-boundary:missing-is-safe');
  if (hasFailures()) report.finalDetermination = 'BLOCKED';
  else if (missingBoundary) report.finalDetermination = 'READY_FOR_LOCAL_EXTRACTION';
  else report.finalDetermination = 'COUNTY BOUNDARY EXTRACTION HARNESS READY';
  if (report.mode.writeReport) {
    mkdirSync(generatedRoot, { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    report.reportPath = rel(reportPath);
  }
  console.log(JSON.stringify(report, null, 2));
  process.exit(hasFailures() ? 1 : 0);
}
function sha256(file) { return createHash('sha256').update(readFileSync(file)).digest('hex'); }
function rel(file) { const absolute = resolve(file); return absolute.startsWith(`${root}/`) ? absolute.slice(root.length + 1) : file; }
function fail(message) { console.error(message); usage(1); }
function parseArgs(argv) {
  const out = { extract: false, convert: false, writeReport: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--county') out.county = argv[++i];
    else if (arg.startsWith('--county=')) out.county = arg.split('=').slice(1).join('=');
    else if (arg === '--source') out.source = argv[++i];
    else if (arg.startsWith('--source=')) out.source = arg.split('=').slice(1).join('=');
    else if (arg === '--extract') out.extract = true;
    else if (arg === '--convert') out.convert = true;
    else if (arg === '--no-write-report') out.writeReport = false;
    else if (arg === '--help' || arg === '-h') out.help = true;
    else fail(`Unknown argument: ${arg}`);
  }
  return out;
}
function usage(code) {
  console.log(`Usage: node scripts/v604-county-boundary-harness.mjs --county <county> [--no-write-report] [--extract|--convert --source <local-path>]\n\nSupported counties: ${Object.keys(COUNTIES).join(', ')}\n\nDefault mode is dry-run validation. Optional extraction is local-only, requires ogr2ogr and a locally supplied county boundary source, writes only to generated/boundary-staging, and never overwrites committed boundaries.`);
  process.exit(code);
}
