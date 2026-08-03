import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { certifyCountyPackage, governedIdentityAccepted } from '../tools/lp104/certify-texas-address-package.mjs';

const base = { p: 'Fixture City', z: '77001', c: 'Fixture County', f: '48051', x: -96.1, y: 30.1 };
const record = (i, h, r, overrides = {}) => ({ ...base, i, h, r, a: `${h} ${r}`, ...overrides });

async function fixture(records, { fips = '48051', county = 'Fixture County' } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'lp113-'));
  records = records.map(row => ({ ...row, f: fips, c: county }));
  const body = gzipSync(`${records.map(JSON.stringify).join('\n')}\n`, { level: 9, mtime: 0 });
  const packagePath = join(directory, `fixture-${fips}.addresses.jsonl.gz`);
  const certificatePath = join(directory, `fixture-${fips}.runtime-certificate.json`);
  const manifestPath = join(directory, 'runtime-manifest.json');
  const sha256 = createHash('sha256').update(body).digest('hex');
  const certificate = { milestone: 'LP113-fixture', county, fips, artifact: packagePath.split('/').pop(), sizeBytes: body.length, sha256,
    acceptance: { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false } };
  const entry = { county, fips, path: packagePath, certificate: certificatePath, sizeBytes: body.length, sha256 };
  await Promise.all([writeFile(packagePath, body), writeFile(certificatePath, JSON.stringify(certificate)), writeFile(manifestPath, JSON.stringify({ packages: [entry] }))]);
  return { directory, packagePath, certificatePath, manifestPath, county, fips };
}

test('Burleson-like unsuitable first record is skipped for deterministic exact and alias evidence', async t => {
  const files = await fixture([
    record('unsuitable-range', '12-14', 'Private Lane'),
    record('later-alias', '101', 'County Road 7'),
    record('ordinary', '9', 'Main Street')
  ]);
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const first = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: files.fips });
  const second = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: files.fips });
  assert.equal(first.certificationStatus, 'PASS');
  assert.equal(first.exactSample.providerIdentity, second.exactSample.providerIdentity);
  assert.equal(first.exactMatchStatistics.sampled, 2);
  assert.equal(first.normalizationStatistics.status, 'PASS');
  assert.equal(first.normalizationStatistics.eligibleRecords, 1);
  assert.equal(first.normalizationStatistics.variantsPassed, 3);
});

test('Victoria-like package without supported alias is truthful NOT_APPLICABLE, not a false failure', async t => {
  const files = await fixture([record('one', '100', 'Main Street'), record('two', '200', 'Mockingbird Lane')], { fips: '48469', county: 'Victoria County' });
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const report = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: files.fips });
  assert.equal(report.certificationStatus, 'PASS');
  assert.equal(report.exactMatchStatistics.passed, 2);
  assert.deepEqual(report.normalizationStatistics, { status: 'NOT_APPLICABLE', eligibleRecords: 0, variantsTested: 0, variantsPassed: 0 });
});

test('duplicate complete-address representatives use governed match-set membership', async t => {
  const rows = [record('member-a', '300', 'FM 12'), record('member-b', '300', 'Farm Road 12')];
  const files = await fixture(rows);
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const report = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: files.fips });
  assert.equal(report.certificationStatus, 'PASS');
  assert.equal(report.exactSample.completeAddressMatchCount, 2);
  assert.equal(governedIdentityAccepted(rows, 'member-b', files.fips), true);
  assert.equal(governedIdentityAccepted(rows, 'unrelated', files.fips), false);
  assert.equal(governedIdentityAccepted(rows, 'member-a', '48201'), false);
});

test('blank city remains blank while exact, FIPS, nearby-number, and road-only gates pass', async t => {
  const files = await fixture([record('blank-city', '400', 'State Highway 9', { p: '' })]);
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const report = await certifyCountyPackage({ manifestPath: files.manifestPath, fips: files.fips });
  assert.equal(report.certificationStatus, 'PASS');
  assert.equal(report.exactSample.city, '');
  assert.equal(report.exactSample.query, '400 State Highway 9 TX 77001');
  assert.equal(report.exactSample.countyFips, files.fips);
  assert.equal(report.rejectionStatistics.truthfulNoResults, 1);
  assert.equal(report.rejectionStatistics.nearbyHouseSubstitutions, 0);
  assert.equal(report.rejectionStatistics.roadOnlyResidentialPromotions, 0);
});

test('existing-package mode requires and verifies package, county, FIPS, and runtime certificate', async t => {
  const files = await fixture([record('direct', '500', 'US Highway 90')]);
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const report = await certifyCountyPackage({ packagePath: files.packagePath, certificatePath: files.certificatePath, county: files.county, fips: files.fips });
  assert.equal(report.certificationStatus, 'PASS');
  await assert.rejects(() => certifyCountyPackage({ packagePath: files.packagePath, county: files.county, fips: files.fips }), /requires --certificate/);
});
