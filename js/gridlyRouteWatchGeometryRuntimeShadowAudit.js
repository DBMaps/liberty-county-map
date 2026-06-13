(function initGridlyRouteWatchGeometryRuntimeShadowAudit(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const VERSION = "V296-route-watch-geometry-runtime-shadow-audit";
  const DEFAULT_OPTIONS = {
    overlapToleranceMeters: 60,
    overlapThreshold: 0.25,
    confidenceThreshold: 0.55,
    mobileAverageMsBudget: 4,
    mobilePeakMsBudget: 16,
    totalOverheadMsBudget: 120
  };

  const state = {
    version: VERSION,
    candidates: [],
    performance: {
      scoringCount: 0,
      totalScoringTimeMs: 0,
      peakScoringTimeMs: 0,
      totalAuditOverheadMs: 0
    }
  };

  function nowMs() {
    return typeof globalScope.performance?.now === "function" ? globalScope.performance.now() : Date.now();
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function safeString(value, fallback = "") {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  function normalizePair(pair) {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    const lng = toNumber(pair[0]);
    const lat = toNumber(pair[1]);
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }

  function normalizeLineString(geometry) {
    if (!geometry || typeof geometry !== "object") return [];
    if (geometry.type === "LineString") {
      return Array.isArray(geometry.coordinates) ? geometry.coordinates.map(normalizePair).filter(Boolean) : [];
    }
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) {
      return geometry.coordinates.flatMap((line) => Array.isArray(line) ? line.map(normalizePair).filter(Boolean) : []);
    }
    return [];
  }

  function readIncidentGeometry(incident = {}) {
    const candidates = [
      incident?.retainedGeometry,
      incident?.txdotGeometry,
      incident?.sourceGeometry,
      incident?.rawGeometry,
      incident?.__geometry,
      incident?.geometry,
      incident?.raw?.geometry,
      incident?.source?.geometry,
      incident?.properties?.geometry
    ];
    for (const candidate of candidates) {
      const coordinates = normalizeLineString(candidate);
      if (coordinates.length >= 2) return { geometry: candidate, coordinates, source: "retained_line_geometry" };
    }
    return { geometry: null, coordinates: [], source: "no_retained_line_geometry" };
  }

  function routeLatLngsToGeometry(routeLatLngs = []) {
    const coordinates = (Array.isArray(routeLatLngs) ? routeLatLngs : [])
      .map((point) => {
        const lat = toNumber(point?.lat ?? point?.latitude);
        const lng = toNumber(point?.lng ?? point?.lon ?? point?.longitude);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lng, lat] : null;
      })
      .filter(Boolean);
    return { type: "LineString", coordinates };
  }

  function fallbackOverlapScore(retainedEvent, routeGeometry, options = {}) {
    const prototype = globalScope.gridlyTxdotGeometryRetentionPrototype;
    if (prototype && typeof prototype.scoreRouteOverlap === "function") {
      return prototype.scoreRouteOverlap(retainedEvent, routeGeometry, { toleranceMeters: options.overlapToleranceMeters });
    }
    return {
      overlapDistanceMeters: 0,
      overlapPercentage: 0,
      confidence: 0,
      reason: "V290 geometry scorer unavailable in runtime shadow audit."
    };
  }

  function confidenceBand(overlap, geometryRelevant, geometrySource) {
    if (geometrySource !== "retained_line_geometry") return "unavailable";
    const percentage = Number(overlap?.overlapPercentage || 0);
    if (geometryRelevant && percentage >= 0.5) return "high";
    if (geometryRelevant) return "medium";
    if (percentage >= 0.1) return "low";
    return "not_relevant";
  }

  function buildFallbackReason({ routeGeometry, incidentGeometry, geometryRelevant, midpointRelevant, band }) {
    if (!Array.isArray(routeGeometry?.coordinates) || routeGeometry.coordinates.length < 2) return "route_geometry_unavailable_current_midpoint_preserved";
    if (!Array.isArray(incidentGeometry?.coordinates) || incidentGeometry.coordinates.length < 2) return "retained_incident_geometry_unavailable_current_midpoint_preserved";
    if (midpointRelevant !== geometryRelevant) return "shadow_disagreement_current_midpoint_preserved";
    if (band === "not_relevant") return "geometry_shadow_rejected_current_midpoint_preserved";
    if (band === "low") return "low_overlap_shadow_review_current_midpoint_preserved";
    return "geometry_shadow_supported_current_midpoint_preserved";
  }

  function buildDisagreementReason({ midpointRelevant, geometryRelevant, fallbackReason, overlapPercentage }) {
    if (fallbackReason.startsWith("retained_incident_geometry_unavailable")) return "geometry_unavailable";
    if (fallbackReason.startsWith("route_geometry_unavailable")) return "route_geometry_unavailable";
    if (midpointRelevant && !geometryRelevant) return overlapPercentage > 0 ? "insufficient_overlap_or_confidence" : "midpoint_only_no_geometry_overlap";
    if (!midpointRelevant && geometryRelevant) return "geometry_only_overlap_candidate";
    return "none";
  }

  function bucketOverlap(percentage) {
    const value = Number(percentage || 0);
    if (value <= 0) return "0%";
    if (value < 0.1) return "0-10%";
    if (value < 0.25) return "10-25%";
    if (value < 0.5) return "25-50%";
    if (value < 0.75) return "50-75%";
    return "75-100%";
  }

  function increment(counts, key) {
    const safeKey = safeString(key, "unspecified");
    counts[safeKey] = (counts[safeKey] || 0) + 1;
  }

  function routeIdentifier(input = {}) {
    return safeString(input.routeId)
      || safeString(globalScope.__gridlySelectedRouteId)
      || [safeString(input.routeOriginLabel), safeString(input.routeDestinationLabel)].filter(Boolean).join(" -> ")
      || safeString(input.routeName)
      || "active-route";
  }

  function incidentIdentifier(incident = {}) {
    return safeString(incident?.id)
      || safeString(incident?.incidentId)
      || safeString(incident?.GLOBALID)
      || safeString(incident?.globalId)
      || safeString(incident?.crossingId)
      || "unknown-incident";
  }

  function corridorIdentifier(incident = {}, input = {}) {
    return safeString(incident?.routeNameDisplay)
      || safeString(incident?.routeName)
      || safeString(incident?.roadName)
      || safeString(incident?.roadway)
      || safeString(incident?.area)
      || safeString(input.routeName)
      || "unspecified";
  }

  function recordCandidate(input = {}) {
    const auditStartedAt = nowMs();
    const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) };
    const incident = input.incident && typeof input.incident === "object" ? input.incident : {};
    const routeGeometry = routeLatLngsToGeometry(input.routeLatLngs);
    const incidentGeometry = readIncidentGeometry(incident);
    const scoringStartedAt = nowMs();
    const overlap = fallbackOverlapScore({
      id: incidentIdentifier(incident),
      coordinates: incidentGeometry.coordinates,
      routeReferences: { routeName: corridorIdentifier(incident, input) }
    }, routeGeometry, options);
    const overlapPercentage = Number(overlap?.overlapPercentage || 0);
    const geometryConfidence = Number(overlap?.confidence || 0);
    const geometryRelevant = incidentGeometry.coordinates.length >= 2
      && overlapPercentage >= options.overlapThreshold
      && geometryConfidence >= options.confidenceThreshold;
    const scoringTimeMs = Math.max(0, nowMs() - scoringStartedAt);
    const band = confidenceBand(overlap, geometryRelevant, incidentGeometry.source);
    const fallbackReason = buildFallbackReason({
      routeGeometry,
      incidentGeometry,
      geometryRelevant,
      midpointRelevant: Boolean(input.midpointRelevant),
      band
    });
    const disagreementReason = buildDisagreementReason({
      midpointRelevant: Boolean(input.midpointRelevant),
      geometryRelevant,
      fallbackReason,
      overlapPercentage
    });
    const candidate = {
      routeIdentifier: routeIdentifier(input),
      incidentIdentifier: incidentIdentifier(incident),
      midpointRelevanceResult: Boolean(input.midpointRelevant),
      geometryRelevanceResult: Boolean(geometryRelevant),
      confidenceBand: band,
      overlapPercentage: Number(overlapPercentage.toFixed(3)),
      fallbackReason,
      disagreementReason,
      corridor: corridorIdentifier(incident, input),
      scoringTimeMs: Number(scoringTimeMs.toFixed(3)),
      auditOnly: true,
      productionDecisionUsed: false
    };
    state.candidates.push(candidate);
    state.performance.scoringCount += 1;
    state.performance.totalScoringTimeMs += scoringTimeMs;
    state.performance.peakScoringTimeMs = Math.max(state.performance.peakScoringTimeMs, scoringTimeMs);
    state.performance.totalAuditOverheadMs += Math.max(0, nowMs() - auditStartedAt);
    return candidate;
  }

  function summarize() {
    const candidates = state.candidates.slice();
    const confidenceBandDistribution = {};
    const overlapDistribution = {};
    const disagreementReasons = {};
    const corridorBreakdown = {};

    candidates.forEach((candidate) => {
      increment(confidenceBandDistribution, candidate.confidenceBand);
      increment(overlapDistribution, bucketOverlap(candidate.overlapPercentage));
      increment(disagreementReasons, candidate.disagreementReason);
      const corridor = safeString(candidate.corridor, "unspecified");
      if (!corridorBreakdown[corridor]) {
        corridorBreakdown[corridor] = { evaluatedCandidates: 0, midpointMatches: 0, geometryMatches: 0, midpointOnlyMatches: 0, geometryOnlyMatches: 0, disagreementCount: 0 };
      }
      const row = corridorBreakdown[corridor];
      row.evaluatedCandidates += 1;
      if (candidate.midpointRelevanceResult) row.midpointMatches += 1;
      if (candidate.geometryRelevanceResult) row.geometryMatches += 1;
      if (candidate.midpointRelevanceResult && !candidate.geometryRelevanceResult) row.midpointOnlyMatches += 1;
      if (!candidate.midpointRelevanceResult && candidate.geometryRelevanceResult) row.geometryOnlyMatches += 1;
      if (candidate.midpointRelevanceResult !== candidate.geometryRelevanceResult) row.disagreementCount += 1;
    });

    const scoringCount = Number(state.performance.scoringCount || 0);
    const averageScoringTimeMs = scoringCount > 0 ? state.performance.totalScoringTimeMs / scoringCount : 0;
    const peakScoringTimeMs = Number(state.performance.peakScoringTimeMs || 0);
    const totalAuditOverheadMs = Number(state.performance.totalAuditOverheadMs || 0);
    const mobileSafe = averageScoringTimeMs <= DEFAULT_OPTIONS.mobileAverageMsBudget && peakScoringTimeMs <= DEFAULT_OPTIONS.mobilePeakMsBudget;
    const performanceSafe = mobileSafe && totalAuditOverheadMs <= DEFAULT_OPTIONS.totalOverheadMsBudget;

    return {
      available: true,
      auditOnly: true,
      shadowModeOnly: true,
      productionBehaviorChanged: false,
      safeForProductionWiring: false,
      version: VERSION,
      evaluatedCandidates: candidates.length,
      midpointMatches: candidates.filter((candidate) => candidate.midpointRelevanceResult).length,
      geometryMatches: candidates.filter((candidate) => candidate.geometryRelevanceResult).length,
      midpointOnlyMatches: candidates.filter((candidate) => candidate.midpointRelevanceResult && !candidate.geometryRelevanceResult).length,
      geometryOnlyMatches: candidates.filter((candidate) => !candidate.midpointRelevanceResult && candidate.geometryRelevanceResult).length,
      disagreementCount: candidates.filter((candidate) => candidate.midpointRelevanceResult !== candidate.geometryRelevanceResult).length,
      confidenceBandDistribution,
      overlapDistribution,
      disagreementReasons,
      corridorBreakdown,
      performance: {
        scoringCount,
        averageScoringTimeMs: Number(averageScoringTimeMs.toFixed(3)),
        peakScoringTimeMs: Number(peakScoringTimeMs.toFixed(3)),
        totalAuditOverheadMs: Number(totalAuditOverheadMs.toFixed(3)),
        mobileSafe,
        performanceSafe
      },
      mobileSafe,
      performanceSafe,
      safetyVerification: {
        noUiChanges: true,
        noRouteWatchOutputChanges: true,
        noAlertChanges: true,
        noPopupChanges: true,
        noMarkerChanges: true,
        noAwarenessChanges: true,
        noSupabaseWrites: true,
        noNotificationBehavior: true
      },
      candidates
    };
  }

  globalScope.gridlyRouteWatchGeometryRuntimeShadowState = state;
  globalScope.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate = recordCandidate;
  globalScope.gridlyRouteWatchGeometryRuntimeShadowAudit = summarize;
  globalScope.gridlyResetRouteWatchGeometryRuntimeShadowAudit = function gridlyResetRouteWatchGeometryRuntimeShadowAudit() {
    state.candidates = [];
    state.performance.scoringCount = 0;
    state.performance.totalScoringTimeMs = 0;
    state.performance.peakScoringTimeMs = 0;
    state.performance.totalAuditOverheadMs = 0;
    return summarize();
  };
})(typeof window !== "undefined" ? window : globalThis);
