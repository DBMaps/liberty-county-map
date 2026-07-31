import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { createHash, webcrypto } from 'node:crypto';

const source = await readFile('js/lp1045-txgio-address-runtime.js', 'utf8');
const manifestUrl = 'data/generated/lp104/txgio-addresses/runtime-manifest.json';
const definitions = [
  ['liberty-tx', 'Liberty County', '48291', '276', 'County Road 677', 'Dayton', '77535'],
  ['harris-tx', 'Harris County', '48201', '100', 'Main Street', 'Houston', '77002'],
  ['montgomery-tx', 'Montgomery County', '48339', '200', 'Frazier Street', 'Conroe', '77301']
].map(([countyId, county, fips, h, r, p, z]) => {
  const record = { i: countyId, h, r, a: `${h} ${r}`, p, z, c: county, f: fips, x: -95, y: 30 };
  const body = gzipSync(`${JSON.stringify(record)}\n`);
  const path = `packages/${countyId}.jsonl.gz`;
  const certificate = `certificates/${countyId}.json`;
  const sha256 = createHash('sha256').update(body).digest('hex');
  return { countyId, county, fips, h, r, p, z, record, body, entry: { countyId, county, fips, path, certificate, sizeBytes: body.byteLength, sha256 } };
});
const fetches = [];
const window = {
  crypto: webcrypto, DecompressionStream,
  fetch: async url => {
    fetches.push(url);
    if (url === manifestUrl) return Response.json({ schemaVersion: 1, milestone: 'LP104.7-test', packages: definitions.map(item => item.entry) });
    const definition = definitions.find(item => item.entry.path === url || item.entry.certificate === url);
    assert.ok(definition, `unexpected fetch ${url}`);
    if (url === definition.entry.path) return new Response(definition.body);
    return Response.json({ ...definition.entry, artifact: definition.entry.path.split('/').pop(), acceptance: { houseNumber: 'exact', road: 'canonical_exact', interpolation: false, nearbyHouseSubstitution: false } });
  }
};
vm.runInNewContext(source, { window, Response, TextDecoder, console });
const runtime = window.gridlyTxgioAddressRuntime;
const packageFetches = () => fetches.filter(url => url.startsWith('packages/'));

test('startup and business search download zero county packages', async () => {
  assert.deepEqual(Array.from(runtime.diagnostics().loadedCountyPackages), []);
  assert.equal(packageFetches().length, 0);
  assert.equal((await runtime.search({ query: 'Houston coffee shop' })).attempted, false);
  assert.equal(fetches.length, 0);
});

test('selects, validates, lazily loads, and caches one certified county at a time', async () => {
  for (const [index, definition] of definitions.entries()) {
    const result = await runtime.search({ query: `${definition.h} ${definition.r}, ${definition.p}, TX ${definition.z}` });
    assert.equal(result.outcome, 'exact_match');
    assert.equal(result.fips, definition.fips);
    assert.deepEqual(packageFetches(), definitions.slice(0, index + 1).map(item => item.entry.path));
  }
  await runtime.search({ query: '276 County Rd 677, Dayton, TX 77535' });
  await runtime.search({ query: '100 Main Street, Houston, TX 77002' });
  assert.equal(packageFetches().length, 3, 'repeated and cross-county searches reuse cached package promises');
  assert.equal(fetches.filter(url => url === manifestUrl).length, 1, 'runtime manifest is cached');
  assert.equal(fetches.filter(url => url.startsWith('certificates/')).length, 3, 'each required runtime certificate validates once');
});

test('keeps exact-address and unsupported-county behavior truthful', async () => {
  const wrongHouse = await runtime.search({ query: '101 Main Street, Houston, TX 77002' });
  assert.equal(wrongHouse.outcome, 'truthful_no_result');
  assert.equal(wrongHouse.results.length, 0);
  assert.equal((await runtime.search({ query: '100 Main Street, Travis County, TX 78701' })).attempted, false);
  assert.equal(packageFetches().length, 3);
});

test('browser certification helper exposes the LP104.7 report contract', async () => {
  assert.equal(typeof window.gridlyCertifyLp1047MultiCountyRuntime, 'function');
  const report = await window.gridlyCertifyLp1047MultiCountyRuntime({ cases: [
    ['276 County Road 677, Dayton, TX 77535', 'exact_match'],
    ['101 Main Street, Houston, TX 77002', 'truthful_no_result']
  ] });
  for (const key of ['startupPackageLoads', 'loadedCountyPackages', 'cachedCountyPackages', 'packageReusePass', 'lazyLoadingPass', 'countySelectionPass', 'exactAddressPass', 'truthfulNoResultPass', 'businessSearchPass', 'overallPass']) assert.ok(key in report, key);
  assert.equal(report.overallPass, true);
});

test('production runtime manifest and certificate remain mutually consistent', async () => {
  const manifest = JSON.parse(await readFile('data/generated/lp104/txgio-addresses/runtime-manifest.json', 'utf8'));
  for (const entry of manifest.packages) {
    const certificate = JSON.parse(await readFile(entry.certificate, 'utf8'));
    assert.equal(certificate.countyId, entry.countyId);
    assert.equal(certificate.fips, entry.fips);
    assert.equal(certificate.sizeBytes, entry.sizeBytes);
    assert.equal(certificate.sha256, entry.sha256);
    assert.equal(certificate.artifact, entry.path.split('/').pop());
  }
});
