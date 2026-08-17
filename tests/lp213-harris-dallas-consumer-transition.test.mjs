import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const app = await readFile(new URL('js/app.js', root), 'utf8');
const manifest = JSON.parse(await readFile(new URL('data/roadway-runtime-manifest.json', root), 'utf8'));
const libertyRoads = JSON.parse(await readFile(new URL('data/liberty-county-road-segments.geojson', root), 'utf8'));

function productionFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const brace = app.indexOf('{', app.indexOf(')', start));
  let depth = 0;
  for (let index = brace; index < app.length; index += 1) {
    if (app[index] === '{') depth += 1;
    if (app[index] === '}' && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`unterminated ${name}`);
}

test('LP213 Harris -> Dallas commits county, storage, awareness and roadway ownership', () => {
  const settingsWrites = [];
  const profileWrites = [];
  const roadwayLoads = [];
  const context = {
    Object,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: {
      'liberty-tx': { id: 'liberty-tx', countyFips: '48291', name: 'Liberty County', operational: true },
      'harris-tx': { id: 'harris-tx', countyFips: '48201', name: 'Harris County', operational: true },
      'dallas-tx': { id: 'dallas-tx', countyFips: '48113', name: 'Dallas County', operational: true }
    },
    gridlyPlacePresentationTargets: null,
    gridlyOperationalCountyResolutionAudit: null,
    gridlyActiveCountySynchronizationAudit: null,
    gridlyActiveCountyTransitionGeneration: 0,
    window: {},
    getGridlySettingsPreferences: () => ({ community: { countyId: 'harris-tx', awarenessArea: 'Harris County' } }),
    saveGridlySettingsPreferences: (value) => settingsWrites.push(value),
    saveGridlyUserProfile: (value) => profileWrites.push(value),
    gridlyResolveCountyIdForCoordinate: (lat, lng) => ({ countyId: lat === 32.7767 && lng === -96.797 ? 'dallas-tx' : 'liberty-tx', authoritativeGeometryAvailable: true }),
    gridlyIsKnownCountyId: (id) => ['liberty-tx', 'harris-tx', 'dallas-tx'].includes(id),
    gridlyNormalizeCountyId: (id) => String(id || '').toLowerCase(),
    gridlyGetGovernedPlaceConsumerPresentationCamera: () => null,
    gridlyGetActiveCountyId: () => context.window.GRIDLY_ACTIVE_COUNTY_ID,
    gridlySetActiveCountyContext: (id) => {
      context.window.GRIDLY_ACTIVE_COUNTY_ID = id;
      context.gridlyActiveCountyTransitionGeneration += 1;
      roadwayLoads.push({ countyId: id, featureCount: id === 'dallas-tx'
        ? manifest.counties[id].partitions.reduce((sum, part) => sum + part.featureCount, 0)
        : libertyRoads.features.filter((feature) => ['LineString', 'MultiLineString'].includes(feature?.geometry?.type)).length });
      return id;
    },
    ensureGridlyActiveCountyCrossingInventory: () => {}
  };
  context.window.GRIDLY_ACTIVE_COUNTY_ID = 'harris-tx';
  vm.createContext(context);
  vm.runInContext([
    productionFunction('gridlyResolveCanonicalPlaceGeoid'),
    productionFunction('gridlyResolveCanonicalCountyIdForOperationalContext'),
    productionFunction('gridlyPersistCanonicalPlaceOperationalCounty'),
    productionFunction('gridlySynchronizeActiveCountyForOperationalContext')
  ].join('\n'), context);

  const dallas = { key: 'place-4819000', label: 'Dallas', storageValue: 'Dallas', placeGeoid: '4819000', canonicalMultiCountyPlace: true, countyMemberships: ['48085', '48113', '48121', '48257', '48397'], lat: 32.7767, lng: -96.797 };
  assert.equal(context.gridlySynchronizeActiveCountyForOperationalContext(dallas, null, 'lp213_consumer'), 'dallas-tx');
  assert.equal(context.window.GRIDLY_ACTIVE_COUNTY_ID, 'dallas-tx');
  assert.equal(settingsWrites.at(-1).community.countyId, 'dallas-tx');
  assert.equal(settingsWrites.at(-1).community.awarenessArea, 'Dallas');
  assert.equal(profileWrites.at(-1).awarenessAreaCountyId, 'dallas-tx');
  assert.deepEqual(roadwayLoads.at(-1), { countyId: 'dallas-tx', featureCount: 40208 });

  assert.equal(context.gridlySynchronizeActiveCountyForOperationalContext({ label: 'Liberty', countyId: 'liberty-tx' }, 'liberty-tx', 'lp213_return'), 'liberty-tx');
  assert.equal(context.window.GRIDLY_ACTIVE_COUNTY_ID, 'liberty-tx');
  assert.deepEqual(roadwayLoads.at(-1), { countyId: 'liberty-tx', featureCount: 8405 });
});

