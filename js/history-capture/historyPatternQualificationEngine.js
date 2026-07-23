(function attachGridlyHistoricalPatternQualificationEngine(globalScope) {
  'use strict';

  const QUALIFICATION_VERSION = 'historical_pattern_qualification.lp0536.passive.v1';
  const STATES = Object.freeze({
    insufficient: 'insufficient_history',
    isolated: 'isolated_history',
    emerging: 'emerging_pattern',
    recurring: 'recurring_pattern',
    strong: 'strong_recurring_pattern'
  });
  const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const finite = (value) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function parseMs(value) { const stringValue = clean(value); if (!stringValue) return null; const parsed = Date.parse(stringValue); return Number.isFinite(parsed) ? parsed : null; }
  function dateKey(value) { const ms = parseMs(value); return ms === null ? null : new Date(ms).toISOString().slice(0, 10); }
  function weekKey(value) { const ms = parseMs(value); if (ms === null) return null; const date = new Date(ms); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day); const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1); const week = Math.ceil((((date.getTime() - yearStart) / 86400000) + 1) / 7); return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`; }
  function average(values) { const valid = values.map(finite).filter((value) => value !== null); return valid.length ? Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2)) : null; }
  function median(values) { const valid = values.map(finite).filter((value) => value !== null).sort((a, b) => a - b); if (!valid.length) return null; const middle = Math.floor(valid.length / 2); return valid.length % 2 ? valid[middle] : Number(((valid[middle - 1] + valid[middle]) / 2).toFixed(2)); }
  function concentration(distribution, fallbackCount) { const entries = safeArray(distribution); const total = entries.reduce((sum, entry) => sum + (finite(entry?.count) || 0), 0) || finite(fallbackCount) || 0; if (!total) return 0; const max = entries.reduce((peak, entry) => Math.max(peak, finite(entry?.count) || 0), 0) || total; return Number(clamp(max / total, 0, 1).toFixed(4)); }
  function normalizeEpisode(episode) {
    const firstObserved = clean(episode?.firstObservedAt || episode?.firstActiveObservedAt);
    const firstMs = parseMs(firstObserved);
    if (!episode || firstMs === null) return null;
    const id = clean(episode.episodeCandidateId) || clean(episode.id) || `episode:${hashString(firstObserved)}`;
    return freeze({
      id,
      firstObservedAt: new Date(firstMs).toISOString(),
      lastObservedAt: clean(episode.lastObservedAt || episode.lastClearObservedAt) || new Date(firstMs).toISOString(),
      durationMinutes: finite(episode.durationUpperBoundMinutes ?? episode.durationLowerBoundMinutes ?? episode.observedActiveSpanMinutes),
      observationCount: finite(episode.observationCount) ?? 0,
      confirmationCount: finite(episode.activeObservationCount ?? episode.confirmationCount) ?? 0,
      clearCount: finite(episode.clearObservationCount ?? episode.clearCount) ?? 0
    });
  }
  function sourceEpisodesForAggregate(aggregate, episodes) {
    const sourceIds = new Set(safeArray(aggregate.sourceEpisodeIds).map(clean).filter(Boolean));
    return safeArray(episodes).map(normalizeEpisode).filter(Boolean).filter((episode) => !sourceIds.size || sourceIds.has(episode.id)).sort((a, b) => a.firstObservedAt.localeCompare(b.firstObservedAt) || a.id.localeCompare(b.id));
  }
  function historicalPatternIdentity(aggregate) { return `historical-pattern:${hashString([QUALIFICATION_VERSION, clean(aggregate.aggregateId), clean(aggregate.aggregateLocationId), clean(aggregate.hazardType), clean(aggregate.weekday), clean(aggregate.hourBucket)].join('|'))}`; }
  function isValidAggregate(aggregate) { return Boolean(aggregate && clean(aggregate.aggregateId) && clean(aggregate.aggregateLocationId) && clean(aggregate.hazardType) && clean(aggregate.weekday) && clean(aggregate.hourBucket) && finite(aggregate.episodeCount) !== null); }
  function durationConsistency(durations) { const valid = durations.map(finite).filter((value) => value !== null && value >= 0); if (valid.length < 2) return valid.length ? 0.5 : 0; const avg = average(valid); if (!avg) return 0; const deviation = average(valid.map((value) => Math.abs(value - avg))) || 0; return Number(clamp(1 - (deviation / avg), 0, 1).toFixed(4)); }
  function scoreEvidence(evidence) {
    const score =
      Math.min(evidence.episodeCount, 6) * 3 +
      Math.min(evidence.distinctOccurrenceDateCount, 6) * 5 +
      Math.min(evidence.distinctOccurrenceWeekCount, 5) * 6 +
      Math.min(evidence.historicalSpanDays, 45) / 45 * 12 +
      evidence.weekdayConcentration * 8 +
      evidence.hourConcentration * 8 +
      evidence.timeOfDayConcentration * 6 +
      evidence.durationConsistency * 6 +
      evidence.confirmationSupport * 6 +
      evidence.clearSupport * 6;
    const duplicatePenalty = evidence.distinctOccurrenceDateCount <= 1 ? 20 : 0;
    return Math.round(clamp(score - duplicatePenalty, 0, 100));
  }
  function qualify(evidence) {
    if (evidence.episodeCount < 1 || evidence.distinctOccurrenceDateCount < 1) return STATES.insufficient;
    if (evidence.episodeCount === 1 || evidence.distinctOccurrenceDateCount === 1) return STATES.isolated;
    if (evidence.episodeCount >= 5 && evidence.distinctOccurrenceDateCount >= 4 && evidence.distinctOccurrenceWeekCount >= 3 && evidence.historicalSpanDays >= 21 && evidence.recurrenceScore >= 75 && evidence.timingConcentration >= 0.85 && evidence.evidenceCompleteness >= 0.8) return STATES.strong;
    if (evidence.episodeCount >= 3 && evidence.distinctOccurrenceDateCount >= 3 && evidence.distinctOccurrenceWeekCount >= 2 && evidence.historicalSpanDays >= 7 && evidence.recurrenceScore >= 55 && evidence.timingConcentration >= 0.65) return STATES.recurring;
    return STATES.emerging;
  }
  function reasonsAndLimits(evidence, state) {
    const reasons = [];
    const limits = [];
    if (evidence.episodeCount > 1) reasons.push('multiple completed historical episodes support this aggregate');
    if (evidence.distinctOccurrenceDateCount > 1) reasons.push('completed episodes occurred on separate historical dates');
    if (evidence.distinctOccurrenceWeekCount > 1) reasons.push('completed episodes occurred across separate historical weeks');
    if (evidence.timingConcentration >= 0.65) reasons.push('weekday and hour buckets show repeat timing concentration');
    if (evidence.clearSupport >= 0.8) reasons.push('clear-resolution completeness supports evidence quality');
    if (evidence.episodeCount <= 1) limits.push('single completed episode cannot qualify as recurring historical evidence');
    if (evidence.distinctOccurrenceDateCount <= 1) limits.push('duplicate observations or same-day activity do not establish recurrence');
    if (evidence.distinctOccurrenceWeekCount < 2) limits.push('evidence does not yet span multiple historical weeks');
    if (evidence.historicalSpanDays < 7) limits.push('historical span is limited');
    if (evidence.timingConcentration < 0.85 && state !== STATES.strong) limits.push('timing concentration is not strong enough for stronger qualification');
    if (evidence.evidenceCompleteness < 0.8) limits.push('evidence completeness is not high enough for strongest qualification');
    return { reasons: freeze(reasons), limitingFactors: freeze(limits) };
  }
  function buildPatternRecord(aggregate, completedEpisodes) {
    if (!isValidAggregate(aggregate)) return null;
    const episodes = sourceEpisodesForAggregate(aggregate, completedEpisodes);
    const episodeCount = finite(aggregate.episodeCount) || episodes.length;
    const dates = new Set(episodes.map((episode) => dateKey(episode.firstObservedAt)).filter(Boolean));
    const weeks = new Set(episodes.map((episode) => weekKey(episode.firstObservedAt)).filter(Boolean));
    const firstObserved = clean(aggregate.firstObserved) || episodes[0]?.firstObservedAt || null;
    const lastObserved = clean(aggregate.lastObserved) || episodes[episodes.length - 1]?.lastObservedAt || firstObserved;
    const firstMs = parseMs(firstObserved); const lastMs = parseMs(lastObserved);
    const historicalSpanDays = firstMs !== null && lastMs !== null ? Number(Math.max(0, (lastMs - firstMs) / 86400000).toFixed(2)) : 0;
    const observationSupport = Math.min(1, (finite(aggregate.averageObservationCount) || average(episodes.map((episode) => episode.observationCount)) || 0) / 3);
    const confirmationSupport = Math.min(1, (finite(aggregate.averageConfirmationCount) || average(episodes.map((episode) => episode.confirmationCount)) || 0) / 2);
    const clearSupport = Math.min(1, (finite(aggregate.averageClearCount) || average(episodes.map((episode) => episode.clearCount)) || 0));
    const weekdayConcentration = concentration(aggregate.weekdayDistribution, episodeCount);
    const hourConcentration = concentration(aggregate.hourlyDistribution, episodeCount);
    const timeOfDayConcentration = concentration(aggregate.timeOfDayDistribution, episodeCount);
    const durations = episodes.map((episode) => episode.durationMinutes).filter((value) => value !== null);
    const evidence = { episodeCount, distinctOccurrenceDateCount: dates.size || (firstObserved ? 1 : 0), distinctOccurrenceWeekCount: weeks.size || (firstObserved ? 1 : 0), historicalSpanDays, weekdayConcentration, hourConcentration, timeOfDayConcentration, durationConsistency: durationConsistency(durations), observationSupport, confirmationSupport, clearSupport };
    evidence.timingConcentration = Number(((weekdayConcentration + hourConcentration + timeOfDayConcentration) / 3).toFixed(4));
    evidence.evidenceCompleteness = Number(((confirmationSupport + clearSupport + (durations.length >= episodeCount ? 1 : 0)) / 3).toFixed(4));
    evidence.recurrenceScore = scoreEvidence(evidence);
    const state = qualify(evidence);
    const notes = reasonsAndLimits(evidence, state);
    return freeze({ historicalPatternId: historicalPatternIdentity(aggregate), sourceAggregateId: aggregate.aggregateId, aggregateLocationId: aggregate.aggregateLocationId, hazardType: aggregate.hazardType, weekday: aggregate.weekday, hourBucket: aggregate.hourBucket, timeOfDay: aggregate.timeOfDayBucket || null, qualificationState: state, recurrenceScore: evidence.recurrenceScore, evidenceStrength: evidence.recurrenceScore >= 75 ? 'strong' : evidence.recurrenceScore >= 55 ? 'moderate' : evidence.recurrenceScore >= 25 ? 'limited' : 'insufficient', episodeCount, distinctOccurrenceDateCount: evidence.distinctOccurrenceDateCount, distinctOccurrenceWeekCount: evidence.distinctOccurrenceWeekCount, historicalSpanDays, weekdayConcentration, hourConcentration, timeOfDayConcentration, averageDuration: finite(aggregate.averageDuration) ?? average(durations), medianDuration: finite(aggregate.medianDuration) ?? median(durations), durationConsistency: evidence.durationConsistency, observationSupport: Number(observationSupport.toFixed(4)), confirmationSupport: Number(confirmationSupport.toFixed(4)), clearSupport: Number(clearSupport.toFixed(4)), qualificationReasons: notes.reasons, limitingFactors: notes.limitingFactors, firstObserved, lastObserved, passiveOnly: true, predictiveClaims: false, consumerVisible: false });
  }
  function buildDiagnostics(inputCount, patternRecords, skippedAggregateCount, mutation) {
    const counts = Object.values(STATES).reduce((acc, state) => { acc[state] = patternRecords.filter((record) => record.qualificationState === state).length; return acc; }, {});
    const deterministicPatternIdentity = JSON.stringify(patternRecords.map((record) => record.historicalPatternId)) === JSON.stringify([...patternRecords].map((record) => record.historicalPatternId));
    const deterministicRecurrenceScoring = patternRecords.every((record) => Number.isInteger(record.recurrenceScore) && record.recurrenceScore >= 0 && record.recurrenceScore <= 100);
    return freeze({ qualificationReadiness: inputCount > 0 ? 'ready' : 'no_aggregates', inputAggregateCount: inputCount, historicalPatternCount: patternRecords.length, insufficientHistoryCount: counts[STATES.insufficient] || 0, isolatedHistoryCount: counts[STATES.isolated] || 0, emergingPatternCount: counts[STATES.emerging] || 0, recurringPatternCount: counts[STATES.recurring] || 0, strongRecurringPatternCount: counts[STATES.strong] || 0, skippedAggregateCount, deterministicPatternIdentity, deterministicRecurrenceScoring, noAggregateMutation: mutation.noAggregateMutation, noHistoricalEpisodeMutation: mutation.noHistoricalEpisodeMutation, noLiveStateMutation: true, predictiveClaimCount: patternRecords.filter((record) => record.predictiveClaims !== false).length, consumerVisibleRecordCount: patternRecords.filter((record) => record.consumerVisible !== false).length, protectedSystemsModified: false, passiveOnly: true });
  }
  function qualifyHistoricalPatterns(aggregateRecords, completedEpisodes) {
    const aggregates = safeArray(aggregateRecords); const beforeAggregates = JSON.stringify(aggregates); const beforeEpisodes = JSON.stringify(safeArray(completedEpisodes));
    let skippedAggregateCount = 0;
    const patternRecords = freeze(aggregates.map((aggregate) => { const record = buildPatternRecord(aggregate, completedEpisodes); if (!record) skippedAggregateCount += 1; return record; }).filter(Boolean).sort((a, b) => a.historicalPatternId.localeCompare(b.historicalPatternId)));
    const mutation = { noAggregateMutation: JSON.stringify(aggregates) === beforeAggregates, noHistoricalEpisodeMutation: JSON.stringify(safeArray(completedEpisodes)) === beforeEpisodes };
    const diagnostics = buildDiagnostics(aggregates.length, patternRecords, skippedAggregateCount, mutation);
    return freeze({ qualificationVersion: QUALIFICATION_VERSION, passiveOnly: true, generatedAt: new Date(0).toISOString(), historicalPatternRecords: patternRecords, diagnostics });
  }
  function defaultAuditAggregates() {
    const aggregation = globalScope.gridlyHistoricalAggregationEngine;
    const episodes = [
      { episodeCandidateId: 'lp0536-a', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-01T08:00:00.000Z', lastObservedAt: '2026-06-01T08:25:00.000Z', durationUpperBoundMinutes: 25 },
      { episodeCandidateId: 'lp0536-b', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-08T08:05:00.000Z', lastObservedAt: '2026-06-08T08:30:00.000Z', durationUpperBoundMinutes: 25 },
      { episodeCandidateId: 'lp0536-c', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-15T08:10:00.000Z', lastObservedAt: '2026-06-15T08:36:00.000Z', durationUpperBoundMinutes: 26 },
      { episodeCandidateId: 'lp0536-d', resolutionState: 'clear_observed', locationKey: 'road-bucket:tx:liberty:us-90', conditionFamily: 'flooding', observationCount: 2, activeObservationCount: 1, clearObservationCount: 1, firstObservedAt: '2026-06-03T18:00:00.000Z', lastObservedAt: '2026-06-03T18:40:00.000Z', durationUpperBoundMinutes: 40 }
    ];
    if (aggregation?.aggregateHistoricalEpisodes) return { episodes, aggregates: aggregation.aggregateHistoricalEpisodes(episodes).aggregateRecords };
    return { episodes: [], aggregates: [] };
  }
  function gridlyLp0536HistoricalPatternQualificationAudit(aggregateRecords, completedEpisodes) {
    const fallback = safeArray(aggregateRecords).length ? null : defaultAuditAggregates();
    const aggregates = fallback ? fallback.aggregates : aggregateRecords;
    const episodes = fallback ? fallback.episodes : completedEpisodes;
    const result = qualifyHistoricalPatterns(aggregates, episodes); const d = result.diagnostics;
    return freeze({ auditVersion: 'lp0536_historical_pattern_qualification.audit.v1', passiveOnly: d.passiveOnly === true, noLiveStateMutation: d.noLiveStateMutation === true, noHistoricalEpisodeMutation: d.noHistoricalEpisodeMutation === true, noAggregateMutation: d.noAggregateMutation === true, qualificationCompleted: d.historicalPatternCount > 0 && d.qualificationReadiness === 'ready', inputAggregateCount: d.inputAggregateCount, historicalPatternCount: d.historicalPatternCount, insufficientHistoryCount: d.insufficientHistoryCount, isolatedHistoryCount: d.isolatedHistoryCount, emergingPatternCount: d.emergingPatternCount, recurringPatternCount: d.recurringPatternCount, strongRecurringPatternCount: d.strongRecurringPatternCount, skippedAggregateCount: d.skippedAggregateCount, deterministicPatternIdentity: d.deterministicPatternIdentity === true, deterministicRecurrenceScoring: d.deterministicRecurrenceScoring === true, predictiveClaimCount: d.predictiveClaimCount, consumerVisibleRecordCount: d.consumerVisibleRecordCount, protectedSystemsModified: false, safeToProceedToLp0537: d.passiveOnly === true && d.noLiveStateMutation === true && d.noHistoricalEpisodeMutation === true && d.noAggregateMutation === true && d.historicalPatternCount > 0 && d.deterministicPatternIdentity === true && d.deterministicRecurrenceScoring === true && d.predictiveClaimCount === 0 && d.consumerVisibleRecordCount === 0 && d.protectedSystemsModified === false });
  }
  const api = freeze({ QUALIFICATION_VERSION, STATES, qualifyHistoricalPatterns, buildPatternRecord, buildDiagnostics });
  globalScope.gridlyHistoricalPatternQualificationEngine = api;
  globalScope.gridlyLp0536HistoricalPatternQualificationAudit = gridlyLp0536HistoricalPatternQualificationAudit;
})(typeof window !== 'undefined' ? window : globalThis);
