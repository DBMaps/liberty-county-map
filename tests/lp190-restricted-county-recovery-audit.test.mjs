import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { verifyLp190 } from '../tools/lp190-verify-restricted-county-recovery-audit.mjs';

test('LP190 audit is exact, fail-closed, and leaves the 243-county runtime untouched', () => {
  assert.deepEqual(verifyLp190(), { pass: true, auditedCountyCount: 11, operationalCountyCount: 243, restrictedCountyCount: 11, exactRecoveryClaims: 0, protectedProductionSurfaceChanges: 0 });
});

test('LP190 protected identity ignores owner checkout CRLF materialization', () => {
  const canonical = execFileSync('git', ['show', 'HEAD:js/app.js'], { maxBuffer: 1024 * 1024 * 1024 });
  const crlfMaterialization = Buffer.from(canonical.toString('utf8').replace(/\r?\n/g, '\r\n'));
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

  assert.equal(sha(canonical), '70f937f0f319efcf4445897cc3bfcbd8f728ec7f5efd361486ca71396e70517f');
  assert.equal(sha(crlfMaterialization), '3d2061b67d545ac2e49c12649632f498e5b9c9c76eff896b93dd7fabad4f940e');
  assert.notEqual(sha(crlfMaterialization), sha(canonical));
  assert.equal(verifyLp190().pass, true);
});
