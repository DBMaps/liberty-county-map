import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const source = app.slice(app.indexOf('function gridlyResolvePointIncidentRoadCandidates'), app.indexOf('\nfunction resolveNearbyKnownLocation', app.indexOf('function gridlyResolvePointIncidentRoadCandidates')));
const normalizeCoordinatePair = (lat, lng) => Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;
const normalizeRoadNameCandidate = value => String(value || '').trim();
const titleCaseRoadText = value => value;
const normalizeRoadComparison = value => String(value || '').toLowerCase();
const distancePointToSegmentMiles = (lat, lng, aLat, aLng, bLat, bLng) => {
  const x = (lng - aLng) * Math.cos(lat * Math.PI / 180); const y = lat - aLat;
  const dx = (bLng - aLng) * Math.cos(lat * Math.PI / 180); const dy = bLat - aLat;
  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - t * dx, y - t * dy) * 69.0;
};
const buildHumanLocationContext = ({ primaryRoad = '', crossingRoad = '', nearbyArea = '' } = {}) => ({ primary: primaryRoad, secondary: crossingRoad, phrasing: primaryRoad && crossingRoad ? `${primaryRoad} & ${crossingRoad}` : primaryRoad || nearbyArea, usedFallback: !primaryRoad });
const resolve = Function('normalizeCoordinatePair','normalizeRoadNameCandidate','titleCaseRoadText','normalizeRoadComparison','distancePointToSegmentMiles','buildHumanLocationContext', `${source}; return gridlyResolvePointIncidentRoadCandidates;`)(normalizeCoordinatePair,normalizeRoadNameCandidate,titleCaseRoadText,normalizeRoadComparison,distancePointToSegmentMiles,buildHumanLocationContext);

const point = { lat: 33.1361272318717, lng: -95.6023997068405 };
const ownerRoads = [
  { name: 'Davis Street', classification: 'nearby/intersecting road', coordinates: [[-95.60216,33.1358],[-95.60216,33.1365]] },
  { name: 'Spring Street', classification: 'incident road', coordinates: [[-95.6028,point.lat],[-95.6020,point.lat]] }
];

test('point on road A outranks nearby road B and exposes geometry audit', () => {
  const out = resolve(point, ownerRoads);
  assert.equal(out.primaryRoadCandidate.name, 'Spring Street');
  assert.equal(out.secondaryRoadCandidate.name, 'Davis Street');
  assert.equal(out.primaryRoadCandidate.distanceMeters, 0);
  assert.equal(out.selectionReason, 'point_on_nearest_road_segment');
  assert.equal(out.locationContext.phrasing, 'Spring Street & Davis Street');
  assert.ok(out.roadCandidates[1].distanceMeters > out.roadCandidates[0].distanceMeters);
});

test('intersection ordering is deterministic and does not arbitrarily swap roads', () => {
  const roads = [{ name: 'Zulu Road', coordinates: [[-1,0],[1,0]] }, { name: 'Alpha Road', coordinates: [[0,-1],[0,1]] }];
  const out = resolve({lat:0,lng:0}, roads);
  assert.deepEqual([out.primaryRoadCandidate.name, out.secondaryRoadCandidate.name], ['Alpha Road','Zulu Road']);
});

test('nearby non-containing road cannot outrank incident road', () => {
  const out = resolve({lat:0,lng:0}, [{name:'Nearby',coordinates:[[-1,.0002],[1,.0002]]},{name:'Incident',coordinates:[[-1,0],[1,0]]}]);
  assert.equal(out.primaryRoadCandidate.name, 'Incident');
});

test('community fallback prefers supplied community when geometry is untrustworthy', () => {
  const out = resolve(point, [{name:'Far Road',coordinates:[[-95.61,33.14],[-95.62,33.14]]}], {nearbyArea:'Sulphur Springs'});
  assert.equal(out.primaryRoadCandidate, null);
  assert.equal(out.locationContext.phrasing, 'Sulphur Springs');
});

test('shared lookup remains the single popup and Alerts authority', () => {
  assert.match(app, /resolveGridlyHazardPopupRoadLabel[\s\S]*?getSharedResolvedRoadLookup\(incident\)/);
  assert.match(app, /gridlyProjectAlertIncidentLocation[\s\S]*?getSharedResolvedRoadLookup\(record\)/);
  assert.match(app, /data-gridly-alert-presentation-contract="CONCISE_ALERT_CARD"/);
});
