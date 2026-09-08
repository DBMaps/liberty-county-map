const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const appSource = fs.readFileSync('js/app.js', 'utf8');

function extractAuditBlock() {
  const start = appSource.indexOf('const gridlyCrossingPipelineAuditState =');
  const end = appSource.indexOf('function gridlyCrossingTraceFeatureId', start);
  assert.ok(start >= 0 && end > start, 'crossing pipeline audit block must remain extractable');
  return appSource.slice(start, end);
}

function makeRuntime({ reports = [], countyId = 'liberty-tx' } = {}) {
  const counters = { consolidated: 0, sources: 0 };
  const product = {
    activeReports: structuredClone(reports),
    markers: ['marker-a'],
    alerts: ['alert-a'],
    kbyg: ['brief-a'],
    incidents: ['incident-a']
  };
  const context = vm.createContext({
    window: {}, Date,
    activeReports: product.activeReports,
    gridlyGetActiveCountyId: () => countyId,
    getReportLocationKey: (report) => report.locationKey || report.crossingId || null,
    getConsolidatedIncidents: () => {
      counters.consolidated += 1;
      const groups = new Map();
      product.activeReports.filter((report) => !report.expired && report.locationKey).forEach((report) => {
        if (!groups.has(report.locationKey)) groups.set(report.locationKey, []);
        groups.get(report.locationKey).push(report);
      });
      return [...groups.values()];
    },
    getLiveHazardIncidents: () => { counters.sources += 1; return ['road']; },
    futureTxdotIncidents: () => { counters.sources += 1; return ['txdot']; },
    futureTxdotConstruction: () => { counters.sources += 1; return ['construction']; },
    futureFloodAlerts: () => { counters.sources += 1; return []; }
  });
  vm.runInContext(`${extractAuditBlock()}\nwindow.__record = recordCrossingPipelineRefresh; window.__update = updateCrossingPipelineAudit; window.__runtime = readCrossingPipelineRuntimeAudit; window.__detail = () => ({ ...gridlyCrossingPipelineAuditState, ...readCrossingPipelineRuntimeAudit(), droppedCrossingReports: [...gridlyCrossingPipelineAuditState.droppedCrossingReports] });`, context);
  return {
    window: context.window,
    counters,
    product,
    refresh(meta = {}) { return context.window.__record({ reason: 'test', crossingReportCount: product.activeReports.length, countyId, ...meta }); },
    audit() { context.window.__update('manual_window_call'); return context.window.__detail(); },
    runtime() { return context.window.__runtime(); },
    setReports(next) { product.activeReports.splice(0, product.activeReports.length, ...structuredClone(next)); },
    setCounty(next) { countyId = next; }
  };
}

const active = (id, locationKey = id) => ({ id, reportKind: 'crossing', crossingId: locationKey, crossingName: locationKey, locationKey, type: 'blocked', expired: false });

test('default normal refresh records lightweight evidence without a detailed rebuild', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  assert.equal(runtime.runtime().automaticDetailedRebuildCount, 0);
  assert.equal(runtime.runtime().normalRefreshDetailedScanCount, 0);
});

test('normal refresh does not consolidate incidents for the pipeline audit', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  assert.equal(runtime.counters.consolidated, 0);
});

test('normal refresh does not read additional incident-source collections for diagnostic counts', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  assert.equal(runtime.counters.sources, 0);
});

test('explicit owner audit performs exactly one current detailed rebuild', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  const audit = runtime.audit();
  assert.equal(audit.explicitDetailedRebuildCount, 1);
  assert.equal(audit.detailedAuditCurrent, true);
  assert.equal(runtime.counters.consolidated, 1);
});

test('explicit audit is read-only for product reports, markers, incidents, Alerts, and KBYG', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  const before = structuredClone(runtime.product);
  runtime.audit();
  assert.deepEqual(runtime.product, before);
});

test('revision freshness becomes stale after refresh B and current after audit B', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  assert.equal(runtime.audit().detailedAuditCurrent, true);
  runtime.setReports([active('b')]);
  runtime.refresh();
  assert.equal(runtime.runtime().detailedAuditCurrent, false);
  assert.equal(runtime.audit().detailedAuditCurrent, true);
});

test('active crossing product state remains available without explicit audit', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  assert.equal(runtime.product.activeReports.length, 1);
  assert.equal(runtime.runtime().explicitDetailedRebuildCount, 0);
});

test('cleared crossing publication remains independent of detailed audit', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  runtime.setReports([]);
  runtime.refresh({ crossingReportCount: 0 });
  assert.equal(runtime.product.activeReports.length, 0);
  assert.equal(runtime.runtime().normalRefreshDetailedScanCount, 0);
});

test('empty normal refresh stays cheap and explicit audit returns a current empty summary', () => {
  const runtime = makeRuntime();
  runtime.refresh();
  assert.deepEqual([runtime.counters.consolidated, runtime.counters.sources], [0, 0]);
  const audit = runtime.audit();
  assert.equal(audit.crossingReportsLoadedCount, 0);
  assert.equal(audit.detailedAuditCurrent, true);
});

test('multiple crossing reports retain explicit grouping and rejection evidence', () => {
  const runtime = makeRuntime({ reports: [active('a', 'same'), active('b', 'same'), { ...active('c'), expired: true }, { id: 'd', reportKind: 'crossing' }] });
  runtime.refresh();
  const audit = runtime.audit();
  assert.equal(audit.crossingReportsLoadedCount, 4);
  assert.equal(audit.crossingReportsMergedIntoUnifiedCount, 1);
  assert.deepEqual([...audit.droppedCrossingReports].map((row) => row.dropReason), ['expired', 'missing_location_key']);
});

test('county transition invalidates detailed freshness before the next rebuild', () => {
  const runtime = makeRuntime({ reports: [active('a')] });
  runtime.refresh();
  runtime.audit();
  runtime.setCounty('dallas-tx');
  assert.equal(runtime.runtime().detailedAuditCurrent, false);
});

test('governed crossing source and inventory pipeline remain outside the diagnostic gate', () => {
  assert.match(appSource, /resolveGovernedCrossingSource/);
  assert.match(appSource, /gridlyGetActiveCountyCrossingInventory/);
  assert.match(appSource, /renderCrossings/);
});

test('governed parity consumers remain wired independently', () => {
  assert.match(appSource, /gridlyGovernedActiveConditionParityAudit/);
  assert.match(appSource, /gridlyBuildTravelBriefProjectionContext/);
  assert.match(appSource, /gridlyPublishIncidentRenderRevision/);
});

test('LP244.12 complete report retrieval remains wired', () => {
  assert.match(appSource, /gridlyFetchCompleteReportPages/);
  assert.match(appSource, /COMPLETE_CLIENT_VISIBLE_KEYSET/);
});

test('LP244.13 incident reconciliation remains the report render owner', () => {
  assert.match(appSource, /gridlyIncidentRenderReconciliationState/);
  assert.match(appSource, /gridlyPublishIncidentRenderRevision/);
});

test('LP244.14 detailed incident attribution remains independently gated', () => {
  assert.match(appSource, /detailedAttributionEnabled: false/);
  assert.match(appSource, /gridlyEnableUnifiedIncidentAttributionAudit/);
});
