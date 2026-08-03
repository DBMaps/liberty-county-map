import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { ASSET_KEYS, manufacture, parseArguments, selectCounties, STATUSES } from '../tools/lp114/manufacture-county-bundle.mjs';

const inventory = { count: 254, counties: Array.from({ length: 254 }, (_, i) => ({ countyId: `county-${i}`, countyName: `County ${i}`, fips: `48${String(i * 2 + 1).padStart(3, '0')}` })) };
inventory.counties[25] = { countyId: 'burleson', countyName: 'Burleson', fips: '48051' };
inventory.counties[227] = { countyId: 'trinity', countyName: 'Trinity', fips: '48455' };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lp114-')); const addressDir = join(root, 'addresses'); const reports = join(root, 'reports');
  await import('node:fs/promises').then(fs => fs.mkdir(addressDir, { recursive: true }));
  const inventoryPath = join(root, 'counties.json'); await writeFile(inventoryPath, JSON.stringify(inventory));
  return { root, addressDir, reports, inventoryPath };
}

async function address(files, county = inventory.counties[25]) {
  const record = { i: 'fixture', h: '101', r: 'County Road 7', a: '101 County Road 7', p: 'Fixture', z: '77836', c: `${county.countyName} County`, f: county.fips, x: -96.1, y: 30.1 };
  const body = gzipSync(`${JSON.stringify(record)}\n`, { mtime: 0 }); const stem = `${county.countyId}-${county.fips}`;
  const packagePath = join(files.addressDir, `${stem}.addresses.jsonl.gz`); const hash = createHash('sha256').update(body).digest('hex');
  await writeFile(packagePath, body); await writeFile(`${packagePath}.json`, JSON.stringify({ countyId: county.countyId, county: county.countyName, fips: county.fips, outputBytes: body.length, packageHash: hash, acceptedRecords: 1 }));
}

test('valid arbitrary selection and invalid or duplicate FIPS rejection', () => {
  assert.deepEqual(selectCounties(inventory, '48051,48455').map(x => x.fips), ['48051', '48455']);
  assert.throws(() => selectCounties(inventory, '48051,48051'), /Duplicate/);
  assert.throws(() => selectCounties(inventory, '48051,49001'), /Texas/);
  assert.throws(() => selectCounties(inventory, '48998'), /absent/);
  assert.throws(() => parseArguments(['--fips', '48051', '--resume', '--force']), /mutually exclusive/);
});

test('existing package resumes, certifies, and remains candidate-only', async t => {
  const files = await fixture(); t.after(() => rm(files.root, { recursive: true, force: true })); await address(files);
  const report = await manufacture({ fips: '48051', resume: true, reports: files.reports, address_dir: files.addressDir, inventoryPath: files.inventoryPath }, { now: () => new Date('2026-01-01T00:00:00Z') });
  const county = report.counties[0]; assert.equal(county.assets.addresses.status, 'RESUMED'); assert.equal(county.assets.addressCertification.certificationStatus, 'PASS');
  assert.equal(county.productionAuthorized, false); assert.equal(county.activated, false); assert.equal(report.uploadEnabled, false); assert.equal(report.deploymentEnabled, false);
  assert.deepEqual(Object.keys(county.assets).sort(), [...ASSET_KEYS].sort()); assert.ok(Object.values(county.assets).every(asset => STATUSES.includes(asset.status)));
  const candidate = JSON.parse(await readFile(join(files.reports, '48051/candidate-manifest.json'))); assert.equal(candidate.productionAuthorization, false); assert.equal(candidate.activated, false);
});

test('missing owner address source is explicit while authoritative crossings are manufactured', async t => {
  const files = await fixture(); t.after(() => rm(files.root, { recursive: true, force: true }));
  const report = await manufacture({ fips: '48051', dry_run: true, reports: files.reports, address_dir: files.addressDir, inventoryPath: files.inventoryPath });
  assert.equal(report.counties[0].assets.addresses.status, 'REQUIRES_OWNER_SOURCE');
  assert.equal(report.counties[0].assets.communityLocality.status, 'REVIEW_REQUIRED');
  assert.equal(report.counties[0].assets.railroadCrossingSource.status, 'GENERATED');
  assert.notEqual(report.counties[0].assets.railroadCrossingSource.status, 'NOT_APPLICABLE');
});

test('county and asset failures are contained and checkpointed', async t => {
  const files = await fixture(); t.after(() => rm(files.root, { recursive: true, force: true }));
  const inspectAddress = async county => { if (county.fips === '48051') throw new Error('controlled asset failure'); return { assets: { addresses: { status: 'GENERATED' }, addressSidecar: { status: 'GENERATED' }, addressCertification: { status: 'GENERATED' }, addressRuntimeCertificate: { status: 'GENERATED' } } }; };
  const report = await manufacture({ fips: '48051,48455', reports: files.reports, inventoryPath: files.inventoryPath }, { inspectAddress });
  assert.equal(report.counties.length, 2); assert.equal(report.counties[0].assets.addresses.status, 'FAILED'); assert.equal(report.counties[1].assets.addresses.status, 'GENERATED');
  assert.ok((await stat(join(files.reports, '48051/checkpoint.json'))).isFile()); assert.ok((await stat(join(files.reports, '48455/checkpoint.json'))).isFile());
});

test('report is deterministic excluding real-world timestamps', async t => {
  const files = await fixture(); t.after(() => rm(files.root, { recursive: true, force: true })); const now = () => new Date('2026-01-01T00:00:00Z');
  const options = { fips: '48051', dry_run: true, reports: files.reports, address_dir: files.addressDir, inventoryPath: files.inventoryPath };
  const first = await manufacture(options, { now }); const second = await manufacture(options, { now }); assert.deepEqual(first, second);
});

test('production manifests are never touched', async t => {
  const files = await fixture(); t.after(() => rm(files.root, { recursive: true, force: true }));
  const paths = ['data/generated/lp104/txgio-addresses/runtime-manifest.json', 'data/roadway-runtime-manifest.json'];
  const before = await Promise.all(paths.map(path => readFile(path).catch(() => null)));
  await manufacture({ fips: '48051', dry_run: true, reports: files.reports, address_dir: files.addressDir, inventoryPath: files.inventoryPath });
  const after = await Promise.all(paths.map(path => readFile(path).catch(() => null))); assert.deepEqual(after, before);
});
