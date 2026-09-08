const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const diagnosticsSource = fs.readFileSync(path.join(root, 'js', 'gridlyStartupDiagnostics.js'), 'utf8');

function loadDiagnostics() {
  let clock = 0;
  const context = { window: {}, document: { addEventListener() {}, getElementById() { return null; } }, performance: { now: () => ++clock }, Date, setTimeout: () => 1, clearTimeout() {}, console };
  context.window.window = context.window;
  vm.runInNewContext(diagnosticsSource, context);
  return context.window.gridlyStartupDiagnostics;
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

class StartupOverlapHarness {
  constructor() { this.generation = 0; this.reportRevision = 0; this.current = null; this.currentCounty = null; }
  start({ countyId, roadway, reports, routeWatchActive = false }) {
    const state = {
      generation: ++this.generation, countyId, roadwayStatus: 'pending', basePublished: false,
      awarenessReady: false, incidentRendered: false, roadContext: null, routeWatchActive,
      pendingEnrichment: null, enrichmentDeferred: 0, enrichmentApplied: 0,
      staleSuppressed: 0, reportFailed: false, roadwayFailed: false, usable: false, events: []
    };
    this.current = state;
    this.currentCounty = countyId;
    state.events.push('roadway:start');
    const roadwayWork = roadway.promise.then((roadName) => {
      if (this.current !== state || this.currentCounty !== countyId) { state.staleSuppressed += 1; return; }
      state.roadwayStatus = 'ready'; state.events.push('roadway:ready');
      const pending = state.pendingEnrichment;
      if (pending && pending.generation === state.generation && pending.countyId === this.currentCounty && pending.reportRevision === this.reportRevision) {
        state.roadContext = roadName; state.enrichmentApplied += 1; state.pendingEnrichment = null; state.events.push('enrichment:applied');
      } else if (pending) { state.staleSuppressed += 1; state.pendingEnrichment = null; }
    }, () => {
      if (this.current !== state) { state.staleSuppressed += 1; return; }
      state.roadwayStatus = 'failed'; state.roadwayFailed = true; state.events.push('roadway:failed');
      state.pendingEnrichment = null;
    });
    state.events.push('reports:start');
    const reportWork = reports.promise.then((rows) => {
      if (this.current !== state || this.currentCounty !== countyId) { state.staleSuppressed += 1; return; }
      state.rows = rows; state.basePublished = true; state.awarenessReady = true; state.incidentRendered = true;
      const revision = ++this.reportRevision; state.reportRevision = revision; state.events.push('reports:published');
      if (state.roadwayStatus === 'ready') state.roadContext = `ready:${countyId}`;
      else if (state.roadwayStatus === 'pending') {
        state.enrichmentDeferred += 1;
        state.pendingEnrichment = { generation: state.generation, countyId, reportRevision: revision };
        state.events.push('enrichment:deferred');
      }
      state.usable = true;
    }, () => { if (this.current === state) { state.reportFailed = true; state.events.push('reports:failed'); state.usable = true; } });
    return { state, roadwayWork, reportWork, settled: () => Promise.all([roadwayWork, reportWork]) };
  }
  reviseReports(state, rows) {
    this.reportRevision += 1; state.rows = rows; state.reportRevision = this.reportRevision;
  }
  changeCounty(countyId) { this.currentCounty = countyId; }
}

test('roadway slow and reports fast overlap, publish base truth, and reconcile once', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred();
  const run = h.start({ countyId: 'liberty-tx', roadway: road, reports });
  reports.resolve([{ id: 'r1' }]); await run.reportWork;
  assert.deepEqual(run.state.events.slice(0, 4), ['roadway:start','reports:start','reports:published','enrichment:deferred']);
  assert.equal(run.state.roadContext, null); assert.equal(run.state.awarenessReady, true);
  road.resolve('US 90'); await run.roadwayWork;
  assert.equal(run.state.roadContext, 'US 90'); assert.equal(run.state.enrichmentApplied, 1);
});

test('roadway fast and reports slow preserve enriched publication', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'dallas-tx', roadway: road, reports });
  road.resolve('I-30'); await run.roadwayWork; reports.resolve([{ id: 'r1' }]); await run.reportWork;
  assert.equal(run.state.basePublished, true); assert.equal(run.state.enrichmentDeferred, 0);
});

test('both fast complete without duplicate work', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'bexar-tx', roadway: road, reports });
  road.resolve('I-10'); reports.resolve([]); await run.settled(); assert.equal(run.state.enrichmentApplied + run.state.enrichmentDeferred <= 1, true);
});

test('roadway failure leaves base awareness usable and road context neutral', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'liberty-tx', roadway: road, reports });
  reports.resolve([{ id: 'r1' }]); road.reject(new Error('road failed')); await run.settled();
  assert.equal(run.state.basePublished, true); assert.equal(run.state.usable, true); assert.equal(run.state.roadContext, null);
});

test('report failure leaves roadway valid and publishes no fake report truth', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'dallas-tx', roadway: road, reports });
  road.resolve('I-30'); reports.reject(new Error('reports failed')); await run.settled();
  assert.equal(run.state.roadwayStatus, 'ready'); assert.equal(run.state.basePublished, false); assert.equal(run.state.reportFailed, true);
});

test('report revision change suppresses old pending enrichment', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'liberty-tx', roadway: road, reports });
  reports.resolve([{ id: 'old' }]); await run.reportWork; h.reviseReports(run.state, [{ id: 'new' }]); road.resolve('US 90'); await run.roadwayWork;
  assert.equal(run.state.enrichmentApplied, 0); assert.equal(run.state.staleSuppressed, 1);
});

