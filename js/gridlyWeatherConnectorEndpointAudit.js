(function initGridlyWeatherConnectorEndpointAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const AUDIT_NAME = "V838 Weather Connector Endpoint Validation";
  const OFFICIAL_ENDPOINTS = Object.freeze([
    Object.freeze({
      name: "NWS active alerts API",
      url: "https://api.weather.gov/alerts/active?area={state}",
      type: "HTTPS REST API alert collection endpoint",
      method: "GET",
      responseFormat: "GeoJSON / JSON-LD FeatureCollection by default; alternate application/geo+json, application/ld+json, application/atom+xml, and application/cap+xml representations are documented for alerts.",
      authentication: "No API key or OAuth credential required; future connector must send an identifying User-Agent / contact header per NWS API guidance.",
      usageGuidance: "Use the official api.weather.gov alerts endpoints for active NWS watches, warnings, advisories, and similar CAP products; apply area, zone, point, or bounding-box filters before normalization.",
      cacheExpectation: "Cache-friendly service with HTTP cache headers; future connector must honor response expiration and avoid polling faster than the alert lifecycle requires.",
      updateFrequency: "Event-driven active alert feed; no fixed polling interval is certified in V838, so future activation must use conservative refresh cadence and HTTP cache metadata.",
      availability: "Operational NWS public API endpoint; connector must fail closed when endpoint availability, cache freshness, schema, source attribution, or policy validation fails."
    }),
    Object.freeze({
      name: "NWS active alerts Atom/CAP feed",
      url: "https://api.weather.gov/alerts/active.atom?area={state}",
      type: "HTTPS Atom index with links to CAP v1.2 alert products",
      method: "GET",
      responseFormat: "Atom feed index; linked products may be retrieved as CAP v1.2 XML when a later networking milestone authorizes it.",
      authentication: "No API key or OAuth credential required; future connector must send an identifying User-Agent / contact header per NWS API guidance.",
      usageGuidance: "Use only as a CAP-compatible alternate/source-verification path for the same official NWS alert products, not as a separate provider activation.",
      cacheExpectation: "Honor HTTP cache metadata and CAP product lifecycle; do not perform live requests in V838.",
      updateFrequency: "Event-driven active alert index; no fixed polling interval is certified in V838.",
      availability: "Official NWS CAP dissemination path through api.weather.gov; connector must fail closed if Atom or CAP parsing cannot be validated."
    })
  ]);

  const SUPPORTED_EVENTS = Object.freeze({
    flashFloodWarning: true,
    floodWarning: true,
    severeThunderstormWarning: true,
    tornadoWarning: true,
    tropicalStorm: true,
    hurricane: true,
    denseFog: true,
    highWind: true,
    winterWeather: true,
    extremeHeat: true,
    fireWeather: true,
    airQuality: true
  });

  const CONNECTOR_SPEC = Object.freeze({
    requestMethod: "GET",
    timeoutMs: 8000,
    retryPolicy: "At most one retry for transient 5xx, 429, or network timeout responses with jittered backoff; no retry for 4xx validation, policy, schema, or unsupported-content failures.",
    cacheExpectation: "Honor NWS HTTP cache headers and retain only short-lived connector cache entries scoped to active alerts; V838 itself performs no networking and creates no cache.",
    normalizationResponsibility: "Future connector maps NWS alert Feature properties / CAP info blocks into Gridly weather awareness records while keeping raw payloads out of consumer UI.",
    sourceTracing: "Every normalized record must retain NWS provider name, endpoint URL family, alert id, event, sent/effective/onset/expires timestamps, geometry source, and retrieval timestamp.",
    spatialFiltering: "Filter by state, zone, point, or bounding box before downstream normalization; intersect alert geometry / affected zones with Gridly coverage areas before emitting records.",
    failClosedBehavior: "Return zero weather records and preserve dormant provider state when networking is disabled, endpoint validation fails, schema changes, cache is stale, spatial filtering is uncertain, or provider activation is not explicitly authorized."
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  globalScope.gridlyWeatherConnectorEndpointReference = Object.freeze({
    milestone: "V838",
    endpointDocumented: true,
    endpointValidated: true,
    authenticationKnown: true,
    endpoints: OFFICIAL_ENDPOINTS,
    supportedEvents: SUPPORTED_EVENTS,
    connectorSpecification: CONNECTOR_SPEC,
    runtimeNetworkingPerformed: false,
    providerActivated: false,
    futureConnectorMilestoneRequired: true
  });

  globalScope.gridlyWeatherConnectorEndpointAudit = function gridlyWeatherConnectorEndpointAudit() {
    const runtime = typeof globalScope.gridlyWeatherProvider?.getRuntimeState === "function"
      ? globalScope.gridlyWeatherProvider.getRuntimeState()
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
      endpoints: clone(OFFICIAL_ENDPOINTS),
      supportedEvents: clone(SUPPORTED_EVENTS),
      connectorSpecification: clone(CONNECTOR_SPEC)
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyWeatherConnectorEndpointReference;
  }
})(typeof window !== "undefined" ? window : globalThis);
