import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { build, ROOT, verify, write } from '../../tools/lp176/reassess-launch-authorization.mjs';

test('reassesses each LP167 blocker separately and grants no unsupported authorization', () => {
  const report = build()['authorization-decision-report.json'];
  assert.equal(report.prerequisiteEvaluations.length, 13);
  assert.equal(report.prerequisiteEvaluations.filter(item => item.classification === 'SATISFIED').length, 3);
  assert.equal(report.prerequisiteEvaluations.filter(item => item.classification === 'SATISFIED_ACCEPTED_LIMITATION').length, 1);
  for (const decision of Object.values(report.decisions)) { assert.equal(decision.status, 'NOT_AUTHORIZED'); assert.equal(decision.authorizationGranted, false); }
  assert.deepEqual(Object.values(report.operationsPerformed), [0, 0, 0, 0, 0, 0, 0]);
  assert.equal(report.protectedIdentityResult, 'PASS');
});

test('fails closed if readiness is asserted without the exact governed baseline', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp176-missing-'));
  try {
    fs.cpSync(ROOT, temp, { recursive: true, filter: source => !source.includes(`${path.sep}.git`) && !source.includes(`${path.sep}node_modules`) && !source.includes(`${path.sep}android${path.sep}build`) && !source.includes(`${path.sep}android${path.sep}.gradle`) });
    const summaryPath = path.join(temp, 'reports/lp173/lp173-summary.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    summary.evidenceClassification = 'EVIDENCE_INCOMPLETE';
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
    assert.throws(() => build(temp), /fails closed/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('generation is deterministic, canonical, and repository reports verify', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp176-format-'));
  try { const reports = write(temp); for (const name of Object.keys(reports)) { const bytes = fs.readFileSync(path.join(temp, name)); assert.equal(bytes.includes(13), false); assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]); } } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  assert.equal(verify(), true);
});
