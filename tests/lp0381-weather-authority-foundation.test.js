const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const index = fs.readFileSync('index.html', 'utf8');
assert(index.includes('js/gridlyWeatherAuthorityFoundation.js?v=0381'), 'LP038.1 authority foundation is loaded');
assert(index.indexOf('js/gridlyWeatherProvider.js?v=832') < index.indexOf('js/gridlyWeatherAuthorityFoundation.js?v=0381'), 'authority foundation loads after weather provider');
assert(index.indexOf('js/gridlyWeatherAuthorityFoundation.js?v=0381') < index.indexOf('js/app.js?v=1715'), 'authority foundation loads before app without UI migration');

const source = fs.readFileSync('js/gridlyWeatherAuthorityFoundation.js', 'utf8');
assert(source.includes('function gridlySelectConsumerWeatherAuthority'), 'shared weather authority selector exists');
assert(source.includes('gridlyLp0381WeatherAuthorityFoundationAudit'), 'passive browser audit exists');
assert(!source.includes('fetch('), 'authority foundation performs no network fetches');
assert(!source.includes('setInterval('), 'authority foundation performs no polling');
assert(!source.includes('localStorage'), 'authority foundation performs no local writes');
assert(!source.includes('panTo(') && !source.includes('setView('), 'authority foundation performs no map movement');

let fetchCount = 0;
let writeCount = 0;
const context = {
  console,
  Date,
  window: null,
  globalThis: null,
  fetch: async () => { fetchCount += 1; throw new Error('LP038.1 must remain passive'); },
  localStorage: { setItem() { writeCount += 1; } },
  gridlyWeatherProvider: {
    getNormalizedRecords() {
      return [{
        id: 'nws-alert-1',
        providerId: 'weather',
        category: 'Flash Flood Warning',
        title: 'Flash Flood Warning for Liberty County',
        affectedAreas: ['Liberty County'],
        effectiveTime: '2026-07-21T00:00:00Z',
        expirationTime: '2026-07-21T04:00:00Z',
        latitude: 30.05799,
        longitude: -94.7955
      }, {
        id: 'nws-alert-1',
        providerId: 'weather',
        category: 'Flash Flood Warning',
        title: 'duplicate alert',
        affectedAreas: ['Liberty County'],
        effectiveTime: '2026-07-21T00:00:00Z',
        expirationTime: '2026-07-21T04:00:00Z'
      }, {
        id: 'nws-alert-expired',
        providerId: 'weather',
        category: 'Flood Advisory',
        affectedAreas: ['Liberty County'],
        effectiveTime: '2026-07-20T00:00:00Z',
        expirationTime: '2026-07-20T01:00:00Z'
      }, {
        id: 'nws-alert-outside',
        providerId: 'weather',
        category: 'Tornado Watch',
        affectedAreas: ['Harris County'],
        effectiveTime: '2026-07-21T00:00:00Z',
        expirationTime: '2026-07-21T04:00:00Z'
      }];
    }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: 'js/gridlyWeatherAuthorityFoundation.js' });

const audit = context.gridlyLp0381WeatherAuthorityFoundationAudit();
assert.strictEqual(audit.authorityEnginePresent, true);
assert.strictEqual(audit.selectorPresent, true);
assert.strictEqual(audit.providerOwnership, true);
assert.strictEqual(audit.geographicOwnership, true);
assert.strictEqual(audit.freshnessOwnership, true);
assert.strictEqual(audit.consumerEligibility, true);
assert.strictEqual(audit.deduplicationReady, true);
assert.strictEqual(audit.authorityContractReady, true);
assert.strictEqual(audit.currentConditionsIntegrated, false);
assert.strictEqual(audit.forecastIntegrated, false);
assert.strictEqual(audit.alertsIntegrated, false);
assert.strictEqual(audit.consumerMigrationPerformed, false);
assert.strictEqual(audit.recommendedNextMilestone, 'LP038.2');
assert.strictEqual(audit.implementationStatus, 'FOUNDATION_COMPLETE');

const authority = context.gridlySelectConsumerWeatherAuthority({
  selectedAwarenessArea: { name: 'Liberty County', county: 'Liberty' },
  now: '2026-07-21T02:00:00Z'
});
[
  'selectedAwarenessArea', 'authorityStatus', 'provider', 'providerRecordCount',
  'consumerSituationCount', 'uniqueSituationCount', 'freshnessOwner', 'localityOwner',
  'ownershipMethod', 'fallbackReason', 'containsCurrentConditions', 'containsForecast',
  'containsAlerts', 'consumerEligibleWeather', 'expiredRecords', 'duplicateRecords',
  'staleRecords', 'quietStateReason', 'recommendedPresentation'
].forEach((key) => assert(Object.prototype.hasOwnProperty.call(authority, key), `${key} remains in canonical contract`));
assert.strictEqual(authority.selectedAwarenessArea, 'Liberty County');
assert.strictEqual(authority.authorityStatus, 'ACTIVE');
assert.strictEqual(authority.provider, 'weather');
assert.strictEqual(authority.providerRecordCount, 4);
assert.strictEqual(authority.consumerSituationCount, 1);
assert.strictEqual(authority.uniqueSituationCount, 1);
assert.strictEqual(authority.ownershipMethod, 'county');
assert.strictEqual(authority.containsAlerts, true);
assert.strictEqual(authority.consumerEligibleWeather.length, 1);
assert.strictEqual(authority.duplicateRecords.length, 1);
assert.strictEqual(authority.expiredRecords.length, 1);
assert.strictEqual(authority.staleRecords.length, 0);
assert.strictEqual(fetchCount, 0, 'selector and audit perform no network calls');
assert.strictEqual(writeCount, 0, 'selector and audit perform no writes');

console.log('LP038.1 weather authority foundation checks passed');
