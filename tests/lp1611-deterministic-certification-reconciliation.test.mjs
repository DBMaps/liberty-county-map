import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { buildReconciliationReport, verifyReconciliationReport } from '../tools/lp1611-deterministic-certification-reconciliation.mjs';

const reportPath = 'reports/lp1611/deterministic-certification-reconciliation.json';
const sha = (path) => existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : null;
const protectedPaths = [
  'data/lp160/destination-source-manifest.json',
  'reports/lp161/destination-integration-report.json',
  'data/lp1601/texas-destination-candidate-registry-manifest.json',
  'data/lp1601/texas-destination-candidate-registry.json'
];

test('LP161.1 reconciles LP161 and LP160 deterministic certification drift read-only', () => {
  const before = Object.fromEntries(protectedPaths.map((path) => [path, sha(path)]));
  const report = buildReconciliationReport();
  assert.equal(report.status, 'PASS');
  assert.equal(report.finalClassification, 'DETERMINISTIC_CERTIFICATION_RECONCILED');
  assert.equal(report.lp161.finalClassification, 'INTEGRATION_CERTIFIED');
  assert.equal(report.lp160.finalClassification, 'CONDITIONALLY_READY');
  assert.equal(report.lp1601m.status, 'PASS');
  assert.deepEqual(report.protectedArtifactsModified, []);
  assert.deepEqual(Object.fromEntries(protectedPaths.map((path) => [path, sha(path)])), before);
});

test('LP161.1 reconciliation report is deterministic', () => {
  const before = sha(reportPath);
  assert.deepEqual(verifyReconciliationReport(), buildReconciliationReport());
  execFileSync('node', ['tools/lp1611-deterministic-certification-reconciliation.mjs'], { stdio: 'pipe' });
  assert.equal(sha(reportPath), before);
});
