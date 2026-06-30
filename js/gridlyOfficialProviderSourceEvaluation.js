(function initGridlyOfficialProviderSourceEvaluation(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const certification = Object.freeze({
    audit: "Official Provider Source Evaluation",
    milestone: "V836",
    driveTexasSourceCertified: true,
    weatherSourceCertified: true,
    runtimeIntegrationPerformed: false,
    providerActivationPerformed: false,
    connectorImplementationRequired: true,
    readyForConnectorMilestone: true,
    sourceCertificationPresent: true,
    runtimeConnected: false,
    providersRemainDormant: true,
    activationPerformed: false,
    renderingPerformed: false,
    protectedSystemsModified: false,
    driveTexas: Object.freeze({
      sourceRecommended: "TxDOT DriveTexas / TxDOT ITS road-condition and travel-impact services",
      officialOwner: "Texas Department of Transportation (TxDOT)",
      confidence: "High",
      integrationComplexity: "Medium",
      accessMethod: "Official REST / GeoJSON / ArcGIS Feature Service candidate; exact endpoint must be revalidated during connector milestone",
      authenticationRequirements: "Unconfirmed for connector; do not place credentials in browser runtime",
      geographicCoverage: "Texas statewide roadway and traveler-information coverage",
      normalizedCategories: Object.freeze(["Road Closure", "Flooding", "Construction", "Lane Closure", "Crash", "Bridge Restriction", "Travel Advisory"]),
      operationalRisks: Object.freeze(["endpoint shape must be reverified", "usage terms must be reviewed", "statewide records require Gridly spatial filtering"])
    }),
    weather: Object.freeze({
      sourceRecommended: "National Weather Service CAP / api.weather.gov active alerts",
      officialOwner: "NOAA National Weather Service (NWS)",
      confidence: "Very High",
      integrationComplexity: "Low-to-Medium",
      accessMethod: "REST JSON-LD active alerts and CAP v1.2 products",
      authenticationRequirements: "No API key expected; descriptive User-Agent/contact required by connector policy",
      geographicCoverage: "United States NWS alert coverage filtered to Gridly Texas communities",
      normalizedCategories: Object.freeze(["Flash Flood Warning", "Flood Warning", "Severe Thunderstorm Warning", "Tornado Warning", "Tropical Storm", "Hurricane", "Dense Fog", "High Wind", "Winter Weather", "Extreme Heat", "Fire Weather", "Air Quality"]),
      operationalRisks: Object.freeze(["cache-aware polling required", "county/zone geometry normalization required", "watches/advisories must not be over-promoted"])
    }),
    connectorRequirements: Object.freeze({
      refreshCadence: "DriveTexas 2-5 minutes; Weather 60-120 seconds or cache expiry, whichever is slower",
      timeoutPolicy: "4 second timeout with empty normalized set on timeout",
      retryPolicy: "single jittered retry for transient network/5xx failures only",
      failClosedBehavior: "no stale/partial official records rendered; existing community awareness behavior preserved",
      normalizationResponsibility: "connector owns raw-to-normalized mapping, source trace, spatial filtering, and raw payload suppression",
      providerOwnershipBoundaries: "providers supply normalized read-only records only and do not own UI, trust, lifecycle, alerts, route watch, notifications, Supabase, or community reports"
    })
  });

  function providerDormant(provider) {
    if (!provider || typeof provider.getRuntimeState !== "function") return true;
    const state = provider.getRuntimeState();
    return Boolean(state && state.enabled === false && state.connected === false && state.recordCount === 0);
  }

  function buildAudit() {
    const driveTexasDormant = providerDormant(globalScope.gridlyDriveTexasProvider);
    const weatherDormant = providerDormant(globalScope.gridlyWeatherProvider);
    return Object.freeze(Object.assign({}, certification, {
      driveTexasProviderDormant: driveTexasDormant,
      weatherProviderDormant: weatherDormant,
      providersRemainDormant: Boolean(driveTexasDormant && weatherDormant),
      validationPassed: Boolean(
        certification.driveTexasSourceCertified
        && certification.weatherSourceCertified
        && certification.runtimeIntegrationPerformed === false
        && certification.providerActivationPerformed === false
        && certification.connectorImplementationRequired === true
        && certification.readyForConnectorMilestone === true
        && driveTexasDormant
        && weatherDormant
      )
    }));
  }

  globalScope.gridlyOfficialProviderSourceAudit = function gridlyOfficialProviderSourceAudit() {
    return buildAudit();
  };
})(typeof window !== "undefined" ? window : globalThis);