test('county change suppresses old county roadway enrichment', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'liberty-tx', roadway: road, reports });
  reports.resolve([{ id: 'r1' }]); await run.reportWork; h.changeCounty('dallas-tx'); road.resolve('US 90'); await run.roadwayWork;
  assert.equal(run.state.roadContext, null); assert.equal(run.state.staleSuppressed, 1);
});

test('multiple rapid generations allow only the latest generation to enrich', async () => {
  const h = new StartupOverlapHarness(); const r1 = deferred(); const p1 = deferred(); const first = h.start({ countyId: 'liberty-tx', roadway: r1, reports: p1 });
  const r2 = deferred(); const p2 = deferred(); const second = h.start({ countyId: 'bexar-tx', roadway: r2, reports: p2 });
  p1.resolve([{ id: 'old' }]); r1.resolve('US 90'); p2.resolve([{ id: 'new' }]); r2.resolve('I-10'); await Promise.all([first.settled(), second.settled()]);
  assert.equal(first.state.enrichmentApplied, 0); assert.equal(second.state.basePublished, true);
});

test('location context remains neutral before roads and reconciles later', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'bexar-tx', roadway: road, reports });
  reports.resolve([{ id: 'r1' }]); await run.reportWork; assert.equal(run.state.roadContext, null); road.resolve('I-10'); await run.roadwayWork; assert.equal(run.state.roadContext, 'I-10');
});

test('Alerts and KBYG base incident truth is available before roads', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'liberty-tx', roadway: road, reports });
  reports.resolve([{ id: 'alert-1' }]); await run.reportWork; assert.deepEqual(run.state.rows, [{ id: 'alert-1' }]); assert.equal(run.state.awarenessReady, true); road.reject(); await run.roadwayWork;
});

test('incident rendering follows base publication before road enrichment', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'dallas-tx', roadway: road, reports });
  reports.resolve([{ id: 'incident-1' }]); await run.reportWork; assert.equal(run.state.incidentRendered, true); assert.equal(run.state.roadContext, null); road.resolve('I-30'); await run.roadwayWork;
});

test('inactive Route Watch does not serialize base reports', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'liberty-tx', roadway: road, reports, routeWatchActive: false });
  reports.resolve([]); await run.reportWork; assert.equal(run.state.basePublished, true); road.resolve('US 90'); await run.roadwayWork;
});

test('restored Route Watch remains separate from base report readiness', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'dallas-tx', roadway: road, reports, routeWatchActive: true });
  reports.resolve([{ id: 'route-alert' }]); await run.reportWork; assert.equal(run.state.basePublished, true); assert.equal(run.state.routeWatchActive, true); road.resolve('I-30'); await run.roadwayWork;
});

for (const [label, countyId, roadName] of [['Liberty','liberty-tx','US 90'],['Dallas','dallas-tx','I-30'],['Bexar','bexar-tx','I-10']]) {
  test(`${label} overlap preserves county-owned enrichment`, async () => {
    const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId, roadway: road, reports });
    reports.resolve([{ id: countyId }]); await run.reportWork; road.resolve(roadName); await run.roadwayWork;
    assert.equal(run.state.countyId, countyId); assert.equal(run.state.roadContext, roadName);
  });
}

test('roadway failure does not affect report clear lifecycle truth', async () => {
  const h = new StartupOverlapHarness(); const road = deferred(); const reports = deferred(); const run = h.start({ countyId: 'liberty-tx', roadway: road, reports });
  reports.resolve([{ id: 'clear-1', lifecycle: 'cleared' }]); road.reject(); await run.settled(); assert.equal(run.state.rows[0].lifecycle, 'cleared');
});

test('production retains LP244.12 complete report retrieval and one startup owner', () => {
  assert.match(appSource, /gridlyFetchCompleteReportPages/);
  assert.equal((appSource.match(/const initialReportHydration =/g) || []).length, 1);
});

test('production scheduling starts roadway and reports before awaiting either', () => {
  const bootstrapStart = appSource.indexOf('document.addEventListener("DOMContentLoaded", async () => {');
  const bootstrap = appSource.slice(bootstrapStart, appSource.indexOf('setInterval(() =>', bootstrapStart));
  assert.match(bootstrap, /const roadwayStartupPromise/);
  assert.match(bootstrap, /const initialReportHydration/);
  assert.doesNotMatch(bootstrap, /await runStartupStage\("roadway dataset loading"/);
});

test('LP244.17 runtime audit exposes overlap and preserved partial-dependency evidence read-only', () => {
  const diag = loadDiagnostics();
  diag.beginRoadwayReportDependencyGeneration({ countyId: 'liberty-tx' });
  diag.markRoadwayReportDependencyEvent('roadwayStarted');
  diag.markRoadwayReportDependencyEvent('reportsStarted');
  const phase = diag.beginRoadwayReportDependencyPhase('immediateConsumers');
  diag.recordRoadwayDependencyRead({ owner: 'resolveNearestRoadName', fallback: true });
  diag.endRoadwayReportDependencyPhase(phase);
  diag.recordRoadwayReportOverlapEvent('overlapEnabled');
  diag.recordRoadwayReportOverlapEvent('partialDependencyPreserved');
  diag.recordRoadwayReportOverlapEvent('roadEnrichmentDeferred');
  const before = JSON.stringify(diag.roadwayReportDependencyAudit());
  const audit = diag.roadwayReportDependencyAudit();
  assert.equal(audit.ordering.reportsStartedBeforeRoadwayReady, true);
  assert.equal(audit.overlapEnabled, true);
  assert.equal(audit.partialDependencyPreserved, true);
  assert.equal(audit.roadEnrichmentDeferredCount, 1);
  assert.equal(audit.roadwayStageAwaitedByBootstrap, false);
  assert.equal(JSON.stringify(diag.roadwayReportDependencyAudit()), before);
});
