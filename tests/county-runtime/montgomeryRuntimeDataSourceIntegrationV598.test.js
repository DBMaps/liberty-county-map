const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyRuntimeSources().remoteCrossingSource;');
assert.ok(cutoff > 0, 'runtime source registry block is present before active source URL binding');

function loadRuntime(windowOverrides = {}) {
  const sandbox = {
    console,
    window: { ...windowOverrides },
    LOCATION_DEFAULTS: { country: 'USA', state: 'Texas', county: 'Liberty County' },
    normalizeGridlyUserFacingRoadText: (value) => String(value || '').replace(/\s+/g, ' ').trim(),
    getGridlySelectedAwarenessArea: () => windowOverrides.__selectedAwarenessArea || null
  };
  vm.createContext(sandbox);
  vm.runInContext(`const OTHER_HAZARD_STRUCTURED_METADATA_PREFIX = '__gridly_other_hazard_metadata__:';\n${source.slice(0, cutoff)}\nthis.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY, gridlyGetActiveCountyId, gridlyGetActiveCountyConfig, gridlyGetCountyRuntimeSources, gridlyGetActiveCountyRuntimeSources, gridlyCountyRuntimeSourceAvailable, gridlyValidateCountyContainment, gridlyReportMatchesActiveCounty, gridlyGetReportCountyId, gridlyGetCountyScopedReportMetadata, gridlyResolveCountyAwareFallbackLocation, gridlyIsInvalidCountyAwareRoadLabel, normalizeGridlyCountyAwareDisplayText };`, sandbox);
  return sandbox.api;
}

const montgomeryRuntime = loadRuntime({
  GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx',
  __selectedAwarenessArea: { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' }
});
const libertyRuntime = loadRuntime({
  GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx',
  __selectedAwarenessArea: { countyId: 'liberty-tx', label: 'Dayton', key: 'dayton', storageValue: 'Dayton' }
});

assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().countyId, 'montgomery-tx', 'Montgomery active county uses Montgomery source registry');
assert.strictEqual(libertyRuntime.gridlyGetActiveCountyRuntimeSources().countyId, 'liberty-tx', 'Liberty active county uses Liberty source registry');
assert.ok(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().boundarySource.includes('assets/county-implementation/montgomery/boundary/'), 'Montgomery boundary source is Montgomery-owned');
assert.strictEqual(libertyRuntime.gridlyGetActiveCountyRuntimeSources().roadSource, 'data/liberty-county-road-segments.geojson', 'Liberty road source remains Liberty-owned');
assert.strictEqual(libertyRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, 'data/liberty-county-rail-crossings.geojson', 'Liberty crossing source remains Liberty-owned');

assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().roadSource, null, 'Montgomery road source is explicitly missing when no Montgomery road geometry exists');
assert.strictEqual(montgomeryRuntime.gridlyCountyRuntimeSourceAvailable('roads'), false, 'Montgomery road source is not marked available');
assert.strictEqual(montgomeryRuntime.gridlyIsInvalidCountyAwareRoadLabel('Local Road Impact Into Liberty'), true, 'Montgomery road resolver rejects Liberty fallback road labels');
const montgomeryBadRoadText = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Reported on Local Road Impact Into Liberty', { county_id: 'montgomery-tx', roadName: 'Local Road Impact Into Liberty' });
assert(!/Liberty/i.test(montgomeryBadRoadText), 'Montgomery alert card fallback does not contain Liberty');
assert(/Conroe|Montgomery County|this area/i.test(montgomeryBadRoadText), 'Missing Montgomery road data falls back to Conroe, Montgomery County, selected area, or neutral wording');
assert.strictEqual(libertyRuntime.normalizeGridlyCountyAwareDisplayText('Reported on Local Road Impact Into Liberty', { county_id: 'liberty-tx', roadName: 'Local Road Impact Into Liberty' }), 'Reported on Local Road Impact Into Liberty', 'Liberty incidents remain unchanged');

assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, 'assets/county-implementation/montgomery/runtime-assets/montgomery-county-rail-crossings.geojson', 'Montgomery crossing source resolves to Montgomery-owned rail crossing asset');
assert.strictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().crossingOverridesSource, 'assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json', 'Montgomery crossing review overrides resolve to Montgomery-owned asset');
assert.strictEqual(montgomeryRuntime.gridlyCountyRuntimeSourceAvailable('crossings'), true, 'Montgomery crossing source is marked available');
assert.notStrictEqual(montgomeryRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, libertyRuntime.gridlyGetActiveCountyRuntimeSources().crossingSource, 'Montgomery crossing count cannot use Liberty crossing source');

assert.strictEqual(montgomeryRuntime.gridlyReportMatchesActiveCounty({ county_id: 'montgomery-tx' }, 'montgomery-tx'), true, 'Montgomery incidents are generated from Montgomery-tagged records');
assert.strictEqual(montgomeryRuntime.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'montgomery-tx'), false, 'Legacy/global Liberty rows do not contaminate Montgomery incident generation');
assert.strictEqual(montgomeryRuntime.gridlyReportMatchesActiveCounty({}, 'montgomery-tx'), false, 'Untagged legacy rows are excluded from Montgomery active incident generation');
assert.strictEqual(montgomeryRuntime.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'montgomery-tx').allowed, false, 'Unknown county rows are excluded/fail-closed');
assert.strictEqual(libertyRuntime.gridlyReportMatchesActiveCounty({ county_id: 'liberty-tx' }, 'liberty-tx'), true, 'Liberty incidents remain visible in Liberty context');
assert.strictEqual(libertyRuntime.gridlyReportMatchesActiveCounty({}, 'liberty-tx'), true, 'Legacy untagged Liberty rows remain Liberty-compatible');

const uiStrings = [
  montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Disabled Vehicle on Local Road Impact Into Liberty', { county_id: 'montgomery-tx' }),
  montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Reported near Local Road Impact Into Liberty', { county_id: 'montgomery-tx' }),
  montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Reported on Liberty County', { county_id: 'montgomery-tx' }),
  montgomeryRuntime.gridlyResolveCountyAwareFallbackLocation({ county_id: 'montgomery-tx' })
];
assert(uiStrings.every((value) => !/Liberty/i.test(value)), 'Alert cards, popups, and awareness summary do not contain Liberty when active county is Montgomery');

assert(source.includes('historicalReadsEnabled: false'), 'protected historicalReadsEnabled boundary remains false');
assert(source.includes('historyUiEnabled: false'), 'protected historyUiEnabled boundary remains false');
assert(source.includes('historicalApiExposure: false'), 'protected historicalApiExposure boundary remains false');
assert(source.includes('consumerFacingHistoryDashboard: false'), 'protected consumerFacingHistoryDashboard boundary remains false');
assert(source.includes('DriveTexasPaused: true'), 'DriveTexas remains paused');
assert(source.includes('TransportationIntelligenceEnabled: false'), 'Transportation Intelligence remains disabled');

console.log('Montgomery runtime data source integration V598 tests passed');
