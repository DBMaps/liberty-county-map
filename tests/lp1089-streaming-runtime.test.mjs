import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { IncrementalSha256 } from '../supabase/functions/_shared/incremental-sha256.mjs';
import { lookupLibertyCertifiedAddress } from '../supabase/functions/_shared/liberty-certified-address.mjs';

const root = new URL('../data/generated/lp104/txgio-addresses/', import.meta.url);
const certificate = new Uint8Array(await readFile(new URL('liberty-48291.runtime-certificate.json', root)));
const packageBytes = new Uint8Array(await readFile(new URL('liberty-48291.addresses.jsonl.gz', root)));
const request = { intent: 'address', query: '276 County Road 677, Dayton, TX 77535', structuredAddress: { street: '276 County Road 677', city: 'Dayton', county: 'Liberty County', state: 'TX', postalCode: '77535' }, context: { countyId: 'liberty-tx', countyFips: '48291' } };
const chunked = (bytes, chunkSize = 65536) => new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize)); controller.close(); } });
const storageFor = (gzip = packageBytes, chunkSize) => ({ from: () => ({ download: async path => ({ data: { stream: () => chunked(path.endsWith('.json') ? certificate : gzip, chunkSize), arrayBuffer: () => { throw new Error('full buffering forbidden'); } }, error: null }) }) });

test('incremental SHA-256 equals WebCrypto/full-buffer digest across irregular chunks', async () => {
  const bytes = new TextEncoder().encode('streamed digest fixture '.repeat(1000)); const hash = new IncrementalSha256();
  for (let i = 0; i < bytes.length; i += 37) hash.update(bytes.subarray(i, i + 37));
  assert.equal(hash.digestHex(), createHash('sha256').update(bytes).digest('hex'));
});

test('certified package uses bounded chunks and never calls arrayBuffer', async () => {
  const result = await lookupLibertyCertifiedAddress(request, { storage: storageFor(packageBytes, 16384) }); const d = result.runtimeDiagnostic;
  assert.equal(result.outcome, 'exact_match'); assert.equal(d.streamingDownloadUsed, true); assert.equal(d.incrementalHashUsed, true);
  assert.equal(d.compressedBytesRead, packageBytes.length); assert.equal(d.maximumBufferedChunkBytes, 16384);
  assert.equal(d.compressedByteSizeValidated, true); assert.equal(d.sha256Validated, true); assert.equal(d.decompressionCompleted, true);
  assert.equal(d.exactMatchEncountered, true); assert.equal(d.exactMatchPromotedAfterIntegrityValidation, true);
  assert.ok(d.recordsScanned > 0); assert.doesNotMatch(JSON.stringify(d), /276 County Road|Authorization|apikey/);
});

test('byte-size mismatch fails closed after provisional match', async () => {
  const extended = new Uint8Array(packageBytes.length + 1); extended.set(packageBytes); extended.at(-1); // trailing gzip garbage still reaches integrity gate
  const result = await lookupLibertyCertifiedAddress(request, { storage: storageFor(extended) });
  assert.equal(result.outcome, 'package_unavailable'); assert.deepEqual(result.results, []);
  assert.equal(result.runtimeDiagnostic.compressedByteSizeValidated, false);
  assert.equal(result.runtimeDiagnostic.exactMatchPromotedAfterIntegrityValidation, false);
});

test('SHA mismatch fails closed without promoting an encountered exact match', async () => {
  const changed = packageBytes.slice(); changed[changed.length - 5] ^= 1;
  const result = await lookupLibertyCertifiedAddress(request, { storage: storageFor(changed) });
  assert.equal(result.outcome, 'package_unavailable'); assert.deepEqual(result.results, []);
  assert.equal(result.runtimeDiagnostic.sha256Validated, false);
  assert.equal(result.runtimeDiagnostic.exactMatchPromotedAfterIntegrityValidation, false);
});

test('truncated and invalid gzip streams fail closed', async () => {
  for (const bytes of [packageBytes.slice(0, packageBytes.length - 8), new Uint8Array(packageBytes.length)]) {
    const result = await lookupLibertyCertifiedAddress(request, { storage: storageFor(bytes) });
    assert.equal(result.outcome, 'package_unavailable'); assert.deepEqual(result.results, []);
    assert.equal(result.runtimeDiagnostic.decompressionCompleted, false);
  }
});

test('truthful miss, nearby house, and wrong FIPS remain unpromoted', async () => {
  for (const body of [{ ...request, structuredAddress: { ...request.structuredAddress, street: '275 County Road 677' }, query: '275 County Road 677, Dayton, TX 77535' }, { ...request, context: { ...request.context, countyFips: '48201' } }]) {
    const result = await lookupLibertyCertifiedAddress(body, { storage: storageFor() });
    assert.equal(result.results.length, 0); assert.ok(['truthful_no_result', 'ineligible'].includes(result.outcome));
  }
});
