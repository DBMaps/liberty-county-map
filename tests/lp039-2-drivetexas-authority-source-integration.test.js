const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const start = app.indexOf('function gridlyLp0391SafeArray');
const endExport = 'window.gridlyLp0391DriveTexasAuthorityFoundationAudit = gridlyLp0391DriveTexasAuthorityFoundationAudit; }';
const end = app.indexOf(endExport, start) + endExport.length;
const foundation = app.slice(start, end);
const integration = fs.readFileSync('js/gridlyDriveTexasAuthoritySourceIntegration.js', 'utf8');

function context(overrides = {}) {
  const sandbox = { console, Date, window: {}, globalThis: {} };
  sandbox.window = Object.assign(sandbox.window, {
    getGridlySelectedAwarenessArea: () => ({ label: 'Dayton', storageValue: 'dayton-tx', countyId: 'liberty-tx', lat: 30.0466, lng: -94.8852, radiusMiles: 10 }),
    getDistanceMiles: (aLat, aLng, bLat, bLng) => Math.hypot(Number(aLat) - Number(bLat), Number(aLng) - Number(bLng)) * 69
  }, overrides.window || {});
  vm.createContext(sandbox);
  vm.runInContext(foundation, sandbox, { filename: 'lp0391-foundation.js' });
  vm.runInContext(integration, sandbox, { filename: 'js/gridlyDriveTexasAuthoritySourceIntegration.js' });
  return sandbox.window;
}

const now = Date.parse('2026-07-21T12:00:00Z');
const active = '2026-07-21T10:00:00Z';
const categories = ['Crash', 'Road Closure', 'Flooding', 'Construction', 'Lane Closure', 'Bridge Restriction', 'Travel Advisory'];
const fixtures = categories.map((category, i) => ({
  id: `stable-${i}`,
  provider: 'DriveTexas', providerId: 'drivetexas', category,
  title: `${category} on US 90`, description: `${category} near Dayton`, routeName: i === 6 ? 'US 90 long corridor' : 'US 90',
  latitude: 30.0466 + i * 0.001, longitude: -94.8852, startTime: active, updateTime: active,
  county: 'Liberty', city: 'Dayton', sourceTrace: { provider: 'DriveTexas', sourceId: `stable-${i}` }
}));
fixtures.push({ ...fixtures[0], id: 'stable-0', title: 'duplicate stable id' });
fixtures.push({ id: '', eventId: 'event-dup', category: 'Crash', title: 'event duplicate', latitude: 30.04, longitude: -94.88, startTime: active, updateTime: active });
fixtures.push({ id: '', eventId: 'event-dup', category: 'Crash', title: 'event duplicate two', latitude: 30.04, longitude: -94.88, startTime: active, updateTime: active });
fixtures.push({ id: 'same-title-a', category: 'Crash', title: 'Same title', latitude: 30.04, longitude: -94.88, startTime: active, updateTime: active });
fixtures.push({ id: 'same-title-b', category: 'Crash', title: 'Same title', latitude: 30.04, longitude: -94.88, startTime: active, updateTime: active });
fixtures.push({ id: 'expired', category: 'Crash', title: 'Expired', latitude: 30.04, longitude: -94.88, startTime: active, endTime: '2026-07-20T00:00:00Z' });
fixtures.push({ id: 'stale', category: 'Crash', title: 'Stale', latitude: 30.04, longitude: -94.88, updateTime: '2026-07-20T00:00:00Z' });
fixtures.push({ id: 'future', category: 'Crash', title: 'Future', latitude: 30.04, longitude: -94.88, startTime: '2026-07-22T00:00:00Z' });
fixtures.push({ id: 'missing-time', category: 'Crash', title: 'Missing time', latitude: 30.04, longitude: -94.88 });
fixtures.push({ category: 'Crash', title: 'Fallback identity', routeName: 'FM 1960', latitude: 30.04, longitude: -94.88, startTime: active });
fixtures.push({ id: 'outside', category: 'Crash', title: 'Outside', latitude: 31.5, longitude: -96, startTime: active, updateTime: active });
fixtures.push({ id: 'line', category: 'Road Closure', title: 'Line', geometry: { type: 'LineString', coordinates: [[-94.9, 30.03],[-94.88,30.05]] }, routeName: 'SH 146', startTime: active, updateTime: active });
fixtures.push({ id: 'county-only', category: 'Construction', title: 'County only', county: 'Liberty', startTime: active, updateTime: active });
fixtures.push({ id: 'road-only', category: 'Lane Closure', title: 'Road only', routeName: 'US 90', startTime: active, updateTime: active });
fixtures.push({ id: 'text-only', category: 'Travel Advisory', title: 'Dayton advisory', startTime: active, updateTime: active });

let w = context();
assert.strictEqual(typeof w.gridlyAdaptDriveTexasRecordsForAuthority, 'function');
assert.strictEqual(typeof w.gridlyGetLoadedDriveTexasAuthoritySourceRecords, 'function');
assert.strictEqual(typeof w.gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit, 'function');
assert.strictEqual(w.gridlyLp0391DriveTexasAuthorityFoundationAudit().implementationStatus, 'FOUNDATION_COMPLETE');

