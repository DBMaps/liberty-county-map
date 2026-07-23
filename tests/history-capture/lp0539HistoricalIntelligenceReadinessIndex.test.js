const assert = require('assert');
require('../../js/history-capture/historyAggregationEngine.js');
require('../../js/history-capture/historyPatternQualificationEngine.js');
require('../../js/history-capture/historyPatternRegistry.js');

const adapterPath = require.resolve('../../js/history-capture/historyEvidenceInterpretationAdapter.js');
const indexPath = require.resolve('../../js/history-capture/historyIntelligenceReadinessIndex.js');
const buildRegistry = globalThis.gridlyHistoricalPatternRegistry.buildRegistry;
function loadAdapter(registry) {
  globalThis.gridlyHistoricalPatternRegistry = registry;
  delete require.cache[adapterPath];
  require('../../js/history-capture/historyEvidenceInterpretationAdapter.js');
  return globalThis.gridlyHistoricalEvidenceInterpretationAdapter;
}
function loadIndexWithAdapter(adapter) {
  globalThis.gridlyHistoricalEvidenceInterpretationAdapter = adapter;
  delete require.cache[indexPath];
  require('../../js/history-capture/historyIntelligenceReadinessIndex.js');
  return globalThis.gridlyHistoricalIntelligenceReadinessIndex;
}
function episode(id, at, duration, opts = {}) {
  return { episodeCandidateId: `episode-candidate:${id}`, resolutionState: 'clear_observed', locationKey: opts.locationKey || 'crossing:123456A', conditionFamily: opts.hazardType || 'rail-crossing-obstruction', observationCount: opts.observationCount ?? 3, activeObservationCount: opts.confirmationCount ?? 2, clearObservationCount: opts.clearCount ?? 1, firstObservedAt: at, lastObservedAt: new Date(Date.parse(at) + duration * 60000).toISOString(), durationUpperBoundMinutes: duration, observations: [{ retained: true }] };
}
const blockedSignalFieldNames = [
  ['future', 'Risk'].join(''), ['predicted', 'Risk'].join(''), ['occurrence', 'Probability'].join(''), ['expected', 'Next', 'Occurrence'].join(''), ['likely', 'Time'].join(''), ['danger', 'Score'].join(''), ['route', 'Risk'].join(''), ['fore', 'cast'].join(''), ['next', 'Occurrence'].join(''), ['expected', 'Delay'].join(''), ['predicted', 'Time'].join('')
];
function hasBlockedField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some((key) => blockedSignalFieldNames.some((blocked) => blocked.toLowerCase() === key.toLowerCase()) || hasBlockedField(value[key]));
}
const protectedState = Object.freeze({ liveIncidentState: Object.freeze([{ id: 'live-1' }]), canonicalActiveCommunityState: Object.freeze([{ id: 'canonical-1' }]), alerts: Object.freeze([{ id: 'alert-1' }]), markers: Object.freeze([{ id: 'marker-1' }]), popups: Object.freeze({ selected: 'none' }), awareness: Object.freeze({ visible: ['top'] }), travelBrief: Object.freeze({ lines: ['Know Before You Go'] }), communityPulse: Object.freeze({ activeCount: 1 }), topAwareness: Object.freeze({ headline: 'Current conditions' }), locationContext: Object.freeze({ county: 'Liberty' }), currentTrustAndConfidence: Object.freeze({ confidence: 'current' }) });
const episodes = [
  episode('a', '2026-06-01T08:00:00.000Z', 25), episode('b', '2026-06-08T08:05:00.000Z', 25), episode('c', '2026-06-15T08:10:00.000Z', 26), episode('d', '2026-06-22T08:00:00.000Z', 24), episode('e', '2026-06-29T08:05:00.000Z', 25), episode('f', '2026-07-06T08:05:00.000Z', 25)
];
const aggregation = globalThis.gridlyHistoricalAggregationEngine;
const qualification = globalThis.gridlyHistoricalPatternQualificationEngine;
const aggregates = aggregation.aggregateHistoricalEpisodes(episodes).aggregateRecords;
const patterns = qualification.qualifyHistoricalPatterns(aggregates, episodes).historicalPatternRecords;
const base = patterns[0];
const customPatterns = [
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:isolated', sourceAggregateId: 'aggregate:isolated', aggregateLocationId: 'test:isolated', qualificationState: 'isolated_history', recurrenceScore: 1, evidenceStrength: 'limited', episodeCount: 1, distinctOccurrenceDateCount: 1, distinctOccurrenceWeekCount: 1, historicalSpanDays: 1, observationSupport: 1, confirmationSupport: 1, clearSupport: 1, qualificationReasons: ['ISOLATED_HISTORY'], limitingFactors: ['single completed episode'] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:emerging', sourceAggregateId: 'aggregate:emerging', aggregateLocationId: 'test:emerging', qualificationState: 'emerging_pattern', recurrenceScore: 3, evidenceStrength: 'emerging', episodeCount: 2, distinctOccurrenceDateCount: 2, distinctOccurrenceWeekCount: 1, historicalSpanDays: 7, observationSupport: 3, confirmationSupport: 2, clearSupport: 1, qualificationReasons: ['EMERGING_PATTERN'], limitingFactors: ['historical span is narrow'] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:recurring', sourceAggregateId: 'aggregate:recurring', aggregateLocationId: 'test:recurring', qualificationState: 'recurring_pattern', recurrenceScore: 6, evidenceStrength: 'recurring', episodeCount: 4, distinctOccurrenceDateCount: 4, distinctOccurrenceWeekCount: 1, historicalSpanDays: 21, observationSupport: 4, confirmationSupport: 3, clearSupport: 1, qualificationReasons: ['RECURRING_PATTERN'], limitingFactors: [] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:strong', sourceAggregateId: 'aggregate:strong', aggregateLocationId: 'test:strong', qualificationState: 'strong_recurring_pattern', recurrenceScore: 10, evidenceStrength: 'strong', episodeCount: 6, distinctOccurrenceDateCount: 6, distinctOccurrenceWeekCount: 6, historicalSpanDays: 42, observationSupport: 8, confirmationSupport: 8, clearSupport: 4, qualificationReasons: ['STRONG_RECURRING_PATTERN'], limitingFactors: [] })
];
const beforePatterns = JSON.stringify(customPatterns);
const beforeAggregates = JSON.stringify(aggregates);
const beforeEpisodes = JSON.stringify(episodes);
const beforeProtected = JSON.stringify(protectedState);
const registry = buildRegistry(customPatterns);
const beforeRegistry = JSON.stringify(registry.getAllPatterns());
const adapter = loadAdapter(registry);
const beforeSignals = JSON.stringify(adapter.getAllSignals());
const index = loadIndexWithAdapter(adapter);
const records = index.getAllReadinessRecords();
assert.strictEqual(JSON.stringify(customPatterns), beforePatterns, 'LP053.6 pattern records are not mutated');
assert.strictEqual(JSON.stringify(aggregates), beforeAggregates, 'LP053.5 aggregate records are not mutated');
assert.strictEqual(JSON.stringify(episodes), beforeEpisodes, 'historical episodes are not mutated');
assert.strictEqual(JSON.stringify(protectedState), beforeProtected, 'protected live/product state remains unchanged');
assert.strictEqual(JSON.stringify(registry.getAllPatterns()), beforeRegistry, 'LP053.7 registry records are not mutated');
assert.strictEqual(JSON.stringify(adapter.getAllSignals()), beforeSignals, 'LP053.8 interpretation signals are not mutated');
assert.strictEqual(records.length, 4, 'readiness records created for all signals');
assert.deepStrictEqual(records, loadIndexWithAdapter(adapter).getAllReadinessRecords(), 'identical inputs produce identical readiness records');
assert.deepStrictEqual(records.map((record) => record.historicalReadinessId), [...records].map((record) => record.historicalReadinessId).sort(), 'readiness ordering is deterministic');
records.forEach((record) => {
  assert(record.readinessScore >= 0 && record.readinessScore <= 100, 'readiness scores are bounded');
  assert.strictEqual(record.passiveOnly, true, 'records are passive');
  assert.strictEqual(record.predictiveClaims, false, 'records do not make predictive claims');
  assert.strictEqual(record.consumerVisible, false, 'records remain consumer invisible');
  assert.strictEqual(record.businessVisible, false, 'records remain business invisible');
  assert.strictEqual(hasBlockedField(record), false, 'no readiness record contains blocked prediction fields');
});
const byLocation = Object.fromEntries(records.map((record) => [record.aggregateLocationId, record]));
assert.strictEqual(byLocation['test:isolated'].readinessState, 'foundation_only', 'isolated evidence does not become consumer ready');
assert.strictEqual(byLocation['test:emerging'].readinessState, 'limited_readiness', 'emerging recurrence does not become business ready and is limited by narrow coverage');
assert.strictEqual(byLocation['test:recurring'].readinessState, 'consumer_review_ready', 'strong enough established evidence may become consumer review ready');
assert.strictEqual(byLocation['test:strong'].readinessState, 'business_review_ready', 'strong broad multi-week evidence may become business review ready');
assert(byLocation['test:emerging'].readinessLimitations.includes('MATERIAL_LIMITING_FACTOR_PRESENT'), 'material limiting factors reduce readiness');
assert(byLocation['test:recurring'].readinessReasons.includes('CONSUMER_REVIEW_REQUIREMENTS_MET'), 'consumer readiness reasons are preserved');
assert(byLocation['test:strong'].readinessReasons.includes('BUSINESS_REVIEW_REQUIREMENTS_MET'), 'business readiness reasons are preserved');
const first = records[0];
assert.strictEqual(index.getReadinessById(first.historicalReadinessId).historicalReadinessId, first.historicalReadinessId);
assert.strictEqual(index.getReadinessBySignalId(first.historicalSignalId).historicalSignalId, first.historicalSignalId);
assert.strictEqual(index.getReadinessByPatternId(first.historicalPatternId).historicalPatternId, first.historicalPatternId);
assert(index.getReadinessByRegisteredPatternId(first.registeredPatternId).length > 0);
assert(index.getReadinessByLocation(first.aggregateLocationId).length > 0);
assert(index.getReadinessByHazardType(first.hazardType).length > 0);
assert(index.getReadinessByState(first.readinessState).length > 0);
assert(index.getReadinessByEvidenceMaturity(first.evidenceMaturityLevel).length > 0);
assert(index.getReadinessForLocationAndHazard(first.aggregateLocationId, first.hazardType).length > 0);
assert.strictEqual(index.getReadinessById('missing'), null);
assert.deepStrictEqual(index.getReadinessByLocation('missing'), []);
const copy = index.getReadinessById(first.historicalReadinessId);
copy.readinessScore = 999;
copy.readinessReasons.push('MUTATED_COPY');
assert.notStrictEqual(index.getReadinessById(first.historicalReadinessId).readinessScore, 999, 'mutating returned records does not change internal state');
assert(!index.getReadinessById(first.historicalReadinessId).readinessReasons.includes('MUTATED_COPY'), 'nested returned arrays are defensive copies');
const summary = index.getReadinessSummary(first.historicalReadinessId);
assert.deepStrictEqual(summary.readinessReasons, first.readinessReasons, 'summary preserves reasons');
assert.deepStrictEqual(summary.readinessLimitations, first.readinessLimitations, 'summary preserves limitations');
assert.strictEqual(hasBlockedField(summary), false, 'summary has no blocked future-looking fields');
const globalSummary = index.getGlobalReadinessSummary();
assert.strictEqual(globalSummary.readinessIndexStatus, 'index_ready');
assert.strictEqual(globalSummary.protectedSystemsModified, false);
const invalidSignal = Object.assign({}, adapter.getAllSignals()[0], { passiveOnly: false });
const invalidIndex = loadIndexWithAdapter({ getAllSignals: () => [invalidSignal], getDiagnostics: () => ({ adapterStatus: 'adapter_ready' }) });
assert.strictEqual(invalidIndex.getAllReadinessRecords()[0].readinessState, 'not_ready', 'invalid passive flags force not_ready');
assert.strictEqual(invalidIndex.getDiagnostics().readinessIndexStatus, 'index_blocked', 'safety violations can produce index_blocked');
const predictiveSignal = Object.assign({}, adapter.getAllSignals()[0], { predictiveClaims: true });
assert.strictEqual(loadIndexWithAdapter({ getAllSignals: () => [predictiveSignal], getDiagnostics: () => ({}) }).getAllReadinessRecords()[0].readinessState, 'not_ready', 'predictive claims force not_ready');
const missingProvenanceSignal = Object.assign({}, adapter.getAllSignals()[0]);
delete missingProvenanceSignal.evidenceProvenance;
assert.strictEqual(loadIndexWithAdapter({ getAllSignals: () => [missingProvenanceSignal], getDiagnostics: () => ({}) }).getAllReadinessRecords()[0].readinessState, 'not_ready', 'missing provenance forces not_ready');
const highNoDate = Object.assign({}, adapter.getAllSignals().find((s) => s.aggregateLocationId === 'test:strong'), { multiDateEvidence: false, multiWeekEvidence: false, historicalCoverageLevel: 'broad', supportCompletenessLevel: 'strong' });
assert.notStrictEqual(loadIndexWithAdapter({ getAllSignals: () => [highNoDate], getDiagnostics: () => ({}) }).getAllReadinessRecords()[0].readinessState, 'consumer_review_ready', 'multi-date evidence is required for consumer readiness');
const highNoWeek = Object.assign({}, adapter.getAllSignals().find((s) => s.aggregateLocationId === 'test:strong'), { multiWeekEvidence: false });
assert.notStrictEqual(loadIndexWithAdapter({ getAllSignals: () => [highNoWeek], getDiagnostics: () => ({}) }).getAllReadinessRecords()[0].readinessState, 'business_review_ready', 'multi-week evidence is required for business readiness');
const malformed = loadIndexWithAdapter({ getAllSignals: () => [adapter.getAllSignals()[0], { historicalSignalId: 'bad' }], getDiagnostics: () => ({}) });
assert.strictEqual(malformed.getDiagnostics().readinessIndexStatus, 'index_degraded', 'malformed signals are skipped safely');
assert.strictEqual(malformed.getDiagnostics().malformedSignalCount, 1);
const empty = loadIndexWithAdapter({ getAllSignals: () => [], getDiagnostics: () => ({}) });
assert.strictEqual(empty.getDiagnostics().readinessIndexStatus, 'index_empty', 'empty adapter input produces index_empty safely');
assert.deepStrictEqual(empty.getAllReadinessRecords(), []);
loadIndexWithAdapter(adapter);
const diagnostics = globalThis.gridlyHistoricalIntelligenceReadinessIndex.getDiagnostics();
assert.strictEqual(diagnostics.noInterpretationSignalMutation, true);
assert.strictEqual(diagnostics.noRegistryMutation, true);
assert.strictEqual(diagnostics.noHistoricalPatternMutation, true);
assert.strictEqual(diagnostics.noAggregateMutation, true);
assert.strictEqual(diagnostics.noHistoricalEpisodeMutation, true);
assert.strictEqual(diagnostics.noLiveStateMutation, true);
assert.strictEqual(diagnostics.storageWriteCount, 0);
assert.strictEqual(diagnostics.protectedSystemsModified, false);
assert.strictEqual(diagnostics.deterministicReadinessIdentity, true);
assert.strictEqual(diagnostics.deterministicReadinessScoring, true);
assert.strictEqual(diagnostics.deterministicReadinessOrdering, true);
assert.strictEqual(diagnostics.defensiveCopiesVerified, true);
const audit = globalThis.gridlyLp0539HistoricalIntelligenceReadinessAudit();
assert.strictEqual(audit.passiveOnly, true);
assert.strictEqual(audit.indexAvailable, true);
assert.strictEqual(audit.readinessCompleted, true);
assert.strictEqual(audit.interpretationAdapterAvailable, true);
assert(audit.inputSignalCount > 0);
assert(audit.readinessRecordCount > 0);
assert.strictEqual(audit.deterministicReadinessIdentity, true);
assert.strictEqual(audit.deterministicReadinessScoring, true);
assert.strictEqual(audit.deterministicReadinessOrdering, true);
assert.strictEqual(audit.defensiveCopiesVerified, true);
assert.strictEqual(audit.noInterpretationSignalMutation, true);
assert.strictEqual(audit.noRegistryMutation, true);
assert.strictEqual(audit.noHistoricalPatternMutation, true);
assert.strictEqual(audit.noAggregateMutation, true);
assert.strictEqual(audit.noHistoricalEpisodeMutation, true);
assert.strictEqual(audit.noLiveStateMutation, true);
assert.strictEqual(audit.noStorageWrites, true);
assert.strictEqual(audit.predictiveClaimCount, 0);
assert.strictEqual(audit.consumerVisibleRecordCount, 0);
assert.strictEqual(audit.businessVisibleRecordCount, 0);
assert.strictEqual(audit.protectedSystemsModified, false);
assert.strictEqual(audit.safeToProceedToLp054, true);
console.log('lp0539HistoricalIntelligenceReadinessIndex.test.js passed');
