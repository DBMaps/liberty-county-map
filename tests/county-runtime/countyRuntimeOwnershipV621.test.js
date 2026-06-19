const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const markup = fs.readFileSync('index.html', 'utf8');
const cutoff = source.indexOf('function getGridlyHomeTownPreference()');
assert.ok(cutoff > 0, 'runtime ownership audit is defined before preferences binding');

function loadRuntime(windowOverrides = {}, selectedAwarenessArea = null, bodyText = '', domNodes = []) {
  const sandbox = {
    console,
    window: { addEventListener: () => {}, removeEventListener: () => {}, setInterval, clearInterval, setTimeout, clearTimeout, navigator: {}, ...windowOverrides },
    document: {
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => domNodes,
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


function testNode({ id, text, tagName = 'DIV', attrs = {}, parent = null }) {
  return {
    id,
    tagName,
    innerText: text,
    textContent: text,
    getAttribute: (name) => attrs[name] || null,
    hasAttribute: (name) => Object.prototype.hasOwnProperty.call(attrs, name),
    closest: (selector) => (selector === '[data-gridly-county-select]' && (attrs['data-gridly-county-select'] !== undefined || parent?.attrs?.['data-gridly-county-select'] !== undefined)) ? {} : null
  };
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
assert.strictEqual(montgomeryAudit.genericCountyLeakDetected, false, 'Montgomery runtime audit has no generic county leak');
assert.strictEqual(montgomeryAudit.libertyLeakSources.length, 0, 'Clean Montgomery samples produce no Liberty evidence');
assert(montgomeryAudit.checkedTextSurfaces.includes('sample.awarenessSample'), 'Audit lists checked text surfaces');
assert(montgomeryAudit.checkedStateSurfaces.includes('state.activeHazards'), 'Audit lists checked state surfaces');
assert(montgomeryAudit.checkedSearchSurfaces.includes('search.lastLiveSearchAudit'), 'Audit lists checked search surfaces');
assert.strictEqual(montgomeryAudit.safeForActiveCountyRuntime, true, 'Montgomery runtime is county-safe');
assert.strictEqual(montgomeryAudit.reportAttemptObserved, false, 'Audit distinguishes that no report attempt was observed');
assert.strictEqual(montgomeryAudit.reportRegistrationStatus, 'not_applicable_no_attempt', 'No-attempt report status does not imply registration success');
assert.strictEqual(montgomeryAudit.reportRegistrationSafeForActiveCounty, 'not_applicable', 'No-attempt report safety is not a false success');


assert(markup.includes('id="crossingInventoryCountyText">Public crossing inventory currently loaded for the selected county.'), 'Dashboard crossing inventory default is neutral until county sync');
assert(!markup.includes('Public crossing inventory currently loaded for Liberty County.'), 'Dashboard crossing inventory markup does not ship a stale Liberty default');
assert(markup.includes('id="mobileAwarenessPanelKicker">LOCATION AWARENESS • SELECTED COUNTY'), 'Portrait awareness panel default is neutral until county sync');
assert(!markup.includes('LOCATION AWARENESS • LIBERTY COUNTY'), 'Portrait awareness panel markup does not ship a stale Liberty default');
assert(markup.includes('id="gridlyWelcomePreviewPlace">Watching your selected area'), 'Welcome onboarding/steps default is neutral until county sync');
assert(!markup.includes('Watching Dayton'), 'Welcome onboarding and steps markup do not ship a stale Dayton default');
assert(source.includes('document.querySelectorAll?.("#crossingsSection p, #dashboardSection p, #crossingInventoryCountyText")'), 'County static label sync rewrites dashboard crossing inventory text');
assert(source.includes('safeText("mobileAwarenessPanelKicker", `LOCATION AWARENESS • ${awarenessLabel.toUpperCase()}`)'), 'County static label sync rewrites portrait awareness kicker');
assert(source.includes('safeText("gridlyWelcomePreviewPlace", `Watching ${awarenessLabel}`)'), 'County static label sync rewrites welcome preview watch area');

const samples = montgomery.gridlyGetCountyRuntimeOwnershipSamples();
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.awarenessSample), 'Montgomery active county does not generate Liberty awareness copy');
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.alertSample), 'Montgomery hazard reports do not generate Liberty alert copy');
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.popupSample), 'Montgomery hazard reports do not generate Liberty popup copy');
assert(!/Liberty|Local Road Impact Into Liberty/i.test(samples.routeSample), 'Montgomery route context does not generate Liberty language');
assert(source.includes('function normalizeGridlyLightweightAlertSummaryText(value = "") {\n  return normalizeGridlyCountyAwareDisplayText'), 'Top awareness summary normalization is county-owned');


