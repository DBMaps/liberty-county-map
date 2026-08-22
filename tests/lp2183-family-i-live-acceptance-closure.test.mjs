import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const app = fs.readFileSync('js/app.js', 'utf8');
const presentationPath = 'data/generated/gridly-statewide-place-presentation-v1.json';
const presentationBytes = fs.readFileSync(presentationPath);
const presentation = JSON.parse(presentationBytes).places;
const presentationHash = crypto.createHash('sha256').update(presentationBytes).digest('hex');

function inventory(slug) {
  return JSON.parse(fs.readFileSync(`Crossing-Packages/${slug}/Production/${slug}-production-crossings.geojson`, 'utf8').replace(/^\s*\/\/.*$/gm, '')).features;
}

function distanceMiles(lat1, lon1, lat2, lon2) {
  const radians = Math.PI / 180;
  const latDelta = (lat2 - lat1) * radians;
  const lonDelta = (lon2 - lon1) * radians;
  const value = Math.sin(latDelta / 2) ** 2
    + Math.cos(lat1 * radians) * Math.cos(lat2 * radians) * Math.sin(lonDelta / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function lp201Watched(slug, placeGeoid) {
  const center = presentation[placeGeoid];
  return inventory(slug).filter(({ geometry }) => distanceMiles(
    center.lat,
    center.lon,
    geometry.coordinates[1],
    geometry.coordinates[0]
  ) <= 7).length;
}

const accepted = Object.freeze({
  pecos: Object.freeze({ inventory: 67, watched: 46, rendered: 21 }),
  cienegasTerrace: Object.freeze({ inventory: 47, watched: 19, rendered: 4 }),
  bigLake: Object.freeze({ inventory: 22, watched: 21, rendered: 3 }),
  stanton: Object.freeze({ inventory: 12, watched: 12, rendered: 1 }),
  floydada: Object.freeze({ inventory: 1, watched: 1, rendered: 1 }),
  activeEmpty: Object.freeze({ countyId: 'tyler-tx', inventory: 0, watched: 0, rendered: 0 })
});

test('LP201 authority deterministically closes the original Pecos and Cienegas failures', () => {
  assert.deepEqual({ inventory: inventory('reeves').length, watched: lp201Watched('reeves', '4873493') }, { inventory: 67, watched: 46 });
  assert.deepEqual({ inventory: inventory('val-verde').length, watched: lp201Watched('val-verde', '4814927') }, { inventory: 47, watched: 19 });
  assert.equal(accepted.pecos.watched, 46);
  assert.equal(accepted.cienegasTerrace.watched, 19);
  assert.notEqual(accepted.pecos.watched, accepted.pecos.inventory);
  assert.notEqual(accepted.pecos.watched, accepted.pecos.rendered);
});

test('live positive controls preserve watched, viewport, and rendered separation', () => {
  assert.deepEqual(accepted.bigLake, { inventory: 22, watched: 21, rendered: 3 });
  assert.deepEqual(accepted.stanton, { inventory: 12, watched: 12, rendered: 1 });
  assert.ok(accepted.bigLake.rendered < accepted.bigLake.watched);
  assert.ok(accepted.stanton.rendered < accepted.stanton.watched);
});

test('Floydada follows current authority and is not the zero control', () => {
  assert.deepEqual({ inventory: inventory('floyd').length, watched: lp201Watched('floyd', '4826268') }, { inventory: 1, watched: 1 });
  assert.deepEqual(accepted.floydada, { inventory: 1, watched: 1, rendered: 1 });
  assert.notEqual(accepted.floydada, accepted.activeEmpty);
  assert.deepEqual(accepted.activeEmpty, { countyId: 'tyler-tx', inventory: 0, watched: 0, rendered: 0 });
});

test('geography parsing, county qualification, and bridge behavior remain fail-closed', () => {
  assert.match(app, /function gridlyParseOptionalGeographicCoordinate/);
  assert.match(app, /value === null \|\| value === undefined \|\| value === ""/);
  assert.match(app, /selectorCountyId === countyId/);
  assert.match(app, /governedMatches\[0\]\.countyMemberships\.includes\(countyFips\)/);
  const bridge = app.slice(app.indexOf('function gridlyResolveCrossingSelectorCanonicalGeography'), app.indexOf('function summarizeGridlyAwarenessIntelligenceForDisplay'));
  assert.match(bridge, /coordinateParseStatus:[^\n]+"valid" : "missing_or_invalid"/);
  for (const fallback of ['map.getCenter', 'crossingMarkers', 'inventory.length']) assert.doesNotMatch(bridge, new RegExp(fallback.replace('.', '\\.')));
});

test('LP201 presentation authority is consumed read-only and has complete certified coverage', () => {
  assert.equal(Object.keys(presentation).length, 1859);
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(presentationPath)).digest('hex'), presentationHash);
  assert.match(app, /LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1/);
});

test('stale generations, C/J authority, and absence of community special cases remain protected', () => {
  assert.match(app, /requestedGeneration !== gridlyActiveCountyTransitionGeneration/);
  assert.match(app, /gridlyLp196ResolveCanonicalMultiCountyPlaceIdentity/);
  const selector = app.slice(app.indexOf('function getGridlyBottomPanelAwarenessCrossingCount'), app.indexOf('function summarizeGridlyAwarenessIntelligenceForDisplay'));
  for (const specialCase of ['Pecos', 'Cienegas', 'Big Lake', 'Floydada', 'Stanton']) assert.doesNotMatch(selector, new RegExp(specialCase));
  assert.match(selector, /gridlySelectConsumerVisibleCrossings\(selectedArea\)\.length/);
});

test('Family I closure classification is explicit and deterministic', () => {
  const closure = fs.readFileSync('LP218.3-FAMILY-I-LIVE-ACCEPTANCE-AND-CLOSURE.md', 'utf8');
  assert.match(closure, /Family I — CLOSED/);
  assert.match(closure, /FLOYDADA \/ FLOYD COUNTY — CROSSING SOURCE VALIDITY REVIEW/);
  assert.match(closure, /CIENEGAS TERRACE \/ VAL VERDE — ASYNCHRONOUS ACTIVE-ISSUE \/ COMMUNITY-REPORT RECONCILIATION/);
});
