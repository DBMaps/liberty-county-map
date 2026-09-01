import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import crypto from 'node:crypto';
import { ROOT, RUNTIME_CONFIG_PATH, build, composeProductionRuntimeConfig, inventory, inventoryDirectory, isIncluded, stage, stageProduction, verify, verifyProduction } from '../../tools/lp1831/prepare-cloudflare-preview-artifact.mjs';
import { canonicalBlob, crlfMaterialization } from '../../tools/lp18321/git-asset-identity.mjs';

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
  const file = 'index.html';
  const target = path.join(ROOT, file);
  const original = fs.readFileSync(target);
  const canonical = canonicalBlob(ROOT, file);
  const before = inventory().artifactIdentity;
  try {
    fs.writeFileSync(target, crlfMaterialization(canonical));
    const staged = stage(temp);
    assert.deepEqual(fs.readFileSync(path.join(temp, file)), canonical);
    assert.equal(staged.artifactIdentity, before);
    assert.equal(verify(), true);
  } finally { fs.writeFileSync(target, original); fs.rmSync(temp, { recursive: true, force: true }); }
});

test('reports are fail-closed, secret-safe, and only plan Cloudflare commands', () => {
  const made = build();
  assert.match(made.readiness.classification, /(?:OWNER_ACTION|OWNER_EXECUTION)_REQUIRED$/);
  assert.equal(made.summary.cloudExecution, 'NONE');
  assert.ok(made.commands.sequence.every(x => x.executeNow === false && x.command.startsWith('npx --yes wrangler')));
  const emitted = JSON.stringify(made);
  assert.doesNotMatch(emitted, /BEGIN [A-Z ]*PRIVATE KEY|bearer\s+[A-Za-z0-9._-]{16,}|(?:api|private|secret)[_-]?(?:key|token)\s*[:=]\s*["'][^<]/i);
});

const canonicalRuntime = () => canonicalBlob(ROOT, RUNTIME_CONFIG_PATH);
const overlay = (arcgis = 'test-arcgis-public-key', driveTexas = 'test-drivetexas-public-key') => Buffer.from(JSON.stringify({ arcgisStaticBasemapApiKey: arcgis, driveTexas: { apiKey: driveTexas } }));
const evaluate = bytes => { const window = {}; Function('window', bytes.toString('utf8'))(window); return window; };

test('production composition fails closed for missing, malformed, incomplete, and unknown overlays', () => {
  assert.throws(() => stageProduction(), /PRODUCTION_RUNTIME_CONFIG_FILE_REQUIRED/);
  assert.throws(() => composeProductionRuntimeConfig(canonicalRuntime(), Buffer.from('{')), /MALFORMED/);
  assert.throws(() => composeProductionRuntimeConfig(canonicalRuntime(), Buffer.from('{}')), /PROPERTIES_DISALLOWED/);
  assert.throws(() => composeProductionRuntimeConfig(canonicalRuntime(), Buffer.from(JSON.stringify({ arcgisStaticBasemapApiKey: 'x', driveTexas: { apiKey: 'y' }, surprise: true }))), /PROPERTIES_DISALLOWED/);
});

test('production overlay is additive and preserves governed runtime and DriveTexas contracts', () => {
  const before = evaluate(canonicalRuntime()).GRIDLY_RUNTIME_CONFIG;
  const afterWindow = evaluate(composeProductionRuntimeConfig(canonicalRuntime(), overlay()));
  const after = afterWindow.GRIDLY_RUNTIME_CONFIG;
  assert.equal(after.arcgisStaticBasemapApiKey, 'test-arcgis-public-key');
  assert.equal(after.poiBrowserProvider.enabled, 'ENABLED');
  assert.deepEqual(after.authoritativeCountyGeometry, before.authoritativeCountyGeometry);
  for (const key of Object.keys(before)) if (key !== 'arcgisStaticBasemapApiKey') assert.deepEqual(after[key], before[key]);
  assert.equal(afterWindow.GRIDLY_CONFIG.driveTexas.apiKey, 'test-drivetexas-public-key');
  const provider = fs.readFileSync(path.join(ROOT, 'js/gridlyDriveTexasProvider.js'), 'utf8');
  assert.match(provider, /GRIDLY_CONFIG\.driveTexas/);
  assert.match(provider, /GRIDLY_CONFIG\.txdot/);
  assert.match(provider, /GRIDLY_TXDOT_API_KEY/);
});

test('production staging attests final composed bytes, excludes local/input files, is deterministic, and redacts values', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1831-production-'));
  try {
    const inputA = path.join(temp, 'owner-a.json'), inputB = path.join(temp, 'owner-b.json');
    fs.writeFileSync(inputA, overlay('arcgis-alpha', 'drive-alpha'));
    fs.writeFileSync(inputB, overlay('arcgis-beta', 'drive-beta'));
    const aOutput = path.join(temp, 'a'), repeatOutput = path.join(temp, 'repeat'), bOutput = path.join(temp, 'b');
    const a = stageProduction({ output: aOutput, runtimeConfigFile: inputA, reportFile: path.join(temp, 'a-report.json') });
    const repeat = stageProduction({ output: repeatOutput, runtimeConfigFile: inputA, reportFile: path.join(temp, 'repeat-report.json') });
    const b = stageProduction({ output: bOutput, runtimeConfigFile: inputB, reportFile: path.join(temp, 'b-report.json') });
    const actualRuntime = fs.readFileSync(path.join(aOutput, RUNTIME_CONFIG_PATH));
    assert.equal(a.report.runtimeConfig.sha256, crypto.createHash('sha256').update(actualRuntime).digest('hex'));
    assert.equal(a.artifactIdentity, repeat.artifactIdentity);
    assert.deepEqual(a.files, repeat.files);
    assert.notEqual(a.report.runtimeConfig.sha256, b.report.runtimeConfig.sha256);
    assert.notEqual(a.artifactIdentity, b.artifactIdentity);
    for (const output of [aOutput, repeatOutput, bOutput]) {
      assert.equal(fs.existsSync(path.join(output, 'js/gridly.local.js')), false);
      assert.equal(fs.existsSync(path.join(output, path.basename(inputA))), false);
      assert.ok(inventoryDirectory(output).files.every(file => !/(^|\/)tests\//.test(file.path)));
    }
    const reportText = fs.readFileSync(path.join(temp, 'a-report.json'), 'utf8');
    assert.doesNotMatch(reportText, /arcgis-alpha|drive-alpha/);
    assert.equal(verifyProduction({ output: aOutput, reportFile: path.join(temp, 'a-report.json') }).artifactDigest, a.artifactIdentity);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
