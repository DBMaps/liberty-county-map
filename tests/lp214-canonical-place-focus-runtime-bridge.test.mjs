import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const presentation = JSON.parse(fs.readFileSync(new URL('../data/generated/gridly-statewide-place-presentation-v1.json', import.meta.url), 'utf8'));
const inventory = JSON.parse(fs.readFileSync(new URL('../data/generated/lp214-county-community-inventory.json', import.meta.url), 'utf8'));

function body(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1);
  let depth = 0, opened = false;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === '{') { depth += 1; opened = true; }
    if (app[i] === '}') depth -= 1;
    if (opened && depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

function runtime(targets = presentation.places) {
  const sandbox = { Object, Number, String, gridlyPlacePresentationTargets: targets,
    GRIDLY_TOWN_STARTUP_ZOOM: 13,
    GRIDLY_CANONICAL_PLACE_FOCUS_AUTHORITY: 'LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1',
    GRIDLY_CANONICAL_PLACE_AWARENESS_RADIUS_MILES: 7,
    GRIDLY_PLACE_PRESENTATION_URL: 'data/generated/gridly-statewide-place-presentation-v1.json' };
  vm.createContext(sandbox);
  vm.runInContext(`${body('gridlyIsValidCanonicalPlacePresentationTarget')}\n${body('resolveGridlyCanonicalPlacePresentationFocus')}`, sandbox);
  return sandbox.resolveGridlyCanonicalPlacePresentationFocus;
}

const resolve = runtime();

test('Houston and Dallas resolve only through canonical PLACE identity', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(resolve('place-4835000'))), {
    canonicalKey: 'place-4835000', placeGeoid: '4835000', lat: 29.7589382, lng: -95.3676974,
    zoom: 13, radiusMiles: 7, authority: 'LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1',
    provenance: 'data/generated/gridly-statewide-place-presentation-v1.json'
  });
  assert.deepEqual([resolve({ key: 'place-4819000', countyId: 'collin-tx' }).lat, resolve({ key: 'place-4819000', countyId: 'rockwall-tx' }).lng], [32.7933334, -96.7665128]);
  assert.equal(resolve({ label: 'Houston' }), null, 'a consumer label cannot authorize focus resolution');
  assert.equal(resolve({ key: 'place-4835000', placeGeoid: '4819000' }), null, 'conflicting identity fails closed');
});

test('all 1,859 runtime focuses have exact LP201 artifact parity', () => {
  const results = Object.entries(presentation.places).map(([placeGeoid, target]) => ({ placeGeoid, target, focus: resolve(`place-${placeGeoid}`) }));
  assert.deepEqual({ total: results.length, runtimeResolved: results.filter(row => row.focus).length,
    missing: results.filter(row => !row.focus).length,
    coordinateMismatch: results.filter(row => row.focus && (row.focus.lat !== row.target.lat || row.focus.lng !== row.target.lon)).length,
    invalid: results.filter(row => row.focus && (!Number.isFinite(row.focus.lat) || !Number.isFinite(row.focus.lng))).length,
    ownerReviewRequired: 0 }, { total: 1859, runtimeResolved: 1859, missing: 0, coordinateMismatch: 0, invalid: 0, ownerReviewRequired: 0 });
});

test('missing and malformed governed targets fail closed without prior-area leakage', () => {
  assert.equal(runtime({})('place-4835000'), null);
  assert.equal(runtime({ '4835000': { lat: 'bad', lon: -95.3676974 } })('place-4835000'), null);
  const mutableTargets = { ...presentation.places };
  const transitionResolve = runtime(mutableTargets);
  assert.notDeepEqual(transitionResolve('place-4819000'), transitionResolve('place-4835000'));
  delete mutableTargets['4835000'];
  assert.equal(transitionResolve('place-4835000'), null, 'Dallas focus is never retained for missing Houston');
  assert.equal(transitionResolve('place-4819000').canonicalKey, 'place-4819000');
});

test('multi-county governed membership inventory remains unchanged', () => {
  assert.deepEqual(inventory.summary, { countyCount: 254, uniqueCanonicalCommunityCount: 1859, countyCommunityMembershipCount: 2058, singleCountyCommunityCount: 1696, multiCountyCommunityCount: 163, placeCommunityCount: 1859, otherGovernedCommunityCount: 0, unresolvedCount: 0, ownerReviewRequiredCount: 0 });
  const occurrences = geoid => inventory.counties.flatMap(county => county.communities.filter(row => row.placeGeoid === geoid));
  assert.equal(occurrences('4819000').length, 5);
  assert.ok(occurrences('4835000').length > 1);
  assert.equal(new Set(occurrences('4835000').map(row => row.canonicalKey)).size, 1);
});

test('awareness and DriveTexas use shared canonical context and expose fail-closed evidence', () => {
  assert.match(app, /const canonicalFocus = isCountyWide \? null : resolveGridlyCanonicalPlacePresentationFocus\(selectedArea\)/);
  assert.match(app, /geographicEvaluationState: hasCanonicalPlaceIdentity && !canonicalFocus \? "CANONICAL_FOCUS_UNAVAILABLE" : "AVAILABLE"/);
  const connector = fs.readFileSync(new URL('../js/gridlyDriveTexasLiveConnector.js', import.meta.url), 'utf8');
  assert.match(connector, /getGridlyCanonicalAwarenessPresentationContext/);
  assert.match(connector, /if \(awareness\.geographicEvaluationState === "CANONICAL_FOCUS_UNAVAILABLE"\) return false/);
  assert.match(connector, /lastFilterFocusAuthority/);
});
