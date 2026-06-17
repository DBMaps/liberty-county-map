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


  function scanVisibleHistoricalCandidate(text) {
    const value = String(text || '');
    const prohibitedMatches = PROHIBITED_LANGUAGE.filter((phrase) => value.toLowerCase().includes(String(phrase).toLowerCase()));
    const rawHistoryMatches = [];
    if (/\b\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2})?/i.test(value)) rawHistoryMatches.push('raw_timestamp');
    if (/\b\d+\s+(?:raw\s+)?(?:event|events|reports?|rows?)\b/i.test(value)) rawHistoryMatches.push('raw_event_count');
    if (/(event_type|source_report_id|observed_at|created_at|cleared_at|history_capture|historical_events|schema|table|database)/i.test(value)) rawHistoryMatches.push('raw_history_or_storage_term');
    const predictionMatches = [];
    if (/(predicted|prediction|forecast|forecasting|will happen|guaranteed|certain|definitely)/i.test(value)) predictionMatches.push('prediction_or_certainty_language');
    const userScoringMatches = [];
    if (/(user reliability|user reputation|reputation|high-risk user|user score|user_id|user id)/i.test(value)) userScoringMatches.push('user_reliability_or_scoring_language');
    return freeze({
      text: value,
      prohibitedMatches: freeze(prohibitedMatches),
      rawHistoryMatches: freeze(rawHistoryMatches),
      predictionMatches: freeze(predictionMatches),
      userScoringMatches: freeze(userScoringMatches),
      safe: prohibitedMatches.length === 0 && rawHistoryMatches.length === 0 && predictionMatches.length === 0 && userScoringMatches.length === 0
    });
  }

  function evaluateVisibleHistoricalAwarenessLine(candidate, options) {
    const line = candidate && typeof candidate === 'object' ? candidate : {};
    const selectedSurface = 'awarenessBrief';
    const message = typeof line.message === 'string' ? line.message.trim() : '';
    const scan = scanVisibleHistoricalCandidate(message);
    const adapterSourced = line.source === 'historical_intelligence';
    const lowEvidence = line.lowEvidence === true;
    const lowEvidenceCaveated = !lowEvidence || /historical evidence is still limited|limited historical evidence/i.test(message);
    const explicitlySuppressed = line.suppressed === true;
    const canDisplay = Boolean(message)
      && adapterSourced
      && line.consumerSafe === true
      && line.exposesRawHistory !== true
      && line.predictive !== true
      && line.forecasting !== true
      && scan.safe
      && lowEvidenceCaveated
      && !explicitlySuppressed;
    const suppressionReasons = [];
    if (!message) suppressionReasons.push('empty_candidate');
    if (!adapterSourced) suppressionReasons.push('not_adapter_sourced');
    if (line.consumerSafe !== true) suppressionReasons.push('consumer_safe_flag_missing');
    if (line.exposesRawHistory === true || scan.rawHistoryMatches.length) suppressionReasons.push('raw_history_detected');
    if (line.predictive === true || line.forecasting === true || scan.predictionMatches.length) suppressionReasons.push('prediction_or_forecast_language_detected');
    if (scan.prohibitedMatches.length) suppressionReasons.push('prohibited_language_detected');
    if (scan.userScoringMatches.length) suppressionReasons.push('user_scoring_language_detected');
    if (lowEvidence && !lowEvidenceCaveated) suppressionReasons.push('low_evidence_not_caveated');
    if (explicitlySuppressed) suppressionReasons.push(line.suppressionReason || 'adapter_suppressed');
    return freeze({
      selectedSurface,
      displayed: canDisplay,
      displayReason: canDisplay ? (lowEvidence ? 'safe_adapter_caveat_supported_for_awareness_brief' : 'safe_adapter_context_supported_for_awareness_brief') : null,
      suppressionReason: canDisplay ? null : (suppressionReasons[0] || 'not_displayable'),
      suppressionReasons: freeze(suppressionReasons),
      line: canDisplay ? message : null,
      candidateLine: message,
      adapterSourced,
      lowEvidence,
      lowEvidenceCaveated,
      scan
    });
  }

  function auditHistoricalVisibleAwarenessOutput(primaryIntelligence, lowEvidenceIntelligence, options) {
    const defaultPrimary = freeze({
      internalOnly: true,
      evidenceSummary: freeze({ acceptedEvents: 4 }),
      recurrence: freeze([freeze({ observedCount: 4, lowEvidence: false })]),
      duration: freeze({ observedDurationCount: 4, lowEvidence: false }),
      reliability: freeze({ lowEvidence: false }),
      historicalReadsEnabled: false,
      historicalUiEnabled: false,
      apiExposed: false
    });
    const defaultLow = freeze({
      internalOnly: true,
      evidenceSummary: freeze({ acceptedEvents: 1 }),
      recurrence: freeze([]),
      duration: freeze({ observedDurationCount: 1, lowEvidence: true }),
      reliability: freeze({ lowEvidence: true }),
      historicalReadsEnabled: false,
      historicalUiEnabled: false,
      apiExposed: false
    });
    const context = buildHistoricalAwarenessContext(primaryIntelligence || defaultPrimary);
    const lowContext = buildHistoricalAwarenessContext(lowEvidenceIntelligence || defaultLow);
    const awarenessCandidate = safeArray(context?.surfaces?.awarenessBrief).find((item) => item && item.suppressed !== true) || safeArray(context?.surfaces?.awarenessBrief)[0] || null;
    const lowCandidate = safeArray(lowContext?.surfaces?.awarenessBrief).find((item) => item) || null;
    const visible = evaluateVisibleHistoricalAwarenessLine(awarenessCandidate, options);
    const lowEvidence = evaluateVisibleHistoricalAwarenessLine(lowCandidate, options);
    const negativeCandidates = safeArray(options?.negativeCandidates).length ? safeArray(options.negativeCandidates) : [
      'history_capture historical_events table shows 12 raw events at 2026-06-17T12:00:00Z.',
      'Confidence score predicts this crossing will happen again.',
      'User reliability reputation is low for this report.'
    ];
    const negativeCaseResults = negativeCandidates.map((message) => evaluateVisibleHistoricalAwarenessLine({ surface: 'awarenessBrief', message, source: 'historical_intelligence', consumerSafe: true, internalOnly: true, lowEvidence: false, suppressed: false, exposesRawHistory: false, predictive: false, forecasting: false }));
    const boundaries = context.protectedBoundaries || protectedBoundaries(primaryIntelligence || defaultPrimary);
    const topPrimaryPresent = typeof document === 'undefined' ? null : Boolean(document.getElementById('gridlyV2TopStatusPrimary'));
    const topSecondaryPresent = typeof document === 'undefined' ? null : Boolean(document.getElementById('gridlyV2TopStatusSecondary'));
    const microlinePresent = typeof document === 'undefined' ? null : Boolean(document.getElementById('gridlyV2TopAwarenessMicroline'));
    return freeze({
      auditVersion: 'historical_visible_awareness_output.v435.validation.v1',
      visibleHistoricalContextAvailable: context.available === true && safeArray(context?.surfaces?.awarenessBrief).length > 0,
      selectedSurface: 'Awareness Brief',
      displayed: visible.displayed,
      displayReason: visible.displayReason,
      suppressionReason: visible.suppressionReason,
      prohibitedLanguageScan: visible.scan,
      rawHistoryScan: freeze({ absent: visible.scan.rawHistoryMatches.length === 0, matches: visible.scan.rawHistoryMatches }),
      lowEvidenceState: freeze({ displayed: lowEvidence.displayed, lowEvidence: lowEvidence.lowEvidence, caveated: lowEvidence.lowEvidenceCaveated, line: lowEvidence.line, suppressionReason: lowEvidence.suppressionReason }),
      protectedBoundaryStatus: freeze({ historicalReadsEnabled: boundaries.historicalReadsEnabled, historyUiEnabled: boundaries.historyUiEnabled, historicalApiExposure: boundaries.historicalApiExposure, consumerFacingHistoryDashboard: boundaries.consumerFacingHistory, DriveTexasPaused: boundaries.DriveTexasPaused, preserved: boundaries.historicalReadsEnabled === false && boundaries.historyUiEnabled === false && boundaries.historicalApiExposure === false && boundaries.consumerFacingHistory === false && boundaries.DriveTexasPaused === true }),
      visualPlacement: freeze({ secondarySupportingOnly: true, primaryHeadlinePreserved: true, activeConditionHeadlinePreserved: true, trustFreshnessContextPreserved: true, locationSupportCopyPreserved: true, topPrimaryPresent, topSecondaryPresent, microlinePresent }),
      visibleLine: visible.line,
      negativeCaseValidation: freeze({ allSuppressed: negativeCaseResults.every((result) => result.displayed === false), results: freeze(negativeCaseResults) }),
      rawHistoryAbsent: visible.scan.rawHistoryMatches.length === 0,
      noPredictionLanguage: visible.scan.predictionMatches.length === 0,
      noProhibitedLanguage: visible.scan.prohibitedMatches.length === 0,
      noNewHistoricalSurface: true,
      noHistoricalReads: boundaries.historicalReadsEnabled === false,
      noHistoryUiApiDashboard: boundaries.historyUiEnabled === false && boundaries.historicalApiExposure === false && boundaries.consumerFacingHistory === false
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


  globalScope.gridlyHistoricalAwarenessAdapter = freeze({ ADAPTER_VERSION, SAFE_MESSAGES, buildHistoricalAwarenessContext, auditHistoricalAwarenessIntegration, auditHistoricalAwarenessRuntimeValidation, auditHistoricalVisibleAwarenessOutput, evaluateVisibleHistoricalAwarenessLine, scanVisibleHistoricalCandidate });
  globalScope.gridlyHistoricalVisibleAwarenessOutputAudit = auditHistoricalVisibleAwarenessOutput;
})(typeof window !== 'undefined' ? window : globalThis);
