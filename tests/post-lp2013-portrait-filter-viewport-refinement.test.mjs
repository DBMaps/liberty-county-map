import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync('js/app.js', 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} exists`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const viewportFunctions = [
  'gridlyReissueActiveAreaPresentation',
  'gridlyApplyZeroCrossingViewportContract',
  'fitMapToCrossingsForActiveFilter'
].map(functionSource).join('\n');

function viewportHarness(filter, visible = []) {
  const calls = [];
  const countyBounds = { isValid: () => true, owner: 'mclennan-tx' };
  const context = {
    activeGeoFilter: filter,
    map: {
      setView: (...args) => { calls.push(['setView', ...args]); return true; },
      fitBounds: (...args) => calls.push(['fitBounds', ...args])
    },
    L: { latLngBounds: (points) => ({ isValid: () => true, points }) },
    GRIDLY_COUNTY_STARTUP_ZOOM: 9,
    getGridlyHomeTownAwarenessAnchor: () => ({ placeGeoid: '4876000', countyId: 'mclennan-tx', lat: 31.5, lng: -97.1 }),
    gridlyResolveCanonicalPlaceGeoid: () => '4876000',
    gridlyGetGovernedPlaceConsumerPresentationCamera: () => ({ lat: 31.5491899, lng: -97.1474628, zoom: 13 }),
    gridlyPlacePresentationTargets: null,
    GRIDLY_TOWN_STARTUP_ZOOM: 13,
    gridlyRecordSemanticCameraOperation: (...args) => calls.push(['cameraAudit', ...args]),
    setGridlyAwarenessView: (center, zoom, options) => {
      context.map.setView([center.lat, center.lng], zoom, { animate: options.animate });
      return true;
    },
    gridlyGetCountyBounds: () => countyBounds,
    gridlyGetActiveCountyId: () => 'mclennan-tx',
    getActiveDelayCrossingsForViewport: () => [],
    getFilterFitPadding: () => ({ padding: [1, 2] }),
    getGridlyFilterViewportMaxZoom: () => 13,
    highlightNearestCrossingOnFirstLoad: () => calls.push(['highlight'])
  };
  vm.runInNewContext(`${viewportFunctions}; this.fit = fitMapToCrossingsForActiveFilter`, context);
  context.fit(visible);
  return { calls, countyBounds };
}

test('zero-crossing local filters issue a real map movement to the governed presentation camera', () => {
  for (const filter of ['nearby', 'town', 'all']) {
    const { calls } = viewportHarness(filter);
    const movement = calls.filter(([kind]) => kind === 'setView');
    assert.equal(movement.length, 1, `${filter} performs exactly one real presentation movement`);
    assert.deepEqual(movement[0][1], [31.5491899, -97.1474628]);
    assert.equal(movement[0][2], 13);
    assert.equal(calls.some(([kind]) => kind === 'semanticCamera'), false);
  }
});

test('zero-crossing County uses active county bounds while Delays preserves framing', () => {
  const county = viewportHarness('county');
  assert.equal(county.calls[0][0], 'fitBounds');
  assert.equal(county.calls[0][1], county.countyBounds);
  assert.equal(county.calls.some(([kind]) => kind === 'setView'), false);

  const delays = viewportHarness('active-delays');
  assert.deepEqual(delays.calls, []);
});

test('non-empty supported-county behavior remains crossing-fit owned for every crossing filter', () => {
  const crossing = { id: 'certified-crossing', lat: 30.1, lng: -94.7 };
  for (const filter of ['nearby', 'town', 'all']) {
    const { calls } = viewportHarness(filter, [crossing]);
    assert.equal(calls[0][0], 'fitBounds');
    assert.equal(calls.some(([kind]) => kind === 'setView'), false);
  }
  assert.equal(viewportHarness('county', [crossing]).calls[0][1].owner, 'mclennan-tx');
});

test('consumer messaging distinguishes unavailable crossing coverage from a supported quiet delay set', () => {
  const updateSource = functionSource('updateGeoFilterStatus');
  const run = (inventory) => {
    const context = {
      activeGeoFilter: 'active-delays',
      userLocation: null,
      els: { geoFilterStatus: { textContent: '' } },
      document: { getElementById: () => null },
      gridlyGetActiveCountyCrossingInventory: () => inventory
    };
    vm.runInNewContext(`${updateSource}; this.update = updateGeoFilterStatus`, context);
    context.update([]);
    return context.els.geoFilterStatus.textContent;
  };
  assert.equal(run([]), "Crossing data isn't available for this area yet.");
  assert.equal(run([{ id: 'supported' }]), 'Good news: no active delays in this view.');
});

test('filter owner preserves all canonical states, synchronizes both surfaces, and has no fallback persistence', () => {
  assert.match(source, /activeGeoFilter = selectedFilter;/);
  assert.match(source, /updateGeoFilterStatus\(visibleCrossings\);\s*fitMapToCrossingsForActiveFilter\(visibleCrossings\);/);
  assert.match(source, /pill\.classList\.toggle\("selected", pill\.dataset\.geoFilter === activeGeoFilter\)/);
  assert.match(source, /button\.classList\.toggle\("is-active", button\.dataset\.geoFilter === activeGeoFilter\)/);
  for (const filter of ['nearby', 'town', 'county', 'active-delays', 'all']) assert.match(source, new RegExp(`data-geo-filter="${filter}"`));

  const fallbackSource = functionSource('gridlyReissueActiveAreaPresentation') + functionSource('gridlyApplyZeroCrossingViewportContract');
  assert.doesNotMatch(fallbackSource, /localStorage|sessionStorage|save|route|hazard|report/i);
  assert.doesNotMatch(fallbackSource, /crossings?\.(push|splice)|markers?\.(push|add)/i);
});

test('portrait delays feedback remains on the filter status surface', () => {
  const updateSource = functionSource('updateGeoFilterStatus');
  const visibleStatus = { textContent: '' };
  const context = {
    activeGeoFilter: 'active-delays',
    userLocation: null,
    els: { geoFilterStatus: { textContent: '' } },
    document: { getElementById: (id) => id === 'gridlyV2TopStatusSecondary' ? visibleStatus : null },
    isPortraitMode: () => true,
    gridlyGetActiveCountyCrossingInventory: () => []
  };
  vm.runInNewContext(`${updateSource}; this.update = updateGeoFilterStatus`, context);
  context.update([]);
  assert.equal(context.activeGeoFilter, 'active-delays');
  assert.equal(context.els.geoFilterStatus.textContent, "Crossing data isn't available for this area yet.");
  assert.equal(visibleStatus.textContent, '');
});

test('county bounds fall back to loaded authoritative geometry for statewide counties', () => {
  const getBoundsSource = functionSource('gridlyGetCountyBounds');
  const authoritative = { isValid: () => true, owner: 'authoritative-mclennan' };
  const context = {
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    L: { latLngBounds: () => { throw new Error('legacy bounds must not be invented'); } },
    gridlyGetCountyBoundsMetadata: () => ({ countyId: 'mclennan-tx', rawBounds: null }),
    gridlyGetAuthoritativeCountyGeometryFocusBounds: (countyId) => countyId === 'mclennan-tx' ? authoritative : null
  };
  vm.runInNewContext(`${getBoundsSource}; this.getBounds = gridlyGetCountyBounds`, context);
  assert.equal(context.getBounds('mclennan-tx'), authoritative);
});

test('Waco remains governed by PLACE GEOID camera data and McLennan remains zero-crossing capable only', () => {
  const presentation = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json', 'utf8'));
  assert.deepEqual(
    { lat: presentation.places['4876000'].lat, lon: presentation.places['4876000'].lon },
    { lat: 31.5491899, lon: -97.1474628 }
  );
  assert.match(source, /const GRIDLY_TOWN_STARTUP_ZOOM = 13;/);
  assert.match(source, /"mclennan-tx"[^\n]*crossings: "not-claimed"/);
  assert.doesNotMatch(functionSource('gridlyApplyZeroCrossingViewportContract'), /Waco|mclennan|4876000/);
});
