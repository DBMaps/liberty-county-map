const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const scripts = [
  'js/history-capture/historyEpisodeResolver.js',
  'js/history-capture/historyEpisodeRuntimeBridge.js',
  'js/history-capture/historyAggregationEngine.js',
  'js/history-capture/historyPatternQualificationEngine.js',
  'js/history-capture/historyPatternRegistry.js',
  'js/history-capture/historyEvidenceInterpretationAdapter.js',
  'js/history-capture/historyIntelligenceReadinessIndex.js',
  'js/history-capture/historyIntelligenceRuntimeIntegration.js'
];

function load(extra = {}) {
  const context = vm.createContext(Object.assign({ console, window: null, globalThis: null }, extra));
  context.window = context;
  context.globalThis = context;
  scripts.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));
  return context;
}

function observation(id, lifecycle, family) {
  return {
    identityVersion: 'historical_identity_v1',
    observationKey: `live-observation:${id}:${lifecycle}`,
    incidentCandidateKey: `live-incident:${id}`,
    recurrenceKey: `live-recurrence:${id}`,
    locationKey: `road-bucket:tx:liberty:${id}`,
    locationStrength: 'structured',
    conditionFamily: family,
    lifecycleState: lifecycle,
    eventType: lifecycle === 'clear' ? 'report_cleared' : 'report_created',
    observedAt: lifecycle === 'clear' ? '2026-07-23T10:20:00.000Z' : '2026-07-23T10:00:00.000Z',
    sourceReportId: `live-report:${id}`,
    source: 'community'
  };
}

['disabled_vehicle', 'traffic_backup', 'rail-crossing-obstruction'].forEach((family) => {
  const ctx = load();
  const liveReport = observation(family, 'active', family);
  const liveBefore = JSON.stringify(liveReport);
  assert.strictEqual(ctx.gridlyHistoricalEpisodeRuntime.ingestObservation(liveReport), true);
  liveReport.conditionFamily = 'mutated_live_type';
  liveReport.sourceReportId = 'mutated-live-report';
  ctx.gridlyHistoricalEpisodeRuntime.ingestObservation(observation(family, 'clear', family));

  const completed = ctx.gridlyHistoricalEpisodeRuntime.getCompletedEpisodes();
  assert.strictEqual(completed.length, 1, `${family} should be completed only as history`);
  assert.strictEqual(completed[0].resolutionState, 'clear_observed');
  assert.strictEqual(completed[0].conditionFamily, family);
  assert.strictEqual(completed[0].originalConditionFamily, family);
  assert.strictEqual(completed[0].hazardType, family);
  assert.strictEqual(completed[0].sourceClassification, 'historical_sidecar');
  assert.strictEqual(completed[0].passiveOnly, true);
  assert.strictEqual(completed[0].consumerVisible, false);
  assert.ok(completed[0].episodeCandidateId.startsWith('historical-episode:'));
  assert.ok(completed[0].incidentCandidateKey.startsWith('historical-incident-candidate:'));
  assert.ok(completed[0].observations.every((obs) => obs.observationKey.startsWith('historical-observation:')));
  assert.ok(completed[0].observations.every((obs) => obs.sourceReportId.startsWith('historical-report:')));
  assert.notStrictEqual(completed[0].incidentCandidateKey, `live-incident:${family}`);

  completed[0].observations[0].conditionFamily = 'mutated_history_type';
  assert.strictEqual(liveReport.conditionFamily, 'mutated_live_type');
  assert.notStrictEqual(JSON.stringify(liveReport), liveBefore, 'control live object was mutable after ingest');
  assert.strictEqual(ctx.gridlyHistoricalEpisodeRuntime.getCompletedEpisodes()[0].conditionFamily, family);

  const lp0540 = ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit();
  assert.strictEqual(lp0540.sourceMode, 'production_runtime');
  assert.strictEqual(lp0540.completedProductionEpisodeCount, 1);
  assert.strictEqual(lp0540.consumerVisibleRecordCount, 0);
});

{
  const ctx = load({
    gridlyHistoricalEpisodeRecords: [
      { episodeCandidateId: 'live-episode', incidentCandidateKey: 'live-incident', resolutionState: 'clear_observed', conditionFamily: 'traffic_backup' }
    ]
  });
  const audit = ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit();
  assert.strictEqual(audit.sourceMode, 'production_runtime_empty', 'unclassified legacy/live arrays are ignored');
  assert.strictEqual(audit.completedProductionEpisodeCount, 0);
}

console.log('LP054.1A historical runtime live-state isolation regression passed');
