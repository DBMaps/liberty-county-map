(function initGridlyRouteWatchGeometryRuntimeShadowAudit(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const VERSION = "V308.2-force-shadow-audit-fast-return";
  const RUNTIME_SAFETY_SKIP_REASON = "scoring_temporarily_disabled_for_runtime_safety";
  const DEFAULT_OPTIONS = {
    midpointThresholdMiles: 0.8,
    overlapToleranceMeters: 60,
    overlapThreshold: 0.25,
    confidenceThreshold: 0.55,
    mobileAverageMsBudget: 4,
    mobilePeakMsBudget: 16,
    totalOverheadMsBudget: 120,
    maxIncidentCandidates: 25,
    maxRouteVerticesSampled: 400,
    maxGeometryComparisons: 8000,
    runtimeBudgetMs: 50
  };
  const ACTIVE_ROUTE_CONTEXT_SHADOW_TYPES = new Set([
    "searched_destination_route",
    "saved_destination_route",
    "home_destination_route",
    "work_destination_route",
    "route_watch_monitored_route"
  ]);
  const state = { version: VERSION, candidates: [], performance: { scoringCount: 0, totalScoringTimeMs: 0, peakScoringTimeMs: 0, totalAuditOverheadMs: 0 }, exclusionReasons: {}, excludedIncidentCandidates: [], scoredIncidentKeys: new Set(), excludedIncidentKeys: new Set() };

  function nowMs() { return typeof globalScope.performance?.now === "function" ? globalScope.performance.now() : Date.now(); }
  function toNumber(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
  function safeString(value, fallback = "") { return typeof value === "string" && value.trim() ? value.trim() : fallback; }
  function increment(counts, key) { const safeKey = safeString(key, "unspecified"); counts[safeKey] = (counts[safeKey] || 0) + 1; }
  function normalizePair(pair) {
    if (Array.isArray(pair) && pair.length >= 2) { const lng = toNumber(pair[0]); const lat = toNumber(pair[1]); return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null; }
    if (pair && typeof pair === "object") { const lat = toNumber(pair.lat ?? pair.latitude); const lng = toNumber(pair.lng ?? pair.lon ?? pair.longitude); return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null; }
    return null;
  }
  function normalizeLineString(geometry) {
    if (!geometry || typeof geometry !== "object") return [];
    if (geometry.type === "LineString") return Array.isArray(geometry.coordinates) ? geometry.coordinates.map(normalizePair).filter(Boolean) : [];
    if (geometry.type === "MultiLineString" && Array.isArray(geometry.coordinates)) return geometry.coordinates.flatMap((line) => Array.isArray(line) ? line.map(normalizePair).filter(Boolean) : []);
    if (Array.isArray(geometry.coordinates)) return geometry.coordinates.map(normalizePair).filter(Boolean);
    if (Array.isArray(geometry.geometry)) return geometry.geometry.map(normalizePair).filter(Boolean);
    if (Array.isArray(geometry.routeLatLngs)) return geometry.routeLatLngs.map(normalizePair).filter(Boolean);
    if (Array.isArray(geometry)) return geometry.map(normalizePair).filter(Boolean);
    return [];
  }
  function asLineString(coordinates) { return { type: "LineString", coordinates: (Array.isArray(coordinates) ? coordinates : []).map(normalizePair).filter(Boolean) }; }
  function sampleCoordinates(coordinates, maxVertices) {
    const normalized = (Array.isArray(coordinates) ? coordinates : []).map(normalizePair).filter(Boolean);
    const cap = Math.max(2, Number(maxVertices || DEFAULT_OPTIONS.maxRouteVerticesSampled));
    if (normalized.length <= cap) return normalized;
    const sampled = [];
    const last = normalized.length - 1;
    for (let index = 0; index < cap; index += 1) sampled.push(normalized[Math.round((index * last) / (cap - 1))]);
    return sampled;
  }

  function buildBrowserSafeValidationGuidance() {
    return {
      routeDetailsCommand: "window.gridlyGetDestinationRouteActiveIncidentCandidates?.()",
      auditCommand: "window.gridlyRouteWatchGeometryRuntimeShadowAudit?.()",
      expectedWhenRouteDetailsCandidatesPresent: {
        scoringSkipped: true,
        scoringSkipReason: RUNTIME_SAFETY_SKIP_REASON,
        productionBehaviorChanged: false,
        safeForProductionWiring: false
      },
      note: "Run Route Details candidate lookup first, then run the runtime shadow audit. The audit should return immediately and must not attempt overlap scoring while Route Details candidates are present."
    };
  }
  function countRouteDetailsIncidents(activeIncidentSource = {}) {
    const explicitCount = Number(activeIncidentSource.routeDetailsIncidentCount);
    if (Number.isFinite(explicitCount)) return explicitCount;
    return Array.isArray(activeIncidentSource.incidents) ? activeIncidentSource.incidents.filter(isActiveIncident).length : 0;
  }
  function isRouteDetailsIncidentSource(activeIncidentSource = {}) {
    return Boolean(activeIncidentSource && activeIncidentSource.sourceName && activeIncidentSource.sourceName !== "none" && Number.isFinite(Number(activeIncidentSource.routeDetailsIncidentCount)));
  }
  function buildFastReturnAuditPayload(input = {}, activeIncidentSource = null, startedAt = nowMs(), skipReason = RUNTIME_SAFETY_SKIP_REASON) {
    const source = activeIncidentSource || readActiveIncidentSource(input);
    const activeRouteContext = readActiveRouteContext(input);
    const activeRouteContextCandidate = buildActiveRouteContextShadowCandidate(activeRouteContext);
    const activeIncidents = (source.incidents || []).filter(isActiveIncident);
    const activeIncidentCandidates = activeIncidents.length;
    const routeDetailsIncidentCount = countRouteDetailsIncidents(source);
    const candidates = activeRouteContextCandidate ? [activeRouteContextCandidate] : [];
    return {
      available: true,
      auditOnly: true,
      shadowModeOnly: true,
      productionBehaviorChanged: false,
      safeForProductionWiring: false,
      incidentSourceUsed: safeString(source.sourceName, "none"),
      routeDetailsIncidentSourceDetected: Boolean(source.sourceName && source.sourceName !== "none"),
      routeDetailsIncidentCount,
      activeIncidentCandidates,
      activeIncidentCandidateIds: activeIncidents.map(incidentIdentifier),
      scoringSkipped: true,
      scoringSkipReason: skipReason,
      evaluatedCandidates: 0,
      scoredIncidentCandidates: 0,
      scoringCount: 0,
      productionDecisionUsed: false,
      activeRouteContextCandidateRecorded: Boolean(activeRouteContextCandidate),
      zeroScoringReasons: activeIncidentCandidates === 0 && routeDetailsIncidentCount === 0 ? { no_active_incidents: 1 } : {},
      excludedIncidentCandidates: [],
      excludedIncidentReasons: {},
      version: VERSION,
      activeRouteContext,
      observationScope: {
        activeRouteContextCandidateRecorded: Boolean(activeRouteContextCandidate),
        activeRouteContextCandidateReason: activeRouteContextCandidateReason(activeRouteContext),
        activeRouteContextType: safeString(activeRouteContext?.routeContextType, "unknown"),
        activeRouteHasGeometry: Boolean(activeRouteContext?.hasGeometry),
        activeRouteVertexCount: Number(activeRouteContext?.vertexCount || 0)
      },
      performance: { scoringCount: 0, averageScoringTimeMs: 0, peakScoringTimeMs: 0, totalAuditOverheadMs: Number(Math.max(0, nowMs() - startedAt).toFixed(3)), mobileSafe: true, performanceSafe: true },
      averageScoringTimeMs: 0,
      peakScoringTimeMs: 0,
      totalAuditOverheadMs: Number(Math.max(0, nowMs() - startedAt).toFixed(3)),
      mobileSafe: true,
      performanceSafe: true,
      safetyVerification: { noUiChanges: true, noRouteWatchOutputChanges: true, noAlertChanges: true, noPopupChanges: true, noMarkerChanges: true, noAwarenessChanges: true, noSupabaseWrites: true, noNotificationBehavior: true },
      browserSafeValidationGuidance: buildBrowserSafeValidationGuidance(),
      candidates
    };
  }
  function buildSkippedCandidate(input = {}, reason, details = {}) {
    const incident = input.incident && typeof input.incident === "object" ? input.incident : {};
    const activeRouteContext = readActiveRouteContext(input);
    return { routeOwnership: ownershipFromActiveRouteContext(activeRouteContext, input.routeOwnership || input.routeOwnershipState || input.routeSource || "saved_route_watch_route"), destinationLabel: safeString(activeRouteContext?.destinationLabel || input.routeDestinationLabel, ""), incidentId: incidentIdentifier(incident), incidentType: incidentType(incident), incidentStatus: incidentStatus(incident), midpointRelevant: false, geometryRelevant: false, overlapPercent: 0, confidenceBand: "unavailable", fallbackReason: reason, disagreementReason: reason, productionDecisionUsed: false, routeIdentifier: safeString(input.routeId, "active-route"), activeRouteContextType: safeString(activeRouteContext?.routeContextType, "unknown"), activeRouteHasGeometry: Boolean(details.activeRouteHasGeometry), activeRouteVertexCount: Number(details.activeRouteVertexCount || 0), incidentIdentifier: incidentIdentifier(incident), midpointRelevanceResult: false, geometryRelevanceResult: false, overlapPercentage: 0, corridor: corridorIdentifier(incident, input), scoringTimeMs: 0, auditOnly: true, scoringSkipped: true, scoringSkippedReason: reason };
  }
  function routeLatLngsToGeometry(routeLatLngs = []) { return asLineString(routeLatLngs); }
  function readActiveRouteContext(input = {}) { if (input.activeRouteContext && typeof input.activeRouteContext === "object") return input.activeRouteContext; try { return typeof globalScope.gridlyGetActiveRouteContext === "function" ? globalScope.gridlyGetActiveRouteContext() : null; } catch (_error) { return null; } }
  function activeRouteContextCandidateReason(activeRouteContext = null) {
    if (!activeRouteContext || typeof activeRouteContext !== "object") return "active_route_context_unavailable";
    const contextType = safeString(activeRouteContext.routeContextType, "no_active_route");
    if (!activeRouteContext.routeContextAvailable) return "route_context_not_available";
    if (!ACTIVE_ROUTE_CONTEXT_SHADOW_TYPES.has(contextType)) return `unsupported_context_type_${contextType}`;
    if (!activeRouteContext.hasGeometry) return "route_context_geometry_unavailable";
    if (Number(activeRouteContext.vertexCount || 0) <= 0) return "route_context_vertex_count_unavailable";
    if (!activeRouteContext.routeWatchEligible) return "route_context_not_route_watch_eligible";
    return "active_route_context_candidate_recorded";
  }
  function readActiveRouteGeometry(activeRouteContext = null, input = {}) {
    const candidates = [input.routeGeometry, input.routeLatLngs, activeRouteContext?.routeGeometry, activeRouteContext?.geometry, activeRouteContext?.coordinates, activeRouteContext?.routeLatLngs, globalScope.GridlyDestinationRoutePreview?.geometry, globalScope.__gridlyActiveRouteContextGeometry];
    for (const candidate of candidates) { const coordinates = normalizeLineString(candidate); if (coordinates.length >= 2) return { geometry: asLineString(coordinates), coordinates, source: candidate === input.routeLatLngs ? "input_route_lat_lngs" : safeString(activeRouteContext?.geometrySource, "active_route_context_geometry") }; }
    return { geometry: null, coordinates: [], source: "active_route_geometry_unavailable" };
  }
  function readIncidentGeometry(incident = {}) {
    const coordinate = normalizePair([incident?.lng ?? incident?.lon ?? incident?.longitude, incident?.lat ?? incident?.latitude]);
    const candidates = [incident?.retainedGeometry, incident?.txdotGeometry, incident?.sourceGeometry, incident?.rawGeometry, incident?.__geometry, incident?.geometry, incident?.raw?.geometry, incident?.source?.geometry, incident?.properties?.geometry];
    for (const candidate of candidates) { const coordinates = normalizeLineString(candidate); if (coordinates.length >= 2) return { geometry: asLineString(coordinates), coordinates, source: "retained_line_geometry" }; }
    if (coordinate) return { geometry: { type: "Point", coordinates: coordinate }, coordinates: [coordinate], source: "point_geometry" };
    return { geometry: null, coordinates: [], source: "invalid_coordinates" };
  }
  function incidentIdentifier(incident = {}) { return safeString(incident.id) || safeString(incident.incidentId) || safeString(incident.GLOBALID) || safeString(incident.globalId) || safeString(incident.crossingId) || "unknown-incident"; }
  function incidentType(incident = {}) { return safeString(incident.type) || safeString(incident.reportType) || safeString(incident.hazardType) || safeString(incident.category) || "unknown"; }
  function incidentStatus(incident = {}) { return safeString(incident.lifecycleState) || safeString(incident.status) || safeString(incident.state) || "active"; }
  function isActiveIncident(incident = {}) { const status = incidentStatus(incident).toLowerCase(); return status === "active" || status === "open" || status === "confirmed" || status === "blocked" || status === "heavy"; }
  function corridorIdentifier(incident = {}, input = {}) { return safeString(incident.routeNameDisplay) || safeString(incident.routeName) || safeString(incident.roadName) || safeString(incident.roadway) || safeString(incident.area) || safeString(input.routeName) || "unspecified"; }
  function ownershipFromActiveRouteContext(activeRouteContext = null, fallback = "saved_route_watch_route") { const contextType = safeString(activeRouteContext?.routeContextType, ""); return ACTIVE_ROUTE_CONTEXT_SHADOW_TYPES.has(contextType) ? contextType : safeString(fallback, "no_active_route"); }
  function distanceMeters(a, b) { if (!Array.isArray(a) || !Array.isArray(b)) return Infinity; const R = 6371008.8; const r = (v) => Number(v) * Math.PI / 180; const dLat = r(b[1]) - r(a[1]); const dLng = r(b[0]) - r(a[0]); const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); }
  function midpointRelevance(incidentGeometry, routeGeometry, options = {}) { const point = incidentGeometry.coordinates[Math.floor(incidentGeometry.coordinates.length / 2)] || null; const minMiles = (routeGeometry.coordinates || []).reduce((min, vertex) => Math.min(min, distanceMeters(point, vertex) / 1609.344), Infinity); const threshold = Number(options.midpointThresholdMiles || DEFAULT_OPTIONS.midpointThresholdMiles); return { relevant: Number.isFinite(minMiles) && minMiles <= threshold, minVertexDistanceMiles: Number.isFinite(minMiles) ? Number(minMiles.toFixed(3)) : null, thresholdMiles: threshold }; }
  function fallbackOverlapScore(retainedEvent, routeGeometry, options = {}) { const prototype = globalScope.gridlyTxdotGeometryRetentionPrototype; if (prototype && typeof prototype.scoreRouteOverlap === "function") return prototype.scoreRouteOverlap(retainedEvent, routeGeometry, { toleranceMeters: options.overlapToleranceMeters }); const anyClose = retainedEvent.coordinates?.some((p) => routeGeometry.coordinates?.some((v) => distanceMeters(p, v) <= (options.overlapToleranceMeters || 60))); return { overlapDistanceMeters: anyClose ? 1 : 0, overlapPercentage: anyClose ? 1 : 0, confidence: anyClose ? 0.75 : 0, reason: "lightweight_vertex_distance_fallback" }; }
  function confidenceBand(overlap, geometryRelevant, geometrySource) { if (geometrySource === "invalid_coordinates") return "unavailable"; const percentage = Number(overlap?.overlapPercentage || 0); if (geometryRelevant && percentage >= 0.5) return "high"; if (geometryRelevant) return "medium"; if (percentage >= 0.1) return "low"; return "not_relevant"; }
  function buildFallbackReason({ routeGeometry, incidentGeometry, geometryRelevant, midpointRelevant, band }) { if (!Array.isArray(routeGeometry?.coordinates) || routeGeometry.coordinates.length < 2) return "active_route_geometry_unavailable_zero_scoring"; if (!Array.isArray(incidentGeometry?.coordinates) || incidentGeometry.coordinates.length < 1) return "incident_geometry_unavailable_excluded"; if (midpointRelevant !== geometryRelevant) return "shadow_disagreement_current_production_preserved"; if (band === "not_relevant") return "geometry_shadow_rejected_current_production_preserved"; if (band === "low") return "low_overlap_shadow_review_current_production_preserved"; return "geometry_shadow_supported_current_production_preserved"; }
  function buildDisagreementReason({ midpointRelevant, geometryRelevant, fallbackReason, overlapPercentage }) { if (fallbackReason.includes("unavailable")) return fallbackReason; if (midpointRelevant && !geometryRelevant) return overlapPercentage > 0 ? "insufficient_overlap_or_confidence" : "midpoint_only_no_geometry_overlap"; if (!midpointRelevant && geometryRelevant) return "geometry_only_overlap_candidate"; return "none"; }
  function bucketOverlap(percentage) { const value = Number(percentage || 0); if (value <= 0) return "0%"; if (value < 0.1) return "0-10%"; if (value < 0.25) return "10-25%"; if (value < 0.5) return "25-50%"; if (value < 0.75) return "50-75%"; return "75-100%"; }
  function buildActiveRouteContextShadowCandidate(activeRouteContext = null) { const reason = activeRouteContextCandidateReason(activeRouteContext); if (reason !== "active_route_context_candidate_recorded") return null; return { routeOwnership: safeString(activeRouteContext.routeContextType, "unknown"), routeSource: safeString(activeRouteContext.routeSource, "unknown"), destinationType: safeString(activeRouteContext.destinationType, "unknown"), destinationLabel: safeString(activeRouteContext.destinationLabel, ""), geometrySource: safeString(activeRouteContext.geometrySource, "unknown"), vertexCount: Number(activeRouteContext.vertexCount || 0), candidateSource: "active_route_context", productionBehaviorChanged: false, auditOnly: true, productionDecisionUsed: false }; }
  function scoreCandidate(input = {}) {
    const auditStartedAt = nowMs(); const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) }; const incident = input.incident && typeof input.incident === "object" ? input.incident : {}; const activeRouteContext = readActiveRouteContext(input); const activeRouteGeometry = readActiveRouteGeometry(activeRouteContext, input);
    const originalRouteCoordinates = (activeRouteGeometry.coordinates.length >= 2 ? activeRouteGeometry.coordinates : normalizeLineString(input.routeGeometry || input.routeLatLngs));
    const routeCoordinates = sampleCoordinates(originalRouteCoordinates, options.maxRouteVerticesSampled);
    const routeGeometry = asLineString(routeCoordinates); const incidentGeometry = readIncidentGeometry(incident);
    const comparisonCount = routeCoordinates.length * Math.max(1, incidentGeometry.coordinates.length);
    if (input.auditDeadlineMs && nowMs() >= input.auditDeadlineMs) { const skipped = buildSkippedCandidate(input, "scoring_skipped_runtime_budget", { activeRouteHasGeometry: routeCoordinates.length >= 2, activeRouteVertexCount: routeCoordinates.length }); state.candidates.push(skipped); return skipped; }
    if (routeCoordinates.length < 2 || incidentGeometry.coordinates.length < 1) { const skipped = buildSkippedCandidate(input, "scoring_skipped_geometry_unavailable", { activeRouteHasGeometry: routeCoordinates.length >= 2, activeRouteVertexCount: routeCoordinates.length }); state.candidates.push(skipped); return skipped; }
    if (comparisonCount > Number(options.maxGeometryComparisons || DEFAULT_OPTIONS.maxGeometryComparisons)) { const skipped = buildSkippedCandidate(input, "scoring_skipped_runtime_budget", { activeRouteHasGeometry: true, activeRouteVertexCount: routeCoordinates.length }); state.candidates.push(skipped); return skipped; }
    const scoringStartedAt = nowMs(); const midpoint = typeof input.midpointRelevant === "boolean" ? { relevant: input.midpointRelevant } : midpointRelevance(incidentGeometry, routeGeometry, options);
    if (input.auditDeadlineMs && nowMs() >= input.auditDeadlineMs) { const skipped = buildSkippedCandidate(input, "scoring_skipped_runtime_budget", { activeRouteHasGeometry: true, activeRouteVertexCount: routeCoordinates.length }); state.candidates.push(skipped); return skipped; }
    const overlap = fallbackOverlapScore({ id: incidentIdentifier(incident), coordinates: incidentGeometry.coordinates, routeReferences: { routeName: corridorIdentifier(incident, input) } }, routeGeometry, options); const overlapPercentage = Number(overlap?.overlapPercentage || 0); const geometryConfidence = Number(overlap?.confidence || 0); const geometryRelevant = routeCoordinates.length >= 2 && incidentGeometry.coordinates.length >= 1 && overlapPercentage >= options.overlapThreshold && geometryConfidence >= options.confidenceThreshold; const scoringTimeMs = Math.max(0, nowMs() - scoringStartedAt); const band = confidenceBand(overlap, geometryRelevant, incidentGeometry.source); const fallbackReason = buildFallbackReason({ routeGeometry, incidentGeometry, geometryRelevant, midpointRelevant: Boolean(midpoint.relevant), band }); const disagreementReason = buildDisagreementReason({ midpointRelevant: Boolean(midpoint.relevant), geometryRelevant, fallbackReason, overlapPercentage });
    const candidate = { routeOwnership: ownershipFromActiveRouteContext(activeRouteContext, input.routeOwnership || input.routeOwnershipState || input.routeSource || "saved_route_watch_route"), destinationLabel: safeString(activeRouteContext?.destinationLabel || input.routeDestinationLabel, ""), incidentId: incidentIdentifier(incident), incidentType: incidentType(incident), incidentStatus: incidentStatus(incident), incidentLocation: { lat: toNumber(incident.lat ?? incident.latitude), lng: toNumber(incident.lng ?? incident.lon ?? incident.longitude), corridor: corridorIdentifier(incident, input) }, midpointRelevant: Boolean(midpoint.relevant), geometryRelevant: Boolean(geometryRelevant), overlapPercent: Number((overlapPercentage * 100).toFixed(1)), confidenceBand: band, fallbackReason, disagreementReason, productionDecisionUsed: false, routeIdentifier: safeString(input.routeId, "active-route"), activeRouteContextType: safeString(activeRouteContext?.routeContextType, "unknown"), activeRouteHasGeometry: routeCoordinates.length >= 2, activeRouteVertexCount: routeCoordinates.length, incidentIdentifier: incidentIdentifier(incident), midpointRelevanceResult: Boolean(midpoint.relevant), geometryRelevanceResult: Boolean(geometryRelevant), overlapPercentage: Number(overlapPercentage.toFixed(3)), corridor: corridorIdentifier(incident, input), scoringTimeMs: Number(scoringTimeMs.toFixed(3)), auditOnly: true };
    state.candidates.push(candidate); state.performance.scoringCount += 1; state.performance.totalScoringTimeMs += scoringTimeMs; state.performance.peakScoringTimeMs = Math.max(state.performance.peakScoringTimeMs, scoringTimeMs); state.performance.totalAuditOverheadMs += Math.max(0, nowMs() - auditStartedAt); return candidate;
  }
  function readRouteDetailsIncidentSource() { try { if (typeof globalScope.gridlyGetDestinationRouteActiveIncidentCandidates === "function") return globalScope.gridlyGetDestinationRouteActiveIncidentCandidates(); } catch (_error) { return null; } return null; }
  function readActiveIncidentSource(input = {}) { if (Array.isArray(input.incidents)) return { sourceName: "input.incidents", incidents: input.incidents, routeDetailsIncidentCount: null }; if (Array.isArray(input.activeIncidents)) return { sourceName: "input.activeIncidents", incidents: input.activeIncidents, routeDetailsIncidentCount: null }; const routeDetailsSource = readRouteDetailsIncidentSource(); if (Array.isArray(routeDetailsSource?.incidents)) return routeDetailsSource; if (Array.isArray(globalScope.__gridlyRouteWatchGeometryRuntimeShadowIncidents)) return { sourceName: "__gridlyRouteWatchGeometryRuntimeShadowIncidents", incidents: globalScope.__gridlyRouteWatchGeometryRuntimeShadowIncidents, routeDetailsIncidentCount: null }; return { sourceName: "none", incidents: [], routeDetailsIncidentCount: routeDetailsSource?.routeDetailsIncidentCount ?? null }; }
  function readActiveIncidents(input = {}) { return readActiveIncidentSource(input).incidents || []; }
  function recordExcludedIncident(incident, reason) { const key = `${incidentIdentifier(incident)}:${reason}`; if (state.excludedIncidentKeys.has(key)) return; state.excludedIncidentKeys.add(key); increment(state.exclusionReasons, reason); state.excludedIncidentCandidates.push({ incidentId: incidentIdentifier(incident), incidentType: incidentType(incident), reason }); }
  function scoreActiveRouteContextIncidents(input = {}) { const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) }; const auditDeadlineMs = nowMs() + Number(options.runtimeBudgetMs || DEFAULT_OPTIONS.runtimeBudgetMs); const activeRouteContext = readActiveRouteContext(input); const routeReason = activeRouteContextCandidateReason(activeRouteContext); const routeGeometry = readActiveRouteGeometry(activeRouteContext, input); if (routeReason !== "active_route_context_candidate_recorded" || routeGeometry.coordinates.length < 2) { increment(state.exclusionReasons, routeReason === "active_route_context_candidate_recorded" ? "active_route_geometry_unavailable_zero_scoring" : routeReason); return []; } return readActiveIncidents(input).flatMap((incident, index) => { const key = incidentIdentifier(incident); if (index >= Number(options.maxIncidentCandidates || DEFAULT_OPTIONS.maxIncidentCandidates)) { recordExcludedIncident(incident, "scoring_skipped_candidate_cap"); const skipped = buildSkippedCandidate({ ...input, incident, activeRouteContext }, "scoring_skipped_candidate_cap", { activeRouteHasGeometry: true, activeRouteVertexCount: Math.min(routeGeometry.coordinates.length, Number(options.maxRouteVerticesSampled || DEFAULT_OPTIONS.maxRouteVerticesSampled)) }); state.candidates.push(skipped); return [skipped]; } if (nowMs() >= auditDeadlineMs) { const skipped = buildSkippedCandidate({ ...input, incident, activeRouteContext }, "scoring_skipped_runtime_budget", { activeRouteHasGeometry: true, activeRouteVertexCount: routeGeometry.coordinates.length }); state.candidates.push(skipped); return [skipped]; } if (!incident || typeof incident !== "object") { recordExcludedIncident(incident, "scoring_skipped_invalid_candidate"); const skipped = buildSkippedCandidate({ ...input, incident: {}, activeRouteContext }, "scoring_skipped_invalid_candidate", { activeRouteHasGeometry: true, activeRouteVertexCount: routeGeometry.coordinates.length }); state.candidates.push(skipped); return [skipped]; } if (!isActiveIncident(incident)) { recordExcludedIncident(incident, "inactive_or_cleared_incident_excluded"); return []; } const incidentGeometry = readIncidentGeometry(incident); if (incidentGeometry.source === "invalid_coordinates") { recordExcludedIncident(incident, "invalid_coordinates_excluded"); const skipped = buildSkippedCandidate({ ...input, incident, activeRouteContext }, "scoring_skipped_geometry_unavailable", { activeRouteHasGeometry: true, activeRouteVertexCount: routeGeometry.coordinates.length }); state.candidates.push(skipped); return [skipped]; } if (state.scoredIncidentKeys.has(key)) return []; state.scoredIncidentKeys.add(key); return [scoreCandidate({ ...input, incident, routeGeometry: routeGeometry.geometry, activeRouteContext, auditDeadlineMs, options })]; }); }
  function summarize(input = {}) { const auditStartedAt = nowMs(); const options = { ...DEFAULT_OPTIONS, ...(input.options || {}) }; const emergencyDeadlineMs = auditStartedAt + Math.max(1, Number(options.runtimeBudgetMs || DEFAULT_OPTIONS.runtimeBudgetMs)); const activeIncidentSource = readActiveIncidentSource(input); if (nowMs() >= emergencyDeadlineMs) return buildFastReturnAuditPayload(input, activeIncidentSource, auditStartedAt, "audit_emergency_timeout_before_scoring"); if (isRouteDetailsIncidentSource(activeIncidentSource) && countRouteDetailsIncidents(activeIncidentSource) > 0) return buildFastReturnAuditPayload(input, activeIncidentSource, auditStartedAt, RUNTIME_SAFETY_SKIP_REASON); const auditInput = Array.isArray(input.incidents) || Array.isArray(input.activeIncidents) ? input : { ...input, activeIncidents: activeIncidentSource.incidents, auditDeadlineMs: emergencyDeadlineMs }; scoreActiveRouteContextIncidents(auditInput); const activeRouteContext = readActiveRouteContext(input); const activeRouteContextCandidate = buildActiveRouteContextShadowCandidate(activeRouteContext); const candidates = activeRouteContextCandidate ? state.candidates.concat(activeRouteContextCandidate) : state.candidates.slice(); const scoredCandidates = candidates.filter((candidate) => candidate.candidateSource !== "active_route_context"); const confidenceBandDistribution = {}; const overlapDistribution = {}; const disagreementReasons = {}; const routeOwnershipBreakdown = {}; candidates.forEach((candidate) => increment(routeOwnershipBreakdown, candidate.routeOwnership || "saved_route_watch_route")); scoredCandidates.forEach((candidate) => { increment(confidenceBandDistribution, candidate.confidenceBand); increment(overlapDistribution, bucketOverlap(candidate.overlapPercentage)); increment(disagreementReasons, candidate.disagreementReason); }); const scoringCount = Number(state.performance.scoringCount || 0); const averageScoringTimeMs = scoringCount > 0 ? state.performance.totalScoringTimeMs / scoringCount : 0; const peakScoringTimeMs = Number(state.performance.peakScoringTimeMs || 0); const totalAuditOverheadMs = Number(state.performance.totalAuditOverheadMs || 0); const mobileSafe = averageScoringTimeMs <= DEFAULT_OPTIONS.mobileAverageMsBudget && peakScoringTimeMs <= DEFAULT_OPTIONS.mobilePeakMsBudget; const performanceSafe = mobileSafe && totalAuditOverheadMs <= DEFAULT_OPTIONS.totalOverheadMsBudget; const activeRouteContextReason = activeRouteContextCandidateReason(activeRouteContext); const activeIncidents = (activeIncidentSource.incidents || []).filter(isActiveIncident); const activeIncidentCandidates = activeIncidents.length; const activeIncidentCandidateIds = activeIncidents.map(incidentIdentifier); const routeDetailsIncidentCount = Number.isFinite(Number(activeIncidentSource.routeDetailsIncidentCount)) ? Number(activeIncidentSource.routeDetailsIncidentCount) : activeIncidentCandidates;
    return { available: true, auditOnly: true, shadowModeOnly: true, productionBehaviorChanged: false, safeForProductionWiring: false, incidentSourceUsed: safeString(activeIncidentSource.sourceName, "none"), routeDetailsIncidentSourceDetected: activeIncidentSource.sourceName && activeIncidentSource.sourceName !== "none", routeDetailsIncidentCount, activeIncidentCandidateIds, excludedIncidentCandidates: state.excludedIncidentCandidates.slice(), excludedIncidentReasons: { ...state.exclusionReasons }, version: VERSION, evaluatedCandidates: scoredCandidates.length, activeRouteContextCandidateRecorded: Boolean(activeRouteContextCandidate), activeIncidentCandidates, scoredIncidentCandidates: scoredCandidates.length, midpointMatches: scoredCandidates.filter((c) => c.midpointRelevant).length, geometryMatches: scoredCandidates.filter((c) => c.geometryRelevant).length, midpointOnlyMatches: scoredCandidates.filter((c) => c.midpointRelevant && !c.geometryRelevant).length, geometryOnlyMatches: scoredCandidates.filter((c) => !c.midpointRelevant && c.geometryRelevant).length, disagreementCount: scoredCandidates.filter((c) => c.midpointRelevant !== c.geometryRelevant).length, confidenceBandDistribution, overlapDistribution, disagreementReasons, routeOwnershipBreakdown, zeroScoringReasons: { ...state.exclusionReasons, ...(activeIncidentCandidates === 0 && routeDetailsIncidentCount === 0 ? { no_active_incidents: 1 } : {}) }, activeRouteContext, observationScope: { activeRouteContextCandidateRecorded: Boolean(activeRouteContextCandidate), activeRouteContextCandidateReason: activeRouteContextReason, activeRouteContextType: safeString(activeRouteContext?.routeContextType, "unknown"), activeRouteHasGeometry: Boolean(activeRouteContext?.hasGeometry), activeRouteVertexCount: Number(activeRouteContext?.vertexCount || 0) }, performance: { scoringCount, averageScoringTimeMs: Number(averageScoringTimeMs.toFixed(3)), peakScoringTimeMs: Number(peakScoringTimeMs.toFixed(3)), totalAuditOverheadMs: Number(totalAuditOverheadMs.toFixed(3)), mobileSafe, performanceSafe }, scoringCount, averageScoringTimeMs: Number(averageScoringTimeMs.toFixed(3)), peakScoringTimeMs: Number(peakScoringTimeMs.toFixed(3)), totalAuditOverheadMs: Number(totalAuditOverheadMs.toFixed(3)), mobileSafe, performanceSafe, safetyVerification: { noUiChanges: true, noRouteWatchOutputChanges: true, noAlertChanges: true, noPopupChanges: true, noMarkerChanges: true, noAwarenessChanges: true, noSupabaseWrites: true, noNotificationBehavior: true }, browserSafeValidationGuidance: buildBrowserSafeValidationGuidance(), scoringSkipped: false, scoringSkipReason: null, candidates };
  }
  globalScope.gridlyRouteWatchGeometryRuntimeShadowState = state;
  globalScope.gridlyRecordRouteWatchGeometryRuntimeShadowCandidate = scoreCandidate;
  globalScope.gridlyScoreActiveRouteContextGeometryShadow = scoreActiveRouteContextIncidents;
  globalScope.gridlyRouteWatchGeometryRuntimeShadowAudit = summarize;
  globalScope.gridlyResetRouteWatchGeometryRuntimeShadowAudit = function gridlyResetRouteWatchGeometryRuntimeShadowAudit() { state.candidates = []; state.performance.scoringCount = 0; state.performance.totalScoringTimeMs = 0; state.performance.peakScoringTimeMs = 0; state.performance.totalAuditOverheadMs = 0; state.exclusionReasons = {}; state.excludedIncidentCandidates = []; state.scoredIncidentKeys = new Set(); state.excludedIncidentKeys = new Set(); return summarize(); };
})(typeof window !== "undefined" ? window : globalThis);
