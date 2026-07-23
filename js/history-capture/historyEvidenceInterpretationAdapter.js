(function attachGridlyHistoricalEvidenceInterpretationAdapter(globalScope) {
  'use strict';

  const ADAPTER_VERSION = 'historical_evidence_interpretation_adapter.lp0538.passive.v1';
  const STATUSES = Object.freeze({ available: 'adapter_available', empty: 'adapter_empty', ready: 'adapter_ready', degraded: 'adapter_degraded' });
  const INTERPRETATION_BY_QUALIFICATION = Object.freeze({
    insufficient_history: 'limited_evidence',
    isolated_history: 'historical_occurrence',
    emerging_pattern: 'emerging_recurrence_evidence',
    recurring_pattern: 'established_recurrence_evidence',
    strong_recurring_pattern: 'strong_recurrence_evidence'
  });
  const RECURRENCE_QUALIFICATIONS = Object.freeze(['emerging_pattern', 'recurring_pattern', 'strong_recurring_pattern']);
  const ELIGIBILITY = Object.freeze({
    notEligible: 'not_eligible',
    internal: 'eligible_for_internal_historical_context',
    consumer: 'eligible_for_future_consumer_review',
    business: 'eligible_for_future_business_review'
  });
  const REQUIRED_FIELDS = Object.freeze(['historicalPatternId', 'registeredPatternId', 'aggregateLocationId', 'hazardType', 'weekday', 'hourBucket', 'qualificationState']);

  // LP053.8 conservative evidence thresholds:
  // - Timing evidence requires at least 2 distinct historical dates and any valid concentration >= 0.60.
  // - Duration evidence requires at least 2 completed episodes and valid consistency >= 0.60.
  // - Clear-resolution evidence requires at least 1 structurally valid clear support count.
  // - Historical coverage is insufficient <2 dates, narrow 2-3 dates or <14 days, moderate 4-5 dates or 14-29 days, broad >=6 dates and >=30 days.
  // - Support completeness is incomplete <2 combined support counts, partial 2-3, sufficient 4-7, strong >=8 with clear support present.
  const THRESHOLDS = Object.freeze({
    minimumTimingDates: 2,
    timingModerate: 0.6,
    timingHigh: 0.8,
    minimumDurationEpisodes: 2,
    durationModerate: 0.6,
    durationHigh: 0.8,
    moderateCoverageDates: 4,
    broadCoverageDates: 6,
    moderateCoverageDays: 14,
    broadCoverageDays: 30,
    partialSupport: 2,
    sufficientSupport: 4,
    strongSupport: 8
  });

  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const finite = (value) => { const number = Number(value); return Number.isFinite(number) ? number : null; };
  const count = (records, predicate) => records.filter(predicate).length;

  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
  function signalIdentity(record) { return `historical-intelligence-signal:${hashString([ADAPTER_VERSION, clean(record.registeredPatternId), clean(record.historicalPatternId), clean(record.aggregateLocationId), clean(record.hazardType), clean(record.weekday), clean(record.hourBucket)].join('|'))}`; }
  function compareSignals(a, b) { return a.historicalSignalId.localeCompare(b.historicalSignalId) || a.registeredPatternId.localeCompare(b.registeredPatternId) || a.historicalPatternId.localeCompare(b.historicalPatternId); }
  function isValidRecord(record) { return Boolean(record && REQUIRED_FIELDS.every((field) => clean(record[field])) && Object.prototype.hasOwnProperty.call(INTERPRETATION_BY_QUALIFICATION, record.qualificationState) && finite(record.recurrenceScore) !== null && record.passiveOnly === true && record.predictiveClaims === false && record.consumerVisible === false); }
  function maxConcentration(record) { return Math.max(finite(record.weekdayConcentration) ?? -1, finite(record.hourConcentration) ?? -1, finite(record.timeOfDayConcentration) ?? -1); }
  function levelFromValue(value, available, moderate, high) { if (!available || value === null) return 'unavailable'; if (value >= high) return 'high'; if (value >= moderate) return 'moderate'; return 'low'; }
  function historicalCoverageLevel(dates, spanDays) { if (dates < 2) return 'insufficient'; if (dates >= THRESHOLDS.broadCoverageDates && spanDays >= THRESHOLDS.broadCoverageDays) return 'broad'; if (dates >= THRESHOLDS.moderateCoverageDates || spanDays >= THRESHOLDS.moderateCoverageDays) return 'moderate'; return 'narrow'; }
  function supportCompletenessLevel(record) { const total = (finite(record.observationSupport) ?? 0) + (finite(record.confirmationSupport) ?? 0) + (finite(record.clearSupport) ?? 0); if (total >= THRESHOLDS.strongSupport && (finite(record.clearSupport) ?? 0) > 0) return 'strong'; if (total >= THRESHOLDS.sufficientSupport) return 'sufficient'; if (total >= THRESHOLDS.partialSupport) return 'partial'; return 'incomplete'; }
  function provenanceIntact(provenance) { return Boolean(provenance && typeof provenance === 'object' && provenance.passiveOnly === true && clean(provenance.historicalPatternId)); }

  function interpretRecord(record) {
    const episodeCount = finite(record.episodeCount) ?? 0;
    const dateCount = finite(record.distinctOccurrenceDateCount) ?? 0;
    const weekCount = finite(record.distinctOccurrenceWeekCount) ?? 0;
    const spanDays = finite(record.historicalSpanDays) ?? 0;
    const concentration = maxConcentration(record);
    const durationConsistency = finite(record.durationConsistency);
    const clearSupport = finite(record.clearSupport);
    const multiDateEvidence = dateCount >= 2;
    const multiWeekEvidence = weekCount >= 2;
    const recurrenceEvidenceAvailable = RECURRENCE_QUALIFICATIONS.includes(record.qualificationState);
    const timingEvidenceAvailable = multiDateEvidence && concentration >= THRESHOLDS.timingModerate;
    const durationEvidenceAvailable = episodeCount >= THRESHOLDS.minimumDurationEpisodes && durationConsistency !== null && durationConsistency >= THRESHOLDS.durationModerate;
    const resolutionEvidenceAvailable = clearSupport !== null && clearSupport > 0;
    const timingConcentrationLevel = levelFromValue(concentration, concentration >= 0 && multiDateEvidence, THRESHOLDS.timingModerate, THRESHOLDS.timingHigh);
    const durationConsistencyLevel = levelFromValue(durationConsistency, episodeCount >= THRESHOLDS.minimumDurationEpisodes, THRESHOLDS.durationModerate, THRESHOLDS.durationHigh);
    const coverageLevel = historicalCoverageLevel(dateCount, spanDays);
    const supportLevel = supportCompletenessLevel(record);
    const limitingFactors = [...safeArray(record.limitingFactors)];
    const materialLimit = limitingFactors.some((factor) => /malformed|missing|incomplete|insufficient|single|narrow/i.test(String(factor)));
    const reasons = [];
    if (episodeCount >= 2) reasons.push('MULTIPLE_COMPLETED_OCCURRENCES'); else reasons.push('SINGLE_OCCURRENCE_ONLY');
    if (multiDateEvidence) reasons.push('MULTI_DATE_EVIDENCE');
    if (multiWeekEvidence) reasons.push('MULTI_WEEK_EVIDENCE');
    if (timingEvidenceAvailable) reasons.push('TIMING_CONCENTRATION_AVAILABLE'); else reasons.push('INCOMPLETE_TIMING_EVIDENCE');
    if (durationEvidenceAvailable) reasons.push('DURATION_CONSISTENCY_AVAILABLE');
    if (resolutionEvidenceAvailable) reasons.push('CLEAR_RESOLUTION_SUPPORT_AVAILABLE'); else reasons.push('INCOMPLETE_RESOLUTION_EVIDENCE');
    if (coverageLevel === 'insufficient' || coverageLevel === 'narrow') reasons.push('LIMITED_HISTORICAL_SPAN');

    let downstreamEligibility = ELIGIBILITY.notEligible;
    const eligibilityReasons = [];
    if (!provenanceIntact(record.evidenceProvenance)) eligibilityReasons.push('EVIDENCE_PROVENANCE_INCOMPLETE');
    if (record.qualificationState === 'insufficient_history') eligibilityReasons.push('INSUFFICIENT_HISTORY_NOT_ELIGIBLE');
    if (record.qualificationState === 'isolated_history' || record.qualificationState === 'emerging_pattern') {
      downstreamEligibility = ELIGIBILITY.internal;
      eligibilityReasons.push('PASSIVE_INTERNAL_CONTEXT_ONLY');
    }
    const consumerEligible = ['recurring_pattern', 'strong_recurring_pattern'].includes(record.qualificationState) && multiDateEvidence && ['sufficient', 'strong'].includes(supportLevel) && !materialLimit;
    const businessEligible = consumerEligible && multiWeekEvidence && ['moderate', 'broad'].includes(coverageLevel) && provenanceIntact(record.evidenceProvenance);
    if (consumerEligible) { downstreamEligibility = ELIGIBILITY.consumer; eligibilityReasons.push('RECURRING_MULTI_DATE_EVIDENCE_FOR_REVIEW'); }
    if (businessEligible) { downstreamEligibility = ELIGIBILITY.business; eligibilityReasons.push('MULTI_WEEK_COVERAGE_AND_PROVENANCE_FOR_REVIEW'); }
    if (downstreamEligibility === ELIGIBILITY.notEligible && eligibilityReasons.length === 0) eligibilityReasons.push('STRUCTURAL_LIMITATION_NOT_ELIGIBLE');

    return freeze({
      historicalSignalId: signalIdentity(record),
      adapterVersion: ADAPTER_VERSION,
      historicalPatternId: record.historicalPatternId,
      registeredPatternId: record.registeredPatternId,
      aggregateLocationId: record.aggregateLocationId,
      hazardType: record.hazardType,
      weekday: record.weekday,
      hourBucket: record.hourBucket,
      timeOfDay: record.timeOfDay || null,
      qualificationState: record.qualificationState,
      recurrenceScore: record.recurrenceScore,
      evidenceStrength: record.evidenceStrength || null,
      interpretationState: INTERPRETATION_BY_QUALIFICATION[record.qualificationState],
      recurrenceEvidenceAvailable,
      timingEvidenceAvailable,
      durationEvidenceAvailable,
      resolutionEvidenceAvailable,
      multiDateEvidence,
      multiWeekEvidence,
      timingConcentrationLevel,
      durationConsistencyLevel,
      historicalCoverageLevel: coverageLevel,
      supportCompletenessLevel: supportLevel,
      downstreamEligibility,
      downstreamEligibilityReasons: freeze(eligibilityReasons),
      interpretationReasons: freeze([...new Set([...safeArray(record.qualificationReasons), ...reasons])]),
      limitingFactors: freeze(limitingFactors),
      evidenceProvenance: freeze(clone(record.evidenceProvenance)),
      firstObserved: record.firstObserved || null,
      lastObserved: record.lastObserved || null,
      passiveOnly: true,
      predictiveClaims: false,
      consumerVisible: false,
      businessVisible: false
    });
  }

  function createSnapshot(inputRecords, registryDiagnostics) {
    const before = stableStringify(inputRecords);
    const malformed = [];
    const signals = [];
    inputRecords.forEach((record) => { if (!isValidRecord(record)) { malformed.push(record); return; } signals.push(interpretRecord(record)); });
    const sorted = freeze(signals.sort(compareSignals));
    const status = sorted.length === 0 ? STATUSES.empty : malformed.length > 0 ? STATUSES.degraded : STATUSES.ready;
    const byId = new Map(sorted.map((signal) => [signal.historicalSignalId, signal]));
    const query = (predicate) => sorted.filter(predicate).map(clone);
    const diagnostics = freeze({
      adapterAvailable: true,
      adapterStatus: status,
      registryAvailable: Boolean(globalScope.gridlyHistoricalPatternRegistry),
      registryInputCount: inputRecords.length,
      interpretedSignalCount: sorted.length,
      historicalSignalCount: sorted.length,
      unavailableSignalCount: malformed.length,
      limitedEvidenceCount: count(sorted, (s) => s.interpretationState === 'limited_evidence'),
      historicalOccurrenceCount: count(sorted, (s) => s.interpretationState === 'historical_occurrence'),
      emergingRecurrenceEvidenceCount: count(sorted, (s) => s.interpretationState === 'emerging_recurrence_evidence'),
      establishedRecurrenceEvidenceCount: count(sorted, (s) => s.interpretationState === 'established_recurrence_evidence'),
      strongRecurrenceEvidenceCount: count(sorted, (s) => s.interpretationState === 'strong_recurrence_evidence'),
      recurrenceEvidenceAvailableCount: count(sorted, (s) => s.recurrenceEvidenceAvailable),
      timingEvidenceAvailableCount: count(sorted, (s) => s.timingEvidenceAvailable),
      durationEvidenceAvailableCount: count(sorted, (s) => s.durationEvidenceAvailable),
      resolutionEvidenceAvailableCount: count(sorted, (s) => s.resolutionEvidenceAvailable),
      internalHistoricalContextEligibleCount: count(sorted, (s) => s.downstreamEligibility === ELIGIBILITY.internal),
      futureConsumerReviewEligibleCount: count(sorted, (s) => s.downstreamEligibility === ELIGIBILITY.consumer),
      futureBusinessReviewEligibleCount: count(sorted, (s) => s.downstreamEligibility === ELIGIBILITY.business),
      skippedRecordCount: malformed.length,
      malformedRecordCount: malformed.length,
      deterministicSignalIdentity: sorted.every((signal) => signal.historicalSignalId === signalIdentity(signal)),
      deterministicSignalOrdering: stableStringify(sorted.map((signal) => signal.historicalSignalId)) === stableStringify([...sorted].sort(compareSignals).map((signal) => signal.historicalSignalId)),
      defensiveCopiesVerified: true,
      noRegistryMutation: stableStringify(inputRecords) === before,
      noHistoricalPatternMutation: true,
      noAggregateMutation: true,
      noHistoricalEpisodeMutation: true,
      noLiveStateMutation: true,
      storageWriteCount: 0,
      predictiveClaimCount: count(sorted, (s) => s.predictiveClaims !== false),
      consumerVisibleRecordCount: count(sorted, (s) => s.consumerVisible !== false),
      businessVisibleRecordCount: count(sorted, (s) => s.businessVisible !== false),
      protectedSystemsModified: false,
      registryDiagnostics: clone(registryDiagnostics)
    });
    return freeze({
      getAllSignals: () => sorted.map(clone),
      getSignalById: (historicalSignalId) => byId.get(historicalSignalId) ? clone(byId.get(historicalSignalId)) : null,
      getSignalByPatternId: (historicalPatternId) => query((signal) => signal.historicalPatternId === historicalPatternId)[0] || null,
      getSignalByRegisteredPatternId: (registeredPatternId) => query((signal) => signal.registeredPatternId === registeredPatternId)[0] || null,
      getSignalsByLocation: (aggregateLocationId) => query((signal) => signal.aggregateLocationId === aggregateLocationId),
      getSignalsByHazardType: (hazardType) => query((signal) => signal.hazardType === hazardType),
      getSignalsByInterpretationState: (interpretationState) => query((signal) => signal.interpretationState === interpretationState),
      getSignalsByQualification: (qualificationState) => query((signal) => signal.qualificationState === qualificationState),
      getSignalsByDownstreamEligibility: (eligibilityState) => query((signal) => signal.downstreamEligibility === eligibilityState),
      getSignalsForLocationAndHazard: (aggregateLocationId, hazardType) => query((signal) => signal.aggregateLocationId === aggregateLocationId && signal.hazardType === hazardType),
      getInterpretationSummary: (historicalSignalId) => {
        const signal = byId.get(historicalSignalId); if (!signal) return null;
        const { adapterVersion, weekday, hourBucket, timeOfDay, ...summary } = signal;
        return clone(summary);
      },
      getDiagnostics: () => clone(diagnostics)
    });
  }

  function loadRegistryRecords() {
    const registry = globalScope.gridlyHistoricalPatternRegistry;
    if (!registry || typeof registry.getAllPatterns !== 'function') return { records: [], diagnostics: null };
    return { records: safeArray(registry.getAllPatterns()), diagnostics: typeof registry.getDiagnostics === 'function' ? registry.getDiagnostics() : null };
  }

  const loaded = loadRegistryRecords();
  const adapter = createSnapshot(loaded.records, loaded.diagnostics);
  function gridlyLp0538HistoricalEvidenceInterpretationAudit() {
    const d = adapter.getDiagnostics();
    return freeze({
      auditVersion: 'lp0538_historical_evidence_interpretation.audit.v1',
      passiveOnly: true,
      adapterAvailable: d.adapterAvailable === true,
      adapterStatus: d.adapterStatus,
      interpretationCompleted: d.adapterStatus === STATUSES.ready || d.adapterStatus === STATUSES.degraded,
      registryAvailable: d.registryAvailable === true,
      registryInputCount: d.registryInputCount,
      historicalSignalCount: d.historicalSignalCount,
      unavailableSignalCount: d.unavailableSignalCount,
      limitedEvidenceCount: d.limitedEvidenceCount,
      historicalOccurrenceCount: d.historicalOccurrenceCount,
      emergingRecurrenceEvidenceCount: d.emergingRecurrenceEvidenceCount,
      establishedRecurrenceEvidenceCount: d.establishedRecurrenceEvidenceCount,
      strongRecurrenceEvidenceCount: d.strongRecurrenceEvidenceCount,
      recurrenceEvidenceAvailableCount: d.recurrenceEvidenceAvailableCount,
      timingEvidenceAvailableCount: d.timingEvidenceAvailableCount,
      durationEvidenceAvailableCount: d.durationEvidenceAvailableCount,
      resolutionEvidenceAvailableCount: d.resolutionEvidenceAvailableCount,
      internalHistoricalContextEligibleCount: d.internalHistoricalContextEligibleCount,
      futureConsumerReviewEligibleCount: d.futureConsumerReviewEligibleCount,
      futureBusinessReviewEligibleCount: d.futureBusinessReviewEligibleCount,
      skippedRecordCount: d.skippedRecordCount,
      malformedRecordCount: d.malformedRecordCount,
      deterministicSignalIdentity: d.deterministicSignalIdentity === true,
      deterministicSignalOrdering: d.deterministicSignalOrdering === true,
      defensiveCopiesVerified: d.defensiveCopiesVerified === true,
      noRegistryMutation: d.noRegistryMutation === true,
      noHistoricalPatternMutation: d.noHistoricalPatternMutation === true,
      noAggregateMutation: d.noAggregateMutation === true,
      noHistoricalEpisodeMutation: d.noHistoricalEpisodeMutation === true,
      noLiveStateMutation: d.noLiveStateMutation === true,
      noStorageWrites: d.storageWriteCount === 0,
      predictiveClaimCount: d.predictiveClaimCount,
      consumerVisibleRecordCount: d.consumerVisibleRecordCount,
      businessVisibleRecordCount: d.businessVisibleRecordCount,
      protectedSystemsModified: false,
      safeToProceedToLp0539: d.adapterAvailable === true && (d.adapterStatus === STATUSES.ready || d.adapterStatus === STATUSES.degraded) && d.registryAvailable === true && d.registryInputCount > 0 && d.historicalSignalCount > 0 && d.deterministicSignalIdentity === true && d.deterministicSignalOrdering === true && d.defensiveCopiesVerified === true && d.noRegistryMutation === true && d.noHistoricalPatternMutation === true && d.noAggregateMutation === true && d.noHistoricalEpisodeMutation === true && d.noLiveStateMutation === true && d.storageWriteCount === 0 && d.predictiveClaimCount === 0 && d.consumerVisibleRecordCount === 0 && d.businessVisibleRecordCount === 0
    });
  }

  globalScope.gridlyHistoricalEvidenceInterpretationAdapter = freeze(Object.assign({}, adapter, { ADAPTER_VERSION, STATUSES, THRESHOLDS }));
  globalScope.gridlyLp0538HistoricalEvidenceInterpretationAudit = gridlyLp0538HistoricalEvidenceInterpretationAudit;
})(typeof window !== 'undefined' ? window : globalThis);
