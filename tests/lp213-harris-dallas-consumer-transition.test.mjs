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

test('LP213 startup settings and awareness resolution is bounded and non-reentrant', () => {
  const dallas = Object.freeze({ key: 'place-4819000', label: 'Dallas', storageValue: 'Dallas', placeGeoid: '4819000', canonicalMultiCountyPlace: true, countyMemberships: Object.freeze(['48085', '48113', '48121', '48257', '48397']), countyId: null });
  let settingsDepth = 0;
  let maximumSettingsDepth = 0;
  let settingsReads = 0;
  const context = {
    Object,
    Set,
    Map,
    String,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: { 'liberty-tx': { countyFips: '48291' }, 'dallas-tx': { countyFips: '48113' } },
    GRIDLY_AWARENESS_AREA_DEFINITIONS: [dallas],
    GRIDLY_AWARENESS_AREA_BY_KEY: { [dallas.key]: dallas },
    GRIDLY_SETTINGS_DEFAULTS: { notifications: {}, display: { mapStyle: 'standard', theme: 'system', textSize: 'standard' }, personalization: { preferredName: '' } },
    GRIDLY_SETTINGS_MAP_STYLE_LABELS: { standard: 'Standard' },
    GRIDLY_SETTINGS_VALID_THEMES: new Set(['system']),
    GRIDLY_SETTINGS_TEXT_SIZE_ALIASES: {},
    GRIDLY_SETTINGS_VALID_TEXT_SIZES: new Set(['standard']),
    gridlyNormalizeCountyId: (value) => String(value || '').toLowerCase(),
    normalizeGridlyPreferredName: (value) => String(value || ''),
    gridlyResolveCountyIdForAwarenessArea: () => { throw new Error('explicit county must not fall back to awareness state'); },
    gridlyUserProfile: {},
    gridlySelectedAwarenessAreaResolutionCache: { totalGetterCalls: 0, signature: '', area: null, cacheHits: 0, underlyingResolverCalls: 0 },
    gridlyRecordSelectedAwarenessAreaGetterCaller() {},
    gridlyLp016RecordAwarenessSwitchEvent() {},
    gridlyLp016AwarenessAreaLabel: () => 'Dallas',
    gridlyReadHomePersonalizationRecord: () => null,
    window: { GRIDLY_ACTIVE_COUNTY_ID: 'dallas-tx' }
  };
  vm.createContext(context);
  vm.runInContext([
    productionFunction('normalizeGridlyAwarenessAreaLookupText'),
    productionFunction('resolveGridlyAwarenessArea'),
    productionFunction('resolveGridlyAwarenessAreaForCounty'),
    productionFunction('gridlyResolveSettingsAwarenessArea'),
    productionFunction('gridlyProjectCanonicalPlaceOperationalCounty'),
    productionFunction('normalizeGridlySettings'),
    productionFunction('getGridlySelectedAwarenessArea')
  ].join('\n'), context);
  context.getGridlySettingsPreferences = () => {
    settingsReads += 1;
    settingsDepth += 1;
    maximumSettingsDepth = Math.max(maximumSettingsDepth, settingsDepth);
    assert.ok(settingsReads <= 2, 'startup settings resolution remains bounded');
    try {
      return context.normalizeGridlySettings({ community: { awarenessArea: 'Dallas', countyId: 'dallas-tx' } });
    } finally {
      settingsDepth -= 1;
    }
  };

  const selected = context.getGridlySelectedAwarenessArea();
  assert.equal(maximumSettingsDepth, 1, 'settings normalization never recursively re-enters settings');
  assert.equal(settingsReads, 1, 'one selected-area lookup performs one settings read');
  assert.equal(selected.key, 'place-4819000', 'canonical Dallas PLACE identity is retained');
  assert.equal(selected.countyId, 'dallas-tx', 'operational Dallas county is projected after normalization');
});

