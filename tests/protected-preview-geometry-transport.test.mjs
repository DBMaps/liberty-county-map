import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const loaderSource = fs.readFileSync(new URL('../js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js', import.meta.url), 'utf8');
const configSource = fs.readFileSync(new URL('../js/gridlyRuntimeEnvironmentConfig.js', import.meta.url), 'utf8');
const geometryBytes = fs.readFileSync(new URL('../assets/location-resolution/gridly-authoritative-county-geometry-v1.json', import.meta.url));
const governedSha = '891652f2e63459451ef10e0b723bcf90378dc22a275945978cd73aa8d8e40316';

function browser(bytes, { digest = null, networkError = null } = {}) {
  const window = {};
  const subtle = { digest: async (_algorithm, value) => digest ? Buffer.from(digest, 'hex') : crypto.createHash('sha256').update(Buffer.from(value)).digest() };
  const fetch = async () => {
    if (networkError) throw networkError;
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  };
  const sandbox = { window, fetch, crypto: { subtle }, TextDecoder, TextEncoder, Uint8Array, ArrayBuffer, Object, Array, String, Number, Boolean, JSON, Promise, Error, console };
  vm.createContext(sandbox);
  vm.runInContext(configSource, sandbox);
  vm.runInContext(loaderSource, sandbox);
  return window.gridlyLp0361cRuntimeCountyGeometryPackageLoader;
}

function exactLengthJson(value) {
  const json = Buffer.from(JSON.stringify(value));
  assert.ok(json.length <= geometryBytes.length);
  return Buffer.concat([json, Buffer.alloc(geometryBytes.length - json.length, 0x20)]);
}

test('tracked runtime config selects only the governed canonical local package', () => {
  assert.match(configSource, /mode:\s*"LOCAL_CANONICAL"/);
  assert.match(configSource, /assets\/location-resolution\/gridly-authoritative-county-geometry-v1\.json/);
  assert.doesNotMatch(configSource + loaderSource, /location\.hostname|preview\.gridlygo\.com/);
});

test('the exact governed geometry bytes, SHA-256, JSON, and 254 counties install', async () => {
  const loader = browser(geometryBytes);
  const pkg = await loader.load();
  assert.equal(pkg.counties.length, 254);
  assert.deepEqual({ bytes: loader.getState().actualBytes, sha: loader.getState().actualSha256, passed: loader.getState().integrityPassed }, { bytes: 47911048, sha: governedSha, passed: true });
});

test('byte-length and SHA mismatches fail closed without a cached package', async (t) => {
  await t.test('byte length', async () => {
    const loader = browser(geometryBytes.subarray(0, geometryBytes.length - 1));
    await assert.rejects(loader.load(), /GEOMETRY_BYTE_LENGTH_MISMATCH/);
    assert.equal(loader.getState().cached, false);
  });
  await t.test('SHA-256', async () => {
    const changed = Buffer.from(geometryBytes); changed[changed.length - 2] ^= 1;
    const loader = browser(changed);
    await assert.rejects(loader.load(), /GEOMETRY_SHA256_MISMATCH/);
    assert.equal(loader.getState().cached, false);
  });
});

test('invalid JSON and incorrect county count fail closed after byte/hash gates', async (t) => {
  await t.test('invalid JSON', async () => {
    const loader = browser(Buffer.alloc(geometryBytes.length, 0x78), { digest: governedSha });
    await assert.rejects(loader.load(), /GEOMETRY_JSON_INVALID/);
    assert.equal(loader.getState().cached, false);
  });
  await t.test('county count', async () => {
    const loader = browser(exactLengthJson({ counties: [] }), { digest: governedSha });
    await assert.rejects(loader.load(), /GEOMETRY_COUNTY_COUNT_MISMATCH:0/);
    assert.equal(loader.getState().cached, false);
  });
});

test('network failure leaves geometry unavailable and records the load error', async () => {
  const loader = browser(Buffer.alloc(0), { networkError: new Error('offline') });
  await assert.rejects(loader.load(), /offline/);
  assert.equal(loader.getCandidateGeometries(['liberty-tx']), null);
  assert.equal(loader.getState().cached, false);
});
