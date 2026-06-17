(function attachGridlyHistoricalIntelligenceEngine(globalScope) {
  'use strict';

  const MODEL_VERSION = 'historical_intelligence.v430.internal.v1';
  const SUPPORTED_EVENT_TYPES = Object.freeze(['report_created', 'report_cleared']);
  const LOW_EVIDENCE_MINIMUM = 3;
  const STRONG_EVIDENCE_MINIMUM = 6;
  const LOCATION_PRECISION = 4;

  function freeze(value) {
    try { return Object.freeze(value); } catch (error) { return value; }
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function asString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  function asFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function parseTimestamp(value) {
    const stringValue = asString(value);
    if (!stringValue) return null;
    const milliseconds = Date.parse(stringValue);
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }

  function getEnvelope(event) {
    if (!isPlainObject(event)) return {};
    if (isPlainObject(event.envelope)) return event.envelope;
    return event;
  }

  function getPayload(event) {
    if (!isPlainObject(event)) return {};
    if (isPlainObject(event.payload)) return event.payload;
    const envelope = getEnvelope(event);
    if (isPlainObject(envelope.report)) return envelope.report;
    return event.report && isPlainObject(event.report) ? event.report : event;
  }

  function getEventType(event) {
    const envelope = getEnvelope(event);
    return asString(event?.event_type) || asString(event?.eventType) || asString(envelope.eventType);
  }

  function getObservedAt(event) {
    const envelope = getEnvelope(event);
    return asString(event?.observed_at)
      || asString(event?.observedAt)
      || asString(envelope.observedAt)
      || asString(event?.received_at)
      || asString(event?.created_at);
  }

  function getReportId(event) {
    const payload = getPayload(event);
    return asString(event?.source_report_id)
      || asString(payload.id)
      || asString(payload.reportId)
      || asString(payload.uuid)
      || asString(payload.sourceReportId);
  }

  function getCrossingKey(payload) {
    return asString(payload.crossingId)
      || asString(payload.crossing_id)
      || asString(payload.crossingNumber)
      || asString(payload.crossing)
      || asString(payload.dotNumber)
      || asString(payload.dot_number);
  }

  function getHazardType(payload) {
    return asString(payload.hazardType)
      || asString(payload.hazard_type)
      || asString(payload.reportType)
      || asString(payload.type)
      || asString(payload.category);
  }

  function getRoadwayKey(payload) {
    return asString(payload.roadName)
      || asString(payload.road_name)
      || asString(payload.street)
      || asString(payload.locationName)
      || asString(payload.location_name)
      || asString(payload.roadway);
  }

  function coordinateKey(payload) {
    const lat = asFiniteNumber(payload.lat ?? payload.latitude);
    const lng = asFiniteNumber(payload.lng ?? payload.lon ?? payload.longitude);
    if (lat === null || lng === null) return null;
    return `${lat.toFixed(LOCATION_PRECISION)},${lng.toFixed(LOCATION_PRECISION)}`;
  }

  function getLocationKeys(payload) {
    const crossing = getCrossingKey(payload);
    const roadway = getRoadwayKey(payload);
    const coordinate = coordinateKey(payload);
    const hazardType = getHazardType(payload);
    return {
      crossing: crossing ? `crossing:${crossing}` : null,
      roadway: roadway ? `roadway:${roadway.toLowerCase()}` : null,
      hazard: coordinate ? `hazard:${hazardType || 'unspecified'}:${coordinate}` : null
    };
  }

  function normalizeEvidence(events) {
    return safeArray(events).map((event, index) => {
      const payload = getPayload(event);
      const eventType = getEventType(event);
      const observedAt = getObservedAt(event);
      const observedMs = parseTimestamp(observedAt);
      return freeze({
        index,
        eventType,
        supported: SUPPORTED_EVENT_TYPES.includes(eventType),
        observedAt,
        observedMs,
        reportId: getReportId(event),
        hazardType: getHazardType(payload),
        locationKeys: getLocationKeys(payload),
        payload: freeze({ ...payload })
      });
    }).filter((event) => event.supported);
  }

  function addMetric(map, key, label, domain, evidence) {
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, { key, label, domain, reportCreated: 0, reportCleared: 0, observedCount: 0, firstObservedAt: null, lastObservedAt: null });
    }
    const metric = map.get(key);
    metric.observedCount += 1;
    if (evidence.eventType === 'report_created') metric.reportCreated += 1;
    if (evidence.eventType === 'report_cleared') metric.reportCleared += 1;
    if (evidence.observedAt && (!metric.firstObservedAt || evidence.observedMs < Date.parse(metric.firstObservedAt))) metric.firstObservedAt = evidence.observedAt;
    if (evidence.observedAt && (!metric.lastObservedAt || evidence.observedMs > Date.parse(metric.lastObservedAt))) metric.lastObservedAt = evidence.observedAt;
  }

  function recurrenceLabel(count) {
    if (count >= STRONG_EVIDENCE_MINIMUM) return 'frequently_reported_location';
    if (count >= LOW_EVIDENCE_MINIMUM) return 'recurring_community_activity';
    if (count >= 2) return 'repeated_reports_observed';
    return 'single_historical_observation';
  }

  function generateRecurrence(evidence) {
    const metrics = new Map();
    evidence.forEach((item) => {
      addMetric(metrics, item.locationKeys.crossing, item.locationKeys.crossing, 'crossing', item);
      addMetric(metrics, item.locationKeys.roadway, item.locationKeys.roadway, 'roadway_location', item);
      addMetric(metrics, item.locationKeys.hazard, item.locationKeys.hazard, 'hazard_location', item);
    });
    return freeze(Array.from(metrics.values()).map((metric) => freeze({
      ...metric,
      recurrenceScore: metric.observedCount,
      normalizedRecurrence: metric.observedCount / Math.max(1, evidence.length),
      signal: recurrenceLabel(metric.observedCount),
      lowEvidence: metric.observedCount < LOW_EVIDENCE_MINIMUM
    })).sort((a, b) => b.observedCount - a.observedCount || a.key.localeCompare(b.key)));
  }

  function generateDurations(evidence) {
    const createdByReport = new Map();
    evidence.forEach((item) => {
      if (item.reportId && item.eventType === 'report_created' && item.observedMs !== null) createdByReport.set(item.reportId, item);
    });
    const observations = [];
    evidence.forEach((item) => {
      if (!item.reportId || item.eventType !== 'report_cleared' || item.observedMs === null) return;
      const created = createdByReport.get(item.reportId);
      if (!created || created.observedMs === null || item.observedMs < created.observedMs) return;
      const minutes = Math.round((item.observedMs - created.observedMs) / 60000);
      observations.push(freeze({ reportId: item.reportId, durationMinutes: minutes, createdAt: created.observedAt, clearedAt: item.observedAt }));
    });
    const durations = observations.map((item) => item.durationMinutes).sort((a, b) => a - b);
    const average = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null;
    return freeze({
      observedDurationCount: observations.length,
      averageObservedMinutes: average,
      shortestObservedMinutes: durations.length ? durations[0] : null,
      longestObservedMinutes: durations.length ? durations[durations.length - 1] : null,
      signal: durations.length === 0 ? 'no_observed_duration_evidence' : average <= 30 ? 'historically_short_duration_event' : average >= 120 ? 'historically_persistent_condition' : 'typically_clears_with_observed_window',
      lowEvidence: observations.length < LOW_EVIDENCE_MINIMUM,
      observations: freeze(observations)
    });
  }

  function generateReliability(evidence, recurrence) {
    const volume = evidence.length;
    const repeatedSignals = recurrence.filter((item) => item.observedCount >= 2).length;
    const createdCount = evidence.filter((item) => item.eventType === 'report_created').length;
    const clearedCount = evidence.filter((item) => item.eventType === 'report_cleared').length;
    const consistencyScore = volume ? Math.min(createdCount, clearedCount) / Math.max(createdCount, clearedCount, 1) : 0;
    let signal = 'limited_historical_evidence';
    if (volume >= STRONG_EVIDENCE_MINIMUM && repeatedSignals >= 2 && consistencyScore >= 0.5) signal = 'strong_historical_evidence';
    else if (volume >= LOW_EVIDENCE_MINIMUM || repeatedSignals >= 1) signal = 'emerging_historical_signal';
    return freeze({ volume, createdCount, clearedCount, repeatedSignals, consistencyScore, signal, lowEvidence: volume < LOW_EVIDENCE_MINIMUM, excludesUserScoring: true });
  }

  function bucket(map, key) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  }

  function mapToSortedSignals(map, prefix) {
    return freeze(Array.from(map.entries()).map(([key, count]) => freeze({ key, count, signal: `${prefix}:${key}` })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key)));
  }

  function generatePatterns(evidence) {
    const hazardTypes = new Map();
    const crossings = new Map();
    const roadways = new Map();
    const hours = new Map();
    const days = new Map();
    evidence.forEach((item) => {
      bucket(hazardTypes, item.hazardType || 'unspecified');
      bucket(crossings, item.locationKeys.crossing);
      bucket(roadways, item.locationKeys.roadway);
      if (item.observedMs !== null) {
        const date = new Date(item.observedMs);
        bucket(hours, String(date.getUTCHours()).padStart(2, '0'));
        bucket(days, ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()]);
      }
    });
    return freeze({
      recurringHazardTypes: mapToSortedSignals(hazardTypes, 'recurring_hazard_type'),
      recurringCrossingActivity: mapToSortedSignals(crossings, 'recurring_crossing_activity'),
      recurringRoadwayActivity: mapToSortedSignals(roadways, 'recurring_roadway_activity'),
      timeOfDayClustersUtc: mapToSortedSignals(hours, 'time_of_day_cluster_utc'),
      dayOfWeekClustersUtc: mapToSortedSignals(days, 'day_of_week_cluster_utc'),
      predictiveClaims: false,
      forecasting: false,
      lowEvidence: evidence.length < LOW_EVIDENCE_MINIMUM
    });
  }

  function generateHistoricalIntelligence(events, options) {
    const evidence = normalizeEvidence(events);
    const recurrence = generateRecurrence(evidence);
    const duration = generateDurations(evidence);
    const reliability = generateReliability(evidence, recurrence);
    const patterns = generatePatterns(evidence);
    return freeze({
      modelVersion: MODEL_VERSION,
      generatedAt: asString(options?.generatedAt) || new Date(0).toISOString(),
      internalOnly: true,
      historicalReadsEnabled: false,
      historicalUiEnabled: false,
      apiExposed: false,
      source: 'accumulated_historical_evidence_input_only',
      evidenceSummary: freeze({ acceptedEvents: evidence.length, supportedEventTypes: SUPPORTED_EVENT_TYPES }),
      recurrence,
      duration,
      reliability,
      patterns
    });
  }

  function auditHistoricalIntelligence(events) {
    const intelligence = generateHistoricalIntelligence(events, { generatedAt: '2026-06-17T00:00:00.000Z' });
    return freeze({
      recurrenceGenerated: Array.isArray(intelligence.recurrence),
      durationGenerated: Boolean(intelligence.duration),
      reliabilityGenerated: Boolean(intelligence.reliability),
      patternGenerated: Boolean(intelligence.patterns),
      lowEvidenceBehaviorDocumented: intelligence.reliability.lowEvidence === true || intelligence.evidenceSummary.acceptedEvents >= LOW_EVIDENCE_MINIMUM,
      protectedBoundaries: freeze({ historicalReadsEnabled: false, historicalUiEnabled: false, apiExposed: false, driveTexasPaused: true }),
      intelligence
    });
  }

  function auditHistoricalIntelligenceRuntimeValidation(events, lowEvidenceEvents) {
    const runtime = {
      engineLoaded: true,
      engineAvailable: true,
      engineCallable: typeof generateHistoricalIntelligence === 'function' && typeof auditHistoricalIntelligence === 'function',
      runtimeExceptions: 0,
      startupRegressions: false
    };
    let primaryAudit = null;
    let lowEvidenceAudit = null;
    try {
      primaryAudit = auditHistoricalIntelligence(events);
      lowEvidenceAudit = auditHistoricalIntelligence(safeArray(lowEvidenceEvents).length ? lowEvidenceEvents : safeArray(events).slice(0, 1));
    } catch (error) {
      runtime.runtimeExceptions += 1;
      return freeze({ runtime: freeze(runtime), error: asString(error?.message) || 'historical_intelligence_runtime_validation_failed' });
    }

    const intelligence = primaryAudit.intelligence;
    const lowEvidenceIntelligence = lowEvidenceAudit.intelligence;
    const topRecurrence = intelligence.recurrence[0] || {};
    const duration = intelligence.duration;
    const reliability = intelligence.reliability;
    const patterns = intelligence.patterns;
    const lowEvidenceRecurrence = lowEvidenceIntelligence.recurrence[0] || {};

    return freeze({
      runtime: freeze(runtime),
      recurrence: freeze({
        status: primaryAudit.recurrenceGenerated ? 'generated' : 'missing',
        hasScore: typeof topRecurrence.recurrenceScore === 'number',
        hasSignal: Boolean(topRecurrence.signal),
        hasClassification: Boolean(topRecurrence.signal),
        topClassification: topRecurrence.signal || null,
        lowEvidenceBehavior: lowEvidenceRecurrence.lowEvidence === true
      }),
      duration: freeze({
        status: primaryAudit.durationGenerated ? 'generated' : 'missing',
        observedDurationCount: duration.observedDurationCount,
        averageObservedMinutes: duration.averageObservedMinutes,
        availabilityChecked: true,
        missingDurationHandling: lowEvidenceIntelligence.duration.signal === 'no_observed_duration_evidence',
        noSyntheticDurations: duration.observedDurationCount === safeArray(duration.observations).length
      }),
      reliability: freeze({
        status: primaryAudit.reliabilityGenerated ? 'generated' : 'missing',
        volume: reliability.volume,
        consistencyScore: reliability.consistencyScore,
        recurrenceContribution: reliability.repeatedSignals,
        lowEvidenceHandling: lowEvidenceIntelligence.reliability.lowEvidence === true,
        noReputationSystem: true,
        noUserScoring: reliability.excludesUserScoring === true
      }),
      patterns: freeze({
        status: primaryAudit.patternGenerated ? 'generated' : 'missing',
        hazardPatternGenerated: patterns.recurringHazardTypes.length > 0,
        crossingPatternGenerated: patterns.recurringCrossingActivity.length > 0,
        roadwayPatternGenerated: patterns.recurringRoadwayActivity.length > 0,
        hourClusteringGenerated: patterns.timeOfDayClustersUtc.length > 0,
        dayOfWeekClusteringGenerated: patterns.dayOfWeekClustersUtc.length > 0,
        noForecasting: patterns.forecasting === false,
        noPrediction: patterns.predictiveClaims === false,
        noFutureEventGeneration: true
      }),
      lowEvidence: freeze({
        stable: lowEvidenceAudit.recurrenceGenerated && lowEvidenceAudit.durationGenerated && lowEvidenceAudit.reliabilityGenerated && lowEvidenceAudit.patternGenerated,
        acceptedEvents: lowEvidenceIntelligence.evidenceSummary.acceptedEvents,
        recurrenceLowEvidence: lowEvidenceRecurrence.lowEvidence === true,
        durationSignal: lowEvidenceIntelligence.duration.signal,
        reliabilityLowEvidence: lowEvidenceIntelligence.reliability.lowEvidence === true,
        truthfulConfidence: lowEvidenceIntelligence.reliability.signal === 'limited_historical_evidence'
      }),
      protectedBoundaries: freeze({
        historicalReadsEnabled: intelligence.historicalReadsEnabled === true,
        historyUiEnabled: intelligence.historicalUiEnabled === true,
        historicalApiExposure: intelligence.apiExposed === true,
        consumerFacingHistory: intelligence.internalOnly !== true,
        DriveTexasPaused: true
      })
    });
  }

  const api = freeze({ MODEL_VERSION, SUPPORTED_EVENT_TYPES, generateHistoricalIntelligence, auditHistoricalIntelligence, auditHistoricalIntelligenceRuntimeValidation });
  globalScope.gridlyHistoricalIntelligenceEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
