import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const lp099 = fs.readFileSync('js/lp099-business-search.js', 'utf8');
const lp101 = fs.readFileSync('js/lp101-search-quality.js', 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf('\nfunction ', start + 9);
  assert.ok(end > start, `${name} has a following function boundary`);
  return app.slice(start, end);
}

function intentRuntime() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(lp099, sandbox);
  vm.runInContext(lp101, sandbox);
  vm.runInContext(`
    const LOCAL_PLACE_LOOKUP = { houston: {} };
    const GRIDLY_DESTINATION_INTENTS = { GENERIC_LOCAL: 'generic_local', EXPLICIT_DESTINATION: 'explicit_destination', BUSINESS_PLACE: 'business_place', ADDRESS: 'address' };
    const GRIDLY_SEARCH_ADDRESS_WORDS = new Set(['street', 'st', 'road', 'rd', 'drive', 'dr']);
    const GRIDLY_SEARCH_DESTINATION_LOCATION_WORDS = new Set(['houston', 'texas', 'tx', 'county']);
    const GRIDLY_SEARCH_BRAND_ALIASES = [];
    ${functionSource('normalizeGridlySearchDisplayLabel')}
    ${functionSource('getGridlySearchQueryTokens')}
    ${functionSource('normalizeGridlyBrandSearchText')}
    ${functionSource('gridlySearchQueryHasAddressIndicator')}
    function resolveGridlyAwarenessAreaQuery() { return { status: 'NOT_FOUND', matchType: 'town' }; }
    ${functionSource('resolveGridlyGovernedBareTexasPlaceQuery')}
    ${functionSource('gridlySearchQueryHasDestinationIndicator')}
    ${functionSource('classifyGridlyDestinationSearchIntent')}
    ${functionSource('gridlyQueryAllowsRuntimePoiAcquisition')}
    this.classify = classifyGridlyDestinationSearchIntent;
    this.normalize = normalizeGridlyBrandSearchText;
    this.eligible = (query) => gridlyQueryAllowsRuntimePoiAcquisition(query, classifyGridlyDestinationSearchIntent(query));
  `, sandbox);
  return sandbox;
}

test('canonical business variants share BUSINESS_PLACE runtime-v2 eligibility', () => {
  const runtime = intentRuntime();
  for (const query of ['mcdonalds', "McDonald's", 'McDonalds', 'McDonald’s', "mcdonld's"]) {
    assert.equal(runtime.normalize(query), 'mcdonalds', `${query} uses shared LP101 normalization`);
    assert.equal(runtime.classify(query).type, 'business_place', `${query} keeps business intent`);
    assert.equal(runtime.eligible(query), true, `${query} is runtime-v2 eligible`);
  }
  for (const query of ["Lowe's", 'Lowes']) {
    assert.equal(runtime.classify(query).type, 'business_place');
    assert.equal(runtime.eligible(query), true);
  }
});

test('raw explicit geography and address authority precede semantic classification', () => {
  const runtime = intentRuntime();
  assert.deepEqual(
    JSON.parse(JSON.stringify(runtime.classify("McDonald's Houston"))),
    { type: 'explicit_destination', reason: 'business_with_destination_indicator' }
  );
  assert.equal(runtime.eligible("McDonald's Houston"), false);
  assert.equal(runtime.classify('123 Main Street').type, 'address');
  assert.equal(runtime.eligible('123 Main Street'), false);
});

test('generic text is not promoted and statewide context remains outside classification authority', () => {
  const runtime = intentRuntime();
  assert.equal(runtime.classify('nearby').type, 'generic_local');
  assert.equal(runtime.eligible('nearby'), false);
  assert.equal(runtime.classify("mcdonld's").type, 'business_place', 'classification is identical under every governed Texas anchor');
});

test('interactive trace reports real-search lineage from the repaired classifier and bridge gate', () => {
  const liveSearch = app.slice(app.indexOf('async function runGridlyLiveDestinationSearch'), app.indexOf('window.gridlyDestinationProviderAudit'));
  assert.match(liveSearch, /syntheticAudit:\s*false/);
  assert.match(liveSearch, /intent:\s*intent\.type/);
  assert.match(liveSearch, /runtimeBridgeEligible:\s*gridlyQueryAllowsRuntimePoiAcquisition\(normalizedQuery, intent\)/);
  const classifier = functionSource('classifyGridlyDestinationSearchIntent');
  assert.ok(classifier.indexOf('gridlySearchQueryHasAddressIndicator(rawNormalized)') < classifier.indexOf('normalizeGridlyBrandSearchText(query)'));
  assert.ok(classifier.indexOf('gridlySearchQueryHasDestinationIndicator(rawNormalized)') < classifier.indexOf('classifyIntent?.(canonicalSemanticQuery)'));
});
