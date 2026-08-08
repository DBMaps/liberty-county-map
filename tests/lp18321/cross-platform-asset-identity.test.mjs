import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { ASSETS, build } from '../../tools/lp18321/reconcile-cross-platform-identity.mjs';
import { crlfMaterialization, sourceIdentity, workingIdentity, workingTreeDiagnostic } from '../../tools/lp18321/git-asset-identity.mjs';

test('observed Windows size drift is exactly LF-to-CRLF materialization', () => {
  const report = build();
  assert.deepEqual(report.assets.map(x => x.canonicalGitBlob.bytes), [67186117, 35232470, 57731771]);
  assert.deepEqual(report.assets.slice(0, 2).map(x => x.simulatedWindowsCrlfMaterialization.bytes), [68200491, 35312857]);
  assert.ok(report.assets.slice(0, 2).every(x => x.crlfDifferenceSolelyLineEndings));
  assert.equal(report.assets[2].byteExact, true);
});

test('attributes pin governed text to LF and gzip to binary', () => {
  const attrs = build().assets.map(x => x.attributes);
  assert.deepEqual(attrs.slice(0, 2), [{ text: 'set', eol: 'lf', binary: 'unspecified' }, { text: 'set', eol: 'lf', binary: 'unspecified' }]);
  assert.deepEqual(attrs[2], { text: 'unset', eol: 'unspecified', binary: 'set' });
});

test('canonical report excludes current-machine identity while diagnostics classify CRLF separately', () => {
  const report = build();
  assert.ok(report.assets.every(asset => !Object.hasOwn(asset, 'workingTreeAtReconciliation')));
  assert.match(report.workingTreeDiagnosticPolicy, /excluded from this deterministic report/);
  const diagnostic = workingTreeDiagnostic(process.cwd(), ASSETS[0], 'TEXT');
  assert.equal(diagnostic.governed, false);
  assert.ok(['CANONICAL_MATCH', 'CRLF_CHECKOUT_MATERIALIZATION'].includes(diagnostic.classification));
});

test('CRLF checkout mutation is ignored but committed substantive drift changes source identity', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lp18321-git-'));
  const run = args => execFileSync('git', args, { cwd: root, stdio: 'ignore' });
  try {
    run(['init']); run(['config', 'user.email', 'test@example.invalid']); run(['config', 'user.name', 'LP183 test']);
    fs.writeFileSync(path.join(root, 'asset.txt'), 'alpha\nbeta\n'); run(['add', 'asset.txt']); run(['commit', '-m', 'baseline']);
    const baseline = sourceIdentity(root, 'asset.txt');
    fs.writeFileSync(path.join(root, 'asset.txt'), crlfMaterialization(Buffer.from('alpha\nbeta\n')));
    assert.deepEqual(sourceIdentity(root, 'asset.txt'), baseline);
    assert.notEqual(workingIdentity(root, 'asset.txt').sha256, baseline.sha256);
    fs.writeFileSync(path.join(root, 'asset.txt'), 'alpha\nCHANGED\n'); run(['add', 'asset.txt']); run(['commit', '-m', 'real drift']);
    assert.notEqual(sourceIdentity(root, 'asset.txt').sha256, baseline.sha256);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('classification and protected scope remain fail closed', () => {
  const report = build();
  assert.equal(report.classification, 'CROSS_PLATFORM_ASSET_IDENTITY_RECONCILED');
  assert.equal(report.findings.lp1832Status, 'OVERSIZED_ASSET_RESOLUTION_AUDIT_COMPLETE_IMPLEMENTATION_REQUIRED');
  assert.equal(report.findings.cloudExecution, 'NONE');
  assert.deepEqual(report.assets.map(x => x.path), ASSETS);
});
