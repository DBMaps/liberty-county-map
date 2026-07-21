const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const index = fs.readFileSync('index.html', 'utf8');
assert(index.includes('js/gridlyWeatherAuthorityFoundation.js?v=0381'));
assert(index.includes('js/gridlyWeatherAuthoritySourceIntegration.js?v=0382'));
assert(index.indexOf('js/gridlyWeatherAuthoritySourceIntegration.js?v=0382') < index.indexOf('js/app.js?v=1715'));

let fetchCount = 0, intervalCount = 0, storageWrites = 0, mapMoves = 0;
const context = {
  console,
  Date,
  fetch() { fetchCount += 1; throw new Error('LP038.3 must not fetch'); },
  setInterval() { intervalCount += 1; return 1; },
  localStorage: { setItem() { storageWrites += 1; } },
  sessionStorage: { setItem() { storageWrites += 1; } },
  map: { setView() { mapMoves += 1; }, panTo() { mapMoves += 1; }, flyTo() { mapMoves += 1; } },
  window: null,
  document: { querySelector() { return null; } }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('js/gridlyWeatherProvider.js', 'utf8'), context, { filename: 'js/gridlyWeatherProvider.js' });
vm.runInContext(fs.readFileSync('js/gridlyWeatherAuthorityFoundation.js', 'utf8'), context, { filename: 'js/gridlyWeatherAuthorityFoundation.js' });
vm.runInContext(fs.readFileSync('js/gridlyWeatherAuthoritySourceIntegration.js', 'utf8'), context, { filename: 'js/gridlyWeatherAuthoritySourceIntegration.js' });

assert.strictEqual(typeof context.gridlySelectConsumerWeatherAuthority, 'function');
assert.strictEqual(typeof context.gridlyGetWeatherAuthoritySnapshot, 'function');
assert.strictEqual(typeof context.gridlySelectConsumerVisibleWeatherSituations, 'function');
assert.strictEqual(typeof context.gridlyLp0383ConsumerWeatherAuthorityMigrationAudit, 'function');

const now = '2026-07-21T12:00:00Z';
const polygon = { type: 'Polygon', coordinates: [[[-95, 29.8], [-94.6, 29.8], [-94.6, 30.2], [-95, 30.2], [-95, 29.8]]] };
const dayton = { name: 'Dayton', label: 'Dayton', county: 'Liberty', zones: ['TXZ213'] };
const livingston = { name: 'Livingston', label: 'Livingston', county: 'Polk', zones: ['TXZ164'] };
const pasadena = { name: 'Pasadena', label: 'Pasadena', county: 'Harris', zones: ['TXZ214'] };
const houstonParent = { name: 'Houston region', label: 'Houston region', county: 'Harris', zones: ['TXZ214'] };
const houstonChild = { name: 'Pasadena', label: 'Pasadena', county: 'Harris', zones: ['TXZ214'] };

