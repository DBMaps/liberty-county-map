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
const episode = (id, date) => ({ episodeCandidateId: id, incidentCandidateKey: `incident:${id}`, resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: date, lastObservedAt: date.replace('08:00', '08:30'), durationUpperBoundMinutes: 30 });

{
  const records = [episode('prod-a', '2026-06-01T08:00:00.000Z'), episode('prod-b', '2026-06-08T08:00:00.000Z'), episode('prod-c', '2026-06-15T08:00:00.000Z'), episode('prod-c', '2026-06-15T08:00:00.000Z'), { episodeCandidateId: 'active-a', incidentCandidateKey: 'incident:active-a', resolutionState: 'active_observed' }, { episodeCandidateId: 'bad-a' }, null, { episodeCandidateId: 'seed-lp0537-a', incidentCandidateKey: 'seed', resolutionState: 'clear_observed', certificationSeed: true }];
  const before = JSON.stringify(records);
  const ctx = load({ gridlyHistoricalEpisodeRecords: records });
  const audit = ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit();
  assert.strictEqual(audit.sourceMode, 'production_runtime');
  assert.strictEqual(audit.completedProductionEpisodeCount, 3);
  assert.strictEqual(audit.duplicateEpisodeCount, 1);
  assert.strictEqual(audit.activeEpisodeExcludedCount, 1);
  assert.strictEqual(audit.incompleteEpisodeExcludedCount, 1);
  assert.strictEqual(audit.malformedEpisodeCount, 1);
  assert.strictEqual(audit.pipelineCompleted, true);
  assert.strictEqual(audit.pipelineSynchronized, true);
  assert.ok(audit.aggregateRecordCount > 0);
  assert.ok(audit.historicalPatternCount > 0);
  assert.ok(audit.registeredPatternCount > 0);
  assert.ok(audit.historicalSignalCount > 0);
  assert.ok(audit.readinessRecordCount > 0);
  assert.strictEqual(JSON.stringify(records), before);
  const first = ctx.gridlyHistoricalIntelligenceRuntimeIntegration.getCompletedProductionEpisodes();
  first[0].episodeCandidateId = 'mutated';
  assert.notStrictEqual(ctx.gridlyHistoricalIntelligenceRuntimeIntegration.getCompletedProductionEpisodes()[0].episodeCandidateId, 'mutated');
  const generation = ctx.gridlyHistoricalIntelligenceRuntimeIntegration.getSourceGeneration();
  ctx.gridlyHistoricalIntelligenceRuntimeIntegration.refreshFromAuthoritativeHistory();
  assert.strictEqual(ctx.gridlyHistoricalIntelligenceRuntimeIntegration.getSourceGeneration(), generation);
}

{
  const ctx = load({ gridlyHistoricalEpisodeRecords: [{ episodeCandidateId: 'active-a', incidentCandidateKey: 'incident:active-a', resolutionState: 'active_observed' }] });
  const audit = ctx.gridlyLp0540ProductionHistoricalRuntimeIntegrationAudit();
  assert.strictEqual(audit.sourceMode, 'production_runtime_empty');
  assert.strictEqual(audit.pipelineStatus, 'production_history_empty');
  assert.strictEqual(audit.completedProductionEpisodeCount, 0);
  assert.strictEqual(audit.aggregateRecordCount, 0);
  assert.strictEqual(audit.certificationSeedSeparated, true);
  assert.strictEqual(audit.safeToProceedToLp0541, true);
}

{
  const ctx = load({ gridlyHistoricalEpisodeRecords: [] });
  const production = ctx.gridlyHistoricalIntelligenceRuntimeIntegration.getPipelineResult();
  const seedResult = ctx.gridlyHistoricalIntelligenceRuntimeIntegration.runCertificationSeedPipeline([episode('cert-a', '2026-06-01T08:00:00.000Z')]);
  assert.strictEqual(seedResult.sourceMode, 'certification_seed');
  assert.strictEqual(ctx.gridlyHistoricalIntelligenceRuntimeIntegration.getPipelineResult().sourceMode, production.sourceMode);
}

console.log('LP054.0 production historical runtime integration regression passed');
