const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const providerSource = fs.readFileSync('js/gridlyDriveTexasProvider.js', 'utf8');
const connectorSource = fs.readFileSync('js/gridlyDriveTexasLiveConnector.js', 'utf8');

assert(connectorSource.includes('function lp042DriveTexasConnectorAwarenessFilterCertificationAudit'), 'LP042 audit helper exists');
assert(connectorSource.includes('fullGeometryUsed: false'), 'LP042 reports full geometry is not used');
assert(connectorSource.includes('midpointCoordinateUsed: true'), 'LP042 reports midpoint coordinates are used');
assert(!connectorSource.includes('radiusMiles: 90'), 'no radius widening');
assert(!connectorSource.includes('liberty county hardcode production'), 'no Liberty production hardcode marker');

const fixture = { type: 'FeatureCollection', features: [
  { type: 'Feature', properties: { GLOBALID: 'crossing-midpoint-outside', condition: 'Construction', route_name: 'US 90', description: 'Route-only work zone', start_time: '2026-07-21T00:00:00Z' }, geometry: { type: 'LineString', coordinates: [[-94.8852, 30.0466], [-95.3000, 30.3000], [-95.4000, 30.4000]] } },
  { type: 'Feature', properties: { GLOBALID: 'fully-outside', condition: 'Construction', route_name: 'FM 2100', description: 'No matching place', start_time: '2026-07-21T00:00:00Z' }, geometry: { type: 'LineString', coordinates: [[-95.4, 30.4], [-95.5, 30.5]] } },
  { type: 'Feature', properties: { GLOBALID: 'midpoint-inside', condition: 'Closure', route_name: 'SH 321', description: 'No matching place', start_time: '2026-07-21T00:00:00Z' }, geometry: { type: 'LineString', coordinates: [[-94.9, 30.04], [-94.8852, 30.0466], [-94.88, 30.05]] } },
  { type: 'Feature', properties: { GLOBALID: 'invalid-dayton-text', condition: 'Construction', route_name: 'SH 146', description: '<b>Dayton</b> maintenance', start_time: '2026-07-21T00:00:00Z' }, geometry: null },
  { type: 'Feature', properties: { GLOBALID: 'route-only-us90', condition: 'Construction', route_name: 'US 90', description: 'No place fields', start_time: '2026-07-21T00:00:00Z' }, geometry: { type: 'Point', coordinates: [-95.6, 30.6] } },
  { type: 'Feature', properties: { GLOBALID: 'both', condition: 'Construction', route_name: 'FM 1960', description: 'Dayton and liberty-tx alias text', start_time: '2026-07-21T00:00:00Z' }, geometry: { type: 'Point', coordinates: [-94.8852, 30.0466] } },
  { type: 'Feature', properties: { GLOBALID: 'neither', condition: 'Construction', route_name: 'IH 10', description: 'Elsewhere', start_time: '2026-07-21T00:00:00Z' }, geometry: { type: 'Point', coordinates: [-96, 31] } }
]};

