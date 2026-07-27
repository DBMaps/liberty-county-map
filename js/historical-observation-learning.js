(function attachHistoricalObservationLearning(globalScope) {
  "use strict";

  const VERSION = "LP076.historical-observation-learning.v1";
  const ARCHIVE_VERSION = 1;
  const ACTIVATION = Object.freeze({ productionIntegration: false, consumerVisible: false, activationAuthorized: false, explicitOptInRequired: true });
  const SUPPORTED_TYPES = Object.freeze(["blocked_crossing", "rail_delay", "flooding", "road_hazard", "congestion", "traffic", "community_activity"]);
  const AGING = Object.freeze({ recent: 30, established: 180, aging: 365 });
  const DAYS = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const clean = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const first = (...values) => values.map(clean).find(Boolean) || null;
  const slug = (value) => clean(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || null;
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  function fieldsOf(observation) {
    const hazardType = first(observation.hazardType, observation.hazard_type, observation.reportType, observation.category, observation.type);
    return {
      id: first(observation.id, observation.reportId, observation.report_id, observation.sourceReportId, observation.source_report_id),
      awarenessArea: first(observation.awarenessArea, observation.awareness_area, observation.awarenessAreaKey, observation.awareness_area_key),
      community: first(observation.community, observation.city, observation.locality),
      county: first(observation.county, observation.countyName, observation.county_name),
      roadway: first(observation.roadway, observation.roadName, observation.road_name, observation.street),
      crossing: first(observation.crossing, observation.crossingName, observation.crossing_name, observation.crossingId, observation.crossing_id),
      hazardType,
      eventType: first(observation.eventType, observation.event_type, observation.activityType, observation.activity_type, hazardType),
      timestamp: first(observation.observationTimestamp, observation.observedAt, observation.observed_at, observation.createdAt, observation.created_at, observation.timestamp),
      source: first(observation.observationSource, observation.observation_source, observation.source, "community"),
      durationMinutes: finite(observation.durationMinutes ?? observation.duration_minutes ?? observation.duration),
      valid: observation.valid !== false && observation.validationStatus !== "invalid"
    };
  }

  function qualifyObservation(observation, options = {}) {
    if (!observation || typeof observation !== "object") return Object.freeze({ eligible: false, status: "rejected", reasons: Object.freeze(["invalid_observation"]) });
    const value = fieldsOf(observation);
    const reasons = [];
    const supported = new Set((options.supportedTypes || SUPPORTED_TYPES).map(slug));
    if (!value.valid) reasons.push("invalid_observation");
    if (!value.timestamp || !Number.isFinite(Date.parse(value.timestamp))) reasons.push("invalid_timestamp");
    if (!value.hazardType || (!supported.has(slug(value.hazardType)) && !supported.has(slug(value.eventType)))) reasons.push("unsupported_event_type");
    if (!value.awarenessArea) reasons.push("missing_awareness_area");
    if (!value.community || !value.county) reasons.push("incomplete_geography");
    if (!value.roadway && !value.crossing) reasons.push("missing_historical_subject");
    if (options.validAwarenessAreas && !options.validAwarenessAreas.map(slug).includes(slug(value.awarenessArea))) reasons.push("geographically_invalid");
    if (options.validCounties && !options.validCounties.map(slug).includes(slug(value.county))) reasons.push("geographically_invalid");
    return Object.freeze({ eligible: reasons.length === 0, status: reasons.length ? "rejected" : "qualified", reasons: Object.freeze([...new Set(reasons)]), evaluatedAt: options.evaluatedAt || null });
  }

  function archiveObservation(observation, options = {}) {
    const qualification = qualifyObservation(observation, options);
    if (!qualification.eligible) return Object.freeze({ archived: false, qualification, record: null });
    const value = fieldsOf(observation);
    const instant = Date.parse(value.timestamp);
    const offsetMinutes = finite(observation.utcOffsetMinutes ?? options.utcOffsetMinutes) || 0;
    const local = new Date(instant + offsetMinutes * 60000);
    const subjectType = value.crossing ? "crossing" : "roadway";
    const subject = value.crossing || value.roadway;
    const areaKey = slug(value.awarenessArea || value.community || value.county)?.replace(/_/g, "-");
    const key = (v) => slug(v)?.replace(/_/g, "-") || null;
    const fingerprint = [key(value.awarenessArea), key(value.community), key(subject), key(value.hazardType), key(value.eventType), new Date(instant).toISOString()].join("|");
    const record = Object.freeze({
      archiveId: `historical:${fingerprint}`, sourceObservationId: value.id, awarenessArea: value.awarenessArea,
      community: value.community, county: value.county, roadway: value.roadway, crossing: value.crossing,
      hazardType: value.hazardType, eventType: value.eventType, observationTimestamp: new Date(instant).toISOString(),
      observationDay: local.toISOString().slice(0, 10), localDay: DAYS[local.getUTCDay()],
      localTime: `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`,
      dayOfWeek: DAYS[local.getUTCDay()], minuteOfDay: local.getUTCHours() * 60 + local.getUTCMinutes(),
      durationMinutes: value.durationMinutes !== null && value.durationMinutes >= 0 ? value.durationMinutes : null,
      observationSource: value.source, qualificationStatus: qualification.status, archiveVersion: ARCHIVE_VERSION,
      subjectType, subject, areaKey, behaviorKey: [areaKey, subjectType, key(subject), key(value.hazardType), key(value.eventType)].join("|"), fingerprint
    });
    return Object.freeze({ archived: true, qualification, record });
  }

  function ingestIncrementally(existingArchive, observations, options = {}) {
    const records = Array.isArray(existingArchive) ? existingArchive.slice() : [];
    const fingerprints = new Set(records.map((record) => record.fingerprint));
    const rejected = [], duplicates = [], added = [];
    (Array.isArray(observations) ? observations : []).forEach((observation) => {
      const result = archiveObservation(observation, options);
      if (!result.archived) return rejected.push(Object.freeze({ sourceObservationId: fieldsOf(observation || {}).id, qualification: result.qualification }));
      if (fingerprints.has(result.record.fingerprint)) return duplicates.push(result.record.fingerprint);
      fingerprints.add(result.record.fingerprint); records.push(result.record); added.push(result.record);
    });
    return Object.freeze({ archive: Object.freeze(records), added: Object.freeze(added), rejected: Object.freeze(rejected), duplicates: Object.freeze(duplicates), incremental: true, rebuildRequired: false });
  }

  function agingStatus(record, now = new Date().toISOString()) {
    const ageDays = Math.max(0, Math.floor((Date.parse(now) - Date.parse(record?.observationTimestamp)) / 86400000));
    if (!Number.isFinite(ageDays)) return "inactive";
    if (ageDays <= AGING.recent) return "recent";
    if (ageDays <= AGING.established) return "established";
    if (ageDays <= AGING.aging) return "aging";
    return "inactive";
  }

  const toLP067Observations = (archive) => Object.freeze((Array.isArray(archive) ? archive : []).filter((record) => record?.qualificationStatus === "qualified").slice());
  const api = Object.freeze({ VERSION, ARCHIVE_VERSION, ACTIVATION, SUPPORTED_TYPES, AGING, qualifyObservation, archiveObservation, ingestIncrementally, agingStatus, toLP067Observations });
  globalScope.gridlyHistoricalObservationLearning = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
