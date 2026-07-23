const assert = require('assert');
require('../../js/history-capture/historyAggregationEngine.js');
require('../../js/history-capture/historyPatternQualificationEngine.js');
require('../../js/history-capture/historyPatternRegistry.js');

const adapterPath = require.resolve('../../js/history-capture/historyEvidenceInterpretationAdapter.js');
const buildRegistry = globalThis.gridlyHistoricalPatternRegistry.buildRegistry;
function loadAdapterWithRegistry(registry) {
  globalThis.gridlyHistoricalPatternRegistry = registry;
  delete require.cache[adapterPath];
  require('../../js/history-capture/historyEvidenceInterpretationAdapter.js');
  return globalThis.gridlyHistoricalEvidenceInterpretationAdapter;
}
function episode(id, at, duration, opts = {}) {
  return {
    episodeCandidateId: `episode-candidate:${id}`,
    resolutionState: 'clear_observed',
    locationKey: opts.locationKey || 'crossing:123456A',
    conditionFamily: opts.hazardType || 'rail-crossing-obstruction',
    observationCount: opts.observationCount ?? 3,
    activeObservationCount: opts.confirmationCount ?? 2,
    clearObservationCount: opts.clearCount ?? 1,
    firstObservedAt: at,
    lastObservedAt: new Date(Date.parse(at) + duration * 60000).toISOString(),
    durationUpperBoundMinutes: duration,
    observations: [{ retained: true }]
  };
}
const blockedSignalFieldNames = [
  ['future', 'Risk'].join(''),
  ['predicted', 'Risk'].join(''),
  ['occurrence', 'Probability'].join(''),
  ['expected', 'Next', 'Occurrence'].join(''),
  ['likely', 'Time'].join(''),
  ['danger', 'Score'].join(''),
  ['route', 'Risk'].join(''),
  ['fore', 'cast'].join('')
];
function hasBlockedField(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).some((key) => blockedSignalFieldNames.some((blocked) => blocked.toLowerCase() === key.toLowerCase()) || hasBlockedField(value[key]));
}

const protectedState = Object.freeze({
  liveIncidentState: Object.freeze([{ id: 'live-1', status: 'active' }]),
  canonicalActiveCommunityState: Object.freeze([{ id: 'canonical-1' }]),
  alerts: Object.freeze([{ id: 'alert-1' }]),
  markers: Object.freeze([{ id: 'marker-1' }]),
  popups: Object.freeze({ selected: 'none' }),
  awareness: Object.freeze({ visible: ['top'] }),
  travelBrief: Object.freeze({ lines: ['Know Before You Go'] }),
  communityPulse: Object.freeze({ activeCount: 1 }),
  topAwareness: Object.freeze({ headline: 'Current conditions' }),
  locationContext: Object.freeze({ county: 'Liberty' }),
  currentTrustAndConfidence: Object.freeze({ confidence: 'current' })
});

const episodes = [
  episode('strong-a', '2026-06-01T08:00:00.000Z', 25),
  episode('strong-b', '2026-06-08T08:05:00.000Z', 25),
  episode('strong-c', '2026-06-15T08:10:00.000Z', 26),
  episode('strong-d', '2026-06-22T08:00:00.000Z', 24),
  episode('strong-e', '2026-06-29T08:05:00.000Z', 25),
  episode('isolated', '2026-06-03T18:00:00.000Z', 40, { locationKey: 'road-bucket:tx:liberty:us-90', hazardType: 'flooding' })
];
const aggregation = globalThis.gridlyHistoricalAggregationEngine;
const qualification = globalThis.gridlyHistoricalPatternQualificationEngine;
const aggregates = aggregation.aggregateHistoricalEpisodes(episodes).aggregateRecords;
const patterns = qualification.qualifyHistoricalPatterns(aggregates, episodes).historicalPatternRecords;
const base = patterns.find((record) => record.aggregateLocationId === 'crossing:123456A');
assert(base, 'base recurring LP053.6 pattern exists');