test('LP213 canonical PLACE settings retain the authoritative operational county', () => {
  const context = {
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: { 'dallas-tx': { id: 'dallas-tx', countyFips: '48113' }, 'collin-tx': { id: 'collin-tx', countyFips: '48085' } },
    GRIDLY_SETTINGS_DEFAULTS: {
      notifications: {},
      display: { mapStyle: 'standard', theme: 'system', textSize: 'standard' },
      personalization: { preferredName: '' }
    },
    GRIDLY_SETTINGS_MAP_STYLE_LABELS: { standard: 'Standard' },
    GRIDLY_SETTINGS_VALID_THEMES: new Set(['system']),
    GRIDLY_SETTINGS_TEXT_SIZE_ALIASES: {},
    GRIDLY_SETTINGS_VALID_TEXT_SIZES: new Set(['standard']),
    normalizeGridlyPreferredName: (value) => value || '',
    resolveGridlyAwarenessArea: () => ({ storageValue: 'Dallas', key: 'place-4819000', canonicalMultiCountyPlace: true, countyMemberships: ['48085', '48113', '48121', '48257', '48397'] }),
    gridlyResolveCountyIdForAwarenessArea: () => 'collin-tx',
    gridlyNormalizeCountyId: (value) => String(value || '').toLowerCase(),
    gridlyIsKnownCountyId: (value) => ['dallas-tx', 'collin-tx'].includes(String(value || '').toLowerCase()),
    resolveGridlyAwarenessAreaForCounty: (_value, countyId) => ({ storageValue: 'Dallas', key: 'place-4819000', countyId, canonicalMultiCountyPlace: true, countyMemberships: ['48085', '48113', '48121', '48257', '48397'] })
  };
  vm.createContext(context);
  vm.runInContext(productionFunction('normalizeGridlySettings'), context);
  const settings = context.normalizeGridlySettings({ community: {
    homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'place-4819000', countyId: 'dallas-tx'
  } });
  assert.equal(settings.community.countyId, 'dallas-tx');
  assert.equal(settings.community.awarenessAreaKey, 'place-4819000');
});

test('LP213 canonical awareness county uses active runtime before stale legacy storage', () => {
  const context = {
    localStorage: { getItem: (key) => ({
      gridlySelectedCounty: 'liberty-tx',
      gridlySettingsV1: JSON.stringify({ community: { countyId: 'dallas-tx', homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'place-4819000' } }),
      gridlyUserProfileV1: JSON.stringify({ awarenessAreaCountyId: 'dallas-tx', homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'place-4819000' })
    })[key] || null },
    getGridlySelectedAwarenessArea: () => ({ key: 'place-4819000', label: 'Dallas', canonicalMultiCountyPlace: true, countyId: null }),
    getGridlySettingsPreferences: () => ({ community: { countyId: 'dallas-tx', homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'place-4819000' } }),
    getGridlyUserProfile: () => ({ awarenessAreaCountyId: 'dallas-tx', homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'place-4819000' }),
    gridlyGetActiveCountyId: () => 'dallas-tx'
  };
  vm.createContext(context);
  vm.runInContext(`${productionFunction('gridlyLp0361ReadStorageLocationState')}\n${productionFunction('gridlyLp0361SnapshotAuthoritativeState')}`, context);
  const state = context.gridlyLp0361SnapshotAuthoritativeState();
  assert.equal(state.activeCountyRuntimeId, 'dallas-tx');
  assert.equal(state.selectedCountyId, 'dallas-tx');
  assert.equal(state.roadwayRuntimeCounty, 'dallas-tx');
  assert.equal(state.storageLocationState.settingsLocation.countyId, 'dallas-tx');
  assert.equal(state.storageLocationState.profileLocation.countyId, 'dallas-tx');
  assert.equal(state.selectedAwarenessArea.countyId, 'dallas-tx');
});

