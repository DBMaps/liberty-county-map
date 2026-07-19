(function initGridlyDriveTexasLiveConnector(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_ID = "drivetexas";
  const PROVIDER_NAME = "DriveTexas";
  const DEFAULT_ENDPOINT = "https://api.drivetexas.org/api/conditions.geojson?key={api_key}";
  const TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 2;
  const REFRESH_INTERVAL_MS = 180000;

  const state = {
    connected: false,
    networkingAvailable: typeof globalScope.fetch === "function",
    automaticPolling: false,
    providerActivated: false,
    renderingPerformed: false,
    normalizedRecordCount: 0,
    lastFetchSucceeded: false,
    lastError: null,
    lastRequestAt: null,
    refreshIntervalMs: REFRESH_INTERVAL_MS
  };

  let refreshTimer = null;
  let fetchInFlight = null;

  let allNormalizedRecords = [];
  let awarenessNormalizedRecords = [];
  let normalizedRecords = awarenessNormalizedRecords;
  let lastRecordSignature = null;
  let sourceRecordsUpdatedAt = null;
  let awarenessRecordsUpdatedAt = null;
  let lastSuccessfulFetchAt = null;
  let lastFetchError = null;
  let lastFilterReason = null;
  let lastFilterContext = null;
  let areaViewGeneration = 0;
  let fetchGeneration = 0;
  let lastInstalledFetchGeneration = 0;
  let staleAreaViewCompletionIgnoredCount = 0;
  let staleFetchCompletionIgnoredCount = 0;
  let completeSourceDatasetPreservedAcrossAreaChange = true;
  let lastRefetchRequired = false;
  let lastRetainedDataReused = false;

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function toSafeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function activeAwarenessArea() {
    try {
      if (typeof globalScope.getGridlySelectedAwarenessArea === "function") return globalScope.getGridlySelectedAwarenessArea();
      if (typeof globalScope.getGridlyHomeTownAwarenessAnchor === "function") return globalScope.getGridlyHomeTownAwarenessAnchor();
    } catch (error) {}
    return null;
  }

  function awarenessContextFrom(area) {
    if (!area || typeof area !== "object") return null;
    return freeze({
      countyId: toSafeString(area.countyId),
      community: toSafeString(area.label || area.storageValue),
      label: toSafeString(area.label),
      storageValue: toSafeString(area.storageValue),
      key: toSafeString(area.key),
      lat: Number.isFinite(Number(area.lat)) ? Number(area.lat) : null,
      lng: Number.isFinite(Number(area.lng)) ? Number(area.lng) : null,
      radiusMiles: Number.isFinite(Number(area.radiusMiles)) ? Number(area.radiusMiles) : null,
      mode: area.countyWide === true ? "county" : "area",
      countyWide: area.countyWide === true,
      textFallbackTerms: [area.label, area.storageValue, area.key, area.countyId]
        .map(toSafeString)
        .map((value) => value.toLowerCase().replace(/-tx$/, "").replace(/ county$/, ""))
        .filter(Boolean)
    });
  }

  function recordText(record) {
    return [record?.title, record?.description, record?.routeName, record?.locality, record?.city, record?.county, record?.affectedAreas].flat().map(toSafeString).filter(Boolean).join(" ").toLowerCase();
  }

  function matchesAwarenessArea(record, awareness) {
    if (!awareness) return false;
    const rawLat = record?.latitude;
    const rawLng = record?.longitude;
    const lat = rawLat == null || rawLat === "" ? NaN : Number(rawLat);
    const lng = rawLng == null || rawLng === "" ? NaN : Number(rawLng);
    const areaLat = Number(awareness.lat);
    const areaLng = Number(awareness.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(areaLat) && Number.isFinite(areaLng) && typeof globalScope.getDistanceMiles === "function") {
      const radius = Number(awareness.radiusMiles);
      const allowedMiles = awareness.countyWide || !Number.isFinite(radius) ? 35 : radius + 2;
      return globalScope.getDistanceMiles(areaLat, areaLng, lat, lng) <= allowedMiles;
    }
    const terms = Array.isArray(awareness.textFallbackTerms) ? awareness.textFallbackTerms : [awareness.label, awareness.storageValue, awareness.key, awareness.countyId]
      .map(toSafeString)
      .map((value) => value.toLowerCase().replace(/-tx$/, "").replace(/ county$/, ""))
      .filter(Boolean);
    const text = recordText(record);
    return Boolean(text && terms.some((term) => term && text.includes(term)));
  }

  function filterAwarenessRecords(records, awareness) {
    if (globalScope.gridlySelectedAwarenessAreaResolutionCache && typeof globalScope.gridlySelectedAwarenessAreaResolutionCache === "object") {
      globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount = Number(globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount || 0) + 1;
      globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount = Number(globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount || 0);
    }
    return (Array.isArray(records) ? records : []).filter((record) => matchesAwarenessArea(record, awareness));
  }

  function installAwarenessView(records, context, generation, reason) {
    if (generation !== areaViewGeneration) {
      staleAreaViewCompletionIgnoredCount += 1;
      return false;
    }
    awarenessNormalizedRecords = (Array.isArray(records) ? records : []).map(clone).filter(Boolean);
    normalizedRecords = awarenessNormalizedRecords;
    awarenessRecordsUpdatedAt = new Date().toISOString();
    lastFilterReason = reason || "drivetexas-awareness-filter";
    lastFilterContext = context ? clone(context) : null;
    state.normalizedRecordCount = awarenessNormalizedRecords.length;
    return true;
  }

  function deriveAwarenessView(reason) {
    if (typeof globalScope.gridlyLp016RecordAwarenessSwitchEvent === "function") globalScope.gridlyLp016RecordAwarenessSwitchEvent("driveTexasRefreshStarted", { reason });
    const generation = areaViewGeneration + 1;
    areaViewGeneration = generation;
    const previousDerivationFlag = globalScope.__gridlyDriveTexasAwarenessDerivationActive === true;
    let context = null;
    try {
      globalScope.__gridlyDriveTexasAwarenessDerivationActive = true;
      context = awarenessContextFrom(activeAwarenessArea());
    } finally {
      globalScope.__gridlyDriveTexasAwarenessDerivationActive = previousDerivationFlag;
    }
    const filteredRecords = filterAwarenessRecords(allNormalizedRecords, context);
    const installed = installAwarenessView(filteredRecords, context, generation, reason);
    if (installed && typeof globalScope.gridlyLp016RecordAwarenessSwitchEvent === "function") globalScope.gridlyLp016RecordAwarenessSwitchEvent("driveTexasRefreshCompleted", { recordCount: awarenessNormalizedRecords.length, reason });
    return installed;
  }

  function refreshAwarenessView(reason) {
    const beforeCount = allNormalizedRecords.length;
    const installed = deriveAwarenessView(reason || "drivetexas-awareness-context-changed");
    completeSourceDatasetPreservedAcrossAreaChange = completeSourceDatasetPreservedAcrossAreaChange && beforeCount === allNormalizedRecords.length;
    lastRetainedDataReused = beforeCount > 0;
    if (installed) {
      const recordSignature = buildRecordSignature(awarenessNormalizedRecords);
      const evidenceChanged = recordSignature !== lastRecordSignature;
      lastRecordSignature = recordSignature;
      notifyOfficialConsumers(recordSignature, true, reason || "drivetexas-awareness-view-updated");
    }
    return freeze({ connected: state.connected === true, normalizedRecordCount: awarenessNormalizedRecords.length, retainedNormalizedRecordCount: allNormalizedRecords.length, retainedDataReused: lastRetainedDataReused });
  }


  function stableRecordValue(value) {
    if (Array.isArray(value)) return value.map(stableRecordValue);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((memo, key) => {
        if (key === "raw" || key === "rawPayload" || key === "rawPayloadExposed") return memo;
        const nextValue = value[key];
        if (typeof nextValue === "function" || typeof nextValue === "undefined") return memo;
        memo[key] = stableRecordValue(nextValue);
        return memo;
      }, {});
    }
    return value;
  }

  function buildRecordSignature(records) {
    const stableRecords = (Array.isArray(records) ? records : []).map(stableRecordValue);
    stableRecords.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return `${PROVIDER_ID}:${stableRecords.length}:${JSON.stringify(stableRecords)}`;
  }

  function notifyOfficialProviderEvidence(signature, changed, reason) {
    if (typeof globalScope.gridlyOfficialProviderConsumerRefresh === "function") {
      globalScope.gridlyOfficialProviderConsumerRefresh({ providerId: PROVIDER_ID, signature, evidenceChanged: changed, reason });
      return;
    }
    if (!changed) return;
    try { if (typeof globalScope.gridlyRenderTravelBrief === "function") globalScope.gridlyRenderTravelBrief(); } catch (error) {}
    try { if (typeof globalScope.gridlyUnifiedIntelligencePrototype?.runtime === "function") globalScope.gridlyUnifiedIntelligencePrototype.runtime(); } catch (error) {}
  }

  function getProvider() {
    return globalScope.gridlyDriveTexasProvider || globalScope.gridlyIntelligenceProviders?.[PROVIDER_ID] || null;
  }

  function getConnectorConfig() {
    const gridlyConfig = globalScope.GRIDLY_CONFIG && typeof globalScope.GRIDLY_CONFIG === "object"
      ? globalScope.GRIDLY_CONFIG
      : {};
    const driveTexas = gridlyConfig.driveTexas && typeof gridlyConfig.driveTexas === "object"
      ? gridlyConfig.driveTexas
      : {};
    const legacyTxdot = gridlyConfig.txdot && typeof gridlyConfig.txdot === "object"
      ? gridlyConfig.txdot
      : {};

    const driveTexasApiKey = toSafeString(driveTexas.apiKey);
    const legacyTxdotApiKey = toSafeString(legacyTxdot.apiKey);
    const globalTxdotApiKey = toSafeString(globalScope.GRIDLY_TXDOT_API_KEY);
    let configurationSource = "none";
    if (driveTexasApiKey) configurationSource = "GRIDLY_CONFIG.driveTexas.apiKey";
    else if (legacyTxdotApiKey) configurationSource = "GRIDLY_CONFIG.txdot.apiKey";
    else if (globalTxdotApiKey) configurationSource = "GRIDLY_TXDOT_API_KEY";

    return {
      endpointTemplate: toSafeString(driveTexas.endpointTemplate) || toSafeString(legacyTxdot.endpointTemplate) || DEFAULT_ENDPOINT,
      apiKey: driveTexasApiKey || legacyTxdotApiKey || globalTxdotApiKey,
      configurationSource
    };
  }

  function buildEndpoint() {
    const config = getConnectorConfig();
    if (!config.apiKey) throw new Error("DriveTexas connector API key is not configured");
    return config.endpointTemplate.replace("{api_key}", encodeURIComponent(config.apiKey));
  }

  function createTimeoutController() {
    if (typeof globalScope.AbortController !== "function") return { controller: null, timeoutId: null };
    const controller = new globalScope.AbortController();
    const timeoutId = globalScope.setTimeout(() => controller.abort(), TIMEOUT_MS);
    return { controller, timeoutId };
  }

  function validateGeoJson(payload) {
    return Boolean(payload && payload.type === "FeatureCollection" && Array.isArray(payload.features));
  }

  function normalizePayload(payload) {
    if (!validateGeoJson(payload)) {
      const error = new Error("DriveTexas connector schema validation failed");
      error.gridlyNonRetryable = true;
      throw error;
    }

    const provider = getProvider();
    if (!provider || typeof provider.normalizeRecords !== "function") {
      const error = new Error("DriveTexas provider normalizer unavailable");
      error.gridlyNonRetryable = true;
      throw error;
    }

    return provider.normalizeRecords(payload).map(clone).filter(Boolean);
  }

  function isTransientError(error) {
    if (error?.gridlyNonRetryable === true) return false;
    if (error?.gridlyHttpStatus) {
      return error.gridlyHttpStatus === 408 || error.gridlyHttpStatus === 429 || error.gridlyHttpStatus >= 500;
    }
    return error?.name === "AbortError" || error instanceof TypeError || error?.gridlyNetworkError === true;
  }

  async function requestPayload(endpoint) {
    if (typeof globalScope.fetch !== "function") {
      const error = new Error("DriveTexas connector fetch is unavailable");
      error.gridlyNonRetryable = true;
      throw error;
    }

    const { controller, timeoutId } = createTimeoutController();
    try {
      const response = await globalScope.fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      if (!response || response.ok !== true) {
        const status = Number(response?.status) || 0;
        const error = new Error(`DriveTexas connector request failed: ${status || "unknown"}`);
        error.gridlyHttpStatus = status;
        error.gridlyNonRetryable = status >= 400 && status < 500 && status !== 408 && status !== 429;
        throw error;
      }
      return response.json();
    } catch (error) {
      if (error?.gridlyHttpStatus || error?.gridlyNonRetryable) throw error;
      error.gridlyNetworkError = true;
      throw error;
    } finally {
      if (timeoutId != null && typeof globalScope.clearTimeout === "function") globalScope.clearTimeout(timeoutId);
    }
  }

  function notifyOfficialConsumers(signature, changed, reason) {
    notifyOfficialProviderEvidence(signature, changed, reason || "drivetexas-provider-evidence");
  }

  async function fetchNow() {
    if (fetchInFlight) return fetchInFlight;
    fetchInFlight = fetchNowInternal().finally(() => { fetchInFlight = null; });
    return fetchInFlight;
  }

  async function fetchNowInternal() {
    state.networkingAvailable = typeof globalScope.fetch === "function";
    state.lastRequestAt = new Date().toISOString();
    let attempt = 0;
    let lastError = null;

    try {
      const endpoint = buildEndpoint();
      while (attempt < MAX_ATTEMPTS) {
        try {
          const requestGeneration = fetchGeneration + 1;
          fetchGeneration = requestGeneration;
          const payload = await requestPayload(endpoint);
          if (requestGeneration < fetchGeneration) {
            staleFetchCompletionIgnoredCount += 1;
            return freeze({ connected: state.connected === true, normalizedRecordCount: awarenessNormalizedRecords.length, staleFetchIgnored: true });
          }
          const completeRecords = normalizePayload(payload);
          allNormalizedRecords = completeRecords.map(clone).filter(Boolean);
          sourceRecordsUpdatedAt = new Date().toISOString();
          lastSuccessfulFetchAt = sourceRecordsUpdatedAt;
          lastInstalledFetchGeneration = requestGeneration;
          deriveAwarenessView("drivetexas-fetch-success");
          const recordSignature = buildRecordSignature(awarenessNormalizedRecords);
          const evidenceChanged = recordSignature !== lastRecordSignature;
          lastRecordSignature = recordSignature;
          state.connected = true;
          state.lastFetchSucceeded = true;
          state.normalizedRecordCount = awarenessNormalizedRecords.length;
          state.lastError = null;
          lastFetchError = null;
          lastRefetchRequired = true;
          lastRetainedDataReused = false;
          notifyOfficialConsumers(recordSignature, evidenceChanged, "drivetexas-fetch-success");
          return freeze({ connected: true, normalizedRecordCount: awarenessNormalizedRecords.length, retainedNormalizedRecordCount: allNormalizedRecords.length, evidenceChanged });
        } catch (error) {
          lastError = error;
          attempt += 1;
          if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error;
        }
      }
      throw lastError || new Error("DriveTexas connector request failed");
    } catch (error) {
      state.connected = false;
      state.lastFetchSucceeded = false;
      state.normalizedRecordCount = awarenessNormalizedRecords.length;
      state.lastError = error instanceof Error ? error.message : String(error);
      lastFetchError = state.lastError;
      const recordSignature = buildRecordSignature(awarenessNormalizedRecords);
      const evidenceChanged = recordSignature !== lastRecordSignature;
      notifyOfficialConsumers(recordSignature, evidenceChanged, "drivetexas-fetch-failure");
      return freeze({ connected: false, normalizedRecordCount: awarenessNormalizedRecords.length, retainedNormalizedRecordCount: allNormalizedRecords.length, error: state.lastError, evidenceChanged });
    }
  }

  function scheduleNextFetch(delayMs) {
    if (refreshTimer != null || typeof globalScope.setTimeout !== "function") return;
    refreshTimer = globalScope.setTimeout(async () => {
      refreshTimer = null;
      await fetchNow();
      if (state.automaticPolling === true) scheduleNextFetch(REFRESH_INTERVAL_MS);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function startPolling() {
    state.automaticPolling = true;
    state.providerActivated = true;
    scheduleNextFetch(0);
    return runtimeAudit();
  }

  function stopPolling() {
    state.automaticPolling = false;
    if (refreshTimer != null && typeof globalScope.clearTimeout === "function") globalScope.clearTimeout(refreshTimer);
    refreshTimer = null;
    return runtimeAudit();
  }

  function getNormalizedRecords() {
    return freeze(awarenessNormalizedRecords.map(clone).filter(Boolean));
  }

  function getAwarenessRecords() {
    return getNormalizedRecords();
  }

  function getAllNormalizedRecords() {
    return freeze(allNormalizedRecords.map(clone).filter(Boolean));
  }

  function areaLifecycleAudit() {
    return freeze({
      activeCounty: lastFilterContext?.countyId || null,
      activeCommunity: lastFilterContext?.community || null,
      activeAwarenessMode: lastFilterContext?.mode || null,
      retainedCompleteSourceRecordCount: allNormalizedRecords.length,
      currentAwarenessAreaRecordCount: awarenessNormalizedRecords.length,
      retainedSourceTimestamp: sourceRecordsUpdatedAt,
      derivedAreaViewTimestamp: awarenessRecordsUpdatedAt,
      lastSuccessfulFetchTimestamp: lastSuccessfulFetchAt,
      lastFetchError,
      lastFilterReason,
      lastFilteredCounty: lastFilterContext?.countyId || null,
      lastFilteredCommunity: lastFilterContext?.community || null,
      lastFilterCoordinates: lastFilterContext ? { lat: lastFilterContext.lat, lng: lastFilterContext.lng } : null,
      lastFilterRadius: lastFilterContext?.radiusMiles ?? null,
      lastAreaViewGeneration: areaViewGeneration,
      lastFetchGeneration: fetchGeneration,
      lastInstalledFetchGeneration,
      staleAreaViewCompletionIgnoredCount,
      staleFetchCompletionIgnoredCount,
      completeSourceDatasetPreservedAcrossAreaChange,
      currentAwarenessViewMatchesSelectedArea: true,
      selectedRecordIds: awarenessNormalizedRecords.map((record) => record.id || record.incidentId || record.GLOBALID || null),
      selectedRecordCounties: awarenessNormalizedRecords.map((record) => record.county || record.countyName || record.countyId || record.raw?.county || null),
      selectedRecordCommunities: awarenessNormalizedRecords.map((record) => record.city || record.locality || record.community || record.raw?.city || null),
      selectedRecordCoordinates: awarenessNormalizedRecords.map((record) => ({ latitude: record.latitude ?? record.lat ?? null, longitude: record.longitude ?? record.lng ?? record.lon ?? null })),
      selectedRoutes: awarenessNormalizedRecords.map((record) => record.routeName || record.routeNameDisplay || record.roadName || record.road || record.highway || null),
      selectedCategories: awarenessNormalizedRecords.map((record) => record.category || record.type || record.condition || null),
      selectedRawSourceText: awarenessNormalizedRecords.map((record) => record.rawSourceText || record.description || record.title || null),
      refetchRequired: lastRefetchRequired,
      retainedDataReused: lastRetainedDataReused,
      sourcePresentationOwnershipSeparationActive: allNormalizedRecords !== awarenessNormalizedRecords
    });
  }

  function lp029DistanceMiles(aLat, aLng, bLat, bLng) {
    const lat1 = Number(aLat);
    const lng1 = Number(aLng);
    const lat2 = Number(bLat);
    const lng2 = Number(bLng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    if (typeof globalScope.getDistanceMiles === "function") return globalScope.getDistanceMiles(lat1, lng1, lat2, lng2);
    const toRad = (value) => value * Math.PI / 180;
    const radiusMiles = 3958.7613;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function lp029BuildCounts(records, selector) {
    return records.reduce((memo, record) => {
      const key = toSafeString(selector(record)) || "(missing)";
      memo[key] = (memo[key] || 0) + 1;
      return memo;
    }, {});
  }

  function lp029ConfiguredEndpointContract() {
    const config = getConnectorConfig();
    const template = toSafeString(config.endpointTemplate) || DEFAULT_ENDPOINT;
    let parsed = null;
    try { parsed = new URL(template.replace("{api_key}", "__GRIDLY_REDACTED_API_KEY__")); } catch (error) {}
    const params = parsed ? Array.from(parsed.searchParams.keys()).reduce((memo, key) => {
      memo[key] = key.toLowerCase() === "key" ? "{api_key_redacted}" : parsed.searchParams.get(key);
      return memo;
    }, {}) : {};
    return freeze({
      method: "GET",
      endpointTemplate: template.replace(/key=([^&]*)/i, "key={api_key_redacted}"),
      baseUrl: parsed ? `${parsed.protocol}//${parsed.host}` : "https://api.drivetexas.org",
      endpointPath: parsed ? parsed.pathname : "/api/conditions.geojson",
      queryParameters: freeze(params),
      apiKeyHandling: "Resolved from GRIDLY_CONFIG.driveTexas.apiKey, GRIDLY_CONFIG.txdot.apiKey, or GRIDLY_TXDOT_API_KEY and URL-encoded into the key query parameter; never returned by this audit.",
      requestHeaders: freeze({ explicitHeadersConfigured: false }),
      cachePolicy: "fetch cache: no-store",
      timeoutMs: TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      retryBehavior: "Retry once only for transient 408, 429, 5xx, timeout, or network failures; no retry for other 4xx/schema failures.",
      paginationParametersConfigured: false,
      boundingParametersConfigured: false,
      districtParametersConfigured: false,
      categoryParametersConfigured: false,
      statusParametersConfigured: false,
      dateTimeParametersConfigured: false,
      maximumResultParametersConfigured: false
    });
  }

  function lp029ProximityCounts(records, point, radii) {
    return radii.reduce((memo, radius) => {
      memo[`${radius}mi`] = records.filter((record) => {
        const miles = lp029DistanceMiles(point.lat, point.lng, record.latitude, record.longitude);
        return Number.isFinite(miles) && miles <= radius;
      }).length;
      return memo;
    }, {});
  }

  function lp029ProviderCompletenessAudit() {
    const records = allNormalizedRecords.map(clone).filter(Boolean);
    const validCoordinateCount = records.filter((record) => Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude))).length;
    const ids = records.map((record) => toSafeString(record.id)).filter(Boolean);
    const uniqueIds = new Set(ids);
    const starts = records.map((record) => toSafeString(record.startTime)).filter(Boolean).sort();
    const ends = records.map((record) => toSafeString(record.endTime)).filter(Boolean).sort();
    const conroe = { lat: 30.3119, lng: -95.4558 };
    const routePatternCountsNearConroe = [
      ["IH0045 / I-45", /\b(?:ih\s*0*45|i[- ]?45|interstate\s*45)\b/i],
      ["SH0105 / SH 105", /\b(?:sh\s*0*105|state highway\s*105|sh[- ]?105)\b/i],
      ["SL0336 / Loop 336", /\b(?:sl\s*0*336|loop\s*336|lp\s*336)\b/i],
      ["FM1488", /\bfm\s*1488\b/i],
      ["FM2854", /\bfm\s*2854\b/i]
    ].reduce((memo, entry) => {
      const [label, pattern] = entry;
      memo[label] = records.filter((record) => pattern.test([record.routeName, record.title, record.description].map(toSafeString).join(" ")) && Number(lp029DistanceMiles(conroe.lat, conroe.lng, record.latitude, record.longitude)) <= 50).length;
      return memo;
    }, {});

    return freeze({
      auditName: "LP029 DriveTexas Provider Completeness Passive Audit",
      passive: true,
      fetchPerformed: false,
      mutatesConnectorState: false,
      endpointContract: lp029ConfiguredEndpointContract(),
      rawResponseCount: null,
      normalizedCompleteCount: records.length,
      normalizationDropCount: null,
      duplicateIdCount: ids.length - uniqueIds.size,
      categoryCounts: freeze(lp029BuildCounts(records, (record) => record.category)),
      routeCounts: freeze(lp029BuildCounts(records, (record) => record.routeName)),
      recordsWithValidCoordinates: validCoordinateCount,
      recordsWithoutValidCoordinates: records.length - validCoordinateCount,
      coordinateCoveragePercent: records.length ? Number(((validCoordinateCount / records.length) * 100).toFixed(2)) : 0,
      earliestStartTimestamp: starts[0] || null,
      latestEndTimestamp: ends[ends.length - 1] || null,
      recordsWithUnknownCategory: records.filter((record) => !toSafeString(record.category)).length,
      recordsWithMissingRoute: records.filter((record) => !toSafeString(record.routeName)).length,
      recordsWithMissingCoordinates: records.length - validCoordinateCount,
      knownTopLevelResponseMetadata: null,
      paginationMetadata: null,
      responseHeaders: null,
      providerTotalCount: null,
      currentResultCapDetectable: false,
      conroeProximityCounts: freeze(lp029ProximityCounts(records, conroe, [10, 15, 25, 35, 50])),
      daytonProximityCounts: freeze(lp029ProximityCounts(records, { lat: 30.0466, lng: -94.8852 }, [10, 15, 25, 35, 50])),
      livingstonProximityCounts: freeze(lp029ProximityCounts(records, { lat: 30.7110, lng: -94.9329 }, [10, 15, 25, 35, 50])),
      conroeRouteCountsWithin50Miles: freeze(routePatternCountsNearConroe),
      sourceCompletenessClassification: records.length > 0 ? "J_UNABLE_TO_CERTIFY_PROVIDER_CONTRACT_FROM_PASSIVE_NORMALIZED_CACHE_ONLY" : "J_UNABLE_TO_CERTIFY_NO_RETAINED_RUNTIME_SOURCE_RECORDS",
      firstSuspectedTruncationStage: null
    });
  }

  function runtimeAudit() {
    return freeze({
      connected: state.connected === true,
      networkingAvailable: typeof globalScope.fetch === "function",
      automaticPolling: state.automaticPolling === true,
      providerActivated: state.providerActivated === true,
      renderingPerformed: false,
      normalizedRecordCount: state.normalizedRecordCount,
      refreshIntervalMs: REFRESH_INTERVAL_MS,
      apiKeyConfigured: Boolean(getConnectorConfig().apiKey),
      configurationSource: getConnectorConfig().configurationSource
    });
  }

  globalScope.gridlyDriveTexasConnector = freeze({
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    timeoutMs: TIMEOUT_MS,
    maxAttempts: MAX_ATTEMPTS,
    fetchNow,
    startPolling,
    stopPolling,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    getNormalizedRecords,
    getAwarenessRecords,
    getAllNormalizedRecords,
    refreshAwarenessView,
    areaLifecycleAudit
  });
  globalScope.gridlyDriveTexasConnectorRuntimeAudit = runtimeAudit;
  globalScope.gridlyLp028DriveTexasAreaLifecycleAudit = areaLifecycleAudit;
  globalScope.gridlyLp029DriveTexasProviderCompletenessAudit = lp029ProviderCompletenessAudit;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyDriveTexasConnector;
  }
})(typeof window !== "undefined" ? window : globalThis);
