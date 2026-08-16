import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const presentations = JSON.parse(fs.readFileSync(new URL('../data/generated/gridly-statewide-place-presentation-v1.json', import.meta.url), 'utf8')).places;
const counties = JSON.parse(fs.readFileSync(new URL('../assets/location-resolution/gridly-authoritative-county-geometry-v1.json', import.meta.url), 'utf8')).counties;

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function geometryContains(point, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point, hole)));
}

function countyAt(lat, lng) {
  return counties.find((county) => lat >= county.bounds.south && lat <= county.bounds.north && lng >= county.bounds.west && lng <= county.bounds.east && geometryContains([lng, lat], county.geometry))?.countyId;
}

test('County pill resolves current presentation before changing filter or rendering geometry', () => {
  const pill = app.slice(app.indexOf('const applyGeoFilterFromPill ='), app.indexOf('const routeWatchLogByFilter'));
  assert.match(pill, /selectedFilter === "county"/);
  assert.match(pill, /gridlyResolveCountyModeActiveContext\(\)/);
  assert.match(pill, /preservePersistedAwareness: true/);
  assert.ok(pill.indexOf('gridlyResolveCountyModeActiveContext()') < pill.indexOf('activeGeoFilter = selectedFilter'));
});

test('County authority is explicit countywide then authoritative presentation coordinate, never persisted home', () => {
  const resolver = app.slice(app.indexOf('function gridlyResolveCountyModeActiveContext'), app.indexOf('function gridlyGetCoordinateScopedReportMetadata'));
  assert.match(resolver, /semanticLevel === "COUNTYWIDE"/);
  assert.match(resolver, /gridlyResolveCountyIdForCoordinate\(lat, lng\)/);
  assert.match(resolver, /"active-presentation-coordinate"/);
  assert.match(resolver, /"current-coordinate-containment"/);
  assert.doesNotMatch(resolver, /settingsHomeTown|profileHomeTown|awarenessAreaKey/);
});

test('canonical PLACE camera transaction carries ephemeral identity without manufacturing primary county', () => {
  assert.match(app, /gridlyActiveGeographicPresentation = Object\.freeze\(\{ semanticLevel: "PLACE", placeGeoid, placeLabel:[^\n]+explicitCountyId: null \}\)/);
  assert.match(app, /"4819000": Object\.freeze\(\{ lat: 32\.78294501748632, lng: -96\.79538726806642/);
  assert.match(app, /stalePersistedContextIgnored: Boolean\(persistedAwarenessCountyId && persistedAwarenessCountyId !== resolvedCountyId\)/);
});

test('overlay lifecycle and owner diagnostic expose inactive and ownership state', () => {
  for (const field of ['activePlaceGeoid', 'activePlaceLabel', 'activePresentationLat', 'activePresentationLng', 'countyResolutionSource', 'resolvedCountyId', 'persistedAwarenessCountyId', 'stalePersistedContextIgnored', 'polygonCurrentlyOnMap', 'firstFailedStage']) {
    assert.match(app, new RegExp(`\\b${field}\\b`));
  }
  assert.match(app, /overlayState: polygonCurrentlyOnMap \? "active" : "inactive-removed"/);
  assert.match(app, /activeGeoFilter !== "county" \? "county-overlay-inactive"/);
});

test('Area re-entry and transitions retain the current presentation rather than persisted Home', () => {
  const reissue = app.slice(app.indexOf('function gridlyReissueActiveAreaPresentation'), app.indexOf('function gridlyApplyZeroCrossingViewportContract'));
  assert.match(reissue, /const currentPresentation = gridlyActiveGeographicPresentation/);
  assert.ok(reissue.indexOf('currentPresentation') < reissue.indexOf('getGridlyHomeTownAwarenessAnchor'));
  const town = app.slice(app.indexOf('if (activeGeoFilter === "town")', app.indexOf('function getVisibleCrossingsForFilter')), app.indexOf('if (activeGeoFilter === "nearby")', app.indexOf('function getVisibleCrossingsForFilter')));
  assert.match(town, /const presentation = gridlyActiveGeographicPresentation/);
});

test('representative multi- and single-county PLACE cameras resolve by current coordinate', () => {
  const controls = {
    '4805000': 'travis-tx',       // Austin
    '4819000': 'dallas-tx',       // Dallas
    '4827000': 'tarrant-tx',      // Fort Worth
    '4835000': 'harris-tx',       // Houston
    '4817000': 'nueces-tx',       // Corpus Christi
    '4876000': 'mclennan-tx',     // Waco
    '4842568': 'liberty-tx',      // Liberty
    '4824000': 'el-paso-tx',      // El Paso
    '4828068': 'galveston-tx'     // Galveston
  };
  for (const [geoid, expectedCountyId] of Object.entries(controls)) {
    const governed = presentations[geoid];
    const ownerCameraMatch = app.match(new RegExp(`"${geoid}": Object\\.freeze\\(\\{ lat: ([^,]+), lng: ([^,]+),`));
    const lat = ownerCameraMatch ? Number(ownerCameraMatch[1]) : governed.lat;
    const lng = ownerCameraMatch ? Number(ownerCameraMatch[2]) : governed.lon;
    assert.equal(countyAt(lat, lng), expectedCountyId, `${geoid} current presentation county`);
  }
});
