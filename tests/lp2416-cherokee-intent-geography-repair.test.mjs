import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const qualitySource = fs.readFileSync('js/lp101-search-quality.js', 'utf8');
const context = { window: {} };
context.globalThis = context.window;
vm.runInNewContext(qualitySource, context);
const quality = context.window.GRIDLY_LP101_SEARCH_QUALITY;

const query = 'Cherokee County Courthouse, Cherokee County, Texas';
const courthouse = (state = 'Texas') => ({
  id: '303353600', title: 'Cherokee County Courthouse', label: 'Cherokee County Courthouse',
  lat: 31.7954703, lng: -95.1499301, type: 'government',
  raw: { categories: ['courthouse'], address: { city: 'Rusk', county: 'Cherokee County', state, state_code: state === 'Texas' ? 'TX' : 'OK' } }
});

test('structured state satisfies governed geography without changing identity', () => {
  const candidate = courthouse();
  assert.equal(quality.businessResultRelevant(query, candidate), true);
  assert.deepEqual([candidate.id, candidate.lat, candidate.lng], ['303353600', 31.7954703, -95.1499301]);
});

test('another state and missing business identity still fail', () => {
  assert.equal(quality.businessResultRelevant(query, courthouse('Oklahoma')), false);
  assert.equal(quality.businessResultRelevant(query, { ...courthouse(), title: 'Cherokee County Library', label: 'Cherokee County Library', raw: { categories: ['library'], address: courthouse().raw.address } }), false);
});

test('structured county and locality do not waive unmatched semantic terms', () => {
  assert.equal(quality.businessResultRelevant('Cherokee County Hospital, Rusk, Texas', courthouse()), false);
});

test('shared repair and lineage contain no Cherokee, FIPS, or courthouse special case', () => {
  const resultText = qualitySource.slice(qualitySource.indexOf('function resultText'), qualitySource.indexOf('function evaluate'));
  assert.doesNotMatch(resultText, /cherokee|48073|courthouse/i);
  const app = fs.readFileSync('js/app.js', 'utf8');
  const resolver = app.slice(app.indexOf('function resolveGridlySearchCandidateCountyId'), app.indexOf('function buildGridlySearchCandidateLineage'));
  assert.doesNotMatch(resolver, /cherokee|48073|courthouse|GRIDLY_DEFAULT_COUNTY_ID/i);
  assert.match(resolver, /GRIDLY_COUNTY_REGISTRY/);
  assert.match(resolver, /gridlyResolveCountyIdForCoordinate/);
});

test('normalized county audit uses candidate county authority, not current awareness', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const resolverSource = app.slice(app.indexOf('function resolveGridlySearchCandidateCountyId'), app.indexOf('function buildGridlySearchCandidateLineage'));
  const countyContext = {
    GRIDLY_COUNTY_REGISTRY: {
      'liberty-tx': { name: 'Liberty County' },
      'cherokee-tx': { name: 'Cherokee County' }
    },
    normalizeGridlySearchDisplayLabel: value => String(value || '').toLowerCase().trim(),
    gridlyResolveCountyIdForCoordinate: () => ({ countyId: 'cherokee-tx' })
  };
  vm.runInNewContext(`${resolverSource}; this.resolve = resolveGridlySearchCandidateCountyId;`, countyContext);
  assert.equal(countyContext.resolve({ lat: 31.7954703, lng: -95.1499301 }, { county: 'Cherokee County' }), 'cherokee-tx');
  assert.equal(countyContext.resolve({ lat: 31.7954703, lng: -95.1499301 }, {}), 'cherokee-tx');
});

test('lineage geography word set includes structured state authority', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const lineage = app.slice(app.indexOf('function buildGridlySearchCandidateLineage'), app.indexOf('async function fetchGridlyNominatimSearch'));
  assert.match(lineage, /address\.state/);
  assert.match(lineage, /address\.state_code/);
  assert.match(lineage, /missingIntentTerms/);
});
