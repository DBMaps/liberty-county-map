import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildArtifacts, stableJson } from '../tools/lp1889/prepare-governed-readiness.mjs';

const root = new URL('../', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const sha = async name => createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
const protectedFiles = ['js/app.js', 'data/lp150/candidate-membership-contract.json', 'reports/lp1888/restricted-county-readiness.json', 'reports/lp1887/community-package-promotion-only-registry.json', 'data/generated/lp104/txgio-addresses/manifest.json', 'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json'];

test('derives exactly the 215 canonical unrestricted non-operational targets from LP188.8', async () => {
  const { matrix, summary } = buildArtifacts();
  const baseline = await json('reports/lp1888/statewide-county-activation-readiness.json');
  const expected = baseline.records.filter(r => r.currentOperationalStatus === 'NOT_OPERATIONAL' && r.restrictionStatus === 'NONE').map(r => r.countyFips);
  assert.deepEqual(matrix.records.map(r => r.countyFips), expected);
  assert.equal(matrix.records.length, 215);
  assert.ok(matrix.records.every(r => /^48\d{3}$/.test(r.countyFips) && r.restrictionStatus === 'NONE' && r.currentOperationalStatus === 'NOT_OPERATIONAL'));
  assert.equal(baseline.records.filter(r => r.currentOperationalStatus === 'ALREADY_OPERATIONAL').length, 28);
  assert.equal(baseline.records.filter(r => r.restrictionStatus === 'ACTIVE_PRESERVED').length, 11);
  assert.equal(summary.currentlyOperationalCount, 28); assert.equal(summary.restrictedCountyCount, 11); assert.equal(summary.newActivatedCount, 0);
});

test('retains promotion identity while preserving every sequential governance boundary', () => {
  const { matrix, proposedCandidacy, ownerDecision, externalRequest } = buildArtifacts();
  assert.ok(matrix.records.every(r => r.communityPackagePromoted && /^[a-f0-9]{64}$/.test(r.packageSha256)));
  assert.ok(matrix.records.every(r => r.candidacyStatus === 'CANDIDATE_NON_AUTHORIZING_PROPOSAL_PREPARED'));
  assert.ok(matrix.records.every(r => r.membershipStatus === 'NOT_APPROVED_OWNER_DECISION_REQUIRED'));
  assert.ok(matrix.records.every(r => r.deploymentPreparationStatus === 'BLOCKED_BY_MEMBERSHIP_APPROVAL' && r.deploymentExecutionStatus === 'NOT_DEPLOYED'));
  assert.ok(matrix.records.every(r => r.runtimeValidationStatus.startsWith('NOT_RUN_') && r.operationalValidationStatus === 'NOT_VALIDATED'));
  assert.ok(matrix.records.every(r => r.structuralActivationEligibility === 'NOT_STRUCTURALLY_ACTIVATION_ELIGIBLE' && r.blockingReasons.length && r.nextRequiredAction));
  assert.equal(proposedCandidacy.permissions.approval.authorized, false);
  assert.equal(ownerDecision.membershipApproved, false); assert.equal(ownerDecision.activationAuthorized, false);
  assert.equal(externalRequest.deploymentExecuted, false); assert.equal(externalRequest.runtimeValidationExecuted, false);
});

test('counts reconcile exclusively and potential operations remain the 28-county baseline', () => {
  const { summary } = buildArtifacts();
  assert.deepEqual({ target: summary.targetCountyCount, candidacyComplete: summary.candidacyCompleteCount, candidacyBlocked: summary.candidacyBlockedCount, membershipComplete: summary.membershipCompleteCount, membershipBlocked: summary.membershipBlockedCount, prepared: summary.deploymentPreparedCount, confirmed: summary.deploymentConfirmedCount, deploymentBlocked: summary.deploymentBlockedCount, runtime: summary.runtimeValidatedCount, runtimeBlocked: summary.runtimeValidationBlockedCount, eligible: summary.structurallyActivationEligibleCount, owner: summary.ownerActionRequiredCount, external: summary.externalActionRequiredCount, unresolved: summary.unresolvedCount }, { target: 215, candidacyComplete: 215, candidacyBlocked: 0, membershipComplete: 0, membershipBlocked: 215, prepared: 0, confirmed: 0, deploymentBlocked: 215, runtime: 0, runtimeBlocked: 215, eligible: 0, owner: 215, external: 215, unresolved: 215 });
  assert.equal(summary.exclusiveEndStates.reduce((n, row) => n + row.countyCount, 0), 215);
  assert.equal(summary.potentialOperationalAfterSeparateOwnerAuthorizationAndActivation, 28 + summary.structurallyActivationEligibleCount);
});

test('two builds are byte-identical and protected runtime, package, restriction, and address artifacts do not change', async () => {
  const before = await Promise.all(protectedFiles.map(sha));
  assert.equal(stableJson(buildArtifacts()), stableJson(buildArtifacts()));
  assert.deepEqual(await Promise.all(protectedFiles.map(sha)), before);
});
