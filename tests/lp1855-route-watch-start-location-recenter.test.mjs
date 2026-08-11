import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const extract = (start, end) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.notEqual(from, -1, `${start} exists`);
  assert.notEqual(to, -1, `${end} exists after ${start}`);
  return source.slice(from, to);
};
const focusSource = extract('function focusGridlyRouteWatchStartOnce(', '\nasync function startGridlyRouteWatchFromRouteDetails()');
const startSource = extract('async function startGridlyRouteWatchFromRouteDetails()', '\nfunction bindGridlyVisibleRouteExitControls()');
const visibilitySource = extract('function applyGridlyDestinationVisibilityOffset(', '\nwindow.gridlyDestinationVisibilityAudit');

function runtime({ live = null, sourceCoordinate = { lat: 30.05, lng: -94.89 } } = {}) {
  const geometry = [[29.1, -93.8], [31.7, -95], [33.36, -95.1]];
  const preview = {
    active: true,
    status: 'ready',
    distanceMiles: 250.5,
    source: { label: 'Stored route origin', source: 'current_location', ...sourceCoordinate },
    destination: { id: 'talco', label: 'Talco', lat: 33.36, lng: -95.1 },
    geometry,
    routeProvider: 'osrm'
  };
  const transitions = [];
  const map = {
    getZoom: () => 9,
    setView: (...args) => transitions.push(args),
    fitBounds: () => transitions.push(['fitBounds'])
  };
  const layer = { identity: 'destination preview layer' };
  const context = {
    window: { GridlyDestinationRoutePreview: preview },
    routeWatchActivated: false,
    activeDestinationPlace: null,
    activeRouteOriginLabel: '', activeRouteOriginSource: '', activeRouteDestinationLabel: '', activeRouteSource: '',
    routeGeometrySource: '', routePreviewPolylinePointCount: 0, lastRouteGeometryPointCount: 0,
    routePreviewRendered: false, osrmRouteSuccess: false, destinationRoutePreviewLayer: layer,
    gridlyRouteViewportOwnershipState: {
      routeWatchActivationFocusApplied: false, routeWatchActivationFocusSource: '',
      routeWatchActivationFocusZoom: null, routeWatchActivationFocusCount: 0
    },
    normalizeCoordinatePair: (lat, lng) => lat != null && lng != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
      ? { lat: Number(lat), lng: Number(lng) } : null,
    getGridlyCurrentLocationRouteCoordinate: () => live,
    getGridlyFirstRouteGeometryCoordinate: (value) => ({ lat: value.geometry[0][0], lng: value.geometry[0][1] }),
    getGridlyMapInstance: () => map,
    getGridlyDestinationRoutePreviewState: () => preview,
    formatGridlyRouteOriginLabel: (label) => label,
    gridlyFriendlyPlaceLabel: (place) => place.label,
    safeText() {}, updateGridlyRouteOwnershipSurface() {}, updateRouteIntelligence() {},
    syncRouteQuickPanelUiState() {}, syncGridlyVisibleRouteExitControls() {}, setConfirmation() {},
    renderGridlyDestinationImpactPane() {},
    startInlineRouteWatch: async () => ({ success: true })
  };
  vm.createContext(context);
  vm.runInContext(`${focusSource}\n${startSource}\nthis.start = startGridlyRouteWatchFromRouteDetails;`, context);
  return { context, preview, geometry, transitions, layer };
}

test('ready statewide preview activates directly and retains its exact geometry and layer', async () => {
  const state = runtime({ live: { lat: 30.2, lng: -94.7 } });
  const inlineBefore = state.context.startInlineRouteWatch;
  let inlineCalls = 0;
  state.context.startInlineRouteWatch = async () => { inlineCalls += 1; return inlineBefore(); };
  const result = await state.context.start();
  assert.equal(result.source, 'destination_route_preview');
  assert.equal(inlineCalls, 0, '250+ mile preview bypasses local saved-place Route Watch');
  assert.equal(state.context.window.__gridlyMonitoredRouteGeometry, state.geometry);
  assert.equal(state.context.destinationRoutePreviewLayer, state.layer);
  assert.equal(state.preview.geometry, state.geometry);
});

