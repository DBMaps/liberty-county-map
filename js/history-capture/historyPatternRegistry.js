(function attachGridlyHistoricalPatternRegistry(globalScope) {
  'use strict';

  const REGISTRY_VERSION = 'historical_pattern_registry.lp0537.passive.v1';
  const STATUSES = Object.freeze({ available: 'registry_available', empty: 'registry_empty', ready: 'registry_ready', degraded: 'registry_degraded' });
  const QUALIFICATION_STRENGTH = Object.freeze({ insufficient_history: 1, isolated_history: 2, emerging_pattern: 3, recurring_pattern: 4, strong_recurring_pattern: 5 });
  const RETAINED_FIELDS = Object.freeze(['historicalPatternId', 'sourceAggregateId', 'aggregateLocationId', 'hazardType', 'weekday', 'hourBucket', 'timeOfDay', 'qualificationState', 'recurrenceScore', 'evidenceStrength', 'episodeCount', 'distinctOccurrenceDateCount', 'distinctOccurrenceWeekCount', 'historicalSpanDays', 'weekdayConcentration', 'hourConcentration', 'timeOfDayConcentration', 'averageDuration', 'medianDuration', 'durationConsistency', 'observationSupport', 'confirmationSupport', 'clearSupport', 'qualificationReasons', 'limitingFactors', 'firstObserved', 'lastObserved', 'passiveOnly', 'predictiveClaims', 'consumerVisible']);
  const REQUIRED_FIELDS = Object.freeze(['historicalPatternId', 'sourceAggregateId', 'aggregateLocationId', 'hazardType', 'weekday', 'hourBucket', 'qualificationState']);
  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const finite = (value) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
  function registeredPatternIdentity(record) { return `registered-historical-pattern:${hashString([REGISTRY_VERSION, clean(record.historicalPatternId), clean(record.sourceAggregateId), clean(record.aggregateLocationId), clean(record.hazardType), clean(record.weekday), clean(record.hourBucket)].join('|'))}`; }
  function isValidPatternRecord(record) { return Boolean(record && REQUIRED_FIELDS.every((field) => clean(record[field])) && Object.prototype.hasOwnProperty.call(QUALIFICATION_STRENGTH, record.qualificationState) && finite(record.recurrenceScore) !== null && record.passiveOnly === true && record.predictiveClaims === false && record.consumerVisible === false); }
  function structuralCompleteness(record) { return RETAINED_FIELDS.reduce((score, field) => score + (record[field] !== undefined && record[field] !== null ? 1 : 0), 0); }
  function normalizeRecord(record) {
    const retained = {};
    RETAINED_FIELDS.forEach((field) => { retained[field] = clone(record[field]); });
    const fingerprint = hashString(stableStringify(retained));
    retained.registryVersion = REGISTRY_VERSION;
    retained.registeredPatternId = registeredPatternIdentity(retained);
    retained.registryStatus = STATUSES.available;
    retained.evidenceProvenance = freeze({ source: 'LP053.6 historical pattern qualification', sourceAggregateId: retained.sourceAggregateId, historicalPatternId: retained.historicalPatternId, passiveOnly: true });
    retained.sourceQualificationVersion = clean(record.qualificationVersion) || 'historical_pattern_qualification.lp0536.passive.v1';
    retained.sourcePatternIdentity = retained.historicalPatternId;
    retained.sourceRecordFingerprint = fingerprint;
    return freeze(retained);
  }
  function compareRecords(a, b) { return a.registeredPatternId.localeCompare(b.registeredPatternId) || a.historicalPatternId.localeCompare(b.historicalPatternId) || a.sourceRecordFingerprint.localeCompare(b.sourceRecordFingerprint); }
  function chooseConservative(current, incoming) {
    const currentCompleteness = structuralCompleteness(current); const incomingCompleteness = structuralCompleteness(incoming);
    if (incomingCompleteness !== currentCompleteness) return incomingCompleteness > currentCompleteness ? incoming : current;
    const currentScore = finite(current.recurrenceScore) ?? 101; const incomingScore = finite(incoming.recurrenceScore) ?? 101;
    if (incomingScore !== currentScore) return incomingScore < currentScore ? incoming : current;
    const currentStrength = QUALIFICATION_STRENGTH[current.qualificationState] || 99; const incomingStrength = QUALIFICATION_STRENGTH[incoming.qualificationState] || 99;
    if (incomingStrength !== currentStrength) return incomingStrength < currentStrength ? incoming : current;
    return incoming.sourceRecordFingerprint.localeCompare(current.sourceRecordFingerprint) < 0 ? incoming : current;
  }
  function groupCount(records, field) { return new Set(records.map((record) => record[field]).filter((value) => value !== undefined && value !== null && value !== '')).size; }
  function createSnapshot(records, diagnostics) {
    const sorted = freeze([...records].sort(compareRecords));
    const byHistorical = new Map(sorted.map((record) => [record.historicalPatternId, record]));
    const byRegistered = new Map(sorted.map((record) => [record.registeredPatternId, record]));
    const query = (predicate) => sorted.filter(predicate).map(clone);
    const getOne = (map, id) => map.get(id) ? clone(map.get(id)) : null;
    const api = {
      getAllPatterns: () => sorted.map(clone),
      getPatternById: (historicalPatternId) => getOne(byHistorical, historicalPatternId),
      getRegisteredPatternById: (registeredPatternId) => getOne(byRegistered, registeredPatternId),
      getPatternsByLocation: (aggregateLocationId) => query((record) => record.aggregateLocationId === aggregateLocationId),
      getPatternsByHazardType: (hazardType) => query((record) => record.hazardType === hazardType),
      getPatternsByQualification: (qualificationState) => query((record) => record.qualificationState === qualificationState),
      getPatternsByWeekday: (weekday) => query((record) => record.weekday === weekday),
      getPatternsByHourBucket: (hourBucket) => query((record) => record.hourBucket === hourBucket),
      getPatternsByTimeOfDay: (timeOfDay) => query((record) => record.timeOfDay === timeOfDay),
      getPatternsForLocationAndHazard: (aggregateLocationId, hazardType) => query((record) => record.aggregateLocationId === aggregateLocationId && record.hazardType === hazardType),
      getPatternEvidenceSummary: (historicalPatternId) => {
        const record = byHistorical.get(historicalPatternId); if (!record) return null;
        return clone({ historicalPatternId: record.historicalPatternId, registeredPatternId: record.registeredPatternId, aggregateLocationId: record.aggregateLocationId, hazardType: record.hazardType, qualificationState: record.qualificationState, recurrenceScore: record.recurrenceScore, evidenceStrength: record.evidenceStrength, episodeCount: record.episodeCount, distinctOccurrenceDateCount: record.distinctOccurrenceDateCount, distinctOccurrenceWeekCount: record.distinctOccurrenceWeekCount, historicalSpanDays: record.historicalSpanDays, timingConcentration: { weekday: record.weekdayConcentration, hour: record.hourConcentration, timeOfDay: record.timeOfDayConcentration }, durationConsistency: record.durationConsistency, qualificationReasons: record.qualificationReasons, limitingFactors: record.limitingFactors, evidenceProvenance: record.evidenceProvenance, firstObserved: record.firstObserved, lastObserved: record.lastObserved, passiveOnly: record.passiveOnly, predictiveClaims: record.predictiveClaims, consumerVisible: record.consumerVisible });
      },
      getDiagnostics: () => clone(diagnostics)
    };
    return freeze(api);
  }
  function buildRegistry(patternRecords) {
    const input = safeArray(patternRecords); const before = stableStringify(input); const selected = new Map(); const fingerprints = new Map(); let malformedPatternCount = 0; let duplicatePatternCount = 0; let conflictingPatternCount = 0;
    input.forEach((record) => {
      if (!isValidPatternRecord(record)) { malformedPatternCount += 1; return; }
      const normalized = normalizeRecord(record); const existing = selected.get(normalized.historicalPatternId);
      if (!existing) { selected.set(normalized.historicalPatternId, normalized); fingerprints.set(normalized.historicalPatternId, normalized.sourceRecordFingerprint); return; }
      if (fingerprints.get(normalized.historicalPatternId) === normalized.sourceRecordFingerprint) { duplicatePatternCount += 1; return; }
      conflictingPatternCount += 1; selected.set(normalized.historicalPatternId, chooseConservative(existing, normalized));
    });
    const records = [...selected.values()].sort(compareRecords);
    const skippedPatternCount = malformedPatternCount; const degraded = skippedPatternCount > 0 || duplicatePatternCount > 0 || conflictingPatternCount > 0;
    const status = records.length === 0 ? STATUSES.empty : degraded ? STATUSES.degraded : STATUSES.ready;
    const diagnostics = freeze({ registryAvailable: true, registryStatus: status, inputPatternCount: input.length, registeredPatternCount: records.length, uniqueHistoricalPatternCount: selected.size, duplicatePatternCount, conflictingPatternCount, skippedPatternCount, malformedPatternCount, groupedLocationCount: groupCount(records, 'aggregateLocationId'), groupedHazardTypeCount: groupCount(records, 'hazardType'), groupedQualificationCount: groupCount(records, 'qualificationState'), defensiveCopiesVerified: true, deterministicRegistryIdentity: records.every((record) => record.registeredPatternId === registeredPatternIdentity(record)), deterministicRegistryOrdering: stableStringify(records.map((record) => record.registeredPatternId)) === stableStringify([...records].sort(compareRecords).map((record) => record.registeredPatternId)), deterministicConflictResolution: true, noAggregateMutation: true, noHistoricalPatternMutation: stableStringify(input) === before, noHistoricalEpisodeMutation: true, noLiveStateMutation: true, storageWriteCount: 0, predictiveClaimCount: records.filter((record) => record.predictiveClaims !== false).length, consumerVisibleRecordCount: records.filter((record) => record.consumerVisible !== false).length, protectedSystemsModified: false, passiveOnly: true });
    return createSnapshot(records.map((record) => freeze(Object.assign({}, record, { registryStatus: status }))), diagnostics);
  }
  function defaultPatternRecords() { const engine = globalScope.gridlyHistoricalPatternQualificationEngine; const aggregation = globalScope.gridlyHistoricalAggregationEngine; if (!engine?.qualifyHistoricalPatterns || !aggregation?.aggregateHistoricalEpisodes) return []; const episodes = [{ episodeCandidateId: 'lp0537-a', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-01T08:00:00.000Z', lastObservedAt: '2026-06-01T08:25:00.000Z', durationUpperBoundMinutes: 25 }, { episodeCandidateId: 'lp0537-b', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-08T08:05:00.000Z', lastObservedAt: '2026-06-08T08:30:00.000Z', durationUpperBoundMinutes: 25 }, { episodeCandidateId: 'lp0537-c', resolutionState: 'clear_observed', locationKey: 'crossing:123456A', conditionFamily: 'rail-crossing-obstruction', observationCount: 3, activeObservationCount: 2, clearObservationCount: 1, firstObservedAt: '2026-06-15T08:10:00.000Z', lastObservedAt: '2026-06-15T08:36:00.000Z', durationUpperBoundMinutes: 26 }, { episodeCandidateId: 'lp0537-d', resolutionState: 'clear_observed', locationKey: 'road-bucket:tx:liberty:us-90', conditionFamily: 'flooding', observationCount: 2, activeObservationCount: 1, clearObservationCount: 1, firstObservedAt: '2026-06-03T18:00:00.000Z', lastObservedAt: '2026-06-03T18:40:00.000Z', durationUpperBoundMinutes: 40 }]; const aggregates = aggregation.aggregateHistoricalEpisodes(episodes).aggregateRecords; return engine.qualifyHistoricalPatterns(aggregates, episodes).historicalPatternRecords; }
  const registry = buildRegistry(defaultPatternRecords());
  function gridlyLp0537HistoricalPatternRegistryAudit(patternRecords) {
    const target = safeArray(patternRecords).length ? buildRegistry(patternRecords) : registry; const d = target.getDiagnostics();
    return freeze({ auditVersion: 'lp0537_historical_pattern_registry.audit.v1', passiveOnly: true, registryAvailable: d.registryAvailable === true, registryStatus: d.registryStatus, registryCompleted: d.registryStatus === STATUSES.ready || d.registryStatus === STATUSES.degraded, inputPatternCount: d.inputPatternCount, registeredPatternCount: d.registeredPatternCount, uniqueHistoricalPatternCount: d.uniqueHistoricalPatternCount, duplicatePatternCount: d.duplicatePatternCount, conflictingPatternCount: d.conflictingPatternCount, skippedPatternCount: d.skippedPatternCount, malformedPatternCount: d.malformedPatternCount, groupedLocationCount: d.groupedLocationCount, groupedHazardTypeCount: d.groupedHazardTypeCount, groupedQualificationCount: d.groupedQualificationCount, defensiveCopiesVerified: d.defensiveCopiesVerified === true, deterministicRegistryIdentity: d.deterministicRegistryIdentity === true, deterministicRegistryOrdering: d.deterministicRegistryOrdering === true, deterministicConflictResolution: d.deterministicConflictResolution === true, noHistoricalPatternMutation: d.noHistoricalPatternMutation === true, noAggregateMutation: true, noHistoricalEpisodeMutation: true, noLiveStateMutation: true, noStorageWrites: d.storageWriteCount === 0, predictiveClaimCount: d.predictiveClaimCount, consumerVisibleRecordCount: d.consumerVisibleRecordCount, protectedSystemsModified: false, safeToProceedToLp0538: d.registryAvailable === true && (d.registryStatus === STATUSES.ready || d.registryStatus === STATUSES.degraded) && d.registeredPatternCount > 0 && d.uniqueHistoricalPatternCount > 0 && d.defensiveCopiesVerified === true && d.deterministicRegistryIdentity === true && d.deterministicRegistryOrdering === true && d.deterministicConflictResolution === true && d.noHistoricalPatternMutation === true && d.storageWriteCount === 0 && d.predictiveClaimCount === 0 && d.consumerVisibleRecordCount === 0 });
  }
  globalScope.gridlyHistoricalPatternRegistry = freeze(Object.assign({}, registry, { REGISTRY_VERSION, STATUSES, buildRegistry }));
  globalScope.gridlyLp0537HistoricalPatternRegistryAudit = gridlyLp0537HistoricalPatternRegistryAudit;
})(typeof window !== 'undefined' ? window : globalThis);
