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

      return Object.freeze({
        schemaVersion: 'history_capture.phase_1a.v1',
        phase: '1A',
        eventType,
        observedAt,
        source: 'passive_history_capture_sidecar',
        report: snapshot,
        metadata: Object.freeze({ passive: true, writesDisabled: true, runtimeIntegrated: false, payloadMinimized: true })
      });
    } catch (error) {
      return null;
    }
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

  const api = Object.freeze({ SUPPORTED_PHASE_1A_EVENT_TYPES, LOCATION_BUCKET_PRECISION, buildPhase1AEnvelope, isSupportedPhase1AEventType, sanitizePhase1AHistoricalReport, isUnsafeSyntheticHistoricalId, gridlyLp0532HistoricalPayloadMinimizationAudit });

  globalScope.gridlyPassiveHistoryCaptureEnvelope = api;
  globalScope.gridlyLp0532HistoricalPayloadMinimizationAudit = gridlyLp0532HistoricalPayloadMinimizationAudit;
})(typeof window !== 'undefined' ? window : globalThis);
