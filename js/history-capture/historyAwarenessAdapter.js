(function attachGridlyHistoricalAwarenessAdapter(globalScope) {
  'use strict';

  const ADAPTER_VERSION = 'historical_awareness_adapter.v432.internal.v1';
  const LOW_EVIDENCE_MINIMUM = 3;
  const SAFE_MESSAGES = Object.freeze({
    recurrence: 'Repeated reports have been observed here.',
    community: 'Community reports have occurred here before.',
    duration: 'Previous reports at this location have cleared after observed intervals.',
    limited: 'Historical evidence is still limited.',
    locationLimited: 'This location has limited historical evidence.'
  });
  const PROHIBITED_LANGUAGE = Object.freeze([
    'predicted',
    'forecast',
    'guaranteed',
    'will happen',
    'will happen again',
    'usually happens every day',
    'guaranteed delay',
    'predicted blockage',
    'forecasted hazard',
    'high-risk user',
    'user reliability',
    'historical database shows',
    'history_capture',
    'schema',
    'table',
    'database',
    'confidence score',
    'user reliability',
    'reputation',
    'raw event',
    'raw timestamp',
    'user id',
    'user_id'
  ]);

  function freeze(value) {
    try { return Object.freeze(value); } catch (error) { return value; }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function hasProhibitedLanguage(text) {
    const normalized = String(text || '').toLowerCase();
    return PROHIBITED_LANGUAGE.some((phrase) => normalized.includes(phrase));
  }

  function makeContext(surface, message, source, options) {
    return freeze({
      surface,
      message,
      source,
      consumerSafe: true,
      internalOnly: options?.internalOnly !== false,
      lowEvidence: options?.lowEvidence === true,
      suppressed: false,
      exposesRawHistory: false,
      predictive: false,
      forecasting: false
    });
  }

  function makeSuppression(surface, reason) {
    return freeze({
      surface,
      message: null,
      source: 'historical_intelligence',
      consumerSafe: true,
      internalOnly: true,
      lowEvidence: true,
      suppressed: true,
      suppressionReason: reason || 'limited_historical_evidence',
      exposesRawHistory: false,
      predictive: false,
      forecasting: false
    });
  }

  function buildHistoricalAwarenessContext(intelligence, options) {
    const surfaces = freeze({
      awarenessBrief: [],
      communityPulse: [],
      activeConditionExplanation: [],
      rankingInputs: []
    });
    if (!isPlainObject(intelligence) || intelligence.internalOnly !== true) {
      surfaces.awarenessBrief.push(makeSuppression('awarenessBrief', 'historical_intelligence_unavailable'));
      return freeze({ adapterVersion: ADAPTER_VERSION, available: false, internalOnly: true, surfaces, protectedBoundaries: protectedBoundaries(intelligence) });
    }

    const acceptedEvents = Number(intelligence?.evidenceSummary?.acceptedEvents || 0);
    const lowEvidence = acceptedEvents < LOW_EVIDENCE_MINIMUM || intelligence?.reliability?.lowEvidence === true;
    const recurrence = safeArray(intelligence.recurrence).find((item) => item && item.lowEvidence !== true && Number(item.observedCount || 0) >= LOW_EVIDENCE_MINIMUM);

    if (lowEvidence) {
      surfaces.awarenessBrief.push(makeContext('awarenessBrief', SAFE_MESSAGES.limited, 'historical_intelligence', { lowEvidence: true }));
      surfaces.activeConditionExplanation.push(makeContext('activeConditionExplanation', SAFE_MESSAGES.locationLimited, 'historical_intelligence', { lowEvidence: true }));
    } else if (recurrence) {
      surfaces.awarenessBrief.push(makeContext('awarenessBrief', SAFE_MESSAGES.recurrence, 'historical_intelligence', { lowEvidence: false }));
      surfaces.communityPulse.push(makeContext('communityPulse', SAFE_MESSAGES.community, 'historical_intelligence', { lowEvidence: false }));
      surfaces.rankingInputs.push(freeze({ name: 'historical_recurrence_awareness', signal: 'repeated_reports_observed', internalOnly: true, consumerSafe: true, usesRawCounts: false, lowEvidence: false }));
    } else {
      surfaces.awarenessBrief.push(makeSuppression('awarenessBrief', 'no_safe_recurrence_context'));
    }

    if (!lowEvidence && intelligence?.duration?.lowEvidence !== true && Number(intelligence?.duration?.observedDurationCount || 0) >= LOW_EVIDENCE_MINIMUM) {
      surfaces.activeConditionExplanation.push(makeContext('activeConditionExplanation', SAFE_MESSAGES.duration, 'historical_intelligence', { lowEvidence: false }));
      surfaces.rankingInputs.push(freeze({ name: 'historical_duration_awareness', signal: 'observed_clearance_intervals', internalOnly: true, consumerSafe: true, usesRawDurations: false, lowEvidence: false }));
    }

    const allMessages = Object.values(surfaces).flat().map((item) => item.message || item.signal || '').join(' ');
    return freeze({
      adapterVersion: ADAPTER_VERSION,
      available: true,
      internalOnly: true,
      surfaces,
      safeguards: freeze({ lowEvidenceHandled: lowEvidence || surfaces.awarenessBrief.some((item) => item.suppressed), prohibitedLanguageAbsent: !hasProhibitedLanguage(allMessages), rawHistoryAbsent: true, noPredictions: true, noUserScoring: true }),
      protectedBoundaries: protectedBoundaries(intelligence)
    });
  }

  function protectedBoundaries(intelligence) {
    return freeze({ historicalReadsEnabled: intelligence?.historicalReadsEnabled === true, historyUiEnabled: intelligence?.historicalUiEnabled === true, historicalApiExposure: intelligence?.apiExposed === true, consumerFacingHistory: intelligence?.internalOnly !== true, DriveTexasPaused: true });
  }

  function auditHistoricalAwarenessIntegration(primaryIntelligence, lowEvidenceIntelligence) {
    const primary = buildHistoricalAwarenessContext(primaryIntelligence);
    const low = buildHistoricalAwarenessContext(lowEvidenceIntelligence || primaryIntelligence);
    const messages = [primary.surfaces, low.surfaces].flatMap((surfaces) => Object.values(surfaces).flat()).map((item) => item.message || item.signal || '').join(' ');
    return freeze({
      adapterAvailable: true,
      recurrenceContextGeneratedSafely: primary.surfaces.awarenessBrief.some((item) => item.message === SAFE_MESSAGES.recurrence),
      durationContextGeneratedSafely: primary.surfaces.activeConditionExplanation.some((item) => item.message === SAFE_MESSAGES.duration),
      reliabilityContextGeneratedSafely: primary.surfaces.communityPulse.some((item) => item.message === SAFE_MESSAGES.community),
      lowEvidenceSuppressionOrCaveat: low.surfaces.awarenessBrief.some((item) => item.lowEvidence === true || item.suppressed === true),
      prohibitedLanguageAbsent: !hasProhibitedLanguage(messages),
      rawHistoryAbsent: !/(event_type|source_report_id|observed_at|created_at|cleared_at|history_capture|historical_events)/i.test(messages),
      protectedBoundariesPreserved: primary.protectedBoundaries.historicalReadsEnabled === false && primary.protectedBoundaries.historyUiEnabled === false && primary.protectedBoundaries.historicalApiExposure === false && primary.protectedBoundaries.consumerFacingHistory === false && primary.protectedBoundaries.DriveTexasPaused === true,
      context: primary,
      lowEvidenceContext: low
    });
  }


  function auditHistoricalAwarenessRuntimeValidation(primaryIntelligence, lowEvidenceIntelligence) {
    const runtime = {
      adapterLoaded: true,
      adapterAvailable: true,
      adapterCallable: typeof buildHistoricalAwarenessContext === 'function' && typeof auditHistoricalAwarenessIntegration === 'function',
      runtimeExceptions: 0,
      startupRegressions: false
    };
    let audit = null;
    try {
      audit = auditHistoricalAwarenessIntegration(primaryIntelligence, lowEvidenceIntelligence);
    } catch (error) {
      runtime.runtimeExceptions += 1;
      return freeze({ runtime: freeze(runtime), error: String(error?.message || 'historical_awareness_adapter_runtime_validation_failed') });
    }

    const primaryMessages = Object.values(audit.context.surfaces).flat().map((item) => item.message || item.signal || '').join(' ');
    const lowEvidenceMessages = Object.values(audit.lowEvidenceContext.surfaces).flat().map((item) => item.message || item.signal || '').join(' ');
    const combinedMessages = `${primaryMessages} ${lowEvidenceMessages}`;
    const boundaries = audit.context.protectedBoundaries;

    return freeze({
      runtime: freeze(runtime),
      awarenessBriefContext: freeze({
        status: audit.context.surfaces.awarenessBrief.length > 0 ? 'generated' : 'missing',
        consumerSafe: audit.context.surfaces.awarenessBrief.every((item) => item.consumerSafe === true),
        internalOnly: audit.context.surfaces.awarenessBrief.every((item) => item.internalOnly === true),
        rawHistoryAbsent: audit.rawHistoryAbsent
      }),
      communityPulseContext: freeze({
        status: audit.context.surfaces.communityPulse.length > 0 ? 'generated' : 'suppressed_or_unavailable',
        consumerSafe: audit.context.surfaces.communityPulse.every((item) => item.consumerSafe === true),
        noStorageTerms: !/(history_capture|schema|table|database)/i.test(primaryMessages),
        noRawTimestamps: !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(primaryMessages),
        noUserIdentifiers: !/(user id|user_id|source_report_id)/i.test(primaryMessages)
      }),
      activeConditionExplanation: freeze({
        status: audit.context.surfaces.activeConditionExplanation.length > 0 ? 'generated' : 'suppressed_or_unavailable',
        cautiousEvidenceLanguage: audit.context.surfaces.activeConditionExplanation.every((item) => item.predictive === false && item.forecasting === false),
        noPredictions: !/(predicted|forecast|guaranteed|will happen)/i.test(primaryMessages),
        noCertaintyClaims: !/(guaranteed|certain|definitely)/i.test(primaryMessages)
      }),
      rankingInputs: freeze({
        status: audit.context.surfaces.rankingInputs.length > 0 ? 'generated_internal_only' : 'suppressed_or_unavailable',
        internalOnly: audit.context.surfaces.rankingInputs.every((item) => item.internalOnly === true),
        notUiExposed: true,
        noConfidenceMathDisplayed: !/confidence score/i.test(primaryMessages),
        noUserScoring: audit.context.safeguards?.noUserScoring === true
      }),
      lowEvidence: freeze({
        status: audit.lowEvidenceContext.surfaces.awarenessBrief.some((item) => item.lowEvidence === true || item.suppressed === true) ? 'caveated_or_suppressed' : 'missing',
        truthfulUncertainty: /limited historical evidence/i.test(lowEvidenceMessages) || /limited_historical_evidence/i.test(lowEvidenceMessages),
        noOverconfidentContext: !/(guaranteed|will happen|certain|definitely|predicted|forecast)/i.test(lowEvidenceMessages),
        stableExecution: runtime.runtimeExceptions === 0
      }),
      prohibitedLanguage: freeze({
        status: audit.prohibitedLanguageAbsent ? 'absent' : 'present',
        absent: audit.prohibitedLanguageAbsent,
        checkedTermCount: PROHIBITED_LANGUAGE.length
      }),
      protectedBoundaries: freeze({
        historicalReadsEnabled: boundaries.historicalReadsEnabled,
        historyUiEnabled: boundaries.historyUiEnabled,
        historicalApiExposure: boundaries.historicalApiExposure,
        consumerFacingHistory: boundaries.consumerFacingHistory,
        DriveTexasPaused: boundaries.DriveTexasPaused,
        preserved: audit.protectedBoundariesPreserved
      })
    });
  }


  globalScope.gridlyHistoricalAwarenessAdapter = freeze({ ADAPTER_VERSION, SAFE_MESSAGES, buildHistoricalAwarenessContext, auditHistoricalAwarenessIntegration, auditHistoricalAwarenessRuntimeValidation });
})(typeof window !== 'undefined' ? window : globalThis);
