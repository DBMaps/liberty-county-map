import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const evidence = await readJson('evidence/lp128/texas-address-expansion-wave-2-preflight.json');
const aggregateManifest = await readJson('data/generated/lp104/txgio-addresses/manifest.json');
const candidateManifest = await readJson('reports/lp128-wave-2/runtime-manifest.candidate.json');
const manufacturingReport = await readJson('reports/lp128-wave-2/lp1051-28-county-manufacturing-report.json');

const sha256 = async (path) => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
const artifactPaths = (county) => {
  const stem = `${county.countyId}-${county.fips}`;
  return {
    package: `data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz`,
    sidecar: `data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz.json`,
    certificate: `reports/lp128-wave-2/certificates/${stem}.runtime-certificate.json`,
    certification: `reports/lp128-wave-2/certification/${stem}.certification.json`
  };
};

async function auditJsonl(county) {
  const paths = artifactPaths(county);
  let records = 0;
  let decompressedHash = createHash('sha256');
  const gunzip = createReadStream(new URL(paths.package, root)).pipe(createGunzip());
  gunzip.on('data', (chunk) => decompressedHash.update(chunk));
  for await (const line of createInterface({ input: gunzip, crlfDelay: Infinity })) {
    if (!line) continue;
    const record = JSON.parse(line);
    assert.equal(record.f, county.fips);
    records += 1;
  }
  return { records, decompressedSha256: decompressedHash.digest('hex') };
}

function packageRows(csv) {
  return csv.replace(/^\uFEFF/, '').trim().split(/\r?\n/).slice(1)
    .map((line) => line.match(/^"(.+)","(\d+)","([A-Fa-f0-9]+)"$/))
    .filter((match) => match?.[1].endsWith('.addresses.jsonl.gz'))
    .map((match) => ({ stem: match[1].split(/[\\/]/).at(-1), bytes: Number(match[2]), sha256: match[3].toLowerCase() }));
}

test('LP128 governs exactly Lee, Milam, and Robertson', () => {
  assert.equal(evidence.status, 'CANDIDATE_MANUFACTURING_COMPLETE');
  assert.equal(evidence.counties.length, 3);
  assert.deepEqual(evidence.counties.map(({ fips }) => fips), ['48287', '48331', '48395']);
  assert.deepEqual(evidence.counties.map(({ county }) => county), ['Lee County', 'Milam County', 'Robertson County']);
});

test('LP128 packages open, parse, match sidecars, and retain county identity', async () => {
  for (const county of evidence.counties) {
    const paths = artifactPaths(county);
    const packageStat = await stat(new URL(paths.package, root));
    const sidecar = await readJson(paths.sidecar);
    const content = await auditJsonl(county);
    assert.equal(packageStat.size, county.packageBytes);
    assert.equal(await sha256(paths.package), county.packageSha256);
    assert.equal(content.records, county.acceptedRecords);
    assert.equal(content.decompressedSha256, county.decompressedSha256);
    assert.deepEqual(
      [sidecar.fips, sidecar.sourceRecordsRead, sidecar.acceptedRecords, sidecar.rejectedRecords, sidecar.duplicates, sidecar.outputBytes, sidecar.packageHash],
      [county.fips, county.sourceRecordsRead, county.acceptedRecords, 0, county.duplicates, county.packageBytes, county.packageSha256]
    );
  }
});

test('LP128 aggregate manifest agrees with all three county outputs', () => {
  const expected = new Map(evidence.counties.map((county) => [county.fips, county]));
  const cohort = aggregateManifest.packages.filter(({ fips }) => expected.has(fips));
  assert.equal(cohort.length, 3);
  for (const entry of cohort) {
    const county = expected.get(entry.fips);
    assert.deepEqual(
      [entry.sourceRecordsRead, entry.acceptedRecords, entry.rejectedRecords, entry.duplicates, entry.outputBytes, entry.packageHash],
      [county.sourceRecordsRead, county.acceptedRecords, 0, county.duplicates, county.packageBytes, county.packageSha256]
    );
  }
});

test('LP128 certificates and certification reports bind to governed packages', async () => {
  for (const county of evidence.counties) {
    const paths = artifactPaths(county);
    const certificate = await readJson(paths.certificate);
    const certification = await readJson(paths.certification);
    assert.deepEqual([certificate.fips, certificate.sizeBytes, certificate.sha256], [county.fips, county.packageBytes, county.packageSha256]);
    assert.deepEqual([certification.countyFips, certification.packageSize, certification.sha256, certification.indexedAddressCount], [county.fips, county.packageBytes, county.packageSha256, county.acceptedRecords]);
    assert.equal(certification.certificationStatus, 'PASS');
  }
});

test('LP128 candidate manifest and manufacturing report contain only the intended cohort', () => {
  assert.equal(candidateManifest.activated, false);
  assert.deepEqual(candidateManifest.packages.map(({ fips }) => fips), evidence.counties.map(({ fips }) => fips));
  assert.deepEqual(manufacturingReport.counties.map(({ fips }) => fips), evidence.counties.map(({ fips }) => fips));
  assert.deepEqual([manufacturingReport.completedCount, manufacturingReport.successCount, manufacturingReport.failureCount, manufacturingReport.activated], [3, 3, 0, false]);
  for (const county of evidence.counties) {
    const candidate = candidateManifest.packages.find(({ fips }) => fips === county.fips);
    assert.deepEqual([candidate.sizeBytes, candidate.sha256], [county.packageBytes, county.packageSha256]);
  }
});

test('LP128 owner rerun package bytes are deterministic', async () => {
  const first = packageRows(await readFile(new URL('reports/lp128-wave-2/lp128-run-1-hashes.csv', root), 'utf8'));
  const second = packageRows(await readFile(new URL('reports/lp128-wave-2/lp128-run-2-hashes.csv', root), 'utf8'));
  assert.equal(first.length, 3);
  assert.deepEqual(second, first);
  assert.deepEqual(first.map(({ bytes, sha256 }) => ({ bytes, sha256 })), evidence.counties.map(({ packageBytes: bytes, packageSha256: sha256 }) => ({ bytes, sha256 })));
});

test('LP128 totals and production protections remain explicit', () => {
  const totals = evidence.counties.reduce((sum, county) => ({
    sourceRecordsRead: sum.sourceRecordsRead + county.sourceRecordsRead,
    acceptedRecords: sum.acceptedRecords + county.acceptedRecords,
    rejectedRecords: sum.rejectedRecords + county.rejectedRecords,
    duplicates: sum.duplicates + county.duplicates,
    packageBytes: sum.packageBytes + county.packageBytes
  }), { sourceRecordsRead: 0, acceptedRecords: 0, rejectedRecords: 0, duplicates: 0, packageBytes: 0 });
  assert.deepEqual(totals, evidence.totals);
  assert.deepEqual(evidence.boundaries, {
    candidateOnly: true,
    candidateApproval: false,
    productionAuthorization: false,
    runtimeEligible: false,
    storageUploadOccurred: false,
    deploymentOccurred: false,
    runtimeActivated: false,
    protectedSystemsChanged: false,
    productionRuntimeManifestChanged: false
  });
  assert.equal(evidence.sourceDatasetCommittedByLp128, false);
  assert.equal(evidence.temporaryRecordsCommittedByLp128, false);
});
