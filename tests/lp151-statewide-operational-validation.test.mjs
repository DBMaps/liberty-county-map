import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildValidation, canonicalJsonEqual, gitBlobBytes, protectedHashes, verify } from '../tools/lp151/validate-statewide-operations.mjs';

const validation = buildValidation();
const report = JSON.parse(readFileSync('reports/lp151/statewide-operational-validation-report.json', 'utf8'));
const registry = JSON.parse(readFileSync('data/lp151/statewide-operational-validation-registry.json', 'utf8'));
const summary = JSON.parse(readFileSync('reports/lp151/validation-summary.json', 'utf8'));
const hashReport = JSON.parse(readFileSync('reports/lp151/protected-artifact-hashes.json', 'utf8'));
function shaFile(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function shaGitBlob(path) { return createHash('sha256').update(gitBlobBytes(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map((path) => [path, shaFile(path)])); }
const lp151GeneratedPaths = ['data/lp151/statewide-operational-validation-registry.json', 'reports/lp151/statewide-operational-validation-report.json', 'reports/lp151/gate-results.json', 'reports/lp151/cross-layer-reconciliation.json', 'reports/lp151/protected-artifact-hashes.json', 'reports/lp151/validation-summary.json'];
const protectedUpstreamPaths = ['evidence/lp138/county-geometry-membership-contract.baseline.json', 'tools/lp140/activation-wave-planner.mjs', 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json', 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json', 'data/lp149/runtime-county-registry.json', 'data/lp150/membership-transition-registry.json', 'data/lp150/candidate-membership-contract.json'];

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

test('protected artifacts are derived from current authoritative inputs and reports agree', () => {
  const current = protectedHashes();
  assert.deepEqual(report.protectedArtifactHashes, current);
  assert.deepEqual(hashReport.hashes, current);
  assert.equal(current.hashingContract, 'committed Git blob SHA-256 (canonical repository bytes; not platform-converted working-tree bytes)');
  assert.equal(current.lp149Registry, shaGitBlob('data/lp149/runtime-county-registry.json'));
  assert.equal(current.lp150TransitionRegistry, shaGitBlob('data/lp150/membership-transition-registry.json'));
  assert.equal(current.lp150CandidateContract, shaGitBlob('data/lp150/candidate-membership-contract.json'));
  assert.deepEqual(Object.keys(current).sort(), Object.keys(hashReport.hashes).sort());

  assert.deepEqual(report.protectedArtifactHashes, protectedHashes());
  assert.equal(report.validationBoundary.modifiesRuntimeSelection, false);
  assert.equal(report.validationBoundary.modifiesPlanner, false);
});

test('tracked LP151 artifacts match deterministic rebuild', () => {
  assert.deepEqual(validation.stateRegistry, registry);
  assert.deepEqual(validation.report, report);
  assert.deepEqual(validation.summary, summary);
});

test('validation is read-only and repeated verification is byte-identical', () => {
  const beforeGenerated = snapshot(lp151GeneratedPaths);
  const beforeProtected = snapshot(protectedUpstreamPaths);
  assert.deepEqual(verify(), summary);
  execFileSync('node', ['tools/lp151/validate-statewide-operations.mjs'], { stdio: 'pipe' });
  execFileSync('node', ['tools/lp151/validate-statewide-operations.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(lp151GeneratedPaths), beforeGenerated);
  assert.deepEqual(snapshot(protectedUpstreamPaths), beforeProtected);
});

test('runtime behavior remains unchanged by LP151', () => {
  assert.equal(summary.runtimeMembershipChanged, false);
  assert.equal(summary.deploymentOccurred, false);
  assert.equal(summary.activationOccurred, false);
  assert.equal(report.validationBoundary.readOnly, true);
});

test('canonical JSON equality accepts equivalent LF and CRLF governed text', () => {
  const lf = JSON.stringify({ schemaVersion: 'fixture', nested: { ok: true } }, null, 2) + '\n';
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.equal(canonicalJsonEqual(crlf, lf), true);
});
