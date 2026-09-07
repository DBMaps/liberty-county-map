const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');

function attributionRuntime() {
  const start = app.indexOf('// LP244.14 UNIFIED INCIDENT ATTRIBUTION GATE START');
  const end = app.indexOf('// LP244.14 UNIFIED INCIDENT ATTRIBUTION GATE END');
  assert.notEqual(start, -1, 'LP244.14 attribution gate exists');
  assert.notEqual(end, -1, 'LP244.14 attribution gate has a bounded end');
  let stackCalls = 0;
  let now = 0;
  const context = {
    Object, String, Number, Boolean, Array, Date, Math, WeakMap, Set,
    gridlyUnifiedIncidentRuntimeProofState: {
      nextUnifiedCallId: 1, activeBuildIds: [], unifiedIncidentCalls: [],
      arrays: new WeakMap(), seenArrayIds: new Set()
    },
    gridlyLP012Now: () => ++now,
    gridlyLP012Round: (value) => Number(value || 0),
    gridlyLP012Bound: (list, item, limit = 180) => { list.push(item); if (list.length > limit) list.splice(0, list.length - limit); return item; },
    gridlyLP012CurrentBuildId: () => null,
    gridlyLP012ArrayId: () => 'array-fixture',
    gridlyLP012StackSummary: () => { stackCalls += 1; return ['consumerCall']; },
    gridlyLP012ClassifyCaller: () => 'consumerCall',
    exposeGridlyAuditHelper: () => {},
    window: {}
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}; this.attributionState = gridlyUnifiedIncidentAttributionState; this.enable = gridlyEnableUnifiedIncidentAttributionAudit; this.begin = gridlyBeginUnifiedIncidentAttributionRead; this.outcome = gridlyRecordUnifiedIncidentCacheOutcome; this.complete = gridlyCompleteUnifiedIncidentAttributionRead; this.audit = gridlyUnifiedIncidentAttributionAudit;`, context);
  const read = ({ cacheHit = false, rows = [], revision = 'r1' } = {}) => {
    const record = context.begin();
    context.outcome({ cacheHit, revision, detailedRecord: record });
    if (!cacheHit) context.attributionState.snapshotBuildCount += 1;
    context.complete(record, rows);
    return rows;
  };
  return { context, read, stackCalls: () => stackCalls };
}

test('default mode leaves detailed attribution disabled', () => {
  const runtime = attributionRuntime();
  assert.equal(runtime.context.audit().detailedAttributionEnabled, false);
});

test('normal cache hit records reuse without stack capture', () => {
  const runtime = attributionRuntime();
  const rows = [{ id: 'cached' }];
  assert.equal(runtime.read({ cacheHit: true, rows }), rows);
  assert.equal(runtime.context.audit().cacheHitCount, 1);
  assert.equal(runtime.stackCalls(), 0);
});

test('normal cache miss builds without stack capture', () => {
  const runtime = attributionRuntime();
  assert.equal(runtime.read({ rows: [{ id: 'built' }] }).length, 1);
  assert.equal(runtime.context.audit().cacheMissCount, 1);
  assert.equal(runtime.context.audit().snapshotBuildCount, 1);
  assert.equal(runtime.stackCalls(), 0);
});

test('repeated normal reads do not accumulate detailed records', () => {
  const runtime = attributionRuntime();
  for (let index = 0; index < 250; index += 1) runtime.read({ cacheHit: index > 0, rows: [] });
  assert.equal(runtime.context.audit().totalReadCount, 250);
  assert.equal(runtime.context.audit().detailedRecordCount, 0);
  assert.equal(runtime.stackCalls(), 0);
});

test('explicit enable captures and classifies subsequent reads', () => {
  const runtime = attributionRuntime();
  runtime.context.enable(true);
  runtime.read({ cacheHit: true, rows: [] });
  assert.equal(runtime.stackCalls(), 1);
  assert.equal(runtime.context.audit().stackCaptureCount, 1);
  assert.equal(runtime.context.audit().detailedRecordCount, 1);
});

test('explicit disable stops future stack capture', () => {
  const runtime = attributionRuntime();
  runtime.context.enable(true); runtime.read({ rows: [] });
  runtime.context.enable(false); runtime.read({ cacheHit: true, rows: [] });
  assert.equal(runtime.stackCalls(), 1);
  assert.equal(runtime.context.audit().totalReadCount, 2);
});

test('diagnostic OFF and ON return identical incident projection', () => {
  const runtime = attributionRuntime();
  const rows = [{ id: 'a', status: 'active', source: 'community' }, { id: 'b', status: 'cleared', source: 'community' }];
  const off = runtime.read({ rows }).map(({ id, status, source }) => ({ id, status, source }));
  runtime.context.enable(true);
  const on = runtime.read({ cacheHit: true, rows }).map(({ id, status, source }) => ({ id, status, source }));
  assert.deepEqual(on, off);
});

test('governed active-condition eligibility remains unchanged', () => {
  assert.match(app, /getGridlyActiveCountSurfaceRows/);
  assert.match(app, /gridlyIsActiveCountSurfaceEligibleRecord/);
});

test('cleared lifecycle remains excluded from active unified truth', () => {
  const snapshotStart = app.indexOf('function gridlyStoreAuthoritativeIncidentSnapshot(');
  const snapshot = app.slice(snapshotStart, app.indexOf('\nfunction getAuthoritativeIncidentSnapshot(', snapshotStart));
  assert.match(snapshot, /status \|\| ""\)\.toLowerCase\(\) === "active"/);
});

test('authoritative snapshot cache reuse remains intact', () => {
  const start = app.indexOf('function getUnifiedIncidents(');
  const body = app.slice(start, app.indexOf('\nfunction getActiveUnifiedIncidents(', start));
  assert.match(body, /__gridlyCachedAuthoritativeSnapshot\.revisionKey === __gridlyAuthoritativeRevisionKey/);
  assert.match(body, /gridlyRecordUnifiedIncidentCacheOutcome\(\{ cacheHit: true/);
  assert.doesNotMatch(body, /const __lp012Frames = gridlyLP012StackSummary\(\)/);
});

test('Route Watch continues to consume governed unified incident truth', () => {
  assert.match(app, /routeWatchSourceHazards/);
  assert.match(app, /getLiveProximityRouteIntelligenceIncidents/);
});

test('Alerts and KBYG governed parity remains wired', () => {
  assert.match(app, /gridlyGovernedActiveConditionParityAudit/);
  assert.match(app, /gridlyBuildTravelBriefModel/);
  assert.match(app, /getGridlyAlertsSurfaceActiveCommunityReportRows/);
});

test('LP244.13 render owner retains unified incident state consumption', () => {
  assert.match(app, /gridlyIncidentRenderReconciliationAudit/);
  assert.match(app, /function renderUnifiedIncidents[\s\S]*?getUnifiedIncidents\(\)/);
});

test('enabled detailed history remains bounded at the established limit', () => {
  const runtime = attributionRuntime();
  runtime.context.enable(true);
  for (let index = 0; index < 220; index += 1) runtime.read({ cacheHit: true, rows: [] });
  const audit = runtime.context.audit();
  assert.equal(audit.historyLimit, 180);
  assert.equal(audit.detailedRecordCount, 180);
  assert.equal(audit.stackCaptureCount, 220);
});
