const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const providerSource = fs.readFileSync('js/gridlyDriveTexasProvider.js', 'utf8');
const connectorSource = fs.readFileSync('js/gridlyDriveTexasLiveConnector.js', 'utf8');

assert(connectorSource.includes('function lp041DriveTexasLiveProviderEvidenceAudit'), 'LP041 audit helper exists');
assert(connectorSource.includes('globalScope.gridlyLp041DriveTexasLiveProviderEvidenceAudit = lp041DriveTexasLiveProviderEvidenceAudit'), 'LP041 helper is exposed');
assert(connectorSource.includes('globalScope.gridlyLp041DriveTexasProviderRecordTrace = lp041RecordTrace'), 'LP041 record trace helper is exposed');
assert(!connectorSource.includes('radiusMiles: 90'), 'no arbitrary radius widening is added');
assert(!connectorSource.includes('Official Roadways') || !connectorSource.includes('DriveTexas'), 'test does not force stale consumer wording');

const fixture = {
  type: 'FeatureCollection',
  totalCount: 6,
  exceededTransferLimit: false,
  features: [
    { type: 'Feature', properties: { GLOBALID: 'inside-point', condition: 'Construction', route_name: 'FM 2100', description: 'Construction in Dayton', city: 'Dayton', county: 'Liberty', start_time: '2026-07-01' }, geometry: { type: 'Point', coordinates: [-94.8852, 30.0466] } },
    { type: 'Feature', properties: { GLOBALID: 'us90-line', type: 'Construction', roadway: 'US 90', headline: 'US Highway 90 construction near Dayton limits', county: 'Liberty', district: 'Beaumont', limits: 'from SH 321 to FM 1413', startTime: '2026-07-02' }, geometry: { type: 'LineString', coordinates: [[-95.3, 30.0], [-95.2, 30.1], [-95.1, 30.2]] } },
    { type: 'Feature', properties: { GLOBALID: 'us90-text-only', category: 'Construction', road: 'US090', title: 'US090 work in Dayton text only', city: 'Dayton' }, geometry: null },
    { type: 'Feature', properties: { GLOBALID: 'non-us90', condition: 'Construction', route_name: 'SH 146', description: 'Construction elsewhere' }, geometry: { type: 'Point', coordinates: [-96, 31] } },
    null,
    'malformed-feature'
  ]
};

