import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const businessAuthority = fs.readFileSync('js/lp099-business-search.js', 'utf8');

function functionSource(name) {
  const start = app.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf('\nfunction ', start + 9);
  assert.ok(end > start, `${name} has a following function boundary`);
  return app.slice(start, end);
}

function rankingRuntime(anchor) {
  const sandbox = { window: {}, anchor: { ...anchor } };
  vm.createContext(sandbox);
  vm.runInContext(businessAuthority, sandbox);
  vm.runInContext(`
    const GRIDLY_SEARCH_RENDER_LIMIT = 5;
    const GRIDLY_DESTINATION_INTENTS = { GENERIC_LOCAL: 'generic_local', BUSINESS_PLACE: 'business_place', ADDRESS: 'address' };
    const gridlyLp097RuntimeEvidence = { exactAddressConflictReasonCounts: {} };
    const gridlySearchUiState = {};
    const ensureGridlySearchState = () => ({ activeQuery: '' });
    const getGridlyDestinationSearchContainmentContext = () => ({ center: anchor, bounds: null });
    const getGridlySearchMapContext = () => ({ center: anchor });
    const getGridlySearchAnchorContext = () => ({ ...anchor, label: anchor.label, source: 'governed_location_context', countyId: anchor.countyId });
    const classifyGridlyDestinationSearchIntent = () => ({ type: GRIDLY_DESTINATION_INTENTS.BUSINESS_PLACE });
    const buildGridlyLocationContext = (result) => result.subtitle || '';
    const normalizeGridlySearchDisplayLabel = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizeGridlyBrandSearchText = (value) => window.GRIDLY_LP099_BUSINESS_SEARCH.canonicalize(value);
    const getGridlySearchResultHaystack = (result, context) => normalizeGridlySearchDisplayLabel([result.title, result.subtitle, context].join(' '));
    const gridlySearchResultContainsTexas = (text) => /(^|\\s)(texas|tx)(\\s|$)/.test(text);
    const gridlySearchResultContainsLocality = (text, current) => normalizeGridlySearchDisplayLabel(text).includes(normalizeGridlySearchDisplayLabel(current.label));
    const classifyGridlyLp097Result = () => ({ precision: 'place', exactAddress: false, conflictReasons: [] });
    window.GRIDLY_LP101_SEARCH_QUALITY = { evaluate: () => ({ boost: 0 }) };
    const haversineDistance = (lat1, lng1, lat2, lng2) => { const r = 3958.8; const rad = value => Number(value) * Math.PI / 180; const dLat = rad(lat2-lat1); const dLng = rad(lng2-lng1); const a = Math.sin(dLat/2)**2 + Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLng/2)**2; return 2*r*Math.asin(Math.sqrt(a)); };
    ${functionSource('getGridlyLocalDiscoveryUsefulnessBoost')}
    ${functionSource('getGridlySearchResultTitleMatchScore')}
    ${functionSource('prioritizeGridlySearchResults')}
    this.rank = (results, query, intent = { type: GRIDLY_DESTINATION_INTENTS.BUSINESS_PLACE }) => prioritizeGridlySearchResults(results, { query, intent });
  `, sandbox);
  return sandbox.rank;
}

const candidate = (id, provider, title, lat, lng, subtitle = '') => ({
  id, providerId: id, provider, title, label: title, lat, lng, subtitle,
  raw: { categories: ['restaurant'], localSeed: provider === 'local_poi_seed' }
});

test('shared production comparator ranks nearby equivalent runtime businesses before remote seed and provider candidates', () => {
  const rank = rankingRuntime({ label: 'Port Arthur', countyId: 'jefferson-tx', lat: 29.8849, lng: -93.9399 });
  const results = rank([
    candidate('seed-mcdonalds-dayton-tx', 'local_poi_seed', "McDonald's", 30.0459, -94.8951, 'Near US 90 · Dayton, TX'),
    candidate('300306844', 'nominatim', "McDonald's", 29.7604, -95.3698, 'Harris County, Texas'),
    candidate('b9fe0251-b3b5-4ec0-b239-b8da323c3eae', 'gridly.poi.runtime.v2', "McDonald's", 29.93713018, -93.93441913, 'RESTAURANT · 4.5 mi'),
    candidate('8cfc166f-ba1b-40ec-8fd8-2e18a1766c38', 'gridly.poi.runtime.v2', "McDonald's", 29.94208458, -93.9900037, 'RESTAURANT · 5.9 mi')
  ], 'mcdonalds');
  assert.equal(results[0].providerId, 'b9fe0251-b3b5-4ec0-b239-b8da323c3eae');
  assert.equal(results[1].providerId, '8cfc166f-ba1b-40ec-8fd8-2e18a1766c38');
  assert.equal(results[0].searchRank.comparatorInputs.seedPriorityScore, 0);
  assert.equal(results[0].searchRank.comparatorInputs.queryMatchClass, 'exact_name');
  assert.ok(results.some((result) => result.provider === 'local_poi_seed'), 'seed fallback remains available');
});

test('text relevance remains ahead of proximity and punctuation aliases share exact-name authority', () => {
  const rank = rankingRuntime({ label: 'Port Arthur', countyId: 'jefferson-tx', lat: 29.8849, lng: -93.9399 });
  const relevant = rank([
    candidate('near-unrelated', 'gridly.poi.runtime.v2', 'Whataburger', 29.885, -93.94),
    candidate('far-relevant', 'nominatim', "Lowe's", 30.1, -94.8, 'Texas')
  ], 'lowes');
  assert.equal(relevant[0].providerId, 'far-relevant');
  assert.equal(relevant[0].searchRank.comparatorInputs.exactName, true);
});

test('explicit remote intent does not enter governed-local comparator mode', () => {
  const rank = rankingRuntime({ label: 'Port Arthur', countyId: 'jefferson-tx', lat: 29.8849, lng: -93.9399 });
  const results = rank([
    candidate('local', 'gridly.poi.runtime.v2', "McDonald's", 29.9, -93.94),
    candidate('houston', 'nominatim', "McDonald's Houston", 29.7604, -95.3698, 'Houston, Texas')
  ], "McDonald's Houston", { type: 'explicit_destination' });
  assert.equal(results[0].providerId, 'houston');
  assert.equal(results[0].searchRank.comparatorInputs.localityMode, 'explicit_intent');
});

test('statewide governed anchor changes equivalent business ordering without source-family precedence', () => {
  const conroe = candidate('conroe-business', 'gridly.poi.runtime.v2', 'Walmart', 30.3119, -95.4558);
  const liberty = candidate('liberty-business', 'nominatim', 'Walmart', 30.05799, -94.79548, 'Liberty, Texas');
  assert.equal(rankingRuntime({ label: 'Conroe', countyId: 'montgomery-tx', lat: 30.3119, lng: -95.4558 })([liberty, conroe], 'walmart')[0].providerId, 'conroe-business');
  assert.equal(rankingRuntime({ label: 'Liberty', countyId: 'liberty-tx', lat: 30.05799, lng: -94.79548 })([conroe, liberty], 'walmart')[0].providerId, 'liberty-business');
});

test('renderer consumes prioritized input order without an independent sort', () => {
  const renderer = functionSource('renderGridlySearchResults');
  assert.match(renderer, /const prioritizedResults = prioritizeGridlySearchResults/);
  assert.ok(renderer.indexOf('prioritizeGridlySearchResults') < renderer.indexOf('renderedResults.forEach'));
  assert.match(renderer, /renderedResults\.forEach/);
});