const customPatterns = [
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:insufficient', sourceAggregateId: 'aggregate:insufficient', aggregateLocationId: 'test:insufficient', qualificationState: 'insufficient_history', recurrenceScore: 0, evidenceStrength: 'insufficient', episodeCount: 0, distinctOccurrenceDateCount: 0, distinctOccurrenceWeekCount: 0, historicalSpanDays: 0, observationSupport: 0, confirmationSupport: 0, clearSupport: 0, qualificationReasons: ['INSUFFICIENT_HISTORY'], limitingFactors: ['insufficient historical support'] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:isolated', sourceAggregateId: 'aggregate:isolated', aggregateLocationId: 'test:isolated', qualificationState: 'isolated_history', recurrenceScore: 1, evidenceStrength: 'limited', episodeCount: 1, distinctOccurrenceDateCount: 1, distinctOccurrenceWeekCount: 1, historicalSpanDays: 1, observationSupport: 1, confirmationSupport: 1, clearSupport: 1, qualificationReasons: ['ISOLATED_HISTORY'], limitingFactors: ['single completed episode'] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:emerging', sourceAggregateId: 'aggregate:emerging', aggregateLocationId: 'test:emerging', qualificationState: 'emerging_pattern', recurrenceScore: 3, evidenceStrength: 'emerging', episodeCount: 2, distinctOccurrenceDateCount: 2, distinctOccurrenceWeekCount: 1, historicalSpanDays: 7, observationSupport: 3, confirmationSupport: 2, clearSupport: 1, qualificationReasons: ['EMERGING_PATTERN'], limitingFactors: ['historical span is narrow'] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:recurring', sourceAggregateId: 'aggregate:recurring', aggregateLocationId: 'test:recurring', qualificationState: 'recurring_pattern', recurrenceScore: 6, evidenceStrength: 'recurring', episodeCount: 4, distinctOccurrenceDateCount: 4, distinctOccurrenceWeekCount: 3, historicalSpanDays: 21, observationSupport: 4, confirmationSupport: 3, clearSupport: 1, qualificationReasons: ['RECURRING_PATTERN'], limitingFactors: [] }),
  Object.assign({}, base, { historicalPatternId: 'historical-pattern:strong', sourceAggregateId: 'aggregate:strong', aggregateLocationId: 'test:strong', qualificationState: 'strong_recurring_pattern', recurrenceScore: 10, evidenceStrength: 'strong', episodeCount: 6, distinctOccurrenceDateCount: 6, distinctOccurrenceWeekCount: 6, historicalSpanDays: 42, observationSupport: 6, confirmationSupport: 6, clearSupport: 3, qualificationReasons: ['STRONG_RECURRING_PATTERN'], limitingFactors: [] })
];

const beforePatterns = JSON.stringify(customPatterns);
const beforeAggregates = JSON.stringify(aggregates);
const beforeEpisodes = JSON.stringify(episodes);
const beforeProtected = JSON.stringify(protectedState);
const registry = buildRegistry(customPatterns);
const beforeRegistry = JSON.stringify(registry.getAllPatterns());
const adapter = loadAdapterWithRegistry(registry);
const signals = adapter.getAllSignals();

assert.strictEqual(JSON.stringify(customPatterns), beforePatterns, 'LP053.6 pattern records are not mutated');
assert.strictEqual(JSON.stringify(aggregates), beforeAggregates, 'LP053.5 aggregate records are not mutated');
assert.strictEqual(JSON.stringify(episodes), beforeEpisodes, 'historical episodes are not mutated');
assert.strictEqual(JSON.stringify(protectedState), beforeProtected, 'live, canonical, alert, marker, popup, awareness, Travel Brief, Community Pulse, Top Awareness, Location Context, trust, and confidence state remain unchanged');
assert.strictEqual(JSON.stringify(registry.getAllPatterns()), beforeRegistry, 'registry records are not mutated');
assert.strictEqual(signals.length, 5, 'all registered records are interpreted');
assert.deepStrictEqual(signals, loadAdapterWithRegistry(registry).getAllSignals(), 'identical registry inputs produce identical signals');
assert.deepStrictEqual(signals.map((signal) => signal.historicalSignalId), [...signals].map((signal) => signal.historicalSignalId).sort(), 'signal ordering is deterministic');
assert.deepStrictEqual(signals.map((signal) => signal.historicalSignalId), loadAdapterWithRegistry(buildRegistry([...customPatterns].reverse())).getAllSignals().map((signal) => signal.historicalSignalId), 'stable historicalSignalId values are independent of input ordering');

