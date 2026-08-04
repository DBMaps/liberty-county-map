import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { writeOperationalAuthorizations } from '../tools/lp144/manufacture-operational-authorizations.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const sha256 = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');

test('evaluates every LP143 template once in deterministic FIPS order', async () => {
  const registry = await json('reports/lp144/operational-authorizations.json');
  const templateNames = (await readdir(new URL('reports/lp143/templates/', root))).filter(name => name.startsWith('county-'));
  const fips = registry.authorizations.map(row => row.FIPS);
  assert.equal(registry.authorizations.length, templateNames.length);
  assert.deepEqual(fips, [...fips].sort());
  assert.equal(new Set(fips).size, fips.length);
});

test('records are fail-closed and use only governed states', async () => {
  const { authorizations } = await json('reports/lp144/operational-authorizations.json');
  const allowed = new Set(['NOT_READY', 'PENDING_APPROVAL', 'AUTHORIZATION_READY']);
  assert.ok(authorizations.every(row => allowed.has(row.operationalAuthorizationState)));
  assert.ok(authorizations.every(row => row.authorizationAuthority === null));
  assert.ok(authorizations.every(row => row.authorizationTimestamp === null));
  assert.ok(authorizations.every(row => row.activationAuthorization === null));
  assert.ok(authorizations.every(row => row.runtimeActivation === false));
});

test('manufacturing and planner validation are byte deterministic and activate nothing', async () => {
  const first = await writeOperationalAuthorizations({ root, verify: true });
  const second = await writeOperationalAuthorizations({ root, verify: true });
  assert.deepEqual(first, second);
  assert.ok(first.planner.waves.every(wave => wave.members.length === 0));
  assert.equal(first.summary.plannerValidation.wave0RemainsEmpty, true);
  assert.equal(first.summary.plannerValidation.activationPerformed, false);
  assert.equal(first.summary.plannerValidation.runtimeMembershipChanged, false);
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
