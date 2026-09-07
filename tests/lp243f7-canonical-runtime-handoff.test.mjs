import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const app = fs.readFileSync('js/app.js', 'utf8');
const lp099 = fs.readFileSync('js/lp099-business-search.js', 'utf8');
const lp101 = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const providerSource = fs.readFileSync('js/gridlyPoiBrowserProvider.js', 'utf8');
const runtimeBase = 'poi/lp24111-d5-standalone-2026-08-28/runtime-v2/';

function functionSource(name) {
  const functionStart = app.indexOf(`function ${name}`);
  const asyncStart = app.indexOf(`async function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : functionStart;
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf('\nfunction ', start + 9);
  assert.ok(end > start, `${name} has a following function boundary`);
  return app.slice(start, end);
}

function acquisitionRuntime(context) {
  const sandbox = {
    console, URL, TextDecoder, Response, Blob, DecompressionStream, crypto: webcrypto,
    GRIDLY_RUNTIME_CONFIG: { poiBrowserProvider: { enabled: 'ENABLED' } },
    fetch: async (url) => new Response(fs.readFileSync(`${runtimeBase}${String(url).split('/').at(-1)}`), { status: 200 })
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.gridlyGetCurrentGovernedLocationContext = () => context;
  vm.createContext(sandbox);
  vm.runInContext(lp099, sandbox);
  vm.runInContext(lp101, sandbox);
  vm.runInContext(providerSource, sandbox);
  vm.runInContext(`
    const GRIDLY_DESTINATION_INTENTS = { BUSINESS_PLACE: 'business_place' };
    const GRIDLY_SEARCH_BRAND_ALIASES = [];
    ${functionSource('normalizeGridlySearchDisplayLabel')}
    ${functionSource('getGridlySearchQueryTokens')}
    ${functionSource('normalizeGridlyBrandSearchText')}
    function classifyGridlyDestinationSearchIntent() { return { type: 'business_place' }; }
    function gridlySearchQueryHasAddressIndicator() { return false; }
    function gridlySearchQueryHasDestinationIndicator() { return false; }
    ${functionSource('gridlyQueryAllowsRuntimePoiAcquisition')}
    ${functionSource('gridlyRuntimePoiMatchesQuery')}
    function normalizeGridlySearchResult(value) { return value; }
    ${functionSource('gridlyRuntimePoiToDestinationSearchResult')}
    ${functionSource('searchGridlyRuntimePoiCandidates')}
    this.acquire = (rawQuery) => searchGridlyRuntimePoiCandidates(rawQuery, {
      intent: { type: 'business_place' },
      canonicalSemanticQuery: normalizeGridlyBrandSearchText(rawQuery)
    });
    this.normalize = normalizeGridlyBrandSearchText;
  `, sandbox);
  return sandbox;
}

const portArthur = {
  name: 'Port Arthur', latitude: 29.8849, longitude: -93.9399, countyContextId: 'jefferson-tx',
  originType: 'CANONICAL_PLACE', communityIdentity: { stableGovernedIdentity: 'place-4858820', placeGeoid: '4858820' }
};

test('owner 0-vs-15 probe now hands every McDonalds semantic equivalent to real runtime-v2 acquisition', async () => {
  const runtime = acquisitionRuntime(portArthur);
  const variants = ['mcdonalds', "McDonald's", 'McDonalds', 'McDonald’s', "mcdonld's"];
  let expectedIds;
  for (const query of variants) {
    assert.equal(runtime.normalize(query), 'mcdonalds');
    const results = await runtime.acquire(query);
    const ids = Array.from(results, row => row.providerId);
    assert.ok(ids.length > 0, `${query} returns runtime candidates`);
    assert.ok(ids.includes('b9fe0251-b3b5-4ec0-b239-b8da323c3eae'));
    assert.ok(ids.includes('8cfc166f-ba1b-40ec-8fd8-2e18a1766c38'));
    expectedIds ??= ids;
    assert.deepEqual(ids, expectedIds, `${query} preserves the canonical acquisition cohort`);
  }
});

test('second punctuation control uses shared canonical semantics in real runtime-v2 acquisition', async () => {
  const runtime = acquisitionRuntime(portArthur);
  const apostrophe = Array.from(await runtime.acquire("Lowe's"), row => row.providerId);
  const plain = Array.from(await runtime.acquire('Lowes'), row => row.providerId);
  assert.ok(apostrophe.length > 0);
  assert.deepEqual(apostrophe, plain);
});

test('canonical typo handoff is statewide and not Port Arthur-specific', async () => {
  const runtime = acquisitionRuntime({
    name: 'Lubbock', latitude: 33.5779, longitude: -101.8552, countyContextId: 'lubbock-tx',
    originType: 'CANONICAL_PLACE', communityIdentity: { stableGovernedIdentity: 'place-4845000', placeGeoid: '4845000' }
  });
  const canonical = Array.from(await runtime.acquire('mcdonalds'), row => row.providerId);
  const typo = Array.from(await runtime.acquire("mcdonld's"), row => row.providerId);
  assert.ok(canonical.length > 0);
  assert.deepEqual(typo, canonical);
});

test('caller preserves raw-query eligibility while handing canonical semantics only to business acquisition', () => {
  const search = functionSource('gridlySearchAddress');
  assert.match(search, /classifyGridlyDestinationSearchIntent\(rawQuery\)/);
  assert.match(search, /normalizeGridlyBrandSearchText\(rawQuery\)/);
  assert.match(search, /searchGridlyRuntimePoiCandidates\(rawQuery, \{ intent, canonicalSemanticQuery/);
  assert.match(search, /buildGridlyLp097AddressModel\(rawQuery\)/);
});
