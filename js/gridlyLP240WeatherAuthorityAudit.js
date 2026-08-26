(function initGridlyLP240WeatherAuthorityAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const freeze = (value) => value && typeof value === "object" ? Object.freeze(value) : value;
  const count = (value) => Array.isArray(value) ? value.length : Math.max(0, Number(value) || 0);
  const text = (value) => String(value == null ? "" : value).replace(/\s+/g, " ").trim();

  function classifyWeatherAuthority(input = {}) {
    const sourceConfigured = input.sourceConfigured === true;
    const sourceRequestAttempted = input.sourceRequestAttempted === true;
    const sourceRequestSucceeded = input.sourceRequestSucceeded === true;
    const sourceHealthy = input.sourceHealthy === true;
    const sourceFreshEnough = input.sourceFreshEnough === true;
    const canonicalGeographyResolved = input.canonicalGeographyResolved === true;
    const geographyAgreementPass = input.geographyAgreementPass === true;
    const currentApplicableCount = count(input.currentApplicableCount);
    const presentationCount = count(input.presentationCount);
    const presentationEmptyState = text(input.presentationEmptyState);
    const claimsQuiet = presentationCount === 0 && /no active weather alerts/i.test(presentationEmptyState);
    let weatherAuthorityState = "UNAVAILABLE";
    let authorityReason = "Weather authority has not established source and geographic availability.";
    let firstLosingStage = "SOURCE_CONFIGURATION";

    if (!sourceConfigured) authorityReason = "Weather source is not configured or activated.";
    else if (!sourceRequestAttempted) {
      authorityReason = "Weather source has not been requested for this runtime context.";
      firstLosingStage = "SOURCE_REQUEST";
    } else if (!sourceRequestSucceeded || !sourceHealthy) {
      authorityReason = text(input.sourceError) || "Weather source request failed or is unhealthy.";
      firstLosingStage = "SOURCE_HEALTH";
    } else if (!sourceFreshEnough) {
      authorityReason = "Weather source evidence is not fresh enough for authority.";
      firstLosingStage = "SOURCE_FRESHNESS";
    } else if (!canonicalGeographyResolved || !geographyAgreementPass) {
      authorityReason = "Provider geography is not authoritatively associated with the selected governed geography.";
      firstLosingStage = "GOVERNED_GEOGRAPHY";
    } else if (currentApplicableCount > 0) {
      weatherAuthorityState = "ACTIVE";
      authorityReason = `${currentApplicableCount} current applicable weather alert${currentApplicableCount === 1 ? "" : "s"} survived authority selection.`;
      firstLosingStage = null;
    } else {
      weatherAuthorityState = "QUIET";
      authorityReason = "A healthy source successfully evaluated the governed geography with zero current applicable weather alerts.";
      firstLosingStage = null;
    }

    const quietProven = weatherAuthorityState === "QUIET";
    const presentationAgreementPass = weatherAuthorityState === "ACTIVE"
      ? presentationCount === currentApplicableCount && !claimsQuiet
      : weatherAuthorityState === "QUIET"
        ? presentationCount === 0 && claimsQuiet
        : !claimsQuiet;
    return freeze({
      weatherAuthorityState,
      authorityReason,
      firstLosingStage,
      quietProven,
      unavailableReason: weatherAuthorityState === "UNAVAILABLE" ? authorityReason : null,
      presentationAgreementPass
    });
  }

  function safeCall(fn) {
    try { return typeof fn === "function" ? fn() : null; } catch (error) { return { auditError: text(error?.message || error) }; }
  }

  function getWeatherAuthorityEnvelope(options = {}) {
    const provider = options.provider || globalScope.gridlyWeatherProvider || null;
    const providerRuntime = options.providerRuntime || safeCall(provider?.getRuntimeState) || {};
    const connectorRuntime = options.connectorRuntime || safeCall(globalScope.gridlyWeatherConnectorRuntimeAudit) || {};
    const snapshot = options.snapshot || safeCall(globalScope.gridlyGetWeatherAuthoritySnapshot) || {};
    const now = Number(options.now) || Date.now();
    const freshnessLimitMs = Math.max(1, Number(connectorRuntime.refreshIntervalMs) || 120000) * 2;
    const lastSuccessMs = Date.parse(connectorRuntime.lastSuccessAt || "");
    const freshEnoughForAuthority = connectorRuntime.requestSucceeded === true
      && Number.isFinite(lastSuccessMs) && now - lastSuccessMs >= 0 && now - lastSuccessMs <= freshnessLimitMs;
    const selected = options.selected || safeCall(globalScope.getGridlySelectedAwarenessArea) || null;
    const canonical = options.canonical || safeCall(globalScope.gridlyGetCanonicalActiveCommunityState) || {};
    const canonicalGeographyResolved = Boolean(selected && (canonical.community || selected.storageValue || selected.label)
      && (canonical.countyId || selected.countyId));
    // The current centroid/radius and locality-text filters are useful
    // selection heuristics, but are not certified governed PLACE intersection.
    const geographyAgreementPass = options.geographyAgreementPass === true;
    return freeze({
      configured: providerRuntime.enabled === true,
      enabled: providerRuntime.enabled === true,
      requestAttempted: connectorRuntime.requestAttempted === true,
      requestSucceeded: connectorRuntime.requestSucceeded === true,
      lastAttemptAt: connectorRuntime.lastRequestAt || null,
      lastSuccessAt: connectorRuntime.lastSuccessAt || null,
      lastFailureAt: connectorRuntime.lastFailureAt || null,
      error: providerRuntime.lastError || connectorRuntime.lastError || null,
      healthy: providerRuntime.enabled === true && connectorRuntime.requestSucceeded === true && connectorRuntime.connected === true && !connectorRuntime.lastError,
      freshEnoughForAuthority,
      freshness: freshEnoughForAuthority ? "FRESH" : (connectorRuntime.lastSuccessAt ? "STALE" : "UNKNOWN"),
      canonicalGeographyResolved,
      geographyAgreementPass,
      geographyEvaluation: geographyAgreementPass ? "GOVERNED_AGREEMENT_PROVEN" : "UNSUPPORTED_OR_UNRESOLVED",
      currentApplicableCount: Number(snapshot.authorityEligibleRecordCount || 0)
    });
  }

  function geometryType(record) {
    const value = record?.geometry || record?.__geometry || record?.alertGeometry || null;
    return value?.type === "Polygon" || value?.type === "MultiPolygon" ? value.type : (record?.geographyAudit?.geometryType || null);
  }

  function affectedZones(record) {
    const value = record?.affectedZones || record?.zones || record?.geography?.affectedZones || record?.geographyAudit?.affectedZones;
    return Array.isArray(value) ? value.filter((zone) => typeof zone === "string" && zone.trim()) : [];
  }

  function rings(geometry) {
    if (geometry?.type === "Polygon") return [geometry.coordinates?.[0]].filter(Array.isArray);
    if (geometry?.type === "MultiPolygon") return (geometry.coordinates || []).map((polygon) => polygon?.[0]).filter(Array.isArray);
    return [];
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
      if (((yi > point[1]) !== (yj > point[1])) && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function orientation(a, b, c) { return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])); }
  function segmentsIntersect(a, b, c, d) {
    return orientation(a, b, c) !== orientation(a, b, d) && orientation(c, d, a) !== orientation(c, d, b);
  }
  function ringIntersects(a, b) {
    if (a.some((point) => pointInRing(point, b)) || b.some((point) => pointInRing(point, a))) return true;
    for (let i = 1; i < a.length; i += 1) for (let j = 1; j < b.length; j += 1) if (segmentsIntersect(a[i - 1], a[i], b[j - 1], b[j])) return true;
    return false;
  }
  function geometriesIntersect(a, b) { return rings(a).some((left) => rings(b).some((right) => ringIntersects(left, right))); }

  // Audit-only capability evaluator. It never promotes records or changes Weather state.
  function evaluatePlaceAlertGeography({ placeGeometry, alerts = [], zoneGeometries = {} } = {}) {
    const applicableAlertIds = []; const unresolvedAlertIds = []; let evaluatedCount = 0;
    for (const [index, alert] of alerts.entries()) {
      const id = text(alert?.id || alert?.identifier) || `alert-${index}`;
      const explicit = alert?.geometry || alert?.__geometry || null;
      if (geometryType({ geometry: explicit }) && rings(placeGeometry).length) {
        evaluatedCount += 1;
        if (geometriesIntersect(placeGeometry, explicit)) applicableAlertIds.push(id);
        continue;
      }
      const resolved = affectedZones(alert).map((zone) => zoneGeometries[zone]).filter((geometry) => rings(geometry).length);
      if (resolved.length && rings(placeGeometry).length) {
        evaluatedCount += 1;
        if (resolved.some((geometry) => geometriesIntersect(placeGeometry, geometry))) applicableAlertIds.push(id);
      } else unresolvedAlertIds.push(id);
    }
    return freeze({ placeAlertIntersectionEvaluated: evaluatedCount > 0, placeAlertIntersectionCount: evaluatedCount, applicableAlertIds: freeze(applicableAlertIds), unresolvedAlertIds: freeze(unresolvedAlertIds) });
  }

  function auditRuntime() {
    const provider = globalScope.gridlyWeatherProvider || null;
    const connector = globalScope.gridlyWeatherConnector || null;
    const providerRuntime = safeCall(provider?.getRuntimeState) || {};
    const providerAudit = safeCall(globalScope.gridlyWeatherProviderAudit) || {};
    const connectorAudit = safeCall(globalScope.gridlyWeatherConnectorRuntimeAudit) || {};
    const snapshot = safeCall(globalScope.gridlyGetWeatherAuthoritySnapshot) || {};
    const consumer = safeCall(globalScope.gridlySelectConsumerVisibleWeatherSituations) || {};
    const alertsAudit = safeCall(globalScope.gridlyLP236AlertsInformationArchitectureAudit) || {};
    const canonical = safeCall(globalScope.gridlyGetCanonicalActiveCommunityState) || {};
    const selected = safeCall(globalScope.getGridlySelectedAwarenessArea) || canonical.selectedAwarenessArea || null;
    const providerRecords = safeCall(provider?.getNormalizedRecords) || [];
    const canonicalCommunity = canonical.community || selected?.storageValue || selected?.label || snapshot.activeCommunity || null;
    const resolvedPlaceId = safeCall(() => globalScope.gridlyResolveCanonicalPlaceGeoid?.(selected)) || null;
    const canonicalPlaceId = canonical.canonicalPlaceId || canonical.placeId || selected?.canonicalPlaceId || selected?.placeId || resolvedPlaceId || null;
    const membership = canonicalPlaceId ? safeCall(() => globalScope.gridlyCanonicalCrossingRuntime?.lookup?.({ placeGeoid: canonicalPlaceId })) : null;
    const governedFips = [...(membership?.governedCountyFips || selected?.countyMemberships || [])];
    const countyRegistry = globalScope.GRIDLY_COUNTY_REGISTRY || {};
    const governedMemberships = freeze(governedFips.map((fips) => Object.entries(countyRegistry).find(([, county]) => String(county?.countyFips || "") === String(fips))?.[0] || fips));
    const selectedGovernedMembership = canonical.authoritativeMembership || canonical.membership || selected?.countyId || null;

    const connectorRecords = safeCall(connector?.getNormalizedRecords) || [];
    const weatherDom = globalScope.document?.querySelector?.('[data-gridly-lp236-source="weather"]') || null;
    const presentationCount = Number(weatherDom?.dataset?.gridlyLp236Count ?? alertsAudit.weatherRenderedCount ?? 0) || 0;
    const presentationText = text(weatherDom?.textContent);
    const envelope = getWeatherAuthorityEnvelope({ provider, providerRuntime, connectorRuntime: connectorAudit, snapshot, selected, canonical });
    const sourceConfigured = envelope.configured;
    const sourceRequestAttempted = envelope.requestAttempted;
    const sourceRequestSucceeded = envelope.requestSucceeded;
    const sourceHealthy = envelope.healthy;
    const canonicalGeographyResolved = envelope.canonicalGeographyResolved;
    const geographyAgreementPass = envelope.geographyAgreementPass;
    const currentApplicableCount = Number(envelope.currentApplicableCount ?? consumer.consumerVisibleSituationCount ?? 0) || 0;
    const classification = classifyWeatherAuthority({
      sourceConfigured, sourceRequestAttempted, sourceRequestSucceeded, sourceHealthy,
      sourceFreshEnough: envelope.freshEnoughForAuthority,
      sourceError: providerRuntime.lastError || connectorAudit.auditError || null,
      canonicalGeographyResolved, geographyAgreementPass, currentApplicableCount,
      presentationCount, presentationEmptyState: presentationText
    });
    const alertsWeatherInputCount = Number(alertsAudit.weatherInputCount || 0);
    const alertsWeatherPublishedCount = Number(alertsAudit.weatherConditionCount ?? alertsWeatherInputCount) || 0;
    const result = {
      available: true,
      auditOnly: true,
      canonicalCommunity,
      canonicalPlaceId,
      canonicalPlaceResolved: Boolean(canonicalPlaceId && membership),
      canonicalPlaceResolutionSource: canonicalPlaceId ? (resolvedPlaceId === canonicalPlaceId ? "LP239_LIVE_CANONICAL_PLACE_REGISTRY_RESOLVER" : "EXPLICIT_SELECTED_CANONICAL_PLACE_ID") : null,
      governedMembership: selectedGovernedMembership,
      governedMemberships,
      selectedGovernedMembership,
      canonicalPlaceGeometryAvailable: false,
      canonicalPlaceGeometrySource: null,
      canonicalPlaceGeometryType: null,
      canonicalPlaceGeometryFeatureId: null,
      canonicalPlaceGeometryValid: false,
      canonicalPlaceCount: 1859,
      placeGeometryAvailableCount: 0,
      placeGeometryMissingCount: 1859,
      invalidPlaceGeometryCount: 0,
      singleCountyPlaceCount: 1696,
      multiCountyPlaceCount: 163,
      activeCounty: canonical.countyId || selected?.countyId || snapshot.activeCounty || null,
      awarenessArea: selected || snapshot.selectedAwarenessArea || null,
      weatherProvider: provider?.name || providerAudit.provider || "Weather / NWS api.weather.gov",
      sourceConfigured,
      sourceRequestAttempted,
      sourceRequestSucceeded,
      sourceHealthy,
      sourceFreshness: envelope.freshness,
      sourceFreshEnough: envelope.freshEnoughForAuthority,
      sourceLastAttemptAt: envelope.lastAttemptAt,
      sourceLastSuccessAt: envelope.lastSuccessAt,
      sourceLastFailureAt: envelope.lastFailureAt,
      sourceError: providerRuntime.lastError || connectorAudit.auditError || null,
      providerGeographyType: "Texas statewide NWS active-alert feed; record centroid/radius or locality-text runtime filter",
      providerGeographyValue: globalScope.GRIDLY_CONFIG?.weather?.endpointTemplate || "https://api.weather.gov/alerts/active?area=TX",
      canonicalGeographyResolved,
      geographyAgreementPass,
      nwsRawAlertCount: Number(snapshot.rawRecordCount ?? providerRecords.length) || 0,
      nwsAlertsWithGeometryCount: providerRecords.filter((record) => geometryType(record)).length,
      nwsAlertsWithoutGeometryCount: providerRecords.filter((record) => !geometryType(record)).length,
      nwsAlertsWithAffectedZonesCount: providerRecords.filter((record) => affectedZones(record).length).length,
      nwsZoneResolutionAvailable: false,
      weatherGeographyEvaluationMode: "UNSUPPORTED",
      legacyRadiusTextMatchUsed: false,
      legacyRadiusTextAuthoritative: false,
      placeAlertIntersectionEvaluated: false,
      placeAlertIntersectionCount: 0,
      applicableAlertIds: freeze([]),
      unresolvedAlertIds: freeze(providerRecords.map((record, index) => text(record?.id) || `alert-${index}`)),
      geographyAuthorityReason: "Canonical PLACE polygons and NWS zone geometries are not present in the runtime; centroid/radius and free text are non-authoritative.",
      firstGeographyLosingStage: canonicalPlaceId ? "PLACE_GEOMETRY" : "CANONICAL_PLACE_IDENTITY",
      rawWeatherRecordCount: Number(snapshot.rawRecordCount ?? providerRecords.length) || 0,
      normalizedWeatherRecordCount: Number(snapshot.uniqueProviderRecordCount ?? providerRecords.length) || 0,
      geographicallyApplicableCount: Number(snapshot.authorityEligibleRecordCount ?? connectorRecords.length) || 0,
      currentApplicableCount,
      alertsWeatherInputCount,
      alertsWeatherPublishedCount,
      alertsWeatherDisplayedCount: presentationCount,
      ...classification,
      presentationCount,
      presentationEmptyState: presentationText || null,
      presentationText: presentationText || null,
      overallPass: classification.presentationAgreementPass
    };
    return freeze(result);
  }

  globalScope.gridlyLP240ClassifyWeatherAuthority = classifyWeatherAuthority;
  globalScope.gridlyGetWeatherRuntimeAuthorityEnvelope = getWeatherAuthorityEnvelope;
  globalScope.gridlyLP240WeatherAuthorityAudit = auditRuntime;
  if (typeof module !== "undefined" && module.exports) module.exports = freeze({ classifyWeatherAuthority, getWeatherAuthorityEnvelope, evaluatePlaceAlertGeography, geometriesIntersect, auditRuntime });
})(typeof window !== "undefined" ? window : globalThis);
