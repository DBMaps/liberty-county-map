(function initializeGridlyGeocodingClient(global) {
  "use strict";

  const endpoint = "https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-geocode";
  const publicKey = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";
  const runtimeEvidence = [];
  let directProviderRequestCount = 0;
  const endpointOrigin = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
  const functionSlug = "gridly-geocode";
  const canonicalStatuses = new Set(["success", "no_results", "rate_limited", "provider_unavailable", "provider_timeout", "invalid_request", "configuration_error"]);

  function addEvidence(fields) {
    runtimeEvidence.push(Object.freeze({
      timestamp: Date.now(),
      requestType: fields.requestType || "destination_search",
      intentType: fields.intentType || "unknown",
      endpointOrigin,
      functionSlug,
      httpStatus: Number.isInteger(fields.httpStatus) ? fields.httpStatus : null,
      requestSucceeded: fields.requestSucceeded === true,
      canonicalSuccess: fields.canonicalSuccess === true,
      canonicalFailure: fields.canonicalFailure === true,
      failureCode: fields.failureCode || "",
      providerBoundaryUsed: fields.providerBoundaryUsed === true,
      directProviderRequestDetected: fields.directProviderRequestDetected === true
    }));
    if (runtimeEvidence.length > 80) runtimeEvidence.shift();
  }

  if (typeof global.PerformanceObserver === "function") {
    try {
      const observer = new global.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!String(entry.name || "").includes("nominatim.openstreetmap.org")) continue;
          directProviderRequestCount += 1;
          addEvidence({ requestType: "direct_provider_request", failureCode: "direct_provider_request", directProviderRequestDetected: true });
        }
      });
      observer.observe({ type: "resource", buffered: true });
    } catch (_error) { /* Performance observation is optional; recorded fetch evidence remains authoritative. */ }
  }

  const failureMessages = Object.freeze({
    rate_limited: "Search is temporarily paused. Please try again shortly.",
    provider_unavailable: "Search is temporarily unavailable. Please try again.",
    provider_timeout: "Search is taking longer than expected. Please try again.",
    no_results: "No matching destination found. Try adding the city or ZIP code.",
    invalid_request: "Check the destination and try again.",
    configuration_error: "Search is temporarily unavailable. Please try again."
  });

  function canonicalToLegacy(result) {
    return {
      place_id: result.providerResultId, osm_type: result.providerIdentity?.osmType || "", osm_id: result.providerIdentity?.osmId || "",
      name: result.name, display_name: result.displayName, lat: String(result.latitude), lon: String(result.longitude), category: result.category, type: result.type,
      address: { house_number: result.address?.houseNumber || "", road: result.address?.road || "", village: result.address?.community || "", city: result.address?.city || "", county: result.address?.county || "", state: result.address?.state || "", postcode: result.address?.postalCode || "", country: result.address?.country || "" },
      gridlyResolution: { precision: result.precision || "unknown", confidenceBasis: result.confidenceBasis || "unspecified", sourceClassification: result.sourceClassification || "unknown", routePreviewEligible: result.routePreviewEligible === true }
    };
  }

  function isCanonical(payload) {
    return Boolean(payload && typeof payload.ok === "boolean" && canonicalStatuses.has(payload.status)
      && payload.providerBoundary === "gridly" && Array.isArray(payload.results)
      && payload.results.every((result) => result && typeof result === "object"
        && Number.isFinite(Number(result.latitude)) && Number.isFinite(Number(result.longitude)))
      && (payload.ok ? payload.status === "success" : payload.status !== "success")
      && (!payload.ok ? payload.results.length === 0 : true));
  }

  async function search(request) {
    const requestId = request.requestId || (global.crypto?.randomUUID?.() || `gridly-${Date.now()}`);
    let response;
    try {
      response = await (global.fetch || fetch)(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", apikey: publicKey, Authorization: `Bearer ${publicKey}` },
        body: JSON.stringify({ ...request, requestId })
      });
    } catch (_error) {
      addEvidence({ intentType: request.intent, failureCode: "network_failure" });
      return { ok: false, status: "provider_unavailable", providerBoundary: "gridly", retryAfterSeconds: null, requestId, results: [] };
    }
    let payload;
    try { payload = await response.json(); } catch (_error) { payload = null; }
    const canonical = isCanonical(payload);
    const canonicalSuccess = canonical && response.ok && payload.ok && payload.status === "success";
    const canonicalFailure = canonical && !payload.ok;
    const failureCode = response.status === 404 ? "function_missing" : response.status === 401 ? "client_unauthorized"
      : response.status >= 500 ? "edge_server_error" : !canonical ? "malformed_response" : (canonicalFailure ? payload.status : "");
    addEvidence({ intentType: request.intent, httpStatus: response.status, requestSucceeded: response.ok, canonicalSuccess, canonicalFailure, failureCode, providerBoundaryUsed: canonical });
    if (!canonical) return { ok: false, status: "provider_unavailable", providerBoundary: "gridly", retryAfterSeconds: null, requestId, results: [] };
    return payload;
  }

  global.gridlyGeocodingClient = Object.freeze({
    endpoint, functionSlug, search, canonicalToLegacy, failureMessages,
    evidence: () => runtimeEvidence.map((item) => ({ ...item })),
    directProviderRequestCount: () => directProviderRequestCount
  });
})(window);
