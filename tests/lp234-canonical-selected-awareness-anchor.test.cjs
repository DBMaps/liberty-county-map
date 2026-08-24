const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const integration = fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8');
const geometry = fs.readFileSync('js/gridlyDriveTexasGeometryAuthority.js', 'utf8');
const presentation = require('../data/generated/gridly-statewide-place-presentation-v1.json');
const AUTHORITY = 'LP201_CERTIFIED_STATEWIDE_PLACE_PRESENTATION_V1';
const katyTarget = presentation.places['4838476'];
const selected = (countyId = 'harris-tx') => ({ key: 'place-4838476', label: 'Katy', countyId, radiusMiles: 7 });
const nowMs = Date.parse('2026-08-24T12:00:00Z');
const activeTime = '2026-08-24T11:00:00Z';

function runtime(resolve = true) {
  const window = {
    resolveGridlyCanonicalPlacePresentationFocus(area) {
      if (!resolve) return null;
      const match = /^place-(48\d{5})$/.exec(String(area?.canonicalKey || area?.key || ''));
      const target = match && presentation.places[match[1]];
      return target ? { canonicalKey: `place-${match[1]}`, lat: target.lat, lng: target.lon, radiusMiles: 7, authority: AUTHORITY } : null;
    }
  };
  const sandbox = { window, globalThis: window, console, Date, Math, Object, Array, Set, Map, JSON };
  vm.createContext(sandbox);
  vm.runInContext(geometry, sandbox);
  vm.runInContext(integration, sandbox);
  return window;
}

const incident = (overrides = {}) => ({ id: '7BA082B4-5CE6-4036-97FA-C4FADBAA3CCF', providerId: 'drivetexas', title: 'Lane Closure on FM0529', routeName: 'FM0529', category: 'Lane Closure', latitude: 29.87412353353783, longitude: -95.91808992841244, updateTime: activeTime, ...overrides });

test('canonical PLACE anchor uses statewide LP201 presentation authority and is membership invariant', () => {
  const w = runtime();
  const results = ['harris-tx', 'fort-bend-tx', 'waller-tx'].map(countyId => w.gridlySelectDriveTexasAuthority({ records: [incident()], selectedAwarenessArea: selected(countyId), nowMs }));
  for (const result of results) {
    assert.deepEqual({ ...result.selectedAwarenessAnchor }, { lat: katyTarget.lat, lng: katyTarget.lon });
    assert.equal(result.selectedAwarenessAnchorAuthority, AUTHORITY);
    assert.equal(result.anchorResolutionPass, true);
    assert.equal(result.recordProof[0].distanceFromSelectedAwarenessMiles, 8.294);
    assert.equal(JSON.stringify(result.records[0].coordinates), JSON.stringify({ latitude: 29.87412353353783, longitude: -95.91808992841244 }));
    assert.equal(result.records[0].sourceProviderRecordId, incident().id);
    assert.equal(result.recordProof[0].finalEligibility, false, 'existing seven-mile predicate excludes the 8.294-mile control');
    assert.equal([...result.recordProof[0].ineligibilityReasons].join(','), 'outside_awareness_radius_miles');
  }
  assert.deepEqual(results.map(r => r.selectedAwarenessAnchor), [results[0].selectedAwarenessAnchor, results[0].selectedAwarenessAnchor, results[0].selectedAwarenessAnchor]);
});

test('canonical coordinate absence fails closed rather than using selected county or embedded/map coordinates', () => {
  const w = runtime(false);
  const area = { ...selected(), lat: 30, lng: -96, center: { lat: 31, lng: -97 }, mapCenter: { lat: 32, lng: -98 }, viewport: { lat: 33, lng: -99 } };
  const result = w.gridlySelectDriveTexasAuthority({ records: [incident()], selectedAwarenessArea: area, nowMs });
  assert.equal(result.anchorResolutionPass, false);
  assert.equal(result.consumerEligibleSituations.length, 0);
  assert.equal([...result.recordProof[0].ineligibilityReasons].join(','), 'missing_selected_awareness_anchor');
  assert.equal(result.recordProof[0].distanceFromSelectedAwarenessMiles, null);
});

test('LP039.2 distance predicate admits only an inside-radius source record without duplication', () => {
  const w = runtime();
  const inside = incident({ id: 'inside', latitude: katyTarget.lat, longitude: katyTarget.lon });
  const outside = incident({ id: 'outside' });
  const result = w.gridlySelectDriveTexasAuthority({ records: [inside, { ...inside }, outside], selectedAwarenessArea: selected(), nowMs });
  assert.deepEqual(result.consumerEligibleSituations.map(row => row.sourceProviderRecordId), ['inside']);
  assert.equal(result.eligibleRecordProof.length, 1);
  assert.equal(result.recordProof.filter(row => Number.isFinite(row.distanceFromSelectedAwarenessMiles)).length, 3);
});

test('production anchor repair contains no Katy/county/map/geolocation branch or provider work', () => {
  const selectedAnchorBody = integration.slice(integration.indexOf('function selectedAnchor'), integration.indexOf('function validSourcePair'));
  assert.doesNotMatch(selectedAnchorBody, /Katy|harris-tx|fort-bend-tx|waller-tx|countyId|mapCenter|viewport|geolocation|navigator|fetch\s*\(|setTimeout|setInterval/);
  assert.match(selectedAnchorBody, /resolveGridlyCanonicalPlacePresentationFocus/);
});
