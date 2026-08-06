import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { audit, classify, PROTECTED_PATHS, REPORT_NAMES, writeReports } from '../../tools/lp168/audit-production-readiness.mjs';
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
