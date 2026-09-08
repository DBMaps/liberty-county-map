const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const diagnosticsSource = fs.readFileSync(path.join(root, 'js', 'gridlyStartupDiagnostics.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');

function loadDiagnostics() {
  let clock = 0;
  const document = {
    addEventListener() {},
    getElementById() { return null; }
  };
  const context = {
    window: {}, document,
    performance: { now: () => ++clock },
    Date,
    setTimeout: () => 1,
    clearTimeout() {},
    console
  };
  context.window.window = context.window;
  vm.runInNewContext(diagnosticsSource, context, { filename: 'gridlyStartupDiagnostics.js' });
  return context.window.gridlyStartupDiagnostics;
}

function completeIndependentGeneration(diag, countyId = 'liberty-tx') {
  diag.beginRoadwayReportDependencyGeneration({ countyId });
  diag.markRoadwayReportDependencyEvent('mapReady');
  diag.markRoadwayReportDependencyEvent('crossingsStarted');
  diag.markRoadwayReportDependencyEvent('crossingsReady');
  diag.markRoadwayReportDependencyEvent('roadwayStarted');
  diag.markRoadwayReportDependencyEvent('roadwayReady');
  diag.markRoadwayReportDependencyEvent('reportsStarted');
  diag.markRoadwayReportDependencyEvent('reportsRetrieved');
  diag.markRoadwayReportDependencyEvent('reportsPublished');
  diag.markRoadwayReportDependencyEvent('firstGovernedAwarenessReady');
  diag.markRoadwayReportDependencyEvent('firstIncidentRenderReady');
  diag.markRoadwayReportDependencyEvent('usableCheckpoint');
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

async function runSerializedHarness(roadway, reports, events) {
  events.push('roadway:start');
  try { await roadway.promise; events.push('roadway:ready'); }
  catch (_) { events.push('roadway:failed'); }
  events.push('reports:start');
  try { await reports.promise; events.push('reports:published'); }
  catch (_) { events.push('reports:failed'); }
  events.push('usable');
}

test('timing capture records all required launch boundaries', () => {
  const diag = loadDiagnostics();
  completeIndependentGeneration(diag);
  const audit = diag.roadwayReportDependencyAudit();
  for (const key of ['bootstrapStartedAt','mapReadyAt','crossingsStartedAt','crossingsReadyAt','roadwayStartedAt','roadwayReadyAt','reportsStartedAt','reportsRetrievedAt','reportsPublishedAt','firstGovernedAwarenessReadyAt','firstIncidentRenderReadyAt','usableCheckpointAt']) {
    assert.equal(typeof audit.timings[key], 'number', key);
  }
  assert.equal(audit.roadwayReadyWhenReportsStarted, true);
  assert.equal(audit.roadwayReadyWhenReportsPublished, true);
  assert.equal(audit.roadwayReadyWhenFirstAwarenessReady, true);
  assert.equal(audit.roadwayReadyWhenUsable, true);
});

test('LP244.17 ordering instrumentation reports the LP244.18 overlap migration', () => {
  const roadwayStart = appSource.indexOf('const roadwayStartupPromise = runStartupStage("roadway dataset loading"');
  const reportsStart = appSource.indexOf('const initialReportHydration = runStartupStage("initial report and incident loading"');
  assert.ok(roadwayStart > 0 && reportsStart > roadwayStart);
  assert.doesNotMatch(appSource.slice(roadwayStart, reportsStart), /await roadwayStartupPromise/);
});

test('controlled delayed roadway promise holds report start at the current await boundary', async () => {
  const roadway = deferred();
  const reports = deferred();
  const events = [];
  const run = runSerializedHarness(roadway, reports, events);
  await Promise.resolve();
  assert.deepEqual(events, ['roadway:start']);
  roadway.resolve();
  await Promise.resolve();
  assert.deepEqual(events, ['roadway:start', 'roadway:ready', 'reports:start']);
  reports.resolve();
  await run;
});

test('controlled fast roadway preserves normal serialized startup', async () => {
  const roadway = deferred();
  const reports = deferred();
  const events = [];
  roadway.resolve();
  reports.resolve();
  await runSerializedHarness(roadway, reports, events);
  assert.deepEqual(events, ['roadway:start', 'roadway:ready', 'reports:start', 'reports:published', 'usable']);
});

test('test-only road-not-ready report truth harness has no hard dependency read', () => {
  const diag = loadDiagnostics();
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'liberty-tx' });
  for (const phase of ['retrieval', 'normalization', 'governance']) {
    const token = diag.beginRoadwayReportDependencyPhase(phase);
    diag.endRoadwayReportDependencyPhase(token);
  }
  const audit = diag.roadwayReportDependencyAudit();
  assert.equal(audit.hardDependencyEvidence, false);
  assert.equal(audit.preReadyDependencyFailureCount, 0);
});

