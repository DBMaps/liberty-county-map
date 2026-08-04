import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const audit = JSON.parse(await readFile(new URL('evidence/lp136/statewide-operational-readiness.json', root)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const lp130CommittedSha256 = '6223a7b592a006f59615353d553e1a3753e1fa61d6f2167debb5e88fa119fd83';
const lp130GitBlobId = '278a4b48d57168958ee7c222a5114c94453faeb6';

export function assertLockedArtifact(bytes, evidence) {
  assert.equal(digest(bytes), evidence.sha256, evidence.path);
}

test('LP136 preserves every locked authoritative and runtime artifact', async () => {
  for (const evidence of Object.values(audit.immutableEvidence)) {
    assertLockedArtifact(await readFile(new URL(evidence.path, root)), evidence);
  }
});

test('LP136 locks LP130 reconciliation to the committed Git blob identity', async () => {
  const evidence = audit.immutableEvidence.lp130;
  const committedBytes = execFileSync('git', ['cat-file', 'blob', lp130GitBlobId], {
    cwd: fileURLToPath(root),
    maxBuffer: 128 * 1024
  });
  const workingTreeBytes = await readFile(new URL(evidence.path, root));

  assert.equal(evidence.gitBlobId, lp130GitBlobId);
  assert.equal(evidence.sha256, lp130CommittedSha256);
  assertLockedArtifact(committedBytes, evidence);
  assert.deepEqual(workingTreeBytes, committedBytes);
});

test('LP136 artifact lock rejects a one-byte LP130 alteration', async () => {
  const evidence = audit.immutableEvidence.lp130;
  const alteredBytes = Buffer.from(await readFile(new URL(evidence.path, root)));
  alteredBytes[alteredBytes.length - 1] ^= 0x01;

  assert.throws(() => assertLockedArtifact(alteredBytes, evidence), /final-reconciliation\.json/);
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
