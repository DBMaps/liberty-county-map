(function attachHistoricalPatternIntelligence(globalScope) {
  "use strict";

  const VERSION = "LP067.historical-pattern-intelligence.v1";
  const DAYS = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const QUIET = Object.freeze({ status: "quiet", pattern: null, summary: null });

  const text = (...values) => {
    const value = values.find((candidate) => typeof candidate === "string" && candidate.trim());
    return value ? value.trim() : null;
  };
  const key = (value) => text(value)?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || null;
  const array = (value) => Array.isArray(value) ? value : [];
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const median = (values) => {
    const ordered = values.slice().sort((a, b) => a - b);
    if (!ordered.length) return null;
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
  };
  const circularMinuteDistance = (left, right) => Math.min(Math.abs(left - right), 1440 - Math.abs(left - right));

  function timestampOf(report) {
    return text(report.observationTimestamp, report.observedAt, report.observed_at, report.createdAt, report.created_at, report.timestamp);
  }

  function durationOf(report) {
    const explicit = finite(report.durationMinutes ?? report.duration_minutes ?? report.duration);
    if (explicit !== null && explicit >= 0) return explicit;
    const start = Date.parse(timestampOf(report));
    const end = Date.parse(text(report.clearedAt, report.cleared_at, report.endedAt, report.ended_at));
    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 60000) : null;
  }

  function normalizeObservation(report, options = {}) {
    if (!report || typeof report !== "object") return null;
    const observationTimestamp = timestampOf(report);
    const instant = Date.parse(observationTimestamp);
    if (!Number.isFinite(instant)) return null;
    const offsetMinutes = finite(report.utcOffsetMinutes ?? options.utcOffsetMinutes) || 0;
    const local = new Date(instant + offsetMinutes * 60000);
    const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();
    const crossing = text(report.crossing, report.crossingName, report.crossing_name, report.crossingId, report.crossing_id);
    const roadway = text(report.roadway, report.roadName, report.road_name, report.street);
    const hazardType = text(report.hazardType, report.hazard_type, report.reportType, report.category, report.type, "community activity");
    const eventType = text(report.eventType, report.event_type, report.activityType, report.activity_type, hazardType);
    const awarenessArea = text(report.awarenessArea, report.awareness_area, report.awarenessAreaKey, report.awareness_area_key);
    const community = text(report.community, report.city, report.locality);
    const county = text(report.county, report.countyName, report.county_name);
    const subjectType = crossing ? "crossing" : roadway ? "roadway" : "community";
    const subject = crossing || roadway || community || awarenessArea || county;
    if (!subject || !(awarenessArea || community || county)) return null;
    return Object.freeze({
      id: text(report.id, report.reportId, report.report_id, report.sourceReportId, report.source_report_id),
      awarenessArea, community, county, roadway, crossing, hazardType, eventType,
      dayOfWeek: DAYS[local.getUTCDay()], minuteOfDay, durationMinutes: durationOf(report),
      observationTimestamp: new Date(instant).toISOString(), observationDay: local.toISOString().slice(0, 10),
      subjectType, subject, areaKey: key(awarenessArea || community || county),
      behaviorKey: [key(awarenessArea || community || county), subjectType, key(subject), key(hazardType), key(eventType)].join("|")
    });
  }

  function normalizeObservations(reports, options) {
    return Object.freeze(array(reports).map((report) => normalizeObservation(report, options)).filter(Boolean));
  }

  function discoverPatterns(observations, options = {}) {
    const now = Date.parse(options.now || new Date().toISOString());
    const groups = new Map();
    array(observations).forEach((observation) => {
      if (!observation?.behaviorKey) return;
      if (!groups.has(observation.behaviorKey)) groups.set(observation.behaviorKey, []);
      groups.get(observation.behaviorKey).push(observation);
    });
    return Object.freeze(Array.from(groups.entries()).map(([patternKey, rows]) => {
      const episodes = Array.from(new Map(rows.map((row) => [row.id || `${row.observationDay}|${row.minuteOfDay}`, row])).values());
      const distinctDays = new Set(episodes.map((row) => row.observationDay));
      const weekdays = episodes.filter((row) => !["Saturday", "Sunday"].includes(row.dayOfWeek));
      const weekends = episodes.filter((row) => ["Saturday", "Sunday"].includes(row.dayOfWeek));
      const dayClass = weekdays.length >= weekends.length ? "weekday" : "weekend";
      const matchingDayClass = dayClass === "weekday" ? weekdays : weekends;
      const centerMinute = median(matchingDayClass.map((row) => row.minuteOfDay));
      const temporallyConsistent = centerMinute !== null && matchingDayClass.filter((row) => circularMinuteDistance(row.minuteOfDay, centerMinute) <= 75).length >= Math.ceil(episodes.length * 0.6);
      const ordered = episodes.map((row) => Date.parse(row.observationTimestamp)).sort((a, b) => a - b);
      const spanDays = ordered.length > 1 ? Math.floor((ordered.at(-1) - ordered[0]) / 86400000) : 0;
      const freshEnough = ordered.length > 0 && (!Number.isFinite(now) || now - ordered.at(-1) <= 365 * 86400000);
      const repeatable = episodes.length >= 3 && distinctDays.size >= 3;
      const meaningful = repeatable && temporallyConsistent && spanDays >= 7 && freshEnough;
      const confidence = meaningful ? "meaningful" : repeatable ? "emerging" : "insufficient";
      const exemplar = episodes[0];
      return Object.freeze({
        patternKey, awarenessArea: exemplar.awarenessArea, community: exemplar.community, county: exemplar.county,
        roadway: exemplar.roadway, crossing: exemplar.crossing, hazardType: exemplar.hazardType, eventType: exemplar.eventType,
        subjectType: exemplar.subjectType, subject: exemplar.subject, dayClass, centerMinute,
        typicalDurationMinutes: median(episodes.map((row) => row.durationMinutes).filter((value) => value !== null)),
        confidence, meaningful,
        basis: Object.freeze({ repeatedOnDistinctDays: repeatable, stableTimeContext: temporallyConsistent, sustainedHistoricalSpan: spanDays >= 7, historicallyFresh: freshEnough }),
        observationCount: episodes.length, firstObservedAt: ordered.length ? new Date(ordered[0]).toISOString() : null,
        lastObservedAt: ordered.length ? new Date(ordered.at(-1)).toISOString() : null
      });
    }).filter((pattern) => pattern.confidence !== "insufficient"));
  }

  const contextValues = (context, singular, plural) => new Set([key(context[singular]), ...array(context[plural]).map(key)].filter(Boolean));
  function areaMatches(pattern, context) {
    const requested = [key(context.awarenessArea), key(context.community), key(context.county)].filter(Boolean);
    if (!requested.length) return false;
    return requested.includes(key(pattern.awarenessArea)) || requested.includes(key(pattern.community)) || requested.includes(key(pattern.county));
  }

  function determineCurrentRelevance(patterns, context = {}) {
    const instant = new Date(context.now || new Date().toISOString());
    if (!Number.isFinite(instant.getTime())) return QUIET;
    const offsetMinutes = finite(context.utcOffsetMinutes) || 0;
    const local = new Date(instant.getTime() + offsetMinutes * 60000);
    const dayClass = [0, 6].includes(local.getUTCDay()) ? "weekend" : "weekday";
    const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
    const roads = contextValues(context, "roadway", "nearbyRoads");
    const crossings = contextValues(context, "crossing", "nearbyCrossings");
    const candidates = array(patterns).filter((pattern) => {
      if (!pattern.meaningful || !areaMatches(pattern, context) || pattern.dayClass !== dayClass) return false;
      if (circularMinuteDistance(pattern.centerMinute, minute) > 90) return false;
      if (pattern.crossing && crossings.size && !crossings.has(key(pattern.crossing))) return false;
      if (pattern.roadway && roads.size && !roads.has(key(pattern.roadway))) return false;
      return true;
    }).sort((left, right) => {
      const leftPlace = (left.crossing && crossings.has(key(left.crossing))) || (left.roadway && roads.has(key(left.roadway))) ? 1 : 0;
      const rightPlace = (right.crossing && crossings.has(key(right.crossing))) || (right.roadway && roads.has(key(right.roadway))) ? 1 : 0;
      return rightPlace - leftPlace || circularMinuteDistance(left.centerMinute, minute) - circularMinuteDistance(right.centerMinute, minute) || Date.parse(right.lastObservedAt) - Date.parse(left.lastObservedAt);
    });
    return candidates.length ? Object.freeze({ status: "relevant", pattern: candidates[0] }) : QUIET;
  }

  function clock(minutes) {
    const normalized = (minutes + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    const minute = Math.round(normalized % 60 / 5) * 5;
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  }
  function hazardPhrase(pattern) {
    const hazard = (pattern.hazardType || pattern.eventType || "activity").toLowerCase().replace(/_/g, " ");
    if (pattern.crossing && /(block|train|rail|delay)/.test(hazard)) return "rail delays";
    if (/flood/.test(hazard)) return "flooding";
    if (/congest|traffic/.test(hazard)) return "congestion";
    return hazard;
  }
  function generateDriverSummary(result) {
    if (!result || result.status !== "relevant" || !result.pattern) return null;
    const pattern = result.pattern;
    const place = pattern.crossing ? `${pattern.crossing} crossing` : pattern.roadway || pattern.community || pattern.awarenessArea;
    const start = clock(pattern.centerMinute - 45);
    const end = clock(pattern.centerMinute + 45);
    const hazard = hazardPhrase(pattern);
    const verb = /s$/.test(hazard) && !/congestion$/.test(hazard) ? "are" : "is";
    return `${pattern.dayClass === "weekday" ? "Weekday" : "Weekend"} ${hazard} ${verb} commonly reported at ${place} between about ${start} and ${end}. Check current alerts for live conditions.`;
  }

  function evaluate(reports, context = {}, options = {}) {
    const observations = normalizeObservations(reports, options);
    const patterns = discoverPatterns(observations, { now: context.now });
    const relevance = determineCurrentRelevance(patterns, context);
    return Object.freeze({ version: VERSION, observations, patterns, relevance, summary: generateDriverSummary(relevance), nonPredictive: true, productionIntegration: false });
  }

  const api = Object.freeze({ VERSION, normalizeObservation, normalizeObservations, discoverPatterns, determineCurrentRelevance, generateDriverSummary, evaluate });
  globalScope.gridlyHistoricalPatternIntelligence = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
