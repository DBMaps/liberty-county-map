import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function relevanceRuntime() {
  const geometry = [[30.05, -94.89], [30.60925, -94.94660], [33.36, -95.10]];
  const context = {
    window: { __gridlyMonitoredRouteGeometry: geometry }, routeWatchActivated: true,
    activeRouteSource: 'destination_preview', savedRouteLayer: null,
    getRouteHazardAssessment: () => ({ nearbyReports: [] }), recordGridlyRouteWatchGeometryRuntimeShadowCandidate: () => {},
    getDistanceMiles: (a, b, c, d) => Math.hypot((c - a) * 69, (d - b) * 60)
  };
  vm.createContext(context);
  vm.runInContext(`${extract('function getRoutePolylineLatLngs()', '\nfunction getHazardCategory(')}\n${extract('function isIncidentRouteRelevant(', '\nfunction getRouteStatusColor(')}\nthis.points=getRoutePolylineLatLngs;this.relevant=isIncidentRouteRelevant`, context);
  return context;
}

test('governed monitored geometry is sufficient when no legacy map layer exists', () => {
  const runtime = relevanceRuntime();
  assert.equal(runtime.window.__gridlyRoutePreviewLayer, undefined);
  assert.equal(runtime.points().length, 3);
  assert.match(extract('function getGridlyRouteIntelligenceZeroReason(', '\nfunction safeApplyRouteIntelligenceAfterRouteRender('), /governedRouteGeometryAvailable/);
  assert.doesNotMatch(extract('function getGridlyRouteIntelligenceZeroReason(', '\nfunction safeApplyRouteIntelligenceAfterRouteRender('), /route_layer_not_on_map/);
});

test('Dayton local collections remain county-filtered while route source remains available', () => {
  const loader = extract('async function loadSharedReports(', '\nfunction gridlyGetReportRefreshVerificationSnapshot(');
  assert.match(loader, /sourceVisibleNormalized = normalized\.filter/);
  assert.match(loader, /countyVisibleNormalized = sourceVisibleNormalized\.filter/);
  assert.match(loader, /visibleNormalized = countyVisibleNormalized/);
  assert.match(loader, /routeWatchSourceHazards = gridlyFilterRoadHazardsByLatestLifecycle\(routeSourceHazards/);
});

test('route-near community and truthful official fixtures share the unchanged 0.8-mile policy', () => {
  const runtime = relevanceRuntime();
  const communityNear = { type: 'road_closed', lat: 30.60925, lng: -94.94660 };
  const officialNear = { type: 'construction', lat: 30.6093, lng: -94.94655, providerId: 'drivetexas' };
  const remoteOffRoute = { type: 'road_closed', lat: 31.5, lng: -97.0 };
  const officialOffRoute = { type: 'construction', lat: 29.5, lng: -96.5, providerId: 'drivetexas' };
  assert.equal(runtime.relevant(communityNear, { nearbyReports: [] }), true);
  assert.equal(runtime.relevant(officialNear, { nearbyReports: [] }), true);
  assert.equal(runtime.relevant(remoteOffRoute, { nearbyReports: [] }), false);
  assert.equal(runtime.relevant(officialOffRoute, { nearbyReports: [] }), false);
  assert.match(extract('function isIncidentRouteRelevant(', '\nfunction getRouteStatusColor('), /const thresholdMiles = 0\.8/);
});

test('cleared route records cannot re-enter active route intelligence', () => {
  const loader = extract('async function loadSharedReports(', '\nfunction gridlyGetReportRefreshVerificationSnapshot(');
  assert.match(loader, /routeWatchSourceHazards = gridlyFilterRoadHazardsByLatestLifecycle/);
  assert.doesNotMatch(extract('function getRouteWatchCommunitySourceIncidents()', '\nconst GRIDLY_ROAD_CLUSTER_PREVIOUS'), /recentlyClearedRoadHazards/);
});

test('local route policy and official provider ingestion remain unchanged', () => {
  assert.match(source, /distance_exceeds_local_preview_limit/);
  assert.match(source, /getDistanceMiles\(startCoords\.lat, startCoords\.lng, destinationCoords\.lat, destinationCoords\.lng\) > 80/);
  const unified = extract('function getUnifiedIncidents()', '\nfunction getActiveUnifiedIncidents()');
  assert.match(unified, /futureTxdotIncidents\(\)/);
  assert.match(unified, /futureTxdotConstruction\(\)/);
});
