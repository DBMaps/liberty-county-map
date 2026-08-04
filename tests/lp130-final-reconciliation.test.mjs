import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async relativePath => JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
const reconciliation = await readJson('evidence/lp130/final-reconciliation.json');
const manifest = await readJson('data/generated/lp104/txgio-addresses/manifest.json');

test('corrected authoritative package inventory replaces the partial-checkout failure', () => {
  assert.deepEqual(reconciliation.supersedes, {
    conclusion: 'FAILED',
    packageFilesPresent: 59,
    missingPackages: 195,
    disposition: 'REPLACED',
    cause: 'The prior reconciliation audited an incomplete checkout that contained the 34-package baseline plus batch 01 (25 packages), rather than the complete authoritative manufacturing repository.'
  });
  assert.deepEqual(reconciliation.packageIntegrity, {
    classification: 'PASS',
    manifestEntries: 254,
    packageFilesPresent: 254,
    sidecarsPresent: 254,
    uniqueManifestFips: 254,
    uniquePackageNames: 254,
    missingPackages: [],
    missingSidecars: [],
    unlistedPackages: [],
    packageIntegrityFailures: []
  });
});

test('manifest identities and complete reconciliation inventory are unique', () => {
  const manifestFips = manifest.packages.map(item => item.fips);
  const inventoryFips = reconciliation.packageInventory.map(item => item.fips);
  const packageNames = reconciliation.packageInventory.map(item => item.packageName);
  const sidecarNames = reconciliation.packageInventory.map(item => item.sidecarName);
  assert.equal(manifest.packages.length, 254);
  assert.equal(new Set(manifestFips).size, 254);
  assert.deepEqual(inventoryFips, manifestFips);
  assert.equal(new Set(inventoryFips).size, 254);
  assert.equal(new Set(packageNames).size, 254);
  assert.equal(new Set(sidecarNames).size, 254);
  assert.ok(reconciliation.packageInventory.every(item => item.sidecarName === `${item.packageName}.json`));
});

test('all governed batch evidence is complete with zero integrity failures', async () => {
  assert.deepEqual(reconciliation.batchEvidence.batches.map(item => item.manufacturedCountyCount), [25, 25, 25, 25, 25, 25, 25, 25, 20]);
  assert.equal(reconciliation.batchEvidence.batches.reduce((sum, item) => sum + item.manufacturedCountyCount, 0), 220);
  for (const summary of reconciliation.batchEvidence.batches) {
    const validation = await readJson(`reports/lp130-statewide-addresses/${summary.batch}/validation-report.json`);
    const hashes = await readJson(`reports/lp130-statewide-addresses/${summary.batch}/package-hashes.json`);
    assert.equal(validation.status, 'MANUFACTURING_COMPLETE');
    assert.equal(validation.packageIntegrityFailureCount, 0);
    assert.equal(hashes.packages.length, summary.manufacturedCountyCount);
    assert.equal(summary.packageHashEntries, hashes.packages.length);
  }
});

test('certification blockers remain unchanged and separate from integrity', () => {
  assert.equal(reconciliation.certificationBlockedInventory.classification, 'UNCHANGED');
  assert.deepEqual(reconciliation.certificationBlockedInventory.counties.map(item => item.fips), [
    '48019', '48027', '48043', '48061', '48073', '48113', '48121',
    '48135', '48229', '48329', '48377', '48401', '48425', '48441'
  ]);
  assert.equal(reconciliation.certificationBlockedInventory.count, 14);
});

test('runtime protection and candidate-only boundary remain intact', async () => {
  const runtimeManifest = await readFile(new URL('data/generated/lp104/txgio-addresses/runtime-manifest.json', root));
  const runtimeHash = createHash('sha256').update(runtimeManifest).digest('hex');
  assert.equal(runtimeHash, reconciliation.runtimeProtection.productionRuntimeManifestSha256Before);
  assert.equal(runtimeHash, reconciliation.runtimeProtection.productionRuntimeManifestSha256After);
  assert.equal(reconciliation.runtimeProtection.runtimeChanged, false);
  assert.equal(reconciliation.runtimeProtection.storageChanged, false);
  assert.equal(reconciliation.runtimeProtection.supabaseChanged, false);
  assert.deepEqual(reconciliation.candidateOnlyBoundary, {
    classification: 'PASS', candidateOnly: true, activated: false, runtimeActivationAuthorized: false
  });
  assert.equal(reconciliation.finalRecommendation, 'Merge as statewide candidate-only manufacturing evidence.');
});
