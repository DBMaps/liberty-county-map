import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const loaderSource = fs.readFileSync('js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js', 'utf8');
const configSource = fs.readFileSync('js/gridlyRuntimeEnvironmentConfig.js', 'utf8');
const certified = fs.readFileSync('assets/location-resolution/gridly-authoritative-county-geometry-v1.json');
const stale = certified.subarray(0, 44779289);
const expectedSha = '891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316';

function response(bytes) {
  return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}

function runtime(sequence) {
  const calls = [];
  const queue = [...sequence];
  const fetch = async (url, options) => {
    calls.push({ url, options });
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return response(next ?? certified);
  };
  const subtle = { digest: async (_algorithm, value) => crypto.createHash('sha256').update(Buffer.from(value)).digest() };
  const window = {};
  const sandbox = { window, fetch, crypto: { subtle }, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, Object, Array, String, Number, Boolean, JSON, Promise, Error, console, encodeURIComponent };
  vm.createContext(sandbox);
  vm.runInContext(configSource, sandbox);
  vm.runInContext(loaderSource, sandbox);
  return { loader: window.gridlyLp0361cRuntimeCountyGeometryPackageLoader, calls, queue };
}

test('valid first response installs once without recovery and is reused', async () => {
  const { loader, calls } = runtime([certified]);
  const first = await loader.load();
  assert.equal(await loader.load(), first);
  assert.equal(calls.length, 1);
  assert.deepEqual([loader.getState().actualBytes, loader.getState().actualSha256, loader.getState().integrityPassed], [47911048, expectedSha, true]);
  assert.equal(loader.getState().recoveryAttempted, false);
});

test('stale first response is rejected and one certified-identity recovery installs', async () => {
  const { loader, calls } = runtime([stale, certified]);
  const pkg = await loader.load();
  assert.equal(pkg.counties.length, 254);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.cache, 'force-cache');
  assert.match(calls[1].url, new RegExp(`[?&]gridlyGeometryIdentity=${expectedSha}`));
  assert.equal(calls[1].options.cache, 'no-store');
  assert.equal(loader.getState().integrityPassed, true);
});

test('stale first and stale recovery fail closed with explicit unavailable state', async () => {
  const { loader, calls } = runtime([stale, stale]);
  await assert.rejects(loader.load(), /GEOMETRY_BYTE_LENGTH_MISMATCH:44779289/);
  assert.equal(calls.length, 2);
  assert.equal(loader.getCandidateGeometries(['harris-tx']), null);
  assert.deepEqual([loader.getState().cached, loader.getState().status, loader.getState().finalUnavailable], [false, 'geometry-unavailable', true]);
});

test('correct length SHA mismatch follows the same single recovery contract', async () => {
  const changed = Buffer.from(certified);
  changed[changed.length - 2] ^= 1;
  const { loader, calls } = runtime([changed, certified]);
  await loader.load();
  assert.equal(calls.length, 2);
  assert.equal(loader.getState().attempts[0].error.startsWith('GEOMETRY_SHA256_MISMATCH:'), true);
  assert.equal(loader.getState().integrityPassed, true);
});

test('concurrent operational and overlay consumers share one load lifecycle', async () => {
  const { loader, calls } = runtime([stale, certified]);
  const [operational, overlay] = await Promise.all([loader.load(), loader.load()]);
  assert.equal(operational, overlay);
  assert.equal(calls.length, 2, 'one initial request plus one recovery request');
});

test('failed promise does not poison a later valid cycle', async () => {
  const { loader, calls, queue } = runtime([new Error('offline')]);
  await assert.rejects(loader.load(), /offline/);
  queue.push(certified);
  const pkg = await loader.load();
  assert.equal(pkg.counties.length, 254);
  assert.equal(calls.length, 2);
  assert.equal(loader.getState().status, 'installed');
});

test('service worker cannot match the query-versioned recovery URL as stale canonical geometry', () => {
  const sw = fs.readFileSync('service-worker.js', 'utf8');
  assert.match(sw, /url === requestUrl\.href/);
  assert.match(loaderSource, /gridlyGeometryIdentity/);
  assert.match(loaderSource, /cache: "no-store"/);
});
