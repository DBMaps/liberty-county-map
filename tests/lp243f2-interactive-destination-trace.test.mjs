import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { webcrypto } from 'node:crypto';

const providerSource = fs.readFileSync('js/gridlyPoiBrowserProvider.js', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');

function providerRuntime() {
  const context = { console, fetch: async () => { throw new Error('not used'); } };
  context.globalThis = context;
  vm.runInNewContext(providerSource, context);
  return context.GridlyPoiBrowserProvider;
}

test('runtime name filtering happens before the fixed 50-result publication limit', () => {
  const api = providerRuntime();
  const matcher = api._test.recordMatchesNameTokens;
  for (const displayName of ["McDonald's", 'McDonalds', 'McDonald’s']) {
    assert.equal(matcher({ displayName }, ['mcdonalds']), true, displayName);
  }
  assert.equal(matcher({ displayName: 'Whataburger' }, ['mcdonalds']), false);
  assert.equal(matcher({ displayName: "Lowe's" }, ['lowes']), true, 'second punctuation-bearing business');
  const searchBody = providerSource.slice(providerSource.indexOf('async function search(request)'), providerSource.indexOf('function rollback()'));
  assert.ok(searchBody.indexOf('recordMatchesNameTokens') < searchBody.indexOf('eligible.slice(0, 50)'));
});

test('Port Arthur runtime acquisition returns both certified local records before ranking', async () => {
  const base = 'poi/lp24111-d5-standalone-2026-08-28/runtime-v2/';
  const context = {
    console, TextDecoder, Response, Blob, DecompressionStream, crypto: webcrypto,
    GRIDLY_RUNTIME_CONFIG: { poiBrowserProvider: { enabled: 'ENABLED' } },
    fetch: async (url) => new Response(fs.readFileSync(`${base}${String(url).split('/').at(-1)}`), { status: 200 })
  };
  context.globalThis = context;
  vm.runInNewContext(providerSource, context);
  const request = {
    name: 'Port Arthur', latitude: 29.8849, longitude: -93.9399, countyContextId: 'jefferson-tx',
    originType: 'CANONICAL_PLACE', communityIdentity: { stableGovernedIdentity: 'place-4858820', placeGeoid: '4858820' },
    radiusMiles: 25, limit: 50, nameTokens: ['mcdonalds']
  };
  const response = await context.GridlyPoiBrowserProvider.search(request);
  const ids = response.results.map(row => row.id);
  assert.ok(ids.includes('8cfc166f-ba1b-40ec-8fd8-2e18a1766c38'));
  assert.ok(ids.includes('b9fe0251-b3b5-4ec0-b239-b8da323c3eae'));
  assert.ok(ids.indexOf('b9fe0251-b3b5-4ec0-b239-b8da323c3eae') < ids.indexOf('8cfc166f-ba1b-40ec-8fd8-2e18a1766c38'), 'distance ordering is retained');
});

test('interactive bridge passes canonical query tokens into runtime acquisition', () => {
  const bridge = app.slice(app.indexOf('async function searchGridlyRuntimePoiCandidates'), app.indexOf('function buildGridlySearchQueryVariants'));
  assert.match(bridge, /request\.nameTokens/);
  assert.match(bridge, /canonicalSemanticQuery/);
  assert.doesNotMatch(bridge, /canonicalize\?\.\(rawQuery\)/);
});

test('real-request trace is read-only and retains publication lineage', () => {
  const trace = app.slice(app.indexOf('let gridlyLastInteractiveDestinationSearchTrace'), app.indexOf('window.gridlyDestinationProviderAudit'));
  for (const field of ['requestId', 'rawQuery', 'normalizedQuery', 'runtimeBridgeEligible', 'runtimeBridgeAttempted',
    'runtimeRawCandidateCount', 'runtimeCandidateLineage', 'mergedCandidateCount', 'deduplicatedCandidateCount',
    'rankedCandidates', 'finalPublishedCandidates', 'publicationCompletedAt']) assert.match(trace, new RegExp(field));
  assert.match(app, /window\.gridlyDestinationInteractiveSearchTrace = function/);
  const accessor = app.slice(app.indexOf('window.gridlyDestinationInteractiveSearchTrace = function'), app.indexOf('window.gridlyDestinationProviderAudit'));
  assert.doesNotMatch(accessor, /gridlySearchAddress|runGridlyLiveDestinationSearch|renderGridlySearchResults/);
});