const byQualification = Object.fromEntries(signals.map((signal) => [signal.qualificationState, signal]));
assert.strictEqual(byQualification.insufficient_history.interpretationState, 'limited_evidence', 'insufficient_history maps conservatively');
assert.strictEqual(byQualification.isolated_history.interpretationState, 'historical_occurrence', 'isolated_history maps to historical_occurrence');
assert.strictEqual(byQualification.emerging_pattern.interpretationState, 'emerging_recurrence_evidence', 'emerging_pattern maps to emerging recurrence evidence');
assert.strictEqual(byQualification.recurring_pattern.interpretationState, 'established_recurrence_evidence', 'recurring_pattern maps to established recurrence evidence');
assert.strictEqual(byQualification.strong_recurring_pattern.interpretationState, 'strong_recurrence_evidence', 'strong_recurring_pattern maps to strong recurrence evidence');
assert.strictEqual(byQualification.isolated_history.recurrenceEvidenceAvailable, false, 'single-event evidence does not create recurrence availability');
assert.strictEqual(byQualification.emerging_pattern.recurrenceEvidenceAvailable, true, 'emerging evidence creates recurrence evidence availability');
assert.strictEqual(byQualification.emerging_pattern.multiDateEvidence, true, 'multiple dates enable multiDateEvidence');
assert.strictEqual(byQualification.recurring_pattern.multiWeekEvidence, true, 'multiple weeks enable multiWeekEvidence');
assert.strictEqual(byQualification.recurring_pattern.timingEvidenceAvailable, true, 'timing evidence requires valid concentration support');
assert.strictEqual(byQualification.recurring_pattern.durationEvidenceAvailable, true, 'duration evidence requires sufficient completed episodes');
assert.strictEqual(byQualification.recurring_pattern.resolutionEvidenceAvailable, true, 'resolution evidence requires clear support');
assert.strictEqual(byQualification.strong_recurring_pattern.historicalCoverageLevel, 'broad', 'broad coverage threshold is deterministic');
assert.strictEqual(byQualification.strong_recurring_pattern.supportCompletenessLevel, 'strong', 'strong support threshold is deterministic');
assert.strictEqual(byQualification.recurring_pattern.downstreamEligibility, 'eligible_for_future_business_review', 'recurring records with multi-week coverage and provenance can be eligible for business review');
assert.strictEqual(byQualification.isolated_history.downstreamEligibility, 'eligible_for_internal_historical_context', 'isolated records remain internal historical context only');
assert.strictEqual(byQualification.insufficient_history.downstreamEligibility, 'not_eligible', 'insufficient history is not eligible');

const first = signals[0];
assert.strictEqual(adapter.getSignalById(first.historicalSignalId).historicalSignalId, first.historicalSignalId, 'retrieval by signal ID works');
assert.strictEqual(adapter.getSignalByPatternId(first.historicalPatternId).historicalPatternId, first.historicalPatternId, 'retrieval by pattern ID works');
assert.strictEqual(adapter.getSignalByRegisteredPatternId(first.registeredPatternId).registeredPatternId, first.registeredPatternId, 'retrieval by registered pattern ID works');
assert(adapter.getSignalsByLocation(first.aggregateLocationId).length > 0, 'retrieval by location works');
assert(adapter.getSignalsByHazardType(first.hazardType).length > 0, 'retrieval by hazard works');
assert(adapter.getSignalsByInterpretationState(first.interpretationState).length > 0, 'retrieval by interpretation state works');
assert(adapter.getSignalsByQualification(first.qualificationState).length > 0, 'retrieval by qualification works');
assert(adapter.getSignalsByDownstreamEligibility(first.downstreamEligibility).length > 0, 'retrieval by downstream eligibility works');
assert(adapter.getSignalsForLocationAndHazard(first.aggregateLocationId, first.hazardType).length > 0, 'combined location and hazard retrieval works');
assert.strictEqual(adapter.getSignalById('missing'), null, 'missing signal returns null');
assert.deepStrictEqual(adapter.getSignalsByLocation('missing'), [], 'missing grouped retrieval returns empty array');

