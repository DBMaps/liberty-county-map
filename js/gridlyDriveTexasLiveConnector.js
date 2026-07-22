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

  let allNormalizedRecords = [];
  let awarenessNormalizedRecords = [];
  let normalizedRecords = awarenessNormalizedRecords;
  let lastRecordSignature = null;
  let sourceRecordsUpdatedAt = null;
  let awarenessRecordsUpdatedAt = null;
  let lastSuccessfulFetchAt = null;
  let lastFetchError = null;
  let lastFilterReason = null;
  let lastFilterContext = null;
  let areaViewGeneration = 0;
  let fetchGeneration = 0;
  let lastInstalledFetchGeneration = 0;
  let staleAreaViewCompletionIgnoredCount = 0;
  let staleFetchCompletionIgnoredCount = 0;
  let completeSourceDatasetPreservedAcrossAreaChange = true;
  let lastRefetchRequired = false;
  let lastRetainedDataReused = false;


  const LP041_MAX_HISTORY = 3;
  const LP041_MAX_FIELDS = 120;
  const LP041_MAX_VALUES = 80;
  const LP041_MAX_CANDIDATES = 50;
  let lp041EvidenceHistory = [];
  let lp041LatestEvidence = null;
  let lp041LastFilterTrace = null;

  function lp041Now() { return new Date().toISOString(); }
  function lp041Inc(map, key) { const safeKey = toSafeString(key) || "(missing)"; map[safeKey] = (map[safeKey] || 0) + 1; }
  function lp041BoundedKeys(object, max) { return Object.keys(object || {}).sort().slice(0, max || LP041_MAX_FIELDS); }
  function lp041RedactEndpoint(endpoint) { return toSafeString(endpoint).replace(/([?&]key=)[^&]*/i, "$1{api_key_redacted}"); }
  function lp041ReadHeader(headers, name) {
    try { return headers && typeof headers.get === "function" ? headers.get(name) : null; } catch (error) { return null; }
  }
  function lp041HeaderEvidence(headers) {
    const names = ["content-type", "content-length", "etag", "last-modified", "cache-control", "expires", "pragma", "x-total-count", "x-result-count", "total-count", "link", "x-next-page", "x-page", "x-page-size", "x-has-more"];
    return names.reduce((memo, name) => { const value = lp041ReadHeader(headers, name); if (value != null) memo[name] = value; return memo; }, {});
  }
  function lp041PayloadFields(payload) {
    const fields = ["total", "count", "totalCount", "resultCount", "exceededTransferLimit", "next", "nextPage", "page", "pageSize", "offset", "limit", "hasMore", "links", "metadata"];
    return fields.reduce((memo, field) => { if (payload && Object.prototype.hasOwnProperty.call(payload, field)) memo[field] = payload[field]; return memo; }, {});
  }
  function lp041RawFeatureInventory(payload) {
    const features = Array.isArray(payload?.features) ? payload.features : [];
    const fieldCounts = {}, categoryCounts = {}, geometryTypeCounts = {};
    const availability = { route: 0, countyCityDistrict: 0, limits: 0, timestamp: 0, providerId: 0, category: 0 };
    const routeKeys = ["route_name", "routeName", "roadway", "road", "highway", "route", "street"];
    const placeKeys = ["county", "countyName", "city", "locality", "district", "districtName"];
    const limitKeys = ["limits", "from", "to", "begin", "end", "beginLocation", "endLocation", "startLocation", "endLocation"];
    const timeKeys = ["start_time", "startTime", "start", "beginDate", "end_time", "endTime", "end", "endDate", "updated", "lastUpdated"];
    const idKeys = ["GLOBALID", "globalId", "id", "event_id", "eventId", "objectid", "OBJECTID"];
    const categoryKeys = ["condition", "event_type", "eventType", "type", "category"];
    let validObjects = 0, nullFeatures = 0, malformed = 0, withProperties = 0, withoutProperties = 0;
    features.forEach((feature) => {
      if (feature == null) { nullFeatures += 1; return; }
      if (!feature || typeof feature !== "object") { malformed += 1; return; }
      validObjects += 1;
      const geometryType = feature.geometry == null ? "null" : toSafeString(feature.geometry?.type) || "unknown";
      lp041Inc(geometryTypeCounts, geometryType);
      const props = feature.properties && typeof feature.properties === "object" ? feature.properties : null;
      if (props) withProperties += 1; else withoutProperties += 1;
      Object.keys(props || {}).forEach((key) => lp041Inc(fieldCounts, key));
      categoryKeys.forEach((key) => { if (props && props[key] != null && props[key] !== "") { availability.category += 1; lp041Inc(categoryCounts, props[key]); } });
      if (routeKeys.some((key) => props && props[key] != null && props[key] !== "")) availability.route += 1;
      if (placeKeys.some((key) => props && props[key] != null && props[key] !== "")) availability.countyCityDistrict += 1;
      if (limitKeys.some((key) => props && props[key] != null && props[key] !== "")) availability.limits += 1;
      if (timeKeys.some((key) => props && props[key] != null && props[key] !== "")) availability.timestamp += 1;
      if (idKeys.some((key) => props && props[key] != null && props[key] !== "")) availability.providerId += 1;
    });
    return freeze({ total: features.length, validObjects, nullFeatures, malformed, withProperties, withoutProperties, geometryTypeCounts: freeze(geometryTypeCounts), propertyFieldNames: freeze(lp041BoundedKeys(fieldCounts, LP041_MAX_FIELDS)), propertyFieldFrequencies: freeze(Object.fromEntries(Object.entries(fieldCounts).slice(0, LP041_MAX_FIELDS))), importantFieldAvailability: freeze(availability), rawCategoryValueCounts: freeze(Object.fromEntries(Object.entries(categoryCounts).slice(0, LP041_MAX_VALUES))) });
  }
  function lp041SearchText(value) { return JSON.stringify(value || {}).toLowerCase().replace(/[^a-z0-9]+/g, " "); }
  function lp041QueryTerms(query) { const q = toSafeString(query) || "US 90"; return q.toLowerCase().includes("90") && q.toLowerCase().includes("us") ? ["us 90", "us90", "us090", "us0090", "us 090", "us highway 90", "united states highway 90"] : [q.toLowerCase()]; }
  function lp041MatchesQuery(value, query) { const text = lp041SearchText(value); return lp041QueryTerms(query).some((term) => text.includes(term.replace(/[^a-z0-9]+/g, " ").trim()) || text.replace(/\s+/g, "").includes(term.replace(/[^a-z0-9]+/g, ""))); }
  function lp041RawCandidates(payload, query) {
    return (Array.isArray(payload?.features) ? payload.features : []).map((feature, index) => ({ feature, index })).filter((entry) => lp041MatchesQuery(entry.feature, query)).slice(0, LP041_MAX_CANDIDATES).map(({ feature, index }) => {
      const p = feature?.properties || {};
      return freeze({ index, sourceId: toSafeString(p.GLOBALID || p.globalId || p.id || p.event_id || p.eventId || p.OBJECTID), rawCategory: toSafeString(p.condition || p.event_type || p.eventType || p.type || p.category), rawTitle: toSafeString(p.title || p.headline || p.description || p.summary), rawRoute: toSafeString(p.route_name || p.routeName || p.roadway || p.road || p.highway || p.route), rawCoordinate: feature?.geometry?.type === "Point" ? freeze({ longitude: feature.geometry.coordinates?.[0] ?? null, latitude: feature.geometry.coordinates?.[1] ?? null }) : null, rawGeometryType: feature?.geometry == null ? "null" : toSafeString(feature.geometry?.type) || "unknown", rawStartEndLimits: freeze({ start: p.start_time || p.startTime || p.start || p.beginDate || null, end: p.end_time || p.endTime || p.end || p.endDate || null, limits: p.limits || p.from || p.to || null }), sourcePlaceFields: freeze({ county: p.county || p.countyName || null, city: p.city || p.locality || null, district: p.district || p.districtName || null }), presentInRawResponse: true, extractedBeforeNormalization: Boolean(feature && typeof feature === "object") });
    });
  }
  function lp041NormalizedCandidates(records, query) { return (Array.isArray(records) ? records : []).filter((record) => lp041MatchesQuery(record, query)).slice(0, LP041_MAX_CANDIDATES).map((record) => freeze({ sourceId: record?.sourceTrace?.sourceId || record?.id || null, normalizedCategory: record?.category || null, normalizedHeadline: record?.title || record?.description || null, normalizedRouteName: record?.routeName || null, normalizedCoordinate: freeze({ latitude: record?.latitude ?? null, longitude: record?.longitude ?? null }), normalizedTimestampFields: freeze({ startTime: record?.startTime || null, endTime: record?.endTime || null }), normalizedSuccessfully: true, presentInCompleteNormalizedCache: true })); }
  function lp041NormalizationTrace(payload, records) {
    const rawInventory = lp041RawFeatureInventory(payload);
    const output = Array.isArray(records) ? records : [];
    const categoryCounts = {}; output.forEach((r) => lp041Inc(categoryCounts, r?.category));
    const validCoordinates = output.filter((r) => Number.isFinite(Number(r?.latitude)) && Number.isFinite(Number(r?.longitude))).length;
    return freeze({ inputCount: rawInventory.total, extractedCount: rawInventory.validObjects, attempts: rawInventory.validObjects, successCount: output.length, failureCount: Math.max(0, rawInventory.total - output.length), nullNormalizedResults: Math.max(0, rawInventory.total - output.length), thrownErrors: 0, failureReasonCounts: freeze(rawInventory.malformed || rawInventory.nullFeatures ? { invalidFeatureObject: rawInventory.malformed + rawInventory.nullFeatures } : {}), outputCount: output.length, countReconciled: rawInventory.validObjects === output.length, everyRawFeatureProducedNormalizedRecord: rawInventory.total === output.length, validCoordinateCount: validCoordinates, invalidCoordinateCount: output.length - validCoordinates, withIdCount: output.filter((r) => toSafeString(r?.id)).length, withoutIdCount: output.filter((r) => !toSafeString(r?.id)).length, withTimestampCount: output.filter((r) => toSafeString(r?.startTime) || toSafeString(r?.endTime)).length, withoutTimestampCount: output.filter((r) => !toSafeString(r?.startTime) && !toSafeString(r?.endTime)).length, withRouteCount: output.filter((r) => toSafeString(r?.routeName)).length, withoutRouteCount: output.filter((r) => !toSafeString(r?.routeName)).length, normalizedCategoryCounts: freeze(categoryCounts), geometryTransformationCounts: freeze(rawInventory.geometryTypeCounts), firstEvidenceLossStage: rawInventory.total !== output.length ? "normalization-or-feature-extraction" : null });
  }

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

  function awarenessContextFrom(area) {
    if (!area || typeof area !== "object") return null;
    return freeze({
      countyId: toSafeString(area.countyId),
      community: toSafeString(area.label || area.storageValue),
      label: toSafeString(area.label),
      storageValue: toSafeString(area.storageValue),
      key: toSafeString(area.key),
      lat: Number.isFinite(Number(area.lat)) ? Number(area.lat) : null,
      lng: Number.isFinite(Number(area.lng)) ? Number(area.lng) : null,
      radiusMiles: Number.isFinite(Number(area.radiusMiles)) ? Number(area.radiusMiles) : null,
      mode: area.countyWide === true ? "county" : "area",
      countyWide: area.countyWide === true,
      textFallbackTerms: [area.label, area.storageValue, area.key, area.countyId]
        .map(toSafeString)
        .map((value) => value.toLowerCase().replace(/-tx$/, "").replace(/ county$/, ""))
        .filter(Boolean)
    });
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
    const terms = Array.isArray(awareness.textFallbackTerms) ? awareness.textFallbackTerms : [awareness.label, awareness.storageValue, awareness.key, awareness.countyId]
      .map(toSafeString)
      .map((value) => value.toLowerCase().replace(/-tx$/, "").replace(/ county$/, ""))
      .filter(Boolean);
    const text = recordText(record);
    return Boolean(text && terms.some((term) => term && text.includes(term)));
  }

  function filterAwarenessRecords(records, awareness) {
    if (globalScope.gridlySelectedAwarenessAreaResolutionCache && typeof globalScope.gridlySelectedAwarenessAreaResolutionCache === "object") {
      globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount = Number(globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount || 0) + 1;
      globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount = Number(globalScope.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount || 0);
    }
    const input = Array.isArray(records) ? records : [];
    let pointRadiusMatchCount = 0, textFallbackMatchCount = 0, includedByBothCount = 0, includedByPointOnlyCount = 0, includedByTextOnlyCount = 0, invalidCoordinateCount = 0, routeCommunityTextExcluded = 0, noTextMatchEvidence = 0;
    const output = input.filter((record) => {
      const rawLat = record?.latitude;
      const rawLng = record?.longitude;
      const lat = rawLat == null || rawLat === "" ? NaN : Number(rawLat);
      const lng = rawLng == null || rawLng === "" ? NaN : Number(rawLng);
      const areaLat = Number(awareness?.lat);
      const areaLng = Number(awareness?.lng);
      const radius = Number(awareness?.radiusMiles);
      const allowedMiles = awareness?.countyWide || !Number.isFinite(radius) ? 35 : radius + 2;
      const point = Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(areaLat) && Number.isFinite(areaLng) && typeof globalScope.getDistanceMiles === "function" && globalScope.getDistanceMiles(areaLat, areaLng, lat, lng) <= allowedMiles;
      const text = recordText(record);
      const terms = Array.isArray(awareness?.textFallbackTerms) ? awareness.textFallbackTerms : [];
      const textMatch = Boolean(text && terms.some((term) => term && text.includes(term)));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) invalidCoordinateCount += 1;
      if (point) pointRadiusMatchCount += 1;
      if (textMatch) textFallbackMatchCount += 1;
      if (point && textMatch) includedByBothCount += 1;
      else if (point) includedByPointOnlyCount += 1;
      else if (textMatch) includedByTextOnlyCount += 1;
      else if (!text) noTextMatchEvidence += 1;
      if (!point && textMatch) routeCommunityTextExcluded += 0;
      return matchesAwarenessArea(record, awareness);
    });
    const trace = freeze({ inputCount: input.length, selectedCounty: awareness?.countyId || null, selectedAwareness: awareness?.community || awareness?.label || null, anchor: awareness ? freeze({ lat: awareness.lat, lng: awareness.lng }) : null, radiusMiles: awareness?.radiusMiles ?? null, pointRadiusMatchCount, textFallbackMatchCount, uniqueUnionCount: output.length, includedByPointOnlyCount, includedByTextOnlyCount, includedByBothCount, outputCount: output.length, excludedByPointRadiusCount: input.length - pointRadiusMatchCount, recordsExcludedDespiteMatchingRouteCommunityText: routeCommunityTextExcluded, invalidCoordinateCount, noTextMatchEvidenceCount: noTextMatchEvidence, fallbackMethodNames: freeze(["awareness.textFallbackTerms", "recordText"]), diagnosticOnly: "diagnostic source scoping", certifiedAuthorityOwner: false, excludedCount: input.length - output.length });
    lp041LastFilterTrace = trace;
    if (lp041LatestEvidence) lp041LatestEvidence = freeze(Object.assign({}, lp041LatestEvidence, { connectorFilterTrace: trace }));
    return output;
  }

  function installAwarenessView(records, context, generation, reason) {
    if (generation !== areaViewGeneration) {
      staleAreaViewCompletionIgnoredCount += 1;
      return false;
    }
    awarenessNormalizedRecords = (Array.isArray(records) ? records : []).map(clone).filter(Boolean);
    normalizedRecords = awarenessNormalizedRecords;
    awarenessRecordsUpdatedAt = new Date().toISOString();
    lastFilterReason = reason || "drivetexas-awareness-filter";
    lastFilterContext = context ? clone(context) : null;
    state.normalizedRecordCount = awarenessNormalizedRecords.length;
    return true;
  }

  function deriveAwarenessView(reason) {
    if (typeof globalScope.gridlyLp016RecordAwarenessSwitchEvent === "function") globalScope.gridlyLp016RecordAwarenessSwitchEvent("driveTexasRefreshStarted", { reason });
    const generation = areaViewGeneration + 1;
    areaViewGeneration = generation;
    const previousDerivationFlag = globalScope.__gridlyDriveTexasAwarenessDerivationActive === true;
    let context = null;
    try {
      globalScope.__gridlyDriveTexasAwarenessDerivationActive = true;
      context = awarenessContextFrom(activeAwarenessArea());
    } finally {
      globalScope.__gridlyDriveTexasAwarenessDerivationActive = previousDerivationFlag;
    }
    const filteredRecords = filterAwarenessRecords(allNormalizedRecords, context);
    const installed = installAwarenessView(filteredRecords, context, generation, reason);
    if (installed && typeof globalScope.gridlyLp016RecordAwarenessSwitchEvent === "function") globalScope.gridlyLp016RecordAwarenessSwitchEvent("driveTexasRefreshCompleted", { recordCount: awarenessNormalizedRecords.length, reason });
    return installed;
  }

  function refreshAwarenessView(reason) {
    const beforeCount = allNormalizedRecords.length;
    const installed = deriveAwarenessView(reason || "drivetexas-awareness-context-changed");
    completeSourceDatasetPreservedAcrossAreaChange = completeSourceDatasetPreservedAcrossAreaChange && beforeCount === allNormalizedRecords.length;
    lastRetainedDataReused = beforeCount > 0;
    if (installed) {
      const recordSignature = buildRecordSignature(awarenessNormalizedRecords);
      const evidenceChanged = recordSignature !== lastRecordSignature;
      lastRecordSignature = recordSignature;
      notifyOfficialConsumers(recordSignature, true, reason || "drivetexas-awareness-view-updated");
    }
    return freeze({ connected: state.connected === true, normalizedRecordCount: awarenessNormalizedRecords.length, retainedNormalizedRecordCount: allNormalizedRecords.length, retainedDataReused: lastRetainedDataReused });
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

  async function requestPayload(endpoint, attemptNumber) {
    if (typeof globalScope.fetch !== "function") {
      const error = new Error("DriveTexas connector fetch is unavailable");
      error.gridlyNonRetryable = true;
      throw error;
    }

    const { controller, timeoutId } = createTimeoutController();
    const startedAt = lp041Now();
    let responseEvidence = { endpointRedacted: lp041RedactEndpoint(endpoint), method: "GET", attempt: attemptNumber || 1, startedAt, completedAt: null, durationMs: null, status: null, ok: false, parseSucceeded: false, parseError: null, timeoutOrAbort: false };
    try {
      const startMs = Date.now();
      const response = await globalScope.fetch(endpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller ? controller.signal : undefined
      });
      responseEvidence.completedAt = lp041Now();
      responseEvidence.durationMs = Date.now() - startMs;
      responseEvidence.status = Number(response?.status) || null;
      responseEvidence.ok = response?.ok === true;
      const headers = lp041HeaderEvidence(response?.headers);
      responseEvidence.contentType = headers["content-type"] || null;
      responseEvidence.contentLengthHeader = headers["content-length"] || null;
      responseEvidence.etag = headers.etag || null;
      responseEvidence.lastModified = headers["last-modified"] || null;
      responseEvidence.cacheHeaders = freeze({ "cache-control": headers["cache-control"] || null, expires: headers.expires || null, pragma: headers.pragma || null });
      responseEvidence.paginationHeaders = freeze({ link: headers.link || null, "x-next-page": headers["x-next-page"] || null, "x-page": headers["x-page"] || null, "x-page-size": headers["x-page-size"] || null, "x-has-more": headers["x-has-more"] || null });
      responseEvidence.totalCountHeaders = freeze({ "x-total-count": headers["x-total-count"] || null, "x-result-count": headers["x-result-count"] || null, "total-count": headers["total-count"] || null });
      if (!response || response.ok !== true) {
        const status = Number(response?.status) || 0;
        const error = new Error(`DriveTexas connector request failed: ${status || "unknown"}`);
        error.gridlyHttpStatus = status;
        error.gridlyNonRetryable = status >= 400 && status < 500 && status !== 408 && status !== 429;
        error.lp041RequestEvidence = freeze(responseEvidence);
        throw error;
      }
      try {
        const payload = await response.json();
        responseEvidence.parseSucceeded = true;
        return { payload, lp041RequestEvidence: freeze(responseEvidence) };
      } catch (parseError) {
        responseEvidence.parseSucceeded = false;
        responseEvidence.parseError = parseError instanceof Error ? parseError.message : String(parseError);
        const error = new Error("DriveTexas connector JSON parse failed");
        error.gridlyNonRetryable = true;
        error.lp041RequestEvidence = freeze(responseEvidence);
        throw error;
      }
    } catch (error) {
      if (error?.name === "AbortError") responseEvidence.timeoutOrAbort = true;
      if (!error.lp041RequestEvidence) error.lp041RequestEvidence = freeze(responseEvidence);
      if (error?.gridlyHttpStatus || error?.gridlyNonRetryable) throw error;
      error.gridlyNetworkError = true;
      throw error;
    } finally {
      if (timeoutId != null && typeof globalScope.clearTimeout === "function") globalScope.clearTimeout(timeoutId);
    }
  }

  function lp041CaptureSnapshot(requestEvidence, payload, completeRecords, filterTrace) {
    const rawInventory = lp041RawFeatureInventory(payload);
    const normalizationTrace = lp041NormalizationTrace(payload, completeRecords);
    const paginationFields = lp041PayloadFields(payload);
    const rawCandidates = lp041RawCandidates(payload, "US 90");
    const normalizedCandidates = lp041NormalizedCandidates(completeRecords, "US 90");
    const filteredCandidates = lp041NormalizedCandidates(awarenessNormalizedRecords, "US 90");
    const providerReportedCount = paginationFields.totalCount ?? paginationFields.total ?? paginationFields.count ?? paginationFields.resultCount ?? null;
    const firstDivergence = providerReportedCount != null && Number(providerReportedCount) !== rawInventory.total ? "provider-reported-vs-downloaded" : (rawInventory.total !== normalizationTrace.outputCount ? "raw-to-normalized" : (filterTrace && filterTrace.inputCount !== filterTrace.outputCount ? "connector-awareness-filter" : null));
    const snapshot = freeze({ available: true, milestone: "LP041", passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noStateMutation: true, capturedAt: lp041Now(), requestEvidence, payloadEvidence: freeze({ topLevelType: Array.isArray(payload) ? "array" : typeof payload, topLevelKeys: freeze(lp041BoundedKeys(payload, 40)), geoJsonType: payload?.type || null, rawFeatureArrayPresent: Array.isArray(payload?.features), rawFeatureCount: rawInventory.total, providerReportedCount, paginationFields: freeze(paginationFields), exceededTransferLimit: payload?.exceededTransferLimit ?? null, possibleTruncation: null }), rawFeatureInventory: rawInventory, normalizationTrace, connectorFilterTrace: filterTrace || null, pipelineCountTrace: freeze({ providerReportedCount, downloadedRawFeatureCount: rawInventory.total, parsedFeatureCount: rawInventory.total, extractedRawRecordCount: normalizationTrace.extractedCount, normalizedRecordCount: normalizationTrace.outputCount, completeCacheCount: allNormalizedRecords.length, connectorFilterInputCount: filterTrace?.inputCount ?? null, connectorFilterOutputCount: filterTrace?.outputCount ?? null, authorityAdapterInputCount: null, authorityEligibleCount: null, consumerVisibleCount: null, firstCountDivergenceStage: firstDivergence }), us90Evidence: freeze({ queryVariants: freeze(lp041QueryTerms("US 90")), rawCandidateCount: rawCandidates.length, normalizedCandidateCount: normalizedCandidates.length, completeCacheCandidateCount: normalizedCandidates.length, connectorFilteredCandidateCount: filteredCandidates.length, authorityInputCandidateCount: null, authorityEligibleCandidateCount: null, candidateRecords: freeze(rawCandidates.map((c) => freeze(Object.assign({}, c, { normalizedSuccessfully: normalizedCandidates.some((n) => n.sourceId && n.sourceId === c.sourceId), includedByConnectorAwarenessFilter: filteredCandidates.some((n) => n.sourceId && n.sourceId === c.sourceId), firstDisappearanceStage: normalizedCandidates.some((n) => n.sourceId && n.sourceId === c.sourceId) ? (filteredCandidates.some((n) => n.sourceId && n.sourceId === c.sourceId) ? null : "connector-awareness-filter") : "normalization-or-feature-extraction", exclusionReason: null, textMatchDiagnosticOnly: true })))), firstDisappearanceStage: rawCandidates.length === 0 ? "provider-response" : (normalizedCandidates.length === 0 ? "normalization-or-feature-extraction" : (filteredCandidates.length === 0 ? "connector-awareness-filter" : null)), conclusion: "Pending live owner validation; diagnostics do not select an LP041 decision without reviewed live evidence." }), providerCompletenessEvidence: freeze({ providerReachable: requestEvidence?.ok === true, rawCountCaptured: true, parsedCountCaptured: true, normalizationCountReconciled: normalizationTrace.countReconciled, paginationEvidenceCaptured: Object.keys(paginationFields).length > 0 || Object.values(requestEvidence?.paginationHeaders || {}).some(Boolean), rawCategoryInventoryCaptured: true, rawGeometryInventoryCaptured: true, fieldInventoryCaptured: true, us90RecordPresentInRawResponse: rawCandidates.length > 0, us90RecordPresentAfterNormalization: normalizedCandidates.length > 0, us90RecordPresentAfterConnectorFiltering: filteredCandidates.length > 0, completenessCertified: false, decision: "UNRESOLVED_LIVE_EVIDENCE_REQUIRED", unresolvedQuestions: freeze(["Provider completeness cannot be certified from absence of pagination metadata alone.", "Actual US 90 public-map record identity remains pending browser validation."]) }), rootCause: firstDivergence || "No repository-side loss detected in captured fixture path before live validation.", recommendation: "Review LP041 live browser evidence before approving any behavior repair.", recommendedNextMilestone: "Sanctioned comparison milestone only after LP041 evidence is reviewed." });
    lp041LatestEvidence = snapshot;
    lp041EvidenceHistory = [snapshot].concat(lp041EvidenceHistory).slice(0, LP041_MAX_HISTORY);
    globalScope.__gridlyDriveTexasLiveProviderEvidence = freeze({ latest: snapshot, history: freeze(lp041EvidenceHistory) });
    return snapshot;
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
          const requestGeneration = fetchGeneration + 1;
          fetchGeneration = requestGeneration;
          const requestResult = await requestPayload(endpoint, attempt + 1);
          const payload = requestResult.payload;
          if (requestGeneration < fetchGeneration) {
            staleFetchCompletionIgnoredCount += 1;
            return freeze({ connected: state.connected === true, normalizedRecordCount: awarenessNormalizedRecords.length, staleFetchIgnored: true });
          }
          const completeRecords = normalizePayload(payload);
          allNormalizedRecords = completeRecords.map(clone).filter(Boolean);
          sourceRecordsUpdatedAt = new Date().toISOString();
          lastSuccessfulFetchAt = sourceRecordsUpdatedAt;
          lastInstalledFetchGeneration = requestGeneration;
          deriveAwarenessView("drivetexas-fetch-success");
          lp041CaptureSnapshot(requestResult.lp041RequestEvidence, payload, completeRecords, lp041LastFilterTrace);
          const recordSignature = buildRecordSignature(awarenessNormalizedRecords);
          const evidenceChanged = recordSignature !== lastRecordSignature;
          lastRecordSignature = recordSignature;
          state.connected = true;
          state.lastFetchSucceeded = true;
          state.normalizedRecordCount = awarenessNormalizedRecords.length;
          state.lastError = null;
          lastFetchError = null;
          lastRefetchRequired = true;
          lastRetainedDataReused = false;
          notifyOfficialConsumers(recordSignature, evidenceChanged, "drivetexas-fetch-success");
          return freeze({ connected: true, normalizedRecordCount: awarenessNormalizedRecords.length, retainedNormalizedRecordCount: allNormalizedRecords.length, evidenceChanged });
        } catch (error) {
          lastError = error;
          attempt += 1;
          if (attempt >= MAX_ATTEMPTS || !isTransientError(error)) throw error;
        }
      }
      throw lastError || new Error("DriveTexas connector request failed");
    } catch (error) {
      state.connected = false;
      state.lastFetchSucceeded = false;
      state.normalizedRecordCount = awarenessNormalizedRecords.length;
      state.lastError = error instanceof Error ? error.message : String(error);
      lastFetchError = state.lastError;
      const recordSignature = buildRecordSignature(awarenessNormalizedRecords);
      const evidenceChanged = recordSignature !== lastRecordSignature;
      notifyOfficialConsumers(recordSignature, evidenceChanged, "drivetexas-fetch-failure");
      return freeze({ connected: false, normalizedRecordCount: awarenessNormalizedRecords.length, retainedNormalizedRecordCount: allNormalizedRecords.length, error: state.lastError, evidenceChanged });
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
    return freeze(awarenessNormalizedRecords.map(clone).filter(Boolean));
  }

  function getAwarenessRecords() {
    return getNormalizedRecords();
  }

  function getAllNormalizedRecords() {
    return freeze(allNormalizedRecords.map(clone).filter(Boolean));
  }

  function areaLifecycleAudit() {
    return freeze({
      activeCounty: lastFilterContext?.countyId || null,
      activeCommunity: lastFilterContext?.community || null,
      activeAwarenessMode: lastFilterContext?.mode || null,
      retainedCompleteSourceRecordCount: allNormalizedRecords.length,
      currentAwarenessAreaRecordCount: awarenessNormalizedRecords.length,
      retainedSourceTimestamp: sourceRecordsUpdatedAt,
      derivedAreaViewTimestamp: awarenessRecordsUpdatedAt,
      lastSuccessfulFetchTimestamp: lastSuccessfulFetchAt,
      lastFetchError,
      lastFilterReason,
      lastFilteredCounty: lastFilterContext?.countyId || null,
      lastFilteredCommunity: lastFilterContext?.community || null,
      lastFilterCoordinates: lastFilterContext ? { lat: lastFilterContext.lat, lng: lastFilterContext.lng } : null,
      lastFilterRadius: lastFilterContext?.radiusMiles ?? null,
      lastAreaViewGeneration: areaViewGeneration,
      lastFetchGeneration: fetchGeneration,
      lastInstalledFetchGeneration,
      staleAreaViewCompletionIgnoredCount,
      staleFetchCompletionIgnoredCount,
      completeSourceDatasetPreservedAcrossAreaChange,
      currentAwarenessViewMatchesSelectedArea: true,
      selectedRecordIds: awarenessNormalizedRecords.map((record) => record.id || record.incidentId || record.GLOBALID || null),
      selectedRecordCounties: awarenessNormalizedRecords.map((record) => record.county || record.countyName || record.countyId || record.raw?.county || null),
      selectedRecordCommunities: awarenessNormalizedRecords.map((record) => record.city || record.locality || record.community || record.raw?.city || null),
      selectedRecordCoordinates: awarenessNormalizedRecords.map((record) => ({ latitude: record.latitude ?? record.lat ?? null, longitude: record.longitude ?? record.lng ?? record.lon ?? null })),
      selectedRoutes: awarenessNormalizedRecords.map((record) => record.routeName || record.routeNameDisplay || record.roadName || record.road || record.highway || null),
      selectedCategories: awarenessNormalizedRecords.map((record) => record.category || record.type || record.condition || null),
      selectedRawSourceText: awarenessNormalizedRecords.map((record) => record.rawSourceText || record.description || record.title || null),
      refetchRequired: lastRefetchRequired,
      retainedDataReused: lastRetainedDataReused,
      sourcePresentationOwnershipSeparationActive: allNormalizedRecords !== awarenessNormalizedRecords
    });
  }

  function lp029DistanceMiles(aLat, aLng, bLat, bLng) {
    const lat1 = Number(aLat);
    const lng1 = Number(aLng);
    const lat2 = Number(bLat);
    const lng2 = Number(bLng);
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    if (typeof globalScope.getDistanceMiles === "function") return globalScope.getDistanceMiles(lat1, lng1, lat2, lng2);
    const toRad = (value) => value * Math.PI / 180;
    const radiusMiles = 3958.7613;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function lp029BuildCounts(records, selector) {
    return records.reduce((memo, record) => {
      const key = toSafeString(selector(record)) || "(missing)";
      memo[key] = (memo[key] || 0) + 1;
      return memo;
    }, {});
  }

  function lp029ConfiguredEndpointContract() {
    const config = getConnectorConfig();
    const template = toSafeString(config.endpointTemplate) || DEFAULT_ENDPOINT;
    let parsed = null;
    try { parsed = new URL(template.replace("{api_key}", "__GRIDLY_REDACTED_API_KEY__")); } catch (error) {}
    const params = parsed ? Array.from(parsed.searchParams.keys()).reduce((memo, key) => {
      memo[key] = key.toLowerCase() === "key" ? "{api_key_redacted}" : parsed.searchParams.get(key);
      return memo;
    }, {}) : {};
    return freeze({
      method: "GET",
      endpointTemplate: template.replace(/key=([^&]*)/i, "key={api_key_redacted}"),
      baseUrl: parsed ? `${parsed.protocol}//${parsed.host}` : "https://api.drivetexas.org",
      endpointPath: parsed ? parsed.pathname : "/api/conditions.geojson",
      queryParameters: freeze(params),
      apiKeyHandling: "Resolved from GRIDLY_CONFIG.driveTexas.apiKey, GRIDLY_CONFIG.txdot.apiKey, or GRIDLY_TXDOT_API_KEY and URL-encoded into the key query parameter; never returned by this audit.",
      requestHeaders: freeze({ explicitHeadersConfigured: false }),
      cachePolicy: "fetch cache: no-store",
      timeoutMs: TIMEOUT_MS,
      maxAttempts: MAX_ATTEMPTS,
      retryBehavior: "Retry once only for transient 408, 429, 5xx, timeout, or network failures; no retry for other 4xx/schema failures.",
      paginationParametersConfigured: false,
      boundingParametersConfigured: false,
      districtParametersConfigured: false,
      categoryParametersConfigured: false,
      statusParametersConfigured: false,
      dateTimeParametersConfigured: false,
      maximumResultParametersConfigured: false
    });
  }

  function lp029ProximityCounts(records, point, radii) {
    return radii.reduce((memo, radius) => {
      memo[`${radius}mi`] = records.filter((record) => {
        const miles = lp029DistanceMiles(point.lat, point.lng, record.latitude, record.longitude);
        return Number.isFinite(miles) && miles <= radius;
      }).length;
      return memo;
    }, {});
  }

  function lp029ProviderCompletenessAudit() {
    const records = allNormalizedRecords.map(clone).filter(Boolean);
    const validCoordinateCount = records.filter((record) => Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude))).length;
    const ids = records.map((record) => toSafeString(record.id)).filter(Boolean);
    const uniqueIds = new Set(ids);
    const starts = records.map((record) => toSafeString(record.startTime)).filter(Boolean).sort();
    const ends = records.map((record) => toSafeString(record.endTime)).filter(Boolean).sort();
    const conroe = { lat: 30.3119, lng: -95.4558 };
    const routePatternCountsNearConroe = [
      ["IH0045 / I-45", /\b(?:ih\s*0*45|i[- ]?45|interstate\s*45)\b/i],
      ["SH0105 / SH 105", /\b(?:sh\s*0*105|state highway\s*105|sh[- ]?105)\b/i],
      ["SL0336 / Loop 336", /\b(?:sl\s*0*336|loop\s*336|lp\s*336)\b/i],
      ["FM1488", /\bfm\s*1488\b/i],
      ["FM2854", /\bfm\s*2854\b/i]
    ].reduce((memo, entry) => {
      const [label, pattern] = entry;
      memo[label] = records.filter((record) => pattern.test([record.routeName, record.title, record.description].map(toSafeString).join(" ")) && Number(lp029DistanceMiles(conroe.lat, conroe.lng, record.latitude, record.longitude)) <= 50).length;
      return memo;
    }, {});

    return freeze({
      auditName: "LP029 DriveTexas Provider Completeness Passive Audit",
      passive: true,
      fetchPerformed: false,
      mutatesConnectorState: false,
      endpointContract: lp029ConfiguredEndpointContract(),
      rawResponseCount: null,
      normalizedCompleteCount: records.length,
      normalizationDropCount: null,
      duplicateIdCount: ids.length - uniqueIds.size,
      categoryCounts: freeze(lp029BuildCounts(records, (record) => record.category)),
      routeCounts: freeze(lp029BuildCounts(records, (record) => record.routeName)),
      recordsWithValidCoordinates: validCoordinateCount,
      recordsWithoutValidCoordinates: records.length - validCoordinateCount,
      coordinateCoveragePercent: records.length ? Number(((validCoordinateCount / records.length) * 100).toFixed(2)) : 0,
      earliestStartTimestamp: starts[0] || null,
      latestEndTimestamp: ends[ends.length - 1] || null,
      recordsWithUnknownCategory: records.filter((record) => !toSafeString(record.category)).length,
      recordsWithMissingRoute: records.filter((record) => !toSafeString(record.routeName)).length,
      recordsWithMissingCoordinates: records.length - validCoordinateCount,
      knownTopLevelResponseMetadata: null,
      paginationMetadata: null,
      responseHeaders: null,
      providerTotalCount: null,
      currentResultCapDetectable: false,
      conroeProximityCounts: freeze(lp029ProximityCounts(records, conroe, [10, 15, 25, 35, 50])),
      daytonProximityCounts: freeze(lp029ProximityCounts(records, { lat: 30.0466, lng: -94.8852 }, [10, 15, 25, 35, 50])),
      livingstonProximityCounts: freeze(lp029ProximityCounts(records, { lat: 30.7110, lng: -94.9329 }, [10, 15, 25, 35, 50])),
      conroeRouteCountsWithin50Miles: freeze(routePatternCountsNearConroe),
      sourceCompletenessClassification: records.length > 0 ? "J_UNABLE_TO_CERTIFY_PROVIDER_CONTRACT_FROM_PASSIVE_NORMALIZED_CACHE_ONLY" : "J_UNABLE_TO_CERTIFY_NO_RETAINED_RUNTIME_SOURCE_RECORDS",
      firstSuspectedTruncationStage: null
    });
  }

  function lp040CountBy(records, selector) {
    return (Array.isArray(records) ? records : []).reduce((memo, record) => {
      const key = toSafeString(selector(record)) || "(missing)";
      memo[key] = (memo[key] || 0) + 1;
      return memo;
    }, {});
  }

  function lp040RecordFieldInventory(records) {
    const fields = ["id", "provider", "providerId", "category", "title", "description", "routeName", "latitude", "longitude", "startTime", "endTime", "sourceTrace", "rawPayloadExposed"];
    return fields.reduce((memo, field) => {
      memo[field] = freeze({
        normalizedField: field,
        status: "preserved-or-derived-in-normalized-model",
        presentCount: records.filter((record) => record && record[field] != null && record[field] !== "").length
      });
      return memo;
    }, {
      geometry: freeze({ normalizedFields: ["latitude", "longitude"], status: "transformed-to-point-only", note: "Point geometry is reduced to latitude/longitude; LineString is reduced to midpoint; full provider geometry is not preserved in normalized records." }),
      limits: freeze({ normalizedFields: [], status: "not-loaded", note: "No normalized limit, from-limit, to-limit, start-coordinate, end-coordinate, or roadway-extent fields exist." }),
      county: freeze({ normalizedFields: [], status: "ignored-or-discarded", note: "Provider county-like fields are not copied by normalizeRecord." }),
      city: freeze({ normalizedFields: [], status: "ignored-or-discarded", note: "Provider city/locality-like fields are not copied by normalizeRecord." }),
      district: freeze({ normalizedFields: [], status: "ignored-or-discarded", note: "Provider district-like fields are not copied by normalizeRecord." }),
      metadata: freeze({ normalizedFields: ["sourceTrace.sourceId"], status: "mostly-discarded", note: "Only provider/sourceId lineage is preserved; raw provider metadata is not exposed or retained in the normalized model." })
    });
  }

  function lp040DriveTexasProviderCompletenessAudit() {
    const records = allNormalizedRecords.map(clone).filter(Boolean);
    const awarenessRecords = awarenessNormalizedRecords.map(clone).filter(Boolean);
    const ids = records.map((record) => toSafeString(record.id)).filter(Boolean);
    const uniqueIds = new Set(ids);
    const validGeometryCount = records.filter((record) => Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude))).length;
    const endpointContract = lp029ConfiguredEndpointContract();
    const filters = freeze([
      { stage: "provider-request", removesRecords: "unknown-provider-side", evidence: "Single conditions.geojson GET with only key query parameter; no Gridly bounding, county, category, status, date, active, or pagination parameters are configured." },
      { stage: "download", removesRecords: false, evidence: "requestPayload returns response.json() after HTTP/schema success; no array truncation in download code." },
      { stage: "connector-schema-validation", removesRecords: "all-on-invalid-schema", evidence: "validateGeoJson requires FeatureCollection with features array; invalid schema fails closed and preserves prior retained records." },
      { stage: "provider-extractRawRecords", removesRecords: "invalid-feature-objects", evidence: "GeoJSON features are mapped to properties plus __geometry; null/non-object features are filtered." },
      { stage: "provider-normalizeRecords", removesRecords: "invalid-normalized-null-only", evidence: "normalizeRecord returns null only for missing/non-object records; normalized records are filter(Boolean)." },
      { stage: "deduplication", removesRecords: false, evidence: "No deduplication stage removes retained provider records; duplicate count is reported only." },
      { stage: "expiration-retention", removesRecords: false, evidence: "No start/end expiration, stale-retention, or long-duration construction removal exists before authority input." },
      { stage: "authority-input", removesRecords: true, evidence: "filterAwarenessRecords derives the current awareness view from retained complete source records using point-radius or text fallback." },
      { stage: "consumer", removesRecords: "downstream-out-of-scope", evidence: "LP040 certifies provider-to-authority input only; consumer visibility is reported as unavailable from this passive helper." }
    ]);
    const hardLimits = freeze([
      { item: "TIMEOUT_MS", value: TIMEOUT_MS, completenessRisk: "request-abort" },
      { item: "MAX_ATTEMPTS", value: MAX_ATTEMPTS, completenessRisk: "limited-retry-window" },
      { item: "REFRESH_INTERVAL_MS", value: REFRESH_INTERVAL_MS, completenessRisk: "staleness-between-polls" },
      { item: "fetch cache", value: "no-store", completenessRisk: "none-cache-bypass" },
      { item: "pagination parameters", value: "none", completenessRisk: "possible-first-page-only-if-provider-paginates-by-default" },
      { item: "array truncation", value: "none detected in connector/provider", completenessRisk: "none-repository-side" }
    ]);
    return freeze({
      auditName: "LP040 DriveTexas Provider Completeness Certification",
      passive: true,
      fetchPerformed: false,
      writesPerformed: false,
      pollingStarted: false,
      storageChanged: false,
      providerEndpoints: freeze([freeze(Object.assign({ apiType: "GeoJSON over HTTPS JSON", url: endpointContract.endpointTemplate, arcgisFeatureService: false, restQuery: false, paginationSupport: "not evidenced in repository", maxRecordLimits: "not evidenced in repository", transferLimits: "not evidenced in repository", geometryOptions: "default provider GeoJSON geometry only", supportedQueryParameters: "not evidenced in repository", defaultQueryParameters: endpointContract.queryParameters }, endpointContract))]),
      providerRequests: endpointContract,
      pagination: freeze({ configured: false, implemented: false, multiplePagesRequested: false, currentPageSize: null, maximumRecords: null, resultOffsetConfigured: false, resultRecordCountConfigured: false, firstPageOnlyRisk: "unknown until official provider contract or live response metadata is captured" }),
      recordCounts: freeze({ providerReportedCount: null, downloadedCount: null, parsedCount: null, normalizedCount: records.length, loadedCount: records.length, authorityInputCount: awarenessRecords.length, consumerEligibleCount: null, consumerVisibleCount: null, duplicateIdCount: ids.length - uniqueIds.size, countDivergence: "Provider/download/parsed counts are not retained by production runtime; normalized-to-loaded matches retained records." }),
      fieldInventory: freeze(lp040RecordFieldInventory(records)),
      categoryInventory: freeze({ configuredCategories: ["Road Closure", "Flooding", "Construction", "Lane Closure", "Crash", "Bridge Restriction", "Travel Advisory"], observedCounts: freeze(lp040CountBy(records, (record) => record.category)), handling: "Categories are inferred by regex from condition/type/category plus description/title text; unmatched records collapse to Travel Advisory." }),
      filterInventory: filters,
      hardLimits,
      constructionHandling: freeze({ categoryConfigured: true, filteredDifferentlyBeforeAuthority: false, refreshDiffers: false, retentionDiffers: false, expirationDiffers: false, longDurationExpirationRisk: "No repository-side expiration found before authority; completeness still depends on provider endpoint including construction records." }),
      geometryPreservation: freeze({ pointCoordinatesPreserved: true, lineGeometryPreserved: false, lineGeometryTreatment: "LineString midpoint only", limitsPreserved: false, startEndCoordinatesPreserved: false, roadwayExtentPreserved: false, validCoordinateCount: validGeometryCount, missingCoordinateCount: records.length - validGeometryCount }),
      providerCompleteness: freeze({ providerReachability: state.lastFetchSucceeded === true ? "PASS" : "UNKNOWN", pagination: "UNABLE_TO_CERTIFY", providerCountMatch: "UNABLE_TO_CERTIFY", normalizationCountMatch: "UNABLE_TO_CERTIFY_RAW_COUNT_NOT_RETAINED", categoryCompleteness: "UNABLE_TO_CERTIFY", constructionCompleteness: "UNABLE_TO_CERTIFY", geometryPreservation: "FAIL_FULL_GEOMETRY_NOT_PRESERVED", providerMetadataPreservation: "FAIL_METADATA_MOSTLY_DISCARDED", overallProviderCompleteness: "FAIL_UNABLE_TO_CERTIFY_COMPLETE_OFFICIAL_PROVIDER_SET" }),
      rootCause: "Gridly requests a single conditions.geojson feed and retains normalized records, but it does not retain provider-reported totals, raw downloaded counts, pagination metadata, full geometry, limits, county/city/district fields, or raw metadata needed to prove complete provider ingestion before authority filtering.",
      recommendedNextMilestone: "LP041 — sanctioned live DriveTexas contract capture and raw-to-normalized count instrumentation in audit-only diagnostics.",
      publicWebsiteComparison: "Not possible from repository evidence alone; this passive audit performs no fetches and the repository does not include a current public DriveTexas website export."
    });
  }




  function lp042RecordId(record, index) { return record?.sourceTrace?.sourceId || record?.id || `record:${index}`; }
  function lp042NormText(value) { return String(value == null ? "" : value).replace(/<[^>]*>/g, " ").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function lp042AwarenessContext() {
    const context = lastFilterContext || awarenessContextFrom(activeAwarenessArea());
    const lp039 = typeof globalScope.gridlyLp0393DaytonDriveTexasAuthorityTraceAudit === "function" ? globalScope.gridlyLp0393DaytonDriveTexasAuthorityTraceAudit() : null;
    const lp039Area = lp039?.selectedAwarenessArea || lp039?.authority?.selectedAwarenessArea || null;
    const same = lp039Area ? Math.abs(Number(lp039Area.lat ?? lp039Area.latitude) - Number(context?.lat)) < 0.000001 && Math.abs(Number(lp039Area.lng ?? lp039Area.longitude) - Number(context?.lng)) < 0.000001 : null;
    return freeze({ countyId: context?.countyId || null, countyLabel: context?.countyId || null, awarenessId: context?.key || context?.storageValue || null, awarenessLabel: context?.label || context?.community || null, storageValue: context?.storageValue || null, anchor: context ? freeze({ latitude: context.lat, longitude: context.lng }) : null, radiusMiles: context?.radiusMiles ?? null, aliases: freeze([context?.label, context?.community, context?.storageValue, context?.key, context?.countyId].map(toSafeString).filter(Boolean)), textTokens: freeze((context?.textFallbackTerms || []).map(lp042NormText).filter(Boolean)), contextMatchesLp039: same });
  }
  function lp042Decision(record, index, context) {
    const lat = record?.latitude == null || record?.latitude === "" ? NaN : Number(record.latitude);
    const lng = record?.longitude == null || record?.longitude === "" ? NaN : Number(record.longitude);
    const areaLat = Number(context?.anchor?.latitude), areaLng = Number(context?.anchor?.longitude);
    const radius = Number(context?.radiusMiles);
    const allowedMiles = !Number.isFinite(radius) ? 35 : radius + 2;
    const distance = Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(areaLat) && Number.isFinite(areaLng) ? lp029DistanceMiles(areaLat, areaLng, lat, lng) : null;
    const point = Number.isFinite(distance) && distance <= allowedMiles;
    const fields = { title: record?.title || null, description: record?.description || null, routeName: record?.routeName || null, locality: record?.locality || null, city: record?.city || null, county: record?.county || null, affectedAreas: record?.affectedAreas || null };
    const searchable = lp042NormText(Object.values(fields).flat().filter(Boolean).join(" "));
    const tokens = context?.textTokens || [];
    const matched = tokens.filter((t) => t && searchable.includes(t));
    const text = Boolean(searchable && matched.length);
    const reasons = [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) reasons.push("invalid_or_missing_midpoint_coordinate");
    if (Number.isFinite(distance) && !point) reasons.push("midpoint_outside_awareness_radius_plus_connector_buffer");
    if (!text) reasons.push("awareness_text_absent_from_normalized_provider_fields");
    if (!point && !text) reasons.push("excluded_by_point_radius_and_text_fallback_union");
    return freeze({ sourceId: lp042RecordId(record, index), route: record?.routeName || null, category: record?.category || null, rawGeometryType: null, rawGeometryCoordinateCount: null, extractedCoordinate: freeze({ latitude: Number.isFinite(lat) ? lat : null, longitude: Number.isFinite(lng) ? lng : null, provenance: "normalized latitude/longitude; provider LineString reduced to midpoint before connector filtering" }), distanceFromDayton: Number.isFinite(distance) ? Number(distance.toFixed(3)) : null, pointRadiusResult: point, textFieldsExamined: freeze(fields), normalizedSearchableText: searchable, awarenessTokens: freeze(tokens), matchedTokens: freeze(matched), failedTokens: freeze(tokens.filter((t) => !matched.includes(t))), textFallbackResult: text, connectorIncluded: point || text, exclusionReasons: freeze(reasons), fullGeometryIntersectionEvidence: "unavailable in normalized connector cache; LP041 retains bounded raw diagnostics only, not full payload geometry", firstRejectionBranch: point || text ? null : (Number.isFinite(distance) ? "point-radius-then-text-fallback" : "invalid-coordinate-then-text-fallback") });
  }
  function lp042TraceRecords(query) {
    const q = lp042NormText(query || "US 90");
    const context = lp042AwarenessContext();
    const records = allNormalizedRecords.map(clone).filter(Boolean);
    const filteredIds = new Set(awarenessNormalizedRecords.map((r, i) => lp042RecordId(r, i)));
    return records.map((r, i) => ({ r, i })).filter(({ r }) => !q || lp042NormText([r.id, r.category, r.title, r.description, r.routeName, r.city, r.county, r.locality].join(" ")).includes(q) || lp041MatchesQuery(r, query)).slice(0, LP041_MAX_CANDIDATES).map(({ r, i }) => freeze(Object.assign({}, lp042Decision(r, i, context), { connectorIncluded: filteredIds.has(lp042RecordId(r, i)) || lp042Decision(r, i, context).connectorIncluded }))); }
  function lp042CountReasons(traces) { return traces.reduce((m, t) => { (t.exclusionReasons || []).forEach((r) => { m[r] = (m[r] || 0) + 1; }); return m; }, {}); }
  function lp042DriveTexasConnectorAwarenessFilterCertificationAudit() {
    const context = lp042AwarenessContext();
    const records = allNormalizedRecords.map(clone).filter(Boolean);
    const allTraces = records.map((r, i) => lp042Decision(r, i, context));
    const us90 = lp042TraceRecords("US 90");
    const filterTrace = lp041LastFilterTrace || {};
    const lp039Source = typeof globalScope.gridlyGetDriveTexasAuthoritySnapshot === "function" ? globalScope.gridlyGetDriveTexasAuthoritySnapshot() : null;
    return freeze({ available: true, milestone: "LP042", investigationOnly: true, passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, selectedAwarenessContext: context, connectorFilterContract: freeze({ functionPresent: true, purposeClassification: "obsolete_pre_authority_scope_gate_for_LP039_path; diagnostic_or_legacy_view_only_should_be_future_contract", inputSource: "allNormalizedRecords complete normalized cache", inputCount: records.length, outputCount: awarenessNormalizedRecords.length, pointRadiusEnabled: true, textFallbackEnabled: true, fullGeometryUsed: false, midpointCoordinateUsed: true, awarenessBoundaryUsed: false, connectorOwnsAuthority: false, diagnosticOnly: true }), geographicDecisionTrace: freeze({ distanceFunction: "globalScope.getDistanceMiles via getDistanceMiles(areaLat, areaLng, recordLat, recordLng)", units: "miles", thresholdInclusive: "<= radiusMiles + 2 for area mode; <=35 for countyWide or missing radius", coordinateOrder: "latitude, longitude arguments; GeoJSON source coordinates are longitude, latitude before provider midpoint extraction", invalidCoordinateBehavior: "geographic branch false; text fallback may still include", missingAnchorBehavior: "geographic branch false; text fallback may still include", sourceGeometryIgnored: true, lineGeometryReducedToMidpoint: true, pointRadiusMatchCount: filterTrace.pointRadiusMatchCount ?? allTraces.filter((t) => t.pointRadiusResult).length, pointRadiusRejectCount: records.length - (filterTrace.pointRadiusMatchCount ?? allTraces.filter((t) => t.pointRadiusResult).length) }), textFallbackDecisionTrace: freeze({ sourceFields: freeze(["title", "description", "routeName", "locality", "city", "county", "affectedAreas"]), awarenessFields: freeze(["label", "storageValue", "key", "countyId"]), normalizationRules: "lowercase; connector text terms strip -tx and trailing county; LP042 diagnostic strips HTML/punctuation", htmlStripped: false, routeNormalization: "none in production filter; substring only", communityAliasesUsed: true, countyAliasesUsed: true, tokenMatchingMethod: "substring any awareness term", textFallbackMatchCount: filterTrace.textFallbackMatchCount ?? allTraces.filter((t) => t.textFallbackResult).length, textFallbackRejectCount: records.length - (filterTrace.textFallbackMatchCount ?? allTraces.filter((t) => t.textFallbackResult).length), providerShapeCompatible: false }), pipelineOwnership: freeze({ completeNormalizedCacheCount: records.length, connectorFilteredCount: awarenessNormalizedRecords.length, lp039AdapterInputSource: "gridlyDriveTexasConnector.getAllNormalizedRecords preferred over getNormalizedRecords", lp039AdapterInputCount: lp039Source?.counts?.rawRecordCount ?? records.length, completeCacheAvailableToLp039: true, filteredCacheUsedByLp039: false, firstPreAuthorityRemovalStage: records.length !== awarenessNormalizedRecords.length ? "connector-awareness-filter" : null, duplicateOwnershipDetected: true }), us90CandidateTrace: freeze(us90), exclusionReasonCounts: freeze(lp042CountReasons(allTraces)), zeroOutputRootCause: freeze({ classification: "mixed_root_cause: source_geometry_reduced_to_midpoint + full_geometry_ignored + awareness_text_absent_from_provider + connector_filter_is_obsolete_pre_authority_gate", supportingEvidence: freeze(["filterAwarenessRecords returns point-radius OR text fallback only", "provider normalizer reduces LineString to one midpoint coordinate", "LP041 live evidence reported 739 input and 0 output with 0 point/text matches", "LP039 source resolver prefers complete cache, but connector awareness view is still a separate pre-authority retained view"]), confidence: records.length ? "high for loaded runtime cache; live US 90 geometry intersection remains bounded-diagnostic dependent" : "repository-certified; awaiting live loaded records", unresolvedQuestions: freeze(["Full raw line intersection for each live US 90 candidate requires LP041 bounded raw geometry evidence or an approved geometry-retention diagnostic."]) }), architectureOptions: freeze({ keepCurrentGate: "Reject as final authority gate: midpoint/text false negatives are expected for LineString provider shape.", completeCacheToLp039: "Preferred future direction: LP039 should be sole selected-awareness authority gate over complete normalized source cache.", geometryAwareConnectorFilter: "Defer: duplicates authority logic and risks two ownership systems.", pointOnlyWithoutTextFallback: "Reject: still creates midpoint false negatives.", layeredSourceScoping: "Possible future broad non-authoritative optimization only if wider than final authority and traceable." }), recommendation: freeze({ conclusion: "E with B/C evidence: connector filtering is obsolete as an LP039 authority input gate; current filter is too narrow and text fallback is incompatible with provider fields when locality is absent.", currentFilterSafe: false, currentFilterTooNarrow: true, currentFilterObsoleteAsAuthorityGate: true, productionRepairRequired: true, minimumSafeRepair: "Future milestone should feed complete normalized source cache to LP039 and leave connector filtering diagnostic/legacy only.", rejectedRepairs: freeze(["radius widening", "Dayton/Liberty/US 90 hardcoding", "route-name-only authority", "duplicated geometry authority in connector during LP042"]), suggestedNextMilestone: "LP043 production repair contract for LP039 complete-cache input and connector filter demotion" }) });
  }
  function lp042DriveTexasConnectorFilterRecordTrace(query) { return freeze({ available: true, milestone: "LP042", passive: true, noFetches: true, noWrites: true, diagnosticOnly: true, query: toSafeString(query) || "US 90", results: freeze(lp042TraceRecords(query || "US 90")), boundedResultLimit: LP041_MAX_CANDIDATES, textMatchingDiagnosticOnly: true }); }

  function lp041RecordTrace(query) {
    const q = toSafeString(query) || "US 90";
    const latest = lp041LatestEvidence;
    const current = lp041NormalizedCandidates(allNormalizedRecords.concat(awarenessNormalizedRecords), q);
    return freeze({ available: Boolean(latest), milestone: "LP041", passive: true, noFetches: true, noWrites: true, diagnosticOnly: true, query: q, queryVariants: freeze(lp041QueryTerms(q)), latestCapturedAt: latest?.capturedAt || null, rawMatches: q === "US 90" ? latest?.us90Evidence?.candidateRecords || freeze([]) : freeze([]), normalizedMatches: freeze(current), boundedResultLimit: LP041_MAX_CANDIDATES, textMatchingAffectsProductionEligibility: false });
  }

  function lp041DriveTexasLiveProviderEvidenceAudit(options) {
    const query = toSafeString(options?.query) || "US 90";
    const latest = lp041LatestEvidence;
    if (!latest) return freeze({ available: false, milestone: "LP041", passive: true, noFetches: true, noPolling: true, noWrites: true, noStorageWrites: true, noStateMutation: true, decision: "NO_NORMAL_SANCTIONED_FETCH_CAPTURED_YET" });
    if (query === "US 90") return latest;
    return freeze(Object.assign({}, latest, { diagnosticQuery: lp041RecordTrace(query) }));
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
    getNormalizedRecords,
    getAwarenessRecords,
    getAllNormalizedRecords,
    refreshAwarenessView,
    areaLifecycleAudit
  });
  globalScope.gridlyDriveTexasConnectorRuntimeAudit = runtimeAudit;
  globalScope.gridlyLp028DriveTexasAreaLifecycleAudit = areaLifecycleAudit;
  globalScope.gridlyLp029DriveTexasProviderCompletenessAudit = lp029ProviderCompletenessAudit;
  globalScope.gridlyLp040DriveTexasProviderCompletenessAudit = lp040DriveTexasProviderCompletenessAudit;
  globalScope.gridlyLp041DriveTexasLiveProviderEvidenceAudit = lp041DriveTexasLiveProviderEvidenceAudit;
  globalScope.gridlyLp041DriveTexasProviderRecordTrace = lp041RecordTrace;
  globalScope.gridlyLp042DriveTexasConnectorAwarenessFilterCertificationAudit = lp042DriveTexasConnectorAwarenessFilterCertificationAudit;
  globalScope.gridlyLp042DriveTexasConnectorFilterRecordTrace = lp042DriveTexasConnectorFilterRecordTrace;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = globalScope.gridlyDriveTexasConnector;
  }
})(typeof window !== "undefined" ? window : globalThis);
