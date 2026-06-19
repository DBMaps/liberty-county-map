const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('function getGridlyHomeTownPreference()');
assert.ok(cutoff > 0, 'runtime ownership audit is defined before preferences binding');

function loadRuntime(windowOverrides = {}, selectedAwarenessArea = null, bodyText = '') {
  const sandbox = {
    console,
    window: { addEventListener: () => {}, removeEventListener: () => {}, setInterval, clearInterval, setTimeout, clearTimeout, navigator: {}, ...windowOverrides },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      body: { innerText: bodyText, textContent: bodyText },
      documentElement: { style: {} }
    },
    navigator: {},
    LOCATION_DEFAULTS: { country: 'USA', state: 'Texas', county: 'Liberty County' },
    activeGeoFilter: 'county',
    normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    normalizeGridlyLightweightRenderedAlertText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    getGridlySelectedAwarenessArea: () => selectedAwarenessArea,
    __selectedAwarenessArea: selectedAwarenessArea,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    crypto: { randomUUID: () => 'test-uuid' }
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}\ngetGridlySelectedAwarenessArea = () => __selectedAwarenessArea || null;\nthis.api = { gridlyGetActiveCountyId, normalizeGridlyCountyAwareDisplayText, gridlyCountyRuntimeOwnershipAudit, gridlyGetCountyRuntimeOwnershipSamples };`, sandbox);
  return sandbox.api;
}

const montgomery = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' }
);
assert.strictEqual(montgomery.gridlyGetActiveCountyId(), 'montgomery-tx', 'Montgomery selected area owns active county');
const montgomeryAudit = montgomery.gridlyCountyRuntimeOwnershipAudit();
assert.strictEqual(montgomeryAudit.activeCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.activeTown, 'Conroe');
assert.strictEqual(montgomeryAudit.awarenessCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.hazardLanguageCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.alertLanguageCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.popupLanguageCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.routeContextCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.crossingSourceCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.destinationCounty, 'montgomery-tx');
assert.strictEqual(montgomeryAudit.libertyLeakDetected, false, 'Montgomery runtime audit has no Liberty leak');
assert.strictEqual(montgomeryAudit.safeForActiveCountyRuntime, true, 'Montgomery runtime is county-safe');

const samples = montgomery.gridlyGetCountyRuntimeOwnershipSamples();
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.awarenessSample), 'Montgomery active county does not generate Liberty awareness copy');
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.alertSample), 'Montgomery hazard reports do not generate Liberty alert copy');
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.popupSample), 'Montgomery hazard reports do not generate Liberty popup copy');
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.routeSample), 'Montgomery route context does not generate Liberty language');
assert(source.includes('function normalizeGridlyLightweightAlertSummaryText(value = "") {\n  return normalizeGridlyCountyAwareDisplayText'), 'Top awareness summary normalization is county-owned');

const selectedOverridesStaleCounty = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' }
);
assert.strictEqual(selectedOverridesStaleCounty.gridlyGetActiveCountyId(), 'montgomery-tx', 'County ownership changes with selected activeCounty/home area');
assert.strictEqual(selectedOverridesStaleCounty.gridlyCountyRuntimeOwnershipAudit().safeForActiveCountyRuntime, true, 'Audit passes when selected county overrides stale window county');

const liberty = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx' },
  { countyId: 'liberty-tx', label: 'Dayton', key: 'dayton', storageValue: 'Dayton' }
);
assert.strictEqual(liberty.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty remains supported when active');
assert.strictEqual(liberty.gridlyCountyRuntimeOwnershipAudit().activeCounty, 'liberty-tx', 'Audit changes ownership when active county changes');

const leakingDom = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' },
  'Disabled Vehicle on Local Road Impact Into Liberty'
);
const leakingAudit = leakingDom.gridlyCountyRuntimeOwnershipAudit();
assert.strictEqual(leakingAudit.libertyLeakDetected, true, 'Audit detects stale Liberty UI/provider leakage');
assert.strictEqual(leakingAudit.safeForActiveCountyRuntime, false, 'Audit passes only when all checked ownership surfaces are county-safe');

assert(source.includes('window.gridlyCountyRuntimeOwnershipAudit = gridlyCountyRuntimeOwnershipAudit;'), 'audit helper is exposed on window');
assert(source.includes('gridlyDestinationSearchContainmentAudit'), 'destination search remains included in county ownership implementation surface');

console.log('County runtime ownership V621 tests passed');
