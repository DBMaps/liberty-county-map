import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ADVANCEMENT_VOCABULARY, writeActivationEvidenceAudit } from '../tools/lp142/audit-activation-evidence.mjs';
import { deriveActivationWavePlan } from '../tools/lp140/activation-wave-planner.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const matrix = await json('reports/lp142/advancement-matrix.json');
const summary = await json('reports/lp142/summary.json');
const sha256 = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');

test('audits all 243 conditionally-ready counties exactly once in deterministic FIPS order', () => {
  assert.equal(matrix.counties.length, 243);
  assert.equal(summary.countiesAudited, 243);
  const fips = matrix.counties.map(row => row.fips);
  assert.deepEqual(fips, [...fips].sort());
  assert.deepEqual(summary.countyFips, fips);
  assert.equal(new Set(fips).size, 243);
});

test('fails closed with restricted advancement vocabulary and no activation recommendation', () => {
  const gates = matrix.counties.flatMap(row => row.gates);
  assert.ok(gates.every(gate => ADVANCEMENT_VOCABULARY.includes(gate.advancement)));
  assert.ok(matrix.counties.every(row => row.activationRecommendation === null));
  assert.ok(matrix.counties.every(row => row.activationEligible === false));
  assert.ok(gates.every(gate => gate.advancement === 'NO_CHANGE'));
  assert.equal(summary.countiesAdvancedAtLeastOneGate, 0);
  assert.equal(summary.countiesUnchanged, 243);
  assert.deepEqual(summary.activationEligibleCounties, []);
  assert.equal(summary.activationPerformed, false);
});

test('committed reports are byte-identical to repeated audit', async () => {
  await writeActivationEvidenceAudit({ root, verify: true });
  const before = [await readFile(new URL('reports/lp142/advancement-matrix.json', root)), await readFile(new URL('reports/lp142/summary.json', root))];
  await writeActivationEvidenceAudit({ root, verify: true });
  assert.deepEqual([await readFile(new URL('reports/lp142/advancement-matrix.json', root)), await readFile(new URL('reports/lp142/summary.json', root))], before);
});

test('LP140 planner is unchanged and Wave 0 remains empty', () => {
  assert.equal(summary.plannerValidation.plannerLogicModified, false);
  assert.equal(summary.plannerValidation.outputChanged, false);
  assert.equal(summary.plannerValidation.wave0RemainsEmpty, true);
  assert.deepEqual(summary.plannerValidation.waveCountyFips.map(row => row.countyFips), [[], [], [], [], []]);
  assert.doesNotMatch(deriveActivationWavePlan.toString(), /writeFile\s*\(|fetch\s*\(|deploy\s*\(|activateRuntime\s*\(/);
});

test('runtime, geometry package, and membership contracts retain authoritative bytes', async () => {
  const expected = {
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json': 'ba0e44fbaf1a396909f7aad98ace7d55a20f86a23ca9352c980f39116ed32461',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json': '7f7088e7250fca468f95edb5dd33a39bb3703e12781c9845ffe702b7d6539fe2',
    'data/generated/lp104/txgio-addresses/runtime-manifest.json': '9680601f4ecbdcd51f54523ec4b09e6757dc2dfb33a9520e4da0222c4a35963a',
    'js/app.js': '57a11cbedf834ba9a104e5ee0f96bb9976fbf94e89ebdc1d5e29452e981f019f',
    'evidence/lp138/county-geometry-membership-contract.baseline.json': '717c25ab4aa80a282d49899cd8d33d0fe6f82305ced68c0d167cf5f3d1168847',
    'evidence/lp138/county-geometry-membership-contract.draft.json': '0fda01a72ff3935e27a675849c5213a81cd3ae5a074d5e81ec15799616aa9047'
  };
  for (const [path, hash] of Object.entries(expected)) assert.equal(await sha256(path), hash, path);
});
