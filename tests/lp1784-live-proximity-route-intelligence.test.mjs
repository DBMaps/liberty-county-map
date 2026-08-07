import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function runtime() {
  const route = [[30.0, -95.0], [30.61, -94.947], [33.3, -95.1]];
  const context = {
    routeWatchActivated: true,
    incidents: [],
    userLocation: { lat: 30.0, lng: -95.0 },
    window: {},
    getRouteHazardAssessment() { return { nearbyReports: [] }; },
    isIncidentRouteRelevant(incident) { return incident.onRoute === true; },
    getGridlyAwarenessIntelligenceRecordCoordinate() { return null; },
    getGridlyIncidentCoordinate(record) { return Number.isFinite(record.lat) ? { lat: record.lat, lng: record.lng } : null; },
    getDistanceMiles(a, b, c, d) { return Math.hypot((c - a) * 69, (d - b) * 60); },
    route
  };
  vm.createContext(context);
  vm.runInContext(`function getRouteIntelligenceSourceIncidents(){return incidents}
function getGridlyActiveAwarenessUserLocationAnchor(){return userLocation}
${extract('const GRIDLY_ACTIVE_AWARENESS_PROXIMITY_THRESHOLDS_MILES', '\nfunction getGridlyLightweightActivePriorityScore')}
${extract('function getLiveProximityRouteIntelligenceIncidents(', '\nconst GRIDLY_ROAD_CLUSTER_PREVIOUS')}
this.evaluate=getLiveProximityRouteIntelligenceIncidents`, context);
  return context;
}

test('far, approaching, near, off-route, cleared, and stopped states use governed proximity', () => {
  const app = runtime();
  const hazard = { id: 'community-road', type: 'road_closed', status: 'active', onRoute: true, lat: 30.61, lng: -94.947 };
  app.incidents = [hazard];
  assert.equal(app.evaluate().length, 0, 'far-ahead route hazard remains calm');
  app.userLocation = { lat: 30.63, lng: -94.947 };
  assert.equal(app.evaluate().length, 1, 'approaching inside existing 3-mile band re-evaluates');
  app.userLocation = { lat: hazard.lat, lng: hazard.lng };
  assert.equal(app.evaluate()[0].gridlyLiveProximity.band, 'very_near_user');
  app.incidents = [{ ...hazard, onRoute: false }];
  assert.equal(app.evaluate().length, 0, 'off-route remains excluded even at the user position');
  app.incidents = [{ ...hazard, status: 'cleared' }];
  assert.equal(app.evaluate().length, 0, 'cleared records never produce an active warning');
  app.incidents = [hazard];
  app.routeWatchActivated = false;
  assert.equal(app.evaluate().length, 0, 'stopping Route Watch removes remote route-only intelligence');
});

test('runtime propagation updates consumer, audit, freshness, and confidence from one source set', () => {
  const setter = extract('function setGridlyUserLocation(', '\nfunction renderUserLocationDot(');
  assert.match(setter, /updateRouteIntelligence\(\)/);
  assert.match(setter, /renderGridlyDestinationImpactPane\(\)/);
  assert.match(setter, /gridlyDestinationRouteIntelligenceCache = null/);
  assert.match(extract('function updateRouteIntelligence(', '\nfunction updateMobileTopCommuteCta('), /getLiveProximityRouteIntelligenceIncidents\(\)/);
  assert.match(extract('function buildGridlyRouteIntelligenceAuditSnapshot(', '\nfunction getGridlyRouteIntelligenceZeroReason('), /live_proximity_route_incidents/);
  assert.match(extract('window.gridlyFreshnessAudit', '\n\nwindow.gridlyConfidenceAudit'), /getLiveProximityRouteIntelligenceIncidents\(\)/);
  assert.match(extract('window.gridlyConfidenceAudit', '\n\nwindow.gridlyRouteConfidenceAudit'), /getLiveProximityRouteIntelligenceIncidents\(\)/);
});

test('destination source bridge preserves local Awareness and official compatibility', () => {
  const destination = extract('function buildGridlyDestinationRouteIntelligenceAudit(', '\nwindow.gridlyDestinationRouteIntelligenceAudit');
  assert.match(destination, /liveProximityHazards/);
  assert.match(destination, /corridorMatchedHazards/);
  const loader = extract('async function loadSharedReports(', '\nfunction gridlyGetReportRefreshVerificationSnapshot(');
  assert.match(loader, /countyVisibleNormalized = sourceVisibleNormalized\.filter/);
  assert.match(loader, /routeWatchSourceHazards = gridlyFilterRoadHazardsByLatestLifecycle/);
  const unified = extract('function getUnifiedIncidents()', '\nfunction getActiveUnifiedIncidents()');
  assert.match(unified, /futureTxdotIncidents\(\)/);
  assert.match(unified, /futureTxdotConstruction\(\)/);
});

test('current route origin remains separate from live position', () => {
  const setter = extract('function setGridlyUserLocation(', '\nfunction renderUserLocationDot(');
  assert.doesNotMatch(setter, /activeRouteOriginCoordinate\s*=/);
  assert.match(source, /source: "current_location"/);
  assert.match(source, /suppressRouteOriginRefresh/);
});
