(function initGridlyDriveTexasProvider(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDER_NAME = "DriveTexas";
  const PROVIDER_ID = "drivetexas";
  const DEFAULT_ENDPOINT = "https://api.drivetexas.org/api/conditions.geojson?key={api_key}";
  const NORMALIZED_CATEGORIES = Object.freeze([
    "Road Closure",
    "Flooding",
    "Construction",
    "Lane Closure",
    "Crash",
    "Bridge Restriction",
    "Travel Advisory"
  ]);

  const CATEGORY_PATTERNS = Object.freeze([
    { category: "Flooding", pattern: /flood|high water|water over|standing water/i },
    { category: "Crash", pattern: /crash|accident|collision|wreck/i },
    { category: "Bridge Restriction", pattern: /bridge|weight limit|height limit|restriction/i },
    { category: "Lane Closure", pattern: /lane closure|left lane|right lane|lanes closed|lane blocked|shoulder/i },
    { category: "Road Closure", pattern: /road closure|closed|closure|shut down|blocked/i },
    { category: "Construction", pattern: /construct|maintenance|work zone|road work|repair/i },
    { category: "Travel Advisory", pattern: /advisory|alert|delay|detour|condition|incident/i }
  ]);

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    return Object.freeze(value);
  }

  function toSafeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  globalScope.GRIDLY_CONFIG = globalScope.GRIDLY_CONFIG || {};
  const configured = globalScope.GRIDLY_CONFIG.driveTexas && typeof globalScope.GRIDLY_CONFIG.driveTexas === "object"
    ? globalScope.GRIDLY_CONFIG.driveTexas
    : {};
  const legacyTxdot = globalScope.GRIDLY_CONFIG.txdot && typeof globalScope.GRIDLY_CONFIG.txdot === "object"
    ? globalScope.GRIDLY_CONFIG.txdot
    : {};

  const config = {
    enabled: configured.enabled === true,
    endpointTemplate: toSafeString(configured.endpointTemplate) || toSafeString(legacyTxdot.endpointTemplate) || DEFAULT_ENDPOINT,
    apiKey: toSafeString(configured.apiKey) || toSafeString(legacyTxdot.apiKey) || toSafeString(globalScope.GRIDLY_TXDOT_API_KEY)
  };
  globalScope.GRIDLY_CONFIG.driveTexas = config;

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
    return registry.getPackage("intelligence.drivetexas");
  }

  function providerRegistered() {
    const pkg = getRegistryPackage();
    return Boolean(pkg && pkg.packageType === "intelligence" && pkg.intelligence?.providerId === PROVIDER_ID);
  }

  function extractGeometry(record) {
    if (!record || typeof record !== "object") return null;
    return record.__geometry || record.geometry || record.rawGeometry || null;
  }

  function getCoordinates(record) {
    const geometry = extractGeometry(record);
    if (geometry && geometry.type === "Point" && Array.isArray(geometry.coordinates)) {
      return { longitude: toFiniteNumber(geometry.coordinates[0]), latitude: toFiniteNumber(geometry.coordinates[1]) };
    }
    if (geometry && geometry.type === "LineString" && Array.isArray(geometry.coordinates) && geometry.coordinates.length) {
      const midpoint = geometry.coordinates[Math.floor(geometry.coordinates.length / 2)] || [];
      return { longitude: toFiniteNumber(midpoint[0]), latitude: toFiniteNumber(midpoint[1]) };
    }
    return {
      longitude: toFiniteNumber(record.longitude ?? record.lon ?? record.lng ?? record.x),
      latitude: toFiniteNumber(record.latitude ?? record.lat ?? record.y)
    };
  }

  function readFirst(record, keys) {
    for (const key of keys) {
      if (record && record[key] != null) return record[key];
    }
    return "";
  }

  function normalizeCategory(record) {
    const text = [
      readFirst(record, ["condition", "event_type", "eventType", "type", "category"]),
      readFirst(record, ["description", "summary", "title", "headline"])
    ].map(toSafeString).join(" ");

    const match = CATEGORY_PATTERNS.find((entry) => entry.pattern.test(text));
    return match ? match.category : "Travel Advisory";
  }

  function extractRawRecords(payload) {
    if (Array.isArray(payload)) return payload.slice();
    if (Array.isArray(payload?.features)) {
      return payload.features.map((feature) => {
        if (!feature || typeof feature !== "object") return null;
        const properties = feature.properties && typeof feature.properties === "object" ? feature.properties : {};
        return Object.assign({}, properties, { __geometry: feature.geometry || null });
      }).filter(Boolean);
    }
    if (Array.isArray(payload?.incidents)) return payload.incidents.slice();
    if (Array.isArray(payload?.records)) return payload.records.slice();
    return [];
  }

  function normalizeRecord(record, index) {
    if (!record || typeof record !== "object") return null;
    const coordinates = getCoordinates(record);
    const category = normalizeCategory(record);
    const routeName = toSafeString(readFirst(record, ["route_name", "routeName", "roadway", "road", "highway"]));
    const sourceId = toSafeString(readFirst(record, ["GLOBALID", "globalId", "id", "event_id", "eventId"]));
    const description = toSafeString(readFirst(record, ["description", "summary", "title", "headline"]));
    const startTime = toSafeString(readFirst(record, ["start_time", "startTime", "start", "beginDate"]));
    const endTime = toSafeString(readFirst(record, ["end_time", "endTime", "end", "endDate"]));

    return freeze({
      id: sourceId || `drivetexas-foundation-${index}`,
      provider: PROVIDER_NAME,
      providerId: PROVIDER_ID,
      category,
      title: `${category}${routeName ? ` on ${routeName}` : ""}`,
      description,
      routeName,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
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

  async function refresh(options) {
    if (state.enabled !== true) {
      state.connected = false;
      state.runtimeHealthy = true;
      state.lastError = null;
      return getRuntimeState();
    }

    try {
      const injectedPayload = options && Object.prototype.hasOwnProperty.call(options, "payload") ? options.payload : undefined;
      const payload = injectedPayload !== undefined
        ? injectedPayload
        : await requestPayload();
      const validation = validatePayload(payload);
      if (!validation.valid) throw new Error("DriveTexas response validation failed");
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

  async function requestPayload() {
    const apiKey = toSafeString(config.apiKey);
    if (!apiKey) throw new Error("DriveTexas API key is not configured");
    const endpoint = config.endpointTemplate.replace("{api_key}", encodeURIComponent(apiKey));
    const response = await fetch(endpoint);
    if (!response || response.ok !== true) throw new Error(`DriveTexas request failed: ${response?.status || "unknown"}`);
    return response.json();
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
  globalScope.gridlyDriveTexasProvider = providerApi;
  globalScope.gridlyDriveTexasProviderAudit = function gridlyDriveTexasProviderAudit() {
    const runtime = getRuntimeState();
    return freeze({
      provider: PROVIDER_NAME,
      registered: runtime.registered === true,
      enabled: runtime.enabled === true,
      connected: runtime.connected === true,
      normalizedModelReady: runtime.normalizedModelReady === true && NORMALIZED_CATEGORIES.length === 7,
      runtimeHealthy: runtime.runtimeHealthy === true,
      uiOwnership: false,
      safeForActivation: runtime.registered === true && runtime.normalizedModelReady === true && runtime.runtimeHealthy === true && runtime.uiOwnership === false
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = providerApi;
  }
})(typeof window !== "undefined" ? window : globalThis);
