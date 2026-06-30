(function initGridlyDriveTexasLiveConnector(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_ID = "drivetexas";
  const PROVIDER_NAME = "DriveTexas";
  const DEFAULT_ENDPOINT = "https://api.drivetexas.org/api/conditions.geojson?key={api_key}";
  const TIMEOUT_MS = 8000;
  const MAX_ATTEMPTS = 2;

  const state = {
    connected: false,
    networkingAvailable: typeof globalScope.fetch === "function",
    automaticPolling: false,
    providerActivated: false,
    renderingPerformed: false,
    normalizedRecordCount: 0,
    lastFetchSucceeded: false,
    lastError: null,
    lastRequestAt: null
  };

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

    return {
      endpointTemplate: toSafeString(driveTexas.endpointTemplate) || toSafeString(legacyTxdot.endpointTemplate) || DEFAULT_ENDPOINT,
      apiKey: toSafeString(driveTexas.apiKey) || toSafeString(legacyTxdot.apiKey) || toSafeString(globalScope.GRIDLY_TXDOT_API_KEY)
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

  async function fetchNow() {
    state.networkingAvailable = typeof globalScope.fetch === "function";
    state.lastRequestAt = new Date().toISOString();
    let attempt = 0;
    let lastError = null;

    try {
      const endpoint = buildEndpoint();
      while (attempt < MAX_ATTEMPTS) {
        try {
          const payload = await requestPayload(endpoint);
          normalizedRecords = normalizePayload(payload);
          state.connected = true;
          state.lastFetchSucceeded = true;
          state.normalizedRecordCount = normalizedRecords.length;
          state.lastError = null;
          return freeze({ connected: true, normalizedRecordCount: normalizedRecords.length });
        } catch (error) {
          lastError = error;
          attempt += 1;
          if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error;
        }
      }
      throw lastError || new Error("DriveTexas connector request failed");
    } catch (error) {
      normalizedRecords = [];
      state.connected = false;
      state.lastFetchSucceeded = false;
      state.normalizedRecordCount = 0;
      state.lastError = error instanceof Error ? error.message : String(error);
      return freeze({ connected: false, normalizedRecordCount: 0, error: state.lastError });
    }
  }

  function getNormalizedRecords() {
    return freeze(normalizedRecords.map(clone).filter(Boolean));
  }

  function runtimeAudit() {
    return freeze({
      connected: state.connected === true,
      networkingAvailable: typeof globalScope.fetch === "function",
      automaticPolling: false,
      providerActivated: false,
      renderingPerformed: false,
      normalizedRecordCount: state.normalizedRecordCount
    });
  }

  globalScope.gridlyDriveTexasConnector = freeze({
    providerId: PROVIDER_ID,
    providerName: PROVIDER_NAME,
    timeoutMs: TIMEOUT_MS,
    maxAttempts: MAX_ATTEMPTS,
    fetchNow,
    getNormalizedRecords
  });
  globalScope.gridlyDriveTexasConnectorRuntimeAudit = runtimeAudit;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyDriveTexasConnector;
  }
})(typeof window !== "undefined" ? window : globalThis);