const selectedAwarenessArea = { label: 'Dayton', storageValue: 'dayton-tx', countyId: 'liberty-tx', lat: 30.0466, lng: -94.8852, radiusMiles: 10 };
const authority = w.gridlySelectDriveTexasAuthority({ records: fixtures, selectedAwarenessArea, nowMs: now });
assert.strictEqual(authority.sourceIntegrationStatus, 'SOURCE_INTEGRATION_COMPLETE');
assert.strictEqual(authority.identityMethodCounts.stable_provider_source_id > 0, true);
assert.strictEqual(authority.identityMethodCounts.event_id, 2);
assert.strictEqual(authority.identityMethodCounts.deterministic_source_fallback, 1);
assert.strictEqual(authority.duplicateRecordCount, 2);
assert.strictEqual(authority.consumerEligibleSituations.filter((r) => r.title === 'Same title').length, 2);
assert.deepStrictEqual(categories.map((c) => authority.categoryCounts[c === 'Road Closure' ? 'Closure' : c] > 0), categories.map(() => true));
assert.strictEqual(authority.expiredRecordCount, 1);
assert.strictEqual(authority.staleRecordCount, 1);
assert.strictEqual(authority.futureEffectiveRecordCount, 1);
assert.strictEqual(authority.missingTimestampRecordCount, 1);
assert(authority.ownershipMethodsObserved.includes('valid_source_point_inside_awareness_radius_miles'));
assert(authority.ownershipMethodsObserved.includes('not_established'));
assert.strictEqual(authority.fallbackMethodsObserved.length, 0);
assert.strictEqual(authority.unprovenEligibleRecordCount, 0);
assert.strictEqual(authority.authorityEligibilityCertified, true);
assert.strictEqual(authority.allEligibleRecordsWithinAcceptedOwnership, true);
assert.strictEqual(authority.allEligibleRecordsHaveFreshnessProof, true);
assert.strictEqual(authority.allEligibleRecordsHaveIdentityProof, true);
assert.strictEqual(Array.isArray(authority.eligibleRecordProof), true);
assert.strictEqual(authority.ownershipMethodsObserved.length <= 2, true);
assert(authority.sourceFieldsAvailable.includes('routeName'));

w = context({ window: {
  gridlyDriveTexasProvider: { getRuntimeState: () => ({ enabled: false, lastError: null }), getNormalizedRecords: () => [] },
  gridlyDriveTexasConnector: { getAllNormalizedRecords: () => fixtures.slice(0, 2), getNormalizedRecords: () => [], areaLifecycleAudit: () => ({ retainedDataReused: true, retainedSourceTimestamp: active, lastSuccessfulFetchTimestamp: active }) },
  gridlyDriveTexasConnectorRuntimeAudit: () => ({ connected: true, automaticPolling: false, apiKeyConfigured: true, normalizedRecordCount: 0 })
} });
const snap = w.gridlyGetDriveTexasAuthoritySnapshot({ selectedAwarenessArea, nowMs: now });
assert.strictEqual(snap.sourceRecordOwner, 'gridlyDriveTexasConnector.getAllNormalizedRecords');
assert.strictEqual(snap.sourceFallbackUsed, true);
assert.strictEqual(snap.sourceRecordCount, 2);
assert.strictEqual(snap.officialSituationIntegrated, false);
assert.strictEqual(w.gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit().consumerMigrationPerformed, false);

w = context({ window: {
  gridlyDriveTexasProvider: { getRuntimeState: () => ({ enabled: false, lastError: null }), getNormalizedRecords: () => [] },
  gridlyDriveTexasConnector: { getAllNormalizedRecords: () => [], getNormalizedRecords: () => [], areaLifecycleAudit: () => ({ lastFetchError: 'boom' }) },
  gridlyDriveTexasConnectorRuntimeAudit: () => ({ connected: false, automaticPolling: false, apiKeyConfigured: false, normalizedRecordCount: 1 })
} });
const empty = w.gridlyLp0392DriveTexasAuthoritySourceIntegrationAudit();
assert.strictEqual(empty.providerEnabled, false);
assert.strictEqual(empty.connectorEnabled, false);
assert.strictEqual(empty.fetchFailed, true);
assert.strictEqual(empty.quietStateReason, 'fetch failed');
assert.strictEqual(empty.noFetches, true);
assert.strictEqual(empty.noPolling, true);
assert.strictEqual(empty.noStorageWrites, true);
assert.strictEqual(empty.noMapMovement, true);
assert.strictEqual(empty.implementationStatus, 'SOURCE_INTEGRATION_COMPLETE');
assert.strictEqual(empty.recommendedNextMilestone, 'LP039.3');



