import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLp190 } from '../tools/lp190-verify-restricted-county-recovery-audit.mjs';

test('LP190 audit is exact, fail-closed, and leaves the 243-county runtime untouched', () => {
  assert.deepEqual(verifyLp190(), { pass: true, auditedCountyCount: 11, operationalCountyCount: 243, restrictedCountyCount: 11, exactRecoveryClaims: 0, protectedProductionSurfaceChanges: 0 });
});
