import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { build, verify, auditRuntimeMembership } from '../tools/lp148/build-statewide-runtime-geometry.mjs';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function membershipSha256(members) { return createHash('sha256').update(canonicalJson(members)).digest('hex'); }
const gates = [1, 2, 3, 4, 5, 6, 7].map(gate => ({ gate, status: 'NOT_EVALUATED', evidenceRef: 'fixture' }));
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'lp148-'));
  const features = [
    { type: 'Feature', properties: { STATEFP: '48', GEOID: '48003', NAME: 'Beta', NAMELSAD: 'Beta County' }, geometry: { type: 'Polygon', coordinates: [[[1,0],[2,0],[2,1],[1,1],[1,0]]] } },
    { type: 'Feature', properties: { STATEFP: '48', GEOID: '48001', NAME: 'Alpha', NAMELSAD: 'Alpha County' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } }
  ];
  const source = join(dir, 'source.geojson');
  await writeFile(source, JSON.stringify({ type: 'FeatureCollection', features }));
  const approvedCounties = [
    { countyId: 'alpha-tx', displayName: 'Alpha County', fips: '48001', identityEvidenceRef: 'fixture', gates },
    { countyId: 'beta-tx', displayName: 'Beta County', fips: '48003', identityEvidenceRef: 'fixture', gates }
  ];
  const membership = { schemaVersion: '1.0.0', contractVersion: '1.0.0', contractKind: 'FUTURE_APPROVAL_DRAFT', approval: { status: 'APPROVED_FOR_PACKAGE_GENERATION' }, approvedCountyCount: 2, existingBaselineCountyCount: 0, newlyApprovedCountyCount: 2, approvedCounties, permissions: { prepareGeometry: { authorized: true, authorityRef: 'fixture' }, generateRuntimePackage: { authorized: true, authorityRef: 'fixture' }, deploy: { authorized: false, authorityRef: 'fixture' }, activateRuntime: { authorized: false, authorityRef: 'fixture' }, storageUpload: { authorized: false, authorityRef: 'fixture' } }, provenance: { membershipSha256: membershipSha256(approvedCounties) } };
  const membershipPath = join(dir, 'membership.json');
  await writeFile(membershipPath, JSON.stringify(membership));
  return { source, membershipPath };
}

test('LP148 builder sorts fixture counties by governed FIPS without changing geometry', async () => {
  const f = await fixture();
  const first = build({ sourcePath: f.source, membershipPath: f.membershipPath, expectedCount: 2, packagePath: 'tmp/pkg.json', manifestPath: 'tmp/manifest.json' });
  const second = build({ sourcePath: f.source, membershipPath: f.membershipPath, expectedCount: 2, packagePath: 'tmp/pkg.json', manifestPath: 'tmp/manifest.json' });
  assert.equal(first.packageText, second.packageText);
  assert.deepEqual(first.manifest.validation, { exactTexasCountyCount: true, deterministicFipsOrdering: true, deploymentPerformed: false, activationPerformed: false });
  const pkg = JSON.parse(first.packageText);
  assert.deepEqual(pkg.counties.map(c => c.fips), ['48001', '48003']);
  assert.deepEqual(pkg.counties[0].geometry.coordinates, [[[0,0],[1,0],[1,1],[0,1],[0,0]]]);
});

test('LP148 builder fails closed on missing, duplicate, or unexpected counties', async () => {
  const f = await fixture();
  assert.throws(() => build({ sourcePath: f.source, membershipPath: f.membershipPath, expectedCount: 3 }), /exactly 3 counties/);
  const dir = await mkdtemp(join(tmpdir(), 'lp148-bad-'));
  const duplicate = join(dir, 'dup.geojson');
  await writeFile(duplicate, JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { GEOID: '48001' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } },
    { type: 'Feature', properties: { GEOID: '48001' }, geometry: { type: 'Polygon', coordinates: [[[1,0],[2,0],[2,1],[1,1],[1,0]]] } }
  ] }));
  assert.throws(() => build({ sourcePath: duplicate, membershipPath: f.membershipPath, expectedCount: 2 }), /duplicate county FIPS/);
});

test('LP148 production preflight remains read-only and audits current runtime membership', () => {
  const planned = build({ write: false });
  assert.equal(planned.manifest.countyCount, 254);
  assert.equal(planned.manifest.validation.activationPerformed, false);
  assert.equal(auditRuntimeMembership().runtimeMembershipUnchanged, true);
  assert.equal(verify().countyCount, 254);
});
