import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const functionStart = appSource.indexOf('async function startGridlyRouteWatchFromRouteDetails() {');
const functionEnd = appSource.indexOf('\nfunction bindGridlyVisibleRouteExitControls()', functionStart);
assert.notEqual(functionStart, -1, 'route-details Route Watch handler exists');
assert.notEqual(functionEnd, -1, 'route-details Route Watch handler boundary exists');
const startFunctionSource = appSource.slice(functionStart, functionEnd);

function createRuntime(preview) {
  const calls = [];
  const context = {
    window: { GridlyDestinationRoutePreview: preview },
    routeWatchActivated: false,
    activeDestinationPlace: null,
    activeRouteOriginLabel: '',
    activeRouteOriginSource: '',
    activeRouteDestinationLabel: '',
    activeRouteSource: '',
    getGridlyDestinationRoutePreviewState: () => preview,
    formatGridlyRouteOriginLabel: (label) => label,
    gridlyFriendlyPlaceLabel: (place) => place.label,
    safeText: (id, value) => calls.push(['text', id, value]),
    updateGridlyRouteOwnershipSurface: () => calls.push(['ownership']),
    updateRouteIntelligence: () => calls.push(['intelligence']),
    syncRouteQuickPanelUiState: () => calls.push(['quick-panel']),
    syncGridlyVisibleRouteExitControls: () => calls.push(['exit-controls']),
    setConfirmation: (message, tone) => calls.push(['confirmation', message, tone]),
    renderGridlyDestinationImpactPane: () => calls.push(['impact-pane']),
    startInlineRouteWatch: async (options) => {
      calls.push(['inline', options]);
      return { success: true, activateWatch: true, source: 'saved_places' };
    }
  };
  vm.createContext(context);
  vm.runInContext(`${startFunctionSource}\nthis.start = startGridlyRouteWatchFromRouteDetails;`, context);
  return { context, calls };
}

test('Destination Intelligence starts Route Watch from an existing 250-mile statewide route', async () => {
  const preview = {
    status: 'ready',
    distanceMiles: 250.5,
    source: { label: 'Current Location', source: 'current_location', lat: 30.05, lng: -94.89 },
    destination: { id: 'talco-city-hall', label: 'Talco City Hall', lat: 33.36, lng: -95.10 },
    geometry: [[30.05, -94.89], [31.7, -95.0], [33.36, -95.10]]
  };
  const { context, calls } = createRuntime(preview);

  const result = await context.start();

  assert.deepEqual({ ...result }, { success: true, activateWatch: true, source: 'destination_route_preview', routePointCount: 3 });
  assert.equal(context.routeWatchActivated, true);
  assert.equal(context.window.__gridlyRouteWatchActive, true);
  assert.equal(context.activeDestinationPlace.label, 'Talco City Hall');
  assert.equal(calls.some(([name]) => name === 'inline'), false, 'does not rebuild the valid statewide route through the local saved-place path');
  assert.equal(calls.some(([name, message, tone]) => name === 'confirmation' && /Route Watch active/.test(message) && tone === 'success'), true);
  assert.equal(calls.some(([name]) => name === 'impact-pane'), true);
});

test('existing local saved-place Route Watch fallback remains unchanged', async () => {
  const { context, calls } = createRuntime({ status: 'idle', geometry: [] });

  const result = await context.start();

  assert.equal(result.success, true);
  assert.equal(calls.some(([name, options]) => name === 'inline' && options.activateWatch === true && options.source === 'route_details_start_watch'), true);
  assert.equal(calls.some(([name]) => name === 'quick-panel'), true);
  assert.equal(calls.some(([name]) => name === 'exit-controls'), true);
  assert.equal(calls.some(([name]) => name === 'impact-pane'), true);
});

test('Destination Intelligence Start Route Watch button remains bound to the route-details handler', () => {
  assert.match(appSource, /bindButton\("gridlyDestinationImpactManageRouteBtn", \(\) => \{\s*startGridlyRouteWatchFromRouteDetails\(\);\s*\}\);/);
});
