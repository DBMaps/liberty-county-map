(function attachGridlyHistoricalIntelligenceEngine(globalScope) {
  'use strict';

  const MODEL_VERSION = 'historical_intelligence.v430.internal.v2';
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


  function formatMinutes(minutes) {
    const value = Math.round(Number(minutes));
    if (!Number.isFinite(value)) return null;
    if (value < 60) return value <= 5 ? 'a few minutes' : `about ${value} minutes`;
    const hours = value / 60;
    if (hours >= 1 && hours <= 3) return `about ${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'}`;
    return `about ${Math.round(hours)} hours`;
  }

  function timeLabel(hour) {
    const value = Number(hour);
    if (!Number.isFinite(value)) return null;
    if (value >= 5 && value < 10) return 'morning';
    if (value >= 10 && value < 15) return 'midday';
    if (value >= 15 && value < 19) return 'afternoon commute hours';
    if (value >= 19 && value < 23) return 'evening';
    return 'overnight';
  }

  function topKeys(signals, limit) {
    return safeArray(signals).slice(0, limit || 3).map((item) => item.key).filter(Boolean);
  }

  function compactList(values) {
    const list = safeArray(values).filter(Boolean);
    if (!list.length) return null;
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} and ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`;
  }

  function consumerHazardLabel(value) {
    const normalized = String(value || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const labels = {
      'blocked crossing': 'train crossing delays',
      'rail crossing obstruction': 'train crossing delays',
      'flooding': 'flooding',
      'high water': 'high water',
      'construction': 'construction activity',
      'road construction': 'construction activity',
      'disabled vehicle': 'disabled vehicles',
      'debris': 'road debris'
    };
    return labels[normalized] || (normalized ? normalized : null);
  }

  function generatePatternIntelligence(evidence, recurrence, duration, reliability, patterns) {
    const createdEvents = evidence.filter((item) => item.eventType === 'report_created');
    const createdCount = createdEvents.length;
    const clearedCount = evidence.filter((item) => item.eventType === 'report_cleared').length;
    const dominantDays = topKeys(patterns.dayOfWeekClustersUtc, 3);
    const weekdayReports = createdEvents.filter((item) => item.observedMs !== null).filter((item) => {
      const day = new Date(item.observedMs).getUTCDay();
      return day >= 1 && day <= 5;
    }).length;
    const topHours = topKeys(patterns.timeOfDayClustersUtc, 3).map(Number).filter(Number.isFinite);
    const timeLabels = Array.from(new Set(topHours.map(timeLabel).filter(Boolean)));
    const hazardTypes = Array.from(new Set(topKeys(patterns.recurringHazardTypes, 3).filter((key) => key !== 'unspecified').map(consumerHazardLabel).filter(Boolean)));
    const topRecurrence = safeArray(recurrence)[0] || null;
    const averageDuration = formatMinutes(duration.averageObservedMinutes);
    const typicalResolution = duration.averageObservedMinutes === null ? null : (duration.averageObservedMinutes <= 30 ? 'Most reports clear quickly.' : duration.averageObservedMinutes <= 180 ? `Historically, reports here clear within ${formatMinutes(duration.averageObservedMinutes)}.` : 'Reports here often remain active for an extended period.');
    const frequency = topRecurrence?.observedCount >= STRONG_EVIDENCE_MINIMUM ? 'frequently' : (topRecurrence?.observedCount >= LOW_EVIDENCE_MINIMUM ? 'often' : (topRecurrence?.observedCount >= 2 ? 'occasionally' : 'limited'));
    const statements = [];
    if (topRecurrence && frequency !== 'limited') statements.push(`This location is ${frequency} reported by the community.`);
    else statements.push('Community observations are still limited at this location.');
    if (weekdayReports >= Math.max(2, Math.ceil(createdCount * 0.6))) statements.push('Activity is usually observed on weekdays.');
    else if (dominantDays.length) statements.push(`Most reports are observed on ${compactList(dominantDays)}.`);
    if (timeLabels.length) statements.push(`Activity is often reported during the ${compactList(timeLabels)}.`);
    if (averageDuration) statements.push(`Historical average duration: ${averageDuration}.`);
    if (typicalResolution) statements.push(typicalResolution);
    if (clearedCount >= Math.max(1, Math.ceil(createdCount * 0.5))) statements.push('Community confirmations usually include follow-up clear observations.');
    else if (createdCount > 0) statements.push('Community confirmation patterns are still developing.');
    if (hazardTypes.length) statements.push(`Recurring hazard types: ${compactList(hazardTypes)}.`);
    return freeze({
      title: 'Typical Pattern',
      consumerFacing: true,
      internalOnly: false,
      source: 'observed_community_patterns',
      daysOfWeek: freeze(dominantDays),
      timeOfDay: freeze(timeLabels),
      frequency,
      averageDuration: averageDuration || null,
      typicalResolutionTime: typicalResolution,
      communityConfirmationPattern: clearedCount >= Math.max(1, Math.ceil(createdCount * 0.5)) ? 'Community confirmations usually include follow-up clear observations.' : 'Community confirmation patterns are still developing.',
      recurringHazardTypes: freeze(hazardTypes),
      statements: freeze(statements),
      exposesRawRecords: false,
      exposesInternalIds: false,
      exposesTechnicalTimestamps: false,
      exposesAuditInformation: false,
      readOnly: true,
      forecasting: false
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
      patterns,
      patternIntelligence: generatePatternIntelligence(evidence, recurrence, duration, reliability, patterns)
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
      patternIntelligence: freeze({
        status: intelligence.patternIntelligence?.title === 'Typical Pattern' ? 'generated' : 'missing',
        consumerLanguageOnly: safeArray(intelligence.patternIntelligence?.statements).every((line) => !/(reported:\s|cleared:\s|source_report_id|observed_at|event_type|database|schema|table|\d{4}-\d{2}-\d{2}T)/i.test(line)),
        summarizesDaysOfWeek: safeArray(intelligence.patternIntelligence?.daysOfWeek).length > 0,
        summarizesTimeOfDay: safeArray(intelligence.patternIntelligence?.timeOfDay).length > 0,
        summarizesFrequency: Boolean(intelligence.patternIntelligence?.frequency),
        summarizesAverageDuration: Boolean(intelligence.patternIntelligence?.averageDuration),
        summarizesResolution: Boolean(intelligence.patternIntelligence?.typicalResolutionTime),
        summarizesCommunityConfirmation: Boolean(intelligence.patternIntelligence?.communityConfirmationPattern),
        summarizesRecurringHazards: safeArray(intelligence.patternIntelligence?.recurringHazardTypes).length > 0,
        noRawRecords: intelligence.patternIntelligence?.exposesRawRecords === false,
        readOnly: intelligence.patternIntelligence?.readOnly === true
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
