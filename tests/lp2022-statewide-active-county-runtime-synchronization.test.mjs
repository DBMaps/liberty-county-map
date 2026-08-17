import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { countyRegistryRange } from '../scripts/lp189-statewide-runtime-activation-guarded.mjs';

const source = fs.readFileSync('js/app.js', 'utf8');
const production = JSON.parse(fs.readFileSync('Crossing-Packages/production-crossing-manifest.json', 'utf8'));
const range = countyRegistryRange(source);
const context = { Object }; vm.createContext(context);
vm.runInContext(`${source.slice(0, range.end)};this.registry=GRIDLY_COUNTY_REGISTRY`, context);
const registry = context.registry;
const normalizedName = value => String(value || '').replace(/ County$/i, '').trim().toLowerCase();
const byFips = new Map(Object.values(registry).filter(county => county.countyFips).map(county => [String(county.countyFips), county.id]));
const byName = new Map(Object.values(registry).map(county => [normalizedName(county.name), county.id]));
const recordById = new Map(production.records.map(record => [byName.get(normalizedName(record.county)), { ...record, governedCount: record.crossingCount, state: record.crossingCount ? 'ACTIVE_POSITIVE' : 'ACTIVE_EMPTY' }]));
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8'));
const boundaries = JSON.parse(fs.readFileSync('assets/boundaries/texas-counties-boundaries.geojson', 'utf8'));

function pointInRing(lon, lat, ring) { let inside = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside; } return inside; }
function pointInGeometry(lon, lat, geometry) { const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates; return polygons.some(polygon => pointInRing(lon, lat, polygon[0]) && !polygon.slice(1).some(hole => pointInRing(lon, lat, hole))); }
function countyAt(lat, lon) { return boundaries.features.find(feature => pointInGeometry(lon, lat, feature.geometry))?.properties?.GEOID || null; }
const ownerCameras = { '4805000': { lat: 30.274931186653326, lon: -97.74415969848634 }, '4819000': { lat: 32.78294501748632, lon: -96.79538726806642 }, '4824000': { lat: 31.765537409484374, lon: -106.48704528808595 }, '4827000': { lat: 32.757685346479455, lon: -97.33182907104494 } };

function productionFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next === -1 ? source.length : next).trim();
}

class Runtime {
  active = null; generation = 0; inventoryCounty = null; inventory = [];
  transition(countyId) { assert.ok(registry[countyId]); if (countyId === this.active) return false; this.active = countyId; this.generation++; this.inventoryCounty = null; this.inventory = []; return true; }
  async load(countyId, delay = 0) { const token = this.generation; const record = recordById.get(countyId); await new Promise(resolve => setTimeout(resolve, delay)); if (this.active !== countyId || token !== this.generation) return false; this.inventoryCounty = countyId; this.inventory = Array.from({ length: record.governedCount }, (_, id) => ({ id, countyId })); return true; }
}

test('all governed identities enter the canonical positive or intentional-empty lifecycle', () => {
  assert.equal(Object.keys(registry).length, 254);
  assert.equal(new Set(Object.values(registry).map(county => county.id)).size, 254);
  assert.equal(recordById.size, 254);
  assert.equal([...recordById.values()].filter(r => r.state === 'ACTIVE_POSITIVE').length, 202);
  assert.equal([...recordById.values()].filter(r => r.state === 'ACTIVE_EMPTY').length, 52);
  for (const [id, county] of Object.entries(registry)) { assert.equal(byName.get(normalizedName(county.name)), id); if (county.countyFips) assert.equal(byFips.get(String(county.countyFips)), id); }
});

test('Liberty to Dallas to Liberty replaces inventory and Dallas owns 789', async () => {
  const runtime = new Runtime();
  for (const id of ['liberty-tx', 'dallas-tx', 'liberty-tx']) { runtime.transition(id); await runtime.load(id); assert.equal(runtime.inventoryCounty, id); assert.ok(runtime.inventory.every(row => row.countyId === id)); }
  assert.equal(recordById.get('dallas-tx').governedCount, 789);
  assert.equal(runtime.inventory.length, 115);
});

