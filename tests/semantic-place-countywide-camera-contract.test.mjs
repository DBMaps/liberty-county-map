import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';

const app = fs.readFileSync('js/app.js', 'utf8');
const presentationBytes = fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json');
const presentation = JSON.parse(presentationBytes);
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const matrix = ['Dallas', 'El Paso', 'Laredo', 'San Antonio', 'Palestine', 'Liberty', 'Houston', 'Fort Worth', 'Corpus Christi', 'Lubbock', 'Waco', 'Tyler', 'College Station'];
const ownerMatrix = ['El Paso', 'San Antonio', 'Dallas', 'Laredo', 'Palestine', 'Liberty'];

function body(name, next = 'function ') {
  const start = app.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} exists`);
  const end = app.indexOf(`\n\n${next}`, start + 1);
  return app.slice(start, end < 0 ? app.length : end);
}

test('governed PLACE artifact identity and statewide coverage remain exact', () => {
  assert.equal(presentationBytes.length, 137855);
  assert.equal(crypto.createHash('sha256').update(presentationBytes).digest('hex'), 'b4077f9a6532619c92c193a7849545dcc9f59abd5fbd717c0714442a1b86d18e');
  assert.equal(presentation.counts.eligiblePlaceCount, 1859);
  assert.equal(presentation.counts.presentationTargetCount, 1859);
  assert.equal(Object.keys(presentation.places).length, 1859);
  assert.deepEqual(projection.counts, { uniquePlaceCount: 1859, membershipCount: 2058, multiCountyPlaceCount: 163, excludedIneligibleCount: 4 });
});

test('required PLACE matrix has canonical GEOIDs and one governed target per identity', () => {
  for (const name of matrix) {
    const matches = projection.communities.filter((community) => community.displayName === name);
    assert.equal(matches.length, 1, `${name} resolves to one canonical PLACE`);
    const [{ placeGeoid, countyMemberships }] = matches;
    assert.match(placeGeoid, /^48\d{5}$/);
    assert.ok(presentation.places[placeGeoid], `${name} target exists`);
    const targets = (countyMemberships || []).map(() => presentation.places[placeGeoid]);
    assert.ok(targets.every((target) => target === presentation.places[placeGeoid]), `${name} memberships share target`);
  }
});

test('PLACE dispatcher owns an exact zoom-13 setView and never fits county data', () => {
  const dispatch = body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection');
  const placeBranch = dispatch.slice(dispatch.indexOf('if (placeGeoid)'), dispatch.indexOf('if (area.countyWide !== true)'));
  assert.match(placeBranch, /gridlyPlacePresentationTargets\?\.\[placeGeoid\]/);
  assert.match(placeBranch, /setGridlyAwarenessView\([^;]+targetZoom/);
  assert.match(placeBranch, /compensateForChrome: false/);
  assert.doesNotMatch(placeBranch, /fitBounds|County|defaultCenter|prior|governedFocus/);
  assert.match(app, /const GRIDLY_TOWN_STARTUP_ZOOM = 13;/);
  assert.match(body('setGridlyAwarenessView', 'function initMap'), /map\.setView/);
});

function createCameraHarness() {
  const calls = { setView: [], panBy: [], fitBounds: [] };
  const map = {
    center: null,
    setView([lat, lng], zoom, options) { this.center = { lat, lng }; calls.setView.push({ lat, lng, zoom, options }); },
    panBy(offset, options) { calls.panBy.push({ offset, options }); },
    fitBounds(bounds, options) { calls.fitBounds.push({ bounds, options }); },
    latLngToContainerPoint() { return { subtract(point) { return { x: 0 - point.x, y: 0 - point.y }; } }; },
    getSize() { return { x: 400, y: 800 }; }
  };
  const context = {
    map,
    L: { point(x, y) { return { x, y }; } },
    GRIDLY_TOWN_STARTUP_ZOOM: 13,
    GRIDLY_COUNTY_STARTUP_ZOOM: 10,
    gridlyPlacePresentationTargets: presentation.places,
    gridlySemanticCameraSequence: 0,
    gridlyCommittedSemanticCamera: null,
    gridlyNormalizeCountyId(value) { return String(value); },
    gridlyResolveCanonicalPlaceGeoid(area) { return /^48\d{5}$/.test(area?.placeGeoid || '') ? area.placeGeoid : null; },
    getGridlyVisibleMapChromeInsets() { return { top: 120, bottom: 200, left: 20, right: 20 }; },
    getGridlyAwarenessFitPadding() { return { paddingTopLeft: [20, 120], paddingBottomRight: [20, 200] }; },
    gridlyGetAuthoritativeCountyGeometryFocusBounds(countyId) { return { authoritativeCountyId: countyId }; }
  };
  vm.runInNewContext(`${body('setGridlyAwarenessView', 'function initMap')}\nthis.setGridlyAwarenessView = setGridlyAwarenessView;`, context);
  vm.runInNewContext(`${body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection')}\nthis.gridlyDispatchSemanticCamera = gridlyDispatchSemanticCamera;`, context);
  return { context, map, calls };
}

