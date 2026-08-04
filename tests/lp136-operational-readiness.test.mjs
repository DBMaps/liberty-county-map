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
const governedTextExtensions = new Set(['.md', '.json', '.geojson', '.csv', '.js', '.mjs', '.html', '.css', '.txt']);

export function assertLockedArtifact(bytes, evidence) {
  assert.equal(digest(bytes), evidence.sha256, evidence.path);
}

export function normalizeWorkingTreeLineEndings(bytes) {
  return Buffer.from(bytes.toString('utf8').replace(/\r\n?/g, '\n'), 'utf8');
}

export function isGovernedTextArtifact(path) {
  const basename = path.toLowerCase();
  return [...governedTextExtensions].some(extension => basename.endsWith(extension));
}

export function assertWorkingTreeEquivalent(workingTreeBytes, committedBytes, path) {
  const comparableWorkingTreeBytes = isGovernedTextArtifact(path)
    ? normalizeWorkingTreeLineEndings(workingTreeBytes)
    : workingTreeBytes;
  assert.deepEqual(comparableWorkingTreeBytes, committedBytes, path);
}

function readCommittedBlob(path) {
  return execFileSync('git', ['show', `HEAD:${path}`], {
    cwd: fileURLToPath(root),
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024
  });
}

test('LP136 preserves every locked authoritative and runtime artifact', async () => {
  for (const evidence of Object.values(audit.immutableEvidence)) {
    const committedBytes = readCommittedBlob(evidence.path);
    const workingTreeBytes = await readFile(new URL(evidence.path, root));

    assertLockedArtifact(committedBytes, evidence);
    assertWorkingTreeEquivalent(workingTreeBytes, committedBytes, evidence.path);
  }
});

test('LP136 locks LP130 reconciliation to the committed Git blob identity', async () => {
  const evidence = audit.immutableEvidence.lp130;
  const committedBlobId = execFileSync('git', ['rev-parse', `HEAD:${evidence.path}`], {
    cwd: fileURLToPath(root), encoding: 'utf8'
  }).trim();
  const committedBytes = readCommittedBlob(evidence.path);
  const workingTreeBytes = await readFile(new URL(evidence.path, root));

  assert.equal(evidence.gitBlobId, lp130GitBlobId);
  assert.equal(committedBlobId, lp130GitBlobId);
  assert.equal(evidence.sha256, lp130CommittedSha256);
  assertLockedArtifact(committedBytes, evidence);
  assertWorkingTreeEquivalent(workingTreeBytes, committedBytes, evidence.path);
});

test('LP136 governed-text comparison accepts LF, CRLF, and lone CR but rejects changed content', () => {
  const committedBytes = Buffer.from('{\n  "locked": true\n}\n');

  assertWorkingTreeEquivalent(Buffer.from('{\n  "locked": true\n}\n'), committedBytes, 'fixture.json');
  assertWorkingTreeEquivalent(Buffer.from('{\r\n  "locked": true\r\n}\r\n'), committedBytes, 'fixture.json');
  assertWorkingTreeEquivalent(Buffer.from('{\r  "locked": true\r}\r'), committedBytes, 'fixture.json');
  assert.throws(
    () => assertWorkingTreeEquivalent(Buffer.from('{\n  "locked": false\n}\n'), committedBytes, 'changed.json'),
    /changed\.json/
  );
});

test('LP136 working-tree comparison requires exact bytes for binary artifacts', () => {
  const committedBytes = Buffer.from([0x1f, 0x8b, 0x0d, 0x0a, 0xff]);

  assertWorkingTreeEquivalent(Buffer.from(committedBytes), committedBytes, 'fixture.json.gz');
  assert.throws(
    () => assertWorkingTreeEquivalent(Buffer.from([0x1f, 0x8b, 0x0a, 0xff]), committedBytes, 'fixture.json.gz'),
    /fixture\.json\.gz/
  );
});

test('LP136 classifies every locked artifact without file-specific exceptions', () => {
  for (const evidence of Object.values(audit.immutableEvidence)) {
    assert.equal(isGovernedTextArtifact(evidence.path), true, evidence.path);
  }
  assert.equal(isGovernedTextArtifact('county.geojson'), true);
  assert.equal(isGovernedTextArtifact('package.json.gz'), false);
  assert.equal(isGovernedTextArtifact('county.png'), false);
});

test('LP136 artifact lock rejects a one-byte committed Git-blob alteration', () => {
  const evidence = audit.immutableEvidence.lp130;
  const alteredBytes = Buffer.from(readCommittedBlob(evidence.path));
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
