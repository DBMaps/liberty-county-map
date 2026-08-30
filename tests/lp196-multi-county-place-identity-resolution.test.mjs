import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const source = fs.readFileSync('js/app.js', 'utf8');
const resolverSource = source.match(/function resolveGridlyAwarenessAreaQuery\([\s\S]*?\n\}/)?.[0];
const manualSearchSource = source.match(/function resolveGridlyManualAwarenessAreaSearch\([\s\S]*?\n\}/)?.[0];
const canonicalSaveSource = source.match(/function gridlySaveCanonicalMultiCountyPlaceHome\([\s\S]*?\n\}/)?.[0];
const visiblePickerSearchSource = source.match(/function searchGridlySettingsAwarenessArea\([\s\S]*?\n\}/)?.[0];
const visiblePickerRendererSource = source.match(/function renderGridlySettingsAwarenessSearchResult\([\s\S]*?\n\}/)?.[0];
const groupedOptionsSource = source.match(/function gridlyGetCountyGroupedAwarenessOptions\([\s\S]*?\n\}/)?.[0];

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
  context.gridlyResolveCanonicalCountyIdForOperationalContext = area => area?.countyIds?.[0] || null;
  context.getGridlyManualAwarenessAreaOptions = () => Object.freeze(Object.entries(context.GRIDLY_COUNTY_REGISTRY).map(([countyId, county]) => Object.freeze({
    countyValue: countyId,
    countyId,
    countyLabel: county.name,
    countyFips: county.countyFips,
    communities: Object.freeze((county.consumerAwarenessAreas || []).map(community => Object.freeze({ key: `${countyId}-${community.displayName.toLowerCase().replace(/ /g, '-')}`, value: `${countyId}-${community.displayName.toLowerCase().replace(/ /g, '-')}`, label: community.displayName, canonicalLabel: community.displayName, countyId, countyOccurrenceKey: `${countyId}-${community.placeGeoid}`, ...community, countyMemberships: Object.freeze([...community.countyMemberships].map(String).sort()) })))
  })));
  const partialSearchSource = source.match(/function filterGridlyManualAwarenessAreas\([\s\S]*?\n\}/)?.[0];
  vm.runInNewContext(`${partialSearchSource};${manualSearchSource};this.manualSearch=resolveGridlyManualAwarenessAreaSearch`, context);
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
    const rows = grouped.get(community.placeGeoid) || []; rows.push({ countyId, countyFips: String(county.countyFips), label: community.displayName, governedType: community.governedType, canonicalIdentity: community.canonicalIdentity, consumerEligible: community.consumerEligible, memberships: [...community.countyMemberships].map(String).sort() }); grouped.set(community.placeGeoid, rows);
  }
  const inventory = [...grouped].filter(([, rows]) => rows.length > 1).sort(([a], [b]) => a.localeCompare(b));
  assert.equal(inventory.length, 163);
  assert.equal(inventory.reduce((count, [, rows]) => count + rows.length, 0), 362);
  assert.equal(inventory.reduce((count, [, rows]) => count + rows.length - 1, 0), 199);
  assert.deepEqual(inventory.map(([geoid]) => geoid), [...inventory.map(([geoid]) => geoid)].sort());
  for (const [geoid, rows] of inventory) {
    assert.equal(rows.length, rows[0].memberships.length, geoid);
    assert.ok(rows.every(row => row.memberships.join('|') === rows[0].memberships.join('|')), geoid);
    assert.ok(rows.every(row => row.label === rows[0].label), geoid);
    assert.ok(rows.every(row => row.canonicalIdentity === 'PLACE_GEOID' && row.consumerEligible === true), geoid);
    assert.ok(rows.every(row => row.governedType === rows[0].governedType), geoid);
  }
  assert.equal(inventory.find(([geoid]) => geoid === '4819000')[1].length, 5);
  assert.equal(inventory.find(([geoid]) => geoid === '4827000')[1].length, 5);
  assert.equal(inventory.find(([geoid]) => geoid === '4805000')[1].length, 4);
  assert.equal(inventory.find(([geoid]) => geoid === '4817000')[1].length, 4);
  assert.equal(inventory.find(([geoid]) => geoid === '4835000')[1].length, 4);
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

test('manual home-area pipeline presents one canonical row while retaining every governed PLACE membership', () => {
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
    assert.deepEqual([...result.groups[0].communities[0].canonicalResolution.countyMemberships], memberships);
  }
});

