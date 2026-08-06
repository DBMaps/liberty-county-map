import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { REPORT_NAMES, build, verify } from '../../tools/lp174/reassess-operational-readiness.mjs';

test('LP174 readiness follows governed blockers and remains non-authorizing', () => {
  const reports = build();
  const summary = reports['operational-evidence-summary.json'];
  const reassessment = reports['authorization-reassessment-report.json'];
  assert.equal(summary.blockerCounts.total, summary.blockers.length);
  assert.equal(summary.blockerCounts.total, summary.blockerCounts.ownerActionRequired + summary.blockerCounts.sourceUnavailable);
  assert.equal(summary.blockerCounts.ownerActionRequired, 0);
  assert.equal(summary.ownerAttestedFacts.length, 14);
  assert.equal(summary.classification, summary.blockers.length === 0 ? 'EVIDENCE_COMPLETE' : 'EVIDENCE_INCOMPLETE');
  assert.equal(reassessment.authorizationReassessment, summary.blockers.length === 0 ? 'READY_FOR_AUTHORIZATION_REASSESSMENT' : 'NOT_READY_FOR_AUTHORIZATION_REASSESSMENT');
  assert.equal(reassessment.authorizationGranted, false);
  assert.ok(Object.values(reassessment.authorizations).every(value => value === 'NOT_AUTHORIZED'));
});

test('LP174 fails closed when a genuinely required fact is absent', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp174-missing-'));
  try {
    fs.mkdirSync(path.join(root, 'reports/lp173'), { recursive: true });
    fs.mkdirSync(path.join(root, 'reports/lp1731'), { recursive: true });
    const lp173 = JSON.parse(fs.readFileSync('reports/lp173/lp173-summary.json', 'utf8'));
    lp173.evidenceClassification = 'EVIDENCE_INCOMPLETE';
    lp173.sourceUnavailableFacts = ['backup.backupProvider'];
    fs.writeFileSync(path.join(root, 'reports/lp173/lp173-summary.json'), `${JSON.stringify(lp173)}\n`);
    fs.copyFileSync('reports/lp1731/auto-discovery-summary.json', path.join(root, 'reports/lp1731/auto-discovery-summary.json'));
    const reports = build(root);
    assert.deepEqual(reports['operational-evidence-summary.json'].blockers, [{ classification: 'SOURCE_UNAVAILABLE', fact: 'backup.backupProvider' }]);
    assert.equal(reports['authorization-reassessment-report.json'].authorizationReassessment, 'NOT_READY_FOR_AUTHORIZATION_REASSESSMENT');
    assert.equal(reports['authorization-reassessment-report.json'].authorizationGranted, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('LP174 reports are canonical, metadata-only, and deterministic', () => {
  assert.equal(verify(), true);
  const reports = build();
  assert.equal(reports['operational-evidence-summary.json'].metadataOnly, true);
  assert.equal(reports['deterministic-validation-report.json'].classification, 'PASS');
  for (const name of REPORT_NAMES) {
    const bytes = fs.readFileSync(path.join('reports/lp174', name));
    assert.notEqual(bytes[0], 0xef);
    assert.equal(bytes.includes(13), false);
  }
});