test('LP213 roadway activation does not yield after an installed manifest', () => {
  const activate = productionFunction('gridlyActivateRoadwayDatasetForActiveCounty');
  const load = productionFunction('loadRoadwayDataset');
  assert.match(activate, /if \(!gridlyRoadwayRuntimeManifest\) await gridlyEnsureRoadwayRuntimeManifestLoaded\(\)/);
  assert.match(load, /if \(!gridlyRoadwayRuntimeManifest\) await gridlyEnsureRoadwayRuntimeManifestLoaded\(\)/);
});

test('LP213 repairs the browser settings=collin and awareness=liberty stale consumers', () => {
  const dallas = Object.freeze({ key: 'dallas', label: 'Dallas', storageValue: 'Dallas', countyId: 'dallas-tx' });
  const collinDallas = Object.freeze({ key: 'dallas-collin', label: 'Dallas', storageValue: 'Dallas', countyId: 'collin-tx' });
  const canonicalDallas = Object.freeze({ key: 'place-4819000', label: 'Dallas', storageValue: 'Dallas', countyId: null, canonicalMultiCountyPlace: true });
  const context = {
    Object,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_SETTINGS_DEFAULTS: { notifications: {}, display: {}, personalization: {} },
    GRIDLY_SETTINGS_MAP_STYLE_LABELS: {},
    GRIDLY_SETTINGS_VALID_THEMES: new Set(),
    GRIDLY_SETTINGS_TEXT_SIZE_ALIASES: {},
    GRIDLY_SETTINGS_VALID_TEXT_SIZES: new Set(),
    GRIDLY_COUNTY_REGISTRY: {
      'liberty-tx': { countyFips: '48291' },
      'collin-tx': { countyFips: '48085' },
      'dallas-tx': { countyFips: '48113' }
    },
    gridlySelectedAwarenessAreaResolutionCache: { totalGetterCalls: 0, signature: 'stale-liberty', area: { label: 'Liberty', countyId: 'liberty-tx' } },
    gridlyRecordSelectedAwarenessAreaGetterCaller: () => {},
    gridlyNormalizeCountyId: (value) => String(value || '').toLowerCase(),
    gridlyIsKnownCountyId: (value) => ['liberty-tx', 'collin-tx', 'dallas-tx'].includes(value),
    normalizeGridlyPreferredName: (value) => value || '',
    resolveGridlyAwarenessArea: () => collinDallas,
    resolveGridlyAwarenessAreaForCounty: (_value, countyId) => countyId === 'dallas-tx' ? dallas : collinDallas,
    gridlyResolveCountyIdForAwarenessArea: () => 'collin-tx',
    gridlyReadHomePersonalizationRecord: () => ({ identityType: 'PLACE_GEOID', countyId: null }),
    gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity: () => ({ placeGeoid: '4819000', memberships: ['48085', '48113', '48121', '48257', '48397'], area: canonicalDallas }),
    gridlyGetActiveCountyId: () => 'dallas-tx'
  };
  vm.createContext(context);
  vm.runInContext([
    productionFunction('normalizeGridlySettings'),
    productionFunction('getGridlySelectedAwarenessArea')
  ].join('\n'), context);

  assert.equal(context.gridlySelectedAwarenessAreaResolutionCache.area.countyId, 'liberty-tx', 'fixture begins with the observed stale awareness consumer');
  const settings = context.normalizeGridlySettings({ community: { homeTown: 'Dallas', awarenessArea: 'Dallas', countyId: 'dallas-tx' } });
  assert.equal(settings.community.countyId, 'dallas-tx', 'explicit operational county defeats the ambiguous Collin label match');
  assert.equal(context.getGridlySelectedAwarenessArea().countyId, 'dallas-tx', 'canonical awareness consumes the active membership county instead of stale Liberty');
});
