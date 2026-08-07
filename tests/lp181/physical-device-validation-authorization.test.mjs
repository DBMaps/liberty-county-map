import assert from 'node:assert/strict';
import test from 'node:test';
import { build, CANDIDATE_COMMIT, candidateIdentity, verify } from '../../tools/lp181/authorize-physical-device-validation-preview.mjs';

const report = () => build()['physical-device-validation-deployment-authorization.json'];

test('scope is exact, bound to the governed candidate, and cannot expand', () => {
  const value = report();
  assert.equal(value.validationHostname, 'preview.gridlygo.com');
  assert.deepEqual(value.authorizationScope.requestedScope.hostname, 'preview.gridlygo.com');
  assert.equal(value.candidateCommit, CANDIDATE_COMMIT);
  assert.deepEqual(value.candidateProtectedIdentity, candidateIdentity());
  assert.equal(JSON.stringify(value.authorizationScope).includes('www.gridlygo.com'), false);
});

test('all launch, promotion, store, restore, and rollback authority stays fail closed', () => {
  const value = report();
  for (const key of ['deploymentAuthorization', 'distributionAuthorization', 'activationAuthorization', 'publicLaunchAuthorization', 'canonicalProductionPromotionAuthorization', 'appStoreDistributionAuthorization', 'restoreAuthorization', 'rollbackAuthorization']) assert.equal(value[key], 'NOT_AUTHORIZED');
});

test('LP181 performs zero execution and modifies no protected runtime', () => {
  const value = report();
  for (const key of ['performsDeployment', 'performsDnsChange', 'performsActivation', 'performsDistribution', 'performsPublicLaunch', 'performsRestore', 'performsRollback', 'runtimeModified']) assert.equal(value[key], false);
  assert.deepEqual(value.protectedSystemsModified, []);
});

test('authorization fails closed if a required preview prerequisite is removed', () => {
  const value = report();
  const missing = value.remainingBlockers.slice(1);
  const rebuilt = build(undefined, missing)['physical-device-validation-deployment-authorization.json'];
  assert.equal(rebuilt.classification, 'NOT_AUTHORIZED');
  assert.equal(rebuilt.deploymentAuthorization, 'NOT_AUTHORIZED');
});

test('committed output is byte-deterministic, canonical, and secret-safe', () => assert.equal(verify(), true));
