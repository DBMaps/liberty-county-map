import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AREAS, P, buildArtifacts, stableJson, verify } from '../tools/lp154/certify-consumer-experience.mjs';

const artifacts = buildArtifacts();
const checklist = JSON.parse(readFileSync(P.consumerChecklist, 'utf8'));
const matrix = JSON.parse(readFileSync(P.certificationMatrix, 'utf8'));
const readiness = JSON.parse(readFileSync(P.launchReadiness, 'utf8'));
const summary = JSON.parse(readFileSync(P.summary, 'utf8'));
const generated = [P.consumerChecklist, P.certificationMatrix, P.addressReport, P.businessReport, P.routingReport, P.routeWatchReport, P.notificationReport, P.crossingReport, P.hazardReport, P.communityReport, P.searchIntelligenceReport, P.launchReadiness, P.summary];
function sha(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map((path) => [path, sha(path)])); }

test('LP154 defines the statewide consumer experience certification checklist', () => {
  assert.equal(checklist.milestone, 'LP154');
  assert.equal(checklist.benchmarkCounty, 'Liberty');
  assert.deepEqual(checklist.certificationAreas.map((area) => area.id), AREAS.map((area) => area[1]));
  assert.equal(checklist.constraints.includes('no operational runtime expansion'), true);
  assert.equal(checklist.philosophy.includes('Audit First'), true);
});

test('LP154 evaluates every Texas identity and launch-ready candidate against Liberty County', () => {
  assert.equal(matrix.evaluatedCountyCount, 254);
  assert.equal(matrix.counties.length, 254);
  assert.equal(matrix.launchReadyCandidateCount, 28);
  assert.equal(matrix.counties.filter((county) => county.libertyBenchmark).length, 1);
  assert.equal(matrix.counties.find((county) => county.libertyBenchmark).goNoGo, 'GO_BENCHMARK');
  assert.equal(matrix.counties.filter((county) => county.launchReadyCandidate && !county.libertyBenchmark && county.goNoGo === 'NO_GO_PENDING_CERTIFICATION').length, 27);
});

test('LP154 emits all required certification reports and final recommendation', () => {
  for (const [key] of AREAS) assert.equal(artifacts.reports[key].certificationStatus, 'NO_GO_PENDING_COUNTY_EVIDENCE');
  assert.equal(readiness.recommendation, 'NO_GO');
  assert.equal(readiness.launchBlockers.length, 27);
  assert.equal(summary.performsDeployment, false);
  assert.equal(summary.performsActivation, false);
  assert.equal(summary.expandsOperationalRuntime, false);
  assert.equal(summary.modifiesProtectedSystems, false);
});

test('LP154 artifacts are internally consistent and deterministic', () => {
  assert.deepEqual(artifacts.checklist, checklist);
  assert.deepEqual(artifacts.matrix, matrix);
  assert.deepEqual(artifacts.launchReadiness, readiness);
  assert.deepEqual(artifacts.summary, summary);
  assert.equal(summary.consumerChecklistSha256, createHash('sha256').update(stableJson(checklist)).digest('hex'));
  assert.equal(summary.certificationMatrixSha256, createHash('sha256').update(stableJson(matrix)).digest('hex'));
  assert.equal(summary.launchReadinessSha256, createHash('sha256').update(stableJson(readiness)).digest('hex'));
});

test('LP154 verification is read-only', () => {
  const before = snapshot(generated);
  assert.deepEqual(verify(), summary);
  execFileSync('node', ['tools/lp154/certify-consumer-experience.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(generated), before);
});
