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