test('roadway failure remains observable while reports and usability continue', () => {
  const diag = loadDiagnostics();
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'liberty-tx' });
  diag.markRoadwayReportDependencyEvent('roadwayStarted');
  diag.markRoadwayReportDependencyEvent('roadwayFailed');
  diag.markRoadwayReportDependencyEvent('reportsStarted');
  diag.markRoadwayReportDependencyEvent('reportsPublished');
  diag.markRoadwayReportDependencyEvent('firstGovernedAwarenessReady');
  diag.markRoadwayReportDependencyEvent('usableCheckpoint');
  const audit = diag.roadwayReportDependencyAudit();
  assert.equal(typeof audit.timings.roadwayFailedAt, 'number');
  assert.equal(typeof audit.timings.reportsPublishedAt, 'number');
  assert.equal(typeof audit.timings.usableCheckpointAt, 'number');
});

test('report failure is isolated from successful roadway readiness', () => {
  const diag = loadDiagnostics();
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'dallas-tx' });
  diag.markRoadwayReportDependencyEvent('roadwayStarted');
  diag.markRoadwayReportDependencyEvent('roadwayReady');
  diag.markRoadwayReportDependencyEvent('reportsStarted');
  diag.markRoadwayReportDependencyEvent('reportsFailed');
  const audit = diag.roadwayReportDependencyAudit();
  assert.equal(typeof audit.timings.reportsFailedAt, 'number');
  assert.equal(audit.timings.reportsPublishedAt, null);
});

test('dependency-read counters are phase specific and count pre-ready reads', () => {
  const diag = loadDiagnostics();
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'bexar-tx' });
  diag.markRoadwayReportDependencyEvent('roadwayStarted');
  for (const phase of ['retrieval','normalization','governance','publication','immediateConsumers']) {
    const token = diag.beginRoadwayReportDependencyPhase(phase);
    diag.recordRoadwayDependencyRead({ owner: `fixture:${phase}` });
    diag.endRoadwayReportDependencyPhase(token);
  }
  const audit = diag.roadwayReportDependencyAudit();
  assert.deepEqual({ ...audit.dependencyReads }, { retrieval: 1, normalization: 1, governance: 1, publication: 1, immediateConsumers: 1 });
  assert.equal(audit.preReadyDependencyReadCount, 5);
});

test('audit is read-only and does not start work', () => {
  const diag = loadDiagnostics();
  completeIndependentGeneration(diag);
  const before = JSON.stringify(diag.roadwayReportDependencyAudit());
  diag.roadwayReportDependencyAudit();
  assert.equal(JSON.stringify(diag.roadwayReportDependencyAudit()), before);
});

test('county-specific generations remain isolated for Liberty, Dallas, and Bexar', () => {
  const diag = loadDiagnostics();
  for (const countyId of ['liberty-tx','dallas-tx','bexar-tx']) completeIndependentGeneration(diag, countyId);
  const audit = diag.roadwayReportDependencyAudit();
  assert.equal(audit.countyId, 'bexar-tx');
  assert.deepEqual(Array.from(audit.observedCountyIds), ['liberty-tx','dallas-tx','bexar-tx']);
});

test('repeated startup generation resets timings and counters safely', () => {
  const diag = loadDiagnostics();
  completeIndependentGeneration(diag);
  const first = diag.roadwayReportDependencyAudit();
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'dallas-tx' });
  const second = diag.roadwayReportDependencyAudit();
  assert.equal(second.startupGeneration, first.startupGeneration + 1);
  assert.equal(second.timings.reportsStartedAt, null);
  assert.equal(second.preReadyDependencyReadCount, 0);
});

