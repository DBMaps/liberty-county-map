const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const index = fs.readFileSync('index.html', 'utf8');
assert(index.includes('js/gridlyWeatherAuthorityFoundation.js?v=0381'), 'foundation module remains present');
assert(index.includes('js/gridlyWeatherAuthoritySourceIntegration.js?v=0382'), 'LP038.2 source integration module is loaded');
assert(index.indexOf('js/gridlyWeatherProvider.js?v=832') < index.indexOf('js/gridlyWeatherAuthorityFoundation.js?v=0381'), 'provider definitions load before foundation');
assert(index.indexOf('js/gridlyWeatherLiveConnector.js?v=841') < index.indexOf('js/gridlyWeatherAuthoritySourceIntegration.js?v=0382'), 'connector definitions load before LP038.2 integration');
assert(index.indexOf('js/gridlyWeatherAuthorityFoundation.js?v=0381') < index.indexOf('js/gridlyWeatherAuthoritySourceIntegration.js?v=0382'), 'foundation loads before LP038.2 integration');
assert(index.indexOf('js/gridlyWeatherAuthoritySourceIntegration.js?v=0382') < index.indexOf('js/app.js?v=1715'), 'LP038.2 integration loads before app');
assert(!index.includes('gridlyBriefWeather = gridlyGetWeatherAuthoritySnapshot'), 'consumer weather count owner is not replaced');