const passiveCountySelectNode = testNode({
  id: 'gridlyWelcomeCountySelect',
  tagName: 'SELECT',
  attrs: { 'data-gridly-county-select': '' },
  text: 'Liberty County\nMontgomery County'
});
const passiveOnlyAudit = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' },
  'Select County\nLiberty County\nMontgomery County',
  [passiveCountySelectNode]
).gridlyCountyRuntimeOwnershipAudit();
assert.strictEqual(passiveOnlyAudit.libertyLeakDetected, false, 'County selector options may include Liberty County without failing Liberty audit');
assert.strictEqual(passiveOnlyAudit.genericCountyLeakDetected, false, 'County selector options may include inactive counties without failing generic audit');
assert.strictEqual(passiveOnlyAudit.safeForActiveCountyRuntime, true, 'Audit remains safe when only passive county options contain Liberty');
assert(passiveOnlyAudit.passiveCountyOptionSources.some((source) => source.source === 'dom.#gridlyWelcomeCountySelect'), 'Audit reports passive county option source');
assert(passiveOnlyAudit.exemptedCountyOptionSources.some((source) => source.source === 'dom.#gridlyWelcomeCountySelect'), 'Audit reports exempted county option source');
assert.strictEqual(passiveOnlyAudit.activeDomLeakSources.length, 0, 'Passive county options are not active DOM leaks');

const stalePanelAudit = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' },
  'LOCATION AWARENESS • LIBERTY COUNTY\nLiberty County Awareness',
  [testNode({ id: 'gridlyPortraitLocationAwarenessPanel', text: 'LOCATION AWARENESS • LIBERTY COUNTY\nLiberty County Awareness' })]
).gridlyCountyRuntimeOwnershipAudit();
assert.strictEqual(stalePanelAudit.safeForActiveCountyRuntime, false, 'Stale portrait panel is an active leak for Montgomery');
assert(stalePanelAudit.activeDomLeakSources.some((source) => source.source === 'dom.#gridlyPortraitLocationAwarenessPanel'), 'Audit classifies stale portrait panel as active DOM leak');

const cleanPanelWithPassiveOptionsAudit = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' },
  'LOCATION AWARENESS • CONROE\nConroe Awareness\nSelect County\nLiberty County\nMontgomery County',
  [testNode({ id: 'gridlyPortraitLocationAwarenessPanel', text: 'LOCATION AWARENESS • CONROE\nConroe Awareness' }), passiveCountySelectNode]
).gridlyCountyRuntimeOwnershipAudit();
assert.strictEqual(cleanPanelWithPassiveOptionsAudit.safeForActiveCountyRuntime, true, 'Montgomery portrait panel copy plus passive options is county-safe');

const staleWelcomePreviewAudit = loadRuntime(
  { GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx' },
  { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' },
  'Watching Dayton\nSelect County\nLiberty County\nMontgomery County',
  [testNode({ id: 'gridlyWelcomePreviewPlace', text: 'Watching Dayton' }), passiveCountySelectNode]
).gridlyCountyRuntimeOwnershipAudit();
assert.strictEqual(staleWelcomePreviewAudit.safeForActiveCountyRuntime, false, 'Active welcome preview text cannot say Dayton for Montgomery/Conroe');
assert(staleWelcomePreviewAudit.activeDomLeakSources.some((source) => source.source === 'dom.#gridlyWelcomePreviewPlace'), 'Audit keeps active welcome preview leaks separate from passive selector options');

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
assert.strictEqual(leakingAudit.genericCountyLeakDetected, true, 'Audit detects stale generic county leakage even when samples are clean');
assert.strictEqual(leakingAudit.firstLibertyLeak.source, 'document.body.visibleText', 'Audit reports first Liberty leak source');
assert(leakingAudit.libertyLeakSources.some((source) => /Local Road Impact Into Liberty/i.test(source.match)), 'Audit reports Liberty leak match evidence');
assert.strictEqual(leakingAudit.safeForActiveCountyRuntime, false, 'Audit passes only when all checked ownership surfaces are county-safe');

assert(source.includes('window.gridlyCountyRuntimeOwnershipAudit = gridlyCountyRuntimeOwnershipAudit;'), 'audit helper is exposed on window');
assert(source.includes('gridlyDestinationSearchContainmentAudit'), 'destination search remains included in county ownership implementation surface');
assert(source.includes('function gridlyMontgomeryReportSubmissionAudit()'), 'Montgomery report submission audit helper exists');
assert(source.includes('gridlyRecordReportSubmissionOwnershipAttempt(row, \"hazard\")'), 'Hazard submissions record active-county ownership attempts');
assert(source.includes('gridlyRecordReportSubmissionOwnershipAccepted(localHazardEntry, \"hazard\")'), 'Montgomery-created hazards are audited after becoming visible/countable');
assert(source.includes('activeReports = [localCrossingRows[0]'), 'Crossing submissions are locally registered for active-county rendering');

console.log('County runtime ownership V621 tests passed');
