import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { deriveActivationWavePlan } from '../tools/lp140/activation-wave-planner.mjs';
import { writeActivationAuthorizations } from '../tools/lp143/manufacture-activation-authorizations.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const sha256 = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');

test('registry is the deterministic empty governed state', async () => {
  const registry = await json('reports/lp143/activation-authorizations.json');
  assert.equal(registry.authorizationCount, 0);
  assert.deepEqual(registry.authorizations, []);
  await writeActivationAuthorizations({ root, verify: true });
  await writeActivationAuthorizations({ root, verify: true });
});

test('creates exactly 243 fail-closed templates in ascending FIPS order', async () => {
  const names = (await readdir(new URL('reports/lp143/templates/', root))).sort();
  assert.equal(names.length, 243);
  const templates = await Promise.all(names.map(name => json(`reports/lp143/templates/${name}`)));
  const fips = templates.map(row => row.fips);
  assert.deepEqual(fips, [...fips].sort());
  assert.ok(templates.every(row => row.lp132GateReferences.length === 7));
  assert.ok(templates.every(row => row.authorizationStatus === 'NOT_AUTHORIZED'));
  assert.ok(templates.every(row => row.authorizationTimestamp === null && row.authorizationAuthority === null && row.activationRecommendation === null));
  assert.ok(templates.every(row => ['operationalApproval', 'deploymentApproval', 'runtimeApproval', 'geometryApproval', 'membershipApproval'].every(key => row[key] === null)));
});

test('empty authorization recognition leaves LP140 output and every wave unchanged', async () => {
  const inputs = {
    readiness: await json('evidence/lp131/statewide-readiness-audit.json'), certification: await json('evidence/lp135/statewide-certification.json'),
    integrity: await json('evidence/lp130/final-reconciliation.json'), operational: await json('evidence/lp136/statewide-operational-readiness.json'),
    membershipDraft: await json('evidence/lp138/county-geometry-membership-contract.draft.json')
  };
  const baseline = deriveActivationWavePlan(inputs);
  const recognized = deriveActivationWavePlan({ ...inputs, authorizationRegistry: await json('reports/lp143/activation-authorizations.json') });
  assert.deepEqual(recognized, baseline);
  assert.ok(recognized.counties.every(row => row.activationAuthorization === 'NOT_AUTHORIZED'));
  assert.ok(recognized.waves.every(wave => wave.members.length === 0));
});

test('protected runtime, geometry, and membership artifacts remain byte-identical', async () => {
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
