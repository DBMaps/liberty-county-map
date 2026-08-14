import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const source = fs.readFileSync('js/app.js', 'utf8');
const resolverSource = source.match(/function resolveGridlyAwarenessAreaQuery\([\s\S]*?\n\}/)?.[0];

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