test('partial PLACE search preserves canonical identity and governed memberships behind one result', () => {
  for (const [query, name, geoid, memberships] of [
    ['corp', 'Corpus Christi', '4817000', ['48007', '48273', '48355', '48409']],
    ['aus', 'Austin', '4805000', ['48021', '48055', '48209', '48453']],
    ['fort', 'Fort Worth', '4827000', ['48121', '48251', '48367', '48439', '48497']],
    ['hou', 'Houston', '4835000', ['48157', '48201', '48339', '48473']]
  ]) {
    const context = manualFixture();
    const counties = memberships.map((fips, index) => [`county-${index}`, { name: `County ${index}`, countyFips: fips, consumerAwarenessAreas: [{ placeGeoid: geoid, displayName: name, governedType: 'INCORPORATED_PLACE', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: memberships }] }]);
    context.GRIDLY_COUNTY_REGISTRY = Object.fromEntries(counties);
    context.GRIDLY_AWARENESS_AREA_DEFINITIONS = counties.map(([countyId]) => ({ key: `${countyId}-${geoid}`, label: name, storageValue: name, countyId, placeGeoid: geoid }));
    context.GRIDLY_AWARENESS_AREA_BY_KEY = Object.fromEntries(context.GRIDLY_AWARENESS_AREA_DEFINITIONS.map(area => [area.key, area]));
    context.gridlyGetSelectableOperationalCountyIds = () => counties.map(([id]) => id);
    const partial = context.manualSearch(query);
    const exact = context.manualSearch(name);
    assert.equal(partial.groups.length, 1);
    assert.ok(partial.groups.every(group => group.communities.length === 1));
    assert.ok(partial.groups.every(group => group.communities[0].canonicalResolution.placeGeoid === geoid));
    assert.equal(new Set(partial.groups.map(group => group.communities[0].value)).size, 1);
    assert.equal(partial.groups[0].communities[0].value, `place-${geoid}`);
    assert.deepEqual([...partial.groups[0].communities[0].countyMemberships], memberships);
    assert.equal(exact.groups.length, 1);
    assert.ok(exact.groups.every(group => group.communities[0].canonicalResolution.placeGeoid === geoid));
  }
});

test('partial search never name-deduplicates distinct PLACE GEOIDs', () => {
  const context = manualFixture();
  context.GRIDLY_COUNTY_REGISTRY = {
    one: { name: 'One County', countyFips: '48001', consumerAwarenessAreas: [{ placeGeoid: '4800001', displayName: 'Twin Place', governedType: 'INCORPORATED_PLACE', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: ['48001'] }] },
    two: { name: 'Two County', countyFips: '48003', consumerAwarenessAreas: [{ placeGeoid: '4800002', displayName: 'Twin Place', governedType: 'INCORPORATED_PLACE', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: ['48003'] }] }
  };
  context.GRIDLY_AWARENESS_AREA_DEFINITIONS = [
    { key: 'one-twin', label: 'Twin Place', storageValue: 'Twin Place', countyId: 'one', placeGeoid: '4800001' },
    { key: 'two-twin', label: 'Twin Place', storageValue: 'Twin Place', countyId: 'two', placeGeoid: '4800002' }
  ];
  context.gridlyGetSelectableOperationalCountyIds = () => ['one', 'two'];
  const rows = context.manualSearch('twin').groups.flatMap(group => group.communities);
  assert.equal(rows.map(row => row.placeGeoid).sort().join('|'), '4800001|4800002');
});

