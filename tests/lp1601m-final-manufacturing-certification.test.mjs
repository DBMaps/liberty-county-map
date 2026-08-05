import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyLp1601mFinalManufacturingCertification } from '../tools/lp1601m-verify-final-manufacturing-certification.mjs';

test('LP160.1M final certification verifies completed manufacturing evidence', () => {
  const result = verifyLp1601mFinalManufacturingCertification();
  assert.equal(result.status, 'PASS');
  assert.equal(result.finalClassification, 'MANUFACTURING_COMPLETE');
  assert.equal(result.computedElapsedMs, 5645145);
  assert.equal(result.candidateManifestRows, 1339710);
  assert.equal(result.representedCountyCount, 254);
  assert.deepEqual(Object.values(result.checks), Object.values(result.checks).map(() => true));
});
