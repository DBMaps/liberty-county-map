import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const evidence = await readJson('evidence/lp129/texas-address-expansion-wave-3-preflight.json');
const countyRegistry = await readJson('data/lp104/texas-counties.json');
const aggregateManifest = await readJson('data/generated/lp104/txgio-addresses/manifest.json');
const candidateManifest = await readJson('reports/lp129-wave-3/runtime-manifest.candidate.json');
const manufacturingReport = await readJson('reports/lp129-wave-3/lp1051-28-county-manufacturing-report.json');
const sha256 = async (path) => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');

function paths(county) {
  const stem = `${county.countyId}-${county.fips}`;
  return {
    filename: `${stem}.addresses.jsonl.gz`,
    package: `data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz`,
    sidecar: `data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz.json`,
    certificate: `reports/lp129-wave-3/certificates/${stem}.runtime-certificate.json`,
    certification: `reports/lp129-wave-3/certification/${stem}.certification.json`
  };
}

async function auditJsonl(county) {
  let records = 0;
  const decompressedHash = createHash('sha256');
  const gunzip = createReadStream(new URL(paths(county).package, root)).pipe(createGunzip());
  gunzip.on('data', (chunk) => decompressedHash.update(chunk));
  for await (const line of createInterface({ input: gunzip, crlfDelay: Infinity })) {
    if (!line) continue;
    const record = JSON.parse(line);
    assert.equal(record.f, county.fips);
    assert.equal(record.c, county.county.replace(/ County$/, ''));
    records += 1;
  }
  return { records, decompressedSha256: decompressedHash.digest('hex') };
}

test('LP129 governs the exact manufactured Wave 3 cohort and source identity', () => {
  assert.equal(evidence.status, 'CANDIDATE_MANUFACTURING_COMPLETE');
  assert.equal(evidence.ownerManufacturingCommit, '7c558757');
  assert.equal(evidence.source.identity, 'TxGIO 2026 Statewide Address Points');
  assert.deepEqual(evidence.counties.map(({ county, fips }) => [county, fips]), [
    ['Burleson County', '48051'], ['Trinity County', '48455'], ['Victoria County', '48469']
  ]);
  for (const expected of evidence.counties) {
    const registered = countyRegistry.counties.find(({ fips }) => fips === expected.fips);
    assert.deepEqual([registered.countyId, `${registered.countyName} County`], [expected.countyId, expected.county]);
  }
});

test('LP129 packages completely gunzip, parse as JSONL, and retain county identity', async () => {
  for (const county of evidence.counties) {
    const artifact = paths(county);
    const sidecar = await readJson(artifact.sidecar);
    const content = await auditJsonl(county);
    assert.equal((await stat(new URL(artifact.package, root))).size, county.packageBytes);
    assert.equal(await sha256(artifact.package), county.packageSha256);
    assert.deepEqual(content, { records: county.acceptedRecords, decompressedSha256: county.decompressedSha256 });
    assert.deepEqual(
      [sidecar.county, sidecar.fips, sidecar.sourceRecordsRead, sidecar.acceptedRecords, sidecar.rejectedRecords, sidecar.duplicates, sidecar.outputBytes, sidecar.packageHash],
      [county.county.replace(/ County$/, ''), county.fips, county.sourceRecordsRead, county.acceptedRecords, county.rejectedRecords, county.duplicates, county.packageBytes, county.packageSha256]
    );
  }
});

test('LP129 main manifest has 34 unique FIPS and package filenames and agrees with the cohort', () => {
  assert.equal(aggregateManifest.packages.length, 34);
  assert.equal(new Set(aggregateManifest.packages.map(({ fips }) => fips)).size, 34);
  const filenames = aggregateManifest.packages.map(({ outputPath }) => outputPath.split(/[\\/]/).at(-1));
  assert.equal(new Set(filenames).size, 34);
  for (const county of evidence.counties) {
    const entry = aggregateManifest.packages.find(({ fips }) => fips === county.fips);
    assert.equal(entry.outputPath.split(/[\\/]/).at(-1), paths(county).filename);
    assert.deepEqual(
      [entry.county, entry.sourceRecordsRead, entry.acceptedRecords, entry.rejectedRecords, entry.duplicates, entry.outputBytes, entry.packageHash],
      [county.county.replace(/ County$/, ''), county.sourceRecordsRead, county.acceptedRecords, county.rejectedRecords, county.duplicates, county.packageBytes, county.packageSha256]
    );
  }
});

test('LP129 certificates and reports agree with committed package bytes', async () => {
  for (const county of evidence.counties) {
    const artifact = paths(county);
    const certificate = await readJson(artifact.certificate);
    const certification = await readJson(artifact.certification);
    const report = manufacturingReport.counties.find(({ fips }) => fips === county.fips);
    assert.deepEqual([certificate.county, certificate.fips, certificate.artifact, certificate.sizeBytes, certificate.sha256], [county.county, county.fips, artifact.filename, county.packageBytes, county.packageSha256]);
    assert.deepEqual([certification.county, certification.countyFips, certification.packageSize, certification.sha256, certification.indexedAddressCount, certification.certificationStatus], [county.county, county.fips, county.packageBytes, county.packageSha256, county.acceptedRecords, 'PASS']);
    assert.deepEqual([report.county, report.packagePath, report.packageSize, report.sha256, report.indexedAddressCount], [county.county, artifact.package, county.packageBytes, county.packageSha256, county.acceptedRecords]);
  }
  assert.deepEqual([manufacturingReport.completedCount, manufacturingReport.successCount, manufacturingReport.failureCount, manufacturingReport.activated], [3, 3, 0, false]);
});

test('LP129 candidate manifest is exact, reconciled, and inactive', () => {
  assert.equal(candidateManifest.activated, false);
  assert.deepEqual(candidateManifest.packages.map(({ fips }) => fips), evidence.counties.map(({ fips }) => fips));
  for (const county of evidence.counties) {
    const entry = candidateManifest.packages.find(({ fips }) => fips === county.fips);
    assert.deepEqual([entry.county, entry.path, entry.sizeBytes, entry.sha256], [county.county, paths(county).package, county.packageBytes, county.packageSha256]);
  }
});

test('LP129 determinism and protected boundaries remain explicit', async () => {
  assert.equal(evidence.determinism.firstCommittedHashesReconciled, true);
  assert.equal(evidence.determinism.ownerRerunEvidencePresent, false);
  assert.match(evidence.determinism.comparisonCommand, /reconcile-package-rerun\.mjs/);
  assert.equal(await sha256('data/generated/lp104/txgio-addresses/runtime-manifest.json'), evidence.audit.productionRuntimeManifestSha256);
  assert.deepEqual(evidence.boundaries, {
    candidateOnly: true, candidateApproval: false, productionAuthorization: false, runtimeEligible: false,
    storageUploadOccurred: false, supabaseChangesOccurred: false, deploymentOccurred: false,
    runtimeActivated: false, protectedSystemsChanged: false, productionRuntimeManifestChanged: false
  });
});
