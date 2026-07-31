import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';
import { createHash, webcrypto } from 'node:crypto';

const source = await readFile('js/lp1045-txgio-address-runtime.js', 'utf8');
const records = [
  { i: 'positive-control', h: '276', r: 'County Road 677', a: '276 County Road 677', p: 'Dayton', z: '77535', c: 'Liberty', f: '48291', x: -94.9, y: 30.1, s: 'TxGIO', u: '2026' },
  { i: 'other-road', h: '274', r: 'County Road 676', a: '274 County Road 676', p: 'Dayton', z: '77535', c: 'Liberty', f: '48291', x: -94.8, y: 30.2, s: 'TxGIO', u: '2026' }
];
const body = gzipSync(`${records.map(JSON.stringify).join('\n')}\n`);
let fetchCount = 0;
let packageFetchCount = 0;
const packagePath = 'data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz';
const manifestPath = 'data/generated/lp104/txgio-addresses/runtime-manifest.json';
const fixtureCertificate = { fips: '48291', path: packagePath, sizeBytes: body.byteLength, sha256: createHash('sha256').update(body).digest('hex') };
const window = {
  fetch: async (url) => {
    fetchCount += 1;
    if (url === manifestPath) return Response.json({ schemaVersion: 1, packages: [fixtureCertificate] });
    assert.equal(url, packagePath);
    packageFetchCount += 1;
    return new Response(body);
  },
  DecompressionStream,
  crypto: webcrypto
};
vm.runInNewContext(source, { window, TextDecoder, Response, console });
const runtime = window.gridlyTxgioAddressRuntime;

assert.equal((await runtime.search({ query: 'Dayton Walmart' })).attempted, false, 'business searches do not load an address package');
assert.equal(fetchCount, 0, 'manifest and package remain lazy before an eligible Liberty address search');
const exact = await runtime.search({ query: '276 County Rd 677, Dayton, TX 77535' });
assert.equal(exact.outcome, 'exact_match');
assert.equal(exact.results[0].address.house_number, '276');
assert.equal(exact.results[0].gridlyResolution.precision, 'exact_address_point');
const absent = await runtime.search({ query: '274 CR 677, Dayton, TX 77535' });
assert.equal(absent.outcome, 'truthful_no_result');
assert.equal(absent.results.length, 0, 'nearby or other-road records are never substituted');
assert.equal(packageFetchCount, 1, 'Liberty package is loaded once and reused');
assert.equal(fetchCount, 2, 'the runtime fetches one manifest and one package');
assert.equal((await runtime.search({ query: '276 County Road 677, Austin, TX 78701' })).attempted, false, 'unregistered counties do not load Liberty data');
assert.equal((await runtime.search({ query: '276 County Road 677', countyId: 'liberty-tx' })).outcome, 'exact_match', 'active Liberty context qualifies an unambiguous street-only address');
assert.equal(fetchCount, 2, 'repeated exact searches reuse the verified package index');

const certification = await runtime.certification();
assert.equal(certification.passed, true);
assert.equal(Array.from(certification.cases, (item) => item.actual).join(','), 'exact_match,truthful_no_result');

const app = await readFile('js/app.js', 'utf8');
assert.match(app, /intent\.type === GRIDLY_DESTINATION_INTENTS\.ADDRESS && typeof window\.gridlyTxgioAddressRuntime\?\.search/);
assert.match(app, /diagnostics\.txgioRuntime\?\.outcome === "exact_match" \? \[\] : queryVariants/);

const productionManifest = JSON.parse(await readFile('data/generated/lp104/txgio-addresses/runtime-manifest.json', 'utf8'));
assert.deepEqual(productionManifest.packages[0], {
  countyId: 'liberty-tx', county: 'Liberty County', fips: '48291', path: packagePath,
  sizeBytes: 2555016, sha256: '792f4f3f76524ef6652fbabf7c1c17d76eb1dfd9d83a71c460c1e038c2841b93',
  certificate: 'data/generated/lp104/txgio-addresses/liberty-48291.runtime-certificate.json'
});
