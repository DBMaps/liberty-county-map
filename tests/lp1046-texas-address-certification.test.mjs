import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { canonicalRoad, certifyCountyPackage, eligibleExact, supportedAliases } from '../tools/lp104/certify-texas-address-package.mjs';

const roads = ['County Road 101', 'FM 1960', 'State Highway 321', 'US Highway 90'];
async function fixture({ count = 4000, mutateRecord } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'lp1046-'));
  const records = Array.from({ length: count }, (_, index) => ({
    i: `48291-${index}`, h: String(10000 + index), r: roads[index % roads.length],
    a: `${10000 + index} ${roads[index % roads.length]}`, p: 'Test Community', z: '77575',
    c: 'Liberty County', f: '48291', x: -94.9 + (index % 10) / 1000, y: 30.1 + (index % 10) / 1000
  }));
  if (mutateRecord) mutateRecord(records);
  const body = gzipSync(`${records.map(JSON.stringify).join('\n')}\n`, { level: 9, mtime: 0 });
  const packagePath = join(directory, 'test-48291.addresses.jsonl.gz');
  const certificatePath = join(directory, 'test-48291.runtime-certificate.json');
  const manifestPath = join(directory, 'runtime-manifest.json');
  const sha256 = createHash('sha256').update(body).digest('hex');
  const certificate = { schemaVersion: 1, milestone: 'LP104.6-test', county: 'Liberty County', fips: '48291', artifact: 'test-48291.addresses.jsonl.gz', sizeBytes: body.length, sha256,
    acceptance: { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false } };
  const entry = { countyId: 'liberty-tx', county: 'Liberty County', fips: '48291', path: packagePath, certificate: certificatePath, sizeBytes: body.length, sha256 };
  await Promise.all([writeFile(packagePath, body), writeFile(certificatePath, JSON.stringify(certificate)), writeFile(manifestPath, JSON.stringify({ schemaVersion: 1, packages: [entry] }))]);
  return { directory, manifestPath, packagePath, certificatePath, entry, certificate };
}

test('certifies thousands of deterministic exact and rejected addresses without eager or duplicate loads', async t => {
  const files = await fixture();
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const report = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: '48291', sampleSize: 3000 });
  assert.equal(report.certificationStatus, 'PASS');
  assert.deepEqual(report.exactMatchStatistics.sampled, 3000);
  assert.equal(report.exactMatchStatistics.passed, 3000);
  assert.equal(report.rejectionStatistics.truthfulNoResults, 3000);
  assert.equal(report.rejectionStatistics.interpolationAccepted, 0);
  assert.equal(report.rejectionStatistics.nearbyHouseSubstitutions, 0);
  assert.equal(report.rejectionStatistics.invalidAddressesTested, 3000);
  assert.equal(report.rejectionStatistics.invalidAddressesAccepted, 0);
  assert.equal(report.normalizationStatistics.variantsTested, 9000);
  assert.equal(report.normalizationStatistics.variantsPassed, 9000);
  assert.equal(report.integrityStatistics.packageLoadCount, 1);
  assert.equal(report.indexedAddressCount, 4000);
});

test('LP134 independently rejects internal-space house numbers from exact sampling', () => {
  const base = { i: '48027-1', h: '100306', r: 'Main Street', f: '48027', x: -97, y: 31 };
  assert.equal(eligibleExact(base, '48027'), true);
  assert.equal(eligibleExact({ ...base, h: '100306 A' }, '48027'), false);
  assert.equal(eligibleExact({ ...base, h: '14073 1/2' }, '48027'), false);
});

test('LP134 restricts alias evidence to governed numbered roads', () => {
  assert.equal(supportedAliases('Cr Moore Road').length, 0);
  assert.equal(supportedAliases('Us Marshal Road').length, 0);
  assert.deepEqual(supportedAliases('County Road 101'), ['County Road 101', 'CR 101', 'Co Rd 101']);
  assert.equal(supportedAliases('FM 1960').length, 3);
});

test('LP134 performance certification is deterministic and duration is diagnostic only', async t => {
  const files = await fixture({ count: 20 });
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const pass = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: '48291', maxIndexedRecords: 20 });
  const fail = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: '48291', maxIndexedRecords: 19 });
  assert.equal(pass.performanceGate.status, 'PASS');
  assert.equal(pass.performanceGate.runtimeDurationIsDiagnosticOnly, true);
  assert.equal(fail.performanceGate.status, 'FAIL');
  assert.ok(fail.failures.includes('indexed address count exceeded deterministic limit 19'));
});

test('normalizes the required Texas canonical road aliases', () => {
  for (const alias of ['County Road 12', 'CR 12', 'Co Rd 12']) assert.equal(canonicalRoad(alias), 'CR 12');
  for (const alias of ['Farm to Market Road 12', 'Farm Road 12', 'FM 12']) assert.equal(canonicalRoad(alias), 'FM 12');
  for (const alias of ['State Highway 12', 'State Hwy 12', 'SH 12']) assert.equal(canonicalRoad(alias), 'SH 12');
  for (const alias of ['US Highway 12', 'US Hwy 12', 'US 12']) assert.equal(canonicalRoad(alias), 'US 12');
});

test('fails county containment and duplicate identity violations', async t => {
  const files = await fixture({ mutateRecord(records) { records[1].f = '48201'; records[2].i = records[0].i; } });
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const report = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: '48291' });
  assert.equal(report.certificationStatus, 'FAIL');
  assert.equal(report.integrityStatistics.outsideCounty, 1);
  assert.equal(report.integrityStatistics.duplicateIdentities, 1);
});

test('fails altered package bytes, manifest metadata, and package certificate metadata', async t => {
  const files = await fixture({ count: 20 });
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(files.manifestPath));
  manifest.packages[0].sha256 = '0'.repeat(64);
  const certificate = JSON.parse(await readFile(files.certificatePath));
  certificate.sizeBytes += 1;
  await Promise.all([writeFile(files.manifestPath, JSON.stringify(manifest)), writeFile(files.certificatePath, JSON.stringify(certificate))]);
  const report = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: '48291' });
  assert.equal(report.certificationStatus, 'FAIL');
  assert.ok(report.failures.includes('manifest SHA-256 mismatch'));
  assert.ok(report.failures.includes('certificate size mismatch'));
});
