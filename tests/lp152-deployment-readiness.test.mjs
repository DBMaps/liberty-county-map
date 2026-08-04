import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildArtifacts, verify, stableJson, P } from '../tools/lp152/build-deployment-readiness.mjs';

const artifacts = buildArtifacts();
const registry = JSON.parse(readFileSync(P.registry, 'utf8'));
const gates = JSON.parse(readFileSync(P.gates, 'utf8'));
const summary = JSON.parse(readFileSync(P.summary, 'utf8'));
const blockers = JSON.parse(readFileSync(P.blockers, 'utf8'));
const generated = [P.registry, P.gates, P.summary, P.blockers];
const protectedPaths = ['assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json','assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json','data/lp149/runtime-county-registry.json','data/lp150/membership-transition-registry.json','data/lp151/statewide-operational-validation-registry.json','reports/lp151/validation-summary.json'];
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map((path) => [path, sha(path)])); }

test('LP152 represents all 254 Texas runtime identities in deterministic order', () => {
  assert.equal(registry.identityCount, 254);
  assert.equal(registry.counties.length, 254);
  assert.equal(new Set(registry.counties.map((county) => county.fips)).size, 254);
  assert.deepEqual(registry.counties.map((county) => county.fips), [...registry.counties.map((county) => county.fips)].sort());
});

test('LP152 preserves runtime membership, deployment, activation, and runtime selection boundaries', () => {
  assert.equal(registry.operationalCountyCount, 28);
  assert.equal(summary.operationalCountyCount, 28);
  assert.equal(summary.deploymentCount, 0);
  assert.equal(summary.activationCount, 0);
  assert.equal(summary.runtimeMembershipChanged, false);
  assert.equal(summary.deploymentOccurred, false);
  assert.equal(summary.activationOccurred, false);
  assert.equal(registry.deploymentDependencies.boundaries.modifiesRuntimeSelection, false);
});

test('deployment readiness and gates are deterministic and non-authorizing', () => {
  assert.equal(summary.passed, true);
  assert.equal(gates.authorization.deploymentAuthorizationPresent, false);
  assert.equal(gates.authorization.gatePassDoesNotDeploy, true);
  assert.deepEqual(gates.gates.map((gate) => gate.name), ['Manufacturing','Certification','Storage','Geometry','Identity','Membership','Operational validation','Deployment readiness']);
  assert.equal(gates.gates.every((gate) => gate.passed), true);
  assert.equal(summary.registrySha256, createHash('sha256').update(stableJson(registry)).digest('hex'));
});

test('deployment reports are internally consistent', () => {
  const blockerCounts = Object.fromEntries(blockers.blockerInventory.map((row) => [row.blocker, row.count]));
  assert.deepEqual(summary.remainingDeploymentBlockers, blockers.blockerInventory.map((row) => ({ blocker: row.blocker, count: row.count })));
  assert.equal(blockerCounts.DEPLOYMENT_AUTHORIZATION_ABSENT, 254);
  assert.equal(blockerCounts.ACTIVATION_AUTHORIZATION_ABSENT, 254);
  assert.equal(blockerCounts.MEMBERSHIP_NOT_OPERATIONAL, 226);
  assert.equal(registry.blockedCount + registry.readyPendingAuthorizationCount, 254);
});

test('protected artifacts are unchanged and verification is byte-identical/read-only', () => {
  assert.deepEqual(artifacts.registry, registry);
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