const records = [
  { id: 'poly-1', providerId: 'weather', category: 'Flash Flood Warning', title: 'Flash Flood Warning', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', latitude: 30.05, longitude: -94.8, geometry: polygon, affectedAreas: ['Dayton'] },
  { id: 'county-1', providerId: 'weather', category: 'Flood Warning', title: 'Flood Warning', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'fallback-1', providerId: 'weather', category: 'Dense Fog Advisory', title: 'Dense Fog Advisory', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', locality: 'Dayton' },
  { id: 'poly-1', providerId: 'weather', category: 'Flash Flood Warning', title: 'Flash Flood Warning duplicate', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', latitude: 30.05, longitude: -94.8, geometry: polygon },
  { id: 'expired-1', providerId: 'weather', category: 'Tornado Warning', title: 'Tornado Warning', effectiveTime: '2026-07-21T06:00:00Z', expirationTime: '2026-07-21T07:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'stale-1', providerId: 'weather', category: 'Wind Advisory', title: 'Wind Advisory', effectiveTime: '2026-07-21T00:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'future-1', providerId: 'weather', category: 'Severe Thunderstorm Watch', title: 'Severe Thunderstorm Watch', effectiveTime: '2026-07-21T13:00:00Z', expirationTime: '2026-07-21T16:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'missing-time-1', providerId: 'weather', category: 'Heat Advisory', title: 'Heat Advisory', affectedAreas: ['Liberty County'] },
  { id: 'outside-1', providerId: 'weather', category: 'Flood Warning', title: 'Flood Warning', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Polk County'] },
  { id: 'same-title-a', providerId: 'weather', category: 'Flood Advisory', title: 'Flood Advisory', effectiveTime: '2026-07-21T10:00:00Z', expirationTime: '2026-07-21T14:00:00Z', affectedAreas: ['Liberty County'] },
  { id: 'same-title-b', providerId: 'weather', category: 'Flood Advisory', title: 'Flood Advisory', effectiveTime: '2026-07-21T10:05:00Z', expirationTime: '2026-07-21T14:05:00Z', affectedAreas: ['Liberty County'] }
];

const consumer = context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: dayton, records, now });
assert.strictEqual(consumer.consumerVisibleSituationCount, 5, 'unique eligible authority situations own the visible count');
assert.strictEqual(consumer.currentConditionsAvailable, false, 'Current Conditions are not fabricated');
assert.strictEqual(consumer.forecastAvailable, false, 'Forecasts are not fabricated');
assert(consumer.ownershipMethodsObserved.includes('alert_polygon'));
assert(consumer.ownershipMethodsObserved.includes('county'));
assert(consumer.ownershipMethodsObserved.includes('fallback_locality'));
assert(consumer.fallbackDisclosureRequired, 'fallback ownership requires non-precise consumer presentation');
assert(consumer.consumerVisibleSituations.some((item) => item.locationPhrase.includes('Reported for')));
assert(!JSON.stringify(consumer.consumerVisibleSituations).includes('authority_eligible'));

const ids = consumer.consumerVisibleSituations.map((item) => item.providerRecordId);
assert.strictEqual(ids.filter((id) => id === 'poly-1').length, 1, 'duplicate source IDs are not double counted');
assert(!ids.includes('expired-1'));
assert(!ids.includes('stale-1'));
assert(!ids.includes('future-1'));
assert(!ids.includes('missing-time-1'));
assert(!ids.includes('outside-1'));
assert(ids.includes('same-title-a') && ids.includes('same-title-b'), 'distinct alerts with identical titles remain distinct');

assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: livingston, records, now }).consumerVisibleSituationCount, 2);
assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: pasadena, records, now }).consumerVisibleSituationCount, 1);
assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: houstonParent, records, now }).consumerVisibleSituationCount, 1);
assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: houstonChild, records, now }).consumerVisibleSituationCount, 1);
assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: dayton, records: [], now }).quietStateReason, 'no_loaded_records');
assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: dayton, records: [records[8]], now }).quietStateReason, 'filtered_outside_awareness_area');
assert.strictEqual(context.gridlySelectConsumerVisibleWeatherSituations({ selectedAwarenessArea: dayton, records: [records[4]], now }).quietStateReason, 'all_records_expired');

const audit = context.gridlyLp0383ConsumerWeatherAuthorityMigrationAudit({ selectedAwarenessArea: dayton, records, now });
assert.strictEqual(audit.consumerMigrationPerformed, true);
assert.strictEqual(audit.consumerCountOwner, 'gridlySelectConsumerVisibleWeatherSituations');
assert.strictEqual(audit.rawProviderCountDiagnosticOnly, true);
assert.strictEqual(audit.connectorCountDiagnosticOnly, true);
assert.strictEqual(audit.awarenessBriefUsesAuthority, true);
assert.strictEqual(audit.communityPulseUsesAuthority, true);
assert.strictEqual(audit.travelBriefUsesAuthority, true);
assert.strictEqual(audit.alertPanelUsesAuthority, true);
assert.strictEqual(audit.weatherCountCopyUsesAuthority, true);
assert.strictEqual(audit.quietStateUsesAuthority, true);
assert.strictEqual(audit.countySummaryUsesAuthority, true);
assert.strictEqual(audit.communitySummaryUsesAuthority, true);
assert.strictEqual(audit.houstonParentUsesAuthority, true);
assert.strictEqual(audit.houstonChildRegionsUseAuthority, true);
assert.strictEqual(audit.legacyVisibleCountOwnersRemaining, 0);
assert.strictEqual(audit.consumerLanguageTechnicalLeakDetected, false);
assert.strictEqual(audit.remainingDivergence, 'none');
assert.strictEqual(audit.allMigratedConsumerSurfacesUseAuthority, true);
assert.strictEqual(audit.implementationStatus, 'CONSUMER_MIGRATION_COMPLETE');
assert.strictEqual(audit.recommendedNextMilestone, 'LP039');
assert.strictEqual(fetchCount, 0);
assert.strictEqual(intervalCount, 0);
assert.strictEqual(storageWrites, 0);
assert.strictEqual(mapMoves, 0);

console.log('LP038.3 consumer weather authority migration checks passed');
