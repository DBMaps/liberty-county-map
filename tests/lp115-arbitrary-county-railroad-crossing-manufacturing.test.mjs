import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { classifyFeature, manufacture, parseArguments, selectCounties } from '../tools/lp115/manufacture-candidate-crossings.mjs';
import { manufacture as manufactureBundle } from '../tools/lp114/manufacture-county-bundle.mjs';

const inventory = JSON.parse(await readFile(new URL('../data/lp104/texas-counties.json', import.meta.url)));
const feature = (fips, id, type = 'Public') => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [-96, 30] }, properties: { CROSSING: id, STCYFIPS: fips, CountyCode: fips, COUNTYNAME: 'FIXTURE', TYPEXING: type, STREET: `Road ${id}` } });
async function fixture(features) { const root = await mkdtemp(join(tmpdir(), 'lp115-')); const source = join(root, 'fra.geojson'); const index = join(root, 'index.json'); const reports = join(root, 'reports'); await writeFile(source, JSON.stringify({ type: 'FeatureCollection', features })); await writeFile(index, JSON.stringify({ entries: features.map(x => ({ crossingId: x.properties.CROSSING, gridlyCountyFips: x.properties.STCYFIPS, resolution: 'SOURCE_AND_GEOGRAPHY_AGREE' })) })); return { root, source, index, reports }; }

test('valid maintained arbitrary FIPS and CLI governance', () => {
  assert.deepEqual(selectCounties(inventory, '48051,48455,48469').map(x => x.fips), ['48051', '48455', '48469']);
  assert.throws(() => selectCounties(inventory, '48051,48051'), /Duplicate/);
  assert.throws(() => selectCounties(inventory, '49001'), /Texas/);
  assert.throws(() => selectCounties(inventory, '48998'), /absent/);
  assert.throws(() => parseArguments(['--fips', '48051']), /--candidate/);
});

test('three counties manufacture deterministic, contained, inactive candidates through V790 fields', async t => {
  const files = await fixture([feature('48051', 'A'), feature('48455', 'B', 'Private'), feature('48469', 'C')]); t.after(() => rm(files.root, { recursive: true, force: true }));
  const productionManifest = await readFile(new URL('../Crossing-Packages/production-crossing-manifest.json', import.meta.url));
  const first = await manufacture({ fips: '48051,48455,48469', source: files.source, indexPath: files.index, reports: files.reports, inventoryPath: new URL('../data/lp104/texas-counties.json', import.meta.url) });
  assert.deepEqual(first.counties.map(x => x.status), ['GENERATED', 'GENERATED', 'GENERATED']);
  for (const county of first.counties) { assert.equal(county.productionAuthorized, false); assert.equal(county.activated, false); assert.equal(county.productionCrossingCount, 1); assert.equal(county.publicCrossings, 1); assert.equal(county.hiddenCrossings, 0); const packagePath = join(files.reports, county.fips, `${county.countyId}-${county.fips}.production-crossings.candidate.geojson`); const pkg = JSON.parse(await readFile(packagePath)); assert.ok(pkg.features.every(x => x.properties.STCYFIPS === county.fips)); assert.equal(pkg.features[0].properties.gridlyClassification, 'PUBLIC_ROADWAY'); assert.match(pkg.features[0].properties.gridlyId, /^FRA-/); }
  const beforeHashes = first.counties.map(x => x.package.sha256); const second = await manufacture({ fips: '48051,48455,48469', source: files.source, indexPath: files.index, reports: files.reports, inventoryPath: new URL('../data/lp104/texas-counties.json', import.meta.url) }); assert.deepEqual(second.counties.map(x => x.package.sha256), beforeHashes);
  assert.deepEqual(await readFile(new URL('../Crossing-Packages/production-crossing-manifest.json', import.meta.url)), productionManifest);
});

