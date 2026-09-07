import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const between = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const popup = between('function gridlyCommunityPopupActionsEligible', 'function gridlyHazardPopupAudit');
const dispatch = between('function mapUnifiedRailConfirmType', 'function getHazardConfidenceLabel');
const persistence = between('async function gridlyPersistExactHazardClear', 'window.clearHazard = async function');

function popupRuntime() {
  const context = {
    Object, String, Number, Date, console,
    gridlyNowMs: () => 0, gridlyGetPopupBuilderFunctionName: () => 'buildUnifiedIncidentPopup', gridlyAddPopupAuditDuration: () => {},
    gridlyResolveCommunityIncidentLifecycleTarget: (incident) => ({ persistedReportId: incident.sourceReportId, hazardType: incident.report_type }),
    buildGridlyHazardPopupConsumerModel: () => ({ title: 'Flooding', locationLine: 'US 90 near Dayton', guidanceLine: '', confidenceLine: 'Awaiting additional reports', freshnessLine: 'Updated just now' }),
    gridlyLp021ResolvedLocationPresentation: () => ({}), gridlyLp021RecordLocationTrace: () => {}, sanitizeText: String,
    getIncidentLifecycleState: (row) => row.status, GRIDLY_HAZARD_POPUP_TECHNICAL_METADATA_PATTERN: /$a/, lastGridlyHazardPopupConsumerState: null
  };
  vm.createContext(context); vm.runInContext(`${popup}; this.render = buildUnifiedIncidentPopup;`, context); return context;
}

test('rendered Mark Cleared routes through the production dispatcher with exact identity', async () => {
  const incident = { id: 'road-visible', sourceReportId: 'report-authority-1', report_type: 'flooding', status: 'active', lat: 30.0466, lng: -94.885198 };
  const html = popupRuntime().render(incident);
  const attrs = Object.fromEntries([...html.matchAll(/data-([\w-]+)="([^"]*)"/g)].map((m) => [m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase()), m[2]]));
  assert.match(html, />Mark Cleared<\/button>/);
  assert.equal(attrs.lifecycleReportId, incident.sourceReportId);
  const calls = [];
  const context = {
    Object, String, Number, Date, console, crossings: [],
    getUnifiedIncidents: () => [incident], gridlyResolveCommunityIncidentLifecycleTarget: (_row, rendered) => ({ persistedReportId: rendered.lifecycleReportId, hazardType: rendered.lifecycleReportType, lat: Number(rendered.lat), lng: Number(rendered.lng) }),
    gridlyRecordHazardClearLifecycle: () => {}, setConfirmation: () => {}, window: { clearHazard: (...args) => calls.push(args) }
  };
  vm.createContext(context); vm.runInContext(`${dispatch}; this.handle = handleUnifiedIncidentAction;`, context);
  const button = { dataset: { ...attrs, unifiedAction: 'cleared' } };
  await context.handle(button);
  assert.deepEqual(calls[0].slice(0, 4), ['flooding', 30.0466, -94.885198, 'report-authority-1']);
  assert.equal(calls[0].length, 4);
});

function persistenceRuntime(response) {
  const events = [];
  const query = { select(columns) { events.push(['select', columns]); return Promise.resolve(response); } };
  const context = {
    Object, String, Array, Promise, Error,
    GRIDLY_REPORTS_BASE_INSERT_KEYS: ['crossing_id', 'detail', 'report_type'], GRIDLY_REPORTS_BASE_SELECT_COLUMNS: 'id,detail,report_type',
    gridlyPickRowKeys: (row) => row, supabaseClient: {},
    gridlyInsertWithCountyMetadataFallback: async (_client, table, row) => { events.push(['insert', table, row]); return query.select('id,detail,report_type'); },
    gridlyRecordHazardClearLifecycle: (...args) => events.push(args), normalizeReports: (rows) => rows.map((row) => ({ ...row, lifecycleIdentity: /lifecycle_report_id:\s*([^\s)]+)/.exec(row.detail)?.[1] || '', type: row.report_type })),
    gridlyIsRoadClearedHazardRecord: (row) => row.type === 'hazard_cleared'
  };
  vm.createContext(context); vm.runInContext(`${persistence}; this.persist = gridlyPersistExactHazardClear;`, context); return { context, events };
}

test('successful mutation proves exactly one linked clear row and retains cleared authority on rehydration', async () => {
  const returned = { id: 'clear-1', report_type: 'hazard_cleared', detail: 'Shared report (lifecycle_report_id: report-authority-1)' };
  const { context, events } = persistenceRuntime({ data: [returned], error: null });
  const result = await context.persist(returned, 'report-authority-1');
  assert.equal(result.lifecycleIdentity, 'report-authority-1');
  assert.equal(events.filter((e) => e[0] === 'insert').length, 1);
  assert.equal(events.filter((e) => e[0] === 'affected_row_confirmed').length, 1);
  const lifecycle = between('function gridlyRoadHazardLatestLifecycleState', 'function gridlyRoadClearSupersededByNewerActive');
  assert.match(lifecycle, /clearTime > eventTime \? "cleared" : "active"/);
  assert.match(source, /normalized\.filter\(gridlyIsRoadClearedHazardRecord\)[\s\S]*gridlyCacheClearedHazardAuthority/);
});

test('zero affected rows and identity mismatch are persistence failures', async () => {
  await assert.rejects(persistenceRuntime({ data: [], error: null }).context.persist({ report_type: 'hazard_cleared', detail: '(lifecycle_report_id: a)' }, 'a'), /one affected row/);
  await assert.rejects(persistenceRuntime({ data: [{ id: 'c', report_type: 'hazard_cleared', detail: '(lifecycle_report_id: other)' }], error: null }).context.persist({}, 'a'), /identity mismatch/);
});

test('accepted-local active cache cannot resurrect cleared authority and all active projections share exclusion', () => {
  const merge = between('function gridlyMergeAcceptedLocalHazardsIntoActiveInventory', 'function gridlyMergeAcceptedLocalCrossingReportsIntoActiveInventory');
  assert.match(merge, /gridlyHazardHasClearedAuthority\(report\)[\s\S]*delete\(canonicalReportId\)/);
  assert.match(source, /consumers: \["map", "location_context", "alerts", "kbyg"\]/);
  assert.match(source, /gridlyFilterRoadHazardsByLatestLifecycle\(visibleHazards/);
  assert.match(source, /gridlyMaybeGenerateHistoricalProjection/);
});

test('pending state is bounded, duplicate-safe, and failure restores truthful UI', () => {
  const clear = between('window.clearHazard = async function', 'function injectHazardStyles');
  assert.match(clear, /roadHazardClearInFlightKeys\.has/);
  assert.match(clear, /buttonEl\.disabled = true/);
  assert.match(clear, /GRIDLY_HAZARD_CLEAR_TIMEOUT_MS[\s\S]*Promise\.race/);
  assert.match(clear, /finishPending\(\)[\s\S]*This report was not cleared/);
  assert.match(clear, /refreshReportHazardViews\("hazard_clear_failure_restore"\)/);
  assert.ok(clear.indexOf('await Promise.race') < clear.indexOf('gridlyApplyImmediateClearLifecycleConvergence'));
});

test('unrelated active reports and LP244.2B submission/confirmation paths remain untouched', () => {
  assert.match(source, /activeHazards = gridlyFilterRoadHazardsByLatestLifecycle\(visibleHazards/);
  assert.match(source, /function submitGovernedRoadHazardDraft/);
  assert.match(source, /lifecycleTargetReportId: communityLifecycleTarget\.persistedReportId/);
});
