import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { P, buildExecution, normalizeAuthorizationContract, stableJson, verify } from '../tools/lp153/execute-statewide-operations.mjs';

const artifacts = buildExecution();
const registry = JSON.parse(readFileSync(P.executionRegistry, 'utf8'));
const trace = JSON.parse(readFileSync(P.executionTrace, 'utf8'));
const deployment = JSON.parse(readFileSync(P.deploymentExecutionReport, 'utf8'));
const activation = JSON.parse(readFileSync(P.activationExecutionReport, 'utf8'));
const summary = JSON.parse(readFileSync(P.executionSummary, 'utf8'));
const generated = [P.executionRegistry, P.executionTrace, P.deploymentExecutionReport, P.activationExecutionReport, P.executionSummary];
const protectedPaths = [P.lp138Baseline, P.lp140Planner, P.lp148Package, P.lp148Manifest, P.lp149Registry, P.lp150Transition, P.lp151Registry, P.lp151Summary, P.lp152Registry, P.lp152DeploymentAuthorization, P.lp152ActivationAuthorization];
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map((path) => [path, sha(path)])); }

test('LP153 represents all identities and preserves runtime membership', () => {
  assert.equal(registry.identityCount, 254);
  assert.equal(registry.counties.length, 254);
  assert.equal(new Set(registry.counties.map((county) => county.fips)).size, 254);
  assert.deepEqual(registry.counties.map((county) => county.fips), [...registry.counties.map((county) => county.fips)].sort());
  assert.equal(registry.operationalCountyCount, 28);
  assert.equal(summary.operationalCountyCount, 28);
  assert.equal(summary.runtimeMembershipChanged, false);
});

test('LP153 execution architecture covers the complete governed pipeline', () => {
  assert.deepEqual(registry.executionArchitecture.map((stage) => stage.stage), ['Manufacturing', 'Certification', 'Storage', 'Geometry', 'Identity', 'Membership', 'Validation', 'Deployment Authorization', 'Deployment', 'Activation Authorization', 'Activation']);
  assert.equal(registry.failClosed, true);
  assert.equal(registry.performsDeployment, false);
  assert.equal(registry.performsActivation, false);
});

test('empty deployment and activation authorizations execute nothing', () => {
  assert.equal(deployment.contractRecognition, 'EMPTY_CONTRACT');
  assert.equal(activation.contractRecognition, 'EMPTY_CONTRACT');
  assert.equal(deployment.authorizedCount, 0);
  assert.equal(activation.authorizedCount, 0);
  assert.equal(deployment.deploymentCount, 0);
  assert.equal(activation.activationCount, 0);
  assert.equal(deployment.deploymentPerformed, false);
  assert.equal(activation.activationPerformed, false);
});

test('unauthorized and malformed contracts fail closed', () => {
  const known = new Set(registry.counties.map((county) => county.fips));
  assert.deepEqual(normalizeAuthorizationContract({ authorizations: [] }, 'deployment', known).authorizedFips, []);
  assert.equal(normalizeAuthorizationContract({ authorizations: 'bad' }, 'deployment', known).valid, false);
  const unauthorized = buildExecution({ deploymentContract: { authorizations: [{ fips: '48001', authorized: false }] }, activationContract: { authorizations: [{ fips: '48001', authorized: true }] } });
  assert.equal(unauthorized.deploymentReport.contractValid, false);
  assert.equal(unauthorized.activationReport.contractValid, false);
  assert.equal(unauthorized.deploymentReport.deploymentCount, 0);
  assert.equal(unauthorized.activationReport.activationCount, 0);
  const malformed = buildExecution({ deploymentContract: 42, activationContract: { authorizations: 'bad' } });
  assert.equal(malformed.deploymentReport.malformedContract, true);
  assert.equal(malformed.activationReport.malformedContract, true);
  assert.equal(malformed.summary.deploymentCount, 0);
  assert.equal(malformed.summary.activationCount, 0);
});

test('execution trace documents gates, decisions, status, and rejection reasons', () => {
  assert.equal(trace.zeroAuthorizedExecution, true);
  assert.equal(trace.evaluatedGates.length, 11);
  assert.equal(trace.counties.length, 254);
  assert.equal(trace.counties.every((county) => county.deploymentDecision === 'NO_DEPLOYMENT_UNAUTHORIZED'), true);
  assert.equal(trace.counties.every((county) => county.activationDecision === 'NO_ACTIVATION_UNAUTHORIZED'), true);
  assert.equal(trace.counties.every((county) => county.rejectionReasons.includes('DEPLOYMENT_AUTHORIZATION_ABSENT')), true);
  assert.equal(trace.counties.every((county) => county.rejectionReasons.includes('ACTIVATION_AUTHORIZATION_ABSENT')), true);
});

test('reports are internally consistent and deterministic', () => {
  assert.deepEqual(artifacts.registry, registry);
  assert.deepEqual(artifacts.trace, trace);
  assert.deepEqual(artifacts.deploymentReport, deployment);
  assert.deepEqual(artifacts.activationReport, activation);
  assert.deepEqual(artifacts.summary, summary);
  assert.equal(summary.executionRegistrySha256, createHash('sha256').update(stableJson(registry)).digest('hex'));
  assert.equal(summary.executionTraceSha256, createHash('sha256').update(stableJson(trace)).digest('hex'));
  assert.equal(summary.deploymentExecutionReportSha256, createHash('sha256').update(stableJson(deployment)).digest('hex'));
  assert.equal(summary.activationExecutionReportSha256, createHash('sha256').update(stableJson(activation)).digest('hex'));
});

test('verification is read-only and protected artifacts remain unchanged', () => {
  const beforeGenerated = snapshot(generated);
  const beforeProtected = snapshot(protectedPaths);
  assert.deepEqual(verify(), summary);
  execFileSync('node', ['tools/lp153/execute-statewide-operations.mjs'], { stdio: 'pipe' });
  execFileSync('node', ['tools/lp153/execute-statewide-operations.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(generated), beforeGenerated);
  assert.deepEqual(snapshot(protectedPaths), beforeProtected);
});
