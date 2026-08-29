import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, '').replace(/^\s*\/\/.*$/gm, ''));
const inventory = readJson('Crossing-Packages/val-verde/Production/val-verde-production-crossings.geojson').features;
const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8')).places['4814927'];
const reconciliation = JSON.parse(fs.readFileSync('reports/lp2011/reconciliation.json', 'utf8'));
const promotion = JSON.parse(fs.readFileSync('reports/lp2013/promotion-whatif.json', 'utf8'));
const miles = (a, b, c, d) => { const r = Math.PI / 180, x = (c-a)*r, y = (d-b)*r, q = Math.sin(x/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin(y/2)**2; return 3958.8*2*Math.atan2(Math.sqrt(q), Math.sqrt(1-q)); };

test('populated current inventory publishes watched-area eligibility, not canonical membership or markers', () => {
  const watched = inventory.filter(({ geometry }) => miles(presentation.lat, presentation.lon, geometry.coordinates[1], geometry.coordinates[0]) <= 7);
  assert.equal(inventory.length, 47);
  assert.equal(watched.length, 19);
  const fn = app.slice(app.indexOf('function getGridlyBottomPanelAwarenessCrossingCount'), app.indexOf('let gridlyCrossingSelectorRejoinAuditState'));
  assert.match(fn, /gridlySelectConsumerVisibleCrossings\(selectedArea\)\.length/);
  assert.doesNotMatch(fn, /canonicalMembership|crossingMarkers|renderedMarkerCount/);
});

test('a positive governed recount clears an early empty-inventory diagnostic', () => {
  const fn = app.slice(app.indexOf('function summarizeGridlyAwarenessIntelligenceForDisplay'), app.indexOf('function applyGridlyHomeTownAwarenessContext'));
  assert.match(fn, /crossingsCount > 0\s*\? null/);
  assert.match(app, /syncGridlyAwarenessAreaSurfacesImmediately\("crossing-inventory-committed"/);
});

test('Cienegas coordinate is a promoted governed OSM named-place anchor inside PLACE geometry', () => {
  const row = reconciliation.records.find(entry => entry.canonical?.placeGeoid === '4814927');
  const promoted = promotion.records.find(entry => entry.GEOID === '4814927');
  assert.equal(row.bucket, 'A_HIGH_CONFIDENCE_UNIQUE');
  assert.equal(row.candidates[0].insideCanonicalGeometry, true);
  assert.equal(row.candidates[0].osmId, '151364615');
  assert.deepEqual([presentation.lat, presentation.lon], [29.3674511, -100.9437068]);
  assert.equal(promoted.postPromotionAuthority, 'LP2012_CERTIFIED_NAMED_PLACE_CAMERA');
  assert.equal(promoted.decision, 'PROMOTE_CERTIFIED_NAMED_PLACE_CAMERA');
});

test('Huntsville and genuine ACTIVE_EMPTY contracts remain generic', () => {
  const walker = readJson('Crossing-Packages/walker/Production/walker-production-crossings.geojson').features;
  const tyler = readJson('Crossing-Packages/tyler/Production/tyler-production-crossings.geojson').features;
  assert.ok(walker.length > 0);
  assert.equal(tyler.length, 0);
  const fn = app.slice(app.indexOf('function getGridlyBottomPanelAwarenessCrossingCount'), app.indexOf('let gridlyCrossingSelectorRejoinAuditState'));
  assert.doesNotMatch(fn, /Cienegas|Huntsville|Val Verde|Walker|Tyler/);
});
