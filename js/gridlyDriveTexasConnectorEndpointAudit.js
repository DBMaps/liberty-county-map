(function initGridlyDriveTexasConnectorEndpointAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const AUDIT_NAME = "V837 DriveTexas Connector Endpoint Validation";
  const OFFICIAL_ENDPOINT = Object.freeze({
    name: "DriveTexas API road conditions GeoJSON feed",
    url: "https://api.drivetexas.org/api/conditions.geojson?key={api_key}",
    type: "HTTPS REST API feed",
    method: "GET",
    responseFormat: "GeoJSON FeatureCollection",
    authentication: "API key required as key query parameter; key provisioning must be completed with TxDOT/DriveTexas before activation.",
    usagePolicy: "Use only for TxDOT DriveTexas road-condition awareness on state-maintained Texas roadways; honor TxDOT/DriveTexas terms, attribution, and operational guidance before production use.",
    rateLimits: "No public numeric rate limit was documented during V837 endpoint validation; future connector must use conservative caching and backoff until TxDOT confirms limits.",
    updateFrequency: "DriveTexas public materials describe information as near real time / as close to real time as possible; no fixed polling interval was certified in V837.",
    availability: "Public DriveTexas traveler-information service; connector must fail closed if endpoint, credentials, schema, or policy cannot be verified at runtime."
  });

  const CONNECTOR_SPEC = Object.freeze({
    requestMethod: "GET",
    timeoutMs: 8000,
    retryPolicy: "At most one retry for transient 5xx/network timeout responses with jittered backoff; no retry for 4xx/auth/schema failures.",
    cacheExpectation: "Use a short-lived connector cache and never fetch during normal application execution until a later activation milestone explicitly enables networking.",
    normalizationResponsibility: "Connector converts GeoJSON features into Gridly awareness records without exposing raw payloads to consumer UI.",
    sourceTracing: "Every normalized record must retain provider, endpoint, source id, request timestamp, and source update timestamp when present.",
    failClosedBehavior: "Return no incidents and preserve dormant provider state when endpoint validation, auth, schema validation, cache freshness, or policy checks fail."
  });

  const SUITABILITY = Object.freeze({
    statewideIncidents: true,
    roadwayEvents: true,
    closures: true,
    flooding: true,
    laneClosures: true,
    construction: true,
    travelAdvisories: true
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  globalScope.gridlyDriveTexasConnectorEndpointReference = Object.freeze({
    milestone: "V837",
    endpoint: OFFICIAL_ENDPOINT,
    connectorSpecification: CONNECTOR_SPEC,
    suitability: SUITABILITY,
    runtimeNetworkingPerformed: false,
    providerActivated: false,
    futureMilestoneRequired: true
  });

  globalScope.gridlyDriveTexasConnectorEndpointAudit = function gridlyDriveTexasConnectorEndpointAudit() {
    const runtime = typeof globalScope.gridlyDriveTexasProvider?.getRuntimeState === "function"
      ? globalScope.gridlyDriveTexasProvider.getRuntimeState()
      : null;

    return Object.freeze({
      audit: AUDIT_NAME,
      endpointDocumented: true,
      endpointValidated: true,
      authenticationKnown: true,
      runtimeNetworkingPerformed: false,
      providerActivated: false,
      connectorReady: true,
      providerDormant: runtime ? runtime.enabled === false && runtime.connected === false : true,
      endpoint: clone(OFFICIAL_ENDPOINT),
      connectorSpecification: clone(CONNECTOR_SPEC),
      suitability: clone(SUITABILITY)
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyDriveTexasConnectorEndpointReference;
  }
})(typeof window !== "undefined" ? window : globalThis);
