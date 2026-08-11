import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildArtifacts, reconcileActivationEligibility, stableJson } from '../tools/lp1888/reconcile-activation-eligibility.mjs';

const root = new URL('../', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const sha = async name => createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
const protectedFiles = ['js/app.js', 'data/lp150/candidate-membership-contract.json', 'reports/lp1887/owner-promotion-authorization.json',
  'reports/lp1887/community-package-promotion-only-registry.json', 'data/generated/lp104/txgio-addresses/manifest.json'];

test('reconciles all 254 canonical promoted identities without equating promotion to activation', () => {
  const { matrix, summary } = buildArtifacts();
  assert.equal(matrix.records.length, 254);
  assert.deepEqual(matrix.records.map(row => row.countyFips), [...matrix.records.map(row => row.countyFips)].sort());
  assert.equal(new Set(matrix.records.map(row => row.countyFips)).size, 254);
  assert.ok(matrix.records.every(row => /^48\d{3}$/.test(row.countyFips)));
  assert.ok(matrix.records.every(row => row.communityPackagePromoted && /^[a-f0-9]{64}$/.test(row.packageSha256)));
  assert.equal(summary.currentlyOperationalCount, 28);
  assert.equal(summary.restrictedCountyCount, 11);
  assert.equal(summary.newStructurallyActivationEligibleCount, 0);
  assert.equal(summary.newActivatedCount, 0);
  assert.equal(summary.totalPotentialOperationalAfterAuthorizedActivation, 28);
  assert.equal(summary.currentlyOperationalCount + summary.newStructurallyActivationEligibleCount, summary.totalPotentialOperationalAfterAuthorizedActivation);
  assert.equal(summary.currentlyOperationalCount + summary.otherDependencyBlockedCount + summary.addressBlockedCount, 254);
  assert.ok(matrix.records.filter(row => row.currentOperationalStatus === 'ALREADY_OPERATIONAL').every(row => row.structuralActivationEligibility === 'ALREADY_OPERATIONAL_NOT_NEW_ELIGIBILITY'));
  assert.ok(matrix.records.filter(row => row.currentOperationalStatus === 'NOT_OPERATIONAL').every(row => row.activationStatus === 'NOT_ACTIVATED' && row.blockingReasons.length));
});

test('restrictions and non-universal crossing and roadway policy remain fail closed', () => {
  const { matrix, restrictedCounties } = buildArtifacts();
  const restricted = matrix.records.filter(row => row.restrictionStatus === 'ACTIVE_PRESERVED');
  assert.equal(restricted.length, 11);
  assert.ok(restricted.every(row => row.addressDependencyStatus === 'BLOCKED_EXACT_PAYLOAD_RESTORATION_REQUIRED'));
  assert.ok(restricted.every(row => row.structuralActivationEligibility === 'NOT_STRUCTURALLY_ACTIVATION_ELIGIBLE'));
  assert.ok(restrictedCounties.every(row => !row.activationEligible && row.requiredCertificationPasses === 2));
  assert.ok(matrix.records.every(row => row.crossingDependencyStatus === 'OPTIONAL_CAPABILITY_NOT_UNIVERSAL_ACTIVATION_GATE'));
  assert.ok(matrix.records.every(row => row.roadwayDependencyStatus === 'NOT_ESTABLISHED_AS_UNIVERSAL_ACTIVATION_GATE'));
});

test('owner activation authority is separate, explicit, FIPS-bound, and promotion authority is unusable', async () => {
  const { matrix, ownerAuthorization, summary } = buildArtifacts();
  const promotionAuthorization = await json('reports/lp1887/owner-promotion-authorization.json');
  assert.equal(promotionAuthorization.activationAuthorized, false);
  assert.equal(ownerAuthorization.authorizationScope, 'EXPLICIT_COUNTY_FIPS');
  assert.equal(ownerAuthorization.activationAuthorized, false);
  assert.equal(ownerAuthorization.runtimeMutationAuthorized, false);
  assert.equal(summary.ownerActivationAuthorizedCount, 0);
  assert.ok(matrix.records.every(row => row.ownerActivationAuthorizationStatus !== 'OWNER_AUTHORIZED'));
});

test('unknown and inconsistent evidence fails closed', async () => {
  const inputs = { identities: await json('data/lp149/runtime-county-registry.json'), promotion: await json('reports/lp1887/community-package-promotion-only-registry.json'),
    restrictions: await json('reports/lp186/county-restriction-reconciliation.json'), addressManifest: await json('data/generated/lp104/txgio-addresses/manifest.json'),
    certification: await json('evidence/lp135/statewide-certification.json'), membership: await json('data/lp150/membership-transition-registry.json'),
    enablement: await json('data/lp152/operational-enablement-registry.json'), execution: await json('data/lp153/operational-execution-registry.json') };
  inputs.promotion.records = inputs.promotion.records.slice(1);
  const first = reconcileActivationEligibility(inputs).matrix.records[0];
  assert.equal(first.structuralActivationEligibility, 'NOT_STRUCTURALLY_ACTIVATION_ELIGIBLE');
  assert.ok(first.blockingReasons.includes('COMMUNITY_PROMOTION_IDENTITY_MISSING_OR_INVALID'));
});

test('two builds are byte-identical and audit performs no protected mutation', async () => {
  const before = await Promise.all(protectedFiles.map(sha));
  const one = buildArtifacts(), two = buildArtifacts();
  assert.equal(stableJson(one), stableJson(two));
  assert.deepEqual(await Promise.all(protectedFiles.map(sha)), before);
  assert.equal(one.summary.runtimeOperationalCountChanged, false);
  assert.equal(one.summary.restrictedCountyStateChanged, false);
});
