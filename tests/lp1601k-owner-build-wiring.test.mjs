import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CONTROLLED_TEST_FIXTURE,
  P1601F,
  P1601J,
  P1601K,
  abs,
  executeOwnerLocalManufacturing,
  rejectLp1601jFalseResults,
  verifyLp1601k
} from '../tools/lp1601f-streaming-manufacture.mjs';

test('LP160.1K controlled owner wiring reaches LP160.1J and routes final schema', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lp1601k-'));
  const final = await executeOwnerLocalManufacturing({
    controlledTestFixture: true,
    source: CONTROLLED_TEST_FIXTURE,
    release: '2026-07-22.0',
    expectedSha256: '47065C7511F744B3856142B3D03D285674837E68C9FDE914A96539198A1C49E9',
    stagingDirectory: join(root, 'staging'),
    manufacturingDirectory: join(root, 'manufactured'),
    write: true
  });
  assert.equal(final.schemaVersion, 'gridly.lp1601j.finalJsonlCountyManufacturingAssessment.v1');
  assert.equal(final.stagedRows, 5);
  assert.equal(final.texasConfirmedRows, 3);
  assert.equal(final.retainedDestinations, 2);
  assert.equal(final.outsideTexasRows, 1);
  assert.equal(final.invalidCoordinateRows, 1);
  assert.equal(final.duplicatesRemoved, 1);

  const invocation = JSON.parse(await readFile(abs(P1601K.invocation), 'utf8'));
  assert.equal(invocation.lp1601jStarted, true);
  assert.equal(invocation.lp1601jCompleted, true);

  const candidateManifest = JSON.parse(await readFile(abs(P1601F.candidateManifest), 'utf8'));
  assert.equal(candidateManifest.counties.length, 254);
  assert.equal(candidateManifest.counties.reduce((sum, c) => sum + c.recordCount, 0), final.retainedDestinations);
  const nonzero = candidateManifest.counties.filter((c) => c.recordCount > 0);
  assert.ok(nonzero.length >= 2);
  for (const county of nonzero) {
    assert.ok(county.candidateFilePathIdentity);
    assert.ok((await stat(county.candidateFilePathIdentity)).size > 0);
  }

  const exclusions = JSON.parse(await readFile(abs(P1601J.exclusionManifest), 'utf8'));
  assert.equal(exclusions.reasonTotals.OUTSIDE_TEXAS, 1);
  assert.equal(exclusions.reasonTotals.INVALID_COORDINATES, 1);
  assert.equal(exclusions.reasonTotals.EXACT_DUPLICATE, 1);

  const verification = await verifyLp1601k();
  assert.equal(verification.status, 'PASS');
  assert.equal(verification.writesPerformed, false);
});

test('LP160.1K rejects placeholder all-staged exclusions without reasons', () => {
  assert.equal(
    rejectLp1601jFalseResults({ stagedRows: 5, governedExclusions: 5, exclusionReasonRows: 0, texasMembershipExecuted: true }),
    'MANUFACTURING_FAILED:PLACEHOLDER_EXCLUSION_ASSIGNMENT'
  );
});