test('Port Arthur search projects PLACE 4858820 once and preserves Jefferson and Orange memberships', () => {
  const context = manualFixture();
  const memberships = ['48245', '48361'];
  context.GRIDLY_COUNTY_REGISTRY = {
    'jefferson-tx': { name: 'Jefferson County', countyFips: '48245', consumerAwarenessAreas: [{ placeGeoid: '4858820', displayName: 'Port Arthur', governedType: 'INCORPORATED_PLACE', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: memberships }] },
    'orange-tx': { name: 'Orange County', countyFips: '48361', consumerAwarenessAreas: [{ placeGeoid: '4858820', displayName: 'Port Arthur', governedType: 'INCORPORATED_PLACE', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: memberships }] }
  };
  context.GRIDLY_AWARENESS_AREA_DEFINITIONS = [
    { key: 'port-arthur', label: 'Port Arthur', storageValue: 'Port Arthur', countyId: 'jefferson-tx', placeGeoid: '4858820', lat: 29.8716577, lng: -93.9332302 },
    { key: 'orange-tx-port-arthur', label: 'Port Arthur', storageValue: 'Port Arthur', countyId: 'orange-tx', placeGeoid: '4858820' }
  ];
  context.GRIDLY_AWARENESS_AREA_BY_KEY = Object.fromEntries(context.GRIDLY_AWARENESS_AREA_DEFINITIONS.map(area => [area.key, area]));
  context.gridlyGetSelectableOperationalCountyIds = () => ['jefferson-tx', 'orange-tx'];
  context.gridlyResolveCanonicalCountyIdForOperationalContext = () => 'jefferson-tx';

  const search = context.manualSearch('port arthur');
  const rows = search.groups.flatMap(group => group.communities);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].canonicalResolution.placeGeoid, '4858820');
  assert.equal(rows[0].canonicalResolution.canonicalIdentity, 'PLACE_GEOID');
  assert.deepEqual([...rows[0].canonicalResolution.countyMemberships], memberships);
  assert.deepEqual(rows[0].canonicalResolution.candidates.map(candidate => candidate.countyId).sort(), ['jefferson-tx', 'orange-tx']);
});

test('real Home Area picker source gives Port Arthur the same PLACE-owned renderer model as Austin', () => {
  const range = countyRegistryRange(source); const registryContext = {}; vm.createContext(registryContext);
  vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, registryContext);
  const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
  const portArthurSeed = vm.runInNewContext(`(${source.match(/\{ key: "port-arthur", label: "Port Arthur"[^\n]+\}/)?.[0]})`);
  assert.equal(portArthurSeed.placeGeoid, '4858820');
  assert.equal(portArthurSeed.canonicalCommunityIdentity, 'PLACE_GEOID');

  const controls = [
    ['Austin', '4805000', [['bastrop-tx', '48021'], ['hays-tx', '48209'], ['travis-tx', '48453'], ['williamson-tx', '48491']]],
    ['Port Arthur', '4858820', [['jefferson-tx', '48245'], ['orange-tx', '48361']]]
  ];
  for (const [label, placeGeoid, counties] of controls) {
    const countyIds = counties.map(([countyId]) => countyId);
    const registry = Object.fromEntries(counties.map(([countyId, countyFips]) => {
      const projectedCounty = projection.counties.find(county => county.countyFips === countyFips);
      return [countyId, { name: `${projectedCounty.displayName} County`, countyFips, consumerAwarenessAreas: projectedCounty.communities.map(row => ({ ...row, canonicalIdentity: 'PLACE_GEOID' })) }];
    }));
    const definitions = countyIds.map((countyId) => {
      if (countyId === 'jefferson-tx') return portArthurSeed;
      const governed = registry[countyId].consumerAwarenessAreas.find(row => row.placeGeoid === placeGeoid);
      return { key: `${countyId}-${label.toLowerCase().replace(/ /g, '-')}`, label, storageValue: label, countyId, placeGeoid: governed.placeGeoid, canonicalCommunityIdentity: governed.canonicalIdentity };
    });
    const context = {
      GRIDLY_COUNTY_REGISTRY: registry,
      GRIDLY_AWARENESS_AREA_DEFINITIONS: definitions,
      GRIDLY_AWARENESS_AREA_BY_KEY: Object.fromEntries(definitions.map(area => [area.key, area])),
      GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID: {},
      GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
      gridlyGetSelectableOperationalCountyIds: () => countyIds,
      gridlyNormalizeCountyId: value => value,
      normalizeGridlyAwarenessAreaLookupText: value => String(value || '').toLowerCase().trim(),
      gridlyBuildCountywideAwarenessFallbackOption: (countyId, config) => ({ label: config.name, value: config.name, key: `${countyId}-county`, countyWide: true, fallback: true }),
      gridlyResolveCanonicalCountyIdForOperationalContext: () => countyIds[0],
      resolveGridlyAwarenessAreaQuery: () => ({ status: 'NOT_FOUND' })
    };
    vm.runInNewContext(`${groupedOptionsSource};this.getGridlyManualAwarenessAreaOptions=()=>gridlyGetCountyGroupedAwarenessOptions().map(group=>Object.freeze({...group,communities:Object.freeze(group.communities.filter(row=>row.fallback!==true))})).filter(group=>group.communities.length);${source.match(/function filterGridlyManualAwarenessAreas\([\s\S]*?\n\}/)?.[0]};this.search=filterGridlyManualAwarenessAreas`, context);
    const rendererInput = context.search(label === 'Port Arthur' ? 'port a' : 'aus').flatMap(group => group.communities);
    assert.equal(rendererInput.length, 1, `${label} renderer input count`);
    assert.equal(rendererInput[0].placeGeoid, placeGeoid);
    assert.equal(rendererInput[0].canonicalResolution.canonicalIdentity, 'PLACE_GEOID');
    assert.deepEqual([...rendererInput[0].canonicalResolution.candidates].map(row => row.countyId).sort(), [...countyIds].sort());
    assert.deepEqual([...rendererInput[0].canonicalResolution.countyMemberships], [...registry[countyIds[0]].consumerAwarenessAreas.find(row => row.placeGeoid === placeGeoid).countyMemberships]);
  }
});