const woodville = { label: 'Woodville', storageValue: 'woodville-tx', countyId: 'tyler-tx', lat: 30.7752, lng: -94.4155, radiusMiles: 7 };
const milesLat = 1 / 69;
const deterministic = [
  { id: 'one-mile', category: 'Crash', title: 'One mile', coordinates: { latitude: woodville.lat + milesLat, longitude: woodville.lng }, startTime: active },
  { id: 'six-mile', category: 'Crash', title: 'Six miles', coordinates: { latitude: woodville.lat + 6 * milesLat, longitude: woodville.lng }, startTime: active },
  { id: 'eight-mile', category: 'Crash', title: 'Eight miles', coordinates: { latitude: woodville.lat + 8 * milesLat, longitude: woodville.lng }, startTime: active },
  { id: 'array-geojson', category: 'Flooding', title: 'Array geojson', coordinates: [woodville.lng, woodville.lat], startTime: active },
  { id: 'array-app', category: 'Flooding', title: 'Array app', coordinates: [woodville.lat, woodville.lng], startTime: active },
  { id: 'object-app', category: 'Flooding', title: 'Object app', coordinates: { latitude: woodville.lat, longitude: woodville.lng }, startTime: active },
  { id: 'reversed', category: 'Crash', title: 'Reversed', coordinates: { latitude: woodville.lng, longitude: woodville.lat }, startTime: active },
  { id: 'malformed', category: 'Crash', title: 'Malformed', coordinates: ['bad', null], startTime: active },
  { id: 'missing-coords', category: 'Crash', title: 'Missing coords', startTime: active },
  { id: 'route-only', category: 'Lane Closure', title: 'Route only', routeName: 'US 69', startTime: active },
  { id: 'text-only-local', category: 'Travel Advisory', title: 'Woodville text', description: 'Woodville', startTime: active },
  { id: 'retained-only', category: 'Crash', title: 'Retained only', connectorRetained: true, startTime: active },
  { id: 'fresh-outside', category: 'Crash', title: 'Fresh outside', coordinates: { latitude: woodville.lat + 8 * milesLat, longitude: woodville.lng }, startTime: active, updateTime: active },
  { id: 'stale-inside', category: 'Crash', title: 'Stale inside', coordinates: { latitude: woodville.lat, longitude: woodville.lng }, updateTime: '2026-07-20T00:00:00Z' },
  { id: 'fresh-inside', category: 'Crash', title: 'Fresh inside', coordinates: { latitude: woodville.lat, longitude: woodville.lng }, updateTime: active },
  { id: 'missing-time-inside', category: 'Crash', title: 'Missing timestamp inside', coordinates: { latitude: woodville.lat, longitude: woodville.lng } }
];
w = context({ window: { getGridlySelectedAwarenessArea: () => woodville } });
const det = w.gridlySelectDriveTexasAuthority({ records: deterministic, selectedAwarenessArea: woodville, nowMs: now, sourceFallbackUsed: true });
const byId = Object.fromEntries(det.recordProof.map((p) => [p.sourceId, p]));
assert.strictEqual(byId['one-mile'].finalEligibility, true);
assert.strictEqual(byId['six-mile'].finalEligibility, true);
assert.strictEqual(byId['eight-mile'].finalEligibility, false);
assert.strictEqual(byId['eight-mile'].insideAwarenessRadius, false);
assert.strictEqual(byId['array-geojson'].coordinateOrderUsed, 'longitude_latitude_geojson_array');
assert.strictEqual(byId['array-app'].coordinateOrderUsed, 'latitude_longitude_array');
assert.strictEqual(byId['object-app'].coordinateOrderUsed, 'latitude_longitude_object');
assert.strictEqual(byId.reversed.finalEligibility, false);
assert(byId.reversed.ineligibilityReasons.includes('reversed_coordinate_suspect'));
assert.strictEqual(byId.malformed.finalEligibility, false);
assert.strictEqual(byId['missing-coords'].coordinateValidity, 'missing');
assert.strictEqual(byId['route-only'].finalEligibility, false);
assert.strictEqual(byId['text-only-local'].finalEligibility, false);
assert.strictEqual(byId['retained-only'].finalEligibility, false);
assert.strictEqual(byId['fresh-outside'].finalEligibility, false);
assert.strictEqual(byId['stale-inside'].finalEligibility, false);
assert.strictEqual(byId['fresh-inside'].finalEligibility, true);
assert.strictEqual(byId['missing-time-inside'].finalEligibility, false);
assert.strictEqual(det.selectedAwarenessRadiusMiles, 7);
assert.strictEqual(det.unprovenEligibleRecordCount, 0);
assert.strictEqual(det.authorityEligibilityCertified, true);
assert.strictEqual(typeof det.identityMethodCounts, 'object');
assert.strictEqual(det.ownershipMethodsObserved.length <= 2, true);
assert(det.eligibleRecordProof.length > 0);
assert.strictEqual(typeof w.gridlyLp0392DriveTexasEligibilityProofAudit, 'function');

console.log('LP039.2 DriveTexas authority source integration tests passed');
