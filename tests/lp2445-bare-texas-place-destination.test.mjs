import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));

function functionSource(name) {
  const start = app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf('\nfunction ', start + 9);
  assert.ok(end > start, `${name} has a following function boundary`);
  return app.slice(start, end);
}

function runtime() {
  const governed = new Map(projection.communities
    .filter(row => row.consumerEligible)
    .map(row => [row.displayName.toLowerCase(), row]));
  const sandbox = { window: {} };
  sandbox.resolveGridlyAwarenessAreaQuery = query => {
    const row = governed.get(String(query).toLowerCase());
    if (!row) return { status: 'NOT_FOUND', matchType: 'town' };
    return {
      status: row.countyMemberships.length > 1 ? 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE' : 'RESOLVED_OPERATIONAL',
      matchType: 'town', community: row.displayName, placeGeoid: row.placeGeoid,
      countyMemberships: row.countyMemberships
    };
  };
  vm.createContext(sandbox);
  vm.runInContext(`
    const LOCAL_PLACE_LOOKUP = {};
    const GRIDLY_DESTINATION_INTENTS = { GENERIC_LOCAL: 'generic_local', EXPLICIT_DESTINATION: 'explicit_destination', BUSINESS_PLACE: 'business_place', ADDRESS: 'address' };
    const GRIDLY_SEARCH_ADDRESS_WORDS = new Set(['street', 'st', 'road', 'rd']);
    const GRIDLY_SEARCH_DESTINATION_LOCATION_WORDS = new Set(['texas', 'tx', 'county']);
    const GRIDLY_SEARCH_BRAND_ALIASES = [];
    ${functionSource('normalizeGridlySearchDisplayLabel')}
    ${functionSource('getGridlySearchQueryTokens')}
    ${functionSource('normalizeGridlyBrandSearchText')}
    ${functionSource('gridlySearchQueryHasAddressIndicator')}
    ${functionSource('resolveGridlyGovernedBareTexasPlaceQuery')}
    ${functionSource('gridlySearchQueryHasDestinationIndicator')}
    ${functionSource('classifyGridlyDestinationSearchIntent')}
    this.recognize = resolveGridlyGovernedBareTexasPlaceQuery;
    this.classify = classifyGridlyDestinationSearchIntent;
  `, sandbox);
  return sandbox;
}

test('Dallas and other exact governed Texas PLACE names become geographic destination intent', () => {
  const search = runtime();
  for (const name of ['Dallas', 'Austin', 'Abilene', 'Dayton', 'Crosby', 'Fredericksburg', 'Port Arthur']) {
    const authority = search.recognize(name);
    assert.ok(authority, `${name} is present in governed statewide authority`);
    assert.equal(search.classify(name).type, 'explicit_destination');
    assert.equal(authority.placeGeoid, projection.communities.find(row => row.displayName === name).placeGeoid);
  }
});

test('Dallas, TX, ZIP, address, arbitrary text, and POI classifications remain protected', () => {
  const search = runtime();
  assert.equal(search.classify('Dallas, TX').type, 'explicit_destination');
  assert.equal(search.classify('75201').type, 'address');
  assert.equal(search.classify('123 Main Street').type, 'address');
  assert.equal(search.classify('wandering aardvark').type, 'generic_local');
  assert.equal(search.recognize('wandering aardvark'), null);
  // The production LP099 authority owns this classification; this stub proves
  // governed place recognition does not intercept a non-place business term.
  search.window.GRIDLY_LP099_BUSINESS_SEARCH = { classifyIntent: query => query === 'walmart' ? { type: 'business_place', reason: 'business_intent' } : null };
  assert.equal(search.classify('Walmart').type, 'business_place');
});

test('bare PLACE resolution precedes acquisition without changing qualified-query behavior', () => {
  const searchBody = app.slice(app.indexOf('async function gridlySearchAddress'), app.indexOf('async function gridlyBuildRoutePreview'));
  assert.ok(searchBody.indexOf('resolveGridlyGovernedBareTexasPlaceQuery(rawQuery)') < searchBody.indexOf('searchGridlyRuntimePoiCandidates'));
  assert.ok(searchBody.indexOf('resolveGridlyGovernedBareTexasPlaceQuery(rawQuery)') < searchBody.indexOf('fetchGridlyNominatimSearch'));
  assert.match(searchBody, /provider: "gridly_canonical_place"/);
  assert.match(searchBody, /countyMemberships/);
  assert.equal(runtime().recognize('Dallas, TX'), null, 'qualified Dallas keeps its established provider path');
  assert.match(html, /js\/app\.js\?v=2445d-bare-place-interactive-repair/, 'the repaired runtime has a deployable asset identity');
});

test('the real interactive coordinator carries governed authority into canonical publication', () => {
  const liveSearch = functionSource('runGridlyLiveDestinationSearch');
  const destinationSearch = app.slice(app.indexOf('async function gridlySearchAddress'), app.indexOf('\nwindow.gridlyAggregateAddressVariantOutcomes'));
  assert.match(liveSearch, /const governedBarePlace = resolveGridlyGovernedBareTexasPlaceQuery\(normalizedQuery\)/);
  assert.match(liveSearch, /gridlySearchAddress\(normalizedQuery, \{[\s\S]*governedBarePlace/);
  assert.match(liveSearch, /governedBarePlaceConsumed: Boolean\(diagnostics\.governedBarePlaceConsumed\)/);
  assert.match(destinationSearch, /hasOwnProperty\.call\(options, "governedBarePlace"\)/);
  assert.match(destinationSearch, /diagnostics\.governedBarePlaceConsumed = true/);
  assert.match(destinationSearch, /finalPublishedCount: canonicalPlaceResults\.length/);
  assert.match(destinationSearch, /provider: "gridly_canonical_place"/);
});
