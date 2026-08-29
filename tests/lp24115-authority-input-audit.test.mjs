import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAudit, verifyAudit } from '../tools/lp24115/authority-input-audit.mjs';

test('LP241.15 fails closed when the frozen row-bearing authority is absent', () => {
  const audit = buildAudit();
  assert.equal(audit.blockedState, 'RUNTIME_SHARD_MATERIALIZATION_BLOCKED_FROZEN_AUTHORITY_NOT_AVAILABLE');
  assert.equal(audit.reconstructionAssessment.exactFrozenAuthorityAvailable, false);
  assert.equal(audit.reconstructionAssessment.allGovernedRuntimePoisAvailable, false);
  assert.equal(audit.materialization.executed, false);
  assert.equal(audit.readyForLp24114Rehearsal, false);
  assert.deepEqual(audit.exactFrozenAuthorityArtifacts.map(({ available }) => available), [false]);
  assert.deepEqual(audit.otherOwnerLocalIntermediateArtifacts.map(({ available }) => available), [false, false]);
});

test('LP241.15 preserves the production boundary and historical LP241.14 result', () => {
  const audit = buildAudit();
  assert.equal(audit.historicalLp24114EvidencePreserved, true);
  assert.equal(audit.productionSafety.providerGate, 'OFF');
  assert.equal(audit.productionSafety.productionProviderEligible, false);
  assert.equal(audit.productionSafety.productionBehaviorChanged, false);
  verifyAudit();
});
