import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { lint } from '../tools/responder/phase25/package-lint.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('Phase 25 package passes static safety and contract lint', () => {
  const result = lint();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.counts, {
    schemas:4, types:23, tables:22, permissions:26, capabilities:5, commands:26,
    functions:64, policies:17, ownerDecisions:11, unresolvedProductionVerification:14,
    prohibitedPaths:0, productionConnections:0
  });
});

test('Phase 25 adds no migration-path or deploy-runner artifacts', () => {
  const packageDir = path.join(root, 'tools', 'responder', 'phase25');
  for (const name of fs.readdirSync(packageDir)) {
    assert.doesNotMatch(name, /\.(?:ps1|sh|bat|cmd|exe)$/i);
    assert.equal(path.join(packageDir,name).includes(path.join('supabase','migrations')), false);
  }
});

test('all SQL designs remain inside inert block comments', () => {
  const packageDir = path.join(root, 'tools', 'responder', 'phase25');
  for (const name of fs.readdirSync(packageDir).filter((n) => n.endsWith('.sql'))) {
    const text = fs.readFileSync(path.join(packageDir,name), 'utf8');
    const begin = text.indexOf('/*'), end = text.lastIndexOf('*/');
    assert.ok(begin >= 0 && end > begin, name);
    const outside = `${text.slice(0,begin)}\n${text.slice(end+2)}`
      .split(/\r?\n/).filter((line) => !/^\s*(--.*)?$/.test(line)).join('').trim();
    assert.equal(outside, '', name);
  }
});


test('manifest counts and artifact hashes match the design package', () => {
  const manifestPath = path.join(root, 'reports', 'responder', 'responder-phase25-production-shaped-neutral-migration-design.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.counts.tables, 22);
  assert.equal(manifest.counts.functions_total, 64);
  assert.equal(manifest.counts.rls_policies, 17);
  assert.equal(manifest.counts.prohibited_paths, 0);
  assert.equal(manifest.counts.production_connections, 0);
  for (const [relative, expected] of Object.entries(manifest.design_artifact_hashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
    assert.equal(actual, expected, relative);
  }
});
