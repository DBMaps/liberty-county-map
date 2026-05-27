(function initGridlyTxdotService(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const TXDOT_SOURCE_LABEL = "txdot";
  const TXDOT_DEFAULT_ENDPOINT = "";

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
    if (["NB", "SB", "EB", "WB"].includes(normalized)) return normalized;
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

  function normalizeIncident(rawIncident) {
    if (!rawIncident || typeof rawIncident !== "object") return null;

    const latitude = toNumber(readRawField(rawIncident, ["latitude", "lat", "y"]));
    const longitude = toNumber(readRawField(rawIncident, ["longitude", "lon", "lng", "x"]));

    return {
      id: toSafeString(readRawField(rawIncident, ["id", "incidentId", "event_id"])) || `txdot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: TXDOT_SOURCE_LABEL,
      type: toSafeString(readRawField(rawIncident, ["type", "category", "event_type"])) || "unknown",
      title: toSafeString(readRawField(rawIncident, ["title", "headline", "event_title"])) || "TxDOT Incident",
      latitude,
      longitude,
      roadName: toSafeString(readRawField(rawIncident, ["roadName", "road", "roadway", "highway"])),
      direction: normalizeDirection(readRawField(rawIncident, ["direction", "travel_direction", "dir"])),
      severity: toSafeString(readRawField(rawIncident, ["severity", "priority", "impact"])) || "unknown",
      description: toSafeString(readRawField(rawIncident, ["description", "details", "comment"])),
      startTime: toSafeString(readRawField(rawIncident, ["startTime", "start_time", "begin_time"])),
      endTime: toSafeString(readRawField(rawIncident, ["endTime", "end_time", "expire_time"])),
      confidence: toNumber(readRawField(rawIncident, ["confidence", "confidence_score", "score"]))
    };
  }

  async function fetchRoadConditions() {
    const endpoint = TXDOT_DEFAULT_ENDPOINT;

    txdotState.hasFetched = true;
    txdotState.lastFetchTime = new Date().toISOString();
    txdotState.lastError = null;

    if (!endpoint) {
      txdotState.lastFetchOk = false;
      txdotState.lastError = "TxDOT endpoint is not configured";
      externalStore.length = 0;
      return [];
    }

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`TxDOT fetch failed: ${response.status}`);
      }

      const payload = await response.json();
      const rawRecords = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.incidents)
          ? payload.incidents
          : [];

      const normalized = rawRecords.map(normalizeIncident).filter(Boolean);
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
      sourceHealthy: serviceLoaded && apiAvailable
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
