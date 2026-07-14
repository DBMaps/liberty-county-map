(function initGridlyWeatherLiveConnector(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_ID = "weather";
  const PROVIDER_NAME = "Weather";
  const DEFAULT_ENDPOINT = "https://api.weather.gov/alerts/active?area=TX";
  const TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 2;
  const REFRESH_INTERVAL_MS = 120000;

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

  const TRAVEL_IMPACT_PATTERN = /flash flood warning|flood warning|severe thunderstorm warning|tornado warning|dense fog advisory|winter storm warning|winter weather advisory|ice storm warning|blizzard warning|high wind warning|wind advisory|tropical storm warning|hurricane warning|red flag warning/i;

  function activeAwarenessArea() {
    try {
      if (typeof globalScope.getGridlySelectedAwarenessArea === "function") return globalScope.getGridlySelectedAwarenessArea();
      if (typeof globalScope.getGridlyHomeTownAwarenessAnchor === "function") return globalScope.getGridlyHomeTownAwarenessAnchor();
    } catch (error) {}
    return null;
  }

  function recordText(record) {
    return [record?.title, record?.description, record?.category, record?.headline, record?.event, record?.affectedAreas].flat().map(toSafeString).filter(Boolean).join(" ").toLowerCase();
  }

  function isTravelImpacting(record) {
    return TRAVEL_IMPACT_PATTERN.test(recordText(record));
  }

  function matchesAwarenessArea(record) {
    const awareness = activeAwarenessArea();
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
    return (Array.isArray(records) ? records : []).filter((record) => isTravelImpacting(record) && matchesAwarenessArea(record));
  }

  function getProvider() {
    return globalScope.gridlyWeatherProvider || globalScope.gridlyIntelligenceProviders?.[PROVIDER_ID] || null;
  }

  function getConnectorConfig() {
    const gridlyConfig = globalScope.GRIDLY_CONFIG && typeof globalScope.GRIDLY_CONFIG === "object"
      ? globalScope.GRIDLY_CONFIG
      : {};
    const weather = gridlyConfig.weather && typeof gridlyConfig.weather === "object"
      ? gridlyConfig.weather
      : {};

    return {
      endpointTemplate: toSafeString(weather.endpointTemplate) || DEFAULT_ENDPOINT
    };
  }

  function buildEndpoint() {
    return getConnectorConfig().endpointTemplate;
  }

  function createTimeoutController() {
    if (typeof globalScope.AbortController !== "function") return { controller: null, timeoutId: null };
    const controller = new globalScope.AbortController();
    const timeoutId = globalScope.setTimeout(() => controller.abort(), TIMEOUT_MS);
    return { controller, timeoutId };
  }

  function isSupportedNwsPayload(payload) {
    if (!payload || typeof payload !== "object") return false;
    if (payload.type === "FeatureCollection" && Array.isArray(payload.features)) return true;
    if (Array.isArray(payload["@graph"])) return true;
    if (Array.isArray(payload.alerts)) return true;
    return Array.isArray(payload.records);
  }

  function normalizeJsonLdGraph(payload) {
    if (!payload || !Array.isArray(payload["@graph"])) return payload;
    return { records: payload["@graph"] };
  }

  function normalizePayload(payload) {
    if (!isSupportedNwsPayload(payload)) {
      const error = new Error("Weather connector schema validation failed");
      error.gridlyNonRetryable = true;
      throw error;
    }

    const provider = getProvider();
    if (!provider || typeof provider.normalizeRecords !== "function") {
      const error = new Error("Weather provider normalizer unavailable");
      error.gridlyNonRetryable = true;
      throw error;
    }

    return provider.normalizeRecords(normalizeJsonLdGraph(payload)).map(clone).filter(Boolean);
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
      const error = new Error("Weather connector fetch is unavailable");
      error.gridlyNonRetryable = true;
      throw error;
    }

    const { controller, timeoutId } = createTimeoutController();
    try {
      const response = await globalScope.fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        headers: { Accept: "application/geo+json, application/ld+json, application/json" },
        signal: controller ? controller.signal : undefined
      });
      if (!response || response.ok !== true) {
        const status = Number(response?.status) || 0;
        const error = new Error(`Weather connector request failed: ${status || "unknown"}`);
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

  function notifyBriefWeatherRefresh() {
    try { if (typeof globalScope.gridlyRefreshBriefWeather === "function") globalScope.gridlyRefreshBriefWeather(); } catch (error) {}
    try { if (typeof globalScope.gridlyRenderTravelBrief === "function") globalScope.gridlyRenderTravelBrief(); } catch (error) {}
    try { if (typeof globalScope.gridlyUnifiedIntelligencePrototype?.runtime === "function") globalScope.gridlyUnifiedIntelligencePrototype.runtime(); } catch (error) {}
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
          state.connected = true;
          state.lastFetchSucceeded = true;
          state.normalizedRecordCount = normalizedRecords.length;
          state.lastError = null;
          notifyBriefWeatherRefresh();
          return freeze({ connected: true, normalizedRecordCount: normalizedRecords.length });
        } catch (error) {
          lastError = error;
          attempt += 1;
          if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error;
        }
      }
      throw lastError || new Error("Weather connector request failed");
    } catch (error) {
      normalizedRecords = [];
      state.connected = false;
      state.lastFetchSucceeded = false;
      state.normalizedRecordCount = 0;
      state.lastError = error instanceof Error ? error.message : String(error);
      notifyBriefWeatherRefresh();
      return freeze({ connected: false, normalizedRecordCount: 0, error: state.lastError });
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
      refreshIntervalMs: REFRESH_INTERVAL_MS
    });
  }

  globalScope.gridlyWeatherConnector = freeze({
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
  globalScope.gridlyWeatherConnectorRuntimeAudit = runtimeAudit;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyWeatherConnector;
  }
})(typeof window !== "undefined" ? window : globalThis);
