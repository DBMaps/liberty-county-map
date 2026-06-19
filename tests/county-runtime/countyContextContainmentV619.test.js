const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('function getGridlyHomeTownPreference()');
assert.ok(cutoff > 0, 'county context containment audit is defined before preferences binding');

function makeBounds(sw, ne) {
  return {
    sw,
    ne,
    isValid: () => sw.every(Number.isFinite) && ne.every(Number.isFinite)
  };
}

function loadRuntime(windowOverrides = {}, selectedAwarenessArea = null) {
  const sandbox = {
    console,
    window: { addEventListener: () => {}, removeEventListener: () => {}, setInterval, clearInterval, setTimeout, clearTimeout, matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }), navigator: {}, ...windowOverrides },
    document: { addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => null, querySelectorAll: () => [], documentElement: { style: {} }, body: { classList: { toggle: () => {}, add: () => {}, remove: () => {} } } },
    navigator: {},
    LOCATION_DEFAULTS: { country: 'USA', state: 'Texas', county: 'Liberty County' },
    activeGeoFilter: 'county',
    normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    getGridlySelectedAwarenessArea: () => selectedAwarenessArea,
    __selectedAwarenessArea: selectedAwarenessArea,
    crypto: { randomUUID: () => 'test-uuid' },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    L: { latLngBounds: makeBounds }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}\ngetGridlySelectedAwarenessArea = () => __selectedAwarenessArea || null;\nthis.api = { gridlyGetActiveCountyId, gridlyResolveCountyIdForAwarenessArea, gridlyGetCountyBoundsMetadata, gridlyGetCountyBounds, gridlyCountyContextContainmentAudit };`, sandbox);
  return sandbox.api;
}

const montgomeryRuntime = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' }
);
const montgomeryAudit = montgomeryRuntime.gridlyCountyContextContainmentAudit();
assert.strictEqual(montgomeryAudit.activeCounty, 'montgomery-tx', 'Montgomery remains the active county');
assert.strictEqual(montgomeryAudit.activeTown, 'Conroe', 'Conroe remains the active town context');
assert.strictEqual(montgomeryAudit.countyBoundsSource, 'montgomery-awareness-bounds', 'Montgomery county bounds are Montgomery-owned');
assert.strictEqual(montgomeryAudit.townBoundsSource, 'montgomery-awareness-bounds', 'Conroe town context resolves against Montgomery bounds');
assert.strictEqual(montgomeryAudit.fitBoundsTarget, 'montgomery-tx', 'Fit bounds targets Montgomery, not Liberty');
assert.strictEqual(montgomeryAudit.fallbackUsed, false, 'Montgomery context does not use normalized fallback bounds');
assert.strictEqual(montgomeryAudit.libertyFallbackDetected, false, 'Montgomery context does not detect Liberty fallback');
assert.strictEqual(montgomeryAudit.safeForMontgomeryContext, true, 'Montgomery/Conroe context is safe');


const contradictoryRuntime = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' }
);
const contradictoryAudit = contradictoryRuntime.gridlyCountyContextContainmentAudit();
assert.strictEqual(contradictoryAudit.activeCounty, 'montgomery-tx', 'Selected Montgomery awareness area overrides stale Liberty active county');
assert.strictEqual(contradictoryAudit.activeTown, 'Conroe', 'Conroe remains the active town in the contradictory state');
assert.strictEqual(contradictoryAudit.selectedAwarenessArea.countyId, 'montgomery-tx', 'Contradictory fixture preserves selected Montgomery county id');
assert.strictEqual(contradictoryAudit.countyBoundsSource, 'montgomery-awareness-bounds', 'County bounds cannot use Liberty awareness bounds for selected Montgomery area');
assert.strictEqual(contradictoryAudit.townBoundsSource, 'montgomery-awareness-bounds', 'Conroe resolves to Montgomery town bounds in contradictory state');
assert.strictEqual(contradictoryAudit.fitBoundsTarget, 'montgomery-tx', 'Fit bounds cannot target Liberty for Conroe/Montgomery context');
assert.strictEqual(contradictoryAudit.libertyFallbackDetected, true, 'Stale Liberty runtime county is detected for selected Montgomery context');
assert.strictEqual(contradictoryAudit.safeForMontgomeryContext, false, 'Contradictory Liberty/Montgomery state is not safe');

const montgomeryBounds = montgomeryRuntime.gridlyGetCountyBounds('montgomery-tx');
assert.deepStrictEqual(JSON.parse(JSON.stringify(montgomeryBounds.sw)), [30.087076, -95.83024], 'Montgomery fit southwest corner uses Montgomery bounds');
assert.deepStrictEqual(JSON.parse(JSON.stringify(montgomeryBounds.ne)), [30.630284, -95.0964], 'Montgomery fit northeast corner uses Montgomery bounds');

assert.strictEqual(montgomeryRuntime.gridlyGetCountyBounds('unknown-tx').sw[0], 29.884282, 'Unknown explicit county may fail safe to default Liberty only outside Montgomery active context');

assert(source.includes('const metadata = gridlyGetCountyBoundsMetadata(countyId);'), 'county bounds flow uses metadata instead of direct Liberty defaulting');
assert(source.includes('window.gridlyCountyContextContainmentAudit = gridlyCountyContextContainmentAudit;'), 'audit helper is exposed on window');
assert(source.includes('countyId: area.countyId || GRIDLY_DEFAULT_COUNTY_ID'), 'home town anchor carries county ownership into fit/zoom behavior');
assert(!source.includes('gridlyGetCountyBounds(gridlyResolveCountyIdForAwarenessArea(homeTownAnchor.storageValue)) || bounds'), 'county fit/zoom no longer borrows crossing bounds as implicit fallback for county context');

console.log('County context containment V619 tests passed');
