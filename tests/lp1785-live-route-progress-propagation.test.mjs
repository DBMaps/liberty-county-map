import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const extract = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

function positionRuntime() {
  let success;
  const calls = [];
  const context = {
    routeWatchActivated: true,
    gridlyRouteWatchPositionWatchId: null,
    gridlyRouteWatchPositionUpdatedAt: null,
    userLocation: { lat: 30.13078, lng: -94.9318 },
    window: {},
    navigator: { geolocation: {
      watchPosition(callback) { success = callback; return 41; },
      clearWatch(id) { calls.push(['clearWatch', id]); }
    } },
    renderUserLocationDot() {},
    updateGridlyRouteOwnershipSurface() {},
    getGridlyDestinationLocationRecoveryContext() { return null; },
    maybeTriggerGridlyDestinationLocationRecovery() { return false; },
    scheduleGridlyDestinationRoutePreviewOriginRefresh(reason) { calls.push(['originRefresh', reason]); },
    updateRouteIntelligence() { calls.push(['intelligence']); },
    renderGridlyDestinationImpactPane() { calls.push(['destination']); },
    gridlyDestinationRouteIntelligenceCache: {},
    gridlyDestinationRouteImpactCache: {},
    Date,
    Object
  };
  vm.createContext(context);
  vm.runInContext(`${extract('function getValidGridlyUserLocationCoordinates(', '\nfunction renderUserLocationDot(')}
this.start = startGridlyRouteWatchPositionUpdates;
this.stop = stopGridlyRouteWatchPositionUpdates;`, context);
  return { context, calls, move: (lat, lng) => success({ coords: { latitude: lat, longitude: lng } }) };
}

test('Route Watch geolocation advances independently without rebuilding the route', () => {
  const app = positionRuntime();
  const routeOrigin = Object.freeze({ lat: 30.13078, lng: -94.9318, source: 'current_location' });
  const routeGeometry = JSON.stringify([[30.13078, -94.9318], [30.60945745865, -94.9475169181824], [33.36, -95.1]]);
  const selectedRouteId = 'destination-preview:talco';

  assert.equal(app.context.start(), 41);
  app.move(30.55, -94.945);
  assert.deepEqual({ ...app.context.window.__gridlyRouteWatchCurrentLocation }, { lat: 30.55, lng: -94.945 });
  app.move(30.60945745865, -94.9475169181824);
  assert.deepEqual({ ...app.context.window.__gridlyRouteWatchCurrentLocation }, { lat: 30.60945745865, lng: -94.9475169181824 });
  assert.deepEqual(routeOrigin, { lat: 30.13078, lng: -94.9318, source: 'current_location' });
  assert.equal(routeGeometry, JSON.stringify([[30.13078, -94.9318], [30.60945745865, -94.9475169181824], [33.36, -95.1]]));
  assert.equal(selectedRouteId, 'destination-preview:talco');
  assert.equal(app.calls.some(([name]) => name === 'originRefresh'), false);
  assert.ok(app.calls.some(([name]) => name === 'intelligence'));
  assert.ok(app.calls.some(([name]) => name === 'destination'));
});

test('Route Watch owns and stops its single geolocation subscription', () => {
  const app = positionRuntime();
  assert.equal(app.context.start(), 41);
  assert.equal(app.context.start(), 41, 'a second consumer render must not duplicate the watch');
  app.context.stop();
  assert.deepEqual(app.calls.at(-1), ['clearWatch', 41]);
  assert.equal(app.context.window.__gridlyRouteWatchCurrentLocation, null);
});

test('consumer and audits share live proximity while local Awareness and official inputs remain isolated', () => {
  const watcher = extract('function startGridlyRouteWatchPositionUpdates(', '\nfunction renderUserLocationDot(');
  assert.match(watcher, /watchPosition/);
  assert.match(watcher, /suppressRouteOriginRefresh: true/);
  const proximity = extract('function getLiveProximityRouteIntelligenceIncidents(', '\nconst GRIDLY_ROAD_CLUSTER_PREVIOUS');
  assert.match(proximity, /getRouteIntelligenceSourceIncidents\(\)/);
  assert.match(proximity, /isIncidentRouteRelevant/);
  assert.match(extract('function updateRouteIntelligence(', '\nfunction updateMobileTopCommuteCta('), /getLiveProximityRouteIntelligenceIncidents\(\)/);
  assert.match(extract('window.gridlyFreshnessAudit', '\n\nwindow.gridlyConfidenceAudit'), /getLiveProximityRouteIntelligenceIncidents\(\)/);
  assert.match(extract('window.gridlyConfidenceAudit', '\n\nwindow.gridlyRouteConfidenceAudit'), /getLiveProximityRouteIntelligenceIncidents\(\)/);
  assert.match(extract('function getUnifiedIncidents()', '\nfunction getActiveUnifiedIncidents()'), /futureTxdotIncidents\(\)/);
  assert.doesNotMatch(watcher, /gridlySetAwarenessArea|localStorage|activeRouteOrigin/);
});

test('cleared, off-route, and stopped guards remain in the canonical proximity path', () => {
  const proximity = extract('function getLiveProximityRouteIntelligenceIncidents(', '\nconst GRIDLY_ROAD_CLUSTER_PREVIOUS');
  assert.match(proximity, /if \(!routeWatchActivated\) return \[\]/);
  assert.match(proximity, /status \|\| ""\)\.toLowerCase\(\) === "active"/);
  assert.match(proximity, /isIncidentRouteRelevant/);
  const stop = extract('function stopGridlyRouteWatch(', '\nfunction clearGridlyRoute(');
  assert.match(stop, /stopGridlyRouteWatchPositionUpdates\(\)/);
});
