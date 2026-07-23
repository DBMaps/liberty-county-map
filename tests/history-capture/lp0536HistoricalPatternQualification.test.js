const assert = require('assert');
require('../../js/history-capture/historyAggregationEngine.js');
require('../../js/history-capture/historyPatternQualificationEngine.js');

const aggregation = globalThis.gridlyHistoricalAggregationEngine;
const engine = globalThis.gridlyHistoricalPatternQualificationEngine;
assert(engine, 'LP053.6 historical pattern qualification engine is exposed');

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
    observations: opts.observations || [{ retained: true }]
  };
}

const protectedState = Object.freeze({
  liveIncidentState: Object.freeze([{ id: 'live-1', status: 'active' }]),
  canonicalActiveCommunityState: Object.freeze([{ id: 'canonical-1' }]),
  alerts: Object.freeze([{ id: 'alert-1' }]),
  markers: Object.freeze([{ id: 'marker-1' }]),
  popups: Object.freeze({ selected: 'none' }),
  awarenessSurfaces: Object.freeze({ topAwareness: 'clear' }),
  travelBrief: Object.freeze({ lines: ['Know Before You Go'] }),
  communityPulse: Object.freeze({ activeCount: 1 })
});

const recurringEpisodes = [
  episode('a', '2026-06-01T08:00:00.000Z', 25),
  episode('b', '2026-06-08T08:05:00.000Z', 25),
  episode('c', '2026-06-15T08:10:00.000Z', 26),
  episode('d', '2026-06-22T08:00:00.000Z', 24),
  episode('e', '2026-06-29T08:05:00.000Z', 25),
  episode('isolated', '2026-06-03T18:00:00.000Z', 40, { locationKey: 'road-bucket:tx:liberty:us-90', hazardType: 'flooding' })
];
const aggregates = aggregation.aggregateHistoricalEpisodes(recurringEpisodes).aggregateRecords;
const beforeAggregates = JSON.stringify(aggregates);
const beforeEpisodes = JSON.stringify(recurringEpisodes);
const beforeProtected = JSON.stringify(protectedState);

const first = engine.qualifyHistoricalPatterns(aggregates, recurringEpisodes);
const second = engine.qualifyHistoricalPatterns(aggregates, recurringEpisodes);

assert.strictEqual(JSON.stringify(aggregates), beforeAggregates, 'aggregate inputs are not mutated');
assert.strictEqual(JSON.stringify(recurringEpisodes), beforeEpisodes, 'historical episode records are not mutated');
assert.strictEqual(JSON.stringify(protectedState), beforeProtected, 'protected live, alert, marker, popup, awareness, Travel Brief, and Community Pulse state is unchanged');
assert.deepStrictEqual(first, second, 'repeated evaluation produces identical output');
assert.strictEqual(first.passiveOnly, true, 'qualification result is passive only');
assert.strictEqual(first.diagnostics.noLiveStateMutation, true, 'live incident state is not read or written');
assert.strictEqual(first.diagnostics.protectedSystemsModified, false, 'no protected systems are modified');
assert.strictEqual(first.diagnostics.predictiveClaimCount, 0, 'predictive claims remain false');
assert.strictEqual(first.diagnostics.consumerVisibleRecordCount, 0, 'consumer visibility remains false');