test('single-county and governed non-PLACE stable keys remain distinct', () => {
  const context = manualFixture();
  context.GRIDLY_COUNTY_REGISTRY = {
    one: { name: 'One County', countyFips: '48001', consumerAwarenessAreas: [
      { placeGeoid: '4800001', displayName: 'Solo', governedType: 'INCORPORATED_PLACE', canonicalIdentity: 'PLACE_GEOID', consumerEligible: true, countyMemberships: ['48001'] },
      { placeGeoid: null, displayName: 'Shared Region', governedType: 'GOVERNED_NON_PLACE', canonicalIdentity: 'STABLE_KEY', consumerEligible: true, countyMemberships: [] }
    ] },
    two: { name: 'Two County', countyFips: '48003', consumerAwarenessAreas: [
      { placeGeoid: null, displayName: 'Shared Region', governedType: 'GOVERNED_NON_PLACE', canonicalIdentity: 'STABLE_KEY', consumerEligible: true, countyMemberships: [] }
    ] }
  };
  context.GRIDLY_AWARENESS_AREA_DEFINITIONS = [
    { key: 'one-solo', label: 'Solo', storageValue: 'Solo', countyId: 'one', placeGeoid: '4800001' },
    { key: 'one-shared', label: 'Shared Region', storageValue: 'Shared Region', countyId: 'one' },
    { key: 'two-shared', label: 'Shared Region', storageValue: 'Shared Region', countyId: 'two' }
  ];
  context.gridlyGetSelectableOperationalCountyIds = () => ['one', 'two'];

  assert.deepEqual(context.manualSearch('solo').groups.flatMap(group => group.communities).map(row => row.key), ['one-solo']);
  assert.deepEqual(Array.from(context.manualSearch('shared').groups.flatMap(group => group.communities), row => row.key).sort(), ['one-shared-region', 'two-shared-region']);
});

test('canonical search projection never consults stale active-county context', () => {
  assert.doesNotMatch(manualSearchSource, /gridlyGetActiveCountyId/);
  assert.match(manualSearchSource, /gridlyResolveCanonicalCountyIdForOperationalContext\(exact\.awarenessArea, null\)/);
});

