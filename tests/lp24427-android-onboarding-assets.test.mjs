import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { copyGovernedRuntime, runtimePolicy } from '../tools/native-web.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(join(repositoryRoot, path), 'utf8');
const bytes = (path) => readFileSync(join(repositoryRoot, path));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const pngDimensions = (value) => {
  assert.equal(value.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'asset must be a valid PNG');
  assert.equal(value.subarray(12, 16).toString('ascii'), 'IHDR', 'PNG must begin with an IHDR chunk');
  return { width: value.readUInt32BE(16), height: value.readUInt32BE(20) };
};
const manifest = JSON.parse(read('assets/walkthrough/walkthrough-assets.json'));
const expectedDimensions = {
  kbyg: { width: 836, height: 1124 },
  nearby: { width: 828, height: 1796 },
  alerts: { width: 832, height: 1796 },
  report: { width: 884, height: 1808 },
  settings: { width: 856, height: 1812 },
};
const expected = Object.fromEntries(manifest.slides.map(({ id, productionAsset, sha256: hash, width, height }) => [id, { path: productionAsset, hash, width, height }]));

function assertExactCase(relativePath) {
  let current = repositoryRoot;
  for (const segment of relativePath.split('/')) {
    assert.ok(readdirSync(current).includes(segment), `${relativePath} must use exact on-disk filename case at ${segment}`);
    current = join(current, segment);
  }
}

test('LP244.27 onboarding source paths are exact, immutable, and Capacitor-compatible', () => {
  const app = read('js/app.js');
  const html = read('index.html');
  const css = read('css/styles.css');
  const featureMarkup = app.slice(app.indexOf('data-gridly-approved-slide="kbyg"'), app.indexOf('data-gridly-onboarding-page="setup"'));

  assert.equal(Object.keys(expected).length, 5);
  for (const [id, asset] of Object.entries(expected)) {
    assert.match(asset.path, /^assets\/walkthrough\/[a-z0-9-]+\.png$/);
    assert.equal(asset.path.startsWith('/'), false, `${asset.path} must remain origin-relative`);
    assert.equal(asset.path.includes('..'), false, `${asset.path} must not traverse directories`);
    assertExactCase(asset.path);
    const assetBytes = bytes(asset.path);
    assert.equal(sha256(assetBytes), asset.hash, `${asset.path} must match its approved hash`);
    assert.deepEqual({ width: asset.width, height: asset.height }, expectedDimensions[id], `${asset.path} manifest dimensions must match the LP244.27 quality target`);
    assert.deepEqual(pngDimensions(assetBytes), expectedDimensions[id], `${asset.path} intrinsic dimensions must match the governed manifest`);
    assert.ok(asset.width >= 800 && asset.height >= 1100, `${asset.path} must remain a high-density walkthrough asset`);
    assert.match(featureMarkup, new RegExp(`data-gridly-approved-slide="${id}"[\\s\\S]*?src="${asset.path.replaceAll('/', '\\/')}"`));
    assert.equal(html.includes(asset.path), false, `${asset.path} is dynamically referenced, not static HTML`);
    assert.equal(css.includes(asset.path), false, `${asset.path} is image content, not a CSS URL`);
    assert.equal(new URL(asset.path, 'http://127.0.0.1:5500/').href, `http://127.0.0.1:5500/${asset.path}`);
    assert.equal(new URL(asset.path, 'https://localhost/').href, `https://localhost/${asset.path}`);
  }
});

test('LP244.27 governed native copy lands all five images in Android public layout', async () => {
  const destinationRoot = mkdtempSync(join(tmpdir(), 'gridly-lp24427-'));
  const androidPublic = join(destinationRoot, 'android', 'app', 'src', 'main', 'assets', 'public');
  try {
    for (const { path, hash, width, height } of Object.values(expected)) {
      assert.ok(runtimePolicy.files.includes(path), `${path} must be explicitly governed by the native allowlist`);
      await copyGovernedRuntime(repositoryRoot, androidPublic, path);
      const packagedPath = join(androidPublic, path);
      assert.ok(existsSync(packagedPath), `${path} must land under Android assets/public`);
      const packagedBytes = readFileSync(packagedPath);
      assert.equal(sha256(packagedBytes), hash, `${path} must remain byte-identical after native copy`);
      assert.deepEqual(pngDimensions(packagedBytes), { width, height }, `${path} must retain its native high-density dimensions after copy`);
    }
    assert.equal(runtimePolicy.files.includes('assets/walkthrough'), false, 'reference-only walkthrough files must not enter native staging through a broad directory copy');
    assert.equal(existsSync(join(androidPublic, manifest.referenceOnly.path)), false, 'owner reference composite must remain outside the Android runtime');
    assert.equal(existsSync(join(androidPublic, 'assets/walkthrough/walkthrough-assets.json')), false, 'manufacturing manifest must remain outside the Android runtime');
  } finally {
    rmSync(destinationRoot, { recursive: true, force: true });
  }
});

test('LP244.27 Capacitor and service-worker contracts preserve local packaged delivery', () => {
  const capacitor = JSON.parse(read('capacitor.config.json'));
  const serviceWorker = read('service-worker.js');
  assert.equal(capacitor.appId, 'com.gridlygo.gridly');
  assert.equal(capacitor.webDir, 'www');
  assert.doesNotMatch(serviceWorker, /assets\/walkthrough\/gridly-walkthrough-/);
  assert.match(serviceWorker, /if \(!closureUrl\) return;/);
  assert.match(serviceWorker, /if \(response && response\.ok\)[\s\S]*cache\.put/);
});
