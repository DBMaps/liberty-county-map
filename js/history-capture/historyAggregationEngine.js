(function attachGridlyHistoricalAggregationEngine(globalScope) {
  'use strict';

  const AGGREGATION_VERSION = 'historical_aggregation.lp0535.passive.v1';
  const COMPLETED_STATE = 'clear_observed';
  const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const EMPTY_DISTRIBUTION = Object.freeze({});
  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const finite = (value) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function parseMs(value) { const stringValue = clean(value); if (!stringValue) return null; const parsed = Date.parse(stringValue); return Number.isFinite(parsed) ? parsed : null; }
  function average(values) { const valid = values.map(finite).filter((value) => value !== null); return valid.length ? Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2)) : null; }
  function median(values) { const valid = values.map(finite).filter((value) => value !== null).sort((a, b) => a - b); if (!valid.length) return null; const middle = Math.floor(valid.length / 2); return valid.length % 2 ? valid[middle] : Number(((valid[middle - 1] + valid[middle]) / 2).toFixed(2)); }
  function distributionEntry(key, label) { return { key, label, count: 0 }; }
  function incrementDistribution(map, key, label) { if (!key) return; if (!map.has(key)) map.set(key, distributionEntry(key, label || key)); map.get(key).count += 1; }
  function sortedDistribution(map) { return freeze(Array.from(map.values()).map((entry) => freeze({ ...entry })).sort((a, b) => String(a.key).localeCompare(String(b.key)))); }
  function hourBucket(hour) { const h = finite(hour); if (h === null) return null; return `${String(h).padStart(2, '0')}:00`; }
  function timeOfDayBucket(hour) { const h = finite(hour); if (h === null) return null; if (h < 6) return 'overnight'; if (h < 10) return 'morning'; if (h < 14) return 'midday'; if (h < 18) return 'afternoon'; if (h < 22) return 'evening'; return 'late_evening'; }
  function stableEpisodeSort(a, b) { return String(a.firstObservedAt || '').localeCompare(String(b.firstObservedAt || '')) || String(a.episodeCandidateId || '').localeCompare(String(b.episodeCandidateId || '')) || String(a.incidentCandidateKey || '').localeCompare(String(b.incidentCandidateKey || '')); }
  function normalizeCompletedEpisode(episode) {
    const firstMs = parseMs(episode?.firstObservedAt || episode?.firstActiveObservedAt);
    if (!episode || episode.resolutionState !== COMPLETED_STATE || firstMs === null) return null;
    const location = clean(episode.locationKey) || clean(episode.aggregateLocationId);
    const hazard = clean(episode.conditionFamily) || clean(episode.hazardType);
    const duration = finite(episode.durationUpperBoundMinutes ?? episode.durationLowerBoundMinutes ?? episode.observedActiveSpanMinutes);
    if (!location || !hazard || hazard === 'unknown' || duration === null) return null;
    const date = new Date(firstMs);
    const weekday = WEEKDAYS[date.getUTCDay()];
    const hour = date.getUTCHours();
    return freeze({
      episodeCandidateId: clean(episode.episodeCandidateId) || `episode:${hashString(`${location}|${hazard}|${episode.firstObservedAt || ''}|${episode.lastObservedAt || ''}`)}`,
      aggregateLocationId: location,
      hazardType: hazard,
      weekday,
      weekdayIndex: date.getUTCDay(),
      hourBucket: hourBucket(hour),
      hourOfDayUtc: hour,
      timeOfDayBucket: timeOfDayBucket(hour),
      durationMinutes: duration,
      observationCount: finite(episode.observationCount) ?? 0,
      confirmationCount: finite(episode.activeObservationCount) ?? 0,
      clearCount: finite(episode.clearObservationCount) ?? 0,
      firstObservedAt: new Date(firstMs).toISOString(),
      lastObservedAt: clean(episode.lastObservedAt) || clean(episode.lastClearObservedAt) || new Date(firstMs).toISOString(),
      sourceResolutionVersion: clean(episode.resolutionVersion || episode.version) || null
    });
  }
  function aggregateIdentity(parts) { return `historical-aggregate:${hashString([AGGREGATION_VERSION, parts.aggregateLocationId, parts.hazardType, parts.weekday, parts.hourBucket].join('|'))}`; }
  function buildAggregateRecord(key, normalizedEpisodes) {
    const episodes = [...normalizedEpisodes].sort(stableEpisodeSort);
    const first = episodes[0];
    const weekdayMap = new Map(); const hourlyMap = new Map(); const timeOfDayMap = new Map();
    episodes.forEach((episode) => { incrementDistribution(weekdayMap, episode.weekday, episode.weekday); incrementDistribution(hourlyMap, episode.hourBucket, episode.hourBucket); incrementDistribution(timeOfDayMap, episode.timeOfDayBucket, episode.timeOfDayBucket); });
    const firstObserved = episodes.reduce((min, episode) => !min || episode.firstObservedAt < min ? episode.firstObservedAt : min, null);
    const lastObserved = episodes.reduce((max, episode) => !max || episode.lastObservedAt > max ? episode.lastObservedAt : max, null);
    return freeze({
      aggregateVersion: AGGREGATION_VERSION,
      aggregateId: aggregateIdentity(first),
      aggregateKey: key,
      aggregateLocationId: first.aggregateLocationId,
      hazardType: first.hazardType,
      weekday: first.weekday,
      hourBucket: first.hourBucket,
      timeOfDayBucket: first.timeOfDayBucket,
      episodeCount: episodes.length,
      averageDuration: average(episodes.map((episode) => episode.durationMinutes)),
      medianDuration: median(episodes.map((episode) => episode.durationMinutes)),
      averageObservationCount: average(episodes.map((episode) => episode.observationCount)),
      averageConfirmationCount: average(episodes.map((episode) => episode.confirmationCount)),
      averageClearCount: average(episodes.map((episode) => episode.clearCount)),
      weekdayDistribution: sortedDistribution(weekdayMap),
      hourlyDistribution: sortedDistribution(hourlyMap),
      timeOfDayDistribution: sortedDistribution(timeOfDayMap),
      firstObserved,
      lastObserved,
      sourceEpisodeIds: freeze(episodes.map((episode) => episode.episodeCandidateId)),
      passiveOnly: true,
      predictiveClaims: false,
      consumerVisible: false
    });
  }
  function aggregateHistoricalEpisodes(episodes) {
    const groups = new Map(); let skippedEpisodeCount = 0; const normalized = [];
    safeArray(episodes).forEach((episode) => { const item = normalizeCompletedEpisode(episode); if (!item) { skippedEpisodeCount += 1; return; } normalized.push(item); const key = [item.aggregateLocationId, item.hazardType, item.weekday, item.hourBucket].join('|'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); });
    const aggregateRecords = freeze(Array.from(groups.entries()).map(([key, items]) => buildAggregateRecord(key, items)).sort((a, b) => a.aggregateId.localeCompare(b.aggregateId)));
    const diagnostics = buildAggregationDiagnostics(aggregateRecords, safeArray(episodes).length, skippedEpisodeCount);
    return freeze({ aggregationVersion: AGGREGATION_VERSION, passiveOnly: true, generatedAt: new Date(0).toISOString(), aggregateRecords, diagnostics });
  }
  function buildAggregationDiagnostics(aggregateRecords, historicalEpisodeCount, skippedEpisodeCount) {
    const locationSet = new Set(); const hazardSet = new Set(); const weekdaySet = new Set(); const hourSet = new Set();
    safeArray(aggregateRecords).forEach((record) => { locationSet.add(record.aggregateLocationId); hazardSet.add(record.hazardType); weekdaySet.add(record.weekday); hourSet.add(record.hourBucket); });
    const accepted = Math.max(0, historicalEpisodeCount - skippedEpisodeCount);
    return freeze({
      aggregationReadiness: accepted > 0 ? 'ready' : 'no_completed_episodes',
      aggregateRecordCount: safeArray(aggregateRecords).length,
      groupedLocations: freeze(Array.from(locationSet).sort()),
      groupedHazardTypes: freeze(Array.from(hazardSet).sort()),
      groupedWeekdayBuckets: freeze(Array.from(weekdaySet).sort()),
      groupedHourlyBuckets: freeze(Array.from(hourSet).sort()),
      groupedLocationCount: locationSet.size,
      groupedHazardTypeCount: hazardSet.size,
      groupedWeekdayCount: weekdaySet.size,
      groupedHourBucketCount: hourSet.size,
      historicalEpisodeCount,
      skippedEpisodeCount,
      aggregationCompleteness: historicalEpisodeCount ? Number((accepted / historicalEpisodeCount).toFixed(4)) : 1,
      passiveOnly: true,
      protectedSystemsModified: false
    });
  }
  function gridlyLp0535HistoricalAggregationAudit(episodes) {
    const sample = safeArray(episodes).length ? episodes : [
      { episodeCandidateId: 'episode-candidate:a', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-07-20T08:00:00.000Z', lastObservedAt: '2026-07-20T08:24:00.000Z', durationUpperBoundMinutes: 24 },
      { episodeCandidateId: 'episode-candidate:b', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 2, activeObservationCount: 1, clearObservationCount: 1, firstObservedAt: '2026-07-20T08:30:00.000Z', lastObservedAt: '2026-07-20T08:52:00.000Z', durationUpperBoundMinutes: 22 },
      { episodeCandidateId: 'episode-candidate:c', resolutionState: 'clear_observed', locationKey: 'road-bucket:tx:liberty:us-90', conditionFamily: 'flooding', observationCount: 2, activeObservationCount: 1, clearObservationCount: 1, firstObservedAt: '2026-07-21T18:15:00.000Z', lastObservedAt: '2026-07-21T19:00:00.000Z', durationUpperBoundMinutes: 45 },
      { episodeCandidateId: 'episode-candidate:skip', resolutionState: 'active_observed', locationKey: 'crossing:skip', conditionFamily: 'debris', firstObservedAt: '2026-07-21T19:00:00.000Z' }
    ];
    const before = JSON.stringify(sample); const result = aggregateHistoricalEpisodes(sample); const after = JSON.stringify(sample); const diagnostics = result.diagnostics;
    return freeze({
      auditVersion: 'lp0535_historical_aggregation.audit.v1',
      passiveOnly: result.passiveOnly === true && result.aggregateRecords.every((record) => record.passiveOnly === true && record.consumerVisible === false),
      noLiveStateMutation: before === after,
      aggregationCompleted: diagnostics.aggregateRecordCount > 0 && diagnostics.aggregationReadiness === 'ready',
      aggregateRecordCount: diagnostics.aggregateRecordCount,
      historicalEpisodeCount: diagnostics.historicalEpisodeCount,
      groupedLocationCount: diagnostics.groupedLocationCount,
      groupedHazardTypeCount: diagnostics.groupedHazardTypeCount,
      groupedWeekdayCount: diagnostics.groupedWeekdayCount,
      groupedHourBucketCount: diagnostics.groupedHourBucketCount,
      skippedEpisodeCount: diagnostics.skippedEpisodeCount,
      protectedSystemsModified: false,
      safeToProceedToLp0536: diagnostics.aggregateRecordCount > 0 && before === after && diagnostics.protectedSystemsModified === false
    });
  }
  const api = freeze({ AGGREGATION_VERSION, aggregateHistoricalEpisodes, buildAggregationDiagnostics, normalizeCompletedEpisode });
  globalScope.gridlyHistoricalAggregationEngine = api;
  globalScope.gridlyLp0535HistoricalAggregationAudit = gridlyLp0535HistoricalAggregationAudit;
})(typeof window !== 'undefined' ? window : globalThis);
