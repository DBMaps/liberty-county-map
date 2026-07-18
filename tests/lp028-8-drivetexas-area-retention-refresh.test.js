const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const connectorSource = fs.readFileSync('js/gridlyDriveTexasLiveConnector.js', 'utf8');

function feature(id, props) {
  return { type: 'Feature', properties: { id, ...props }, geometry: { type: 'Point', coordinates: [props.longitude, props.latitude] } };
}

function createRuntime() {
  let area = { label: 'Livingston', storageValue: 'livingston', key: 'livingston', countyId: 'polk-tx', lat: 30.71, lng: -94.93, radiusMiles: 8, countyWide: false };
  let fetchCalls = 0;
  let renders = 0;
  let refreshes = 0;
  let payload = { type: 'FeatureCollection', features: [] };
  const context = {
    console, Date, Number, String, Boolean, Array, Object, JSON, Math, encodeURIComponent,
    GRIDLY_CONFIG: { driveTexas: { apiKey: 'test-key', endpointTemplate: 'https://example.test?key={api_key}' } },
    setTimeout(cb) { return setImmediate(cb); }, clearTimeout() {}, AbortController,
    getGridlySelectedAwarenessArea() { return area; },
    getDistanceMiles(lat1, lng1, lat2, lng2) { const dx = (lat1 - lat2) * 69; const dy = (lng1 - lng2) * 69; return Math.sqrt(dx * dx + dy * dy); },
    gridlySelectedAwarenessAreaResolutionCache: { driveTexasFilterOperationCount: 0, driveTexasPerRecordAwarenessLookupCount: 0 },
    gridlyLp016RecordAwarenessSwitchEvent() {},
    gridlyRenderTravelBrief() { renders += 1; },
    gridlyOfficialProviderConsumerRefresh() { refreshes += 1; },
    gridlyDriveTexasProvider: { normalizeRecords(input) { return input.features.map((f) => ({ ...f.properties, raw: { properties: f.properties, geometry: f.geometry }, rawPayloadExposed: false })); } },
    fetch: async () => { fetchCalls += 1; return { ok: true, status: 200, json: async () => payload }; }
  };
  context.window = context; context.globalThis = context; context.module = { exports: {} };
  vm.createContext(context);
  vm.runInContext(connectorSource, context, { filename: 'js/gridlyDriveTexasLiveConnector.js' });
  return { context, setArea(next) { area = next; }, setPayload(next) { payload = next; }, fetchCalls: () => fetchCalls, renders: () => renders, refreshes: () => refreshes };
}

const livingston = { label: 'Livingston', storageValue: 'livingston', key: 'livingston', countyId: 'polk-tx', lat: 30.71, lng: -94.93, radiusMiles: 8, countyWide: false };
const dayton = { label: 'Dayton', storageValue: 'dayton', key: 'dayton', countyId: 'liberty-tx', lat: 30.05, lng: -94.89, radiusMiles: 8, countyWide: false };
const polkCounty = { label: 'Polk County', storageValue: 'polk-county', key: 'polk-county', countyId: 'polk-tx', lat: 30.71, lng: -94.93, radiusMiles: 35, countyWide: true };

