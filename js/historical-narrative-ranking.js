(function attachHistoricalNarrativeRanking(globalScope) {
  "use strict";

  const VERSION = "LP069.historical-narrative-ranking.v1";
  const LIVE_GUIDANCE = "Check current alerts for live conditions.";
  const CONFIDENCE = Object.freeze({ insufficient: 0, emerging: 1, meaningful: 2, recurring_pattern: 3, strong_recurring_pattern: 4 });
  const freeze = (value) => Object.freeze(value);
  const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const key = (value) => (text(value) || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const list = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
  const minuteDistance = (left, right) => Math.min(Math.abs(left - right), 1440 - Math.abs(left - right));

  function currentClock(context) {
    const instant = new Date(context?.now || new Date().toISOString());
    if (!Number.isFinite(instant.getTime())) return null;
    const local = new Date(instant.getTime() + (finite(context?.utcOffsetMinutes) || 0) * 60000);
    return { dayClass: [0, 6].includes(local.getUTCDay()) ? "weekend" : "weekday", minute: local.getUTCHours() * 60 + local.getUTCMinutes() };
  }

  function eventFamily(pattern, narrativeType) {
    if (narrativeType === "crossing_delay") return "crossing";
    if (narrativeType) return narrativeType;
    const value = key(`${pattern.hazardType || ""} ${pattern.eventType || ""}`);
    if (/rail|train|crossing|block/.test(value)) return "crossing";
    if (/flood|water/.test(value)) return "flooding";
    if (/construct|roadwork|work-zone/.test(value)) return "construction";
    if (/congest|traffic|backup|slow/.test(value)) return "congestion";
    if (/community|event|parade|festival|school/.test(value)) return "community_activity";
    return "roadway_hazard";
  }

  function geographicQuality(pattern, context) {
    const crossings = new Set([context?.crossing, ...list(context?.nearbyCrossings)].map(key).filter(Boolean));
    const roads = new Set([context?.roadway, ...list(context?.nearbyRoads)].map(key).filter(Boolean));
    const areas = new Set([context?.awarenessArea, context?.community].map(key).filter(Boolean));
    const counties = new Set([context?.county].map(key).filter(Boolean));
    if (pattern.crossing && crossings.has(key(pattern.crossing))) return 4;
    if (pattern.roadway && roads.has(key(pattern.roadway))) return 3;
    if ((pattern.awarenessArea && areas.has(key(pattern.awarenessArea))) || (pattern.community && areas.has(key(pattern.community))) ) return 2;
    if (pattern.county && counties.has(key(pattern.county))) return 1;
    return 0;
  }

  function subjectSpecificity(pattern) {
    if (text(pattern.crossing)) return 4;
    if (text(pattern.roadway)) return 3;
    if (text(pattern.community)) return 2;
    if (text(pattern.awarenessArea) || text(pattern.county)) return 1;
    return 0;
  }

  function buildCandidate(input, context = {}) {
    const relevance = input?.relevance || (input?.status ? input : null);
    const pattern = input?.pattern || relevance?.pattern || input?.sourcePattern;
    const record = input?.narrativeRecord || input?.record || (input?.narrative && input?.metadata ? input : null);
    if (!pattern || !record?.narrative || (relevance?.status && relevance.status !== "relevant")) return null;
    const confidenceCategory = text(pattern.confidence || pattern.qualificationState || record.metadata?.confidenceCategory) || "insufficient";
    const confidenceQuality = CONFIDENCE[confidenceCategory] || 0;
    const clock = currentClock(context);
    const centerMinute = finite(pattern.centerMinute);
    const temporalDistance = clock && centerMinute !== null ? minuteDistance(centerMinute, clock.minute) : Infinity;
    const temporalQuality = !clock || pattern.dayClass !== clock.dayClass || temporalDistance > 90 ? 0 : temporalDistance <= 30 ? 3 : temporalDistance <= 60 ? 2 : 1;
    const geographicMatchQuality = geographicQuality(pattern, context);
    const specificity = subjectSpecificity(pattern);
    const distinctDates = finite(pattern.distinctHistoricalDates ?? pattern.observationCount) || 0;
    const consistency = pattern.basis?.stableTimeContext === false ? 0 : Math.min(4, distinctDates);
    const freshness = Date.parse(pattern.lastObservedAt || pattern.lastObserved || "");
    const ageDays = Number.isFinite(freshness) && clock ? Math.max(0, Math.floor((Date.parse(context.now) - freshness) / 86400000)) : Infinity;
    const freshnessQuality = ageDays <= 30 ? 3 : ageDays <= 180 ? 2 : ageDays <= 365 ? 1 : 0;
    const narrativeType = text(record.metadata?.narrativeType) || eventFamily(pattern);
    const canonicalId = key(pattern.patternKey || pattern.historicalPatternId || [pattern.awarenessArea, pattern.community, pattern.crossing, pattern.roadway, pattern.hazardType, pattern.eventType, pattern.dayClass, centerMinute].join("|"));
    const relevanceQuality = geographicMatchQuality * 4 + temporalQuality;
    const usefulnessScore = relevanceQuality * 5 + specificity * 4 + confidenceQuality * 4 + consistency * 2 + freshnessQuality + (text(pattern.typicalDurationMinutes) ? 1 : 0);
    const eligible = confidenceQuality >= CONFIDENCE.meaningful && geographicMatchQuality >= 2 && temporalQuality > 0 && specificity > 0 && usefulnessScore >= 48;
    return freeze({
      canonicalId, patternIdentity: text(pattern.patternKey || pattern.historicalPatternId), underlyingBehaviorId: text(pattern.underlyingBehaviorId),
      narrative: record.narrative, narrativeType, subject: text(pattern.subject || pattern.crossing || pattern.roadway || pattern.community || pattern.awarenessArea),
      awarenessArea: text(pattern.awarenessArea), community: text(pattern.community), county: text(pattern.county), roadway: text(pattern.roadway), crossing: text(pattern.crossing),
      hazardType: text(pattern.hazardType), eventType: text(pattern.eventType), confidenceCategory,
      historicalWindow: freeze({ firstObservedAt: text(pattern.firstObservedAt || pattern.firstObserved), lastObservedAt: text(pattern.lastObservedAt || pattern.lastObserved) }),
      currentRelevanceReason: text(record.metadata?.relevanceReason), liveConditionGuidance: LIVE_GUIDANCE,
      rankingMetadata: freeze({ relevanceQuality, subjectSpecificity: specificity, geographicMatchQuality, temporalMatchQuality: temporalQuality, confidenceQuality, historicalConsistency: consistency, supportingDataFreshness: freshnessQuality, ageDays, durationQuality: finite(pattern.typicalDurationMinutes) > 0 ? 1 : 0, usefulnessScore, eligible }),
      productionIntegration: false, consumerVisible: false
    });
  }

  function compare(left, right) {
    const fields = ["relevanceQuality", "subjectSpecificity", "geographicMatchQuality", "temporalMatchQuality", "confidenceQuality", "historicalConsistency", "supportingDataFreshness", "durationQuality"];
    for (const field of fields) {
      const difference = right.rankingMetadata[field] - left.rankingMetadata[field];
      if (difference) return difference;
    }
    return left.canonicalId.localeCompare(right.canonicalId);
  }

  function overlaps(left, right) {
    if (left.underlyingBehaviorId && left.underlyingBehaviorId === right.underlyingBehaviorId) return true;
    if (left.patternIdentity && left.patternIdentity === right.patternIdentity) return true;
    if (eventFamily(left, left.narrativeType) !== eventFamily(right, right.narrativeType)) return false;
    const leftArea = key(left.community || left.awarenessArea || left.county);
    const rightArea = key(right.community || right.awarenessArea || right.county);
    if (!leftArea || leftArea !== rightArea) return false;
    const leftPlace = key(left.crossing || left.roadway);
    const rightPlace = key(right.crossing || right.roadway);
    return !leftPlace || !rightPlace || leftPlace === rightPlace;
  }

  function quiet(reason, metadata = {}) {
    return freeze({ status: "quiet", selectedNarrative: null, selectedCandidate: null, rankingMetadata: freeze({ ...metadata, quietReason: reason }), productionIntegration: false, consumerVisible: false });
  }

  function selectPrimary(inputs, context = {}) {
    const constructed = list(inputs).map((input) => buildCandidate(input, context)).filter(Boolean);
    const eligible = constructed.filter((candidate) => candidate.rankingMetadata.eligible).sort(compare);
    if (!eligible.length) return quiet(constructed.length ? "no_candidate_met_usefulness_governance" : "no_meaningful_candidates", { inputCount: list(inputs).length, candidateCount: constructed.length });
    const retained = [];
    const suppressed = [];
    eligible.forEach((candidate) => {
      const duplicate = retained.find((winner) => overlaps(winner, candidate));
      if (duplicate) suppressed.push(freeze({ canonicalId: candidate.canonicalId, retainedCanonicalId: duplicate.canonicalId, reason: "duplicate_or_overlapping_behavior" }));
      else retained.push(candidate);
    });
    const winner = retained[0];
    const runnerUp = retained[1];
    if (runnerUp && winner.rankingMetadata.usefulnessScore < 55 && winner.rankingMetadata.usefulnessScore - runnerUp.rankingMetadata.usefulnessScore < 3) return quiet("weak_ambiguous_competition", { candidateCount: constructed.length, eligibleCount: eligible.length, duplicateSuppressions: freeze(suppressed) });
    const selectionReason = winner.rankingMetadata.geographicMatchQuality >= 4 ? "exact crossing and current time-window match" : winner.rankingMetadata.geographicMatchQuality === 3 ? "exact roadway and current time-window match" : "strongest specific currently relevant historical narrative";
    return freeze({ status: "selected", selectedNarrative: winner.narrative, selectedCandidate: winner, narrativeType: winner.narrativeType, subject: winner.subject, relevanceReason: winner.currentRelevanceReason, selectionReason, confidenceCategory: winner.confidenceCategory, historicalWindow: winner.historicalWindow, rankingMetadata: freeze({ candidateCount: constructed.length, eligibleCount: eligible.length, retainedCount: retained.length, duplicateSuppressions: freeze(suppressed), winningCanonicalId: winner.canonicalId, factors: winner.rankingMetadata }), productionIntegration: false, consumerVisible: false });
  }

  const api = freeze({ VERSION, buildCandidate, selectPrimary, compareCandidates: compare });
  globalScope.gridlyHistoricalNarrativeRanking = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
