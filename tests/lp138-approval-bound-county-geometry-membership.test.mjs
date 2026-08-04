import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { membershipSha256, validateMembershipContract } from '../tools/lp138/validate-county-geometry-membership.mjs';

const draft = JSON.parse(await readFile(new URL('../evidence/lp138/county-geometry-membership-contract.draft.json', import.meta.url)));
const baseline = JSON.parse(await readFile(new URL('../evidence/lp138/county-geometry-membership-contract.baseline.json', import.meta.url)));
const require = createRequire(import.meta.url);
const { extractRegistry } = require('../tools/build-gridly-authoritative-county-geometry.js');
const runtimePackage = require('../assets/location-resolution/gridly-authoritative-county-geometry-v1.json');
const clone = value => structuredClone(value);
const gates = () => Array.from({ length: 7 }, (_, index) => ({
  gate: index + 1, name: `Gate ${index + 1}`, status: 'PASS', evidenceRef: `evidence/gate-${index + 1}.json`,
  evidenceSha256: '0'.repeat(64), evaluatedAt: '2026-08-04T00:00:00Z', reviewer: 'fixture-reviewer'
}));
const members = [
  { countyId: 'alpha', fips: '48001', displayName: 'Alpha County', identityEvidenceRef: 'identity/48001', activationEvidenceRefs: ['approval/a'], gates: gates() },
  { countyId: 'beta', fips: '48003', displayName: 'Beta County', identityEvidenceRef: 'identity/48003', activationEvidenceRefs: ['approval/b'], gates: gates() }
];

function boundaryFips(boundaryPath) {
  const geojson = JSON.parse(readFileSync(new URL(`../${boundaryPath}`, import.meta.url)));
  const properties = (geojson.type === 'FeatureCollection' ? geojson.features[0] : geojson).properties || {};
  return properties.GEOID || properties.FIPS;
}

function contractFor(state, permissions = {}) {
  const value = clone(draft);
  value.approval.status = state;
  value.approval.candidateOnly = state !== 'APPROVED_FOR_RUNTIME_ACTIVATION';
  value.approvedCounties = clone(members);
  value.approvedCountyCount = members.length;
  value.newlyApprovedCountyCount = members.length;
  value.provenance.membershipSha256 = membershipSha256(value.approvedCounties);
  for (const [name, authorized] of Object.entries(permissions)) value.permissions[name].authorized = authorized;
  return value;
}

test('LP138 committed contract is explicitly empty, candidate-only, and non-authorizing', () => {
  assert.equal(validateMembershipContract(draft), true);
  assert.equal(draft.approvedCountyCount, 0);
  assert.equal(draft.approval.status, 'DRAFT');
  assert.equal(draft.contractKind, 'FUTURE_APPROVAL_DRAFT');
  assert.ok(Object.values(draft.permissions).every(permission => permission.authorized === false));
  assert.throws(() => validateMembershipContract(draft, { expectedContractKind: 'CURRENT_OPERATIONAL_BASELINE' }), /not CURRENT_OPERATIONAL_BASELINE/);
});

test('LP138 baseline exactly reconciles the current operational registry and runtime package', () => {
  const registryMembers = Object.entries(extractRegistry())
    .filter(([, entry]) => entry.operational === true)
    .map(([countyId, entry]) => ({ countyId, fips: boundaryFips(entry.boundaryPath) }));
  const packageMembers = runtimePackage.counties.map(({ countyId, source }) => ({ countyId, fips: boundaryFips(source.boundaryPath) }));

  assert.equal(validateMembershipContract(baseline, {
    expectedContractKind: 'CURRENT_OPERATIONAL_BASELINE', registryMembers, packageMembers
  }), true);
  assert.equal(baseline.approvedCountyCount, 28);
  assert.equal(baseline.existingBaselineCountyCount, 28);
  assert.equal(baseline.newlyApprovedCountyCount, 0);
  assert.ok(Object.values(baseline.permissions).every(permission => permission.authorized === false));
});

test('LP138 baseline rejects missing, added, and substituted operational identities', () => {
  const exact = baseline.approvedCounties.map(({ countyId, fips }) => ({ countyId, fips }));
  assert.throws(() => validateMembershipContract(baseline, { registryMembers: exact.slice(1) }), /does not equal/);
  assert.throws(() => validateMembershipContract(baseline, { packageMembers: [...exact, { countyId: 'unauthorized-tx', fips: '48999' }] }), /does not equal/);
  assert.throws(() => validateMembershipContract(baseline, { packageMembers: exact.map((row, index) => index ? row : { ...row, countyId: 'substitute-tx' }) }), /does not equal/);
  assert.throws(() => validateMembershipContract(baseline, { packageMembers: exact.map((row, index) => index ? row : { ...row, fips: '48999' }) }), /does not equal/);
});

test('LP138 accepts an exact FIPS-ordered set and matching registry/package identities', () => {
  const contract = contractFor('APPROVED_FOR_PACKAGE_GENERATION', { generateRuntimePackage: true });
  const identities = members.map(({ countyId, fips }) => ({ countyId, fips }));
  assert.equal(validateMembershipContract(contract, { registryMembers: identities, packageMembers: identities }), true);
});

test('LP138 rejects count drift, duplicates, ordering drift, and provenance drift', () => {
  const count = contractFor('EVIDENCE_COMPLETE'); count.approvedCountyCount = 3;
  assert.throws(() => validateMembershipContract(count), /declared count/);
  const duplicate = contractFor('EVIDENCE_COMPLETE'); duplicate.approvedCounties[1].countyId = 'alpha'; duplicate.provenance.membershipSha256 = membershipSha256(duplicate.approvedCounties);
  assert.throws(() => validateMembershipContract(duplicate), /duplicate/);
  const order = contractFor('EVIDENCE_COMPLETE'); order.approvedCounties.reverse(); order.provenance.membershipSha256 = membershipSha256(order.approvedCounties);
  assert.throws(() => validateMembershipContract(order), /ascending FIPS/);
  const hash = contractFor('EVIDENCE_COMPLETE'); hash.provenance.membershipSha256 = '0'.repeat(64);
  assert.throws(() => validateMembershipContract(hash), /hash mismatch/);
});

test('LP138 rejects omissions, unauthorized additions, and ID/FIPS substitutions', () => {
  const contract = contractFor('EVIDENCE_COMPLETE');
  assert.throws(() => validateMembershipContract(contract, { packageMembers: [members[0]] }), /does not equal/);
  assert.throws(() => validateMembershipContract(contract, { registryMembers: [...members, { countyId: 'extra', fips: '48005' }] }), /does not equal/);
  assert.throws(() => validateMembershipContract(contract, { packageMembers: [{ countyId: 'wrong', fips: '48001' }, members[1]] }), /does not equal/);
});

test('LP138 keeps package, deployment, and runtime activation permissions independent', () => {
  assert.throws(() => validateMembershipContract(contractFor('APPROVED_FOR_PACKAGE_GENERATION', { deploy: true })), /deployment lacks/);
  assert.throws(() => validateMembershipContract(contractFor('APPROVED_FOR_DEPLOYMENT', { activateRuntime: true })), /runtime activation lacks/);
  const blocked = contractFor('APPROVED_FOR_RUNTIME_ACTIVATION', { activateRuntime: true });
  blocked.approvedCounties[0].gates[6].status = 'BLOCKED'; blocked.provenance.membershipSha256 = membershipSha256(blocked.approvedCounties);
  assert.throws(() => validateMembershipContract(blocked), /Gates 1–7 PASS/);
});