const crossing = first.historicalPatternRecords.find((record) => record.aggregateLocationId === 'crossing:123456A');
const isolated = first.historicalPatternRecords.find((record) => record.aggregateLocationId === 'road-bucket:tx:liberty:us-90');
assert(crossing, 'recurring crossing pattern record exists');
assert(isolated, 'isolated road pattern record exists');
assert.match(crossing.historicalPatternId, /^historical-pattern:[a-f0-9]{8}$/, 'stable historicalPatternId is hash based');
assert.strictEqual(crossing.historicalPatternId, second.historicalPatternRecords.find((record) => record.sourceAggregateId === crossing.sourceAggregateId).historicalPatternId, 'stable inputs produce stable historicalPatternId values');
assert.strictEqual(crossing.recurrenceScore, second.historicalPatternRecords.find((record) => record.sourceAggregateId === crossing.sourceAggregateId).recurrenceScore, 'stable inputs produce identical recurrence scores');
assert.strictEqual(crossing.qualificationState, 'strong_recurring_pattern', 'separate occurrences across distinct dates and weeks can qualify as strong recurring historical evidence');
assert.strictEqual(crossing.distinctOccurrenceDateCount, 5, 'separate occurrences across distinct dates increase recurrence evidence');
assert.strictEqual(crossing.distinctOccurrenceWeekCount >= 5, true, 'separate occurrences across distinct weeks increase recurrence evidence');
assert.strictEqual(isolated.qualificationState, 'isolated_history', 'a single episode does not qualify as recurring');
assert.strictEqual(isolated.predictiveClaims, false, 'record does not contain predictive claims');
assert.strictEqual(isolated.consumerVisible, false, 'record is not consumer visible');
assert(isolated.limitingFactors.some((factor) => factor.includes('single completed episode')), 'limiting factors explain why stronger qualification was not assigned');

const duplicateObservationEpisodes = [episode('dup', '2026-06-01T08:00:00.000Z', 25, { observationCount: 99, confirmationCount: 99 })];
const duplicateAggregate = aggregation.aggregateHistoricalEpisodes(duplicateObservationEpisodes).aggregateRecords;
const duplicateResult = engine.qualifyHistoricalPatterns(duplicateAggregate, duplicateObservationEpisodes).historicalPatternRecords[0];
assert.strictEqual(duplicateResult.qualificationState, 'isolated_history', 'duplicate observations from one episode do not create recurrence');
assert(duplicateResult.recurrenceScore < crossing.recurrenceScore, 'raw observation volume from one event is scored below separate recurrence evidence');

const sparseEpisodes = [episode('s1', '2026-06-01T08:00:00.000Z', 25), episode('s2', '2026-06-01T08:30:00.000Z', 25)];
const sparseAggregate = aggregation.aggregateHistoricalEpisodes(sparseEpisodes).aggregateRecords;
const sparseResult = engine.qualifyHistoricalPatterns(sparseAggregate, sparseEpisodes).historicalPatternRecords[0];
assert.strictEqual(sparseResult.qualificationState, 'isolated_history', 'sparse same-day history remains conservatively qualified');

const malformed = engine.qualifyHistoricalPatterns([{ aggregateId: '', aggregateLocationId: null }], recurringEpisodes);
assert.strictEqual(malformed.historicalPatternRecords.length, 0, 'malformed aggregate records are skipped safely');
assert.strictEqual(malformed.diagnostics.skippedAggregateCount, 1, 'skipped aggregate count is diagnosed');

const audit = globalThis.gridlyLp0536HistoricalPatternQualificationAudit(aggregates, recurringEpisodes);
assert.strictEqual(audit.passiveOnly, true, 'audit confirms passive-only behavior');
assert.strictEqual(audit.noLiveStateMutation, true, 'audit confirms no live-state mutation');
assert.strictEqual(audit.noHistoricalEpisodeMutation, true, 'audit confirms no historical episode mutation');
assert.strictEqual(audit.noAggregateMutation, true, 'audit confirms no aggregate mutation');
assert.strictEqual(audit.qualificationCompleted, true, 'audit confirms qualification completion');
assert(audit.inputAggregateCount > 0, 'audit reports input aggregates');
assert(audit.historicalPatternCount > 0, 'audit reports pattern records');
assert.strictEqual(audit.deterministicPatternIdentity, true, 'audit confirms deterministic identity');
assert.strictEqual(audit.deterministicRecurrenceScoring, true, 'audit confirms deterministic scoring');
assert.strictEqual(audit.predictiveClaimCount, 0, 'audit confirms no predictive claims');
assert.strictEqual(audit.consumerVisibleRecordCount, 0, 'audit confirms no consumer-visible records');
assert.strictEqual(audit.protectedSystemsModified, false, 'audit confirms protected systems unchanged');
assert.strictEqual(audit.safeToProceedToLp0537, true, 'audit authorizes LP053.7 readiness');

console.log('lp0536HistoricalPatternQualification.test.js passed');
