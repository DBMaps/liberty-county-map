(function initializeGridlyGeocodingClient(global) {
  "use strict";

  const endpoint = "https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-geocode";
  const publicKey = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";
  const evidence = [];
  let directProviderRequestCount = 0;
  const record = (event, details = {}) => {
    evidence.push(Object.freeze({ event, at: Date.now(), queryRedacted: true, ...details }));
    if (evidence.length > 80) evidence.shift();
  };
  if (typeof global.PerformanceObserver === "function") {
    try {
      const observer = new global.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!String(entry.name || "").includes("nominatim.openstreetmap.org")) continue;
          directProviderRequestCount += 1;
          record("direct_upstream_browser_request_detected", { requestId: "", providerStatusClass: "direct_browser_request" });
        }
      });
      observer.observe({ type: "resource", buffered: true });
    } catch (_error) { /* Performance observation is optional; network certification remains authoritative. */ }
  }

  const failureMessages = Object.freeze({
    rate_limited: "Search is temporarily paused. Please try again shortly.",
    provider_unavailable: "Address and place search is temporarily unavailable.",
    provider_timeout: "Search is taking longer than expected. Please try again.",
    no_results: "No matching destination found. Try adding the city or ZIP code.",
    invalid_request: "Check the destination and try again.",
    configuration_error: "Destination search is temporarily unavailable."
  });

  function canonicalToLegacy(result) {
    return {
      place_id: result.providerResultId,
      osm_type: result.providerIdentity?.osmType || "",
      osm_id: result.providerIdentity?.osmId || "",
      name: result.name,
      display_name: result.displayName,
      lat: String(result.latitude),
      lon: String(result.longitude),
      category: result.category,
      type: result.type,
      address: {
        house_number: result.address?.houseNumber || "",
        road: result.address?.road || "",
        village: result.address?.community || "",
        city: result.address?.city || "",
        county: result.address?.county || "",
        state: result.address?.state || "",
        postcode: result.address?.postalCode || "",
        country: result.address?.country || ""
      }
    };
  }

  async function search(request) {
    const requestId = request.requestId || (global.crypto?.randomUUID?.() || `gridly-${Date.now()}`);
    record("gridly_endpoint_request_attempted", { requestId, intent: request.intent, queryLengthBucket: String(request.query || "").length < 20 ? "short" : "long" });
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", apikey: publicKey, Authorization: `Bearer ${publicKey}` },
        body: JSON.stringify({ ...request, requestId })
      });
    } catch (_error) {
      record("provider_error_category", { requestId, status: "provider_unavailable" });
      return { ok: false, status: "provider_unavailable", providerBoundary: "gridly", retryAfterSeconds: null, requestId, results: [] };
    }
    let payload;
    try { payload = await response.json(); } catch (_error) { payload = null; }
    const canonical = payload && payload.providerBoundary === "gridly" && Array.isArray(payload.results)
      ? payload
      : { ok: false, status: "provider_unavailable", providerBoundary: "gridly", retryAfterSeconds: null, requestId, results: [] };
    record("gridly_endpoint_response_received", { requestId, status: canonical.status, cached: canonical.cached === true, resultCount: canonical.results.length });
    record(canonical.cached ? "cache_hit" : "cache_miss", { requestId });
    return canonical;
  }

  global.gridlyGeocodingClient = Object.freeze({ endpoint, search, canonicalToLegacy, failureMessages, evidence: () => evidence.map((item) => ({ ...item })), directProviderRequestCount: () => directProviderRequestCount });
})(window);
