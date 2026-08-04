import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { ALLOWED_GATE_STATUSES, manufactureActivationDossiers, writeActivationDossiers } from '../tools/lp141/manufacture-activation-dossiers.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const plan = await json('evidence/lp140/activation-wave-planning.json');
const certification = await json('evidence/lp135/statewide-certification.json');
const result = manufactureActivationDossiers({ plan, certification });
const sha256 = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');

test('manufactures exactly one deterministic dossier for every conditionally-ready county', async () => {
  const expected = plan.counties.filter(row => row.readinessClass === 'CONDITIONALLY_READY').map(row => row.fips).sort();
  const actual = result.dossiers.map(row => row.identity.countyFips);
  assert.equal(result.dossiers.length, 243);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, 243);
  assert.deepEqual(actual, [...actual].sort());
  assert.equal((await readdir(new URL('reports/lp141/', root))).filter(name => /^county-\d{5}\.json$/.test(name)).length, 243);
});

test('gate vocabulary and evidence separation fail closed', () => {
  assert.ok(result.dossiers.every(row => row.lp132Gates.length === 7));
  assert.ok(result.dossiers.flatMap(row => row.lp132Gates).every(gate => ALLOWED_GATE_STATUSES.includes(gate.status)));
  assert.ok(result.dossiers.every(row => row.activationRecommendation === null));
  assert.ok(result.dossiers.every(row => row.failedEvidence.length === 0 && row.missingEvidence.length > 0));
  assert.deepEqual(result.summary.gateCounts.gate1, { COMPLETE: 243, INCOMPLETE: 0, NOT_OBSERVED: 0 });
  assert.deepEqual(result.summary.gateCounts.gate7, { COMPLETE: 0, INCOMPLETE: 0, NOT_OBSERVED: 243 });
});

test('committed artifacts are byte-identical to repeated manufacture', async () => {
  assert.deepEqual(manufactureActivationDossiers({ plan, certification }), result);
  await writeActivationDossiers({ root, verify: true });
});

test('planner inputs, runtime, geometry, and membership contract retain authoritative bytes', async () => {
  const expected = {
    'evidence/lp130/final-reconciliation.json': plan.sourceHashes.lp130.sha256,
    'evidence/lp131/statewide-readiness-audit.json': plan.sourceHashes.lp131.sha256,
    'evidence/lp135/statewide-certification.json': plan.sourceHashes.lp135.sha256,
    'evidence/lp136/statewide-operational-readiness.json': plan.sourceHashes.lp136.sha256,
    'evidence/lp138/county-geometry-membership-contract.draft.json': plan.sourceHashes.lp138.sha256,
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json': 'ba0e44fbaf1a396909f7aad98ace7d55a20f86a23ca9352c980f39116ed32461',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json': '7f7088e7250fca468f95edb5dd33a39bb3703e12781c9845ffe702b7d6539fe2',
    'data/generated/lp104/txgio-addresses/runtime-manifest.json': '9680601f4ecbdcd51f54523ec4b09e6757dc2dfb33a9520e4da0222c4a35963a',
    'js/app.js': '57a11cbedf834ba9a104e5ee0f96bb9976fbf94e89ebdc1d5e29452e981f019f',
    'evidence/lp138/county-geometry-membership-contract.baseline.json': '717c25ab4aa80a282d49899cd8d33d0fe6f82305ced68c0d167cf5f3d1168847'
  };
  for (const [path, hash] of Object.entries(expected)) assert.equal(await sha256(path), hash, path);
});
