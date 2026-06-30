(function initGridlyUnifiedIntelligencePrototype(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDERS = Object.freeze(["community", "drivetexas", "weather"]);
  const OFFICIAL_ROADWAY_PROVIDER = "drivetexas";
  const OFFICIAL_WEATHER_PROVIDER = "weather";
  const RUNTIME_BOUNDARIES = Object.freeze({
    ownsReasoning: true,
    ownsRelationshipEvaluation: true,
    ownsSynthesis: true,
    ownsProviderNetworking: false,
    ownsProviderNormalization: false,
    ownsProviderStorage: false,
    ownsProviderPresentation: false,
    ownsUserParticipation: false
  });

  let lastModel = buildEmptyModel();
  let lastHealthy = true;

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach((key) => freeze(value[key]));
    return Object.freeze(value);
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return null;
    }
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeCall(fn) {
    if (typeof fn !== "function") return null;
    try {
      return fn();
    } catch (error) {
      lastHealthy = false;
      return null;
    }
  }

  function normalizeProviderId(value, fallback) {
    const text = typeof value === "string" ? value.trim().toLowerCase() : "";
    if (text === "drive_texas" || text === "txdot") return "drivetexas";
    if (PROVIDERS.includes(text)) return text;
    return fallback;
  }

  function recordId(record, providerId, index) {
    return String(record?.id || record?.recordId || record?.incidentId || record?.eventId || `${providerId}-${index}`);
  }

  function recordType(record) {
    return String(record?.type || record?.eventType || record?.category || record?.hazardType || record?.kind || "unknown").toLowerCase();
  }

  function recordTime(record) {
    return record?.updatedAt || record?.observedAt || record?.createdAt || record?.effectiveAt || record?.sent || record?.timestamp || null;
  }

  function recordLocation(record) {
    const lat = Number(record?.lat ?? record?.latitude ?? record?.location?.lat ?? record?.location?.latitude ?? record?.geometry?.coordinates?.[1]);
    const lon = Number(record?.lon ?? record?.lng ?? record?.longitude ?? record?.location?.lon ?? record?.location?.lng ?? record?.location?.longitude ?? record?.geometry?.coordinates?.[0]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, bucket: `${lat.toFixed(2)},${lon.toFixed(2)}` };
  }

  function collectFromRuntime() {
    return {
      community: asArray(safeCall(globalScope.getLiveHazardIncidents)).concat(
        asArray(globalScope.activeHazards),
        asArray(globalScope.unifiedRoadIncidents),
        asArray(globalScope.activeUnifiedIncidents)
      ),
      drivetexas: asArray(safeCall(globalScope.gridlyDriveTexasConnector?.getNormalizedRecords)),
      weather: asArray(safeCall(globalScope.gridlyWeatherConnector?.getNormalizedRecords))
    };
  }

  function coerceInput(input) {
    const source = input && typeof input === "object" ? input : collectFromRuntime();
    return PROVIDERS.reduce((memo, providerId) => {
      memo[providerId] = asArray(source[providerId]).map(clone).filter(Boolean);
      return memo;
    }, {});
  }

  function buildEmptyModel() {
    return {
      providerInventory: {},
      relationshipInventory: [],
      overlapInventory: [],
      complementInventory: [],
      conflictInventory: [],
      geographicObservations: [],
      temporalObservations: [],
      strongestEvidenceGroups: [],
      relationshipClusters: [],
      providerParticipation: {}
    };
  }

  function synthesize(input) {
    lastHealthy = true;
    const recordsByProvider = coerceInput(input);
    const model = buildEmptyModel();
    const flat = [];

    PROVIDERS.forEach((providerId) => {
      const records = recordsByProvider[providerId];
      model.providerInventory[providerId] = { providerId, recordCount: records.length, available: records.length > 0 };
      model.providerParticipation[providerId] = records.length;
      records.forEach((record, index) => {
        flat.push({ providerId: normalizeProviderId(record.providerId || record.provider, providerId), id: recordId(record, providerId, index), type: recordType(record), time: recordTime(record), location: recordLocation(record), record });
      });
    });

    const geoGroups = new Map();
    const temporalGroups = new Map();
    flat.forEach((item) => {
      if (item.location) {
        if (!geoGroups.has(item.location.bucket)) geoGroups.set(item.location.bucket, []);
        geoGroups.get(item.location.bucket).push(item);
      }
      const day = item.time ? String(item.time).slice(0, 10) : "unknown";
      if (!temporalGroups.has(day)) temporalGroups.set(day, []);
      temporalGroups.get(day).push(item);
    });

    flat.forEach((left, leftIndex) => {
      flat.slice(leftIndex + 1).forEach((right) => {
        if (left.providerId === right.providerId) return;
        const sameType = left.type === right.type;
        const samePlace = left.location && right.location && left.location.bucket === right.location.bucket;
        const relationship = { providers: [left.providerId, right.providerId], records: [left.id, right.id], sameType, samePlace };
        model.relationshipInventory.push(relationship);
        if (sameType && samePlace) model.overlapInventory.push(relationship);
        else if (samePlace || sameType) model.complementInventory.push(relationship);
        if (samePlace && !sameType) model.conflictInventory.push(relationship);
      });
    });

    geoGroups.forEach((items, bucket) => {
      model.geographicObservations.push({ bucket, recordCount: items.length, providerCount: new Set(items.map((item) => item.providerId)).size });
    });
    temporalGroups.forEach((items, bucket) => {
      model.temporalObservations.push({ bucket, recordCount: items.length, providerCount: new Set(items.map((item) => item.providerId)).size });
    });
    model.strongestEvidenceGroups = model.geographicObservations.filter((group) => group.providerCount > 1).sort((a, b) => b.recordCount - a.recordCount);
    model.relationshipClusters = model.overlapInventory.concat(model.complementInventory);

    lastModel = freeze(model);
    return lastModel;
  }

  function countsByProvider() {
    return PROVIDERS.reduce((memo, providerId) => {
      memo[providerId] = Number(lastModel.providerInventory[providerId]?.recordCount) || 0;
      return memo;
    }, {});
  }

  function relationshipCounts() {
    return {
      relationships: lastModel.relationshipInventory.length,
      overlaps: lastModel.overlapInventory.length,
      complements: lastModel.complementInventory.length,
      conflicts: lastModel.conflictInventory.length,
      geographicObservations: lastModel.geographicObservations.length,
      temporalObservations: lastModel.temporalObservations.length
    };
  }

  function runtime(input) {
    synthesize(input);
    return freeze({
      available: true,
      enabled: false,
      active: false,
      synthesizedRecordCount: PROVIDERS.reduce((sum, providerId) => sum + (lastModel.providerInventory[providerId]?.recordCount || 0), 0),
      providerCounts: countsByProvider(),
      relationshipCounts: relationshipCounts(),
      runtimeHealthy: lastHealthy === true
    });
  }

  function providerAvailable(providerId) {
    if (providerId === "community") return typeof globalScope.getLiveHazardIncidents === "function" || Array.isArray(globalScope.activeHazards) || Array.isArray(globalScope.unifiedRoadIncidents) || Array.isArray(globalScope.activeUnifiedIncidents);
    if (providerId === "drivetexas") return Boolean(globalScope.gridlyDriveTexasConnector || globalScope.gridlyDriveTexasProvider);
    if (providerId === "weather") return Boolean(globalScope.gridlyWeatherConnector || globalScope.gridlyWeatherProvider);
    return false;
  }

  globalScope.gridlyUnifiedIntelligencePrototype = runtime;
  globalScope.gridlyUnifiedIntelligencePrototypeAudit = function gridlyUnifiedIntelligencePrototypeAudit() {
    const summary = runtime();
    return freeze({
      prototypeExists: typeof globalScope.gridlyUnifiedIntelligencePrototype === "function",
      providersAvailable: PROVIDERS.reduce((memo, providerId) => { memo[providerId] = providerAvailable(providerId); return memo; }, {}),
      synthesisCompleted: summary.runtimeHealthy === true,
      renderingPerformed: false,
      providerActivationPerformed: false,
      pollingPerformed: false,
      consumerChangesDetected: false,
      protectedBoundaries: {
        communityReportsRemainPrimary: true,
        driveTexasOfficialRoadwayProvider: OFFICIAL_ROADWAY_PROVIDER === "drivetexas",
        weatherOfficialWeatherProvider: OFFICIAL_WEATHER_PROVIDER === "weather",
        unifiedIntelligenceOwnership: RUNTIME_BOUNDARIES
      }
    });
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { synthesize, runtime, audit: globalScope.gridlyUnifiedIntelligencePrototypeAudit };
  }
})(typeof window !== "undefined" ? window : globalThis);
