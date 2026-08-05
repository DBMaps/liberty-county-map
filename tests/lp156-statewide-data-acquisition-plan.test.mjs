import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DOMAINS, P, buildArtifacts, stableJson, verify } from '../tools/lp156/build-statewide-data-acquisition-plan.mjs';

const artifacts = buildArtifacts();
const coverage = JSON.parse(readFileSync(P.coverageMatrix, 'utf8'));
const register = JSON.parse(readFileSync(P.acquisitionRegister, 'utf8'));
const dependencies = JSON.parse(readFileSync(P.launchDependencyMatrix, 'utf8'));
const finalAssessment = JSON.parse(readFileSync(P.finalAssessment, 'utf8'));
const summary = JSON.parse(readFileSync(P.summary, 'utf8'));
const generated = [P.plan, P.addressAssessment, P.businessAssessment, P.communityAssessment, P.crossingAssessment, P.hazardAssessment, P.routeAssessment, P.notificationAssessment, P.searchAssessment, P.coverageMatrix, P.acquisitionRegister, P.launchDependencyMatrix, P.finalAssessment, P.summary];
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map(path => [path, sha(path)])); }

test('LP156 covers every required statewide data domain exactly once', () => {
  assert.equal(coverage.milestone, 'LP156');
  assert.equal(coverage.rows.length, DOMAINS.length);
  assert.deepEqual(coverage.rows.map(row => row.domain).sort(), DOMAINS.map(([key]) => key).sort());
  assert.equal(new Set(coverage.rows.map(row => row.domain)).size, DOMAINS.length);
});

test('LP156 records only governed quality classifications and launch dependency classes', () => {
  const allowedQuality = new Set(['Ready', 'Ready with Monitoring', 'Requires Enrichment', 'Requires Acquisition', 'Not Required']);
  const allowedDependency = new Set(['Critical Before Launch', 'Recommended Before Launch', 'Post-Launch Enhancement', 'Future Roadmap']);
  for (const row of coverage.rows) {
    assert.ok(allowedQuality.has(row.dataQualityClassification), row.domain);
    assert.ok(allowedDependency.has(row.launchDependency), row.domain);
  }
  for (const row of dependencies.rows) assert.ok(allowedDependency.has(row.classification), row.dataset);
});

test('LP156 acquisition register is deterministic, non-duplicative, and launch-prioritized', () => {
  assert.equal(register.rows.length, new Set(register.rows.map(row => row.dataset)).size);
  assert.ok(register.rows.some(row => row.requiredBeforeLaunch === 'YES'));
  assert.ok(register.rows.some(row => row.requiredBeforeLaunch === 'NO'));
  for (const row of register.rows) {
    assert.ok(row.dataset);
    assert.ok(row.authoritativeSource);
    assert.ok(row.license);
    assert.ok(row.refreshStrategy);
    assert.match(row.priority, /^P[0-9]$/);
  }
});

test('LP156 final assessment answers the statewide data-readiness question without authorizing runtime changes', () => {
  assert.equal(finalAssessment.recommendation, 'NO_GO_FOR_UNCONDITIONAL_STATEWIDE_DATA_READINESS');
  assert.ok(finalAssessment.answer.includes('Gridly must possess certified address coverage'));
  assert.equal(summary.performsRuntimeChange, false);
  assert.equal(summary.performsDeploymentChange, false);
  assert.equal(summary.performsActivationChange, false);
  assert.equal(summary.rebuildsCertifiedPackages, false);
});

test('LP156 artifacts are internally consistent and verification is read-only', () => {
  assert.deepEqual(artifacts.coverageMatrix, coverage);
  assert.deepEqual(artifacts.acquisitionRegister, register);
  assert.deepEqual(artifacts.launchDependencyMatrix, dependencies);
  assert.deepEqual(artifacts.finalAssessment, finalAssessment);
  assert.equal(summary.coverageMatrixSha256, createHash('sha256').update(stableJson(coverage)).digest('hex'));
  assert.deepEqual(verify(), summary);
  const before = snapshot(generated);
  execFileSync('node', ['tools/lp156/build-statewide-data-acquisition-plan.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(generated), before);
});
