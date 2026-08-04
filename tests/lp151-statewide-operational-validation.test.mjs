import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildValidation, protectedHashes, verify } from '../tools/lp151/validate-statewide-operations.mjs';

const validation = buildValidation();
const report = JSON.parse(readFileSync('reports/lp151/statewide-operational-validation-report.json', 'utf8'));
const registry = JSON.parse(readFileSync('data/lp151/statewide-operational-validation-registry.json', 'utf8'));
const summary = JSON.parse(readFileSync('reports/lp151/validation-summary.json', 'utf8'));

test('validates all 254 runtime identities exactly once in deterministic FIPS order', () => {
  assert.equal(registry.countyCount, 254);
  assert.equal(new Set(registry.counties.map((c) => c.fips)).size, 254);
  assert.deepEqual(registry.counties.map((c) => c.fips), [...registry.counties.map((c) => c.fips)].sort());
  assert.equal(report.crossLayerReconciliation.identity.oneCountyPerIdentity, true);
});

test('membership remains exactly the LP138/LP150 protected runtime boundary', () => {
  assert.equal(summary.operationalCountyCount, 28);
  assert.equal(summary.candidateCountyCount, 0);
  assert.equal(summary.deploymentCount, 0);
  assert.equal(summary.activationCount, 0);
  assert.equal(report.crossLayerReconciliation.membership.approvedCountyCount, 0);
});

test('manufacturing, certification, storage, geometry, identity, membership, and planner reconcile', () => {
  for (const name of ['Manufacturing', 'Certification', 'Storage', 'Geometry', 'Identity', 'Membership', 'Planner']) {
    assert.equal(report.gates.find((gate) => gate.name === name).passed, true, name);
  }
});

test('candidate contract is empty and no deployment or activation is inferred', () => {
  assert.equal(registry.counties.every((c) => c.candidate === false && c.approved === false), true);
  assert.equal(registry.counties.every((c) => c.deployedTransition === false && c.activeTransition === false), true);
  assert.equal(report.gates.find((gate) => gate.name === 'Deployment').passed, true);
  assert.equal(report.gates.find((gate) => gate.name === 'Activation').passed, true);
});

test('protected artifacts are unchanged during validation', () => {
  assert.deepEqual(report.protectedArtifactHashes, protectedHashes());
  assert.equal(report.validationBoundary.modifiesRuntimeSelection, false);
  assert.equal(report.validationBoundary.modifiesPlanner, false);
});

test('validation is deterministic and repeated verification is byte-identical', () => {
  assert.deepEqual(validation.summary, summary);
  assert.deepEqual(verify(), summary);
  execFileSync('node', ['tools/lp151/validate-statewide-operations.mjs'], { stdio: 'pipe' });
});

test('runtime behavior remains unchanged by LP151', () => {
  assert.equal(summary.runtimeMembershipChanged, false);
  assert.equal(summary.deploymentOccurred, false);
  assert.equal(summary.activationOccurred, false);
  assert.equal(report.validationBoundary.readOnly, true);
});
