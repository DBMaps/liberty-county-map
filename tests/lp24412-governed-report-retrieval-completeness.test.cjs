const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');

function paginationRuntime() {
  const start = app.indexOf('// LP244.12 GOVERNED REPORT RETRIEVAL START');
  const end = app.indexOf('// LP244.12 GOVERNED REPORT RETRIEVAL END');
  assert.notEqual(start, -1, 'LP244.12 production pagination block exists');
  assert.notEqual(end, -1, 'LP244.12 production pagination block has a bounded end');
  const context = { Object, String, Number, Array, Map, Set, Promise, Error };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}; this.fetchPages = gridlyFetchCompleteReportPages;`, context);
  return context.fetchPages;
}

function row(id, createdAt, extra = {}) {
  return { id, created_at: createdAt, report_type: 'flooding', expires_at: '2099-01-01T00:00:00.000Z', ...extra };
}

function compareDescending(left, right) {
  return String(right.created_at).localeCompare(String(left.created_at)) || String(right.id).localeCompare(String(left.id));
}

function mockQueryFactory(inputRows, observations, failurePage = 0) {
  const rows = [...inputRows].sort(compareDescending);
  return () => {
    const state = { orders: [], cursor: null, limit: null };
    const query = {
      order(column, options) { state.orders.push([column, options]); return query; },
      or(filter) { state.cursor = filter; return query; },
      limit(value) { state.limit = value; return query; },
      then(resolve) {
        const pageNumber = observations.length + 1;
        observations.push({ ...state, orders: [...state.orders] });
        if (failurePage === pageNumber) return resolve({ data: null, error: { code: 'TEST_FAILURE', message: 'denied' } });
        let eligible = rows;
        if (state.cursor) {
          const match = /^created_at\.lt\.([^,]+),and\(created_at\.eq\.([^,]+),id\.lt\.(.+)\)$/.exec(state.cursor);
          assert.ok(match, `valid keyset cursor: ${state.cursor}`);
          const [, beforeCreatedAt, equalCreatedAt, beforeId] = match;
          eligible = rows.filter((item) => item.created_at < beforeCreatedAt || (item.created_at === equalCreatedAt && item.id < beforeId));
        }
        resolve({ data: eligible.slice(0, state.limit), error: null });
      }
    };
    return query;
  };
}

test('active global saturation retrieves an older local row beyond the former 300-row window', async () => {
  const fetchPages = paginationRuntime();
  const remote = Array.from({ length: 301 }, (_, index) => row(`remote-${String(index).padStart(4, '0')}`, new Date(Date.UTC(2026, 8, 7, 12, 0, index)).toISOString()));
  const local = row('local-governed-report', '2026-09-07T11:00:00.000Z', { county_id: 'liberty-tx' });
  const observations = [];
  const result = await fetchPages(mockQueryFactory([...remote, local], observations), { pageSize: 300, queryFamily: 'active' });
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 302);
  assert.equal(result.rows.some((item) => item.id === local.id), true);
  assert.equal(result.pageCount, 2);
  assert.equal(observations[0].limit, 300);
});

test('clear global saturation retrieves required lifecycle evidence beyond the former 100-row window', async () => {
  const fetchPages = paginationRuntime();
  const remoteClears = Array.from({ length: 101 }, (_, index) => row(`remote-clear-${String(index).padStart(4, '0')}`, new Date(Date.UTC(2026, 8, 7, 12, 0, index)).toISOString(), { report_type: 'hazard_cleared' }));
  const localClear = row('local-clear', '2026-09-07T11:00:00.000Z', { report_type: 'hazard_cleared', detail: '(lifecycle_report_id: local-active)' });
  const result = await fetchPages(mockQueryFactory([...remoteClears, localClear], []), { pageSize: 100, queryFamily: 'clear' });
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 102);
  assert.equal(result.rows.some((item) => item.id === localClear.id), true);
  assert.equal(result.pageCount, 2);
});

test('active and linked clear evidence remain jointly available under simultaneous statewide saturation', async () => {
  const fetchPages = paginationRuntime();
  const active = row('local-active', '2026-09-07T10:00:00.000Z', { county_id: 'liberty-tx' });
  const clear = row('local-linked-clear', '2026-09-07T11:00:00.000Z', { county_id: 'liberty-tx', report_type: 'hazard_cleared', detail: '(lifecycle_report_id: local-active)' });
  const activeRemote = Array.from({ length: 301 }, (_, index) => row(`active-remote-${String(index).padStart(4, '0')}`, new Date(Date.UTC(2026, 8, 7, 12, 0, index)).toISOString()));
  const clearRemote = Array.from({ length: 101 }, (_, index) => row(`clear-remote-${String(index).padStart(4, '0')}`, new Date(Date.UTC(2026, 8, 7, 12, 0, index)).toISOString(), { report_type: 'hazard_cleared' }));
  const [activeResult, clearResult] = await Promise.all([
    fetchPages(mockQueryFactory([...activeRemote, active], []), { pageSize: 300, queryFamily: 'active' }),
    fetchPages(mockQueryFactory([...clearRemote, clear], []), { pageSize: 100, queryFamily: 'clear' })
  ]);
  assert.equal(activeResult.rows.some((item) => item.id === active.id), true);
  const linkedClear = clearResult.rows.find((item) => item.id === clear.id);
  assert.ok(linkedClear);
  assert.match(linkedClear.detail, /lifecycle_report_id: local-active/);
  assert.ok(linkedClear.created_at > active.created_at);
});

test('created_at ties at a page boundary use id as a deterministic keyset tiebreaker', async () => {
  const fetchPages = paginationRuntime();
  const tied = Array.from({ length: 601 }, (_, index) => row(`tie-${String(index).padStart(4, '0')}`, '2026-09-07T12:00:00.000Z'));
  const observations = [];
  const result = await fetchPages(mockQueryFactory(tied, observations), { pageSize: 300, queryFamily: 'active' });
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 601);
  assert.equal(new Set(result.rows.map((item) => item.id)).size, 601);
  assert.equal(result.pageCount, 3);
  for (const query of observations) assert.deepEqual(query.orders.map(([column]) => column), ['created_at', 'id']);
});

test('low volume, empty state, and retrieval error remain explicit and complete or fail closed', async () => {
  const fetchPages = paginationRuntime();
  const low = await fetchPages(mockQueryFactory([row('a', '2026-09-07T12:00:00.000Z')], []), { pageSize: 300, queryFamily: 'active' });
  assert.deepEqual(JSON.parse(JSON.stringify(low.rows.map((item) => item.id))), ['a']);
  assert.equal(low.complete, true);
  const empty = await fetchPages(mockQueryFactory([], []), { pageSize: 300, queryFamily: 'active' });
  assert.equal(empty.rows.length, 0);
  assert.equal(empty.complete, true);
  const failed = await fetchPages(mockQueryFactory([row('a', '2026-09-07T12:00:00.000Z')], [], 1), { pageSize: 300, queryFamily: 'active' });
  assert.equal(failed.complete, false);
  assert.equal(failed.rows.length, 0);
  assert.equal(failed.error.code, 'TEST_FAILURE');
});

test('production uses complete pagination for both active and clear families without global terminal limits', () => {
  const loaderStart = app.indexOf('async function loadSharedReports(');
  const loader = app.slice(loaderStart, app.indexOf('\nfunction normalizeReports(', loaderStart));
  assert.match(loader, /gridlyFetchCompleteReportPages[\s\S]*queryFamily: "active"/);
  assert.match(loader, /gridlyFetchCompleteReportPages[\s\S]*queryFamily: "clear"/);
  assert.doesNotMatch(loader, /\.limit\(300\)|\.limit\(100\)/);
  assert.match(loader, /routeSourceHazards = sourceVisibleNormalized/);
  assert.match(loader, /gridlyReportMatchesActiveCounty/);
  assert.match(loader, /gridlyFilterRoadHazardsByLatestLifecycle/);
});

test('governed geography, legacy recovery, lifecycle, Route Watch, and audit protections remain explicit', () => {
  assert.match(app, /selectedArea\?\.canonicalMultiCountyPlace === true/);
  assert.match(app, /gridlyRecoverReportPlaceIdentity/);
  assert.match(app, /governed_place_coordinate/);
  assert.match(app, /community\.countyWide/);
  assert.match(app, /routeWatchSourceHazards = gridlyFilterRoadHazardsByLatestLifecycle/);
  assert.match(app, /lifecycle_report_id/);
  assert.match(app, /function gridlyGovernedReportRetrievalAudit/);
  for (const field of ['refreshGeneration', 'awarenessScope', 'routeScope', 'activeQueryCount', 'clearQueryCount', 'pageCount', 'rowsRetrieved', 'rowsAfterGovernedEligibility', 'paginationComplete', 'globalLimitRiskRemoved', 'tiedTimestampProtection', 'multiCountyPlaceProtection', 'routeScopeProtection', 'clearLifecycleProtection', 'staleCompletionSuppression', 'lastFailure', 'overallPass']) {
    assert.match(app, new RegExp(`\\b${field}\\b`), field);
  }
});

test('PLACE membership, non-PLACE, county-wide, and legacy coordinate geography retain existing eligibility', () => {
  const start = app.indexOf('function gridlyReportMatchesActiveCounty(');
  const end = app.indexOf('\n// Legacy test sentinel only:', start);
  const context = {
    Object, String, Boolean,
    GRIDLY_DEFAULT_COUNTY_ID: 'liberty-tx',
    GRIDLY_COUNTY_REGISTRY: { 'liberty-tx': { countyFips: '48291' }, 'travis-tx': { countyFips: '48453' }, 'williamson-tx': { countyFips: '48491' } },
    gridlyIsKnownCountyId: (countyId) => ['liberty-tx', 'travis-tx', 'williamson-tx'].includes(countyId),
    gridlyIsCountyOperational: () => true,
    gridlyGetReportCountyId: (record) => record.coordinateCountyId || '',
    getGridlySelectedAwarenessArea: () => ({ placeGeoid: '4805000', canonicalMultiCountyPlace: true, countyMemberships: ['48453', '48491'] })
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}; this.matches = gridlyReportMatchesActiveCounty;`, context);
  assert.equal(context.matches({ reportKind: 'hazard', county_id: 'williamson-tx', placeGeoid: '4805000' }, 'travis-tx'), true, 'Austin membership survives a different valid member county');
  assert.equal(context.matches({ reportKind: 'hazard', county_id: 'travis-tx', communityKey: 'governed-non-place' }, 'travis-tx'), true, 'governed non-PLACE exact county remains eligible');
  assert.equal(context.matches({ reportKind: 'crossing', county_id: 'liberty-tx', countyWide: true }, 'liberty-tx'), true, 'county-wide exact county remains eligible');
  assert.equal(context.matches({ reportKind: 'hazard', coordinateCountyId: 'liberty-tx', lat: 30.05, lng: -94.89 }, 'liberty-tx'), true, 'legacy coordinate-derived county remains eligible');
});