let fetchCount = 0, intervalCount = 0, storageWrites = 0, mapMoves = 0;
const context = {
  console,
  Date,
  fetch() { fetchCount += 1; throw new Error('audit must not fetch'); },
  setInterval() { intervalCount += 1; return 1; },
  localStorage: { setItem() { storageWrites += 1; } },
  sessionStorage: { setItem() { storageWrites += 1; } },
  map: { setView() { mapMoves += 1; } }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/gridlyWeatherProvider.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/gridlyWeatherAuthorityFoundation.js', 'utf8'), context);
vm.runInContext(fs.readFileSync('js/gridlyWeatherAuthoritySourceIntegration.js', 'utf8'), context);

const now = '2026-07-21T12:00:00Z';
const liberty = { name: 'Liberty County', county: 'Liberty', label: 'Liberty', radiusMiles: 8, lat: 30.057, lng: -94.795, zones: ['TXZ213'] };
const polygon = { type: 'Polygon', coordinates: [[[-94.9, 29.9], [-94.7, 29.9], [-94.7, 30.2], [-94.9, 30.2], [-94.9, 29.9]]] };
const samples = [
  { id: 'nws-poly', providerId: 'weather', category: 'Flash Flood Warning', title: 'Flash Flood Warning', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', latitude: 30.05, longitude: -94.8, geometry: polygon, affectedAreas: ['Liberty'] },
  { id: 'nws-county', providerId: 'weather', category: 'Flood Warning', title: 'Flood Warning', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'nws-fallback', providerId: 'weather', category: 'Dense Fog Advisory', title: 'Dense Fog Advisory', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', locality: 'Liberty' },
  { id: 'nws-poly', providerId: 'weather', category: 'Flash Flood Warning', title: 'Duplicate Flash Flood Warning', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', latitude: 30.05, longitude: -94.8, geometry: polygon },
  { id: 'nws-expired', providerId: 'weather', category: 'Tornado Warning', title: 'Expired', effectiveTime: '2026-07-21T05:00:00Z', expirationTime: '2026-07-21T06:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'nws-stale', providerId: 'weather', category: 'Wind Advisory', title: 'Stale', effectiveTime: '2026-07-21T00:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'nws-future', providerId: 'weather', category: 'Severe Thunderstorm Watch', title: 'Future', effectiveTime: '2026-07-21T13:00:00Z', expirationTime: '2026-07-21T16:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'nws-missing-geo', providerId: 'weather', category: 'Flood Advisory', title: 'Missing geography', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z' },
  { id: 'nws-missing-time', providerId: 'weather', category: 'Heat Advisory', title: 'Missing timestamp', affectedAreas: ['Liberty County'] },
  { id: 'nws-outside', providerId: 'weather', category: 'Flood Warning', title: 'Outside', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Brazoria County'] }
];

assert.strictEqual(typeof context.gridlyAdaptWeatherRecordsForAuthority, 'function', 'source adapter exists');
assert.strictEqual(typeof context.gridlyGetWeatherAuthoritySnapshot, 'function', 'authority snapshot exists');
const adapted = context.gridlyAdaptWeatherRecordsForAuthority(samples, { now });
assert.strictEqual(adapted.rawRecordCount, 10);
assert.strictEqual(adapted.uniqueProviderRecordCount, 9, 'duplicates are removed deterministically');
assert.strictEqual(adapted.duplicateRecordCount, 1);
assert.strictEqual(adapted.expiredRecordCount, 1, 'expired records are classified');
assert.strictEqual(adapted.staleRecordCount, 1, 'stale records are classified');
assert.strictEqual(adapted.missingTimestampRecordCount, 1, 'missing timestamps are disclosed');

const snapshot = context.gridlyGetWeatherAuthoritySnapshot({ selectedAwarenessArea: liberty, records: samples, now });
assert.strictEqual(snapshot.authorityEligibleRecordCount, 3, 'NWS records enter the authority selector and expired/stale/future/missing/outside records are excluded');
assert(snapshot.ownershipMethodsObserved.includes('alert_polygon'), 'polygon ownership is preferred when available');
assert(snapshot.ownershipMethodsObserved.includes('county'), 'county ownership is used when supported');
assert(snapshot.ownershipMethodsObserved.includes('fallback_locality'), 'radius/text ownership remains a disclosed fallback');
assert.strictEqual(snapshot.authorityResult.consumerEligibleWeather[0].authority.ownershipMethod, 'alert_polygon');
assert.strictEqual(snapshot.authorityResult.consumerEligibleWeather.some((record) => record.id === 'nws-outside'), false, 'outside-area records are excluded');
assert.strictEqual(snapshot.sourceIntegrationStatus.currentConditionsIntegrated, false, 'current conditions remain unintegrated when no source exists');
assert.strictEqual(snapshot.sourceIntegrationStatus.forecastIntegrated, false, 'forecasts remain unintegrated when no source exists');

const audit = context.gridlyLp0382WeatherAuthoritySourceIntegrationAudit({ selectedAwarenessArea: liberty, records: samples, now });
assert.strictEqual(audit.foundationPresent, true);
assert.strictEqual(audit.selectorPresent, true);
assert.strictEqual(audit.sourceAdapterPresent, true);
assert.strictEqual(audit.authoritySnapshotPresent, true);
assert.strictEqual(audit.nwsProviderPresent, true);
assert.strictEqual(audit.nwsNormalizationPresent, true);
assert.strictEqual(audit.nwsAlertsIntegrated, true);
assert.strictEqual(audit.currentConditionsSourceAvailable, false);
assert.strictEqual(audit.currentConditionsIntegrated, false);
assert.strictEqual(audit.forecastSourceAvailable, false);
assert.strictEqual(audit.forecastIntegrated, false);
assert.strictEqual(audit.geographicOwnershipIntegrated, true);
assert.strictEqual(audit.freshnessIntegrated, true);
assert.strictEqual(audit.deduplicationIntegrated, true);
assert.strictEqual(audit.consumerEligibilityIntegrated, true);
assert.strictEqual(audit.consumerMigrationPerformed, false);
assert.strictEqual(audit.implementationStatus, 'SOURCE_INTEGRATION_COMPLETE');
assert.strictEqual(audit.recommendedNextMilestone, 'LP038.3');
assert.strictEqual(fetchCount, 0, 'no fetch occurs from the audit');
assert.strictEqual(intervalCount, 0, 'no polling begins');
assert.strictEqual(storageWrites, 0, 'no storage writes occur');
assert.strictEqual(mapMoves, 0, 'no map movement occurs');

console.log('LP038.2 weather authority source integration checks passed');
