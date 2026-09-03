import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
const between = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
const lifecycle = between('let governedRoadHazardReportDraft = null;', 'window.submitHazardNearMe = function');
const template = between('function buildReportHazardSurfaceHtml()', 'const sheetTemplates =');
const dispatcher = between('function triggerV2DockAdapter(action, payload = {})', 'function resolveV2SheetAction(button)');

function makeRuntime(createSharedHazardReport) {
  const updates = [];
  const confirmations = [];
  const closed = [];
  const context = {
    console, Date, Object, Promise,
    window: { setTimeout, clearTimeout },
    map: null,
    HAZARD_TYPES: { flooding: { label: 'Flooding' } },
    governedRoadHazardReviewText: (value) => String(value),
    recordGovernedRoadHazardReviewStage: () => {},
    createSharedHazardReport,
    updateReportingState: (patch) => updates.push(patch),
    setConfirmation: (...args) => confirmations.push(args),
    closeVisiblePortraitV2ReportSurfaceAfterSubmit: () => closed.push(true),
    v2DockAdapterState: { adapterBridgeFailures: [] },
    selectedV2HazardType: '', selectedQuickHazardType: null,
    selectedOtherHazardSubtype: '', activeSheet: 'report', gridlyActiveSurface: 'report', mobileUiMode: 'report',
    applyPortraitV2SurfaceContainment: () => {},
    warnedUnknownV2DockActions: new Set(),
    reportingState: { submissionInProgress: false },
    markReportActionCompletionAudit: () => {},
    pushTapMapTrace: () => {},
    closePortraitV2Sheet: () => {},
    document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, body: { classList: { contains: () => false } } }
  };
  vm.createContext(context);
  vm.runInContext(`${lifecycle}\n${template}\n${dispatcher}\nthis.seedDraft = d => { governedRoadHazardReportDraft = d; window.gridlyGovernedRoadHazardReportDraft = d; }; this.renderReview = buildReportHazardSurfaceHtml; this.dispatch = triggerV2DockAdapter; this.submit = submitGovernedRoadHazardDraft;`, context);
  return { context, updates, confirmations, closed };
}

const draft = Object.freeze({
  hazardType: 'flooding', rawCoordinate: { lat: 30.0466, lng: -94.885198 },
  finalCoordinate: { lat: 30.0466, lng: -94.885198 }, selectedRoadName: 'US 90',
  countyResolution: { countyId: 'liberty-tx' }, countyMetadata: { county_id: 'liberty-tx', state: 'TX' },
  communityMetadata: { communityName: 'Dayton', placeGeoid: '4819600' }, reviewState: 'ready'
});

test('actual rendered Submit action is recognized by the production dispatcher and invokes once', async () => {
  let calls = 0;
  let settle;
  const pending = new Promise((resolve) => { settle = resolve; });
  const runtime = makeRuntime((...args) => { calls += 1; runtime.args = args; return pending; });
  runtime.context.seedDraft(draft);
  const html = runtime.context.renderReview();
  const action = html.match(/<button[^>]+data-v2-action="([^"]+)"[^>]*>Submit Report<\/button>/)?.[1];
  assert.equal(action, 'report-confirm-governed-draft');

  runtime.context.dispatch(action);
  runtime.context.dispatch(action); // rapid second click follows the same rendered action route
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 1);
  settle(true);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(runtime.args.slice(0, 6), ['flooding', 30.0466, -94.885198, 'gps hazard report', '', draft.rawCoordinate]);
  assert.equal(runtime.args[6].selectedRoadName, 'US 90');
  assert.deepEqual(runtime.args[6].countyMetadata, draft.countyMetadata);
  assert.deepEqual(runtime.args[6].communityMetadata, draft.communityMetadata);
  assert.equal(runtime.args[6].governedDraftConfirmation, true);
  assert.equal(runtime.closed.length, 1);
  assert.equal(runtime.context.window.gridlyGovernedRoadHazardReportDraft, null);
});

test('rejection settles pending truthfully and retains the governed draft', async () => {
  const runtime = makeRuntime(() => Promise.reject(new Error('Network unavailable. Try again.')));
  runtime.context.seedDraft(draft);
  const result = await runtime.context.submit();
  assert.equal(result, false);
  assert.equal(runtime.context.window.gridlyGovernedRoadHazardReportDraft, draft);
  assert.equal(runtime.updates.at(-1).submissionInProgress, false);
  assert.match(runtime.updates.at(-1).lastReportError, /Network unavailable/);
  assert.equal(runtime.closed.length, 0);
});

test('watchdog is bounded, stops pending, retains draft, and never fabricates success', async () => {
  const runtime = makeRuntime(() => new Promise(() => {}));
  runtime.context.window.setTimeout = (callback) => { queueMicrotask(callback); return 1; };
  runtime.context.window.clearTimeout = () => {};
  runtime.context.seedDraft(draft);
  const result = await runtime.context.submit();
  assert.equal(result, false);
  assert.equal(runtime.context.window.gridlyGovernedRoadHazardReportDraft, draft);
  assert.equal(runtime.updates.at(-1).submissionInProgress, false);
  assert.match(runtime.confirmations.at(-1)[0], /timed out.*try again/i);
  assert.equal(runtime.closed.length, 0);
});

test('review markup separates heading, labels, and values; Back remains non-submitting', () => {
  const runtime = makeRuntime(() => { throw new Error('Back submitted'); });
  runtime.context.seedDraft(draft);
  const html = runtime.context.renderReview();
  for (const pair of ['Review your report</strong> <span>', 'Hazard</strong> <span>', 'Report location</strong> <span>', 'Road</strong> <span>']) assert.match(html, new RegExp(pair));
  assert.match(css, /gridly-v2-report-review[\s\S]*display: block/);
  assert.match(app, /"report-cancel-governed-draft"[\s\S]*cancelGovernedRoadHazardDraft/);
});

test('governed map placement invalidates after review opens and centers final coordinate once', () => {
  const continuation = between('function continueGovernedRoadHazardDraftToReview', 'async function submitGovernedRoadHazardDraft');
  assert.ok(continuation.indexOf('openGridlyPortraitV2Sheet') < continuation.indexOf('invalidateSize'));
  assert.ok(continuation.indexOf('invalidateSize') < continuation.indexOf('map.setView'));
  assert.equal((continuation.match(/map\.setView/g) || []).length, 1);
  assert.match(continuation, /draft\.finalCoordinate\.lat[\s\S]*draft\.finalCoordinate\.lng/);
});
