import assert from 'node:assert/strict';
import test from 'node:test';
import { build, buildPolicy, candidateIdentity, CANDIDATE_COMMIT, evaluateScope, verify } from '../../tools/lp182/build-scope-aware-validation-policy.mjs';

const policy = buildPolicy();
const valid = { hostname: policy.hostname, purpose: policy.purpose, audience: policy.audience, candidateCommit: policy.candidateCommit, candidateIdentity: policy.candidateIdentity, operation: 'DEPLOYMENT', accessControlReady: true, rollbackReady: true, ownerApprovalEvidence: 'future-explicit-evidence' };

test('global authorization remains fail-closed and separate from scoped capability', () => {
  assert.equal(policy.scopedAuthorizationSupported, true);
  assert.deepEqual(policy.globalAuthorizationStates, { deployment: 'NOT_AUTHORIZED', distribution: 'NOT_AUTHORIZED', activation: 'NOT_AUTHORIZED', publicLaunch: 'NOT_AUTHORIZED', restore: 'NOT_AUTHORIZED', rollback: 'NOT_AUTHORIZED' });
  const mutated = structuredClone(policy); mutated.deploymentAllowedWithinScope = true;
  assert.equal(mutated.globalAuthorizationStates.deployment, 'NOT_AUTHORIZED');
});

test('current scope needs explicit owner approval and prerequisite evidence', () => {
  assert.equal(policy.scopeStatus, 'POLICY_READY_OWNER_APPROVAL_REQUIRED');
  assert.equal(evaluateScope({ ...valid, ownerApprovalEvidence: '' }).status, 'POLICY_READY_OWNER_APPROVAL_REQUIRED');
  assert.equal(evaluateScope(valid).status, 'AUTHORIZED');
});

test('exact hostname, purpose, audience, commit, and protected identity fail closed', () => {
  assert.equal(evaluateScope({ ...valid, hostname: 'gridlygo.com' }).reason, 'HOSTNAME_MISMATCH');
  assert.equal(evaluateScope({ ...valid, hostname: '*.gridlygo.com' }).status, 'NOT_AUTHORIZED');
  assert.equal(evaluateScope({ ...valid, purpose: 'PUBLIC_LAUNCH' }).reason, 'PURPOSE_MISMATCH');
  assert.equal(evaluateScope({ ...valid, audience: 'PUBLIC' }).reason, 'AUDIENCE_MISMATCH');
  assert.equal(evaluateScope({ ...valid, candidateCommit: `${CANDIDATE_COMMIT}-later` }).status, 'STALE_CANDIDATE');
  assert.equal(evaluateScope({ ...valid, candidateIdentity: 'sha256:changed' }).reason, 'PROTECTED_ARTIFACT_MISMATCH');
  assert.deepEqual({ candidateIdentity: policy.candidateIdentity, protectedArtifacts: policy.protectedArtifacts }, candidateIdentity());
});

test('unknown and globally prohibited operations remain prohibited', () => {
  for (const operation of ['ACTIVATION', 'PUBLIC_LAUNCH', 'CANONICAL_PRODUCTION_PROMOTION', 'APP_STORE_DISTRIBUTION', 'MARKETING', 'BETA_REOPENING', 'UNKNOWN']) assert.equal(evaluateScope({ ...valid, operation }).status, 'NOT_AUTHORIZED');
  for (const allowed of ['activationAllowedWithinScope', 'publicLaunchAllowedWithinScope', 'canonicalProductionPromotionAllowed', 'appStoreDistributionAllowed', 'automaticDeploymentAllowed', 'marketingAllowed', 'betaReopeningAllowed']) assert.equal(policy[allowed], false);
});

test('expiration, revocation, access control, and rollback requirements close scope', () => {
  assert.equal(evaluateScope({ ...valid, expired: true }).status, 'EXPIRED');
  assert.equal(evaluateScope({ ...valid, revoked: true }).status, 'REVOKED');
  assert.equal(evaluateScope({ ...valid, accessControlReady: false }).reason, 'ACCESS_CONTROL_REQUIRED');
  assert.equal(evaluateScope({ ...valid, rollbackReady: false }).reason, 'ROLLBACK_PREREQUISITE_MISSING');
  assert.equal(policy.rollbackRequirement, 'REQUIRED_BEFORE_SCOPED_DEPLOYMENT');
  assert.equal(policy.restoreApplicabilityWithinScope, 'NOT_APPLICABLE_WITHIN_PREVIEW_SCOPE');
});

test('malformed policy fails closed', () => assert.equal(evaluateScope(valid, {}).status, 'NOT_AUTHORIZED'));

test('LP182 records zero execution and no protected-system or runtime changes', () => {
  const reports = build(); const authorization = reports['preview-validation-authorization.json'];
  assert.deepEqual(authorization.zeroExecution, { dnsChanges: 0, hostingConfigurationChanges: 0, deployments: 0, distributions: 0, activations: 0, publicLaunches: 0, restores: 0, rollbacks: 0 });
  assert.equal(policy.runtimeModified, false); assert.deepEqual(policy.protectedSystemsModified, []);
});

test('outputs are deterministic, canonical LF, UTF-8 without BOM, and secret-safe', () => assert.equal(verify(), true));
