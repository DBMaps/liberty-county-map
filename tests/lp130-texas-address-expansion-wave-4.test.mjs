import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const evidence = await readJson('evidence/lp130/texas-address-expansion-wave-4-preflight.json');
const lp129 = await readJson('evidence/lp129/texas-address-expansion-wave-3-preflight.json');
const registry = await readJson('data/lp104/texas-counties.json');
const manifest = await readJson('data/generated/lp104/txgio-addresses/manifest.json');

test('LP130 selects exactly five registered, FIPS-ordered, unrepresented counties', () => {
  assert.deepEqual(evidence.counties.map(({ fips }) => fips), ['48005', '48021', '48025', '48027', '48055']);
  assert.equal(evidence.counties.length, 5);
  const represented = new Set(manifest.packages.map(({ fips }) => fips));
  for (const county of evidence.counties) {
    const registered = registry.counties.find(({ fips }) => fips === county.fips);
    assert.deepEqual([registered.countyId, `${registered.countyName} County`], [county.countyId, county.county]);
    assert.equal(represented.has(county.fips), false);
    assert.ok(county.adjacentToRepresented.length > 0);
  }
});

test('LP129 committed baseline contains 34 unique packages and the Wave 3 cohort', () => {
  assert.equal(manifest.packages.length, 34);
  assert.equal(new Set(manifest.packages.map(({ fips }) => fips)).size, 34);
  assert.equal(new Set(manifest.packages.map(({ outputPath }) => outputPath.split(/[\\/]/).at(-1))).size, 34);
  assert.deepEqual(['48051', '48455', '48469'].map(fips => manifest.packages.some(entry => entry.fips === fips)), [true, true, true]);
  assert.deepEqual(evidence.lp129Baseline.requiredFipsPresent, ['48051', '48455', '48469']);
});

test('LP129 packages, sidecars, certificates, and certification reports remain committed', async () => {
  for (const county of lp129.counties) {
    const stem = `${county.countyId}-${county.fips}`;
    await Promise.all([
      access(new URL(`data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz`, root)),
      access(new URL(`data/generated/lp104/txgio-addresses/${stem}.addresses.jsonl.gz.json`, root)),
      access(new URL(`reports/lp129-wave-3/certificates/${stem}.runtime-certificate.json`, root)),
      access(new URL(`reports/lp129-wave-3/certification/${stem}.certification.json`, root))
    ]);
  }
});

test('LP129 rerun gap is reported truthfully and blocks owner manufacturing', async () => {
  await access(new URL('tools/lp129/reconcile-package-rerun.mjs', root));
  assert.equal(lp129.determinism.ownerRerunEvidencePresent, false);
  assert.equal(evidence.lp129Baseline.ownerRerunEvidencePresent, false);
  assert.equal(evidence.status, 'OWNER_MANUFACTURING_BLOCKED');
  assert.match(evidence.lp129Baseline.blocker, /rerun evidence is pending/);
});

test('LP130 remains candidate-only Phase 1 and command is exact', () => {
  assert.equal(evidence.phase1.packagesManufactured, false);
  assert.match(evidence.ownerCommand, /--fips 48005,48021,48025,48027,48055/);
  assert.match(evidence.ownerCommand, /Gridly-Source-Data\\Texas-Address-Points\\Raw\\Texas-2026\.gdb/);
  assert.deepEqual(evidence.boundaries, {
    candidateOnly: true, runtimeActivated: false, storageUploadOccurred: false,
    supabaseChangesOccurred: false, runtimeBehaviorChanged: false, protectedSystemsChanged: false
  });
});
