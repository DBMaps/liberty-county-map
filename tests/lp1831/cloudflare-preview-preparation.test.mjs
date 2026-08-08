import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ROOT, build, inventory, isIncluded, stage } from '../../tools/lp1831/prepare-cloudflare-preview-artifact.mjs';

test('includes the required browser shell and excludes repository-only paths', () => {
  const inv = inventory();
  for (const required of ['index.html', 'beta-closed.html', 'beta-closure.html', 'manifest.json', 'service-worker.js', 'css/styles.css', 'js/app.js']) {
    assert.ok(inv.files.some(x => x.path === required), required);
  }
  for (const excluded of ['android/app/build.gradle', 'ios/App/App/Info.plist', 'tests/example.test.js', 'tools/example.mjs', 'reports/example.json', 'legal/drafts/example.md', 'js/gridly.local.js', 'css/styles.backup-v863-1-20260630-202256.css']) {
    assert.equal(isIncluded(excluded), false, excluded);
  }
});

test('all local static document and service-worker literals resolve into the artifact', () => {
  const paths = new Set(inventory().files.map(x => x.path));
  const text = ['index.html', 'manifest.json', 'service-worker.js'].map(x => fs.readFileSync(path.join(ROOT, x), 'utf8')).join('\n');
  const candidates = [...text.matchAll(/["']((?:\.\/)?(?:assets|css|js)\/[^"'?]+|(?:\.\/)?(?:index\.html|beta-closed\.html|beta-closure\.html|manifest\.json))[?]?[^"']*["']/g)].map(x => x[1].replace(/^\.\//, '').replace(/%20/g, ' '));
  for (const file of candidates) assert.ok(paths.has(file) || file === 'js/gridly.local.js', `unresolved local runtime reference: ${file}`);
});

test('staging is reproducible in two isolated directories', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1831-stage-test-'));
  try {
    const a = stage(path.join(temp, 'a'));
    const b = stage(path.join(temp, 'b'));
    assert.equal(a.artifactIdentity, b.artifactIdentity);
    assert.deepEqual(a.files, b.files);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('working-tree EOL drift cannot change canonical artifact identity', () => {
  const target = path.join(ROOT, 'index.html');
  const original = fs.readFileSync(target);
  const before = inventory().artifactIdentity;
  try {
    fs.writeFileSync(target, Buffer.from(original.toString('utf8').replace(/(?<!\r)\n/g, '\r\n')));
    assert.equal(inventory().artifactIdentity, before);
  } finally { fs.writeFileSync(target, original); }
  assert.equal(inventory().artifactIdentity, before);
});

test('staging ignores checkout bytes and writes canonical Git blobs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1831-canonical-stage-'));
  const target = path.join(ROOT, 'beta-closed.html');
  const original = fs.readFileSync(target);
  try {
    fs.writeFileSync(target, Buffer.from(original.toString('utf8').replace(/(?<!\r)\n/g, '\r\n')));
    stage(temp);
    assert.deepEqual(fs.readFileSync(path.join(temp, 'beta-closed.html')), original);
  } finally { fs.writeFileSync(target, original); fs.rmSync(temp, { recursive: true, force: true }); }
});

test('reports are fail-closed, secret-safe, and only plan Cloudflare commands', () => {
  const made = build();
  assert.match(made.readiness.classification, /OWNER_ACTION_REQUIRED$/);
  assert.equal(made.summary.cloudExecution, 'NONE');
  assert.ok(made.commands.sequence.every(x => x.executeNow === false && x.command.startsWith('npx --yes wrangler')));
  const emitted = JSON.stringify(made);
  assert.doesNotMatch(emitted, /BEGIN [A-Z ]*PRIVATE KEY|bearer\s+[A-Za-z0-9._-]{16,}|(?:api|private|secret)[_-]?(?:key|token)\s*[:=]\s*["'][^<]/i);
});