test('visible Home Area search consumes the established canonical manual-picker projection', () => {
  const context = manualFixture();
  let rendered = null;
  context.resolveGridlyManualAwarenessAreaSearch = context.manualSearch;
  context.renderGridlySettingsAwarenessSearchResult = result => { rendered = result; };
  vm.runInNewContext(`${visiblePickerSearchSource};this.visibleSearch=searchGridlySettingsAwarenessArea`, context);
  const result = context.visibleSearch('dal');
  assert.equal(result.status, 'RESULTS');
  assert.equal(result.groups.flatMap(group => group.communities).length, 1);
  assert.equal(result.groups[0].communities[0].canonicalResolution.placeGeoid, '4819000');
  assert.equal(rendered, result);
  assert.match(visiblePickerRendererSource, /result\.status === "RESULTS"/);
  assert.match(visiblePickerRendererSource, /gridlySaveCanonicalMultiCountyPlaceHome\(community\.canonicalResolution/);
  assert.match(visiblePickerRendererSource, /gridlyManualAwarenessMembershipCountyId\(community, group\)/);
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

test('canonical manual apply requires and routes the explicit governed county', () => {
  assert.match(source, /canonicalResolution\?\.status === "RESOLVED_CANONICAL_MULTI_COUNTY_PLACE"/);
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome\(canonicalResolution/);
  assert.match(source, /gridlySaveCanonicalMultiCountyPlaceHome\(canonicalResolution, "settings_manual_awareness_area", requestedOperationalCountyId\)/);
  assert.match(source, /countyId: requestedCountyId, countyName: requestedCounty\.name, countyMemberships:/);
  assert.match(source, /explicit_operational_membership_missing/);
  assert.match(source, /identityType: "PLACE_GEOID"/);
});

test('confirmed canonical PLACE apply fails closed without authority and persists the explicit governed membership', () => {
  for (const [community, placeGeoid, countyMemberships] of [
    ['Dallas', '4819000', ['48085', '48113', '48121', '48231', '48257']],
    ['Fort Worth', '4827000', ['48121', '48251', '48367', '48439', '48497']],
    ['Austin', '4805000', ['48021', '48055', '48209', '48453']]
  ]) {
    const writes = new Map(); const calls = [];
    const requestedCountyId = 'requested-tx';
    const area = { label: community, placeGeoid, canonicalMultiCountyPlace: true, countyId: requestedCountyId, countyMemberships };
    const context = {
      GRIDLY_LP0517_HOME_PERSONALIZATION_STORAGE_KEY: 'home', GRIDLY_LP0517_HOME_PERSONALIZATION_SCHEMA_VERSION: '1', activeGeoFilter: 'county',
      GRIDLY_COUNTY_REGISTRY: { [requestedCountyId]: { countyFips: countyMemberships.at(-1), operational: true } }, GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID: {},
      gridlyNormalizeCountyId: value => value,
      localStorage: { setItem: (key, value) => writes.set(key, value) }, gridlySafeLocalStorageSet: (key, value) => writes.set(key, value),
      gridlyLp0517ValidateHomeRecord: record => ({ valid: record.countyId === requestedCountyId && record.communityKey === placeGeoid && record.countyMemberships.join('|') === countyMemberships.join('|'), area }),
      gridlyBeginCommunityTransitionTrace: () => {}, gridlyRecordCommunityTransitionStage: () => {},
      invalidateGridlySelectedAwarenessAreaResolutionCache: reason => calls.push(['invalidate', reason]),
      gridlySynchronizeActiveCountyForOperationalContext: (selectedArea, countyId, reason) => { calls.push(['county', selectedArea, countyId, reason]); return countyId; },
      gridlyDispatchSemanticCamera: (selectedArea, countyId, options) => { calls.push(['camera', selectedArea, countyId, options]); return true; },
      syncGridlyAwarenessAreaSurfacesImmediately: (reason, options) => calls.push(['sync', reason, options]), renderGridlySettingsPanel: () => calls.push(['settings'])
    };
    vm.runInNewContext(`${canonicalSaveSource};this.save=gridlySaveCanonicalMultiCountyPlaceHome`, context);
    assert.equal(context.save({ status: 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', canonicalIdentity: 'PLACE_GEOID', community, placeGeoid, countyMemberships }, 'ambiguous_test'), false);
    assert.equal(writes.has('home'), false);
    assert.equal(context.save({ status: 'RESOLVED_CANONICAL_MULTI_COUNTY_PLACE', canonicalIdentity: 'PLACE_GEOID', community, placeGeoid, countyMemberships }, 'confirmed_test', requestedCountyId), true);
    const record = JSON.parse(writes.get('home'));
    assert.equal(record.consumerLabel, community);
    assert.equal(record.countyId, requestedCountyId);
    assert.deepEqual(record.countyMemberships, countyMemberships);
    assert.deepEqual(calls.find(call => call[0] === 'camera').slice(1, 3), [area, requestedCountyId]);
    assert.deepEqual(calls.find(call => call[0] === 'county').slice(1, 3), [area, requestedCountyId]);
    assert.equal(calls.find(call => call[0] === 'sync')[2].summaryOptions.awarenessArea.label, community);
    assert.ok(calls.some(call => call[0] === 'settings'));
  }
});

test('confirmation and reload contracts require persisted canonical PLACE authority without stale county fallback', () => {
  assert.match(source, /consumerLabel: canonicalResolution\.community/);
  assert.match(source, /gridlyResolvePersistedCanonicalPlaceOperationalCounty\(\s*persistedIdentity\.area,\s*persistedHome/);
  assert.match(source, /const homeCountyId = validateMemberCounty\(homeRecord\?\.countyId\);\s*if \(homeCountyId\) return homeCountyId/);
  assert.match(source, /do not inherit the previous active county/);
  assert.match(source, /gridlyProjectCanonicalPlaceOperationalCounty\(persistedIdentity\.area, operationalCountyId\)/);
});