let fetchCalls = 0;
let intervalCalls = 0;
let writes = 0;
const storage = { setItem() { writes += 1; }, removeItem() { writes += 1; }, clear() { writes += 1; } };
const sandbox = {
  console,
  window: null,
  globalThis: null,
  module: { exports: {} },
  GRIDLY_CONFIG: { driveTexas: { enabled: true, apiKey: 'SECRET_API_KEY_123' } },
  fetch(url, options) {
    fetchCalls += 1;
    assert(url.includes('key=SECRET_API_KEY_123'), 'normal connector request still uses configured endpoint key');
    assert.strictEqual(options.method, 'GET', 'normal GET behavior is unchanged');
    assert.strictEqual(options.cache, 'no-store', 'normal cache behavior is unchanged');
    return Promise.resolve({
      ok: true,
      status: 200,
      headers: { get(name) { return ({ 'content-type': 'application/geo+json', 'content-length': '1234', etag: 'W/fixture', 'last-modified': 'Tue, 21 Jul 2026 00:00:00 GMT', 'cache-control': 'no-store', 'x-total-count': '6' })[String(name).toLowerCase()] || null; } },
      json: () => Promise.resolve(fixture)
    });
  },
  setTimeout(fn) { intervalCalls += 1; return 1; },
  clearTimeout() {},
  localStorage: storage,
  sessionStorage: storage,
  getGridlySelectedAwarenessArea() { return { countyId: 'liberty-tx', label: 'Dayton', storageValue: 'dayton-tx', key: 'dayton-tx', lat: 30.0466, lng: -94.8852, radiusMiles: 8 }; },
  getDistanceMiles(aLat, aLng, bLat, bLng) { const dx = (Number(aLat) - Number(bLat)) * 69; const dy = (Number(aLng) - Number(bLng)) * 60; return Math.sqrt(dx * dx + dy * dy); }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(providerSource, sandbox, { filename: 'js/gridlyDriveTexasProvider.js' });
vm.runInContext(connectorSource, sandbox, { filename: 'js/gridlyDriveTexasLiveConnector.js' });

(async () => {
  assert.strictEqual(typeof sandbox.gridlyLp041DriveTexasLiveProviderEvidenceAudit, 'function', 'LP041 audit helper exists at runtime');
  assert.strictEqual(typeof sandbox.gridlyLp041DriveTexasProviderRecordTrace, 'function', 'LP041 trace helper exists at runtime');
  await sandbox.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(fetchCalls, 1, 'normal connector performs one sanctioned fetch');
  const beforeFetchCalls = fetchCalls;
  const beforeWrites = writes;
  const beforeTimers = intervalCalls;
  const audit = sandbox.gridlyLp041DriveTexasLiveProviderEvidenceAudit();
  const trace = sandbox.gridlyLp041DriveTexasProviderRecordTrace('US 90');
  assert.strictEqual(fetchCalls, beforeFetchCalls, 'helper performs no fetch');
  assert.strictEqual(intervalCalls, beforeTimers, 'helper performs no polling');
  assert.strictEqual(writes, beforeWrites, 'helper performs no storage changes or writes');
  assert.strictEqual(audit.passive, true, 'helper is passive');
  assert.strictEqual(audit.noFetches, true, 'helper declares no fetches');
  assert.strictEqual(audit.noWrites, true, 'helper declares no writes');
  assert.strictEqual(JSON.stringify(audit).includes('SECRET_API_KEY_123'), false, 'API key is redacted');
  assert.strictEqual(audit.requestEvidence.endpointRedacted.includes('{api_key_redacted}'), true, 'endpoint is redacted');
  assert.strictEqual(audit.payloadEvidence.rawFeatureCount, 6, 'raw feature count is captured from normal response');
  assert.strictEqual(audit.pipelineCountTrace.parsedFeatureCount, 6, 'parsed feature count is captured');
  assert.strictEqual(audit.normalizationTrace.inputCount, 6, 'normalization input count captured');
  assert.strictEqual(audit.normalizationTrace.outputCount, 4, 'normalization output count captured');
  assert(audit.normalizationTrace.failureCount >= 1, 'normalization failures are counted');
  assert.strictEqual(audit.rawFeatureInventory.geometryTypeCounts.Point, 2, 'Point geometry inventoried');
  assert.strictEqual(audit.rawFeatureInventory.geometryTypeCounts.LineString, 1, 'LineString geometry inventoried');
  assert.strictEqual(audit.rawFeatureInventory.geometryTypeCounts.null, 1, 'null geometry inventoried');
  assert(audit.rawFeatureInventory.rawCategoryValueCounts.Construction >= 2, 'raw categories are inventoried');
  assert(audit.rawFeatureInventory.propertyFieldNames.includes('GLOBALID'), 'provider field names are inventoried');
  assert.strictEqual(audit.connectorFilterTrace.inputCount, 4, 'connector filter input count captured');
  assert.strictEqual(typeof audit.connectorFilterTrace.outputCount, 'number', 'connector filter output count captured');
  assert(audit.connectorFilterTrace.pointRadiusMatchCount >= 1, 'point match count captured');
  assert(audit.connectorFilterTrace.textFallbackMatchCount >= 1, 'text fallback count captured');
  assert.strictEqual(audit.connectorFilterTrace.diagnosticOnly, 'diagnostic source scoping', 'connector filtering is diagnostic, not authority');
  assert.strictEqual(audit.connectorFilterTrace.certifiedAuthorityOwner, false, 'connector filtering is not certified authority');
  assert(audit.us90Evidence.rawCandidateCount >= 2, 'US 90 raw candidates are traceable');
  assert(audit.us90Evidence.normalizedCandidateCount >= 2, 'US 90 normalized candidates are traceable');
  assert.strictEqual(trace.textMatchingAffectsProductionEligibility, false, 'text query matching does not affect production eligibility');
  assert(audit.us90Evidence.candidateRecords.length <= 50, 'bounded memory behavior is enforced');
  assert.strictEqual(JSON.stringify(audit).includes('features":[{"type"'), false, 'no full raw payload is retained');
  assert.strictEqual(connectorSource.includes('US 90') && connectorSource.includes('lp041QueryTerms'), true, 'US 90 appears only as diagnostic query vocabulary');
  assert.strictEqual(audit.providerCompletenessEvidence.completenessCertified, false, 'completeness is not over-claimed');
  console.log('LP041 DriveTexas live provider evidence capture checks passed');
})().catch((error) => { console.error(error); process.exit(1); });
