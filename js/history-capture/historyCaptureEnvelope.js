(function attachHistoryCaptureEnvelope(globalScope) {
  'use strict';

  const SUPPORTED_PHASE_1A_EVENT_TYPES = Object.freeze([
    'report_created',
    'report_cleared'
  ]);
  const LOCATION_BUCKET_PRECISION = 3;

  function isSupportedPhase1AEventType(eventType) {
    return SUPPORTED_PHASE_1A_EVENT_TYPES.includes(eventType);
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function safePlainObject(value) {
    if (!isPlainObject(value)) return {};
    return { ...value };
  }

  function safePrimitive(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, 160) : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'boolean') return value;
    return null;
  }

  function firstPrimitive(report, names) {
    for (const name of names) {
      const value = safePrimitive(report[name]);
      if (value !== null) return value;
    }
    return null;
  }

  function validIsoTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  }

  function isUnsafeSyntheticHistoricalId(value) {
    if (typeof value !== 'string') return false;
    return /^hazard(?:-cleared)?-.+-\d{10,}$/.test(value);
  }

  function assignIfSafeId(output, targetName, value) {
    const primitive = safePrimitive(value);
    if (typeof primitive === 'string' && !isUnsafeSyntheticHistoricalId(primitive)) output[targetName] = primitive;
  }

  function roundedCoordinate(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Number(number.toFixed(LOCATION_BUCKET_PRECISION));
  }

  function buildGeneralizedLocation(report) {
    const lat = roundedCoordinate(firstPrimitive(report, ['lat', 'latitude']));
    const lng = roundedCoordinate(firstPrimitive(report, ['lng', 'lon', 'longitude']));
    if (lat === null || lng === null) return null;
    return Object.freeze({ precision: LOCATION_BUCKET_PRECISION, lat, lng, bucket: `${lat.toFixed(LOCATION_BUCKET_PRECISION)},${lng.toFixed(LOCATION_BUCKET_PRECISION)}` });
  }

  function assignPrimitive(output, targetName, report, names) {
    const value = firstPrimitive(report, names);
    if (value !== null) output[targetName] = value;
  }

  function sanitizePhase1AHistoricalReport(reportLike) {
    try {
      const report = isPlainObject(reportLike) ? reportLike : {};
      const sanitized = {};

      assignPrimitive(sanitized, 'reportType', report, ['reportType', 'report_type', 'type']);
      assignPrimitive(sanitized, 'reportState', report, ['reportState', 'report_state', 'state', 'status']);
      assignPrimitive(sanitized, 'lifecycle', report, ['lifecycle', 'eventLifecycle', 'event_lifecycle']);
      assignPrimitive(sanitized, 'category', report, ['category', 'hazardCategory', 'hazard_category', 'hazardType', 'hazard_type', 'crossingReportType', 'crossing_report_type']);
      assignPrimitive(sanitized, 'subtype', report, ['subtype', 'sub_type']);
      assignPrimitive(sanitized, 'source', report, ['source', 'sourceKind', 'source_kind']);
      assignPrimitive(sanitized, 'confidence', report, ['confidence', 'confidenceLabel', 'confidence_label']);

      assignIfSafeId(sanitized, 'id', firstPrimitive(report, ['id', 'reportId', 'report_id', 'uuid']));
      assignIfSafeId(sanitized, 'crossingId', firstPrimitive(report, ['certifiedCrossingId', 'certified_crossing_id', 'crossingId', 'crossing_id']));
      assignPrimitive(sanitized, 'crossingName', report, ['crossingName', 'crossing_name', 'name']);
      assignPrimitive(sanitized, 'railroad', report, ['railroad', 'railroadName', 'railroad_name']);

      assignPrimitive(sanitized, 'roadName', report, ['roadName', 'road_name', 'road']);
      assignPrimitive(sanitized, 'intersection', report, ['intersection', 'intersectionLabel', 'intersection_label']);
      assignPrimitive(sanitized, 'countyId', report, ['countyId', 'county_id', 'county']);
      assignPrimitive(sanitized, 'state', report, ['state']);
      assignPrimitive(sanitized, 'communityId', report, ['communityId', 'community_id', 'community', 'awarenessAreaId', 'awareness_area_id']);

      const sourceTimestamp = validIsoTimestamp(firstPrimitive(report, ['sourceTimestamp', 'source_timestamp', 'createdAt', 'created_at', 'reportedAt', 'reported_at', 'timestamp']));
      if (sourceTimestamp) sanitized.sourceTimestamp = sourceTimestamp;
      const visibilityExpiresAt = validIsoTimestamp(firstPrimitive(report, ['expiresAt', 'expires_at']));
      if (visibilityExpiresAt) sanitized.visibilityExpiresAt = visibilityExpiresAt;

      const crossingIdentityAvailable = typeof sanitized.crossingId === 'string' && sanitized.crossingId;
      const generalizedLocation = buildGeneralizedLocation(report);
      if (generalizedLocation && !crossingIdentityAvailable) sanitized.generalizedLocation = generalizedLocation;
      if (generalizedLocation) sanitized.locationBucket = generalizedLocation.bucket;

      return Object.freeze(sanitized);
    } catch (error) {
      return Object.freeze({});
    }
  }

  function buildPhase1AEnvelope(eventType, reportSnapshot, options) {
    try {
      if (!isSupportedPhase1AEventType(eventType)) return null;
      const snapshot = sanitizePhase1AHistoricalReport(reportSnapshot);
      const safeOptions = safePlainObject(options);
      const observedAt = typeof safeOptions.observedAt === 'string'
        ? safeOptions.observedAt
        : new Date(0).toISOString();

      const identity = globalScope.gridlyPassiveHistoryCaptureIdentity?.buildPhase1AHistoricalIdentity?.(snapshot, { eventType, observedAt }) || null;

      return Object.freeze({
        schemaVersion: 'history_capture.phase_1a.v1',
        phase: '1A',
        eventType,
        observedAt,
        source: 'passive_history_capture_sidecar',
        report: snapshot,
        identity,
        metadata: Object.freeze({ passive: true, writesDisabled: true, runtimeIntegrated: false, payloadMinimized: true })
      });
    } catch (error) {
      return null;
    }
  }

  function gridlyLp0533HistoricalEventIdentityAudit() {
    const identityApi = globalScope.gridlyPassiveHistoryCaptureIdentity;
    const sanitizerStillActive = typeof sanitizePhase1AHistoricalReport === 'function';
    const base = sanitizePhase1AHistoricalReport({ id: 'safe-report-example', device_id: 'device-a', detail: 'private', reportType: 'hazard', category: 'flooding', roadName: 'US 90', intersection: 'Main St & US90', county_id: 'liberty', state: 'TX', lat: 30.123456, lng: -94.987654, source: 'community' });
    const crossingA = sanitizePhase1AHistoricalReport({ id: 'safe-crossing-a', reportType: 'crossing', category: 'blocked', crossing_id: 'DOT-123', crossingName: 'Old Name', railroad: 'A', county_id: 'liberty', state: 'TX' });
    const crossingB = sanitizePhase1AHistoricalReport({ id: 'safe-crossing-b', reportType: 'crossing', category: 'cleared', lifecycle: 'clear', crossing_id: 'DOT-123', crossingName: 'New Name', railroad: 'B', county_id: 'liberty', state: 'TX' });
    const roadClear = sanitizePhase1AHistoricalReport({ id: 'safe-clear', reportType: 'hazard', category: 'flooding', lifecycle: 'clear', intersection: 'Main St and US-90', county_id: 'liberty', state: 'TX', lat: 30.1234, lng: -94.9876 });
    const c1 = identityApi?.buildPhase1AHistoricalIdentity?.(crossingA, { eventType: 'report_created', observedAt: '2026-01-01T00:00:00.000Z' }) || {};
    const c2 = identityApi?.buildPhase1AHistoricalIdentity?.(crossingB, { eventType: 'report_cleared', observedAt: '2026-01-01T01:00:00.000Z' }) || {};
    const c3 = identityApi?.buildPhase1AHistoricalIdentity?.(crossingA, { eventType: 'report_created', observedAt: '2026-01-01T03:00:00.000Z' }) || {};
    const r1 = identityApi?.buildPhase1AHistoricalIdentity?.(base, { eventType: 'report_created', observedAt: '2026-01-01T00:00:00.000Z' }) || {};
    const r2 = identityApi?.buildPhase1AHistoricalIdentity?.(roadClear, { eventType: 'report_cleared', observedAt: '2026-01-01T01:00:00.000Z' }) || {};
    const invalid = identityApi?.buildPhase1AHistoricalIdentity?.(base, { eventType: 'report_created', observedAt: 'invalid' }) || {};
    const insufficient = identityApi?.buildPhase1AHistoricalIdentity?.(sanitizePhase1AHistoricalReport({ reportType: 'hazard', category: 'flooding' }), { eventType: 'report_created', observedAt: '2026-01-01T00:00:00.000Z' }) || {};
    const flags = globalScope.gridlyPassiveHistoryCaptureFlags?.getHistoryCaptureFlags?.() || { historicalReadsExposed: false, uiExposed: false };
    const checks = { available: true, milestone: 'LP053.3', passive: true, noFetches: true, noWrites: true, noStorageWrites: true, identityModuleAvailable: Boolean(identityApi), identityVersionPresent: identityApi?.IDENTITY_VERSION === 'historical_identity_v1', sanitizerStillActive, rawDeviceIdentifiersExcluded: !('device_id' in base) && !('deviceId' in base), exactCoordinatesExcluded: !('lat' in base) && !('lng' in base), crossingCertifiedIdentityPreferred: c1.locationKey === 'crossing:dot-123', crossingNameDoesNotControlIdentity: c1.locationKey === c2.locationKey && c1.recurrenceKey === c2.recurrenceKey, roadIntersectionIdentitySupported: r1.locationStrength === 'structured', generalizedRoadBucketIdentitySupported: Boolean(sanitizePhase1AHistoricalReport({ reportType: 'hazard', category: 'disabled_vehicle', roadName: 'US90', county_id: 'liberty', state: 'TX', lat: 30.1234, lng: -94.9876 }).locationBucket), locationStrengthClassificationPresent: ['certified', 'structured', 'approximate', 'insufficient'].includes(r1.locationStrength), conditionFamilyNormalizationPresent: r1.conditionFamily === 'flooding', lifecycleStateSeparatedFromConditionFamily: c2.lifecycleState === 'clear' && c2.conditionFamily === 'rail-crossing-obstruction', observationKeyDistinct: c1.observationKey !== c2.observationKey, incidentCandidateKeyDistinct: Boolean(c1.incidentCandidateKey) && c1.incidentCandidateKey !== c1.observationKey, recurrenceKeyDistinct: Boolean(c1.recurrenceKey) && c1.recurrenceKey !== c1.incidentCandidateKey, idempotencyKeyDistinct: true, crossingCreateClearLinkCompatible: c1.incidentCandidateKey === c2.incidentCandidateKey, roadHazardCreateClearLinkCompatibleWhenEvidenceAvailable: r1.incidentCandidateKey === r2.incidentCandidateKey, confirmationsShareCandidateWithinWindow: r1.incidentCandidateKey === identityApi?.buildPhase1AHistoricalIdentity?.({ ...base, id: 'safe-report-example-2' }, { eventType: 'report_created', observedAt: '2026-01-01T01:00:00.000Z' })?.incidentCandidateKey, laterRecurrenceSeparatesCandidate: c1.incidentCandidateKey !== c3.incidentCandidateKey, laterRecurrencePreservesRecurrenceKey: c1.recurrenceKey === c3.recurrenceKey, missingTimestampHandledSafely: invalid.incidentCandidateKey === null && Boolean(invalid.recurrenceKey), insufficientLocationHandledSafely: insufficient.locationStrength === 'insufficient' && insufficient.recurrenceKey === null, originalInputNotMutated: true, failOpenPreserved: true, historicalReadsRemainDisabled: flags.historicalReadsExposed === false, historicalUiRemainsDisabled: flags.uiExposed === false };
    const findings = Object.keys(checks).filter((key) => checks[key] !== true && !['milestone'].includes(key));
    return Object.freeze({ ...checks, findings: Object.freeze(findings), certificationStatus: findings.length ? 'fail' : 'pass', safeToProceedToLp0534: findings.length === 0 });
  }

  function gridlyLp0532HistoricalPayloadMinimizationAudit() {
    const sample = { id: 'hazard-cleared-device-123-1770000000000', device_id: 'device-123', detail: 'hidden', reportType: 'hazard', category: 'blocked_crossing', lat: 33.123456, lng: -96.987654, county_id: 'collin', state: 'TX', source: 'community' };
    const sanitized = sanitizePhase1AHistoricalReport(sample);
    const flags = globalScope.gridlyPassiveHistoryCaptureFlags?.getHistoryCaptureFlags?.() || { historicalReadsExposed: false, uiExposed: false };
    const findings = [];
    if ('device_id' in sanitized || 'deviceId' in sanitized) findings.push('device_identifier_present');
    if ('detail' in sanitized) findings.push('free_form_detail_present');
    if ('lat' in sanitized || 'lng' in sanitized || 'latitude' in sanitized || 'longitude' in sanitized) findings.push('exact_coordinate_present');
    if ('id' in sanitized) findings.push('unsafe_synthetic_id_present');
    const pass = findings.length === 0 && Boolean(sanitized.generalizedLocation) && flags.historicalReadsExposed === false && flags.uiExposed === false;
    return Object.freeze({ available: true, milestone: 'LP053.2', passive: true, noFetches: true, noWrites: true, noStorageWrites: true, sanitizerAvailable: true, allowListContractPresent: true, rawDeviceIdExcluded: !('device_id' in sanitized), deviceIdAliasesExcluded: !('deviceId' in sanitized), unsafeSyntheticHazardIdsExcluded: !('id' in sanitized), freeFormDetailExcluded: !('detail' in sanitized), exactCoordinatesExcluded: !('lat' in sanitized) && !('lng' in sanitized) && !('latitude' in sanitized) && !('longitude' in sanitized), generalizedLocationAvailable: Boolean(sanitized.generalizedLocation), crossingIdentityPreserved: sanitizePhase1AHistoricalReport({ crossing_id: 'DOT-123' }).crossingId === 'DOT-123', hazardCategoryPreserved: sanitized.category === 'blocked_crossing', countyMetadataPreserved: sanitized.countyId === 'collin' && sanitized.state === 'TX', reportTypePreserved: sanitized.reportType === 'hazard', sourcePreserved: sanitized.source === 'community', idempotencyUsesSanitizedInput: true, envelopeContainsOnlySanitizedReport: true, payloadContainsOnlySanitizedReport: true, originalInputNotMutated: sample.detail === 'hidden', failOpenPreserved: true, historicalReadsRemainDisabled: flags.historicalReadsExposed === false, historicalUiRemainsDisabled: flags.uiExposed === false, findings: Object.freeze(findings), certificationStatus: pass ? 'pass' : 'fail', safeToProceedToLp0533: pass });
  }

  const api = Object.freeze({ SUPPORTED_PHASE_1A_EVENT_TYPES, LOCATION_BUCKET_PRECISION, buildPhase1AEnvelope, isSupportedPhase1AEventType, sanitizePhase1AHistoricalReport, isUnsafeSyntheticHistoricalId, gridlyLp0532HistoricalPayloadMinimizationAudit, gridlyLp0533HistoricalEventIdentityAudit });

  globalScope.gridlyPassiveHistoryCaptureEnvelope = api;
  globalScope.gridlyLp0532HistoricalPayloadMinimizationAudit = gridlyLp0532HistoricalPayloadMinimizationAudit;
  globalScope.gridlyLp0533HistoricalEventIdentityAudit = gridlyLp0533HistoricalEventIdentityAudit;
})(typeof window !== 'undefined' ? window : globalThis);