test('Dallas, Tarrant, empty, Dallas transitions clear and restore', async () => {
  const runtime = new Runtime();
  for (const id of ['dallas-tx', 'tarrant-tx', 'andrews-tx', 'dallas-tx']) { runtime.transition(id); assert.equal(runtime.inventory.length, 0); await runtime.load(id); assert.equal(runtime.inventory.length, recordById.get(id).governedCount); }
  assert.equal(runtime.inventory.length, 789);
});

test('rapid switches suppress stale loads and same county is a no-op', async () => {
  const runtime = new Runtime(); runtime.transition('liberty-tx'); const a = runtime.load('liberty-tx', 30);
  runtime.transition('dallas-tx'); const b = runtime.load('dallas-tx', 20);
  runtime.transition('tarrant-tx'); const c = runtime.load('tarrant-tx', 1);
  assert.deepEqual(await Promise.all([a, b, c]), [false, false, true]);
  assert.equal(runtime.inventoryCounty, 'tarrant-tx'); assert.equal(runtime.transition('tarrant-tx'), false);
});

test('production lifecycle is generic and retains LP202.1 authority', () => {
  assert.match(source, /gridlyResolveCanonicalCountyIdForOperationalContext/);
  assert.match(source, /gridlySynchronizeActiveCountyForOperationalContext\(area, countyId/);
  assert.match(source, /requestedGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.match(source, /gridlyCrossingInventoryCountyId === activeCountyId && Array\.isArray\(crossings\)/);
  const productionLogic = source.match(/function gridlyResolveCanonicalCountyIdForOperationalContext[\s\S]*?\n\}/)[0] + source.match(/function gridlySynchronizeActiveCountyForOperationalContext[\s\S]*?\n\}/)[0];
  assert.doesNotMatch(productionLogic, /dallas|liberty/i);
  assert.match(fs.readFileSync('js/gridlyRuntimeSourceRegistryBridge.js', 'utf8'), /resolveGovernedCrossingSource/);
});

test('all 163 governed multi-county PLACE cameras resolve inside a governed membership', () => {
  const cohort = projection.communities.filter(place => place.countyMemberships.length > 1);
  assert.equal(cohort.length, 163);
  for (const place of cohort) {
    const camera = ownerCameras[place.placeGeoid] || presentation.places[place.placeGeoid];
    const fips = countyAt(Number(camera.lat), Number(camera.lon ?? camera.lng));
    assert.ok(fips, `${place.displayName} coordinate resolves`);
    assert.ok(place.countyMemberships.includes(fips), `${place.displayName} resolves to governed membership ${fips}`);
    const countyName = boundaries.features.find(feature => feature.properties.GEOID === fips)?.properties?.NAME;
    assert.ok(byName.get(normalizedName(countyName)), `${place.displayName} resolves to canonical Gridly county`);
  }
});

