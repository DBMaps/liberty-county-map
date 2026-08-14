import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const source = fs.readFileSync('js/app.js', 'utf8');
const resolverSource = source.match(/function resolveGridlyAwarenessAreaQuery\([\s\S]*?\n\}/)?.[0];
const manualSearchSource = source.match(/function resolveGridlyManualAwarenessAreaSearch\([\s\S]*?\n\}/)?.[0];
const canonicalSaveSource = source.match(/function gridlySaveCanonicalMultiCountyPlaceHome\([\s\S]*?\n\}/)?.[0];

function fixture(overrides = {}) {
  const definitions = [
    { key: 'collin-tx-dallas', label: 'Dallas', storageValue: 'Dallas', countyId: 'collin-tx', placeGeoid: '4819000' },
    { key: 'dallas-tx-dallas', label: 'Dallas', storageValue: 'Dallas', countyId: 'dallas-tx', placeGeoid: '4819000', lat: 32.7933334, lng: -96.7665128, startupZoom: 13 },
    { key: 'denton-tx-dallas', label: 'Dallas', storageValue: 'Dallas', countyId: 'denton-tx', placeGeoid: '4819000' }
  ];
  const memberships = ['48085', '48113', '48121'];
  const registry = Object.fromEntries(definitions.map((area, index) => [area.countyId, { name: `${area.countyId} County`, countyFips: memberships[index], consumerAwarenessAreas: [{ placeGeoid: '4819000', displayName: 'Dallas', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: memberships }] }]));
  const context = { GRIDLY_LP051_ZIP_AWARENESS_INDEX: { records: [] }, GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA: {}, GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID: {}, GRIDLY_AWARENESS_AREA_DEFINITIONS: definitions, GRIDLY_AWARENESS_AREA_BY_KEY: Object.fromEntries(definitions.map(area => [area.key, area])), GRIDLY_COUNTY_REGISTRY: registry, gridlyNormalizeCountyId: value => value, gridlyGetSelectableOperationalCountyIds: () => Object.keys(registry), normalizeGridlyAwarenessAreaLookupText: value => String(value || '').toLowerCase().trim(), resolveGridlyAwarenessArea: () => null, ...overrides };
  vm.runInNewContext(`${resolverSource};this.resolve=resolveGridlyAwarenessAreaQuery`, context);
  return context;
}

function manualFixture() {
  const context = fixture();
  context.getGridlyManualAwarenessAreaOptions = () => Object.freeze(Object.entries(context.GRIDLY_COUNTY_REGISTRY).map(([countyId, county]) => Object.freeze({
    countyValue: countyId,
    countyLabel: county.name,
    communities: Object.freeze((county.consumerAwarenessAreas || []).map(community => Object.freeze({ key: `${countyId}-${community.displayName.toLowerCase().replace(/ /g, '-')}`, value: `${countyId}-${community.displayName.toLowerCase().replace(/ /g, '-')}`, label: community.displayName })))
  })));
  context.filterGridlyManualAwarenessAreas = query => {
    const normalized = context.normalizeGridlyAwarenessAreaLookupText(query);
    return context.getGridlyManualAwarenessAreaOptions().map(group => ({ ...group, communities: group.communities.filter(community => context.normalizeGridlyAwarenessAreaLookupText(community.label).includes(normalized) || context.normalizeGridlyAwarenessAreaLookupText(group.countyLabel).includes(normalized)) })).filter(group => group.communities.length);
  };
  vm.runInNewContext(`${manualSearchSource};this.manualSearch=resolveGridlyManualAwarenessAreaSearch`, context);
  return context;
}

