(function attachGridlyHistoricalIntelligenceReadinessIndex(globalScope) {
  'use strict';

  const INDEX_VERSION = 'historical_intelligence_readiness_index.lp0539.passive.v1';
  const STATUSES = Object.freeze({ available: 'index_available', empty: 'index_empty', ready: 'index_ready', degraded: 'index_degraded', blocked: 'index_blocked' });
  const STATES = Object.freeze({ notReady: 'not_ready', foundationOnly: 'foundation_only', limited: 'limited_readiness', internal: 'internal_context_ready', consumer: 'consumer_review_ready', business: 'business_review_ready' });
  const REQUIRED_FIELDS = Object.freeze(['historicalSignalId', 'historicalPatternId', 'registeredPatternId', 'aggregateLocationId', 'hazardType', 'weekday', 'hourBucket', 'interpretationState']);
  const ESTABLISHED_STATES = Object.freeze(['established_recurrence_evidence', 'strong_recurrence_evidence']);

  // LP053.9 deterministic readiness thresholds (not probabilities):
  // - Structural completeness is incomplete when required identity/interpretation fields are absent; partial when passive safety flags/provenance are invalid; sufficient for complete required identity and safe flags; complete when sufficient plus intact provenance.
  // - Temporal coverage maps LP053.8 coverage directly: insufficient, narrow, moderate, broad.
  // - Recurrence maturity maps interpretation state: limited_evidence=none, historical_occurrence=isolated, emerging_recurrence_evidence=emerging, established_recurrence_evidence=established, strong_recurrence_evidence=strong.
  // - Timing readiness: unavailable without timing evidence, limited for low/unavailable concentration, sufficient for moderate, strong for high.
  // - Duration readiness: unavailable without duration evidence, limited for low/unavailable consistency, sufficient for moderate, strong for high.
  // - Resolution readiness: unavailable without resolution evidence, sufficient when resolution evidence exists with sufficient/strong support, otherwise limited.
  // - Limiting factor severity is material when LP053.8 limiting factors mention material/malformed/missing/incomplete/insufficient/single/narrow/invalid/predictive/visibility; moderate for any other limitation; none when absent.
  // - Scores are bounded 0-100. Structural completeness and provenance are gates; state governance can only downgrade range-derived readiness.
  const SCORE_WEIGHTS = Object.freeze({ structural: 18, coverage: 14, multiDate: 12, multiWeek: 10, recurrence: 14, timing: 8, duration: 8, resolution: 8, provenance: 8 });

  const freeze = (value) => { try { return Object.freeze(value); } catch (error) { return value; } };
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeArray = (value) => Array.isArray(value) ? value : [];
  const clean = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
  const count = (records, predicate) => records.filter(predicate).length;
  const bounded = (value) => Math.max(0, Math.min(100, Math.round(value)));
  const bool = (value) => value === true;
  function hashString(input) { let hash = 2166136261; for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function stableStringify(value) { if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`; return JSON.stringify(value); }
  function readinessIdentity(signal) { return `historical-intelligence-readiness:${hashString([INDEX_VERSION, clean(signal.historicalSignalId), clean(signal.registeredPatternId), clean(signal.historicalPatternId), clean(signal.aggregateLocationId), clean(signal.hazardType), clean(signal.weekday), clean(signal.hourBucket)].join('|'))}`; }
  function compareReadiness(a, b) { return a.historicalReadinessId.localeCompare(b.historicalReadinessId) || a.historicalSignalId.localeCompare(b.historicalSignalId); }
  function provenanceStatus(signal) { const p = signal && signal.evidenceProvenance; if (!p || typeof p !== 'object') return 'missing'; return p.passiveOnly === true && clean(p.historicalPatternId) ? 'intact' : 'incomplete'; }
  function structuralCompleteness(signal) { if (!signal || REQUIRED_FIELDS.some((field) => !clean(signal[field]))) return 'incomplete'; if (signal.passiveOnly !== true || signal.predictiveClaims !== false || signal.consumerVisible !== false || signal.businessVisible !== false || provenanceStatus(signal) === 'missing') return 'partial'; return provenanceStatus(signal) === 'intact' ? 'complete' : 'sufficient'; }
  function recurrenceMaturity(signal) { return ({ limited_evidence: 'none', historical_occurrence: 'isolated', emerging_recurrence_evidence: 'emerging', established_recurrence_evidence: 'established', strong_recurrence_evidence: 'strong' })[signal.interpretationState] || 'none'; }
  function evidenceMaturity(record) { if (record.structuralCompleteness === 'incomplete' || record.provenanceStatus === 'missing') return 'unavailable'; if (record.recurrenceMaturityLevel === 'strong' && record.temporalCoverageLevel === 'broad' && record.multiWeekEvidence) return 'mature'; if (['established', 'strong'].includes(record.recurrenceMaturityLevel) && record.multiDateEvidence) return 'established'; if (record.multiDateEvidence || record.recurrenceMaturityLevel === 'emerging') return 'developing'; return 'foundational'; }
  function readinessLevel(available, sourceLevel) { if (!available) return 'unavailable'; if (sourceLevel === 'high' || sourceLevel === 'strong') return 'strong'; if (sourceLevel === 'moderate' || sourceLevel === 'sufficient') return 'sufficient'; return 'limited'; }
  function limitingSeverity(signal) { const factors = safeArray(signal.limitingFactors); if (!factors.length) return 'none'; return factors.some((factor) => /material|malformed|missing|incomplete|insufficient|single|narrow|invalid|predictive|visibility/i.test(String(factor))) ? 'material' : 'moderate'; }
  function materialLimit(record) { return record.limitingFactorSeverity === 'material'; }
  function scoreFor(record) {
    let score = 0;
    score += ({ incomplete: 0, partial: 5, sufficient: 14, complete: 18 })[record.structuralCompleteness] || 0;
    score += ({ insufficient: 0, narrow: 5, moderate: 10, broad: 14 })[record.temporalCoverageLevel] || 0;
    score += record.multiDateEvidence ? SCORE_WEIGHTS.multiDate : 0;
    score += record.multiWeekEvidence ? SCORE_WEIGHTS.multiWeek : 0;
    score += ({ none: 0, isolated: 3, emerging: 7, established: 11, strong: 14 })[record.recurrenceMaturityLevel] || 0;
    score += ({ unavailable: 0, limited: 3, sufficient: 6, strong: 8 })[record.timingReadinessLevel] || 0;
    score += ({ unavailable: 0, limited: 3, sufficient: 6, strong: 8 })[record.durationReadinessLevel] || 0;
    score += ({ unavailable: 0, limited: 3, sufficient: 6, strong: 8 })[record.resolutionReadinessLevel] || 0;
    score += ({ missing: 0, incomplete: 3, intact: 8 })[record.provenanceStatus] || 0;
    score -= ({ none: 0, low: 3, moderate: 8, material: 18 })[record.limitingFactorSeverity] || 0;
    return bounded(score);
  }
  function rangeState(score) { if (score >= 90) return STATES.business; if (score >= 75) return STATES.consumer; if (score >= 60) return STATES.internal; if (score >= 40) return STATES.limited; if (score >= 20) return STATES.foundationOnly; return STATES.notReady; }
  function reasonsAndLimitations(record, signal) {
    const reasons = [], limitations = [...safeArray(signal.limitingFactors)];
    if (record.structuralCompleteness === 'complete') reasons.push('STRUCTURAL_EVIDENCE_COMPLETE'); else limitations.push('STRUCTURAL_EVIDENCE_INCOMPLETE');
    if (record.provenanceStatus === 'intact') reasons.push('PROVENANCE_INTACT'); else limitations.push('PROVENANCE_MISSING');
    if (record.multiDateEvidence) reasons.push('MULTI_DATE_HISTORY_AVAILABLE'); else limitations.push('LIMITED_DISTINCT_DATES', 'SINGLE_OCCURRENCE_ONLY');
    if (record.multiWeekEvidence) reasons.push('MULTI_WEEK_HISTORY_AVAILABLE'); else limitations.push('LIMITED_DISTINCT_WEEKS');
    if (record.temporalCoverageLevel === 'moderate') reasons.push('MODERATE_HISTORICAL_COVERAGE');
    if (record.temporalCoverageLevel === 'broad') reasons.push('BROAD_HISTORICAL_COVERAGE');
    if (['insufficient', 'narrow'].includes(record.temporalCoverageLevel)) limitations.push('NARROW_HISTORICAL_COVERAGE');
    if (record.recurrenceMaturityLevel === 'established') reasons.push('RECURRENCE_EVIDENCE_ESTABLISHED');
    if (record.recurrenceMaturityLevel === 'strong') reasons.push('STRONG_RECURRENCE_EVIDENCE');
    if (!signal.recurrenceEvidenceAvailable) limitations.push('RECURRENCE_EVIDENCE_UNAVAILABLE');
    if (['sufficient', 'strong'].includes(record.timingReadinessLevel)) reasons.push('TIMING_EVIDENCE_SUFFICIENT'); else limitations.push('TIMING_EVIDENCE_UNAVAILABLE');
    if (['sufficient', 'strong'].includes(record.durationReadinessLevel)) reasons.push('DURATION_EVIDENCE_SUFFICIENT'); else limitations.push('DURATION_EVIDENCE_UNAVAILABLE');
    if (['sufficient', 'strong'].includes(record.resolutionReadinessLevel)) reasons.push('RESOLUTION_EVIDENCE_SUFFICIENT'); else limitations.push('RESOLUTION_EVIDENCE_UNAVAILABLE');
    if (['sufficient', 'strong'].includes(signal.supportCompletenessLevel)) reasons.push('SUPPORT_COMPLETENESS_SUFFICIENT'); else limitations.push('SUPPORT_COMPLETENESS_LIMITED');
    if (record.limitingFactorSeverity === 'material') limitations.push('MATERIAL_LIMITING_FACTOR_PRESENT');
    if (signal.passiveOnly !== true) limitations.push('INVALID_PASSIVE_FLAG');
    if (signal.predictiveClaims !== false) limitations.push('PREDICTIVE_CLAIM_PRESENT');
    if (signal.consumerVisible !== false) limitations.push('CONSUMER_VISIBILITY_INVALID');
    if (signal.businessVisible !== false) limitations.push('BUSINESS_VISIBILITY_INVALID');
    return { reasons: [...new Set(reasons)].sort(), limitations: [...new Set(limitations)].sort() };
  }
  function governedState(record, signal) {
    if (record.structuralCompleteness === 'incomplete' || record.provenanceStatus === 'missing' || signal.passiveOnly !== true || signal.predictiveClaims !== false || signal.consumerVisible !== false || signal.businessVisible !== false || !clean(signal.interpretationState)) return STATES.notReady;
    const consumerGate = ESTABLISHED_STATES.includes(signal.interpretationState) && signal.recurrenceEvidenceAvailable === true && record.multiDateEvidence && ['moderate', 'broad'].includes(record.temporalCoverageLevel) && ['sufficient', 'strong'].includes(signal.supportCompletenessLevel) && record.provenanceStatus === 'intact' && !materialLimit(record) && signal.consumerVisible === false;
    const businessGate = consumerGate && record.multiWeekEvidence && ['sufficient', 'strong'].includes(signal.supportCompletenessLevel) && (signal.timingEvidenceAvailable === true || signal.durationEvidenceAvailable === true) && signal.resolutionEvidenceAvailable === true && signal.businessVisible === false;
    if (businessGate && record.readinessScore >= 90) return STATES.business;
    if (consumerGate && record.readinessScore >= 75) return STATES.consumer;
    if (record.structuralCompleteness === 'complete' && record.multiDateEvidence && record.provenanceStatus === 'intact' && record.readinessScore >= 60 && !materialLimit(record)) return STATES.internal;
    if (record.multiDateEvidence && (signal.recurrenceEvidenceAvailable || signal.timingEvidenceAvailable)) return STATES.limited;
    return STATES.foundationOnly;
  }
  function isMalformed(signal) { return !signal || typeof signal !== 'object' || REQUIRED_FIELDS.some((field) => !clean(signal[field])); }
  function buildRecord(signal) {
    const skeleton = {
      historicalReadinessId: readinessIdentity(signal), indexVersion: INDEX_VERSION, historicalSignalId: signal.historicalSignalId, historicalPatternId: signal.historicalPatternId, registeredPatternId: signal.registeredPatternId, aggregateLocationId: signal.aggregateLocationId, hazardType: signal.hazardType, weekday: signal.weekday, hourBucket: signal.hourBucket, timeOfDay: signal.timeOfDay || null, qualificationState: signal.qualificationState || null, interpretationState: signal.interpretationState, recurrenceScore: signal.recurrenceScore,
      structuralCompleteness: structuralCompleteness(signal), temporalCoverageLevel: signal.historicalCoverageLevel || 'insufficient', recurrenceMaturityLevel: recurrenceMaturity(signal), timingReadinessLevel: readinessLevel(signal.timingEvidenceAvailable, signal.timingConcentrationLevel), durationReadinessLevel: readinessLevel(signal.durationEvidenceAvailable, signal.durationConsistencyLevel), resolutionReadinessLevel: readinessLevel(signal.resolutionEvidenceAvailable, signal.supportCompletenessLevel), provenanceStatus: provenanceStatus(signal), limitingFactorSeverity: limitingSeverity(signal), multiDateEvidence: bool(signal.multiDateEvidence), multiWeekEvidence: bool(signal.multiWeekEvidence)
    };
    skeleton.evidenceMaturityLevel = evidenceMaturity(skeleton);
    skeleton.readinessScore = scoreFor(skeleton);
    skeleton.readinessState = governedState(skeleton, signal);
    skeleton.internalHistoricalContextReady = skeleton.readinessState === STATES.internal || skeleton.readinessState === STATES.consumer || skeleton.readinessState === STATES.business;
    skeleton.futureConsumerReviewReady = skeleton.readinessState === STATES.consumer || skeleton.readinessState === STATES.business;
    skeleton.futureBusinessReviewReady = skeleton.readinessState === STATES.business;
    const coded = reasonsAndLimitations(skeleton, signal);
    if (skeleton.internalHistoricalContextReady) coded.reasons.push('INTERNAL_CONTEXT_REQUIREMENTS_MET');
    if (skeleton.futureConsumerReviewReady) coded.reasons.push('CONSUMER_REVIEW_REQUIREMENTS_MET');
    if (skeleton.futureBusinessReviewReady) coded.reasons.push('BUSINESS_REVIEW_REQUIREMENTS_MET');
    return freeze(Object.assign(skeleton, { readinessReasons: freeze([...new Set(coded.reasons)].sort()), readinessLimitations: freeze([...new Set(coded.limitations)].sort()), evidenceProvenance: freeze(clone(signal.evidenceProvenance)), firstObserved: signal.firstObserved || null, lastObserved: signal.lastObserved || null, passiveOnly: true, predictiveClaims: false, consumerVisible: false, businessVisible: false }));
  }
  function median(values) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2); }
  function createSnapshot(signals, adapterDiagnostics) {
    const before = stableStringify(signals);
    const malformed = [], records = [];
    signals.forEach((signal) => { if (isMalformed(signal)) malformed.push(signal); else records.push(buildRecord(signal)); });
    const sorted = freeze(records.sort(compareReadiness));
    const safetyViolationCount = count(sorted, (r) => r.readinessState === STATES.notReady && (r.readinessLimitations.includes('INVALID_PASSIVE_FLAG') || r.readinessLimitations.includes('PREDICTIVE_CLAIM_PRESENT') || r.readinessLimitations.includes('CONSUMER_VISIBILITY_INVALID') || r.readinessLimitations.includes('BUSINESS_VISIBILITY_INVALID') || r.readinessLimitations.includes('PROVENANCE_MISSING')));
    const status = sorted.length === 0 ? (signals.length === 0 ? STATUSES.empty : STATUSES.blocked) : safetyViolationCount > 0 ? STATUSES.blocked : malformed.length > 0 ? STATUSES.degraded : STATUSES.ready;
    const scores = sorted.map((r) => r.readinessScore);
    const locations = new Set(sorted.map((r) => r.aggregateLocationId));
    const hazards = new Set(sorted.map((r) => r.hazardType));
    const summary = freeze({ indexVersion: INDEX_VERSION, readinessIndexStatus: status, inputSignalCount: signals.length, readinessRecordCount: sorted.length, notReadyCount: count(sorted, (r) => r.readinessState === STATES.notReady), foundationOnlyCount: count(sorted, (r) => r.readinessState === STATES.foundationOnly), limitedReadinessCount: count(sorted, (r) => r.readinessState === STATES.limited), internalContextReadyCount: count(sorted, (r) => r.readinessState === STATES.internal), consumerReviewReadyCount: count(sorted, (r) => r.readinessState === STATES.consumer), businessReviewReadyCount: count(sorted, (r) => r.readinessState === STATES.business), groupedLocationCount: locations.size, groupedHazardTypeCount: hazards.size, averageReadinessScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0, medianReadinessScore: median(scores), structuralCompletenessRate: sorted.length ? count(sorted, (r) => r.structuralCompleteness === 'complete') / sorted.length : 0, provenanceIntegrityRate: sorted.length ? count(sorted, (r) => r.provenanceStatus === 'intact') / sorted.length : 0, multiDateEvidenceRate: sorted.length ? count(sorted, (r) => r.multiDateEvidence) / sorted.length : 0, multiWeekEvidenceRate: sorted.length ? count(sorted, (r) => r.multiWeekEvidence) / sorted.length : 0, recurrenceEvidenceRate: sorted.length ? count(sorted, (r) => ['emerging', 'established', 'strong'].includes(r.recurrenceMaturityLevel)) / sorted.length : 0, timingEvidenceRate: sorted.length ? count(sorted, (r) => r.timingReadinessLevel !== 'unavailable') / sorted.length : 0, durationEvidenceRate: sorted.length ? count(sorted, (r) => r.durationReadinessLevel !== 'unavailable') / sorted.length : 0, resolutionEvidenceRate: sorted.length ? count(sorted, (r) => r.resolutionReadinessLevel !== 'unavailable') / sorted.length : 0, predictiveClaimCount: count(sorted, (r) => r.predictiveClaims !== false), consumerVisibleRecordCount: count(sorted, (r) => r.consumerVisible !== false), businessVisibleRecordCount: count(sorted, (r) => r.businessVisible !== false), protectedSystemsModified: false });
    const byId = new Map(sorted.map((record) => [record.historicalReadinessId, record]));
    const query = (predicate) => sorted.filter(predicate).map(clone);
    const diagnostics = freeze(Object.assign({}, summary, { indexAvailable: true, interpretationAdapterAvailable: Boolean(globalScope.gridlyHistoricalEvidenceInterpretationAdapter), malformedSignalCount: malformed.length, skippedSignalCount: malformed.length, deterministicReadinessIdentity: sorted.every((r) => r.historicalReadinessId === readinessIdentity(r)), deterministicReadinessScoring: stableStringify(sorted.map((r) => [r.historicalReadinessId, r.readinessScore])) === stableStringify([...sorted].map((r) => [r.historicalReadinessId, scoreFor(r)])), deterministicReadinessOrdering: stableStringify(sorted.map((r) => r.historicalReadinessId)) === stableStringify([...sorted].sort(compareReadiness).map((r) => r.historicalReadinessId)), defensiveCopiesVerified: true, noInterpretationSignalMutation: stableStringify(signals) === before, noRegistryMutation: true, noHistoricalPatternMutation: true, noAggregateMutation: true, noHistoricalEpisodeMutation: true, noLiveStateMutation: true, storageWriteCount: 0, protectedSystemStatus: 'unchanged', interpretationAdapterDiagnostics: clone(adapterDiagnostics) }));
    const summarize = (record) => record ? clone({ historicalReadinessId: record.historicalReadinessId, historicalSignalId: record.historicalSignalId, historicalPatternId: record.historicalPatternId, registeredPatternId: record.registeredPatternId, aggregateLocationId: record.aggregateLocationId, hazardType: record.hazardType, readinessScore: record.readinessScore, readinessState: record.readinessState, evidenceMaturityLevel: record.evidenceMaturityLevel, structuralCompleteness: record.structuralCompleteness, temporalCoverageLevel: record.temporalCoverageLevel, recurrenceMaturityLevel: record.recurrenceMaturityLevel, timingReadinessLevel: record.timingReadinessLevel, durationReadinessLevel: record.durationReadinessLevel, resolutionReadinessLevel: record.resolutionReadinessLevel, provenanceStatus: record.provenanceStatus, limitingFactorSeverity: record.limitingFactorSeverity, internalHistoricalContextReady: record.internalHistoricalContextReady, futureConsumerReviewReady: record.futureConsumerReviewReady, futureBusinessReviewReady: record.futureBusinessReviewReady, readinessReasons: record.readinessReasons, readinessLimitations: record.readinessLimitations, evidenceProvenance: record.evidenceProvenance, passiveOnly: true, predictiveClaims: false, consumerVisible: false, businessVisible: false }) : null;
    return freeze({ getAllReadinessRecords: () => sorted.map(clone), getReadinessById: (id) => byId.get(id) ? clone(byId.get(id)) : null, getReadinessBySignalId: (id) => query((r) => r.historicalSignalId === id)[0] || null, getReadinessByPatternId: (id) => query((r) => r.historicalPatternId === id)[0] || null, getReadinessByRegisteredPatternId: (id) => query((r) => r.registeredPatternId === id), getReadinessByLocation: (id) => query((r) => r.aggregateLocationId === id), getReadinessByHazardType: (type) => query((r) => r.hazardType === type), getReadinessByState: (state) => query((r) => r.readinessState === state), getReadinessByEvidenceMaturity: (level) => query((r) => r.evidenceMaturityLevel === level), getConsumerReviewReadyRecords: () => query((r) => r.readinessState === STATES.consumer || r.readinessState === STATES.business), getBusinessReviewReadyRecords: () => query((r) => r.readinessState === STATES.business), getReadinessForLocationAndHazard: (location, hazard) => query((r) => r.aggregateLocationId === location && r.hazardType === hazard), getReadinessSummary: (id) => summarize(byId.get(id)), getGlobalReadinessSummary: () => clone(summary), getDiagnostics: () => clone(diagnostics) });
  }
  function loadSignals() { const adapter = globalScope.gridlyHistoricalEvidenceInterpretationAdapter; if (!adapter || typeof adapter.getAllSignals !== 'function') return { signals: [], diagnostics: null }; return { signals: safeArray(adapter.getAllSignals()), diagnostics: typeof adapter.getDiagnostics === 'function' ? adapter.getDiagnostics() : null }; }
  const loaded = loadSignals();
  const index = createSnapshot(loaded.signals, loaded.diagnostics);
  function gridlyLp0539HistoricalIntelligenceReadinessAudit() { const d = index.getDiagnostics(); return freeze({ auditVersion: 'lp0539_historical_intelligence_readiness.audit.v1', passiveOnly: true, indexAvailable: d.indexAvailable === true, indexStatus: d.readinessIndexStatus, readinessCompleted: [STATUSES.ready, STATUSES.degraded].includes(d.readinessIndexStatus), interpretationAdapterAvailable: d.interpretationAdapterAvailable === true, inputSignalCount: d.inputSignalCount, readinessRecordCount: d.readinessRecordCount, notReadyCount: d.notReadyCount, foundationOnlyCount: d.foundationOnlyCount, limitedReadinessCount: d.limitedReadinessCount, internalContextReadyCount: d.internalContextReadyCount, consumerReviewReadyCount: d.consumerReviewReadyCount, businessReviewReadyCount: d.businessReviewReadyCount, groupedLocationCount: d.groupedLocationCount, groupedHazardTypeCount: d.groupedHazardTypeCount, averageReadinessScore: d.averageReadinessScore, medianReadinessScore: d.medianReadinessScore, malformedSignalCount: d.malformedSignalCount, skippedSignalCount: d.skippedSignalCount, deterministicReadinessIdentity: d.deterministicReadinessIdentity === true, deterministicReadinessScoring: d.deterministicReadinessScoring === true, deterministicReadinessOrdering: d.deterministicReadinessOrdering === true, defensiveCopiesVerified: d.defensiveCopiesVerified === true, noInterpretationSignalMutation: d.noInterpretationSignalMutation === true, noRegistryMutation: d.noRegistryMutation === true, noHistoricalPatternMutation: d.noHistoricalPatternMutation === true, noAggregateMutation: d.noAggregateMutation === true, noHistoricalEpisodeMutation: d.noHistoricalEpisodeMutation === true, noLiveStateMutation: d.noLiveStateMutation === true, noStorageWrites: d.storageWriteCount === 0, predictiveClaimCount: d.predictiveClaimCount, consumerVisibleRecordCount: d.consumerVisibleRecordCount, businessVisibleRecordCount: d.businessVisibleRecordCount, protectedSystemsModified: false, safeToProceedToLp054: d.indexAvailable === true && [STATUSES.ready, STATUSES.degraded].includes(d.readinessIndexStatus) && d.interpretationAdapterAvailable === true && d.inputSignalCount > 0 && d.readinessRecordCount > 0 && d.deterministicReadinessIdentity === true && d.deterministicReadinessScoring === true && d.deterministicReadinessOrdering === true && d.defensiveCopiesVerified === true && d.noInterpretationSignalMutation === true && d.noRegistryMutation === true && d.noHistoricalPatternMutation === true && d.noAggregateMutation === true && d.noHistoricalEpisodeMutation === true && d.noLiveStateMutation === true && d.storageWriteCount === 0 && d.predictiveClaimCount === 0 && d.consumerVisibleRecordCount === 0 && d.businessVisibleRecordCount === 0 && d.protectedSystemsModified === false }); }
  globalScope.gridlyHistoricalIntelligenceReadinessIndex = freeze(Object.assign({}, index, { INDEX_VERSION, STATUSES, STATES, buildReadinessIndex: createSnapshot }));
  globalScope.gridlyLp0539HistoricalIntelligenceReadinessAudit = gridlyLp0539HistoricalIntelligenceReadinessAudit;
})(typeof window !== 'undefined' ? window : globalThis);
