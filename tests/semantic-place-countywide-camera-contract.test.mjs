import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const app = fs.readFileSync('js/app.js', 'utf8');
const presentationBytes = fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json');
const presentation = JSON.parse(presentationBytes);
const projection = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const matrix = ['Dallas', 'El Paso', 'Laredo', 'San Antonio', 'Palestine', 'Liberty', 'Houston', 'Fort Worth', 'Corpus Christi', 'Lubbock', 'Waco', 'Tyler', 'College Station'];

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
  assert.match(placeBranch, /setGridlyAwarenessView\([^;]+GRIDLY_TOWN_STARTUP_ZOOM/);
  assert.doesNotMatch(placeBranch, /fitBounds|County|defaultCenter|prior|governedFocus/);
  assert.match(app, /const GRIDLY_TOWN_STARTUP_ZOOM = 13;/);
  assert.match(body('setGridlyAwarenessView', 'function initMap'), /map\.setView/);
});

test('Home, picker, restore/startup and lifecycle paths converge without PLACE rewrites', () => {
  assert.match(body('gridlyFocusConfirmedHomeSelection', 'const GRIDLY_LP0361_PASSIVE'), /gridlyDispatchSemanticCamera/);
  assert.match(body('selectGridlySettingsAwarenessArea', 'function gridlyCommunityCoverageExpansionAudit'), /gridlyDispatchSemanticCamera/);
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
