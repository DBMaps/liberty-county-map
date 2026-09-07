const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync('js/app.js', 'utf8');

function ownerRuntime({ ready = true, layout = 'desktop', incidents = [] } = {}) {
  const start = app.indexOf('// LP244.13 INCIDENT RENDER RECONCILIATION START');
  const end = app.indexOf('// LP244.13 INCIDENT RENDER RECONCILIATION END');
  assert.notEqual(start, -1, 'LP244.13 reconciliation owner exists');
  assert.notEqual(end, -1, 'LP244.13 reconciliation owner has a bounded end');
  const timers = [];
  let currentIncidents = [...incidents];
  const layer = { rows: [], getLayers() { return this.rows; } };
  const context = {
    Object, String, Number, Boolean, Array, Date, Math, Error,
    map: ready ? { _popup: null } : null,
    L: ready ? { layerGroup() {} } : undefined,
    unifiedIncidentLayer: layer,
    gridlyV734RefreshReuseState: { renderUnifiedSignature: '', renderUnifiedReuseCount: 0 },
    evaluateLayoutMode: () => layout,
    renderUnifiedIncidents: () => { layer.rows = [...currentIncidents]; },
    setTimeout: (fn, delay) => { const timer = { fn, delay, cancelled: false }; timers.push(timer); return timer; },
    clearTimeout: (timer) => { if (timer) timer.cancelled = true; }
  };
  vm.createContext(context);
  vm.runInContext(`${app.slice(start, end)}; this.publish = gridlyPublishIncidentRenderRevision; this.request = gridlyRequestIncidentRenderReconciliation; this.retry = gridlyExecuteIncidentRenderRetry; this.audit = gridlyIncidentRenderReconciliationAudit;`, context);
  return { context, layer, timers, setIncidents: (rows) => { currentIncidents = [...rows]; } };
}

test('quiet publication reconciles empty once and records zero as complete', () => {
  const runtime = ownerRuntime({ incidents: [] });
  const revision = runtime.context.publish('quiet');
  const first = runtime.context.audit();
  assert.equal(revision, 1);
  assert.equal(first.renderRequestCount, 1);
  assert.equal(first.renderExecutionCount, 1);
  assert.equal(first.emptyRenderCount, 1);
  assert.equal(first.lastReconciledRevision, 1);
  runtime.context.request({ revision, reason: 'duplicate' });
  assert.equal(runtime.context.audit().renderExecutionCount, 1);
  assert.equal(runtime.context.audit().reusedRenderCount, 1);
});

test('single active incident creates exactly one final marker set', () => {
  const runtime = ownerRuntime({ incidents: [{ id: 'a' }] });
  runtime.context.publish('single');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.layer.rows.map((row) => row.id))), ['a']);
  assert.equal(runtime.context.audit().renderExecutionCount, 1);
});

test('multiple active incidents preserve identities, order, and count', () => {
  const runtime = ownerRuntime({ incidents: [{ id: 'b' }, { id: 'c' }, { id: 'd' }] });
  runtime.context.publish('multiple');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.layer.rows.map((row) => row.id))), ['b', 'c', 'd']);
  assert.equal(runtime.layer.rows.length, 3);
  assert.equal(runtime.context.audit().renderExecutionCount, 1);
});

test('successive nonempty revisions each reconcile once', () => {
  const runtime = ownerRuntime({ incidents: [{ id: 'a' }] });
  runtime.context.publish('single');
  runtime.setIncidents([{ id: 'b' }, { id: 'c' }, { id: 'd' }]);
  runtime.context.publish('multiple');
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.layer.rows.map((row) => row.id))), ['b', 'c', 'd']);
  assert.equal(runtime.context.audit().renderExecutionCount, 2);
});

test('clear publication removes the marker and a stale retry cannot recreate it', () => {
  const runtime = ownerRuntime({ incidents: [{ id: 'active' }] });
  const activeRevision = runtime.context.publish('active');
  runtime.setIncidents([]);
  runtime.context.publish('clear');
  assert.equal(runtime.layer.rows.length, 0);
  runtime.setIncidents([{ id: 'stale-active' }]);
  runtime.context.retry(activeRevision, 'stale-active-retry');
  assert.equal(runtime.layer.rows.length, 0);
  assert.equal(runtime.context.audit().staleRetrySuppressedCount, 1);
  assert.equal(runtime.context.audit().clearRemovalCount, 1);
});

test('delayed readiness schedules one bounded retry and renders once when ready', () => {
  const runtime = ownerRuntime({ ready: false, incidents: [{ id: 'late' }] });
  runtime.context.publish('late-map');
  assert.equal(runtime.context.audit().renderExecutionCount, 0);
  assert.equal(runtime.timers.length, 1);
  assert.equal(runtime.timers[0].delay, 500);
  runtime.context.map = { _popup: null };
  runtime.context.L = { layerGroup() {} };
  runtime.timers[0].fn();
  assert.equal(runtime.context.audit().renderExecutionCount, 1);
  assert.equal(runtime.layer.rows[0].id, 'late');
});