(async () => {
  const rt = createRuntime();
  rt.setPayload({ type: 'FeatureCollection', features: [
    feature('livingston-closure', { latitude: 30.711, longitude: -94.931, county: 'Polk', city: 'Livingston', routeName: 'US 59', category: 'Road Closure', title: 'Livingston closure', rawSourceText: 'raw livingston text', extraFutureField: { lanes: ['right'] } }),
    feature('dayton-work', { latitude: 30.051, longitude: -94.891, county: 'Liberty', city: 'Dayton', routeName: 'US 90', category: 'Construction', title: 'Dayton work' }),
    feature('unknown-retained', { latitude: 31.9, longitude: -99.1, county: 'Far', city: 'Far', routeName: 'FM 1', category: 'Mystery Category', title: 'Unknown far advisory', unmappedClosureDetail: 'keep me' })
  ] });

  rt.setArea(livingston);
  const first = await rt.context.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(first.retainedNormalizedRecordCount, 3, 'successful fetch stores the complete normalized source dataset');
  assert.deepStrictEqual(rt.context.gridlyDriveTexasConnector.getNormalizedRecords().map((r) => r.id), ['livingston-closure'], 'getNormalizedRecords remains the awareness presentation view');
  assert.strictEqual(rt.context.gridlyDriveTexasConnector.getAllNormalizedRecords().length, 3, 'complete dataset is separate from awareness view');
  assert.strictEqual(rt.context.gridlyDriveTexasConnector.getAllNormalizedRecords()[2].category, 'Mystery Category', 'unknown categories remain retained');
  assert.strictEqual(rt.context.gridlyDriveTexasConnector.getAllNormalizedRecords()[2].unmappedClosureDetail, 'keep me', 'unmapped fields are retained');

  rt.setArea(dayton);
  rt.context.gridlyDriveTexasConnector.refreshAwarenessView('county-community-change');
  assert.strictEqual(rt.fetchCalls(), 1, 'county/community change reuses fresh retained data without refetch');
  assert.deepStrictEqual(rt.context.gridlyDriveTexasConnector.getAwarenessRecords().map((r) => r.id), ['dayton-work'], 'Dayton area view is independently derived');
  assert.strictEqual(rt.context.gridlyDriveTexasConnector.getAllNormalizedRecords().some((r) => r.id === 'livingston-closure'), true, 'Livingston source record is preserved while Dayton is selected');

  rt.setArea(livingston);
  rt.context.gridlyDriveTexasConnector.refreshAwarenessView('switch-back');
  assert.deepStrictEqual(rt.context.gridlyDriveTexasConnector.getNormalizedRecords().map((r) => r.id), ['livingston-closure'], 'switching back re-derives Livingston records without a new fetch');

  rt.setArea(polkCounty);
  rt.context.gridlyDriveTexasConnector.refreshAwarenessView('awareness-mode-change');
  assert.deepStrictEqual(rt.context.gridlyDriveTexasConnector.getNormalizedRecords().map((r) => r.id), ['livingston-closure'], 'awareness-mode change recomputes the area view');

  const auditBefore = rt.context.gridlyDriveTexasConnector.areaLifecycleAudit();
  const beforeFetchCalls = rt.fetchCalls();
  rt.context.gridlyLp028DriveTexasAreaLifecycleAudit();
  assert.strictEqual(rt.fetchCalls(), beforeFetchCalls, 'passive audit performs no fetch');
  assert.strictEqual(rt.context.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount, 4, 'passive audit performs no filtering');
  assert.strictEqual(rt.context.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount, 0, 'LP016 per-record awareness lookup protection remains intact');
  assert.strictEqual(auditBefore.sourcePresentationOwnershipSeparationActive, true, 'source/presentation ownership separation is active');

  rt.context.fetch = async () => { throw new TypeError('network down'); };
  const failed = await rt.context.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(failed.connected, false, 'failed refetch is reported');
  assert.strictEqual(rt.context.gridlyDriveTexasConnector.getAllNormalizedRecords().length, 3, 'failed refetch does not replace a valid retained dataset with empty records');

  rt.context.fetch = async () => ({ ok: true, status: 200, json: async () => ({ type: 'FeatureCollection', features: [feature('new-livingston', { latitude: 30.712, longitude: -94.932, county: 'Polk', city: 'Livingston', routeName: 'SH 146', category: 'Road Closure', title: 'Replacement' })] }) });
  await rt.context.gridlyDriveTexasConnector.fetchNow();
  assert.deepStrictEqual(rt.context.gridlyDriveTexasConnector.getAllNormalizedRecords().map((r) => r.id), ['new-livingston'], 'successful refetch atomically replaces the complete source dataset');
  assert(rt.refreshes() >= 3, 'Travel Brief refresh owner is notified after derived views are installed');

  assert(connectorSource.includes('staleAreaViewCompletionIgnoredCount'), 'area-view race protection generation is present');
  assert(connectorSource.includes('staleFetchCompletionIgnoredCount'), 'fetch race protection generation is present');
  assert(!fs.readFileSync('service-worker.js', 'utf8').includes('LP028.8 DRIVETEXAS AREA RETENTION TEST SENTINEL'), 'service worker remains unchanged by LP028.8');

  console.log('LP028.8 DriveTexas area retention and refresh checks passed');
})().catch((error) => { console.error(error); process.exit(1); });