test('LP213 startup Liberty cancellation is followed by authoritative Dallas roadway activation', async () => {
  const activations = [];
  let roadwayOwner = 'liberty-tx';
  let roadwayFeatureCount = 0;
  let activeSequence = 1;
  let currentLoad = { countyId: 'liberty-tx', sequence: 1 };
  const context = {
    Object,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: {
      'liberty-tx': { id: 'liberty-tx', countyFips: '48291' },
      'dallas-tx': { id: 'dallas-tx', countyFips: '48113' }
    },
    gridlyPlacePresentationTargets: null,
    gridlyOperationalCountyResolutionAudit: null,
    gridlyActiveCountySynchronizationAudit: null,
    gridlyActiveCountyTransitionGeneration: 0,
    window: { GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' },
    gridlyGetActiveCountyId: () => context.window.GRIDLY_ACTIVE_COUNTY_ID,
    gridlyNormalizeCountyId: (id) => String(id || '').toLowerCase(),
    gridlyIsKnownCountyId: (id) => ['liberty-tx', 'dallas-tx'].includes(id),
    gridlyResolveCountyIdForCoordinate: () => ({ countyId: 'dallas-tx', authoritativeGeometryAvailable: true }),
    gridlyGetGovernedPlaceConsumerPresentationCamera: () => null,
    gridlySetActiveCountyContext: (id) => {
      context.window.GRIDLY_ACTIVE_COUNTY_ID = id;
      context.gridlyActiveCountyTransitionGeneration += 1;
      roadwayOwner = null;
      activations.push({ countyId: 'liberty-tx', status: 'cancelled' });
      void context.gridlyActivateRoadwayDatasetForActiveCounty('active-county-change');
      return id;
    },
    gridlyActivateRoadwayDatasetForActiveCounty: async (reason) => {
      const countyId = context.window.GRIDLY_ACTIVE_COUNTY_ID;
      if (currentLoad?.countyId === countyId) {
        activations.push({ countyId, status: 'deduplicated', reason });
        return currentLoad.promise;
      }
      const sequence = ++activeSequence;
      const promise = Promise.resolve().then(() => {
        if (context.window.GRIDLY_ACTIVE_COUNTY_ID !== countyId || activeSequence !== sequence) return;
        roadwayOwner = countyId;
        roadwayFeatureCount = countyId === 'dallas-tx' ? 40208 : 8405;
      });
      // This reservation intentionally occurs before the first asynchronous
      // yield, matching loadRoadwayDataset's startup replacement contract.
      currentLoad = { countyId, sequence, promise };
      activations.push({ countyId, status: 'started', reason });
      return promise;
    },
    ensureGridlyActiveCountyCrossingInventory() {},
    getGridlySettingsPreferences: () => ({ community: {} }),
    saveGridlySettingsPreferences() {},
    saveGridlyUserProfile() {}
  };
  vm.createContext(context);
  vm.runInContext([
    productionFunction('gridlyResolveCanonicalPlaceGeoid'),
    productionFunction('gridlyResolveCanonicalCountyIdForOperationalContext'),
    productionFunction('gridlyPersistCanonicalPlaceOperationalCounty'),
    productionFunction('gridlySynchronizeActiveCountyForOperationalContext')
  ].join('\n'), context);

  const dallas = { key: 'place-4819000', label: 'Dallas', placeGeoid: '4819000', canonicalMultiCountyPlace: true, countyMemberships: ['48085', '48113'], lat: 32.7767, lng: -96.797 };
  assert.equal(context.gridlySynchronizeActiveCountyForOperationalContext(dallas, 'dallas-tx', 'startup-semantic-hydration'), 'dallas-tx');
  await Promise.resolve();

  assert.deepEqual(activations.map(({ countyId, status }) => ({ countyId, status })), [
    { countyId: 'liberty-tx', status: 'cancelled' },
    { countyId: 'dallas-tx', status: 'started' },
    { countyId: 'dallas-tx', status: 'deduplicated' }
  ]);
  assert.equal(roadwayOwner, 'dallas-tx');
  assert.equal(roadwayFeatureCount, 40208);
  const loaderBody = productionFunction('loadRoadwayDataset');
  assert.ok(!loaderBody.includes('await gridlyEnsureRoadwayRuntimeManifestLoaded()'), 'replacement load reservation cannot yield after activation sequencing');
});

test('LP213 canonical Dallas profile defeats stale settings and unrelated runtime at startup', () => {
  const dallas = Object.freeze({ key: 'place-4819000', label: 'Dallas', storageValue: 'Dallas', placeGeoid: '4819000', canonicalMultiCountyPlace: true, countyMemberships: Object.freeze(['48085', '48113', '48121', '48257', '48397']), countyId: null });
  const home = Object.freeze({ identityType: 'PLACE_GEOID', communityKey: '4819000', awarenessAreaKey: 'place-4819000', consumerLabel: 'Dallas', countyId: null, countyMemberships: dallas.countyMemberships });
  const settingsWrites = [];
  const profileWrites = [];
  const roadwayLoads = [];
  let settingsReads = 0;
  let settingsDepth = 0;
  let maximumSettingsDepth = 0;
  const staleSettings = { community: { homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'collin-tx-dallas', countyId: 'collin-tx' } };
  const context = {
    Object, Set, String,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: {
      'liberty-tx': { id: 'liberty-tx', countyFips: '48291' },
      'collin-tx': { id: 'collin-tx', countyFips: '48085' },
      'dallas-tx': { id: 'dallas-tx', countyFips: '48113' }
    },
    gridlyUserProfile: { homeTown: 'Dallas', awarenessArea: 'Dallas', awarenessAreaKey: 'place-4819000', awarenessAreaCountyId: 'dallas-tx' },
    gridlyActiveCountyTransitionGeneration: 0,
    gridlyOperationalCountyResolutionAudit: null,
    gridlyActiveCountySynchronizationAudit: null,
    gridlyStartupSemanticContext: null,
    gridlyPrimaryMapCameraInitialized: false,
    activeGeoFilter: 'county',
    window: { GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' },
    gridlyNormalizeCountyId: (value) => String(value || '').toLowerCase(),
    gridlyIsKnownCountyId: (value) => ['liberty-tx', 'collin-tx', 'dallas-tx'].includes(value),
    gridlyReadHomePersonalizationRecord: () => home,
    gridlyLp0517ValidateHomeRecord: () => ({ valid: true, area: dallas }),
    gridlyGetActiveCountyId: () => context.window.GRIDLY_ACTIVE_COUNTY_ID,
    getGridlySettingsPreferences: () => {
      settingsReads += 1;
      settingsDepth += 1;
      maximumSettingsDepth = Math.max(maximumSettingsDepth, settingsDepth);
      try { return structuredClone(staleSettings); } finally { settingsDepth -= 1; }
    },
    saveGridlySettingsPreferences: (value) => settingsWrites.push(value),
    saveGridlyUserProfile: (value) => profileWrites.push(value),
    gridlySetActiveCountyContext: (countyId) => {
      context.window.GRIDLY_ACTIVE_COUNTY_ID = countyId;
      context.gridlyActiveCountyTransitionGeneration += 1;
      roadwayLoads.push({ countyId, featureCount: countyId === 'dallas-tx' ? 40208 : 8405 });
      return countyId;
    },
    ensureGridlyActiveCountyCrossingInventory() {},
    invalidateGridlySelectedAwarenessAreaResolutionCache() {},
    gridlyResolveCanonicalPlaceGeoid: undefined
  };
  vm.createContext(context);
  vm.runInContext([
    productionFunction('gridlyResolveCanonicalPlaceGeoid'),
    productionFunction('gridlyResolvePersistedCanonicalPlaceOperationalCounty'),
    productionFunction('gridlyResolveCanonicalCountyIdForOperationalContext'),
    productionFunction('gridlyPersistCanonicalPlaceOperationalCounty'),
    productionFunction('gridlySynchronizeActiveCountyForOperationalContext'),
    productionFunction('gridlyResolvePersistedSemanticContextForStartup'),
    productionFunction('gridlyHydratePersistedSemanticContextOnStartup')
  ].join('\n'), context);

  const startup = context.gridlyResolvePersistedSemanticContextForStartup();
  assert.equal(startup.countyId, 'dallas-tx', 'canonical profile operational county has first persisted precedence');
  const restored = context.gridlyHydratePersistedSemanticContextOnStartup(startup);
  assert.equal(restored.restored, true);
  assert.equal(context.window.GRIDLY_ACTIVE_COUNTY_ID, 'dallas-tx');
  assert.equal(settingsWrites.at(-1).community.countyId, 'dallas-tx');
  assert.equal(settingsWrites.at(-1).community.awarenessAreaKey, 'place-4819000');
  assert.equal(profileWrites.at(-1).awarenessAreaCountyId, 'dallas-tx');
  assert.deepEqual(roadwayLoads.at(-1), { countyId: 'dallas-tx', featureCount: 40208 });
  assert.equal(maximumSettingsDepth, 1, 'settings reads never recursively re-enter');
  assert.equal(settingsReads, 2, 'startup resolution and convergence each perform one bounded settings read');

  context.gridlySynchronizeActiveCountyForOperationalContext({ label: 'Liberty', countyId: 'liberty-tx' }, 'liberty-tx', 'lp213_return');
  assert.deepEqual(roadwayLoads.at(-1), { countyId: 'liberty-tx', featureCount: 8405 });
});
