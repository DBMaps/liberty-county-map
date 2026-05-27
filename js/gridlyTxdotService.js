(function initGridlyTxdotService(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const TXDOT_SOURCE_LABEL = "txdot";
  const TXDOT_DEFAULT_ENDPOINT = "";

  const externalStore = Array.isArray(globalScope.gridlyExternalRoadConditions)
    ? globalScope.gridlyExternalRoadConditions
    : [];
  globalScope.gridlyExternalRoadConditions = externalStore;

  let sourceHealthy = false;

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

    if (!endpoint) {
      sourceHealthy = false;
      externalStore.length = 0;
      return [];
    }

    const response = await fetch(endpoint);
    if (!response.ok) {
      sourceHealthy = false;
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
    sourceHealthy = true;
    return normalized;
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
    return {
      loadedCount: externalStore.length,
      sampleRecords: externalStore.slice(0, 3),
      sourceHealthy
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
