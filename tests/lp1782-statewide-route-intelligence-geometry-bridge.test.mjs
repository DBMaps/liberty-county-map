import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function buildRelevanceRuntime() {
  const geometry = [[30.05, -94.89], [30.60925, -94.94660], [33.36, -95.10]];
  const context = {
    window: { __gridlyMonitoredRouteGeometry: geometry },
    routeWatchActivated: true,
    activeRouteSource: 'destination_preview',
    savedRouteLayer: null,
    getRouteHazardAssessment: () => ({ nearbyReports: [] }),
    recordGridlyRouteWatchGeometryRuntimeShadowCandidate: () => {},
    getDistanceMiles: (lat1, lng1, lat2, lng2) => {
      const dy = (lat2 - lat1) * 69;
      const dx = (lng2 - lng1) * 60;
      return Math.hypot(dx, dy);
    }
  };
  vm.createContext(context);
  vm.runInContext(`${extract('function getRoutePolylineLatLngs()', '\nfunction getHazardCategory(')}\n${extract('function isIncidentRouteRelevant(', '\nfunction getRouteStatusColor(')}\nthis.points = getRoutePolylineLatLngs; this.relevant = isIncidentRouteRelevant;`, context);
  return { context, geometry };
}

test('ready statewide destination geometry is the monitored Route Intelligence path without coordinate changes', () => {
  const { context, geometry } = buildRelevanceRuntime();
  const points = context.points();
  assert.equal(points.length, geometry.length);
  assert.deepEqual(points.map(({ lat, lng }) => [lat, lng]), geometry);
  assert.match(source, /routeSource = activeRouteSource === "destination_preview" \? "destination_preview" : "route_watch"/);
  assert.match(source, /activeRouteSource === "destination_preview" \? "destination_route_preview" : "route_watch_preview"/);
});

test('community and official fixtures share governed route relevance while off-route records remain excluded', () => {
  const { context } = buildRelevanceRuntime();
  const communityNear = { id: 'goodrich-road-closed', type: 'road_closed', lat: 30.60925, lng: -94.94660, source: 'community' };
  const officialNear = { id: 'drivetexas-goodrich', type: 'construction', lat: 30.6093, lng: -94.94655, providerId: 'drivetexas' };
  const communityOffRoute = { id: 'remote-community', type: 'road_closed', lat: 31.5, lng: -97.0, source: 'community' };
  const officialOffRoute = { id: 'remote-official', type: 'construction', lat: 29.5, lng: -96.5, providerId: 'drivetexas' };
  assert.equal(context.relevant(communityNear, { nearbyReports: [] }), true);
  assert.equal(context.relevant(officialNear, { nearbyReports: [] }), true);
  assert.equal(context.relevant(communityOffRoute, { nearbyReports: [] }), false);
  assert.equal(context.relevant(officialOffRoute, { nearbyReports: [] }), false);
});

test('local 80-mile route policy and Awareness filtering are not bypassed', () => {
  assert.match(source, /distance_exceeds_local_preview_limit/);
  assert.match(source, /getDistanceMiles\(startCoords\.lat, startCoords\.lng, destinationCoords\.lat, destinationCoords\.lng\) > 80/);
  assert.doesNotMatch(extract('function startGridlyRouteWatchFromRouteDetails()', '\nfunction bindGridlyVisibleRouteExitControls()'), /startInlineRouteWatch\([^)]*destination/i);
  assert.equal(source.includes('window.__gridlyMonitoredRouteGeometry = destinationGeometry;'), true);
});