let fetchCalls = 0, timerCalls = 0, writes = 0;
const storage = { setItem() { writes += 1; }, removeItem() { writes += 1; }, clear() { writes += 1; } };
const sandbox = {
  console, window: null, globalThis: null, module: { exports: {} },
  GRIDLY_CONFIG: { driveTexas: { enabled: true, apiKey: 'SECRET' } },
  fetch() { fetchCalls += 1; return Promise.resolve({ ok: true, status: 200, headers: { get() { return null; } }, json: () => Promise.resolve(fixture) }); },
  setTimeout() { timerCalls += 1; return 1; }, clearTimeout() {}, localStorage: storage, sessionStorage: storage,
  getGridlySelectedAwarenessArea() { return { countyId: 'liberty-tx', label: 'Dayton', storageValue: 'dayton-tx', key: 'dayton-tx', lat: 30.0466, lng: -94.8852, radiusMiles: 8 }; },
  getDistanceMiles(aLat, aLng, bLat, bLng) { const dx = (Number(aLat) - Number(bLat)) * 69; const dy = (Number(aLng) - Number(bLng)) * 60; return Math.sqrt(dx * dx + dy * dy); },
  gridlySelectDriveTexasAuthority(input = {}) { return { consumerEligibleSituations: input.records || [] }; },
  gridlyGetDriveTexasAuthoritySnapshot(input = {}) { return { counts: { rawRecordCount: (input.records || []).length }, authority: { selectedAwarenessArea: this.getGridlySelectedAwarenessArea() } }; }
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(providerSource, sandbox, { filename: 'js/gridlyDriveTexasProvider.js' });
vm.runInContext(connectorSource, sandbox, { filename: 'js/gridlyDriveTexasLiveConnector.js' });

(async () => {
  await sandbox.gridlyDriveTexasConnector.fetchNow();
  const before = { fetchCalls, timerCalls, writes, output: sandbox.gridlyDriveTexasConnector.getNormalizedRecords().length };
  const audit = sandbox.gridlyLp042DriveTexasConnectorAwarenessFilterCertificationAudit();
  const trace = sandbox.gridlyLp042DriveTexasConnectorFilterRecordTrace('US 90');
  assert.strictEqual(fetchCalls, before.fetchCalls, 'helper performs no fetch');
  assert.strictEqual(timerCalls, before.timerCalls, 'helper performs no polling');
  assert.strictEqual(writes, before.writes, 'helper performs no writes/storage mutation');
  assert.strictEqual(sandbox.gridlyDriveTexasConnector.getNormalizedRecords().length, before.output, 'filter output remains unchanged');
  assert.strictEqual(audit.passive, true, 'helper is passive');
  assert.strictEqual(audit.noFetches, true, 'declares no fetches');
  assert.strictEqual(audit.selectedAwarenessContext.awarenessLabel, 'Dayton', 'selected awareness context is reported');
  assert.strictEqual(audit.connectorFilterContract.inputCount, 7, 'connector filter input is reported');
  assert.strictEqual(typeof audit.connectorFilterContract.outputCount, 'number', 'connector output is reported');
  assert.strictEqual(audit.connectorFilterContract.pointRadiusEnabled, true, 'point path distinguished');
  assert.strictEqual(audit.connectorFilterContract.textFallbackEnabled, true, 'text fallback path distinguished');
  assert.strictEqual(audit.connectorFilterContract.fullGeometryUsed, false, 'full geometry usage reported truthfully');
  assert.strictEqual(audit.connectorFilterContract.midpointCoordinateUsed, true, 'midpoint handling reported');
  assert(audit.geographicDecisionTrace.coordinateOrder.includes('latitude, longitude'), 'coordinate order reported');
  assert.strictEqual(audit.geographicDecisionTrace.units, 'miles', 'units reported');
  assert(audit.textFallbackDecisionTrace.sourceFields.includes('description'), 'text fields reported');
  assert(audit.selectedAwarenessContext.textTokens.includes('dayton'), 'awareness tokens reported');
  assert(audit.exclusionReasonCounts.awareness_text_absent_from_normalized_provider_fields >= 1, 'exclusion reasons counted');
  assert(trace.results.some((r) => r.sourceId === 'route-only-us90'), 'US 90 candidates traceable');
  assert(audit.pipelineOwnership.completeCacheAvailableToLp039, 'LP039 complete cache availability reported');
  assert.strictEqual(audit.recommendation.currentFilterTooNarrow, true, 'architecture recommendation produced');
  assert.strictEqual(JSON.stringify(audit).includes('Official Roadways'), false, 'no consumer wording change');
  assert.strictEqual(audit.recommendation.rejectedRepairs.includes('radius widening'), true, 'no radius widening recommendation');
  assert.strictEqual(audit.connectorFilterContract.connectorOwnsAuthority, false, 'no route-name-only authority');
  console.log('LP042 DriveTexas connector awareness filter certification checks passed');
})().catch((error) => { console.error(error); process.exit(1); });
