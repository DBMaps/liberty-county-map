(function attachHistoricalNarrativeGenerator(globalScope) {
  "use strict";

  const VERSION = "LP068.historical-narrative-generator.v1";
  const LIVE_CONDITIONS = "Check current alerts for live conditions.";
  const MEANINGFUL_STATES = new Set(["meaningful", "recurring_pattern", "strong_recurring_pattern"]);
  const freeze = (value) => Object.freeze(value);
  const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  function narrativeType(pattern) {
    const description = [pattern?.hazardType, pattern?.eventType].map((value) => text(value)?.toLowerCase() || "").join(" ");
    if (pattern?.crossing && /(rail|train|crossing|block|delay)/.test(description)) return "crossing_delay";
    if (/flood|high water/.test(description)) return "flooding";
    if (/construct|roadwork|work zone/.test(description)) return "construction";
    if (/congest|traffic|backup|slow/.test(description)) return "congestion";
    if (/community|event|parade|festival|school|activity/.test(description)) return "community_activity";
    return "roadway_hazard";
  }

  function timePeriod(pattern) {
    const day = pattern.dayClass === "weekend" ? "weekend" : "weekday";
    const minute = finite(pattern.centerMinute);
    if (minute === null) return `${day} travel periods`;
    if (minute < 720) return `${day} mornings`;
    if (minute < 1020) return `${day} afternoons`;
    if (minute < 1260) return `${day} evenings`;
    return `${day} nights`;
  }

  function locationFor(pattern, type) {
    if (type === "crossing_delay") return `${text(pattern.crossing) || text(pattern.subject)} crossing`;
    if (type === "community_activity") return text(pattern.community) || text(pattern.awarenessArea) || text(pattern.subject);
    return text(pattern.roadway) || text(pattern.subject) || text(pattern.community) || text(pattern.awarenessArea);
  }

  function durationSentence(pattern, type) {
    const minutes = finite(pattern.typicalDurationMinutes ?? pattern.medianDuration ?? pattern.averageDuration);
    if (minutes === null || minutes < 1) return null;
    const rounded = Math.max(5, Math.round(minutes / 5) * 5);
    if (type === "crossing_delay") return `Delays have typically lasted about ${rounded} minutes.`;
    if (type === "congestion") return `Slower conditions have typically lasted about ${rounded} minutes.`;
    return null;
  }

  function openingSentence(pattern, type, location, timing) {
    switch (type) {
      case "crossing_delay":
        return `Drivers have frequently reported trains blocking the ${location} during ${timing}.`;
      case "flooding":
        return `Flooding has repeatedly been reported along ${location} during ${timing}.`;
      case "construction":
        return `Construction activity has commonly been reported along ${location} during ${timing}.`;
      case "congestion":
        return `Drivers have frequently reported congestion along ${location} during ${timing}.`;
      case "community_activity":
        return `Community activity has commonly been reported around ${location} during ${timing}.`;
      default:
        return `Roadway hazards have repeatedly been reported along ${location} during ${timing}.`;
    }
  }

  function isMeaningful(pattern) {
    if (!pattern || typeof pattern !== "object") return false;
    if (pattern.meaningful === true) return true;
    return MEANINGFUL_STATES.has(text(pattern.confidence)) || MEANINGFUL_STATES.has(text(pattern.qualificationState));
  }

  function unwrap(input) {
    if (!input || typeof input !== "object" || input.status === "quiet") return null;
    if (input.status && input.status !== "relevant") return null;
    return input.pattern || input;
  }

  function buildNarrativeRecord(input) {
    const pattern = unwrap(input);
    if (!isMeaningful(pattern)) return null;
    const type = narrativeType(pattern);
    const location = locationFor(pattern, type);
    if (!location) return null;
    const timing = timePeriod(pattern);
    const sentences = [openingSentence(pattern, type, location, timing)];
    const duration = durationSentence(pattern, type);
    if (duration) sentences.push(duration);
    sentences.push(`These historical reports align with the current ${timing.slice(0, -1)} travel period.`);
    sentences.push(LIVE_CONDITIONS);
    return freeze({
      narrative: sentences.join(" "),
      metadata: freeze({
        matchedPattern: text(pattern.patternKey) || text(pattern.historicalPatternId),
        narrativeType: type,
        relevanceReason: `current_${pattern.dayClass === "weekend" ? "weekend" : "weekday"}_time_context`,
        confidenceCategory: text(pattern.confidence) || text(pattern.qualificationState),
        historicalWindow: freeze({ firstObservedAt: text(pattern.firstObservedAt || pattern.firstObserved), lastObservedAt: text(pattern.lastObservedAt || pattern.lastObserved) })
      }),
      consumerVisible: false,
      productionIntegration: false,
      nonPredictive: true
    });
  }

  function generateNarrative(input) {
    return buildNarrativeRecord(input)?.narrative || null;
  }

  const api = freeze({ VERSION, generateNarrative, buildNarrativeRecord });
  globalScope.gridlyHistoricalNarrativeGenerator = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
