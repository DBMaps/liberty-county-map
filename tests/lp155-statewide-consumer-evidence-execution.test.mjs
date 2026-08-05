import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { FEATURES, P, buildArtifacts, stableJson, verify } from '../tools/lp155/execute-consumer-evidence.mjs';

const artifacts = buildArtifacts();
const gapMatrix = JSON.parse(readFileSync(P.gapMatrix, 'utf8'));
const readiness = JSON.parse(readFileSync(P.readinessMatrix, 'utf8'));
const blockers = JSON.parse(readFileSync(P.blockerRegister, 'utf8'));
const assessment = JSON.parse(readFileSync(P.finalAssessment, 'utf8'));
const summary = JSON.parse(readFileSync(P.summary, 'utf8'));
const generated = [P.executionPlan, P.addressReport, P.businessReport, P.routingReport, P.routeWatchReport, P.notificationReport, P.crossingReport, P.hazardReport, P.communityReport, P.gapMatrix, P.readinessMatrix, P.blockerRegister, P.correctiveActionRegister, P.finalAssessment, P.summary];
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map(path => [path, sha(path)])); }

test('LP155 emits one deterministic PASS/FAIL/NOT TESTED launch gap row for every Texas county', () => {
  assert.equal(gapMatrix.milestone, 'LP155');
  assert.equal(gapMatrix.counties.length, 254);
  assert.deepEqual(gapMatrix.values, ['PASS', 'FAIL', 'NOT TESTED']);
  const featureKeys = FEATURES.map(([key]) => key);
  for (const row of gapMatrix.counties) for (const key of featureKeys) assert.ok(gapMatrix.values.includes(row[key]));
});

test('LP155 does not infer statewide PASS results from the Liberty benchmark', () => {
  const liberty = gapMatrix.counties.find(row => row.countyName === 'Liberty County');
  assert.ok(liberty);
  for (const [key] of FEATURES) assert.equal(liberty[key], 'PASS');
  const nonLibertyRows = gapMatrix.counties.filter(row => row.countyName !== 'Liberty County');
  assert.equal(nonLibertyRows.length, 253);
  assert.equal(nonLibertyRows.every(row => FEATURES.every(([key]) => row[key] === 'NOT TESTED')), true);
  assert.equal(nonLibertyRows.every(row => row.launchReady === 'NO'), true);
});

test('LP155 creates county readiness classifications, launch blockers, and corrective actions', () => {
  assert.equal(readiness.counties.length, 254);
  assert.equal(readiness.counties.find(row => row.countyName === 'Liberty County').classification, 'Launch Ready');
  assert.equal(readiness.counties.filter(row => row.classification === 'Not Ready').length, 253);
  assert.equal(blockers.blockers.length, FEATURES.length);
  assert.equal(blockers.blockers.every(blocker => blocker.affectedCounties.length === 253), true);
  assert.equal(assessment.recommendation, 'NO_GO');
  assert.equal(assessment.launchReadyCountyCount, 1);
  assert.equal(assessment.notReadyCountyCount, 253);
});

test('LP155 artifacts are internally consistent and deterministic', () => {
  assert.deepEqual(artifacts.gapMatrix, gapMatrix);
  assert.deepEqual(artifacts.readinessMatrix, readiness);
  assert.deepEqual(artifacts.blockerRegister, blockers);
  assert.deepEqual(artifacts.finalAssessment, assessment);
  assert.equal(summary.gapMatrixSha256, createHash('sha256').update(stableJson(gapMatrix)).digest('hex'));
  assert.deepEqual(verify(), summary);
});

test('LP155 verification is read-only', () => {
  const before = snapshot(generated);
  execFileSync('node', ['tools/lp155/execute-consumer-evidence.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(generated), before);
});
