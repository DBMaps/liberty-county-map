import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

const app = fs.readFileSync('js/app.js', 'utf8');
const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8'));
const communities = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json', 'utf8'));
const inventory = JSON.parse(fs.readFileSync('Crossing-Packages/val-verde/Production/val-verde-production-crossings.geojson', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('Crossing-Packages/val-verde/package-manifest.json', 'utf8'));

const placeGeoid = '4809656';
const point = presentation.places[placeGeoid];
const boxCanyon = communities.communities.find((place) => place.placeGeoid === placeGeoid);

function distanceMiles(lat1, lng1, lat2, lng2) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(a));
}

test('Box Canyon identity resolves through the statewide governed presentation authority', () => {
  assert.deepEqual(boxCanyon, {
    placeGeoid,
    displayName: 'Box Canyon',
    governedType: 'CENSUS_DESIGNATED_PLACE',
    consumerEligible: true,
    countyMemberships: ['48465']
  });
  assert.deepEqual(point, { lat: 29.5335121, lon: -101.15861 });
  assert.match(app, /GRIDLY_CANONICAL_PLACE_FOCUS_AUTHORITY = "LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1"/);
});

test('crossing consumer rejoins every canonical PLACE to governed presentation geography', () => {
  const bridge = app.slice(app.indexOf('function gridlyProjectAwarenessAreaForGeographicConsumer'), app.indexOf('function gridlySelectConsumerVisibleCrossings'));
  const selectorStart = app.indexOf('function gridlySelectConsumerVisibleCrossings');
  const selector = app.slice(selectorStart, app.indexOf('gridlySelectConsumerVisibleCrossings.__gridlyConsumerCountOwner', selectorStart));
  assert.match(bridge, /resolveGridlyCanonicalPlacePresentationFocus\(awarenessArea\)/);
  assert.match(bridge, /radiusMiles: canonicalFocus\.radiusMiles/);
  assert.doesNotMatch(bridge, /Box Canyon|4809656|29\.5335121|-101\.15861/);
  assert.match(selector, /gridlyProjectAwarenessAreaForGeographicConsumer\(awarenessArea\)/);
});

test('Val Verde is active-positive and Box Canyon truthfully watches one public crossing in seven miles', () => {
  assert.equal(manifest.crossingCount, 47);
  assert.equal(inventory.features.length, 47);
  const inRadius = inventory.features.filter(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    return distanceMiles(point.lat, point.lon, lat, lng) <= 7;
  });
  const governedVisible = inRadius.filter(feature => feature.properties.TYPEXING === 'Public');
  assert.equal(inRadius.length, 6);
  assert.deepEqual(governedVisible.map(feature => feature.properties.CROSSING), ['924451G']);
});

test('crossing audit exposes the governed presentation coordinate at its authority boundary', () => {
  const audit = app.slice(app.indexOf('window.gridlyCrossingRenderAudit ='), app.indexOf('function getGridlyHomeTownCrossingCount'));
  assert.match(audit, /presentationCoordinate: canonicalFocus \? \{ lat: canonicalFocus\.lat, lng: canonicalFocus\.lng, authority: canonicalFocus\.authority \} : null/);
});
