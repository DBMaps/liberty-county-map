import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { stageNativeAddressRuntime } from '../tools/native-web.mjs';

const manifestPath = 'data/generated/lp104/txgio-addresses/runtime-manifest.json';
const expectedSourcePath = 'data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz';
const expectedAliasPath = 'data/generated/lp104/txgio-addresses/native/liberty-48291.addresses.bin';
const expectedSha256 = '792f4f3f76524ef6652fbabf7c1c17d76eb1dfd9d83a71c460c1e038c2841b93';
const expectedBytes = 2_555_016;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('native staging projects a byte-identical Android-safe address alias without changing source authority', async (t) => {
  const destination = await mkdtemp(join(tmpdir(), 'gridly-lp2443-address-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  const sourceManifestBefore = await readFile(manifestPath);
  await stageNativeAddressRuntime(process.cwd(), destination);
  const sourceManifestAfter = await readFile(manifestPath);
  assert.deepEqual(sourceManifestAfter, sourceManifestBefore, 'native staging must not rewrite the browser/source manifest');

  const sourceManifest = JSON.parse(sourceManifestBefore);
  const sourceEntry = sourceManifest.packages[0];
  assert.equal(sourceEntry.path, expectedSourcePath);
  assert.equal(sourceEntry.sourcePath, undefined);
  assert.equal(sourceEntry.sizeBytes, expectedBytes);
  assert.equal(sourceEntry.sha256, expectedSha256);

  const nativeManifest = JSON.parse(await readFile(join(destination, manifestPath)));
  assert.equal(nativeManifest.packages[0].path, expectedAliasPath);
  assert.equal(nativeManifest.packages[0].sourcePath, expectedSourcePath);
  const [sourceBytes, aliasBytes] = await Promise.all([readFile(expectedSourcePath), readFile(join(destination, expectedAliasPath))]);
  assert.deepEqual(aliasBytes, sourceBytes);
  assert.equal(aliasBytes.byteLength, expectedBytes);
  assert.equal(sha256(aliasBytes), expectedSha256);
  await assert.rejects(readFile(join(destination, expectedSourcePath)), { code: 'ENOENT' });
  await assert.rejects(readFile(join(destination, expectedSourcePath.replace(/\.gz$/, ''))), { code: 'ENOENT' });
});

test('address loader validates and decompresses gzip bytes served from the native alias independent of extension', async (t) => {
  const destination = await mkdtemp(join(tmpdir(), 'gridly-lp2443-loader-'));
  t.after(() => rm(destination, { recursive: true, force: true }));
  await stageNativeAddressRuntime(process.cwd(), destination);
  const source = await readFile('js/lp1045-txgio-address-runtime.js', 'utf8');
  const nativeManifest = JSON.parse(await readFile(join(destination, manifestPath), 'utf8'));
  const entry = nativeManifest.packages[0];
  const requested = [];
  const window = {
    crypto: webcrypto,
    DecompressionStream,
    fetch: async (url) => {
      requested.push(url);
      const bytes = await readFile(join(destination, url));
      return url.endsWith('.json') ? Response.json(JSON.parse(bytes)) : new Response(bytes);
    }
  };
  vm.runInNewContext(source, { window, Response, TextDecoder, console });
  const result = await window.gridlyTxgioAddressRuntime.search({ query: '276 County Road 677, Dayton, TX 77535' });
  assert.equal(result.outcome, 'exact_match');
  assert.equal(result.results[0].address.house_number, '276');
  assert.ok(requested.includes(entry.path));
  assert.equal(requested.includes(entry.sourcePath), false, 'native loader must fetch only the projected serving path');
});
