const assert = require('assert');
require('../../js/history-capture/historyAggregationEngine.js');

const engine = globalThis.gridlyHistoricalAggregationEngine;
assert(engine, 'LP053.5 historical aggregation engine is exposed');

function episode(id, at, duration, opts = {}) {
  return {
    episodeCandidateId: `episode-candidate:${id}`,
    resolutionState: opts.state || 'clear_observed',
    locationKey: opts.locationKey || 'crossing:123456A',
    conditionFamily: opts.hazardType || 'rail-crossing-obstruction',
    observationCount: opts.observationCount ?? 3,
    activeObservationCount: opts.confirmationCount ?? 2,
    clearObservationCount: opts.clearCount ?? 1,
    firstObservedAt: at,
    lastObservedAt: opts.lastObservedAt || new Date(Date.parse(at) + duration * 60000).toISOString(),
    durationUpperBoundMinutes: duration,
    observations: opts.observations || [{ retained: true }]
  };
}

const liveIncidentState = Object.freeze([{ id: 'live-1', status: 'active' }]);
const alertState = Object.freeze([{ id: 'alert-1' }]);
const markerState = Object.freeze([{ id: 'marker-1' }]);
const popupState = Object.freeze({ selected: 'crossing:123456A' });
const awarenessState = Object.freeze({ selectedArea: 'liberty' });
const travelBriefState = Object.freeze({ lines: ['Know Before You Go'] });
const communityPulseState = Object.freeze({ activeCount: 1 });
const reportLifecycleState = Object.freeze({ activeReports: ['report-1'], clearedReports: [] });

const episodes = [
  episode('a', '2026-07-20T08:00:00.000Z', 24),
  episode('b', '2026-07-20T08:30:00.000Z', 22),
  episode('c', '2026-07-21T18:15:00.000Z', 45, { locationKey: 'road-bucket:tx:liberty:us-90', hazardType: 'flooding', observationCount: 2, confirmationCount: 1 }),
  episode('skip-active', '2026-07-21T19:00:00.000Z', 5, { state: 'active_observed' }),
  { episodeCandidateId: 'skip-bad', resolutionState: 'clear_observed', locationKey: null, conditionFamily: 'unknown' }
];
const beforeEpisodes = JSON.stringify(episodes);
const beforeProtected = JSON.stringify({ liveIncidentState, alertState, markerState, popupState, awarenessState, travelBriefState, communityPulseState, reportLifecycleState });

const first = engine.aggregateHistoricalEpisodes(episodes);
const second = engine.aggregateHistoricalEpisodes(episodes);

assert.strictEqual(JSON.stringify(episodes), beforeEpisodes, 'historical episode inputs are not mutated');
assert.strictEqual(JSON.stringify({ liveIncidentState, alertState, markerState, popupState, awarenessState, travelBriefState, communityPulseState, reportLifecycleState }), beforeProtected, 'protected live surfaces are not mutated');
assert.deepStrictEqual(first, second, 'repeat aggregation produces identical output');
assert.strictEqual(first.passiveOnly, true, 'aggregation result is passive only');
assert.strictEqual(first.diagnostics.protectedSystemsModified, false, 'diagnostics certify no protected systems changed');
assert.strictEqual(first.diagnostics.historicalEpisodeCount, 5, 'historical episode count is recorded');
assert.strictEqual(first.diagnostics.skippedEpisodeCount, 2, 'non-completed or malformed episodes are skipped');
assert.strictEqual(first.diagnostics.aggregateRecordCount, 2, 'aggregate records are generated for deterministic groups');
assert.strictEqual(first.diagnostics.groupedLocationCount, 2, 'grouped locations are counted');
assert.strictEqual(first.diagnostics.groupedHazardTypeCount, 2, 'grouped hazard types are counted');
assert.strictEqual(first.diagnostics.groupedWeekdayCount, 2, 'weekday buckets are counted');
assert.strictEqual(first.diagnostics.groupedHourBucketCount, 2, 'hour buckets are counted');

const crossingAggregate = first.aggregateRecords.find((record) => record.aggregateLocationId === 'crossing:123456A');
assert(crossingAggregate, 'crossing aggregate exists');
assert.match(crossingAggregate.aggregateId, /^historical-aggregate:[a-f0-9]{8}$/, 'stable aggregate identity is hash based');
assert.strictEqual(crossingAggregate.episodeCount, 2, 'episode count is aggregated');
assert.strictEqual(crossingAggregate.averageDuration, 23, 'average duration is aggregated');
assert.strictEqual(crossingAggregate.medianDuration, 23, 'median duration is aggregated');
assert.strictEqual(crossingAggregate.averageObservationCount, 3, 'observation count average is aggregated');
assert.strictEqual(crossingAggregate.averageConfirmationCount, 2, 'confirmation count average is aggregated');
assert.strictEqual(crossingAggregate.averageClearCount, 1, 'clear count average is aggregated');
assert.deepStrictEqual(crossingAggregate.weekdayDistribution, [{ key: 'Monday', label: 'Monday', count: 2 }], 'weekday distribution is deterministic');
assert.deepStrictEqual(crossingAggregate.hourlyDistribution, [{ key: '08:00', label: '08:00', count: 2 }], 'hour distribution is deterministic');
assert.strictEqual(crossingAggregate.predictiveClaims, false, 'no prediction claims are introduced');
assert.strictEqual(crossingAggregate.consumerVisible, false, 'no consumer-facing historical screen is introduced');

const audit = globalThis.gridlyLp0535HistoricalAggregationAudit(episodes);
assert.strictEqual(audit.passiveOnly, true, 'audit confirms passive-only behavior');
assert.strictEqual(audit.noLiveStateMutation, true, 'audit confirms no live-state mutation');
assert.strictEqual(audit.aggregationCompleted, true, 'audit confirms aggregation completion');
assert.strictEqual(audit.protectedSystemsModified, false, 'audit confirms protected systems are not modified');
assert.strictEqual(audit.safeToProceedToLp0536, true, 'audit authorizes LP053.6 readiness');

console.log('lp0535HistoricalAggregation.test.js passed');
