import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const report = JSON.parse(fs.readFileSync('reports/lp197/governed-place-consumer-presentation-cameras.json', 'utf8'));
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const canonicalTargets = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8')).places;
const approved = [
  ['4819000', 'Dallas', 32.78294501748632, -96.79538726806642],
  ['4827000', 'Fort Worth', 32.757685346479455, -97.33182907104494],
  ['4805000', 'Austin', 30.274931186653326, -97.74415969848634],
  ['4824000', 'El Paso', 31.765537409484374, -106.48704528808595]
];

function body(name, next) {
  const start = app.indexOf(`function ${name}`);
  const end = app.indexOf(`\n\n${next}`, start);
  assert.ok(start >= 0 && end > start, `${name} is extractable`);
  return app.slice(start, end);
}

function harness() {
  const calls = { setView: [], fitBounds: [] };
  const context = {
    map: { setView(center, zoom, options) { calls.setView.push({ center, zoom, options }); }, fitBounds(bounds, options) { calls.fitBounds.push({ bounds, options }); } },
    GRIDLY_TOWN_STARTUP_ZOOM: 13, GRIDLY_COUNTY_STARTUP_ZOOM: 10,
    gridlyPlacePresentationTargets: canonicalTargets, gridlySemanticCameraSequence: 0, gridlyCommittedSemanticCamera: null,
    GRIDLY_LP194_SAN_ANTONIO_REGION_LOOKUP: {}, GRIDLY_AWARENESS_AREA_BY_KEY: {},
    gridlyResolveCanonicalPlaceGeoid: area => /^48\d{5}$/.test(area?.placeGeoid || '') ? area.placeGeoid : null,
    gridlyNormalizeCountyId: value => String(value), gridlyGetAuthoritativeCountyGeometryFocusBounds: id => ({ county: id }),
    getGridlyAwarenessFitPadding: () => ({ paddingTopLeft: [1, 2], paddingBottomRight: [3, 4] }),
    setGridlyAwarenessView(target, zoom, options) { calls.setView.push({ center: [target.lat, target.lng], zoom, options }); return true; }
  };
  const contractStart = app.indexOf('const GRIDLY_PLACE_CONSUMER_PRESENTATION_CAMERA_SOURCE');
  const contractEnd = app.indexOf('\nlet gridlyPlacePresentationTargets', contractStart);
  vm.runInNewContext(`${app.slice(contractStart, contractEnd)}\nthis.lookup=gridlyGetGovernedPlaceConsumerPresentationCamera;`, context);
  vm.runInNewContext(`${body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection')}\nthis.dispatch=gridlyDispatchSemanticCamera;`, context);
  return { context, calls };
}

test('registry is the exact four owner-approved GEOID-keyed presentation cameras', () => {
  assert.equal(report.cameras.length, 4);
  const { context } = harness();
  for (const [placeGeoid, label, lat, lng] of approved) {
    assert.deepEqual(JSON.parse(JSON.stringify(context.lookup(placeGeoid))), { lat, lng, zoom: 13, source: 'OWNER_APPROVED_PLACE_PRESENTATION_CAMERA' }, label);
    assert.deepEqual(report.cameras.find(camera => camera.placeGeoid === placeGeoid), { placeGeoid, label, lat, lng, zoom: 13, source: 'OWNER_APPROVED_PLACE_PRESENTATION_CAMERA', ownerApproved: true });
  }
  assert.equal(context.lookup('4899999'), null);
  assert.equal(context.lookup('Austin'), null);
});

test('semantic PLACE dispatch uses overrides exactly and canonical fallback otherwise', () => {
  for (const [placeGeoid, , lat, lng] of approved) {
    const { context, calls } = harness();
    assert.equal(context.dispatch({ placeGeoid, lat: 1, lng: 2 }, null, { source: 'startup_reload' }), true);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.setView)), [{ center: [lat, lng], zoom: 13, options: { animate: false, compensateForChrome: false } }]);
  }
  const { context, calls } = harness();
  const placeGeoid = '4854708';
  context.dispatch({ placeGeoid }, '48001', { source: 'confirmed_home' });
  assert.deepEqual(calls.setView[0].center, [canonicalTargets[placeGeoid].lat, canonicalTargets[placeGeoid].lon]);
});

test('canonical identities and memberships remain unchanged and Austin County cannot inherit Austin camera', () => {
  for (const [placeGeoid, label] of approved) {
    const community = projection.communities.find(row => row.placeGeoid === placeGeoid);
    assert.equal(community.displayName, label);
    assert.ok(community.countyMemberships.length >= 1);
    if (['4819000', '4827000', '4805000'].includes(placeGeoid)) {
      assert.ok(community.countyMemberships.length > 1);
      assert.equal(Object.hasOwn(community, 'countyId'), false);
    }
  }
  const { context, calls } = harness();
  assert.equal(context.dispatch({ countyWide: true, countyId: '48015', label: 'Austin County' }, '48015'), true);
  assert.equal(calls.setView.length, 0);
  assert.deepEqual(calls.fitBounds[0].bounds, { county: '48015' });
});

test('shared selection and reload paths converge on GEOID dispatch without persisted coordinates', () => {
  const confirmed = body('gridlyFocusConfirmedHomeSelection', 'function gridlyResolvePersistedSemanticContextForStartup');
  const startup = body('gridlyResolvePersistedSemanticContextForStartup', 'function gridlyHydratePersistedSemanticContextOnStartup');
  assert.match(confirmed, /gridlyDispatchSemanticCamera\(area, countyId/);
  assert.match(startup, /validation\.area/);
  assert.doesNotMatch(startup, /record\.(lat|lng|latitude|longitude)/);
  assert.match(app, /source: "initial_map_construction"/);
});

test('metro precedence, county fitting, and Route Watch movement remain outside the PLACE override', () => {
  const dispatch = body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection');
  assert.ok(dispatch.indexOf('sanAntonioRegion') < dispatch.indexOf('const placeGeoid'));
  assert.match(dispatch, /area\.countyWide !== true/);
  assert.match(dispatch, /gridlyGetAuthoritativeCountyGeometryFocusBounds/);
  assert.match(app, /semanticLevel === "HOUSTON_REGION"|houstonRegion/);
  assert.doesNotMatch(dispatch, /Route Watch|routeWatch|start-location/);
});
