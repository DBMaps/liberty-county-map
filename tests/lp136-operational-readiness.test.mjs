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

export function normalizeWorkingTreeLineEndings(bytes) {
  return Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

export function assertWorkingTreeEquivalent(workingTreeBytes, committedBytes, path) {
  assert.deepEqual(normalizeWorkingTreeLineEndings(workingTreeBytes), committedBytes, path);
}

function readLp130CommittedBlob() {
  return execFileSync('git', ['cat-file', 'blob', lp130GitBlobId], {
    cwd: fileURLToPath(root),
    maxBuffer: 128 * 1024
  });
}

test('LP136 preserves every locked authoritative and runtime artifact', async () => {
  for (const [name, evidence] of Object.entries(audit.immutableEvidence)) {
    if (name === 'lp130') continue; // LP130 is locked to its Git blob below.
    assertLockedArtifact(await readFile(new URL(evidence.path, root)), evidence);
  }
});

test('LP136 locks LP130 reconciliation to the committed Git blob identity', async () => {
  const evidence = audit.immutableEvidence.lp130;
  const committedBytes = readLp130CommittedBlob();
  const workingTreeBytes = await readFile(new URL(evidence.path, root));

  assert.equal(evidence.gitBlobId, lp130GitBlobId);
  assert.equal(evidence.sha256, lp130CommittedSha256);
  assertLockedArtifact(committedBytes, evidence);
  assertWorkingTreeEquivalent(workingTreeBytes, committedBytes, evidence.path);
});

test('LP136 working-tree comparison accepts LF and CRLF but rejects changed content', () => {
  const committedBytes = Buffer.from('{\n  "locked": true\n}\n');

  assertWorkingTreeEquivalent(Buffer.from('{\n  "locked": true\n}\n'), committedBytes, 'LF');
  assertWorkingTreeEquivalent(Buffer.from('{\r\n  "locked": true\r\n}\r\n'), committedBytes, 'CRLF');
  assert.throws(
    () => assertWorkingTreeEquivalent(Buffer.from('{\n  "locked": false\n}\n'), committedBytes, 'changed'),
    /changed/
  );
});

test('LP136 artifact lock rejects a one-byte committed Git-blob alteration', () => {
  const evidence = audit.immutableEvidence.lp130;
  const alteredBytes = Buffer.from(readLp130CommittedBlob());
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
