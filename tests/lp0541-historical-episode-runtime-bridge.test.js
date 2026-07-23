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
  context.window = context; context.globalThis = context;
  scripts.forEach((file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }));
  return context;
}
const obs = (id, lifecycle, at, opts = {}) => ({
  identityVersion: 'historical_identity_v1',
  observationKey: opts.observationKey || `observation:${id}`,
  incidentCandidateKey: opts.candidate || 'incident-candidate:lp0541-a',
  recurrenceKey: 'recurrence:lp0541',
  locationKey: opts.locationKey || 'crossing:123456A',
  locationStrength: opts.locationStrength || 'certified',
  conditionFamily: opts.conditionFamily || 'rail-crossing-obstruction',
  lifecycleState: lifecycle,
  eventType: lifecycle === 'clear' ? 'report_cleared' : 'report_created',
  observedAt: at,
  sourceReportId: opts.sourceReportId || `safe-${id}`,
  source: 'community'
});

{
  const ctx = load();
  const runtime = ctx.gridlyHistoricalEpisodeRuntime;
  assert.strictEqual(typeof runtime.getCompletedEpisodes, 'function');
  assert.strictEqual(runtime.getCompletedEpisodes().length, 0);
  assert.strictEqual(ctx.gridlyLp0541HistoricalEpisodeRuntimeBridgeAudit().sourceHydrated, true);
  assert.strictEqual(ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit().sourceMode, 'production_runtime_empty');
  assert.strictEqual(ctx.gridlyLp0541HistoricalEpisodeRuntimeBridgeAudit().safeToProceedToLp0542, true);
}

{
  const ctx = load();
  const runtime = ctx.gridlyHistoricalEpisodeRuntime;
  let notifications = 0;
  const listener = () => { notifications += 1; };
  const unsubscribeA = runtime.subscribeCompletedEpisodeChanges(listener);
  const unsubscribeB = runtime.subscribeCompletedEpisodeChanges(listener);
  runtime.ingestObservation(obs('a', 'active', '2026-07-23T10:00:00.000Z'));
  assert.strictEqual(runtime.getCompletedEpisodes().length, 0, 'active episodes are excluded');
  runtime.ingestObservation(obs('a-dup', 'active', '2026-07-23T10:00:00.000Z', { observationKey: 'observation:a' }));
  runtime.ingestObservation(obs('b', 'clear', '2026-07-23T10:20:00.000Z'));
  assert.strictEqual(runtime.getCompletedEpisodes().length, 1, 'clear-observed episode is exposed');
  assert.ok(notifications >= 2, 'passive notifications fire');
  unsubscribeA(); unsubscribeB();
  const completed = runtime.getCompletedEpisodes();
  assert.strictEqual(completed[0].resolutionState, 'clear_observed');
  completed[0].episodeCandidateId = 'mutated';
  assert.notStrictEqual(runtime.getCompletedEpisodes()[0].episodeCandidateId, 'mutated', 'defensive copies are returned');
  assert.deepStrictEqual(runtime.getCompletedEpisodes().map((e) => e.episodeCandidateId), runtime.getCompletedEpisodes().map((e) => e.episodeCandidateId), 'ordering is deterministic');
  ctx.gridlyHistoricalIntelligenceRuntimeIntegration.refreshFromAuthoritativeHistory();
  const lp0540 = ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit();
  assert.strictEqual(lp0540.sourceMode, 'production_runtime');
  assert.strictEqual(lp0540.completedProductionEpisodeCount, runtime.getCompletedEpisodes().length);
  const audit = ctx.gridlyLp0541HistoricalEpisodeRuntimeBridgeAudit();
  assert.strictEqual(audit.authoritativeOwnerDetected, true);
  assert.strictEqual(audit.canonicalCompletionState, 'clear_observed');
  assert.strictEqual(audit.noStorageWritesAdded, true);
  assert.strictEqual(audit.protectedSystemsModified, false);
}

{
  const ctx = load();
  const runtime = ctx.gridlyHistoricalEpisodeRuntime;
  runtime.ingestObservation(obs('orphan', 'clear', '2026-07-23T11:00:00.000Z', { candidate: 'incident-candidate:orphan' }));
  runtime.ingestObservation({ eventType: 'bad', observedAt: 'not-a-date' });
  assert.strictEqual(runtime.getCompletedEpisodes().length, 0, 'orphan and malformed records are excluded safely');
  assert.strictEqual(ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit().sourceMode, 'production_runtime_empty');
}

console.log('LP054.1 historical episode runtime bridge regression passed');
