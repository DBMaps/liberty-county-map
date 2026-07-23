const assert = require('assert');
require('../../js/history-capture/historyAggregationEngine.js');
require('../../js/history-capture/historyPatternQualificationEngine.js');
require('../../js/history-capture/historyPatternRegistry.js');

const episodes = [
  { episodeCandidateId: 'a', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-01T08:00:00.000Z', lastObservedAt: '2026-06-01T08:25:00.000Z', durationUpperBoundMinutes: 25 },
  { episodeCandidateId: 'b', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-08T08:05:00.000Z', lastObservedAt: '2026-06-08T08:30:00.000Z', durationUpperBoundMinutes: 25 },
  { episodeCandidateId: 'c', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-15T08:10:00.000Z', lastObservedAt: '2026-06-15T08:36:00.000Z', durationUpperBoundMinutes: 26 },
  { episodeCandidateId: 'd', resolutionState: 'clear_observed', locationKey: 'road-bucket:tx:liberty:us-90', conditionFamily: 'flooding', observationCount: 2, activeObservationCount: 1, clearObservationCount: 1, firstObservedAt: '2026-06-03T18:00:00.000Z', lastObservedAt: '2026-06-03T18:40:00.000Z', durationUpperBoundMinutes: 40 }
];
const aggregates = globalThis.gridlyHistoricalAggregationEngine.aggregateHistoricalEpisodes(episodes).aggregateRecords;
const patterns = globalThis.gridlyHistoricalPatternQualificationEngine.qualifyHistoricalPatterns(aggregates, episodes).historicalPatternRecords;
const beforePatterns = JSON.stringify(patterns);
const beforeAggregates = JSON.stringify(aggregates);
const beforeEpisodes = JSON.stringify(episodes);
const registry = globalThis.gridlyHistoricalPatternRegistry.buildRegistry(patterns);
const all = registry.getAllPatterns();

assert(all.length > 0, 'registered seeded LP053.6 records');
assert.strictEqual(JSON.stringify(patterns), beforePatterns, 'LP053.6 pattern inputs are not mutated');
assert.strictEqual(JSON.stringify(aggregates), beforeAggregates, 'LP053.5 aggregates are not mutated');
assert.strictEqual(JSON.stringify(episodes), beforeEpisodes, 'historical episodes are not mutated');
assert.deepStrictEqual(registry.getAllPatterns(), globalThis.gridlyHistoricalPatternRegistry.buildRegistry(patterns).getAllPatterns(), 'identical inputs produce identical output');
assert.deepStrictEqual(all.map((record) => record.registeredPatternId), globalThis.gridlyHistoricalPatternRegistry.buildRegistry([...patterns].reverse()).getAllPatterns().map((record) => record.registeredPatternId), 'registered IDs and ordering are deterministic');

const first = all[0];
assert.strictEqual(registry.getPatternById(first.historicalPatternId).historicalPatternId, first.historicalPatternId, 'retrieval by historical pattern ID works');
assert.strictEqual(registry.getRegisteredPatternById(first.registeredPatternId).registeredPatternId, first.registeredPatternId, 'retrieval by registered ID works');
assert(registry.getPatternsByLocation(first.aggregateLocationId).length > 0, 'retrieval by location works');
assert(registry.getPatternsByHazardType(first.hazardType).length > 0, 'retrieval by hazard works');
assert(registry.getPatternsByQualification(first.qualificationState).length > 0, 'retrieval by qualification works');
assert(registry.getPatternsByWeekday(first.weekday).length > 0, 'retrieval by weekday works');
assert(registry.getPatternsByHourBucket(first.hourBucket).length > 0, 'retrieval by hour bucket works');
assert(registry.getPatternsByTimeOfDay(first.timeOfDay).length > 0, 'retrieval by time of day works');
assert(registry.getPatternsForLocationAndHazard(first.aggregateLocationId, first.hazardType).length > 0, 'combined retrieval works');
assert.strictEqual(registry.getPatternById('missing'), null, 'missing historical pattern is null');
assert.deepStrictEqual(registry.getPatternsByLocation('missing'), [], 'missing grouped retrieval is empty');

const copy = registry.getPatternById(first.historicalPatternId);
copy.recurrenceScore = 1000;
assert.notStrictEqual(registry.getPatternById(first.historicalPatternId).recurrenceScore, 1000, 'returned records are defensive copies');
const summary = registry.getPatternEvidenceSummary(first.historicalPatternId);
assert.deepStrictEqual(summary.qualificationReasons, first.qualificationReasons, 'summary preserves reasons');
assert.deepStrictEqual(summary.limitingFactors, first.limitingFactors, 'summary preserves limiting factors');
assert.strictEqual(summary.predictiveClaims, false, 'summary contains no predictive claims');
assert.strictEqual(summary.consumerVisible, false, 'summary is not consumer-visible');

const duplicateRegistry = globalThis.gridlyHistoricalPatternRegistry.buildRegistry([patterns[0], patterns[0], patterns[1]]);
assert.strictEqual(duplicateRegistry.getDiagnostics().duplicatePatternCount, 1, 'exact duplicates diagnosed');
assert.strictEqual(duplicateRegistry.getAllPatterns().filter((record) => record.historicalPatternId === patterns[0].historicalPatternId).length, 1, 'exact duplicates do not inflate counts');
const strongerConflict = Object.assign({}, patterns[0], { recurrenceScore: 99, qualificationState: 'strong_recurring_pattern', evidenceStrength: 'strong' });
const weakerConflict = Object.assign({}, patterns[0], { recurrenceScore: 1, qualificationState: 'isolated_history', evidenceStrength: 'insufficient' });
const conflictRegistry = globalThis.gridlyHistoricalPatternRegistry.buildRegistry([strongerConflict, weakerConflict]);
assert.strictEqual(conflictRegistry.getDiagnostics().conflictingPatternCount, 1, 'conflicts diagnosed');
assert.strictEqual(conflictRegistry.getPatternById(patterns[0].historicalPatternId).recurrenceScore, 1, 'conflicting duplicates resolve conservatively');
assert.strictEqual(globalThis.gridlyHistoricalPatternRegistry.buildRegistry([weakerConflict, strongerConflict]).getPatternById(patterns[0].historicalPatternId).recurrenceScore, 1, 'conflict resolution is deterministic');
assert.strictEqual(globalThis.gridlyHistoricalPatternRegistry.buildRegistry([{}]).getAllPatterns().length, 0, 'malformed records are skipped safely');
assert.strictEqual(globalThis.gridlyHistoricalPatternRegistry.buildRegistry([]).getDiagnostics().registryStatus, 'registry_empty', 'empty input produces safe empty registry');

const audit = globalThis.gridlyLp0537HistoricalPatternRegistryAudit(patterns);
assert.strictEqual(audit.passiveOnly, true);
assert.strictEqual(audit.registryAvailable, true);
assert.strictEqual(audit.safeToProceedToLp0538, true);
assert.strictEqual(audit.noLiveStateMutation, true);
assert.strictEqual(audit.noStorageWrites, true);
assert.strictEqual(audit.protectedSystemsModified, false);
console.log('lp0537HistoricalPatternRegistry.test.js passed');