test('live canonical resolver uses governed presentation containment and fails closed safely', () => {
  const resolver = source.match(/function gridlyResolveCanonicalCountyIdForOperationalContext[\s\S]*?\n\}/)[0];
  const audit = { value: null };
  const sandbox = {
    Object, Set, Number,
    GRIDLY_COUNTY_REGISTRY: registry,
    gridlyPlacePresentationTargets: presentation.places,
    gridlyOperationalCountyResolutionAudit: null,
    gridlyResolveCanonicalPlaceGeoid: area => /^48\d{5}$/.test(String(area?.placeGeoid || '')) ? String(area.placeGeoid) : null,
    gridlyGetGovernedPlaceConsumerPresentationCamera: geoid => ownerCameras[geoid] ? { ...ownerCameras[geoid], lng: ownerCameras[geoid].lon } : null,
    gridlyNormalizeCountyId: value => value,
    gridlyIsKnownCountyId: value => Boolean(registry[value]),
    gridlyResolveCountyIdForCoordinate: (lat, lon) => ({ countyId: byFips.get(countyAt(lat, lon)) || null })
  };
  vm.createContext(sandbox); vm.runInContext(`${resolver};this.resolve=gridlyResolveCanonicalCountyIdForOperationalContext`, sandbox);
  const dallas = projection.communities.find(place => place.placeGeoid === '4819000');
  const area = { placeGeoid: dallas.placeGeoid, canonicalMultiCountyPlace: true, countyMemberships: dallas.countyMemberships };
  assert.equal(sandbox.resolve(area, null), 'dallas-tx');
  assert.equal(sandbox.gridlyOperationalCountyResolutionAudit.coordinateResolvedCountyFips, '48113');
  assert.equal(sandbox.gridlyOperationalCountyResolutionAudit.membershipValidated, true);
  assert.notEqual(dallas.countyMemberships[0], '48113', 'first membership is not selected');
  assert.equal(sandbox.resolve({ ...area, countyMemberships: ['48085'] }, null), null, 'out-of-membership containment fails closed');
  sandbox.gridlyGetGovernedPlaceConsumerPresentationCamera = () => null; sandbox.gridlyPlacePresentationTargets = {};
  assert.equal(sandbox.resolve(area, null), null, 'missing governed coordinate fails closed');
  assert.equal(sandbox.resolve({ countyId: 'liberty-tx' }, null), 'liberty-tx', 'single-county explicit fast path remains');
});

test('startup restoration and manual PLACE selection both replace Liberty with Dallas runtime', async () => {
  for (const lifecycle of ['startup-semantic-hydration', 'manual-place-selection']) {
    const runtime = new Runtime(); runtime.transition('liberty-tx'); await runtime.load('liberty-tx');
    assert.equal(runtime.inventory.length, 115, lifecycle);
    runtime.transition('dallas-tx');
    assert.equal(runtime.inventory.length, 0, `${lifecycle} synchronously clears stale Liberty inventory`);
    await runtime.load('dallas-tx');
    assert.equal(runtime.active, 'dallas-tx', lifecycle);
    assert.equal(runtime.inventoryCounty, 'dallas-tx', lifecycle);
    assert.equal(runtime.inventory.length, 789, lifecycle);
    assert.ok(runtime.inventory.every(row => row.countyId !== 'liberty-tx'), lifecycle);
  }
  assert.match(source, /startup-semantic-hydration:presentation-ready/);
  assert.match(source, /gridlyDispatchSemanticCamera\(validation\.area, null, \{ source \}\)/);
});

