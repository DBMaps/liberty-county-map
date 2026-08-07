import assert from 'node:assert/strict';
import test from 'node:test';
import { build, verify } from '../../tools/lp179/close-owner-live-validation.mjs';

test('LP179 closes only the four owner-live requirements and preserves their history', () => {
  const reports = build();
  const evidence = reports['owner-live-validation-evidence.json'];
  assert.equal(evidence.evidenceCapturedAtUtc, '2026-08-07T17:36:45.157Z');
  assert.deepEqual(evidence.requirements.map(item => item.id), ['LP167-B002', 'LP167-B003-Q', 'LP167-B003-A', 'LP167-B003-C']);
  assert.ok(evidence.requirements.every(item => item.finalStatus === 'PASS'));
  assert.ok(evidence.requirements.every(item => item.history.join('>') === 'OPEN>OWNER_LIVE_VALIDATED>PASS'));
  assert.equal(evidence.screenshotEvidence.classification, 'OWNER_CAPTURED / EXTERNAL_OWNER_EVIDENCE');
  assert.equal(evidence.screenshotEvidence.gitIdentityClaimed, false);
  assert.deepEqual(evidence.screenshotEvidence.repositoryPaths, []);
});

test('LP179 authorization reassessment remains fail-closed with no execution', () => {
  const reports = build(); const assessment = reports['launch-readiness-reassessment.json'];
  assert.equal(assessment.remainingBlockers.length, 8);
  assert.ok(Object.values(assessment.authorizations).every(status => status === 'NOT_AUTHORIZED'));
  assert.equal(assessment.authorizationGranted, false);
  assert.ok(Object.values(assessment.operationsPerformed).every(count => count === 0));
});

test('LP179 preserves protected identities and deterministic secret-safe output', () => {
  const summary = build()['lp179-summary.json'];
  assert.equal(summary.protectedIdentity, 'PASS');
  assert.equal(summary.runtimeFilesChanged, false);
  assert.equal(verify(), true);
});
