(function initGridlyWeatherProvider(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_NAME = "Weather";
  const PROVIDER_ID = "weather";
  const DEFAULT_ENDPOINT = "https://api.weather.gov/alerts/active?area=TX";
  const NORMALIZED_CATEGORIES = Object.freeze([
    "Flash Flood Warning",
    "Flood Warning",
    "Flood Advisory",
    "Severe Thunderstorm Warning",
    "Severe Thunderstorm Watch",
    "Tornado Warning",
    "Tornado Watch",
    "Special Weather Statement",
    "High Wind Warning",
    "Wind Advisory",
    "Dense Fog Advisory",
    "Winter Weather",
    "Heat Advisory",
    "Excessive Heat Warning",
    "Fire Weather Watch",
    "Red Flag Warning",
    "Air Quality Alert",
    "Coastal Flood Warning",
    "Rip Current Statement",
    "Tropical Storm",
    "Hurricane"
  ]);

  const CATEGORY_PATTERNS = Object.freeze([
    { category: "Flash Flood Warning", pattern: /flash flood warning/i },
    { category: "Flood Warning", pattern: /flood warning/i },
    { category: "Flood Advisory", pattern: /flood advisory/i },
    { category: "Severe Thunderstorm Warning", pattern: /severe thunderstorm warning/i },
    { category: "Severe Thunderstorm Watch", pattern: /severe thunderstorm watch/i },
    { category: "Tornado Warning", pattern: /tornado warning/i },
    { category: "Tornado Watch", pattern: /tornado watch/i },
    { category: "Special Weather Statement", pattern: /special weather statement/i },
    { category: "High Wind Warning", pattern: /high wind warning/i },
    { category: "Wind Advisory", pattern: /wind advisory/i },
    { category: "Dense Fog Advisory", pattern: /dense fog advisory|dense fog|fog/i },
    { category: "Heat Advisory", pattern: /heat advisory/i },
    { category: "Excessive Heat Warning", pattern: /excessive heat warning|extreme heat warning/i },
    { category: "Fire Weather Watch", pattern: /fire weather watch/i },
    { category: "Red Flag Warning", pattern: /red flag warning/i },
    { category: "Air Quality Alert", pattern: /air quality alert|air quality|ozone|particulate/i },
    { category: "Coastal Flood Warning", pattern: /coastal flood warning/i },
    { category: "Rip Current Statement", pattern: /rip current statement/i },
    { category: "Tropical Storm", pattern: /tropical storm/i },
    { category: "Hurricane", pattern: /hurricane/i },
    { category: "Winter Weather", pattern: /winter|ice storm|snow|sleet|freeze|blizzard/i },
    { category: "Flood Warning", pattern: /flood/i }
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

  function collectCoordinates(geometry, points) {
    if (!geometry || typeof geometry !== "object") return;
    if (geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
      points.push(geometry.coordinates);
      return;
    }
    if (Array.isArray(geometry.coordinates)) {
      const visit = (value) => {
        if (!Array.isArray(value)) return;
        if (typeof value[0] === "number" && typeof value[1] === "number") {
          points.push(value);
          return;
        }
        value.forEach(visit);
      };
      visit(geometry.coordinates);
    }
  }

  function normalizeCoordinates(record) {
    const rawLatitude = readFirst(record, ["latitude", "lat"]);
    const rawLongitude = readFirst(record, ["longitude", "lon", "lng"]);
    const explicitLatitude = rawLatitude === "" ? NaN : Number(rawLatitude);
    const explicitLongitude = rawLongitude === "" ? NaN : Number(rawLongitude);
    if (Number.isFinite(explicitLatitude) && Number.isFinite(explicitLongitude)) {
      return { latitude: explicitLatitude, longitude: explicitLongitude };
    }

    const points = [];
    collectCoordinates(record.__geometry, points);
    if (!points.length) return { latitude: null, longitude: null };
    const totals = points.reduce((acc, point) => {
      acc.longitude += Number(point[0]) || 0;
      acc.latitude += Number(point[1]) || 0;
      return acc;
    }, { latitude: 0, longitude: 0 });
    return {
      latitude: Number((totals.latitude / points.length).toFixed(6)),
      longitude: Number((totals.longitude / points.length).toFixed(6))
    };
  }

  function normalizeRecord(record, index) {
    if (!record || typeof record !== "object") return null;
    const category = normalizeCategory(record);
    const sourceId = toSafeString(readFirst(record, ["id", "__sourceId", "event_id", "eventId", "identifier"]));
    const headline = toSafeString(readFirst(record, ["headline", "title", "event", "eventType"]));
    const description = toSafeString(readFirst(record, ["description", "summary", "instruction"]));
    const startTime = toSafeString(readFirst(record, ["effective", "onset", "startTime", "sent", "start"]));
    const endTime = toSafeString(readFirst(record, ["expires", "ends", "endTime", "end"]));
    const coordinates = normalizeCoordinates(record);

    return freeze({
      id: sourceId || `weather-foundation-${index}`,
      provider: PROVIDER_NAME,
      providerId: PROVIDER_ID,
      category,
      title: headline || category,
      description,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      severity: normalizeSeverity(record),
      affectedAreas: normalizeAreas(record),
      effectiveTime: startTime || null,
      expirationTime: endTime || null,
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
      normalizedModelReady: runtime.normalizedModelReady === true && NORMALIZED_CATEGORIES.length >= 20,
      runtimeHealthy: runtime.runtimeHealthy === true,
      uiOwnership: false,
      safeForActivation: runtime.registered === true && runtime.normalizedModelReady === true && runtime.runtimeHealthy === true && runtime.uiOwnership === false
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = providerApi;
  }
})(typeof window !== "undefined" ? window : globalThis);