test('production semantic caller retries containment readiness and commits Dallas through the real setter', async () => {
  const dallas = projection.communities.find(place => place.placeGeoid === '4819000');
  let geometryReady = false;
  let loadStartedCounty = null;
  const sandbox = {
    Object, Set, Number, Promise,
    window: null,
    GRIDLY_COUNTY_REGISTRY: registry,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_TOWN_STARTUP_ZOOM: 12,
    GRIDLY_LP194_SAN_ANTONIO_REGION_LOOKUP: {},
    GRIDLY_AWARENESS_AREA_BY_KEY: {},
    gridlyPlacePresentationTargets: presentation.places,
    map: {},
    crossings: Array.from({ length: 115 }, (_, id) => ({ id, countyId: 'liberty-tx' })),
    gridlyCrossingInventoryCountyId: 'liberty-tx',
    gridlyActiveCountyTransitionGeneration: 0,
    gridlyActiveCountyStaleRequestSuppressions: 0,
    gridlyStartupContextFinalized: true,
    gridlySemanticCameraSequence: 0,
    gridlyConfirmedCameraTransaction: null,
    gridlyCommittedSemanticCamera: null,
    gridlyActiveGeographicPresentation: null,
    activeGeoFilter: 'town',
    gridlyOperationalCountyResolutionAudit: null,
    gridlyActiveCountySynchronizationAudit: Object.freeze({ synchronizerInvoked: false }),
    gridlyNormalizeCountyId: value => String(value || '').trim().toLowerCase(),
    gridlyIsKnownCountyId: value => Boolean(registry[value]),
    gridlyGetActiveCountyId() { return sandbox.window.GRIDLY_ACTIVE_COUNTY_ID || 'liberty-tx'; },
    gridlyGetGovernedPlaceConsumerPresentationCamera: geoid => geoid === '4819000' ? { lat: ownerCameras[geoid].lat, lng: ownerCameras[geoid].lon, zoom: 12, source: 'OWNER' } : null,
    gridlyResolveCountyIdForCoordinate: () => ({ countyId: geometryReady ? 'dallas-tx' : null }),
    setGridlyAwarenessView: () => true,
    gridlyPublishValidationIdentity() {}, gridlyClearStaleAwarenessAreaForCountyContext() {},
    resetGridlyCrossingRuntimeAuditStateForCounty() {}, gridlyActivateRoadwayDatasetForActiveCounty() {},
    resyncGridlyActiveCountyVisibleSurfaces() {}, renderGridlyCountyBoundaryOverlay() {},
    loadGridlyActiveCountyBoundaryIdentity() {}, gridlyFitMapToActiveCountyContext() {},
    ensureGridlyActiveCountyCrossingInventory() {
      const countyId = sandbox.window.GRIDLY_ACTIVE_COUNTY_ID;
      const generation = sandbox.gridlyActiveCountyTransitionGeneration;
      loadStartedCounty = countyId;
      Promise.resolve().then(() => {
        if (sandbox.window.GRIDLY_ACTIVE_COUNTY_ID !== countyId || sandbox.gridlyActiveCountyTransitionGeneration !== generation) return;
        sandbox.gridlyCrossingInventoryCountyId = countyId;
        sandbox.crossings = Array.from({ length: recordById.get(countyId).governedCount }, (_, id) => ({ id, countyId }));
      });
    }
  };
  sandbox.window = sandbox;
  sandbox.gridlyLp0361cRuntimeCountyGeometryPackageLoader = { load: async () => { geometryReady = true; } };
  vm.createContext(sandbox);
  vm.runInContext(`
    ${productionFunction('gridlyResolveCanonicalPlaceGeoid')}
    ${productionFunction('gridlyResolveCanonicalCountyIdForOperationalContext')}
    ${productionFunction('gridlySetActiveCountyContext')}
    ${productionFunction('gridlySynchronizeActiveCountyForOperationalContext')}
    ${productionFunction('gridlyDispatchSemanticCamera')}
    this.dispatch = gridlyDispatchSemanticCamera;
  `, sandbox);
  sandbox.GRIDLY_ACTIVE_COUNTY_ID = 'liberty-tx';
  const area = { placeGeoid: dallas.placeGeoid, label: 'Dallas', canonicalMultiCountyPlace: true, countyMemberships: dallas.countyMemberships };
  assert.equal(sandbox.dispatch(area, null, { source: 'manual-place-selection' }), true, 'camera may commit before containment package is ready');
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(sandbox.GRIDLY_ACTIVE_COUNTY_ID, 'dallas-tx');
  assert.equal(sandbox.gridlyActiveCountyTransitionGeneration, 1);
  assert.equal(loadStartedCounty, 'dallas-tx');
  assert.equal(sandbox.gridlyCrossingInventoryCountyId, 'dallas-tx');
  assert.equal(sandbox.crossings.length, 789);
  assert.equal(sandbox.gridlyActiveCountySynchronizationAudit.setterInvoked, true);
  assert.equal(sandbox.gridlyActiveCountySynchronizationAudit.transitionCommitted, true);
  assert.equal(sandbox.gridlyActiveCountySynchronizationAudit.transitionBlockedReason, null);
});
