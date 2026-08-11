import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const report = JSON.parse(fs.readFileSync('reports/lp1882/census-place-source-lock.json', 'utf8'));

test('LP188.2 fails closed when the owner archive is not visible', () => {
  assert.equal(report.finalClassification, 'SOURCE_ACQUISITION_BLOCKED_OWNER_ACTION_REQUIRED');
  assert.equal(report.environmentObservation.exactFileExists, false);
  assert.equal(report.environmentObservation.blocker, 'OWNER_ARCHIVE_NOT_VISIBLE_IN_EXECUTION_ENVIRONMENT');
  assert.equal(report.provenance.sha256, null);
  assert.equal(report.downstream.lp1883Ready, false);
});

test('LP188.2 preserves every prohibited operational boundary', () => {
  assert.deepEqual(Object.values(report.safety), [false, false, false, false, false, false]);
  assert.equal(report.downstream.manufacturingStarted, false);
  assert.equal(report.downstream.expensiveAllCountyJobRun, false);
});
