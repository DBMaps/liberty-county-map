import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { audit, classify, protectedArtifactIdentity, PROTECTED_PATHS, REPORT_NAMES, writeReports } from '../../tools/lp168/audit-production-readiness.mjs';
import { verify } from '../../tools/lp168/verify-lp168-determinism.mjs';
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('audit is repository-only and authorizes no production operation', () => {
  const readiness = audit()['production-readiness.json'];
  assert.deepEqual([readiness.productionWrites, readiness.deployments, readiness.activations, readiness.runtimeChanges, readiness.packageRegenerations, readiness.secretValuesRead], [0, 0, 0, 0, 0, 0]);
  assert.equal(readiness.auditBoundary, 'READ_ONLY_REPOSITORY_EVIDENCE');
});

test('protected artifacts and runtime behavior are unchanged by report generation', () => {
  const before = Object.fromEntries(PROTECTED_PATHS.map(file => [file, digest(file)]));
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lp168-readonly-'));
  try { writeReports(temporary); } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  assert.deepEqual(Object.fromEntries(PROTECTED_PATHS.map(file => [file, digest(file)])), before);
  assert.equal(audit()['production-readiness.json'].runtimeChanges, 0);
});

test('reports are deterministic and governed bytes verify', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lp168-determinism-'));
  try {
    writeReports(path.join(temporary, 'a')); writeReports(path.join(temporary, 'b'));
    for (const name of REPORT_NAMES) assert.deepEqual(fs.readFileSync(path.join(temporary, 'a', name)), fs.readFileSync(path.join(temporary, 'b', name)));
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
  assert.equal(verify(), true);
});

test('missing prerequisite classification is stable and fail-closed', () => {
  assert.equal(classify([{ status: 'MISSING', requiredForLaunch: true }]), 'NOT_READY');
  assert.equal(classify([{ status: 'PARTIAL', requiredForLaunch: false }]), 'CONDITIONALLY_READY');
  assert.equal(classify([{ status: 'PRESENT', requiredForLaunch: true }]), 'READY');
  assert.equal(audit()['production-readiness.json'].classification, 'NOT_READY');
});

test('canonical Git blobs govern identity despite CRLF working-tree materialization', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp168-crlf-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'lp168@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'LP168 Test'], { cwd: root });
    fs.writeFileSync(path.join(root, 'protected.txt'), 'alpha\nbeta\n');
    execFileSync('git', ['add', 'protected.txt'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'baseline'], { cwd: root });
    const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const governed = protectedArtifactIdentity(root, 'protected.txt', baseline);
    fs.writeFileSync(path.join(root, 'protected.txt'), 'alpha\r\nbeta\r\n');
    assert.deepEqual(protectedArtifactIdentity(root, 'protected.txt', baseline), governed);
    assert.equal(governed.authoritativeIdentitySource, 'GIT_BLOB');
    assert.equal(governed.status, 'UNCHANGED');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('a genuine canonical Git-blob change remains governed as CHANGED', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp168-change-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'lp168@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'LP168 Test'], { cwd: root });
    fs.writeFileSync(path.join(root, 'protected.txt'), 'baseline\n');
    execFileSync('git', ['add', 'protected.txt'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'baseline'], { cwd: root });
    const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    fs.writeFileSync(path.join(root, 'protected.txt'), 'changed\n');
    execFileSync('git', ['add', 'protected.txt'], { cwd: root });
    execFileSync('git', ['commit', '-qm', 'changed'], { cwd: root });
    const identity = protectedArtifactIdentity(root, 'protected.txt', baseline);
    assert.equal(identity.status, 'CHANGED');
    assert.notEqual(identity.baselineSha256, identity.currentSha256);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
