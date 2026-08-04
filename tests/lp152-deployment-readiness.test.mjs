import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildArtifacts, verify, stableJson, P } from '../tools/lp152/build-deployment-readiness.mjs';

const artifacts = buildArtifacts();
const registry = JSON.parse(readFileSync(P.registry, 'utf8'));
const deployment = JSON.parse(readFileSync(P.deploymentAuthorization, 'utf8'));
const activation = JSON.parse(readFileSync(P.activationAuthorization, 'utf8'));
const gates = JSON.parse(readFileSync(P.gates, 'utf8'));
const summary = JSON.parse(readFileSync(P.summary, 'utf8'));
const blockers = JSON.parse(readFileSync(P.blockers, 'utf8'));
const generated = [P.registry, P.deploymentAuthorization, P.activationAuthorization, P.gates, P.summary, P.blockers];
const protectedPaths = [P.lp138Baseline, P.lp140Planner, P.lp148Package, P.lp148Manifest, P.lp149Registry, P.lp150Transition, P.lp151Registry, P.lp151Summary];
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map((path) => [path, sha(path)])); }

test('LP152 represents all 254 Texas identities in deterministic operational enablement registry order', () => {
  assert.equal(registry.identityCount, 254);
  assert.equal(registry.counties.length, 254);
  assert.equal(new Set(registry.counties.map((county) => county.fips)).size, 254);
  assert.deepEqual(registry.counties.map((county) => county.fips), [...registry.counties.map((county) => county.fips)].sort());
  assert.equal(registry.operationalPipeline.length, 11);
});

test('LP152 preserves 28 runtime operational counties and does not change runtime selection', () => {
  assert.equal(registry.operationalCountyCount, 28);
  assert.equal(summary.operationalCountyCount, 28);
  assert.equal(summary.runtimeMembershipChanged, false);
  assert.equal(registry.runtimeMembershipChanged, false);
  assert.equal(registry.nonDeploying, true);
  assert.equal(registry.nonActivating, true);
});

test('deployment authorization layer is represented, empty, explicit-only, and non-deploying', () => {
  assert.deepEqual(deployment.model.states, ['NOT_AUTHORIZED', 'AUTHORIZED', 'DEPLOYED']);
  assert.equal(deployment.model.authorizationMustBeExplicit, true);
  assert.equal(deployment.model.authorizationMayBeInferred, false);
  assert.equal(deployment.model.deploymentMayBeInferred, false);
  assert.deepEqual(deployment.authorizations, []);
  assert.deepEqual(deployment.deployments, []);
  assert.equal(summary.deploymentAuthorizationCount, 0);
  assert.equal(summary.deploymentCount, 0);
  assert.equal(summary.deploymentAuthorizationPresent, false);
  assert.equal(summary.deploymentOccurred, false);
  assert.equal(deployment.counties.every((county) => county.authorizationState === 'NOT_AUTHORIZED'), true);
  assert.equal(deployment.counties.every((county) => county.deploymentState === 'NOT_DEPLOYED'), true);
});

test('activation authorization layer is represented, empty, explicit-only, and non-activating', () => {
  assert.deepEqual(activation.model.states, ['NOT_AUTHORIZED', 'AUTHORIZED', 'ACTIVE']);
  assert.equal(activation.model.authorizationMustBeExplicit, true);
  assert.equal(activation.model.authorizationMayBeInferred, false);
  assert.equal(activation.model.activationMayBeInferred, false);
  assert.deepEqual(activation.authorizations, []);
  assert.deepEqual(activation.activations, []);
  assert.equal(summary.activationAuthorizationCount, 0);
  assert.equal(summary.activationCount, 0);
  assert.equal(summary.activationAuthorizationPresent, false);
  assert.equal(summary.activationOccurred, false);
  assert.equal(activation.counties.every((county) => county.authorizationState === 'NOT_AUTHORIZED'), true);
  assert.equal(activation.counties.every((county) => county.activationState === 'NOT_ACTIVE'), true);
});

test('unified operational gates are sequential, fail-closed, and read-only', () => {
  assert.equal(summary.passed, true);
  assert.deepEqual(gates.gates.map((row) => row.name), ['Manufacturing', 'Certification', 'Storage', 'Geometry', 'Identity', 'Membership', 'Operational Validation', 'Deployment Authorization', 'Deployment', 'Activation Authorization', 'Activation']);
  assert.equal(gates.gates.every((row) => row.passed), true);
  assert.equal(gates.failClosed, true);
  assert.equal(gates.readOnlyValidationOnly, true);
});

test('reports are internally consistent and deterministic', () => {
  const blockerCounts = Object.fromEntries(blockers.blockerInventory.map((row) => [row.blocker, row.count]));
  assert.deepEqual(summary.remainingBlockers, blockers.blockerInventory.map((row) => ({ blocker: row.blocker, count: row.count })));
  assert.equal(blockerCounts.DEPLOYMENT_AUTHORIZATION_ABSENT, 254);
  assert.equal(blockerCounts.ACTIVATION_AUTHORIZATION_ABSENT, 254);
  assert.equal(blockerCounts.NOT_DEPLOYED, 254);
  assert.equal(blockerCounts.NOT_ACTIVE, 254);
  assert.equal(blockerCounts.MEMBERSHIP_NOT_OPERATIONAL, 226);
  assert.equal(summary.registrySha256, createHash('sha256').update(stableJson(registry)).digest('hex'));
  assert.equal(summary.deploymentAuthorizationReportSha256, createHash('sha256').update(stableJson(deployment)).digest('hex'));
  assert.equal(summary.activationAuthorizationReportSha256, createHash('sha256').update(stableJson(activation)).digest('hex'));
});

test('protected artifacts, runtime planner, and generated reports are unchanged by repeated read-only verification', () => {
  assert.deepEqual(artifacts.registry, registry);
  assert.deepEqual(artifacts.deploymentAuthorization, deployment);
  assert.deepEqual(artifacts.activationAuthorization, activation);
  assert.deepEqual(artifacts.gateReport, gates);
  assert.deepEqual(artifacts.summary, summary);
  assert.deepEqual(artifacts.blockers, blockers);
  const beforeGenerated = snapshot(generated);
  const beforeProtected = snapshot(protectedPaths);
  assert.deepEqual(verify(), summary);
  execFileSync('node', ['tools/lp152/build-deployment-readiness.mjs'], { stdio: 'pipe' });
  execFileSync('node', ['tools/lp152/build-deployment-readiness.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(generated), beforeGenerated);
  assert.deepEqual(snapshot(protectedPaths), beforeProtected);
});
