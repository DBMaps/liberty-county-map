const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
assert(app.includes('window.gridlyLp038RegionalWeatherAuthorityCertificationAudit = function gridlyLp038RegionalWeatherAuthorityCertificationAudit()'), 'LP038 audit helper is defined');
assert(app.includes('productionWeatherBehaviorChanged: false'), 'LP038 preserves production weather behavior invariant');
assert(app.includes('noNetworkMutations: true'), 'LP038 audit is passive with no network mutations');
assert(app.includes('implementationReadyForLp0381: false'), 'LP038 does not mark repair implementation ready');
assert(app.includes('Option C - selected-awareness weather situations'), 'LP038 compares/recommends selected-awareness weather situation authority');
assert(app.includes('selected-awareness filtering'), 'LP038 reports divergence at selected-awareness filtering');

const context = {
  window: null,
  globalThis: null,
  console,
  GRIDLY_COUNTY_REGISTRY: {
    'liberty-tx': { id: 'liberty-tx', name: 'Liberty County', operational: true, productionEnabled: true, defaultAwarenessAreas: ['Liberty County', 'Dayton'], boundaryPath: 'boundary.geojson' },
    'harris-tx': { id: 'harris-tx', name: 'Harris County', operational: true, productionEnabled: true, defaultAwarenessAreas: ['Harris County', 'Houston', 'Pasadena'], boundaryPath: 'boundary.geojson' }
  },
  GRIDLY_LP035_HOUSTON_REGION_MODEL: [{ id: 'houston-downtown-midtown', label: 'Downtown / Midtown', lat: 29.7532, lng: -95.3670 }],
  exposeGridlyAuditHelper(name, fn) { this[name] = fn; },
  gridlyWeatherProvider: { getNormalizedRecords() { return [{ id: 'nws-1', expirationTime: '2099-01-01T00:00:00Z' }, { id: 'nws-1', expirationTime: '2000-01-01T00:00:00Z' }]; } }
};
context.window = context;
context.globalThis = context;
const helperStart = app.indexOf('window.gridlyLp038RegionalWeatherAuthorityCertificationAudit = function gridlyLp038RegionalWeatherAuthorityCertificationAudit()');
const helperEnd = app.indexOf('window.gridlyAndroidMapBreathingRoomAudit = function gridlyAndroidMapBreathingRoomAudit()', helperStart);
vm.runInContext(app.slice(helperStart, helperEnd), vm.createContext(context), { filename: 'lp038-helper.js' });
const audit = context.gridlyLp038RegionalWeatherAuthorityCertificationAudit();
assert.strictEqual(audit.available, true);
assert.strictEqual(audit.passive, true);
assert.strictEqual(audit.noWrites, true);
assert.strictEqual(audit.noNetworkMutations, true);
assert.strictEqual(audit.productionWeatherBehaviorChanged, false);
assert.strictEqual(audit.operationalCountyCount, 2);
assert.strictEqual(audit.configuredCommunityCount, 5);
assert.strictEqual(audit.configuredHoustonRegionCount, 1);
assert.strictEqual(audit.rawAlertCount, 2);
assert.strictEqual(audit.uniqueProviderAlertCount, 1);
assert.strictEqual(audit.duplicateAlertCount, 1);
assert.strictEqual(audit.expiredAlertCount, 1);
assert.strictEqual(audit.springBranchCertification.certificationStatus, 'not_certified_for_local_weather_ownership');
assert.strictEqual(audit.implementationReadyForLp0381, false);

const doc = fs.readFileSync('docs/LP038-REGIONAL-WEATHER-AUTHORITY-CERTIFICATION.md', 'utf8');
[
  '## 1. Scope',
  '## 3. Weather source inventory',
  '## 14. Houston certification',
  '## 15. Spring Branch findings',
  '## 21. Recommended weather authority',
  '## 24. Whether LP038.1 is required'
].forEach((heading) => assert(doc.includes(heading), `${heading} is documented`));

console.log('LP038 regional weather authority certification checks passed');
