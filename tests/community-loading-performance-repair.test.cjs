const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js', 'utf8');
const before = require('node:child_process').execFileSync('git', ['show', '9c28c0020aa6ae57882328cf88f6bef40c80359e:js/app.js'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
function source(text, name) {
  const match = text.match(new RegExp(`(?:async )?function ${name}\\([^]*?^\\}`, 'm'));
  assert.ok(match, name); return match[0];
}
function crossingHarness(text, inventory) {
  const box = { crossings: inventory, gridlyCrossingInventoryRevision: 0, gridlyActiveCountyTransitionGeneration: 0, county: 'harris-tx', gridlyGetActiveCountyId() { return this.county; } };
  // Callers do not rely on the receiver of the production county accessor.
  box.gridlyGetActiveCountyId = () => box.county;
  vm.createContext(box);
  vm.runInContext(source(text, 'normalizeGridlyAwarenessAreaLookupText') + '\n' + source(text, 'getGridlyAwarenessIntelligenceCrossing'), box);
  return box;
}
test('indexed lookup preserves every governed county row and ID/name precedence', () => {
  for (const county of ['harris', 'liberty', 'dallas', 'san-jacinto']) {
    const raw = JSON.parse(fs.readFileSync(`Crossing-Packages/${county}/Production/${county}-production-crossings.geojson`, 'utf8').replace(/^\uFEFF/, ''));
    const inventory = raw.features.map((f, i) => ({ id: `FRA-${f.properties.CROSSING || i}`, name: f.properties.STREET || f.properties.HIGHWAY || f.properties.road_name || f.properties.name || '', roadName: f.properties.roadName, road: f.properties.road }));
    const old = crossingHarness(before, inventory), next = crossingHarness(app, inventory);
    for (const row of inventory) {
      for (const query of [row, { crossingId: row.id }, { crossing_id: row.id }, { crossing_id_text: row.id }, { name: row.name }, { crossingId: 'missing', crossingName: row.name }]) {
        assert.equal(next.getGridlyAwarenessIntelligenceCrossing(query), old.getGridlyAwarenessIntelligenceCrossing(query), `${county}: ${row.id}`);
      }
    }
  }
});
test('duplicates, punctuation, ID aliases, spaces, falsy fields and generic incident IDs retain exact matching', () => {
  const inventory = [{ id: 'FRA-A', name: "O’Brien & Main" }, { id: 'FRA-A', name: 'other' }, { crossingId: 'B', roadName: 'OBrien and Main' }, { id: ' C ', road: 'side road' }];
  const old = crossingHarness(before, inventory), next = crossingHarness(app, inventory);
  for (const query of [{}, null, { id: 'FRA-A', name: 'other' }, { crossingId: 'B', name: 'other' }, { crossingId: ' C ', name: 'side road' }, { crossing: "OBRIEN AND MAIN" }, { crossing_id: 0, name: 'other' }, { crossingId: 'missing', name: '' }]) {
    assert.equal(next.getGridlyAwarenessIntelligenceCrossing(query), old.getGridlyAwarenessIntelligenceCrossing(query));
  }
});
for (const change of ['replacement', 'revision', 'county', 'generation', 'normalizer']) test(`crossing index invalidates on ${change}`, () => {
  const box = crossingHarness(app, [{ id: 'a', name: 'first' }]);
  box.getGridlyAwarenessIntelligenceCrossing({ name: 'first' });
  const prior = box.getGridlyAwarenessIntelligenceCrossing.index;
  if (change === 'replacement') box.crossings = [{ id: 'a', name: 'second' }];
  if (change === 'revision') { box.crossings[0].name = 'second'; box.gridlyCrossingInventoryRevision++; }
  if (change === 'county') box.county = 'dallas-tx';
  if (change === 'generation') box.gridlyActiveCountyTransitionGeneration++;
  if (change === 'normalizer') box.normalizeGridlyAwarenessAreaLookupText = s => String(s).toUpperCase();
  box.getGridlyAwarenessIntelligenceCrossing({ crossingId: 'a' });
  assert.notEqual(box.getGridlyAwarenessIntelligenceCrossing.index, prior);
  if (['replacement', 'revision'].includes(change)) assert.equal(box.getGridlyAwarenessIntelligenceCrossing({ name: 'first' }), null);
});
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
test('all ordinary hydration callers share one promise, evict success/rejection and retry', async () => {
  let work = deferred(), calls = 0;
  const box = { gridlyGetActiveCountyId: () => 'harris-tx', gridlyActiveCountyTransitionGeneration: 1, gridlyHydrateCrossings: () => { calls++; return work.promise; } };
  vm.createContext(box); vm.runInContext(source(app, 'loadCrossings'), box);
  const first = box.loadCrossings(); assert.equal(box.loadCrossings(), first);
  await Promise.resolve(); assert.equal(calls, 1);
  work.resolve(); await first; assert.equal(box.loadCrossings.inFlight, null);
  work = deferred(); const failed = box.loadCrossings(); await Promise.resolve(); work.reject(new Error('network failure'));
  await assert.rejects(failed, /network failure/); assert.equal(box.loadCrossings.inFlight, null);
  work = deferred(); const retry = box.loadCrossings(); await Promise.resolve(); work.resolve(); await retry; assert.equal(calls, 3);
});
test('A-B-A work cannot reuse or clear the newer generation promise', async () => {
  const pending = [], box = { county: 'a', gridlyActiveCountyTransitionGeneration: 1 };
  box.gridlyGetActiveCountyId = () => box.county;
  box.gridlyHydrateCrossings = () => { const d = deferred(); pending.push(d); return d.promise; };
  vm.createContext(box); vm.runInContext(source(app, 'loadCrossings'), box);
  const a = box.loadCrossings(); await Promise.resolve();
  box.county = 'b'; box.gridlyActiveCountyTransitionGeneration++; const b = box.loadCrossings(); await Promise.resolve();
  box.county = 'a'; box.gridlyActiveCountyTransitionGeneration++; const again = box.loadCrossings(); await Promise.resolve();
  assert.notEqual(a, again); pending[0].resolve(); await a; assert.equal(box.loadCrossings(), again);
  pending[1].reject(new Error('old B')); await assert.rejects(b); assert.equal(box.loadCrossings(), again);
  pending[2].resolve(); await again; assert.equal(box.loadCrossings.inFlight, null);
});
test('late same-county rejection cannot overwrite a newer A generation failure/UI state', async () => {
  const d = deferred(), writes = [], box = { gridlyActiveCountyTransitionGeneration: 1, gridlyGetActiveCountyId: () => 'a', loadCrossingReviewOverrides: () => d.promise, gridlyRecordCrossingHydrationTrace() {}, safeText: (...a) => writes.push(a), crossingLoadFailed: false, gridlyCrossingInventoryCountyId: 'a', gridlyCrossingInventoryHydrationState: { completed: true } };
  vm.createContext(box); vm.runInContext(source(app, 'gridlyHydrateCrossings'), box);
  const promise = box.gridlyHydrateCrossings('a', 1); writes.length = 0;
  box.gridlyActiveCountyTransitionGeneration = 3; d.reject(new Error('old network')); await promise;
  assert.deepEqual(writes, []); assert.equal(box.crossingLoadFailed, false); assert.equal(box.gridlyCrossingInventoryHydrationState.completed, true);
});
function hydrationHarness() {
  const trace = [], writes = [], b = { crossings: [], crossingReviewOverrides: {}, crossingLoadFailed: false, gridlyActiveCountyTransitionGeneration: 1, gridlyActiveCountyStaleRequestSuppressions: 0, gridlyCrossingInventoryRevision: 0, crossingRenderCrossingsVersion: 0, gridlyCrossingInventoryCountyId: null, gridlyCrossingInventoryHydrationState: {}, gridlyCrossingFallbackAuditState: {}, gridlyCrossingInventoryReloadPromise: null };
  Object.assign(b, { gridlyGetActiveCountyId: () => 'a', gridlyRecordCrossingHydrationTrace: event => trace.push(event), safeText: (...args) => writes.push(args), loadCrossingReviewOverrides: async () => ({}), fetchFraCrossingsWithRetry: async () => ({ json: async () => ({ features: [] }) }), recordGridlyCrossingFallbackAudit() {}, buildGridlyCrossingCoordinateDiagnostics: () => ({ diagnosticNormalizedCount: 0 }), normalizeGridlyCrossingFeatures: rows => rows, shouldShowCrossingInLaunchMode: () => true, gridlyResetRoadNameResolverRuntimeCache() {}, populateCrossingSelect() {}, applyGridlyHomeTownAwarenessContext() {}, scheduleRenderCrossings() {}, syncGridlyAwarenessAreaSurfacesImmediately() {}, evaluateLayoutMode: () => 'portrait', updateDailyHabitStatus() {}, updateLastUpdated() {}, gridlySelectConsumerVisibleCrossings: () => [], getGridlySelectedAwarenessArea: () => null, renderUnifiedIncidents() {}, console: { warn() {}, error() {} } });
  vm.createContext(b); vm.runInContext(source(app, 'loadCrossings') + '\n' + source(app, 'gridlyHydrateCrossings') + '\n' + source(app, 'ensureGridlyActiveCountyCrossingInventory'), b);
  return { b, trace, writes };
}
test('real hydration commits governed empty inventory once and ensure treats it as healthy', async () => {
  const { b, trace } = hydrationHarness(); const first = b.loadCrossings(); assert.equal(b.loadCrossings(), first); await first;
  assert.equal(b.gridlyCrossingInventoryCountyId, 'a'); assert.equal(b.crossings.length, 0);
  assert.equal(b.gridlyCrossingInventoryHydrationState.completed, true); assert.equal(b.gridlyCrossingInventoryRevision, 1);
  assert.equal(trace.filter(x => x === 'INVENTORY_COMMIT').length, 1);
  assert.equal(b.ensureGridlyActiveCountyCrossingInventory('empty'), false);
});
test('real hydration retries a failed source and evicts its failed transaction', async () => {
  const { b } = hydrationHarness(); let requests = 0;
  b.fetchFraCrossingsWithRetry = async () => { if (++requests === 1) throw new Error('HTTP failure'); return { json: async () => ({ features: [] }) }; };
  await b.loadCrossings(); assert.equal(b.crossingLoadFailed, true); assert.equal(b.loadCrossings.inFlight, null);
  await b.loadCrossings(); assert.equal(requests, 2); assert.equal(b.crossingLoadFailed, false); assert.equal(b.gridlyCrossingInventoryHydrationState.completed, true);
});
test('real late successful A hydration cannot commit into a newer A generation', async () => {
  const { b, writes, trace } = hydrationHarness(), d = deferred();
  b.fetchFraCrossingsWithRetry = () => d.promise;
  const first = b.loadCrossings(); await Promise.resolve(); await Promise.resolve();
  b.gridlyActiveCountyTransitionGeneration = 3; b.crossings = [{ id: 'new-A' }]; const inventory = b.crossings; writes.length = 0;
  d.resolve({ json: async () => ({ features: [{ id: 'old-A' }] }) }); await first;
  assert.equal(b.crossings, inventory); assert.equal(b.gridlyCrossingInventoryRevision, 0); assert.deepEqual(writes, []); assert.ok(trace.includes('COMMIT_GUARD_REJECT'));
});
test('popup binding defers the unchanged model and reads the current report on activation', () => {
  const start = app.indexOf('const popupContent = () => buildPopup(crossing, getLatestReportForCrossing(crossing.id));');
  assert.notEqual(start, -1);
  let builds = 0, latest = { type: 'blocked' };
  const box = { crossing: { id: 'FRA-A' }, buildPopup: (c, r) => { builds++; return `${c.id}:${r.type}`; }, getLatestReportForCrossing: () => latest };
  vm.createContext(box); vm.runInContext(app.slice(start, app.indexOf(';', start) + 1) + ';this.content=popupContent;', box);
  assert.equal(builds, 0); latest = { type: 'cleared' }; assert.equal(box.content(), 'FRA-A:cleared'); assert.equal(builds, 1);
  assert.match(source(app, 'finalizeOpenCrossingPopup'), /prepareGridlyCrossingPopupContent\(marker, session.crossing, session.report\)/);
});
test('production road diagnostics never allocate Error stacks; explicit diagnostics remain available', () => {
  let enabled = false, stacks = 0;
  class ErrorProbe { get stack() { stacks++; return 'Error\n at resolveNearbyRoadPair (app.js:1:1)'; } }
  const box = { Error: ErrorProbe, isGridlyExplicitDebugModeEnabled: () => enabled, gridlyNormalizeLp016SelectedAreaCallerFrame: s => ({ name: s, source: 'app.js' }) };
  vm.createContext(box); vm.runInContext(source(app, 'gridlyGetInvalidRoadLabelCaller'), box);
  for (let i = 0; i < 10000; i++) box.gridlyGetInvalidRoadLabelCaller(); assert.equal(stacks, 0);
  enabled = true; assert.match(box.gridlyGetInvalidRoadLabelCaller().name, /resolveNearbyRoadPair/); assert.equal(stacks, 1);
});
function summaryHarness() {
  const b = { activeReports: [{ id: 'r', status: 'active', expiresAt: 100 }], activeHazards: [{ id: 'h', status: 'active' }], area: { key: 'place-a', countyId: 'a' }, context: { generation: 1, health: 'FRESH' }, county: 'a', coverage: 'fresh', provider: [], weather: [], now: 1, gridlyCrossingInventoryCountyId: 'a', gridlyCrossingInventoryRevision: 1, crossingRenderCrossingsVersion: 1, gridlyActiveCountyTransitionGeneration: 1, gridlyRoadwayDatasetRevision: 1, gridlyCrossingInventoryHydrationState: { completed: true } };
  b.window = b; b.gridlyGetActiveCountyId = () => b.county; b.getGridlySelectedAwarenessArea = () => b.area; b.gridlyGetCurrentAwarenessContext = () => b.context;
  b.gridlyGetCanonicalActiveCommunityState = () => ({ revision: b.now < 100 ? 'active' : 'expired' }); b.gridlySourceCoverageRevision = () => b.coverage;
  b.gridlyDriveTexasConnector = { getAllNormalizedRecords: () => b.provider }; b.gridlyWeatherConnector = { getNormalizedRecords: () => b.weather };
  b.getGridlyAwarenessSummaryAreaIdentity = () => 'a'; b.getGridlyCurrentSelectedAwarenessAreaIdentity = () => 'a';
  vm.createContext(b); vm.runInContext(source(app, 'gridlyAwarenessSummaryInputRevision') + '\n' + source(app, 'isGridlyCachedAwarenessSummaryForCurrentArea'), b); return b;
}
const mutations = {
  'report update': b => b.activeReports[0].type = 'cleared',
  'hazard clearing': b => b.activeHazards.length = 0,
  'freshness expiration': b => b.now = 100,
  'source health': b => b.coverage = 'stale',
  'area change': b => b.area.key = 'place-b',
  'county change': b => b.county = 'b',
  'same county new generation': b => b.gridlyActiveCountyTransitionGeneration++,
  'temporary GPS expiration': b => b.context.health = 'STALE',
  'DriveTexas evidence': b => b.provider.push({ id: 'countywide-warning' }),
  'NWS evidence': b => b.weather.push({ id: 'nws-warning' }),
  'crossing hydration': b => b.gridlyCrossingInventoryRevision++,
  'road geometry': b => b.gridlyRoadwayDatasetRevision++
};
for (const [label, mutate] of Object.entries(mutations)) test(`shared summary rejects ${label} without dropping source evidence`, () => {
  const b = summaryHarness(), summary = { awarenessInputRevision: b.gridlyAwarenessSummaryInputRevision() };
  assert.equal(b.isGridlyCachedAwarenessSummaryForCurrentArea(summary), true); mutate(b);
  assert.equal(b.isGridlyCachedAwarenessSummaryForCurrentArea(summary), false);
  assert.equal(b.isGridlyCachedAwarenessSummaryForCurrentArea({ awarenessInputRevision: b.gridlyAwarenessSummaryInputRevision() }), true);
});
test('unserializable evidence never authorizes summary reuse', () => {
  const b = summaryHarness(); b.activeHazards[0].self = b.activeHazards[0];
  assert.equal(b.gridlyAwarenessSummaryInputRevision(), null);
  assert.equal(b.isGridlyCachedAwarenessSummaryForCurrentArea({ awarenessInputRevision: null }), false);
});
