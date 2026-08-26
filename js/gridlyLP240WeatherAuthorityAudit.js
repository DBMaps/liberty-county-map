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
    const connectorRecords = safeCall(connector?.getNormalizedRecords) || [];
    const weatherDom = globalScope.document?.querySelector?.('[data-gridly-lp236-source="weather"]') || null;
    const presentationCount = Number(weatherDom?.dataset?.gridlyLp236Count ?? alertsAudit.weatherRenderedCount ?? 0) || 0;
    const presentationText = text(weatherDom?.textContent);
    const sourceConfigured = providerRuntime.enabled === true;
    const sourceRequestAttempted = connectorAudit.providerActivated === true || connectorAudit.automaticPolling === true || connectorAudit.connected === true;
    const sourceRequestSucceeded = connectorAudit.connected === true;
    const sourceHealthy = sourceConfigured && sourceRequestSucceeded && providerAudit.runtimeHealthy === true;
    const canonicalGeographyResolved = Boolean(selected && (canonical.community || selected.storageValue || selected.label) && (canonical.countyId || selected.countyId));
    // Production filtering is radius/centroid or free-text matching.  It does
    // not intersect NWS polygons/zones with certified canonical PLACE geometry.
    const geographyAgreementPass = false;
    const currentApplicableCount = Number(snapshot.authorityEligibleRecordCount ?? consumer.consumerVisibleSituationCount ?? 0) || 0;
    const classification = classifyWeatherAuthority({
      sourceConfigured, sourceRequestAttempted, sourceRequestSucceeded, sourceHealthy,
      sourceError: providerRuntime.lastError || connectorAudit.auditError || null,
      canonicalGeographyResolved, geographyAgreementPass, currentApplicableCount,
      presentationCount, presentationEmptyState: presentationText
    });
    const alertsWeatherInputCount = Number(alertsAudit.weatherInputCount || 0);
    const alertsWeatherPublishedCount = Number(alertsAudit.weatherConditionCount ?? alertsWeatherInputCount) || 0;
    const result = {
      available: true,
      auditOnly: true,
      canonicalCommunity: canonical.community || selected?.storageValue || selected?.label || snapshot.activeCommunity || null,
      canonicalPlaceId: canonical.canonicalPlaceId || canonical.placeId || selected?.canonicalPlaceId || selected?.placeId || null,
      governedMembership: canonical.authoritativeMembership || canonical.membership || null,
      activeCounty: canonical.countyId || selected?.countyId || snapshot.activeCounty || null,
      awarenessArea: selected || snapshot.selectedAwarenessArea || null,
      weatherProvider: provider?.name || providerAudit.provider || "Weather / NWS api.weather.gov",
      sourceConfigured,
      sourceRequestAttempted,
      sourceRequestSucceeded,
      sourceHealthy,
      sourceError: providerRuntime.lastError || connectorAudit.auditError || null,
      providerGeographyType: "Texas statewide NWS active-alert feed; record centroid/radius or locality-text runtime filter",
      providerGeographyValue: globalScope.GRIDLY_CONFIG?.weather?.endpointTemplate || "https://api.weather.gov/alerts/active?area=TX",
      canonicalGeographyResolved,
      geographyAgreementPass,
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
      overallPass: classification.presentationAgreementPass && classification.weatherAuthorityState !== "UNAVAILABLE"
    };
    return freeze(result);
  }

  globalScope.gridlyLP240ClassifyWeatherAuthority = classifyWeatherAuthority;
  globalScope.gridlyLP240WeatherAuthorityAudit = auditRuntime;
  if (typeof module !== "undefined" && module.exports) module.exports = freeze({ classifyWeatherAuthority, auditRuntime });
})(typeof window !== "undefined" ? window : globalThis);