test('live current location wins and activation preserves zoom with exactly one setView', async () => {
  const state = runtime({ live: { lat: 30.22, lng: -94.77 } });
  await state.context.start();
  assert.deepEqual(JSON.parse(JSON.stringify(state.transitions)), [[[30.22, -94.77], 9, { animate: false }]]);
  assert.equal(state.context.gridlyRouteViewportOwnershipState.routeWatchActivationFocusSource, 'current_location');
  assert.equal(state.context.gridlyRouteViewportOwnershipState.routeWatchActivationFocusZoom, 9);
  assert.equal(state.context.gridlyRouteViewportOwnershipState.routeWatchActivationFocusCount, 1);
});

test('stored destination-preview origin wins over defensive geometry fallback', async () => {
  const state = runtime();
  await state.context.start();
  assert.deepEqual(Array.from(state.transitions[0][0]), [30.05, -94.89]);
  assert.equal(state.context.gridlyRouteViewportOwnershipState.routeWatchActivationFocusSource, 'destination_preview_source');
});

test('first geometry coordinate is only a defensive fallback when canonical sources are absent', async () => {
  const state = runtime({ sourceCoordinate: { lat: null, lng: null } });
  await state.context.start();
  assert.deepEqual(Array.from(state.transitions[0][0]), [29.1, -93.8]);
  assert.equal(state.context.gridlyRouteViewportOwnershipState.routeWatchActivationFocusSource, 'route_geometry_fallback');
});

test('activation does not fit the route or install continuous location following', async () => {
  const state = runtime({ live: { lat: 30.2, lng: -94.7 } });
  await state.context.start();
  assert.equal(state.transitions.some(([name]) => name === 'fitBounds'), false);
  assert.doesNotMatch(focusSource, /watchPosition|on\(["']location|moveend|setInterval|fitBounds/);
  assert.equal((startSource.match(/focusGridlyRouteWatchStartOnce\(destinationPreview\)/g) || []).length, 1);
});

test('active destination-preview Route Watch blocks queued destination visibility camera recovery only after activation', () => {
  assert.match(visibilitySource, /routeWatchActivated && activeRouteSource === "destination_preview"/);
  assert.match(visibilitySource, /lastReason = "route_watch_activation_owns_viewport";\s*return false;/);
  assert.ok(visibilitySource.indexOf('routeWatchActivated && activeRouteSource') < visibilitySource.indexOf('mapInstance.setView'));
  assert.doesNotMatch(visibilitySource.slice(0, visibilitySource.indexOf('if (routeWatchActivated')), /return false/,
    'destination visibility remains enabled before Route Watch owns the viewport');
});

test('explicit Show Full Route and stop controls retain their established handlers', () => {
  assert.match(source, /fitGridlyFullRouteForUserAction\("route_details_show_full_route"\)/);
  assert.match(source, /stopGridlyRouteWatch\("route_details_stop_watch"\)/);
  assert.match(source, /gridlyDestinationImpactManageRouteBtn[\s\S]{0,160}startGridlyRouteWatchFromRouteDetails\(\)/);
});

test('LP178 geometry bridge and LP185.4 incident presentation remain untouched by activation focus', () => {
  assert.match(startSource, /window\.__gridlyMonitoredRouteGeometry = destinationGeometry/);
  assert.doesNotMatch(startSource, /slice\(|structuredClone|JSON\.parse|drawGridlyDestinationRoutePreviewLine|clearGridlyDestinationRoutePreview/);
  assert.doesNotMatch(focusSource, /incident|hazard|report|destinationRoutePreviewLayer/);
});
