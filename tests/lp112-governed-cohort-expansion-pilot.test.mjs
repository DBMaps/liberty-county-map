import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { manufacture, selectCounties, sha256File } from '../tools/lp1051/manufacture-gridly-28-address-counties.mjs';

const PILOT_FIPS = ['48051', '48455', '48469']; // Burleson, Trinity, Victoria
const canonical = JSON.parse(await readFile('data/lp104/texas-counties.json', 'utf8'));
const productionManifest = 'data/generated/lp104/txgio-addresses/runtime-manifest.json';

function fixtureRecord(county, ordinal) {
  return {
    i: createHash('sha256').update(`${county.fips}-${ordinal}`).digest('hex').slice(0, 20),
    h: String(100 + ordinal), r: `County Road ${ordinal + 1}`,
    a: `${100 + ordinal} County Road ${ordinal + 1}`, p: county.countyName,
    z: `77${String(ordinal).padStart(3, '0')}`, c: county.countyName, f: county.fips,
    x: -96 - ordinal / 100, y: 29 + ordinal / 100, s: 'LP112 deterministic contract fixture', u: '2026-08-03'
  };
}

test('selected adjacent pilot reuses LP105.1 and LP104.6 deterministically without activation', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'lp112-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packageDirectory = join(directory, 'packages');
  await mkdir(packageDirectory, { recursive: true });
  const productionBefore = await sha256File(productionManifest);
  const selected = selectCounties(canonical, { fips: PILOT_FIPS.join(',') });
  assert.deepEqual(selected.map(county => county.fips), PILOT_FIPS);
  assert.ok(selected.every(county => county.certificationCohort !== 'initial28'));

  const runBuilder = async ({ fips }) => {
    const county = selected.find(item => item.fips === fips);
    const body = gzipSync(`${[0, 1, 2].map(index => JSON.stringify(fixtureRecord(county, index))).join('\n')}\n`, { level: 9, mtime: 0 });
    const path = join(packageDirectory, `${county.countyId}-${county.fips}.addresses.jsonl.gz`);
    const packageHash = createHash('sha256').update(body).digest('hex');
    await writeFile(path, body);
    await writeFile(`${path}.json`, `${JSON.stringify({ packageHash })}\n`);
    return { packages: [{ fips, outputBytes: body.length, packageHash }] };
  };

  const runOnce = reports => manufacture({ fips: PILOT_FIPS.join(','), reports, packageDirectory }, { runBuilder });
  const first = await runOnce(join(directory, 'run-1'));
  const firstManifest = JSON.parse(await readFile(first.candidateManifestPath, 'utf8'));
  const firstHashes = Object.fromEntries(firstManifest.packages.map(entry => [entry.fips, entry.sha256]));
  const second = await runOnce(join(directory, 'run-2'));
  const secondManifest = JSON.parse(await readFile(second.candidateManifestPath, 'utf8'));

  assert.equal(first.report.successCount, 3);
  assert.equal(first.report.failureCount, 0);
  assert.equal(second.report.successCount, 3);
  assert.equal(second.report.failureCount, 0);
  assert.equal(firstManifest.activated, false);
  assert.equal(secondManifest.activated, false);
  assert.deepEqual(Object.fromEntries(secondManifest.packages.map(entry => [entry.fips, entry.sha256])), firstHashes);
  assert.ok(second.report.counties.every(county => county.resumedStatus));
  assert.ok(first.report.counties.every(county => county.lp1046CertificationStatus === 'PASS'));
  assert.ok(first.report.counties.every(county => county.indexedAddressCount === 3));

  for (const entry of firstManifest.packages) {
    const certificate = JSON.parse(await readFile(join(directory, 'run-1', 'certificates', `${entry.countyId.replace(/-tx$/, '')}-${entry.fips}.runtime-certificate.json`), 'utf8'));
    const certification = JSON.parse(await readFile(join(directory, 'run-1', 'certification', `${entry.countyId.replace(/-tx$/, '')}-${entry.fips}.certification.json`), 'utf8'));
    assert.equal(certificate.sha256, entry.sha256);
    assert.deepEqual(certificate.acceptance, { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false });
    assert.equal(certification.certificationStatus, 'PASS');
    assert.equal(certification.rejectionStatistics.truthfulNoResults, 3);
    assert.equal(certification.rejectionStatistics.interpolationAccepted, 0);
    assert.equal(certification.rejectionStatistics.nearbyHouseSubstitutions, 0);
    assert.equal(certification.integrityStatistics.outsideCounty, 0);
  }
  assert.equal(await sha256File(productionManifest), productionBefore);
});