test('instrumentation APIs do not execute roadway or report callbacks', () => {
  const diag = loadDiagnostics();
  let calls = 0;
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'liberty-tx' });
  diag.markRoadwayReportDependencyEvent('roadwayStarted', { ignoredCallback: () => { calls += 1; } });
  diag.roadwayReportDependencyAudit();
  assert.equal(calls, 0);
});

test('classification is deterministic for hard, partial, and independent fixtures', () => {
  const hard = loadDiagnostics();
  hard.beginRoadwayReportDependencyGeneration({ countyId: 'liberty-tx' });
  const h = hard.beginRoadwayReportDependencyPhase('normalization');
  hard.recordRoadwayDependencyRead({ owner: 'normalizer' });
  hard.endRoadwayReportDependencyPhase(h);
  assert.equal(hard.roadwayReportDependencyAudit().currentClassification, 'A');

  const partial = loadDiagnostics();
  partial.beginRoadwayReportDependencyGeneration({ countyId: 'dallas-tx' });
  const p = partial.beginRoadwayReportDependencyPhase('immediateConsumers');
  partial.recordRoadwayDependencyRead({ owner: 'road-name-enrichment', fallback: true });
  partial.endRoadwayReportDependencyPhase(p);
  assert.equal(partial.roadwayReportDependencyAudit().currentClassification, 'C');

  const independent = loadDiagnostics();
  completeIndependentGeneration(independent, 'bexar-tx');
  assert.equal(independent.roadwayReportDependencyAudit().currentClassification, 'B');
});

test('normalization and governance source ranges contain no roadway resolver calls', () => {
  const normalize = appSource.slice(appSource.indexOf('function normalizeReports('), appSource.indexOf('function populateCrossingSelect('));
  const governed = appSource.slice(appSource.indexOf('const normalizeStage = reportStage('), appSource.indexOf('const markerModelStage = reportStage('));
  for (const source of [normalize, governed]) assert.doesNotMatch(source, /resolveNearestRoadName|resolveNearbyRoadPair|roadwaySegmentFeatures|roadwayDatasetLoaded/);
});

test('roadway stage remains nonblocking diagnostically and independently observed by bootstrap', () => {
  assert.match(appSource, /const roadwayStartupPromise = runStartupStage\("roadway dataset loading"[\s\S]*?\{ blocking: false,/);
  assert.doesNotMatch(appSource, /await runStartupStage\("roadway dataset loading"/);
});

test('map readiness is independently captured before crossings and roadway stages', () => {
  const mapReady = appSource.indexOf('markRoadwayReportDependencyEvent?.("mapReady")');
  const crossingsStarted = appSource.indexOf('markRoadwayReportDependencyEvent?.("crossingsStarted")');
  const roadwayStarted = appSource.indexOf('markRoadwayReportDependencyEvent?.("roadwayStarted")');
  assert.ok(mapReady > 0 && mapReady < crossingsStarted && crossingsStarted < roadwayStarted);
});

test('Route Watch inactive and restored state loading does not activate or await roadway work', () => {
  const loadSavedRoute = appSource.slice(appSource.indexOf('function loadSavedRoute()'), appSource.indexOf('async function startInlineRouteWatch'));
  assert.doesNotMatch(loadSavedRoute, /await|gridlyActivateRoadwayDataset|loadRoadwayDataset|roadwaySegmentFeatures|roadwayDatasetLoaded/);
  assert.match(loadSavedRoute, /routeWatchActivated/);
});

test('road enrichment is observed at immediate consumers rather than base report truth', () => {
  const refreshCall = appSource.indexOf('beginRoadwayDependencyPhase("immediateConsumers")');
  const nearestResolver = appSource.indexOf('recordRoadwayDependencyRead?.({ owner: "resolveNearestRoadName"');
  const nearbyResolver = appSource.indexOf('recordRoadwayDependencyRead?.({ owner: "resolveNearbyRoadPair"');
  assert.ok(refreshCall > 0 && nearestResolver > 0 && nearbyResolver > 0);
  const normalize = appSource.slice(appSource.indexOf('function normalizeReports('), appSource.indexOf('function populateCrossingSelect('));
  assert.doesNotMatch(normalize, /recordRoadwayDependencyRead|resolveNearestRoadName|resolveNearbyRoadPair/);
});
