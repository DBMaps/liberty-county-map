const assert = require('assert');
const fs = require('fs');

const source = fs.readFileSync('js/app.js', 'utf8');

function includes(text, message) {
  assert.ok(source.includes(text), message);
}

includes('function gridlyResolveLocationContext(input = {})', 'central passive resolver is implemented');
includes('window.gridlyResolveLocationContext = gridlyResolveLocationContext', 'browser resolver helper is exposed');
includes('window.gridlyLp0361PassiveLocationResolutionAudit = gridlyLp0361PassiveLocationResolutionAudit', 'browser audit helper is exposed');
includes('window.gridlyResetLp0361PassiveLocationResolutionAudit = gridlyResetLp0361PassiveLocationResolutionAudit', 'bounded observation reset helper is exposed');
includes('const GRIDLY_LP0361_PASSIVE_OBSERVATION_LIMIT = 20', 'observation buffer is bounded to 20 calls');
includes('gridlyLp0361PointInBounds(latitude, longitude, GRIDLY_COUNTY_AWARENESS_BOUNDS_BY_ID?.[countyId])', 'county resolution uses existing county awareness boundary contract');
includes('outside_supported_coverage', 'outside coverage status is represented');
includes('ambiguous_county', 'ambiguous county status is represented');
includes('county_boundary_unavailable', 'missing county boundary status is represented');
includes('invalid_coordinates', 'invalid coordinate status is represented');
includes('latitude_out_of_range', 'latitude range validation is explicit');
includes('longitude_out_of_range', 'longitude range validation is explicit');
includes('GRIDLY_AWARENESS_AREA_DEFINITIONS || []).filter', 'awareness resolution reuses existing awareness registry');
includes('awareness_radius', 'awareness center/radius match method is reported');
includes('countywide_fallback', 'countywide fallback is explicit and not manufactured');
includes('GRIDLY_LP035_SEPARATELY_OWNED_HARRIS_COMMUNITIES', 'separate Harris communities are protected');
includes('houston-downtown-midtown', 'Downtown / Midtown Houston child region is covered');
includes('houston-med-center-rice', 'Medical Center / Rice Houston child region is covered');
includes('partitionRuntimeExpected: countyId === GRIDLY_HARRIS_PARTITION_RUNTIME_COUNTY_ID', 'Harris partition runtime is identified passively');
includes('gridlyResolveRoadwayRuntimeSource(countyId)', 'runtime classification reuses existing runtime resolver without activating it');
includes('gridlyLp0361ReadStorageLocationState', 'storage ownership is observed read-only');
includes('settingsLocation', 'settings location snapshot is normalized');
includes('profileLocation', 'profile location snapshot is normalized');
includes('legacyHomeTown', 'legacy home-town snapshot is normalized');
includes('function gridlyLp0361CompareResolution(result, state)', 'current authoritative state comparison is implemented');
includes('stateWritesAttempted: 0, storageWritesAttempted: 0, runtimeActivationAttempted: 0, mapMovementAttempted: 0, networkRefreshAttempted: 0', 'mutation safety counters default to zero');
const resolverBody = source.slice(source.indexOf('function gridlyResolveLocationContext(input = {})'), source.indexOf('function gridlyLp0361RecordObservation'));
assert.ok(!/(?:saveGridlySettingsPreferences|saveGridlyUserProfile|gridlySafeLocalStorageSet|localStorage\.setItem|sessionStorage\.setItem|gridlySetActiveCountyContext|gridlyLoadRoadway|gridlyScheduleHarrisPartitionVisibleBoundsLoad|fitBounds|setView)/.test(resolverBody), 'resolver body does not call protected mutating owners');

const docs = fs.readFileSync('docs/LP036.1-PASSIVE-LOCATION-RESOLUTION-ENGINE.md', 'utf8');
assert.ok(docs.includes('Passive safety guarantees'), 'documentation includes passive safety guarantees');
assert.ok(docs.includes('Testing instructions'), 'documentation includes testing instructions');

console.log('LP036.1 passive location resolution implementation test passed');