test('six-city interactive and cold-start PLACE cameras settle exactly on governed targets', () => {
  for (const source of ['confirmed_home', 'initial_map_construction']) {
    for (const displayName of ownerMatrix) {
      const community = projection.communities.find((entry) => entry.displayName === displayName);
      const target = presentation.places[community.placeGeoid];
      const { context, map, calls } = createCameraHarness();
      assert.equal(context.gridlyDispatchSemanticCamera({ placeGeoid: community.placeGeoid }, community.primaryCountyId, { source }), true);
      assert.deepEqual(map.center, { lat: target.lat, lng: target.lon }, `${displayName} ${source} final center`);
      assert.deepEqual(JSON.parse(JSON.stringify(calls.setView)), [{ lat: target.lat, lng: target.lon, zoom: 13, options: { animate: false } }]);
      assert.equal(calls.panBy.length, 0, `${displayName} ${source} has no PLACE panBy`);
      assert.equal(calls.fitBounds.length, 0, `${displayName} ${source} has no fitBounds`);
    }
  }
});

test('non-PLACE setGridlyAwarenessView consumers retain chrome compensation by default', () => {
  const { context, calls } = createCameraHarness();
  assert.equal(context.setGridlyAwarenessView({ lat: 30, lng: -95 }, 12), true);
  assert.equal(calls.setView.length, 1);
  assert.equal(calls.panBy.length, 1);
});

test('PLACE transition matrix always settles on the newly selected governed target', () => {
  const transitions = [['Palestine', 'El Paso'], ['El Paso', 'Laredo'], ['Laredo', 'Dallas'], ['Dallas', 'San Antonio'], ['San Antonio', 'Liberty']];
  for (const [from, to] of transitions) {
    const { context, map, calls } = createCameraHarness();
    for (const name of [from, to]) {
      const community = projection.communities.find((entry) => entry.displayName === name);
      context.gridlyDispatchSemanticCamera({ placeGeoid: community.placeGeoid }, community.primaryCountyId, { source: 'confirmed_home' });
    }
    const selected = projection.communities.find((entry) => entry.displayName === to);
    const target = presentation.places[selected.placeGeoid];
    assert.deepEqual(map.center, { lat: target.lat, lng: target.lon }, `${from} -> ${to}`);
    assert.equal(calls.panBy.length, 0);
    assert.equal(calls.fitBounds.length, 0);
  }
});

test('El Paso and Bexar COUNTYWIDE cameras retain geometry, padding, and max zoom 10', () => {
  for (const countyId of ['48141', '48029']) {
    const { context, calls } = createCameraHarness();
    assert.equal(context.gridlyDispatchSemanticCamera({ countyWide: true, countyId }, countyId), true);
    assert.equal(calls.setView.length, 0);
    assert.equal(calls.panBy.length, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.fitBounds)), [{
      bounds: { authoritativeCountyId: countyId },
      options: { paddingTopLeft: [20, 120], paddingBottomRight: [20, 200], animate: false, maxZoom: 10 }
    }]);
  }
});

test('Home, picker, restore/startup and lifecycle paths converge without PLACE rewrites', () => {
  assert.match(body('gridlyFocusConfirmedHomeSelection', 'const GRIDLY_LP0361_PASSIVE'), /gridlyDispatchSemanticCamera/);
  assert.match(body('selectGridlySettingsAwarenessArea', 'function gridlyCommunityCoverageExpansionAudit'), /saveGridlyHomeTownPreference/);
  assert.doesNotMatch(body('selectGridlySettingsAwarenessArea', 'function gridlyCommunityCoverageExpansionAudit'), /gridlyDispatchSemanticCamera/);
  assert.match(body('applyGridlyHomeTownAwarenessContext', 'function installLayerPickerDebugDiagnostics'), /gridlyDispatchSemanticCamera/);
  assert.match(app, /gridlyRestoreHomePersonalizationOnStartup\?\.\(\)/);
  assert.match(app, /applyGridlyHomeTownAwarenessContext\(\{ source: "map_init"/);
  assert.match(app, /source === "crossings_loaded" && gridlyCommittedSemanticCamera\?\.semanticLevel === "PLACE"/);
});

test('COUNTYWIDE uses canonical county geometry with chrome padding and max zoom 10', () => {
  const dispatch = body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection');
  assert.match(dispatch, /gridlyGetAuthoritativeCountyGeometryFocusBounds\(canonicalCountyId\)/);
  assert.match(dispatch, /map\.fitBounds\(bounds, \{ \.\.\.getGridlyAwarenessFitPadding\(\), animate: false, maxZoom: GRIDLY_COUNTY_STARTUP_ZOOM \}\)/);
  assert.match(app, /const GRIDLY_COUNTY_STARTUP_ZOOM = 10;/);
  assert.match(dispatch, /const placeGeoid = area\.countyWide === true[^;]+\? null/);
  for (const county of ['El Paso', 'Bexar']) assert.ok(projection.counties.some((entry) => entry.countyName === county || entry.displayName === county || entry.name === county), `${county} County exists`);
});

test('deferred county geometry is sequence-guarded against a newer PLACE camera', () => {
  const dispatch = body('gridlyDispatchSemanticCamera', 'function gridlyFocusConfirmedHomeSelection');
  assert.match(dispatch, /if \(sequence !== gridlySemanticCameraSequence \|\| !map\) return false/);
  assert.match(dispatch, /Promise\.resolve\(loadGridlyCountyBoundaryOverlay\(\)\)\.then\(issueCountyFit\)/);
  assert.match(dispatch, /gridlyCommittedSemanticCamera = Object\.freeze\(\{ sequence, semanticLevel: "PLACE"/);
});
