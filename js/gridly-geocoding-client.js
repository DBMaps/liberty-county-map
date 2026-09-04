(function initializeGridlyGeocodingClient(global) {
  "use strict";

  const endpoint = "https://nhwhkbkludzkuyxmkkcj.supabase.co/functions/v1/gridly-geocode";
  const publicKey = "sb_publishable_T33dpOj4M3TioSqFcVxf2Q_YTmhkPdO";
  const runtimeEvidence = [];
  let directProviderRequestCount = 0;
  let lastDiagnosticTrace = null;
  const endpointOrigin = "https://nhwhkbkludzkuyxmkkcj.supabase.co";
  const functionSlug = "gridly-geocode";
  const requestContractVersion = "gridly-geocode-v1";
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

  function internalDiagnostics(payload, diagnosticRequest) {
    const value = payload?.diagnostics;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const diagnostics = {
      primaryProviderOutcome: String(value.primaryProviderOutcome || "unknown"),
      fallbackEligible: value.fallbackEligible === true,
      fallbackInvoked: value.fallbackInvoked === true,
      fallbackOutcome: String(value.fallbackOutcome || "ineligible"),
      authoritativeRuralOutcome: String(value.authoritativeRuralOutcome || "not_invoked"),
      registryOutcome: String(value.registryOutcome || "not_invoked"),
      sourceClassification: String(value.sourceClassification || "none")
    };
    const runtime = value.runtimeAddressDiagnostics;
    if (runtime && typeof runtime === "object" && !Array.isArray(runtime)) {
      diagnostics.runtimeAddressDiagnostics = Object.freeze({
        version: String(runtime.version || ""),
        completedStages: Array.isArray(runtime.completedStages) ? runtime.completedStages.slice(0, 16).map(String) : [],
        lastCompletedStage: runtime.lastCompletedStage == null ? null : String(runtime.lastCompletedStage),
        failureStage: runtime.failureStage == null ? null : String(runtime.failureStage),
        responseSource: String(runtime.responseSource || "unknown"),
        certifiedProviderExecuted: runtime.certifiedProviderExecuted === true,
        certificateValidated: runtime.certificateValidated === true,
        packageOpened: runtime.packageOpened === true,
        exactLookupExecuted: runtime.exactLookupExecuted === true,
        fallbackExecuted: runtime.fallbackExecuted === true,
        storageBucket: runtime.storageBucket == null ? null : String(runtime.storageBucket).slice(0, 63),
        selectedCountySlug: runtime.selectedCountySlug == null ? null : String(runtime.selectedCountySlug).slice(0, 63),
        selectedFips: runtime.selectedFips == null ? null : String(runtime.selectedFips).slice(0, 5),
        certificateObjectPath: runtime.certificateObjectPath == null ? null : String(runtime.certificateObjectPath).slice(0, 512),
        packageObjectPath: runtime.packageObjectPath == null ? null : String(runtime.packageObjectPath).slice(0, 512),
        storageStatusCategory: String(runtime.storageStatusCategory || "not_requested").slice(0, 32),
        certificateUrl: null,
        certificateHttpStatus: null,
        certificateFetchCompleted: runtime.certificateFetchCompleted === true,
        certificateFetchReason: String(runtime.certificateFetchReason || "not_requested"),
        artifactAccessMode: String(runtime.artifactAccessMode || "not_requested").slice(0, 48),
        streamingDownloadUsed: runtime.streamingDownloadUsed === true,
        compressedBytesRead: Number(runtime.compressedBytesRead) || 0,
        expectedCompressedBytes: Number(runtime.expectedCompressedBytes) || 0,
        compressedByteSizeValidated: runtime.compressedByteSizeValidated === true,
        incrementalHashUsed: runtime.incrementalHashUsed === true,
        calculatedSha256: runtime.calculatedSha256 == null ? null : String(runtime.calculatedSha256).slice(0, 64),
        sha256Validated: runtime.sha256Validated === true,
        decompressionStarted: runtime.decompressionStarted === true,
        decompressionCompleted: runtime.decompressionCompleted === true,
        recordsScanned: Number(runtime.recordsScanned) || 0,
        exactMatchEncountered: runtime.exactMatchEncountered === true,
        exactMatchPromotedAfterIntegrityValidation: runtime.exactMatchPromotedAfterIntegrityValidation === true,
        maximumBufferedChunkBytes: Number(runtime.maximumBufferedChunkBytes) || 0,
        packageDownloadElapsedMilliseconds: Number(runtime.packageDownloadElapsedMilliseconds) || 0,
        packageHashElapsedMilliseconds: Number(runtime.packageHashElapsedMilliseconds) || 0,
        decompressionAndScanElapsedMilliseconds: Number(runtime.decompressionAndScanElapsedMilliseconds) || 0,
        totalArtifactElapsedMilliseconds: Number(runtime.totalArtifactElapsedMilliseconds) || 0,
        errorName: runtime.errorName == null ? null : String(runtime.errorName).slice(0, 64),
        errorMessage: runtime.errorMessage == null ? null : String(runtime.errorMessage).slice(0, 128),
        roadOnlyRequest: runtime.roadOnlyRequest === true,
        roadOnlyResidentialRejected: runtime.roadOnlyResidentialRejected === true,
        fallbackAcceptanceOutcome: String(runtime.fallbackAcceptanceOutcome || "not_applicable").slice(0, 48)
      });
    }
    if (diagnosticRequest && Array.isArray(value.fallbackCandidateDiagnostics)) {
      diagnostics.fallbackCandidateDiagnostics = value.fallbackCandidateDiagnostics.map((entry) => ({ ...entry }));
    }
    if (diagnosticRequest && Array.isArray(value.authoritativeCandidateDiagnostics)) {
      diagnostics.authoritativeCandidateDiagnostics = value.authoritativeCandidateDiagnostics.map((entry) => ({ ...entry }));
    }
    return diagnostics;
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
    const transport = Object.freeze({ requestAttempted: true, httpStatus: response.status,
      requestContractVersion, providerResponseReceived: canonical && response.status !== 400,
      providerCandidateCount: canonical && Array.isArray(payload.results) ? payload.results.length : 0,
      failureCode });
    if (!canonical) return { ok: false, status: "provider_unavailable", providerBoundary: "gridly", retryAfterSeconds: null, requestId, results: [], transport };
    const normalized = { ...payload };
    Object.defineProperty(normalized, "transport", { value: transport, enumerable: false });
    const diagnostics = internalDiagnostics(payload, ["lp102_certification", "lp103_certification", "lp104_certification"].includes(request.requestMode));
    if (diagnostics) Object.defineProperty(normalized, "diagnostics", { value: diagnostics, enumerable: false });
    lastDiagnosticTrace = Object.freeze({ requestMode: request.requestMode || "explicit_search",
      diagnosticsObserved: Boolean(diagnostics), diagnosticPropertyName: diagnostics ? "diagnostics" : null,
      fallbackCandidateDiagnosticsObserved: Boolean(diagnostics?.fallbackCandidateDiagnostics?.length) });
    return normalized;
  }

  global.gridlyGeocodingClient = Object.freeze({
    endpoint, functionSlug, requestContractVersion, search, canonicalToLegacy, failureMessages,
    evidence: () => runtimeEvidence.map((item) => ({ ...item })),
    directProviderRequestCount: () => directProviderRequestCount,
    diagnosticTrace: () => lastDiagnosticTrace ? { ...lastDiagnosticTrace } : null
  });
})(window);
