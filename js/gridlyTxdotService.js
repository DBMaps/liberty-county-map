(function initGridlyTxdotService(globalScope) {
  if (!globalScope || typeof globalScope !== "object") return;

  const TXDOT_SOURCE_LABEL = "txdot";
  const TXDOT_ENDPOINT_TEMPLATE = "https://api.drivetexas.org/api/conditions.geojson?key={api_key}";
  const TXDOT_REFRESH_INTERVAL_MS = 300000;

  globalScope.GRIDLY_CONFIG = globalScope.GRIDLY_CONFIG || {};
  globalScope.GRIDLY_CONFIG.txdot = globalScope.GRIDLY_CONFIG.txdot || {};
  const configuredApiKey = typeof globalScope.GRIDLY_CONFIG.txdot.apiKey === "string" ? globalScope.GRIDLY_CONFIG.txdot.apiKey.trim() : "";
  const globalApiKey = typeof globalScope.GRIDLY_TXDOT_API_KEY === "string" ? globalScope.GRIDLY_TXDOT_API_KEY.trim() : "";
  globalScope.GRIDLY_CONFIG.txdot.apiKey = globalApiKey || configuredApiKey;

  const txdotConfig = (globalScope.GRIDLY_CONFIG.txdot && typeof globalScope.GRIDLY_CONFIG.txdot === "object")
    ? globalScope.GRIDLY_CONFIG.txdot
    : {};

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

  const rawStore = Array.isArray(globalScope.gridlyTxdotRawRoadConditions)
    ? globalScope.gridlyTxdotRawRoadConditions
    : [];
  globalScope.gridlyTxdotRawRoadConditions = rawStore;

  const txdotState = (globalScope.gridlyTxdotState && typeof globalScope.gridlyTxdotState === "object")
    ? globalScope.gridlyTxdotState
    : {};
  txdotState.hasFetched = false;
  txdotState.lastFetchOk = null;
  txdotState.lastFetchTime = null;
  txdotState.lastError = null;
  txdotState.lastRawCount = 0;
  txdotState.lastNormalizedCount = 0;
  txdotState.lastRawIncidentCount = 0;
  txdotState.lastRawConstructionCount = 0;
  txdotState.lastRawConditionCount = 0;
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

  function toDistanceDisplay(value, unit) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "";
    if (unit === "feet") return `${Math.round(amount)} ft`;
    if (unit === "miles") return `${amount.toFixed(1)} mi`;
    return "";
  }

  function humanizeLocationLimit(limitRaw) {
    const raw = toSafeString(limitRaw);
    if (!raw) return "";

    const pattern = /^([\d.]+)\s+(Feet|Miles)\s+(North|South|East|West)\s+of\s+([A-Z]{2}\d+)\s+on\s+([A-Z]{2}\d+)$/i;
    const match = raw.match(pattern);
    if (!match) return raw;

    const [, distanceValue, unitRaw, directionRaw, roadAtRaw, roadOnRaw] = match;
    const unit = unitRaw.toLowerCase();
    const direction = directionRaw.toLowerCase();
    const distance = toDistanceDisplay(distanceValue, unit);
    const roadAt = toRouteDisplayName(roadAtRaw);
    const roadOn = toRouteDisplayName(roadOnRaw);

    if (!distance || !roadAt || !roadOn) return raw;
    return `${distance} ${direction} of ${roadAt} on ${roadOn}`;
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

    const fromLimitRaw = toSafeString(rawIncident.from_limit);
    const toLimitRaw = toSafeString(rawIncident.to_limit);

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
      fromLimit: fromLimitRaw,
      toLimit: toLimitRaw,
      fromLimitRaw,
      toLimitRaw,
      fromLimitDisplay: humanizeLocationLimit(fromLimitRaw),
      toLimitDisplay: humanizeLocationLimit(toLimitRaw),
      startTime: toSafeString(rawIncident.start_time),
      endTime: toSafeString(rawIncident.end_time),
      delayFlag: rawIncident.delay_flag,
      detourFlag: rawIncident.detour_flag,
      countyNum: rawIncident.county_num,
      confidence
    };
  }


  function getRecordConditionText(record) {
    return [
      readRawField(record, ["condition", "type", "event_type", "category"]),
      readRawField(record, ["description", "title", "summary"])
    ].map((value) => toSafeString(value).toLowerCase()).filter(Boolean).join(" ");
  }

  function summarizeRawRecords(rawRecords) {
    const records = Array.isArray(rawRecords) ? rawRecords : [];
    let construction = 0;
    let incidents = 0;

    records.forEach((record) => {
      const conditionText = getRecordConditionText(record);
      if (/construct|maintenance|lane closure|work zone/.test(conditionText)) {
        construction += 1;
      } else {
        incidents += 1;
      }
    });

    return {
      rawIncidentCount: incidents,
      rawConstructionCount: construction,
      rawConditionCount: records.length
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
      txdotState.lastRawCount = 0;
      txdotState.lastNormalizedCount = 0;
      txdotState.lastRawIncidentCount = 0;
      txdotState.lastRawConstructionCount = 0;
      txdotState.lastRawConditionCount = 0;
      rawStore.length = 0;
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
      const rawCounts = summarizeRawRecords(rawRecords);

      const normalized = rawRecords
        .map((record) => normalizeIncident(record, record?.__geometry))
        .filter(Boolean);

      rawStore.length = 0;
      rawStore.push(...rawRecords);
      externalStore.length = 0;
      externalStore.push(...normalized);
      txdotState.lastFetchOk = true;
      txdotState.lastRawCount = rawRecords.length;
      txdotState.lastNormalizedCount = normalized.length;
      txdotState.lastRawIncidentCount = rawCounts.rawIncidentCount;
      txdotState.lastRawConstructionCount = rawCounts.rawConstructionCount;
      txdotState.lastRawConditionCount = rawCounts.rawConditionCount;
      return normalized;
    } catch (error) {
      txdotState.lastFetchOk = false;
      txdotState.lastError = error instanceof Error ? error.message : String(error);
      txdotState.lastRawCount = 0;
      txdotState.lastNormalizedCount = 0;
      txdotState.lastRawIncidentCount = 0;
      txdotState.lastRawConstructionCount = 0;
      txdotState.lastRawConditionCount = 0;
      rawStore.length = 0;
      externalStore.length = 0;
      return [];
    }
  }

  function getRoadConditions() {
    return externalStore.slice();
  }

  function getRawRoadConditions() {
    return rawStore.slice();
  }

  function getDiagnostics() {
    const rawCounts = summarizeRawRecords(rawStore);
    return {
      hasFetched: !!txdotState.hasFetched,
      lastFetchOk: txdotState.lastFetchOk,
      lastFetchTime: txdotState.lastFetchTime,
      lastError: txdotState.lastError,
      rawCount: rawStore.length,
      normalizedCount: externalStore.length,
      rawIncidentCount: rawCounts.rawIncidentCount,
      rawConstructionCount: rawCounts.rawConstructionCount,
      rawConditionCount: rawCounts.rawConditionCount,
      sampleRawRows: rawStore.slice(0, 3),
      sampleNormalizedRows: externalStore.slice(0, 3)
    };
  }


  function isFlagged(value) {
    if (value === true || value === 1) return true;
    const normalized = toSafeString(value).toLowerCase();
    return normalized === "1" || normalized === "y" || normalized === "yes" || normalized === "true";
  }

  function buildTopEntries(countMap, limit) {
    return Array.from(countMap.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }));
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function buildTextSearchBlob(event) {
    return [
      toSafeString(event?.routeNameDisplay),
      toSafeString(event?.title),
      toSafeString(event?.fromLimitDisplay),
      toSafeString(event?.toLimitDisplay)
    ].join(" ").toUpperCase();
  }

  function matchesCorridor(event, corridors) {
    if (!event || !corridors.length) return false;
    const haystack = buildTextSearchBlob(event);
    return corridors.some((corridor) => haystack.includes(corridor));
  }

  function getLocalRecords(options) {
    const config = (options && typeof options === "object") ? options : {};
    const countyNum = Number.isFinite(Number(config.countyNum)) ? Number(config.countyNum) : 146;
    const defaultCorridors = ["US 90", "TX 146", "TX 321", "FM 1960", "FM 1409", "FM 1008"];
    const corridors = toArray(config.corridors)
      .map((value) => toSafeString(value).toUpperCase())
      .filter(Boolean);
    const corridorList = corridors.length ? corridors : defaultCorridors.map((name) => name.toUpperCase());

    const records = externalStore.slice();
    const libertyCountyRecords = records.filter((event) => Number(event?.countyNum) === countyNum);
    const corridorRecords = records.filter((event) => matchesCorridor(event, corridorList));
    const localRecordMap = new Map();

    for (const event of libertyCountyRecords) {
      localRecordMap.set(event.id, event);
    }
    for (const event of corridorRecords) {
      localRecordMap.set(event.id, event);
    }

    return {
      localRecords: Array.from(localRecordMap.values()),
      libertyCountyRecords,
      corridorRecords
    };
  }

  function buildLocalRecommendation(event) {
    if (isFlagged(event?.delayFlag)) return "Expect delays.";
    if (isFlagged(event?.detourFlag)) return "Detour in effect.";

    const type = toSafeString(event?.type).toLowerCase();
    if (type === "flooding") return "Use caution around flooded roadway conditions.";
    if (type === "closure") return "Road closure active.";
    if (type === "damage") return "Road damage reported.";
    return "Monitor roadway conditions.";
  }

  globalScope.gridlyTxdot = {
    fetchRoadConditions,
    normalizeIncident,
    getRoadConditions,
    getRawRoadConditions,
    getDiagnostics
  };



  globalScope.gridlyTxdotAnalytics = function gridlyTxdotAnalytics() {
    const records = externalStore.slice();
    const conditionCounts = {};
    const countyCounts = {};
    const directionCounts = {};
    const roadCounts = new Map();
    const conditionCountMap = new Map();

    let delayedEvents = 0;
    let detourEvents = 0;

    for (const event of records) {
      const condition = toSafeString(event?.type) || "unknown";
      const countyKey = event?.countyNum != null ? String(event.countyNum) : "unknown";
      const direction = toSafeString(event?.direction) || "unknown";
      const roadName = toSafeString(event?.routeNameDisplay)
        || toSafeString(event?.routeName)
        || toSafeString(event?.roadName)
        || "unknown";

      conditionCounts[condition] = (conditionCounts[condition] || 0) + 1;
      countyCounts[countyKey] = (countyCounts[countyKey] || 0) + 1;
      directionCounts[direction] = (directionCounts[direction] || 0) + 1;

      roadCounts.set(roadName, (roadCounts.get(roadName) || 0) + 1);
      conditionCountMap.set(condition, (conditionCountMap.get(condition) || 0) + 1);

      if (isFlagged(event?.delayFlag)) delayedEvents += 1;
      if (isFlagged(event?.detourFlag)) detourEvents += 1;
    }

    const libertyCountyEvents = records.filter((record) => Number(record?.countyNum) === 146);

    return {
      totalEvents: records.length,
      conditionCounts,
      delayedEvents,
      detourEvents,
      countyCounts,
      directionCounts,
      topRoads: buildTopEntries(roadCounts, 10),
      topConditions: buildTopEntries(conditionCountMap, 10),
      libertyCountyEvents: libertyCountyEvents.length,
      sampleLibertyCountyEvents: libertyCountyEvents.slice(0, 5)
    };
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
      rawCount: rawStore.length,
      sampleRecords: externalStore.slice(0, 3),
      sampleRawRecords: rawStore.slice(0, 3),
      hasFetched: !!txdotState.hasFetched,
      lastFetchOk: txdotState.lastFetchOk,
      lastFetchTime: txdotState.lastFetchTime,
      lastError: txdotState.lastError,
      sourceHealthy: serviceLoaded && apiAvailable && txdotState.lastFetchOk !== false
    };
  };

  globalScope.gridlyTxdotLocalFocus = function gridlyTxdotLocalFocus(options) {
    const { localRecords, libertyCountyRecords, corridorRecords } = getLocalRecords(options);
    const delayedLocalEvents = localRecords.filter((event) => isFlagged(event?.delayFlag));
    const detourLocalEvents = localRecords.filter((event) => isFlagged(event?.detourFlag));
    const activeConstruction = localRecords.filter((event) => toSafeString(event?.type).toLowerCase() === "construction");
    const activeClosures = localRecords.filter((event) => toSafeString(event?.type).toLowerCase() === "closure");
    const activeFlooding = localRecords.filter((event) => toSafeString(event?.type).toLowerCase() === "flooding");
    const activeDamage = localRecords.filter((event) => toSafeString(event?.type).toLowerCase() === "damage");

    return {
      totalLocalEvents: localRecords.length,
      libertyCountyEvents: libertyCountyRecords.length,
      corridorEvents: corridorRecords.length,
      delayedLocalEvents: delayedLocalEvents.length,
      detourLocalEvents: detourLocalEvents.length,
      activeConstruction: activeConstruction.length,
      activeClosures: activeClosures.length,
      activeFlooding: activeFlooding.length,
      activeDamage: activeDamage.length,
      sampleEvents: localRecords.slice(0, 10)
    };
  };

  globalScope.gridlyTxdotLocalSummaries = function gridlyTxdotLocalSummaries(options) {
    const localFocus = globalScope.gridlyTxdotLocalFocus(options);
    const localRecords = toArray(localFocus?.sampleEvents).length === Number(localFocus?.totalLocalEvents)
      ? toArray(localFocus.sampleEvents)
      : getLocalRecords(options).localRecords;

    const summaries = localRecords
      .map((event) => {
        const title = toSafeString(event?.title);
        const direction = toSafeString(event?.direction) || "unknown";
        return {
          id: toSafeString(event?.id),
          primary: `${title} ${direction}`.trim(),
          secondary: `${toSafeString(event?.fromLimitDisplay)} to ${toSafeString(event?.toLimitDisplay)}`.trim(),
          recommendation: buildLocalRecommendation(event),
          confidence: Number.isFinite(Number(event?.confidence)) ? Number(event.confidence) : 0,
          source: toSafeString(event?.source) || TXDOT_SOURCE_LABEL,
          delayFlag: isFlagged(event?.delayFlag),
          detourFlag: isFlagged(event?.detourFlag)
        };
      })
      .sort((a, b) => {
        if (a.detourFlag !== b.detourFlag) return a.detourFlag ? -1 : 1;
        if (a.delayFlag !== b.delayFlag) return a.delayFlag ? -1 : 1;
        return b.confidence - a.confidence;
      })
      .slice(0, 10)
      .map(({ delayFlag, detourFlag, ...summary }) => summary);

    return {
      totalSummaries: summaries.length,
      summaries
    };
  };
})(typeof window !== "undefined" ? window : globalThis);