test('same governed label, PLACE GEOID, identity, and memberships collapse without a county default', () => {
  const result = fixture().resolve('Dallas');
  assert.equal(result.status, 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE');
  assert.equal(result.community, 'Dallas');
  assert.equal(result.placeGeoid, '4819000');
  assert.equal(result.canonicalIdentity, 'PLACE_GEOID');
  assert.equal(result.countyId, null);
  assert.equal(result.county, null);
  assert.deepEqual([...result.countyMemberships], ['48085', '48113', '48121']);
  assert.equal(result.awarenessArea.lat, 32.7933334);
  assert.equal(result.awarenessArea.startupZoom, 13);
  assert.ok(result.candidates.every(candidate => candidate.placeGeoid === result.placeGeoid));
});

test('different PLACE GEOIDs, identities, labels, and unresolved membership each remain ambiguous', () => {
  for (const mutate of [
    c => { c.GRIDLY_COUNTY_REGISTRY['denton-tx'].consumerAwarenessAreas[0].placeGeoid = '4899999'; c.GRIDLY_AWARENESS_AREA_DEFINITIONS[2].placeGeoid = '4899999'; },
    c => { c.GRIDLY_COUNTY_REGISTRY['denton-tx'].consumerAwarenessAreas[0].canonicalIdentity = 'REGION'; },
    c => { c.GRIDLY_COUNTY_REGISTRY['denton-tx'].consumerAwarenessAreas[0].displayName = 'Different Dallas'; },
    c => { c.GRIDLY_COUNTY_REGISTRY['denton-tx'].consumerAwarenessAreas[0].countyMemberships = ['48085', '48113']; }
  ]) {
    const context = fixture(); mutate(context);
    const query = context.GRIDLY_AWARENESS_AREA_DEFINITIONS[0].label;
    const result = context.resolve(query);
    if (result.candidates.length > 1) assert.equal(result.status, 'AMBIGUOUS');
    else assert.notEqual(result.status, 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE');
  }
});

test('ZIP ambiguity is unchanged and never uses the town-only collapse rule', () => {
  const context = fixture({ GRIDLY_LP051_ZIP_AWARENESS_INDEX: { records: [
    { zip: '75001', countyId: 'collin-tx', awarenessAreaKey: 'collin-tx-dallas', communityId: '4819000' },
    { zip: '75001', countyId: 'dallas-tx', awarenessAreaKey: 'dallas-tx-dallas', communityId: '4819000' }
  ] } });
  assert.equal(context.resolve('75001').status, 'AMBIGUOUS');
});

test('an existing governed consumer-region parent remains outside PLACE collapse', () => {
  const context = fixture();
  context.GRIDLY_AWARENESS_AREA_DEFINITIONS.push({ key: 'region', label: 'Central', parentCommunity: 'Dallas', houstonRegion: true });
  assert.equal(context.resolve('Dallas').status, 'AMBIGUOUS');
});

test('statewide same-GEOID multi-county inventory is deterministic and covers required controls', () => {
  const range = countyRegistryRange(source); const context = {}; vm.createContext(context);
  vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
  const grouped = new Map();
  for (const [countyId, county] of Object.entries(context.registry)) for (const community of county.consumerAwarenessAreas || []) {
    const rows = grouped.get(community.placeGeoid) || []; rows.push({ countyId, label: community.displayName, memberships: [...community.countyMemberships].map(String).sort() }); grouped.set(community.placeGeoid, rows);
  }
  const inventory = [...grouped].filter(([, rows]) => rows.length > 1).sort(([a], [b]) => a.localeCompare(b));
  assert.equal(inventory.length, 163);
  assert.deepEqual(inventory.map(([geoid]) => geoid), [...inventory.map(([geoid]) => geoid)].sort());
  for (const [geoid, rows] of inventory) {
    assert.ok(rows.every(row => row.memberships.join('|') === rows[0].memberships.join('|')), geoid);
    assert.ok(rows.every(row => row.label === rows[0].label), geoid);
  }
  assert.equal(inventory.find(([geoid]) => geoid === '4819000')[1].length, 5);
  assert.equal(inventory.find(([geoid]) => geoid === '4827000')[1].length, 5);
  assert.equal(inventory.find(([geoid]) => geoid === '4805000')[1].length, 4);
  assert.equal(inventory.some(([geoid]) => geoid === '4824000'), false); // El Paso
});

test('cameras and protected precedence remain literal and unchanged', () => {
  const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8')).places;
  for (const [geoid, lat, lng] of [['4819000', 32.7933334, -96.7665128], ['4827000', 32.7819538, -97.3485732], ['4805000', 30.2986219, -97.7541339], ['4824000', 31.8477804, -106.4311055]]) {
    assert.deepEqual([presentation[geoid].lat, presentation[geoid].lon, 13], [lat, lng, 13]);
  }
  assert.equal(JSON.parse(fs.readFileSync('data/runtime/san-antonio-consumer-regions.json', 'utf8')).precedence, 'INDEPENDENT_GOVERNED_PLACE_WINS');
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome/);
  assert.match(source, /identityType: "PLACE_GEOID"/);
});

test('manual home-area pipeline presents one canonical exact PLACE result', () => {
  for (const [name, geoid] of [['Dallas', '4819000'], ['Fort Worth', '4827000'], ['Austin', '4805000']]) {
    const context = manualFixture();
    const memberships = name === 'Dallas' ? ['48085', '48113', '48121'] : name === 'Fort Worth' ? ['48121', '48367', '48439'] : ['48021', '48055', '48209', '48453'];
    const counties = memberships.map((fips, index) => [`county-${index}`, { name: index === 0 && name === 'Austin' ? 'Austin County' : `County ${index}`, countyFips: fips, consumerAwarenessAreas: [{ placeGeoid: geoid, displayName: name, canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: memberships }] }]);
    context.GRIDLY_COUNTY_REGISTRY = Object.fromEntries(counties);
    context.GRIDLY_AWARENESS_AREA_DEFINITIONS = counties.map(([countyId], index) => ({ key: `${countyId}-${name}`, label: name, storageValue: name, countyId, placeGeoid: geoid, ...(index === 0 ? { lat: 1, lng: 2, startupZoom: 13 } : {}) }));
    context.GRIDLY_AWARENESS_AREA_BY_KEY = Object.fromEntries(context.GRIDLY_AWARENESS_AREA_DEFINITIONS.map(area => [area.key, area]));
    context.gridlyGetSelectableOperationalCountyIds = () => counties.map(([id]) => id);
    const result = context.manualSearch(name);
    assert.equal(result.exactMatch, true);
    assert.equal(result.groups.length, 1);
    assert.equal(result.groups[0].communities.length, 1);
    assert.equal(result.groups[0].communities[0].canonicalResolution.placeGeoid, geoid);
    assert.equal(result.groups[0].countyLabel, 'Multi-county community');
  }
});

test('Austin exact precedence does not expose Austin County or Bellville, while explicit searches remain available', () => {
  const context = manualFixture();
  const austin = context.manualSearch('Dallas');
  assert.equal(austin.groups.length, 1);
  context.GRIDLY_AWARENESS_AREA_DEFINITIONS.push({ key: 'collin-tx-bellville', label: 'Bellville', storageValue: 'Bellville', countyId: 'collin-tx' });
  context.GRIDLY_AWARENESS_AREA_BY_KEY['collin-tx-bellville'] = context.GRIDLY_AWARENESS_AREA_DEFINITIONS.at(-1);
  context.GRIDLY_COUNTY_REGISTRY['collin-tx'].consumerAwarenessAreas.push({ placeGeoid: '4807488', displayName: 'Bellville', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: ['48085'] });
  assert.equal(context.manualSearch('Bellville').groups[0].communities[0].label, 'Bellville');
  context.GRIDLY_COUNTY_REGISTRY['collin-tx'].name = 'Austin County';
  assert.ok(context.manualSearch('Austin County').groups[0].communities.length > 0);
});

test('canonical manual apply routes persistence without an invented county', () => {
  assert.match(source, /canonicalResolution\?\.status === "RESOLVED_CANONICAL_MULTI_COUNTY_PLACE"/);
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome\(canonicalResolution/);
  assert.match(source, /countyId: null, countyName: null, countyMemberships:/);
  assert.match(source, /identityType: "PLACE_GEOID"/);
});

test('confirmed canonical PLACE apply persists, refreshes visible context, and dispatches its semantic camera', () => {
  for (const [community, placeGeoid, countyMemberships] of [
    ['Dallas', '4819000', ['48085', '48113', '48121', '48231', '48257']],
    ['Fort Worth', '4827000', ['48121', '48251', '48367', '48439', '48497']],
    ['Austin', '4805000', ['48021', '48055', '48209', '48453']]
  ]) {
    const writes = new Map(); const calls = [];
    const area = { label: community, placeGeoid, canonicalMultiCountyPlace: true, countyId: null };
    const context = {
      GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY: 'home', GRIDLY_LP0517_HOME_PERSONALIZATION_SCHEMA_VERSION: '1', activeGeoFilter: 'county',
      localStorage: { setItem: (key, value) => writes.set(key, value) }, gridlySafeLocalStorageSet: (key, value) => writes.set(key, value),
      gridlyLp0517ValidateHomeRecord: record => ({ valid: record.countyId === null && record.communityKey === placeGeoid && record.countyMemberships.join('|') === countyMemberships.join('|'), area }),
      invalidateGridlySelectedAwarenessAreaResolutionCache: reason => calls.push(['invalidate', reason]),
      gridlyDispatchSemanticCamera: (selectedArea, countyId, options) => { calls.push(['camera', selectedArea, countyId, options]); return true; },
      syncGridlyAwarenessAreaSurfacesImmediately: (reason, options) => calls.push(['sync', reason, options]), renderGridlySettingsPanel: () => calls.push(['settings'])
    };
    vm.runInNewContext(`${canonicalSaveSource};this.save=gridlySaveCanonicalMultiCountyPlaceHome`, context);
    assert.equal(context.save({ status: 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', canonicalIdentity: 'PLACE_GEOID', community, placeGeoid, countyMemberships }, 'confirmed_test'), true);
    const record = JSON.parse(writes.get('home'));
    assert.equal(record.consumerLabel, community);
    assert.equal(record.countyId, null);
    assert.deepEqual(record.countyMemberships, countyMemberships);
    assert.deepEqual(calls.find(call => call[0] === 'camera').slice(1, 3), [area, null]);
    assert.equal(calls.find(call => call[0] === 'sync')[2].summaryOptions.awarenessArea.label, community);
    assert.ok(calls.some(call => call[0] === 'settings'));
  }
});

test('confirmation and reload contracts accept canonical PLACE countyId null without stale county fallback', () => {
  assert.match(source, /consumerLabel: canonicalResolution\.community/);
  assert.match(source, /persistedHome\?\.identityType === "PLACE_GEOID" && !persistedHome\.countyId/);
  assert.match(source, /context\.area\.canonicalMultiCountyPlace !== true/);
  assert.match(source, /gridlyStartupSemanticContext\?\.countyId \|\| startupAnchor\.countyId/);
  assert.match(source, /meta: area\.canonicalMultiCountyPlace === true\s*\? "Multi-county community"/);
});
