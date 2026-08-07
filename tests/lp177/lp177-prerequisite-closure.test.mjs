import assert from 'node:assert/strict';
import test from 'node:test';
import { build, protectedIdentities } from '../../tools/lp177/close-launch-prerequisites.mjs';

test('audits every named LP177 prerequisite without inferring live or external PASS', () => {
  const reports = build();
  const matrix = reports['prerequisite-matrix.json'];
  assert.equal(matrix.counts.evaluated, 13);
  assert.deepEqual(matrix.prerequisites.filter(item => item.status === 'COMPLETED').map(item => item.id), ['LP167-B009']);
  assert.equal(matrix.prerequisites.filter(item => item.category === 'EXTERNAL_OWNER_APPROVAL').length, 2);
  assert.equal(matrix.prerequisites.filter(item => item.category === 'PLATFORM_DEPENDENT').length, 10);
});

test('keeps every authorization fail-closed and records no execution', () => {
  const reassessment = build()['authorization-reassessment.json'];
  for (const decision of Object.values(reassessment.authorization)) {
    assert.equal(decision.status, 'NOT_AUTHORIZED');
    assert.equal(decision.authorizationGranted, false);
    assert.ok(decision.remainingPrerequisites.length > 0);
  }
  assert.deepEqual(Object.values(reassessment.operationsPerformed), [0, 0, 0, 0, 0]);
});

test('preserves canonical protected Git blobs', () => {
  assert.equal(protectedIdentities().classification, 'PASS');
});
