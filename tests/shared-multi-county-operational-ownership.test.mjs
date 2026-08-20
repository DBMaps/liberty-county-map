import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const source = fs.readFileSync('js/app.js', 'utf8');
const saveSource = source.match(/function gridlySaveCanonicalMultiCountyPlaceHome\([\s\S]*?\n\}/)?.[0];

function inventory() {
  const range = countyRegistryRange(source);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
  const audited = JSON.parse(fs.readFileSync('data/generated/lp213-statewide-multi-county-place-audit.json', 'utf8')).inventory;
  const fipsByCounty = Object.fromEntries(audited.flatMap(place => place.members.map(member => [member.countyId, member.fips])));
  const registry = Object.fromEntries(Object.entries(context.registry).map(([countyId, county]) => [countyId, { ...county, countyFips: fipsByCounty[countyId] }]));
  const places = new Map();
  for (const [countyId, county] of Object.entries(registry)) {
    for (const community of county.consumerAwarenessAreas || []) {
      const rows = places.get(community.placeGeoid) || [];
      rows.push({ countyId, countyFips: String(county.countyFips), community, county });
      places.set(community.placeGeoid, rows);
    }
  }
  return { registry, places: [...places].filter(([, rows]) => rows.length > 1) };
}

function runSave(rows, requestedCountyId, { valid = true, priorCountyId = 'prior-tx' } = {}) {
  const writes = new Map();
  const transitions = [];
  const first = rows[0];
  const memberships = [...first.community.countyMemberships].map(String);
  const area = { key: `place-${first.community.placeGeoid}`, label: first.community.displayName, placeGeoid: first.community.placeGeoid, countyMemberships: memberships, canonicalMultiCountyPlace: true };
  const registry = Object.fromEntries(rows.map(row => [row.countyId, row.county]));
  const context = {
    GRIDLY_COUNTY_REGISTRY: registry,
    GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID: {},
    GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY: 'home',
    GRIDLY_LP0517_HOME_PERSONALIZATION_SCHEMA_VERSION: '1',
    activeGeoFilter: 'county',
    gridlyNormalizeCountyId: value => registry[value]?.operational === true ? value : priorCountyId,
    gridlyLp0517ValidateHomeRecord: () => ({ valid, area }),
    localStorage: { setItem: (key, value) => writes.set(key, value) },
    gridlySafeLocalStorageSet: (key, value) => writes.set(key, value),
    invalidateGridlySelectedAwarenessAreaResolutionCache: () => {},
    gridlySynchronizeActiveCountyForOperationalContext: (_area, countyId) => { transitions.push(countyId); return countyId; },
    gridlyDispatchSemanticCamera: () => true,
    syncGridlyAwarenessAreaSurfacesImmediately: () => {},
    renderGridlySettingsPanel: () => {}
  };
  vm.runInNewContext(`${saveSource};this.save=gridlySaveCanonicalMultiCountyPlaceHome`, context);
  const result = { status: 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', canonicalIdentity: 'PLACE_GEOID', placeGeoid: first.community.placeGeoid, community: first.community.displayName, countyMemberships: memberships };
  return { applied: context.save(result, 'production_test', requestedCountyId), writes, transitions, result };
}

test('Baytown preserves PLACE 4806128 and explicitly establishes Chambers ownership', () => {
  const { places } = inventory();
  const rows = places.find(([geoid]) => geoid === '4806128')[1];
  const outcome = runSave(rows, 'chambers-tx');
  assert.equal(outcome.applied, true);
  assert.deepEqual(outcome.transitions, ['chambers-tx']);
  const home = JSON.parse(outcome.writes.get('home'));
  assert.equal(home.communityKey, '4806128');
  assert.equal(home.awarenessAreaKey, 'place-4806128');
  assert.equal(home.countyId, null);
});

test('a second control selects a non-first membership and never retains the prior county', () => {
  const { places } = inventory();
  const [geoid, rows] = places.find(([candidate, candidateRows]) => candidate !== '4806128' && candidateRows.length > 2);
  const requested = rows.at(-1).countyId;
  const outcome = runSave(rows, requested);
  assert.equal(outcome.applied, true);
  assert.equal(outcome.result.placeGeoid, geoid);
  assert.notEqual(requested, rows[0].countyId);
  assert.deepEqual(outcome.transitions, [requested]);
});

test('missing, unknown, ungoverned, and ambiguous canonical requests fail closed', () => {
  const { places } = inventory();
  const rows = places[0][1];
  for (const requested of [null, 'unknown-tx']) {
    const outcome = runSave(rows, requested);
    assert.equal(outcome.applied, false);
    assert.equal(outcome.writes.size, 0);
    assert.deepEqual(outcome.transitions, []);
  }
  const ungovernedRows = [...rows, { countyId: 'outside-tx', countyFips: '48999', county: { countyFips: '48999', operational: true }, community: rows[0].community }];
  const ungoverned = runSave(ungovernedRows, 'outside-tx');
  assert.equal(ungoverned.applied, false);
  const ambiguous = runSave(rows, rows[1].countyId, { valid: false });
  assert.equal(ambiguous.applied, false);
  assert.equal(ambiguous.writes.size, 0);
});

test('all 163 canonical identities have exact governed membership and shared path has no membership-order selection', () => {
  const { places } = inventory();
  assert.equal(places.length, 163);
  assert.equal(places.reduce((sum, [, rows]) => sum + rows.length, 0), 362);
  for (const [geoid, rows] of places) {
    const memberships = [...rows[0].community.countyMemberships].map(String).sort();
    assert.equal(new Set(rows.map(row => row.community.placeGeoid)).size, 1, geoid);
    assert.deepEqual(rows.map(row => row.countyFips).sort(), memberships, geoid);
  }
  assert.doesNotMatch(saveSource, /countyMemberships\s*\[\s*0\s*\]|countyIds\s*\[\s*0\s*\]|\.at\(0\)/);
});