test('resume checkpoints and authoritative zero-crossing evidence', async t => {
  const files = await fixture([feature('48051', 'A')]); t.after(() => rm(files.root, { recursive: true, force: true }));
  await manufacture({ fips: '48051,48455', source: files.source, indexPath: files.index, reports: files.reports }); const resumed = await manufacture({ fips: '48051,48455', source: files.source, indexPath: files.index, reports: files.reports, resume: true });
  assert.equal(resumed.counties[0].status, 'RESUMED'); assert.equal(resumed.counties[1].status, 'NOT_APPLICABLE'); assert.equal(resumed.counties[1].sourceQueryCompleted, true); assert.equal(resumed.counties[1].package, null); assert.equal(resumed.counties[1].certificationStatus, 'PASS_ZERO_APPLICABLE');
  assert.ok((await stat(join(files.reports, '48051/checkpoint.json'))).isFile());
});

test('missing source and invalid query fail truthfully while counties remain independent', async t => {
  const files = await fixture([feature('48051', 'D'), feature('48455', 'D'), feature('48455', 'D')]); t.after(() => rm(files.root, { recursive: true, force: true }));
  const missing = await manufacture({ fips: '48051', source: join(files.root, 'missing.geojson'), reports: files.reports }); assert.equal(missing.counties[0].status, 'REQUIRES_OWNER_SOURCE');
  await assert.rejects(manufacture({ fips: '48051,48455', source: files.source, indexPath: files.index, reports: files.reports }), /duplicate index crossing/);
  await writeFile(files.source, '{bad'); const failed = await manufacture({ fips: '48051', source: files.source, indexPath: files.index, reports: files.reports }); assert.equal(failed.counties[0].status, 'FAILED');
});

test('existing classifications are preserved and hidden classes do not become public', () => {
  for (const classification of ['PRIVATE_ROAD', 'INDUSTRIAL', 'RAIL_YARD', 'TEMPORARY_ACCESS']) { const input = feature('48051', classification); input.properties.gridlyClassification = classification; assert.equal(classifyFeature(input).properties.gridlyClassification, classification); }
});

test('LP114 consumes LP115 statuses without authorizing upload, deploy, or activation', async t => {
  const files = await fixture([feature('48051', 'A')]); t.after(() => rm(files.root, { recursive: true, force: true }));
  const report = await manufactureBundle({ fips: '48051', skip_addresses: true, crossing_source: files.source, indexPath: files.index, reports: join(files.root, 'bundle'), inventoryPath: fileURLToPath(new URL('../data/lp104/texas-counties.json', import.meta.url)) }); const assets = report.counties[0].assets;
  assert.equal(assets.railroadCrossingSource.status, 'GENERATED'); assert.equal(assets.productionCrossings.status, 'GENERATED'); assert.equal(assets.crossingCertification.certificationStatus, 'PASS'); assert.equal(report.uploadEnabled, false); assert.equal(report.deploymentEnabled, false); assert.equal(report.productionActivation, false);
});

test('checked-in production manifest remains the certified post-Wave-3A.2A authority', async () => {
  const body = await readFile(new URL('../Crossing-Packages/production-crossing-manifest.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(body.replace(/^\uFEFF/, ''));
  const records = new Map(manifest.records.map(record => [record.county, record]));
  assert.equal(manifest.totalPackages, 28);
  assert.equal(manifest.totalCrossings, 3784);
  assert.equal(manifest.passCount, 28);
  assert.equal(manifest.records.filter(record => record.crossingCount > 0).length, 27);
  assert.equal(manifest.records.filter(record => record.crossingCount === 0).length, 1);
  assert.equal(records.get('Tyler')?.crossingCount, 0);
  assert.equal(records.get('Brazos')?.crossingCount, 95);
  assert.equal(records.get('Lavaca')?.crossingCount, 40);
  assert.equal(records.get('Washington')?.crossingCount, 44);
  assert.equal(createHash('sha256').update(body).digest('hex').length, 64);
});