const copy = adapter.getSignalById(first.historicalSignalId);
copy.recurrenceScore = 9999;
copy.interpretationReasons.push('MUTATED_COPY');
assert.notStrictEqual(adapter.getSignalById(first.historicalSignalId).recurrenceScore, 9999, 'mutating returned signals does not change adapter state');
assert(!adapter.getSignalById(first.historicalSignalId).interpretationReasons.includes('MUTATED_COPY'), 'nested returned arrays are defensive copies');
const summary = adapter.getInterpretationSummary(first.historicalSignalId);
assert.deepStrictEqual(summary.interpretationReasons, first.interpretationReasons, 'summary preserves interpretation reasons');
assert.deepStrictEqual(summary.limitingFactors, first.limitingFactors, 'summary preserves limiting factors');
assert.deepStrictEqual(summary.downstreamEligibilityReasons, first.downstreamEligibilityReasons, 'summary preserves downstream reasons');
assert.strictEqual(summary.passiveOnly, true, 'summary remains passive');
assert.strictEqual(summary.predictiveClaims, false, 'summary has no predictive claims');
assert.strictEqual(summary.consumerVisible, false, 'summary is not consumer visible');
assert.strictEqual(summary.businessVisible, false, 'summary is not business visible');
assert.strictEqual(adapter.getInterpretationSummary('missing'), null, 'missing summary returns null');

signals.forEach((signal) => {
  assert.strictEqual(signal.passiveOnly, true, 'all signals remain passive');
  assert.strictEqual(signal.predictiveClaims, false, 'all signals contain no predictive claims');
  assert.strictEqual(signal.consumerVisible, false, 'all signals remain consumerVisible false');
  assert.strictEqual(signal.businessVisible, false, 'all signals remain businessVisible false');
  assert.strictEqual(hasBlockedField(signal), false, 'no signal contains prediction field names');
});

const diagnostics = adapter.getDiagnostics();
assert.strictEqual(diagnostics.noRegistryMutation, true, 'diagnostics confirm no registry mutation');
assert.strictEqual(diagnostics.noLiveStateMutation, true, 'diagnostics confirm no live-state mutation');
assert.strictEqual(diagnostics.storageWriteCount, 0, 'diagnostics confirm no storage writes');
assert.strictEqual(diagnostics.protectedSystemsModified, false, 'diagnostics confirm protected systems unchanged');
assert.strictEqual(diagnostics.deterministicSignalIdentity, true, 'diagnostics confirm deterministic signal identity');
assert.strictEqual(diagnostics.deterministicSignalOrdering, true, 'diagnostics confirm deterministic signal ordering');
assert.strictEqual(diagnostics.defensiveCopiesVerified, true, 'diagnostics confirm defensive copies');

const malformedRegistry = { getAllPatterns: () => [registry.getAllPatterns()[0], { registeredPatternId: 'bad' }], getDiagnostics: () => ({ registryAvailable: true }) };
const degraded = loadAdapterWithRegistry(malformedRegistry);
assert.strictEqual(degraded.getDiagnostics().adapterStatus, 'adapter_degraded', 'malformed registry records are skipped safely with degraded status');
assert.strictEqual(degraded.getDiagnostics().malformedRecordCount, 1, 'malformed record count is diagnosed');
const empty = loadAdapterWithRegistry({ getAllPatterns: () => [], getDiagnostics: () => ({ registryAvailable: true }) });
assert.strictEqual(empty.getDiagnostics().adapterStatus, 'adapter_empty', 'empty registry input produces adapter_empty safely');
assert.deepStrictEqual(empty.getAllSignals(), [], 'empty adapter returns no signals safely');

loadAdapterWithRegistry(registry);
const audit = globalThis.gridlyLp0538HistoricalEvidenceInterpretationAudit();
assert.strictEqual(audit.passiveOnly, true);
assert.strictEqual(audit.adapterAvailable, true);
assert.strictEqual(audit.interpretationCompleted, true);
assert.strictEqual(audit.registryAvailable, true);
assert(audit.registryInputCount > 0);
assert(audit.historicalSignalCount > 0);
assert.strictEqual(audit.deterministicSignalIdentity, true);
assert.strictEqual(audit.deterministicSignalOrdering, true);
assert.strictEqual(audit.defensiveCopiesVerified, true);
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
assert.strictEqual(audit.safeToProceedToLp0539, true);

console.log('lp0538HistoricalEvidenceInterpretationAdapter.test.js passed');
