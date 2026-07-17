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

  let normalizedRecords = [];
  let lastRecordSignature = null;

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
    const terms = [awareness.label, awareness.storageValue, awareness.key, awareness.countyId]
      .map(toSafeString)
      .map((value) => value.toLowerCase().replace(/-tx$/, "").replace(/ county$/, ""))
      .filter(Boolean);
    const text = recordText(record);
    return Boolean(text && terms.some((term) => term && text.includes(term)));
  }

  function filterAwarenessRecords(records) {
    if (typeof globalScope.gridlyLp016RecordAwarenessSwitchEvent === "function") globalScope.gridlyLp016RecordAwarenessSwitchEvent("driveTexasRefreshStarted", {});
    const awareness = activeAwarenessArea();
    if (globalScope.gridlySelectedAwarenessAreaResolutionCache && typeof globalScope.gridlySelectedAwarenessAreaResolutionCache === "object") {
      globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount = Number(globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount || 0) + 1;
      globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount = Number(globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount || 0);
    }
    const filteredRecords = (Array.isArray(records) ? records : []).filter((record) => matchesAwarenessArea(record, awareness));
    if (typeof globalScope.gridlyLp016RecordAwarenessSwitchEvent === "function") globalScope.gridlyLp016RecordAwarenessSwitchEvent("driveTexasRefreshCompleted", { recordCount: filteredRecords.length });
    return filteredRecords;
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
          const payload = await requestPayload(endpoint);
          normalizedRecords = filterAwarenessRecords(normalizePayload(payload));
          const recordSignature = buildRecordSignature(normalizedRecords);
          const evidenceChanged = recordSignature !== lastRecordSignature;
          lastRecordSignature = recordSignature;
          state.connected = true;
          state.lastFetchSucceeded = true;
          state.normalizedRecordCount = normalizedRecords.length;
          state.lastError = null;
          notifyOfficialConsumers(recordSignature, evidenceChanged, "drivetexas-fetch-success");
          return freeze({ connected: true, normalizedRecordCount: normalizedRecords.length, evidenceChanged });
        } catch (error) {
          lastError = error;
          attempt += 1;
          if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error;
        }
      }
      throw lastError || new Error("DriveTexas connector request failed");
    } catch (error) {
      normalizedRecords = [];
      const recordSignature = buildRecordSignature(normalizedRecords);
      const evidenceChanged = recordSignature !== lastRecordSignature;
      lastRecordSignature = recordSignature;
      state.connected = false;
      state.lastFetchSucceeded = false;
      state.normalizedRecordCount = 0;
      state.lastError = error instanceof Error ? error.message : String(error);
      notifyOfficialConsumers(recordSignature, evidenceChanged, "drivetexas-fetch-failure");
      return freeze({ connected: false, normalizedRecordCount: 0, error: state.lastError, evidenceChanged });
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
    return freeze(normalizedRecords.map(clone).filter(Boolean));
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
    getNormalizedRecords
  });
  globalScope.gridlyDriveTexasConnectorRuntimeAudit = runtimeAudit;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyDriveTexasConnector;
  }
})(typeof window !== "undefined" ? window : globalThis);
