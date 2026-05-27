(function initGridlyTxdotService(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const TXDOT_SOURCE_LABEL = "txdot";
  const TXDOT_ENDPOINT_TEMPLATE = "https://api.drivetexas.org/api/conditions.geojson?key={api_key}";
  const TXDOT_REFRESH_INTERVAL_MS = 300000;

  globalScope.GRIDLY_CONFIG = globalScope.GRIDLY_CONFIG || {};
  const txdotConfig = (globalScope.GRIDLY_CONFIG.txdot && typeof globalScope.GRIDLY_CONFIG.txdot === "object")
    ? globalScope.GRIDLY_CONFIG.txdot
    : {};

  txdotConfig.apiKey = typeof txdotConfig.apiKey === "string" ? txdotConfig.apiKey : "";
  txdotConfig.endpointTemplate = typeof txdotConfig.endpointTemplate === "string"
    ? txdotConfig.endpointTemplate
    : TXDOT_ENDPOINT_TEMPLATE;
  txdotConfig.refreshIntervalMs = Number.isFinite(Number(txdotConfig.refreshIntervalMs))
    ? Number(txdotConfig.refreshIntervalMs)
    : TXDOT_REFRESH_INTERVAL_MS;

  globalScope.GRIDLY_CONFIG.txdot = txdotConfig;

  const externalStore = Array.isArray(globalScope.gridlyExternalRoadConditions)
    ? globalScope.gridlyExternalRoadConditions
    : [];
  globalScope.gridlyExternalRoadConditions = externalStore;

  const txdotState = (globalScope.gridlyTxdotState && typeof globalScope.gridlyTxdotState === "object")
    ? globalScope.gridlyTxdotState
    : {};
  txdotState.hasFetched = false;
  txdotState.lastFetchOk = null;
  txdotState.lastFetchTime = null;
  txdotState.lastError = null;
  globalScope.gridlyTxdotState = txdotState;

  function toSafeString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function normalizeDirection(value) {
    const normalized = toSafeString(value).toUpperCase();
    if (normalized === "N" || normalized === "NB") return "NB";
    if (normalized === "S" || normalized === "SB") return "SB";
    if (normalized === "E" || normalized === "EB") return "EB";
    if (normalized === "W" || normalized === "WB") return "WB";
    if (normalized === "NS") return "NB/SB";
    if (normalized === "EW") return "EB/WB";
    return "unknown";
  }

  function readRawField(rawIncident, keys) {
    if (!rawIncident || typeof rawIncident !== "object") return "";
    for (const key of keys) {
      if (rawIncident[key] != null) {
        return rawIncident[key];
      }
    }
    return "";
  }


  function toRouteDisplayName(routeNameRaw) {
    const raw = toSafeString(routeNameRaw).toUpperCase();
    if (!raw) return "";

    const match = raw.match(/^(IH|US|SH|FM|RM|CR)0*(\d+)$/);
    if (!match) return toSafeString(routeNameRaw);

    const [, prefix, numberPart] = match;
    const routeNumber = String(Number(numberPart));

    if (prefix === "IH") return `I-${routeNumber}`;
    if (prefix === "US") return `US ${routeNumber}`;
    if (prefix === "SH") return `TX ${routeNumber}`;
    if (prefix === "FM") return `FM ${routeNumber}`;
    if (prefix === "RM") return `RM ${routeNumber}`;
    if (prefix === "CR") return `CR ${routeNumber}`;

    return toSafeString(routeNameRaw);
  }

  function midpointFromLineString(featureGeometry) {
    if (!featureGeometry || typeof featureGeometry !== "object") return { latitude: null, longitude: null };
    if (featureGeometry.type !== "LineString") return { latitude: null, longitude: null };

    const coordinates = Array.isArray(featureGeometry.coordinates) ? featureGeometry.coordinates : [];
    if (!coordinates.length) return { latitude: null, longitude: null };

    const midpointIndex = Math.floor(coordinates.length / 2);
    const midpoint = Array.isArray(coordinates[midpointIndex]) ? coordinates[midpointIndex] : [];
    const longitude = toNumber(midpoint[0]);
    const latitude = toNumber(midpoint[1]);
    return { latitude, longitude };
  }

  function normalizeIncident(rawIncident, featureGeometry) {
    if (!rawIncident || typeof rawIncident !== "object") return null;

    const midpoint = midpointFromLineString(featureGeometry);
    const longitude = midpoint.longitude;
    const latitude = midpoint.latitude;
    const routeNameRaw = toSafeString(rawIncident.route_name);
    const routeNameDisplay = toRouteDisplayName(routeNameRaw);
    const roadName = toSafeString(rawIncident.roadway) || routeNameRaw;
    const condition = toSafeString(rawIncident.condition) || "unknown";
    const titleRoadName = routeNameDisplay || roadName || "unknown road";
    const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
    const hasRoadName = !!roadName;
    const confidence = hasRoadName && hasCoordinates
      ? 1
      : (hasRoadName ? 0.75 : (hasCoordinates ? 0.5 : 0));

    return {
      id: toSafeString(rawIncident.GLOBALID) || `txdot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: TXDOT_SOURCE_LABEL,
      type: condition,
      title: `TxDOT ${condition} on ${titleRoadName}`,
      latitude,
      longitude,
      roadName,
      routeName: routeNameRaw,
      routeNameRaw,
      routeNameDisplay,
      direction: normalizeDirection(rawIncident.travel_direction),
      description: toSafeString(rawIncident.description),
      fromLimit: toSafeString(rawIncident.from_limit),
      toLimit: toSafeString(rawIncident.to_limit),
      startTime: toSafeString(rawIncident.start_time),
      endTime: toSafeString(rawIncident.end_time),
      delayFlag: rawIncident.delay_flag,
      detourFlag: rawIncident.detour_flag,
      countyNum: rawIncident.county_num,
      confidence
    };
  }

  function extractRawRecords(payload) {
    if (Array.isArray(payload)) return payload;

    if (Array.isArray(payload?.features)) {
      return payload.features.map((feature) => {
        if (!feature || typeof feature !== "object") return null;
        const properties = (feature.properties && typeof feature.properties === "object")
          ? feature.properties
          : {};
        return {
          ...properties,
          __geometry: feature.geometry
        };
      }).filter(Boolean);
    }

    if (Array.isArray(payload?.incidents)) return payload.incidents;

    return [];
  }

  async function fetchRoadConditions() {
    const apiKey = toSafeString(globalScope.GRIDLY_CONFIG?.txdot?.apiKey);
    const endpointTemplate = toSafeString(globalScope.GRIDLY_CONFIG?.txdot?.endpointTemplate) || TXDOT_ENDPOINT_TEMPLATE;
    const endpoint = endpointTemplate.replace("{api_key}", apiKey);

    txdotState.hasFetched = true;
    txdotState.lastFetchTime = new Date().toISOString();
    txdotState.lastError = null;

    if (!apiKey) {
      txdotState.lastFetchOk = false;
      txdotState.lastError = "TxDOT API key is not configured";
      externalStore.length = 0;
      return [];
    }

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`TxDOT fetch failed: ${response.status}`);
      }

      const payload = await response.json();
      const rawRecords = extractRawRecords(payload);

      const normalized = rawRecords
        .map((record) => normalizeIncident(record, record?.__geometry))
        .filter(Boolean);

      externalStore.length = 0;
      externalStore.push(...normalized);
      txdotState.lastFetchOk = true;
      return normalized;
    } catch (error) {
      txdotState.lastFetchOk = false;
      txdotState.lastError = error instanceof Error ? error.message : String(error);
      externalStore.length = 0;
      return [];
    }
  }

  function getRoadConditions() {
    return externalStore.slice();
  }

  globalScope.gridlyTxdot = {
    fetchRoadConditions,
    normalizeIncident,
    getRoadConditions
  };

  globalScope.gridlyTxdotDebug = function gridlyTxdotDebug() {
    const serviceLoaded = !!globalScope.gridlyTxdot;
    const apiAvailable = serviceLoaded
      && typeof globalScope.gridlyTxdot.fetchRoadConditions === "function"
      && typeof globalScope.gridlyTxdot.normalizeIncident === "function"
      && typeof globalScope.gridlyTxdot.getRoadConditions === "function";

    return {
      serviceLoaded,
      apiAvailable,
      loadedCount: externalStore.length,
      sampleRecords: externalStore.slice(0, 3),
      hasFetched: !!txdotState.hasFetched,
      lastFetchOk: txdotState.lastFetchOk,
      lastFetchTime: txdotState.lastFetchTime,
      lastError: txdotState.lastError,
      sourceHealthy: serviceLoaded && apiAvailable && txdotState.lastFetchOk !== false
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
