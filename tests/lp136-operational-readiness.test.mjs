import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const audit = JSON.parse(await readFile(new URL('evidence/lp136/statewide-operational-readiness.json', root)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertLockedArtifact(bytes, evidence) {
  assert.equal(digest(bytes), evidence.sha256, evidence.path);
}

test('LP136 preserves every locked authoritative and runtime artifact', async () => {
  for (const evidence of Object.values(audit.immutableEvidence)) {
    assertLockedArtifact(await readFile(new URL(evidence.path, root)), evidence);
  }
});

test('LP136 artifact lock rejects a genuinely altered artifact', () => {
  const evidence = audit.immutableEvidence.lp130;
  assert.throws(() => assertLockedArtifact(Buffer.from('genuinely altered'), evidence), /final-reconciliation\.json/);
});

test('LP136 reconciles manufacturing and certification arithmetic', () => {
  assert.equal(audit.baseline.manufacturedPackages, 254);
  assert.equal(audit.baseline.sidecars, 254);
  assert.equal(audit.baseline.packageIntegrityFailures, 0);
  assert.equal(audit.baseline.certified + audit.baseline.certificationBlocked, audit.baseline.certificationTotal);
  assert.equal(audit.baseline.certificationTotal, 254);
});

test('LP136 matrix is complete, deterministic, and non-authorizing', () => {
  assert.deepEqual(audit.readinessMatrix.map(row => row.area), [
    'Manufacturing', 'Certification', 'Runtime', 'Activation governance',
    'Activation prerequisites', 'Protected systems', 'Deployment'
  ]);
  for (const row of audit.readinessMatrix) {
    assert.ok(['READY', 'CONDITIONALLY_READY', 'BLOCKED'].includes(row.status));
    assert.ok(row.governingEvidence && row.readinessImpact && row.recommendedNextAction);
  }
  assert.equal(audit.overallClassification, 'CONDITIONALLY_READY');
  assert.equal(audit.governedActivationMayBegin, true);
  assert.equal(audit.activationAuthorized, false);
  assert.equal(audit.deploymentAuthorized, false);
  assert.ok(Object.values(audit.protectedSystemsModified).every(value => value === false));
});