test('readiness that never arrives stops after the single retry', () => {
  const runtime = ownerRuntime({ ready: false });
  runtime.context.publish('never-ready');
  runtime.timers[0].fn();
  assert.equal(runtime.context.audit().retryExecutedCount, 1);
  assert.equal(runtime.context.audit().renderExecutionCount, 0);
  assert.equal(runtime.timers.length, 1);
});

test('revision B cancels A ownership and an A callback is stale', () => {
  const runtime = ownerRuntime({ ready: false, incidents: [{ id: 'a' }] });
  const revisionA = runtime.context.publish('A');
  runtime.setIncidents([{ id: 'b' }]);
  const revisionB = runtime.context.publish('B');
  assert.equal(runtime.timers[0].cancelled, true);
  runtime.context.map = { _popup: null };
  runtime.context.L = { layerGroup() {} };
  runtime.context.retry(revisionA, 'A-late');
  runtime.timers[1].fn();
  assert.equal(runtime.layer.rows[0].id, 'b');
  assert.equal(runtime.context.audit().lastReconciledRevision, revisionB);
  assert.ok(runtime.context.audit().staleRetrySuppressedCount >= 2);
});

test('rapid pre-readiness publications leave only the final revision eligible', () => {
  const runtime = ownerRuntime({ ready: false, incidents: [{ id: 'a' }] });
  runtime.context.publish('A');
  runtime.setIncidents([{ id: 'b' }]); runtime.context.publish('B');
  runtime.setIncidents([{ id: 'c' }]); runtime.context.publish('C');
  runtime.context.map = { _popup: null }; runtime.context.L = { layerGroup() {} };
  runtime.timers[2].fn();
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.layer.rows.map((row) => row.id))), ['c']);
  assert.equal(runtime.context.audit().renderExecutionCount, 1);
  assert.equal(runtime.context.audit().publicationRevision, 3);
});

test('portrait uses the shared reconciliation owner', () => {
  const portrait = ownerRuntime({ layout: 'portrait' });
  portrait.context.publish('portrait');
  assert.equal(portrait.context.audit().renderExecutionCount, 1);
  assert.equal(portrait.context.audit().portraitRequestCount, 1);
  assert.equal(portrait.context.audit().desktopRequestCount, 0);
});

test('desktop uses the shared reconciliation owner', () => {
  const desktop = ownerRuntime({ layout: 'desktop' });
  desktop.context.publish('desktop');
  assert.equal(desktop.context.audit().renderExecutionCount, 1);
  assert.equal(desktop.context.audit().desktopRequestCount, 1);
  assert.equal(desktop.context.audit().portraitRequestCount, 0);
});

test('unchanged active incident preserves the current popup', () => {
  const runtime = ownerRuntime({ incidents: [{ id: 'same' }] });
  const popup = { incidentId: 'same' };
  runtime.context.map._popup = popup;
  runtime.context.publish('first');
  runtime.context.publish('same-signature');
  assert.equal(runtime.context.map._popup, popup);
  assert.ok(runtime.context.audit().popupPreservationCount >= 1);
});

test('removed incident clears its marker and permits normal popup removal', () => {
  const runtime = ownerRuntime({ incidents: [{ id: 'removed' }] });
  runtime.context.publish('active');
  runtime.setIncidents([]);
  runtime.context.map._popup = null;
  runtime.context.publish('removed');
  assert.equal(runtime.layer.rows.length, 0);
  assert.equal(runtime.context.audit().clearRemovalCount, 1);
});

test('report publication has one owner request and no independent render timers', () => {
  const start = app.indexOf('async function loadSharedReports(');
  const loader = app.slice(start, app.indexOf('\nfunction normalizeReports(', start));
  assert.match(loader, /gridlyPublishIncidentRenderRevision/);
  assert.match(loader, /refreshReportHazardViews\([^\n]+skipIncidentRender: true/);
  assert.equal((loader.match(/gridlyPublishIncidentRenderRevision/g) || []).length, 1);
  assert.doesNotMatch(loader, /scheduleHazardMarkerAutoRender|renderUnifiedIncidents\(/);
  assert.doesNotMatch(loader, /auto-shared-reports-loaded-2000|auto-active-hazards-populated-1000/);
});

test('empty render reuse remains explicit', () => {
  const renderStart = app.indexOf('function renderUnifiedIncidents(');
  const render = app.slice(renderStart, app.indexOf('\nfunction renderUnifiedIncidentMarkers(', renderStart));
  assert.match(render, /renderUnifiedReconciled === true/);
  assert.doesNotMatch(render, /renderUnifiedSignature === renderSignature && existingLayerCount > 0/);
});

test('governed parity consumers retain their established authority', () => {
  assert.match(app, /gridlyFilterRoadHazardsByLatestLifecycle/);
  assert.match(app, /gridlyGovernedActiveConditionParityAudit/);
  assert.match(app, /gridlyIncidentRenderReconciliationAudit/);
});

test('Route Watch incident truth remains an independent governed consumer', () => {
  assert.match(app, /routeWatchSourceHazards/);
  assert.match(app, /getRouteHazardAssessment/);
});
