(function initGridlyWeatherProvider(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_NAME = "Weather";
  const PROVIDER_ID = "weather";
  const DEFAULT_ENDPOINT = "https://api.weather.gov/alerts/active?area=TX";
  const NORMALIZED_CATEGORIES = Object.freeze([
    "Flash Flood Warning",
    "Flood Warning",
    "Severe Thunderstorm Warning",
    "Tornado Warning",
    "Tropical Storm",
    "Hurricane",
    "Dense Fog",
    "High Wind",
    "Winter Weather",
    "Extreme Heat",
    "Fire Weather",
    "Air Quality"
  ]);

  const CATEGORY_PATTERNS = Object.freeze([
    { category: "Flash Flood Warning", pattern: /flash flood/i },
    { category: "Flood Warning", pattern: /flood/i },
    { category: "Severe Thunderstorm Warning", pattern: /severe thunderstorm/i },
    { category: "Tornado Warning", pattern: /tornado/i },
    { category: "Tropical Storm", pattern: /tropical storm/i },
    { category: "Hurricane", pattern: /hurricane/i },
    { category: "Dense Fog", pattern: /dense fog|fog/i },
    { category: "High Wind", pattern: /high wind|wind advisory|wind warning/i },
    { category: "Winter Weather", pattern: /winter|ice storm|snow|sleet|freeze|blizzard/i },
    { category: "Extreme Heat", pattern: /extreme heat|excessive heat|heat advisory/i },
    { category: "Fire Weather", pattern: /fire weather|red flag/i },
    { category: "Air Quality", pattern: /air quality|ozone|particulate/i }
  ]);

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function toSafeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function readFirst(record, keys) {
    for (const key of keys) {
      if (record && record[key] != null) return record[key];
    }
    return "";
  }

  globalScope.GRIDLY_CONFIG = globalScope.GRIDLY_CONFIG || {};
  const configured = globalScope.GRIDLY_CONFIG.weather && typeof globalScope.GRIDLY_CONFIG.weather === "object"
    ? globalScope.GRIDLY_CONFIG.weather
    : {};

  const config = {
    enabled: configured.enabled === true,
    endpointTemplate: toSafeString(configured.endpointTemplate) || DEFAULT_ENDPOINT
  };
  globalScope.GRIDLY_CONFIG.weather = config;

  const state = {
    provider: PROVIDER_NAME,
    registered: true,
    enabled: config.enabled === true,
    connected: false,
    lastRefresh: null,
    recordCount: 0,
    runtimeHealthy: true,
    normalizedModelReady: true,
    uiOwnership: false,
    lastError: null
  };

  let normalizedStore = [];

  function getRegistryPackage() {
    const registry = globalScope.gridlyPackageRegistry;
    if (!registry || typeof registry.getPackage !== "function") return null;
    return registry.getPackage("intelligence.weather");
  }

  function providerRegistered() {
    const pkg = getRegistryPackage();
    return Boolean(pkg && pkg.packageType === "intelligence" && pkg.intelligence?.providerId === PROVIDER_ID);
  }

  function extractRawRecords(payload) {
    if (Array.isArray(payload)) return payload.slice();
    if (Array.isArray(payload?.features)) {
      return payload.features.map((feature) => {
        if (!feature || typeof feature !== "object") return null;
        const properties = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
        return Object.assign({}, properties, { __geometry: feature.geometry || null, __sourceId: feature.id || null });
      }).filter(Boolean);
    }
    if (Array.isArray(payload?.alerts)) return payload.alerts.slice();
    if (Array.isArray(payload?.records)) return payload.records.slice();
    return [];
  }

  function normalizeCategory(record) {
    const text = [
      readFirst(record, ["event", "eventType", "type", "category", "headline"]),
      readFirst(record, ["description", "instruction", "summary", "title"])
    ].map(toSafeString).join(" ");

    const match = CATEGORY_PATTERNS.find((entry) => entry.pattern.test(text));
    return match ? match.category : "Weather Advisory";
  }

  function normalizeSeverity(record) {
    const severity = toSafeString(readFirst(record, ["severity", "level", "urgency"]));
    return severity || "Unknown";
  }

  function normalizeAreas(record) {
    const areaDescription = toSafeString(readFirst(record, ["areaDesc", "areaDescription", "areas", "county", "counties"]));
    if (!areaDescription) return freeze([]);
    return freeze(areaDescription.split(/[;,]/).map((area) => area.trim()).filter(Boolean));
  }

  function normalizeRecord(record, index) {
    if (!record || typeof record !== "object") return null;
    const category = normalizeCategory(record);
    const sourceId = toSafeString(readFirst(record, ["id", "__sourceId", "event_id", "eventId", "identifier"]));
    const headline = toSafeString(readFirst(record, ["headline", "title", "event", "eventType"]));
    const description = toSafeString(readFirst(record, ["description", "summary", "instruction"]));
    const startTime = toSafeString(readFirst(record, ["effective", "onset", "startTime", "sent", "start"]));
    const endTime = toSafeString(readFirst(record, ["expires", "ends", "endTime", "end"]));

    return freeze({
      id: sourceId || `weather-foundation-${index}`,
      provider: PROVIDER_NAME,
      providerId: PROVIDER_ID,
      category,
      title: headline || category,
      description,
      severity: normalizeSeverity(record),
      affectedAreas: normalizeAreas(record),
      startTime: startTime || null,
      endTime: endTime || null,
      sourceTrace: freeze({ provider: PROVIDER_NAME, sourceId: sourceId || null }),
      rawPayloadExposed: false
    });
  }

  function normalizeRecords(input) {
    const rawRecords = extractRawRecords(input);
    return freeze(rawRecords.map(normalizeRecord).filter(Boolean));
  }

  function validatePayload(payload) {
    const records = extractRawRecords(payload);
    return freeze({ valid: Array.isArray(records), recordCount: records.length });
  }

  async function requestPayload() {
    const response = await fetch(config.endpointTemplate);
    if (!response || response.ok !== true) throw new Error(`Weather request failed: ${response?.status || "unknown"}`);
    return response.json();
  }

  async function refresh(options) {
    if (state.enabled !== true) {
      state.connected = false;
      state.runtimeHealthy = true;
      state.lastError = null;
      return getRuntimeState();
    }

    try {
      const injectedPayload = options && Object.prototype.hasOwnProperty.call(options, "payload") ? options.payload : undefined;
      const payload = injectedPayload !== undefined ? injectedPayload : await requestPayload();
      const validation = validatePayload(payload);
      if (!validation.valid) throw new Error("Weather response validation failed");
      normalizedStore = normalizeRecords(payload).slice();
      state.connected = true;
      state.lastRefresh = new Date().toISOString();
      state.recordCount = normalizedStore.length;
      state.runtimeHealthy = true;
      state.lastError = null;
      return getRuntimeState();
    } catch (error) {
      normalizedStore = [];
      state.connected = false;
      state.recordCount = 0;
      state.runtimeHealthy = true;
      state.lastError = error instanceof Error ? error.message : String(error);
      return getRuntimeState();
    }
  }

  function getRuntimeState() {
    state.registered = providerRegistered();
    state.enabled = config.enabled === true;
    return freeze(Object.assign({}, state));
  }

  function getNormalizedRecords() {
    return freeze(normalizedStore.map(clone).filter(Boolean));
  }

  const providerApi = freeze({
    id: PROVIDER_ID,
    name: PROVIDER_NAME,
    categories: NORMALIZED_CATEGORIES,
    getRuntimeState,
    normalizeRecords,
    validatePayload,
    refresh,
    getNormalizedRecords
  });

  globalScope.gridlyIntelligenceProviders = globalScope.gridlyIntelligenceProviders && typeof globalScope.gridlyIntelligenceProviders === "object"
    ? globalScope.gridlyIntelligenceProviders
    : {};
  globalScope.gridlyIntelligenceProviders[PROVIDER_ID] = providerApi;
  globalScope.gridlyWeatherProvider = providerApi;
  globalScope.gridlyWeatherProviderAudit = function gridlyWeatherProviderAudit() {
    const runtime = getRuntimeState();
    return freeze({
      provider: PROVIDER_NAME,
      registered: runtime.registered === true,
      enabled: runtime.enabled === true,
      connected: runtime.connected === true,
      normalizedModelReady: runtime.normalizedModelReady === true && NORMALIZED_CATEGORIES.length === 12,
      runtimeHealthy: runtime.runtimeHealthy === true,
      uiOwnership: false,
      safeForActivation: runtime.registered === true && runtime.normalizedModelReady === true && runtime.runtimeHealthy === true && runtime.uiOwnership === false
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = providerApi;
  }
})(typeof window !== "undefined" ? window : globalThis);
