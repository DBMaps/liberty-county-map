import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const normalizedPath = (path) => {
  const portable = path.replaceAll('\\', '/');
  const packageRoot = portable.indexOf('Crossing-Packages/');
  return packageRoot >= 0 ? portable.slice(packageRoot) : portable;
};
const counties = readJson('data/lp104/texas-counties.json').counties;
const fipsByName = new Map(counties.map(({ countyName, fips }) => [countyName, fips]));
const certified = readJson('Crossing-Packages/production-crossing-manifest.json');
const registry = readJson('assets/package-registry/runtime-package-registry.json');

function loadRuntime() {
  const context = {
    console,
    Date,
    fetch: async () => { throw new Error('LP189.6 passes already-fetched certified bytes; network fetch is forbidden'); }
  };
  context.window = context;
  vm.runInNewContext(fs.readFileSync('js/gridlyCrossingPackageAdapter.js', 'utf8'), context);
  vm.runInNewContext(fs.readFileSync('js/gridlyCrossingProvider.js', 'utf8'), context);
  return context;
}

function trackedBytesMatch(path) {
  const workingBlob = execFileSync('git', ['hash-object', path], { encoding: 'utf8' }).trim();
  const baselineBlob = execFileSync('git', ['rev-parse', `HEAD:${path}`], { encoding: 'utf8' }).trim();
  return workingBlob === baselineBlob;
}

async function verifyCohort() {
  const runtime = loadRuntime();
  const crossingRecords = registry.packages.filter(({ packageType }) => packageType === 'Crossing');
  const certifiedByCounty = new Map(certified.records.map((record) => [record.county, record]));
  const rows = [];

  for (const record of crossingRecords) {
    const manifest = readJson(record.manifest);
    const packagePath = normalizedPath(manifest.packageFile);
    const raw = readJson(packagePath);
    const adapted = await runtime.gridlyCrossingProvider.getActiveCountyCrossings({
      mode: 'production', sourcePath: packagePath, alreadyFetchedGeojson: raw
    });
    const coordinatesValid = raw.features.every((feature) => {
      const coordinates = feature?.geometry?.coordinates;
      return Array.isArray(coordinates) && coordinates.length >= 2 &&
        Number.isFinite(Number(coordinates[0])) && Number.isFinite(Number(coordinates[1])) &&
        Number(coordinates[0]) >= -180 && Number(coordinates[0]) <= 180 &&
        Number(coordinates[1]) >= -90 && Number(coordinates[1]) <= 90;
    });
    let rendererInputCount = 0;
    const representativeRenderer = (input) => { rendererInputCount = input.length; };
    representativeRenderer(adapted.features);
    const baseline = certifiedByCounty.get(record.county);
    const certifiedPath = normalizedPath(baseline.packageFile);
    const identityMatches = trackedBytesMatch(record.manifest) && trackedBytesMatch(packagePath) && trackedBytesMatch(certifiedPath);
    const failures = [];
    if (!fs.existsSync(record.manifest)) failures.push('package_not_discovered');
    if (!fs.existsSync(packagePath)) failures.push('manifest_path_unresolved');
    if (raw.features.length === 0) failures.push('active_county_inventory_empty');
    if (!coordinatesValid) failures.push('invalid_coordinates');
    if (adapted.features.length === 0) failures.push('normalization_empty');
    if (rendererInputCount === 0) failures.push('renderer_input_empty');
    if (!identityMatches) failures.push('package_identity_mismatch');
    if (raw.features.length !== baseline.crossingCount || manifest.crossingCount !== baseline.crossingCount) failures.push('certified_count_mismatch');

    rows.push({
      countyId: record.county.toLowerCase().replaceAll(' ', '-'), fips: fipsByName.get(record.county),
      packagePath, certifiedFeatureCount: baseline.crossingCount, runtimeLoadResult: 'PASS',
      coordinateValidityResult: coordinatesValid && raw.features.length > 0 ? 'PASS' : 'FAIL',
      inventoryResult: raw.features.length > 0 ? `PASS (${raw.features.length})` : 'FAIL (active_county_inventory_empty)',
      rendererInputCount, identityMatches, failures, result: failures.length ? 'FAIL' : 'PASS'
    });
  }
  return { crossingRecords, rows };
}

test('LP189.6 uses exactly the registry/V783 certified 28-county crossing cohort', async () => {
  const { crossingRecords, rows } = await verifyCohort();
  assert.equal(crossingRecords.length, 28);
  assert.equal(certified.totalPackages, 28);
  assert.deepEqual(rows.map(({ countyId }) => countyId), crossingRecords.map(({ county }) => county.toLowerCase().replaceAll(' ', '-')));
  assert.equal(rows.find(({ countyId }) => countyId === 'liberty').certifiedFeatureCount, 115);
});

test('LP189.6 verifies runtime loading, normalization, renderer input, coordinates, and protected identities', async () => {
  const { rows } = await verifyCohort();
  assert.equal(rows.filter(({ identityMatches }) => !identityMatches).length, 0);
  assert.equal(rows.filter(({ result }) => result === 'PASS').length, 27);
  assert.deepEqual(rows.filter(({ result }) => result === 'FAIL').map(({ countyId, failures }) => ({ countyId, failures })), [{
    countyId: 'tyler', failures: ['active_county_inventory_empty', 'normalization_empty', 'renderer_input_empty']
  }]);
});
