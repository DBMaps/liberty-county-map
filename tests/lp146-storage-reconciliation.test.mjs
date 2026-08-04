import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildReports, writeReports } from '../tools/lp146/reconcile-production-storage.mjs';
const json = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const sha = async path => createHash('sha256').update(await readFile(new URL(`../${path}`, import.meta.url))).digest('hex');

test('all 254 counties have unique, ascending FIPS records and restricted classifications', async () => {
  const { inventory, summary } = await buildReports();
  assert.equal(inventory.counties.length, 254); assert.equal(summary.countiesEvaluated, 254);
  const fips = inventory.counties.map(row => row.fips);
  assert.equal(new Set(fips).size, 254); assert.deepEqual(fips, [...fips].sort());
  assert.equal(new Set(inventory.counties.map(row => row.county)).size, 254);
  assert.ok(inventory.counties.every(row => inventory.classifications.includes(row.classification)));
  assert.deepEqual(inventory.classifications, ['PUBLISHED_AND_VERIFIED', 'PUBLISHED_NOT_VERIFIED', 'NOT_PUBLISHED']);
});

test('summary totals exactly reconcile objects and confirm the LP145 blocker', async () => {
  const report = await json('reports/lp146/storage-reconciliation-summary.json');
  assert.deepEqual([report.publishedAndVerified, report.publishedNotVerified, report.notPublished], [1, 0, 253]);
  assert.deepEqual(report.packageTotals, { expected: 254, present: 1, missing: 253, expectedBytes: 395765903 });
  assert.deepEqual(report.certificateTotals, { expected: 254, present: 1, missing: 253 });
  assert.equal(report.missingObjects, 506); assert.equal(report.verificationFailures, 0);
  assert.equal(report.lp145StorageConclusion, 'CONFIRMED'); assert.equal(report.storageStatus, 'BLOCKED');
  assert.equal(report.activationPerformed, false);
});

test('checked-in reports regenerate byte-identically', async () => {
  await writeReports({ verify: true });
  const first = JSON.stringify(await buildReports()); const second = JSON.stringify(await buildReports());
  assert.equal(first, second);
});

test('LP146 changes no runtime, geometry, membership, planner, or activation surface', async () => {
  const protectedHashes = {
    'js/app.js': '57a11cbedf834ba9a104e5ee0f96bb9976fbf94e89ebdc1d5e29452e981f019f',
    'supabase/functions/_shared/certified-address-identities.mjs': '66a94a8067c904daf03d1b8a9fedeee8590b67dbb3f04cdedac28e6f200af183',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json': 'ba0e44fbaf1a396909f7aad98ace7d55a20f86a23ca9352c980f39116ed32461',
    'evidence/lp138/county-geometry-membership-contract.baseline.json': '717c25ab4aa80a282d49899cd8d33d0fe6f82305ced68c0d167cf5f3d1168847',
    'evidence/lp138/county-geometry-membership-contract.draft.json': '0fda01a72ff3935e27a675849c5213a81cd3ae5a074d5e81ec15799616aa9047',
    'evidence/lp140/activation-wave-planning.json': '12c1fe4a98850344c9663ce06078ae4e60600ad08bacc4465570fa97f5a86881'
  };
  for (const [path, expected] of Object.entries(protectedHashes)) assert.equal(await sha(path), expected, path);
  const source = await readFile(new URL('../tools/lp146/reconcile-production-storage.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|storage\.from|\.upload\s*\(|deploy\s*\(|activate\s*\(/);
});
