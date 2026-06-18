const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

function loadRuntime(windowOverrides = {}) {
  const sandbox = { Object, String, Boolean, RegExp, window: windowOverrides };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}
function normalizeGridlyUserFacingRoadText(value = '') { return String(value || '').replace(/\s+/g, ' ').trim(); }
const LOCATION_DEFAULTS = { country: 'USA', state: 'Texas', county: 'Liberty County' };
function getGridlySelectedAwarenessArea() { return window.__selectedAwarenessArea || null; }
this.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, gridlyGetActiveCountyId, gridlyGetCountyDisplayContext, gridlyResolveCountyAwareFallbackLocation, normalizeGridlyCountyAwareDisplayText, gridlyValidateCountyContainment };`, sandbox);
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
const unknownRuntime = loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'unknown-tx' });

const montgomeryHazard = { county_id: 'montgomery-tx', type: 'disabled_vehicle', roadName: 'Local Road Impact Into Liberty' };
const montgomeryTitle = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Disabled Vehicle on Local Road Impact Into Liberty', montgomeryHazard);
const montgomeryAlertCard = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Reported on Local Road Impact Into Liberty', montgomeryHazard);
const montgomeryPopup = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Reported on Liberty County', montgomeryHazard);
const montgomeryFallback = montgomeryRuntime.gridlyResolveCountyAwareFallbackLocation(montgomeryHazard);

assert(!/Liberty/i.test(montgomeryTitle), 'Montgomery hazard title does not contain Liberty');
assert(!/Liberty/i.test(montgomeryAlertCard), 'Montgomery alert card language does not contain Liberty');
assert(!/Liberty/i.test(montgomeryPopup), 'Montgomery hazard popup language does not contain Liberty');
assert(/Conroe|Montgomery County|this area/i.test(montgomeryFallback), 'Montgomery fallback road/location copy uses Conroe, Montgomery County, or neutral wording');
assert(!/Local Road Impact Into Liberty/i.test(montgomeryTitle), 'Local Road Impact Into Liberty no longer appears for Montgomery context');
assert(/Conroe|Montgomery County|this area/i.test(`${montgomeryTitle} ${montgomeryAlertCard} ${montgomeryPopup}`), 'Montgomery language uses selected county/home-area context');

const libertyHazard = { county_id: 'liberty-tx', type: 'disabled_vehicle', roadName: 'Local Road Impact Into Liberty' };
const libertyTitle = libertyRuntime.normalizeGridlyCountyAwareDisplayText('Disabled Vehicle on Local Road Impact Into Liberty', libertyHazard);
assert(/Liberty/i.test(libertyTitle), 'Liberty hazard wording still works in Liberty context');
assert.strictEqual(libertyRuntime.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty context remains active when selected');

assert.strictEqual(unknownRuntime.gridlyGetActiveCountyId(), 'liberty-tx', 'Unknown county remains fail-safe and does not default to Montgomery');
assert.strictEqual(unknownRuntime.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'montgomery-tx').allowed, false, 'Unknown county rows are blocked from Montgomery context');

assert(source.includes('historicalReadsEnabled: false'), 'protected historicalReadsEnabled boundary remains false');
assert(source.includes('historyUiEnabled: false'), 'protected historyUiEnabled boundary remains false');
assert(source.includes('historicalApiExposure: false'), 'protected historicalApiExposure boundary remains false');
assert(source.includes('consumerFacingHistoryDashboard: false'), 'protected consumerFacingHistoryDashboard boundary remains false');
assert(source.includes('DriveTexasPaused: true'), 'DriveTexas remains paused');
assert(source.includes('TransportationIntelligenceEnabled: false'), 'Transportation Intelligence remains disabled');
assert(source.includes('TransportationIntelligenceDisplay: false'), 'Transportation Intelligence display remains disabled');
assert(source.includes('TransportationIntelligenceActivation: false'), 'Transportation Intelligence activation remains disabled');

assert(source.includes('normalizeGridlyCountyAwareDisplayText'), 'county-aware display helper is wired into display paths');
assert(source.includes('gridlyResolveCountyAwareFallbackLocation'), 'county-aware fallback resolver is available');
assert(source.includes('buildGridlyAlertCardConsumerModel'), 'alert card display path remains present');
assert(source.includes('buildGridlyHazardPopupConsumerModel'), 'hazard popup display path remains present');

console.log('montgomeryCountyContextLanguageResolverV595.test.js passed');
