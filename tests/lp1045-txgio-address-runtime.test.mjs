import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { gzipSync } from 'node:zlib';

const source = await readFile('js/lp1045-txgio-address-runtime.js', 'utf8');
const records = [
  { i: 'positive-control', h: '276', r: 'County Road 677', a: '276 County Road 677', p: 'Dayton', z: '77535', c: 'Liberty', f: '48291', x: -94.9, y: 30.1, s: 'TxGIO', u: '2026' },
  { i: 'other-road', h: '274', r: 'County Road 676', a: '274 County Road 676', p: 'Dayton', z: '77535', c: 'Liberty', f: '48291', x: -94.8, y: 30.2, s: 'TxGIO', u: '2026' }
];
const body = gzipSync(`${records.map(JSON.stringify).join('\n')}\n`);
let fetchCount = 0;
const window = {
  fetch: async (url) => { fetchCount += 1; assert.equal(url, 'data/generated/lp104/txgio-addresses/liberty-48291.addresses.jsonl.gz'); return new Response(body); },
  DecompressionStream
};
vm.runInNewContext(source, { window, TextDecoder, Response, console });
const runtime = window.gridlyTxgioAddressRuntime;

assert.equal((await runtime.search({ query: 'Dayton Walmart' })).attempted, false, 'business searches do not load an address package');
assert.equal(fetchCount, 0, 'package remains lazy before an eligible Liberty address search');
const exact = await runtime.search({ query: '276 County Rd 677, Dayton, TX 77535' });
assert.equal(exact.outcome, 'exact_match');
assert.equal(exact.results[0].address.house_number, '276');
assert.equal(exact.results[0].gridlyResolution.precision, 'exact_address_point');
const absent = await runtime.search({ query: '274 CR 677, Dayton, TX 77535' });
assert.equal(absent.outcome, 'truthful_no_result');
assert.equal(absent.results.length, 0, 'nearby or other-road records are never substituted');
assert.equal(fetchCount, 1, 'Liberty package is loaded once and reused');
assert.equal((await runtime.search({ query: '276 County Road 677, Austin, TX 78701' })).attempted, false, 'unregistered counties do not load Liberty data');

const certification = await runtime.certification();
assert.equal(certification.passed, true);
assert.equal(Array.from(certification.cases, (item) => item.actual).join(','), 'exact_match,truthful_no_result');

const app = await readFile('js/app.js', 'utf8');
assert.match(app, /intent\.type === GRIDLY_DESTINATION_INTENTS\.ADDRESS && typeof window\.gridlyTxgioAddressRuntime\?\.search/);
assert.match(app, /diagnostics\.txgioRuntime\?\.outcome === "exact_match" \? \[\] : queryVariants/);
