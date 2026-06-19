const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/app.js', 'utf8');
const cutoff = source.indexOf('const FRA_URL = gridlyGetActiveCountyConfig().crossingsPath;');
assert.ok(cutoff > 0, 'runtime county registry block is present before active URL binding');

function loadRuntime(windowOverrides = {}) {
  const sandbox = { Object, String, Boolean, RegExp, console, window: windowOverrides };
  vm.createContext(sandbox);
  vm.runInContext(`${source.slice(0, cutoff)}
function normalizeGridlyUserFacingRoadText(value = '') { return String(value || '').replace(/\\s+/g, ' ').trim(); }
const LOCATION_DEFAULTS = { country: 'USA', state: 'Texas', county: 'Liberty County' };
function getGridlySelectedAwarenessArea() { return window.__selectedAwarenessArea || null; }
this.api = { GRIDLY_DEFAULT_COUNTY_ID, GRIDLY_COUNTY_REGISTRY, gridlyGetActiveCountyId, gridlyGetCountyDisplayContext, gridlyResolveCountyAwareFallbackLocation, gridlyIsInvalidCountyAwareRoadLabel, gridlyBuildCountyAwareLocationPhrase, normalizeGridlyCountyAwareDisplayText, gridlyValidateCountyContainment };`, sandbox);
  return sandbox.api;
}

const montgomeryRuntime = loadRuntime({
  GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx',
  __selectedAwarenessArea: { countyId: 'montgomery-tx', label: 'Conroe', key: 'conroe', storageValue: 'Conroe' }
});
const montgomeryCountyWideRuntime = loadRuntime({
  GRIDLY_ACTIVE_COUNTY_ID: 'montgomery-tx',
  __selectedAwarenessArea: { countyId: 'montgomery-tx', label: 'Montgomery County', key: 'countywide', storageValue: 'Montgomery County' }
});
const libertyRuntime = loadRuntime({
  GRIDLY_ACTIVE_COUNTY_ID: 'liberty-tx',
  __selectedAwarenessArea: { countyId: 'liberty-tx', label: 'Dayton', key: 'dayton', storageValue: 'Dayton' }
});
const unknownRuntime = loadRuntime({ GRIDLY_ACTIVE_COUNTY_ID: 'unknown-tx' });

const badRoad = 'Local Road Impact Into Liberty';
const montgomeryHazard = { county_id: 'montgomery-tx', type: 'disabled_vehicle', roadName: badRoad, lat: 30.3119, lng: -95.4561 };
const title = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText(`Disabled Vehicle on ${badRoad}`, montgomeryHazard);
const subtitle = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText(`Reported on ${badRoad}`, montgomeryHazard);
const popupLocation = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText(`Reported on ${badRoad}`, montgomeryHazard);

assert(!title.includes(badRoad), 'Montgomery incident title never includes Local Road Impact Into Liberty');
assert(!subtitle.includes(`Reported on ${badRoad}`), 'Montgomery incident subtitle never includes Reported on Local Road Impact Into Liberty');
assert(!/Liberty/i.test(popupLocation), 'Montgomery popup location never includes Liberty');
assert.strictEqual(montgomeryRuntime.gridlyIsInvalidCountyAwareRoadLabel(badRoad), true, 'Montgomery resolver does not treat Liberty fallback as a valid road name');
assert(/Vehicle near (Conroe|Montgomery County|this area)/i.test(title), 'Montgomery title uses near selected awareness area when no road is resolved');
assert(/Reported (in|near) (Conroe|Montgomery County|this area)/i.test(subtitle), 'Montgomery subtitle uses safe selected awareness area when no road is resolved');
assert(/Conroe|Montgomery County|this area/i.test(montgomeryRuntime.gridlyResolveCountyAwareFallbackLocation(montgomeryHazard)), 'Montgomery fallback uses Conroe, Montgomery County, or neutral wording');
assert(/Reported (in|near) Montgomery County/i.test(montgomeryCountyWideRuntime.normalizeGridlyCountyAwareDisplayText(`Reported on ${badRoad}`, montgomeryHazard)), 'Countywide Montgomery fallback remains Montgomery-safe');

const realRoadTitle = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Disabled Vehicle on TX 105', { county_id: 'montgomery-tx', roadName: 'TX 105' });
const realRoadSubtitle = montgomeryRuntime.normalizeGridlyCountyAwareDisplayText('Reported on West Davis Street', { county_id: 'montgomery-tx', roadName: 'West Davis Street' });
assert.strictEqual(realRoadTitle, 'Disabled Vehicle on TX 105', 'Montgomery resolved road names are preserved');
assert.strictEqual(realRoadSubtitle, 'Reported on West Davis Street', 'Montgomery resolved street names are preserved');

const libertyHazard = { county_id: 'liberty-tx', type: 'disabled_vehicle', roadName: badRoad };
assert.strictEqual(libertyRuntime.normalizeGridlyCountyAwareDisplayText(`Disabled Vehicle on ${badRoad}`, libertyHazard), `Disabled Vehicle on ${badRoad}`, 'Liberty resolver behavior is preserved');
assert.strictEqual(libertyRuntime.gridlyGetActiveCountyId(), 'liberty-tx', 'Liberty remains active when selected');
assert.strictEqual(unknownRuntime.gridlyGetActiveCountyId(), 'liberty-tx', 'Unknown county remains fail-safe to Liberty default');
assert.strictEqual(unknownRuntime.gridlyValidateCountyContainment({ county_id: 'unknown-tx' }, 'montgomery-tx').allowed, false, 'Unknown county rows are blocked from Montgomery context');

assert(source.includes('const ROADWAY_SEGMENTS_URL = gridlyGetActiveCountyConfig().roadSegmentsPath;'), 'road resolver binds roadway geometry through active county config, not Liberty-only URL');
assert(source.includes('roadway_dataset_unavailable'), 'road resolver fails safe when county roadway geometry is unavailable');
assert(source.includes('historicalReadsEnabled: false'), 'protected historicalReadsEnabled boundary remains false');
assert(source.includes('historyUiEnabled: false'), 'protected historyUiEnabled boundary remains false');
assert(source.includes('historicalApiExposure: false'), 'protected historicalApiExposure boundary remains false');
assert(source.includes('consumerFacingHistoryDashboard: false'), 'protected consumerFacingHistoryDashboard boundary remains false');
assert(source.includes('DriveTexasPaused: true'), 'DriveTexas remains paused');
assert(source.includes('TransportationIntelligenceEnabled: false'), 'Transportation Intelligence remains disabled');
assert(source.includes('TransportationIntelligenceDisplay: false'), 'Transportation Intelligence display remains disabled');
assert(source.includes('TransportationIntelligenceActivation: false'), 'Transportation Intelligence activation remains disabled');

console.log('montgomeryRoadResolverIncidentLocationV596.test.js passed');
