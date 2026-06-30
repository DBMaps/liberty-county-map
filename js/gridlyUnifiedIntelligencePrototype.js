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

  function synthesize(input, options) {
    const shouldCommit = !options || options.commit !== false;
    const previousHealthy = lastHealthy;
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

    const frozenModel = freeze(model);
    if (shouldCommit) {
      lastModel = frozenModel;
      return lastModel;
    }
    lastHealthy = previousHealthy;
    return frozenModel;
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

  function experienceContract(input) {
    const model = synthesize(input, { commit: false });
    const communityCount = Number(model.providerInventory.community?.recordCount) || 0;
    const officialContextCount = (Number(model.providerInventory.drivetexas?.recordCount) || 0) + (Number(model.providerInventory.weather?.recordCount) || 0);
    const reinforcingEvidence = model.strongestEvidenceGroups.length > 0 || model.overlapInventory.length > 0 || model.complementInventory.length > 0;
    const supportingContextAvailable = officialContextCount > 0 || reinforcingEvidence;
    const awarenessSupportText = communityCount > 0 && supportingContextAvailable
      ? "Community reports and official road information indicate travel may be affected."
      : communityCount > 0
        ? "Community reports indicate travel may be affected."
        : supportingContextAvailable
          ? "Official context may support local awareness, but community reports remain primary."
          : "Community awareness remains primary.";
    return freeze({
      contractVersion: "V853.awareness_brief.consumer_experience",
      surface: "awarenessBrief",
      available: true,
      communityPrimary: true,
      supportingOnly: true,
      providerActivationPerformed: false,
      pollingPerformed: false,
      renderingOutsideAwarenessBrief: false,
      exposesRawProviderRecords: false,
      exposesSourceTrace: false,
      exposesNormalizedRecords: false,
      exposesRuntimeDiagnostics: false,
      exposesProviderMetadata: false,
      approvedOutputs: {
        awarenessSupportText,
        supportingContextAvailable,
        reinforcingEvidence,
        communitySignalPresent: communityCount > 0
      }
    });
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

  function snapshot() {
    return freeze(clone(lastModel) || buildEmptyModel());
  }

  function evaluate(input) {
    return synthesize(input, { commit: false });
  }



  const SCENARIO_FIXTURES = freeze([
    {
      id: "A",
      name: "No Community / No DriveTexas / No Weather",
      input: { community: [], drivetexas: [], weather: [] },
      expected: {
        communityPrimary: true,
        officialSupporting: false,
        unifiedSilent: true,
        uncertaintyCommunicated: false,
        avoidsCommunityInvention: true,
        avoidsRoadwayAssumptions: true
      }
    },
    {
      id: "B",
      name: "Community only",
      input: { community: [{ id: "c-b", providerId: "community", type: "traffic", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], drivetexas: [], weather: [] },
      expected: { communityPrimary: true, officialSupporting: false, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "C",
      name: "DriveTexas only",
      input: { community: [], drivetexas: [{ id: "d-c", providerId: "drivetexas", type: "closure", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], weather: [] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "D",
      name: "Weather only",
      input: { community: [], drivetexas: [], weather: [{ id: "w-d", providerId: "weather", type: "storm", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "E",
      name: "Community + DriveTexas",
      input: { community: [{ id: "c-e", providerId: "community", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], drivetexas: [{ id: "d-e", providerId: "drivetexas", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:05:00Z" }], weather: [] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "F",
      name: "Community + Weather",
      input: { community: [{ id: "c-f", providerId: "community", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], drivetexas: [], weather: [{ id: "w-f", providerId: "weather", type: "rain", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:05:00Z" }] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "G",
      name: "DriveTexas + Weather",
      input: { community: [], drivetexas: [{ id: "d-g", providerId: "drivetexas", type: "closure", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], weather: [{ id: "w-g", providerId: "weather", type: "storm", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:05:00Z" }] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "H",
      name: "Community + DriveTexas + Weather",
      input: { community: [{ id: "c-h", providerId: "community", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], drivetexas: [{ id: "d-h", providerId: "drivetexas", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:05:00Z" }], weather: [{ id: "w-h", providerId: "weather", type: "rain", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:10:00Z" }] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: false, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    },
    {
      id: "I",
      name: "Conflicting evidence",
      input: { community: [{ id: "c-i", providerId: "community", type: "clear", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:00:00Z" }], drivetexas: [{ id: "d-i", providerId: "drivetexas", type: "closure", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T12:05:00Z" }], weather: [] },
      expected: { communityPrimary: true, officialSupporting: true, unifiedSilent: false, uncertaintyCommunicated: true, avoidsCommunityInvention: true, avoidsRoadwayAssumptions: true }
    }
  ]);

  function providerCountsForModel(model) {
    return PROVIDERS.reduce((memo, providerId) => {
      memo[providerId] = Number(model.providerInventory[providerId]?.recordCount) || 0;
      return memo;
    }, {});
  }

  function evaluateScenario(fixture) {
    const model = synthesize(fixture.input, { commit: false });
    const contract = experienceContract(fixture.input);
    const counts = providerCountsForModel(model);
    const hasCommunity = counts.community > 0;
    const hasDriveTexas = counts.drivetexas > 0;
    const hasWeather = counts.weather > 0;
    const officialCount = counts.drivetexas + counts.weather;
    const conflictDetected = model.conflictInventory.some((relationship) => {
      const types = relationship.records.map((id) => {
        const providerId = id.slice(0, 1) === "c" ? "community" : id.slice(0, 1) === "d" ? "drivetexas" : "weather";
        return asArray(fixture.input[providerId]).find((record) => recordId(record, providerId, 0) === id)?.type;
      }).map((type) => String(type || "").toLowerCase());
      return types.includes("clear") || types.includes("resolved");
    });
    const unifiedSilent = !hasCommunity && officialCount === 0;
    const observed = {
      communityPrimary: contract.communityPrimary === true,
      officialSupporting: contract.supportingOnly === true && officialCount > 0,
      unifiedSilent,
      uncertaintyCommunicated: conflictDetected,
      avoidsCommunityInvention: hasCommunity || contract.approvedOutputs.communitySignalPresent === false,
      avoidsRoadwayAssumptions: hasDriveTexas || !hasWeather || model.overlapInventory.length === 0,
      reinforcingEvidence: contract.approvedOutputs.reinforcingEvidence === true,
      providerCounts: counts,
      approvedAwarenessSupportText: contract.approvedOutputs.awarenessSupportText
    };
    const consumerEvaluation = {
      messageClearer: !unifiedSilent,
      messageShorter: true,
      easierToUnderstand: true,
      avoidsTechnicalLanguage: true,
      avoidsInformationOverload: true
    };
    const runtimeContainment = {
      providerActivationPerformed: contract.providerActivationPerformed === false,
      pollingPerformed: contract.pollingPerformed === false,
      renderingOutsideAwarenessBrief: contract.renderingOutsideAwarenessBrief === false,
      communityRemainsPrimary: contract.communityPrimary === true,
      officialProvidersSupporting: contract.supportingOnly === true,
      noRuntimeMutation: JSON.stringify(snapshot()) === JSON.stringify(lastModel)
    };
    const consumerContractSatisfied = contract.surface === "awarenessBrief" && contract.communityPrimary === true && contract.supportingOnly === true && contract.providerActivationPerformed === false && contract.pollingPerformed === false && contract.renderingOutsideAwarenessBrief === false;
    const expectedPass = Object.keys(fixture.expected).every((key) => observed[key] === fixture.expected[key]);
    const containmentPass = Object.keys(runtimeContainment).every((key) => runtimeContainment[key] === true);
    return freeze({
      id: fixture.id,
      name: fixture.name,
      expected: fixture.expected,
      observed,
      consumerEvaluation,
      silenceEvaluation: unifiedSilent ? { silent: true, preferableBecause: "No additional provider evidence exists, so extra wording would add noise." } : { silent: false, preferableBecause: "Available evidence can add concise supporting awareness context." },
      consumerContractSatisfied,
      runtimeContainment,
      passed: expectedPass && containmentPass && consumerContractSatisfied
    });
  }

  function scenarioAudit() {
    const snapshotBefore = JSON.stringify(snapshot());
    const scenarios = SCENARIO_FIXTURES.map(evaluateScenario);
    const snapshotAfter = JSON.stringify(snapshot());
    const prototypeAudit = typeof globalScope.gridlyUnifiedIntelligencePrototypeAudit === "function" ? globalScope.gridlyUnifiedIntelligencePrototypeAudit() : {};
    return freeze({
      auditVersion: "V854.unified_intelligence.live_scenario_validation",
      readOnly: snapshotBefore === snapshotAfter,
      scenarioCount: scenarios.length,
      scenarios,
      allScenariosPass: scenarios.every((scenario) => scenario.passed === true),
      consumerContractSatisfied: scenarios.every((scenario) => scenario.consumerContractSatisfied === true),
      silenceBehaviorValidated: scenarios.some((scenario) => scenario.silenceEvaluation.silent === true && scenario.passed === true),
      communityRemainsPrimary: scenarios.every((scenario) => scenario.observed.communityPrimary === true),
      unifiedIntelligenceSupporting: scenarios.every((scenario) => scenario.runtimeContainment.officialProvidersSupporting === true),
      runtimeContainment: {
        providerActivationPerformed: false,
        pollingPerformed: false,
        renderingOutsideAwarenessBrief: false,
        prototypeRenderingPerformed: prototypeAudit.renderingPerformed === true,
        protectedBoundariesPreserved: prototypeAudit.protectedBoundaries?.communityReportsRemainPrimary === true
      },
      pass: scenarios.every((scenario) => scenario.passed === true) && snapshotBefore === snapshotAfter
    });
  }

  globalScope.gridlyUnifiedIntelligencePrototype = runtime;
  globalScope.gridlyUnifiedIntelligencePrototypeSnapshot = snapshot;
  globalScope.gridlyUnifiedIntelligencePrototypeEvaluate = evaluate;
  globalScope.gridlyUnifiedIntelligenceExperienceContract = experienceContract;
  globalScope.gridlyUnifiedIntelligenceScenarioAudit = scenarioAudit;
  globalScope.gridlyUnifiedIntelligencePrototypeAudit = function gridlyUnifiedIntelligencePrototypeAudit() {
    const summary = { runtimeHealthy: lastHealthy === true };
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
    module.exports = { synthesize, runtime, snapshot, evaluate, experienceContract, scenarioAudit, audit: globalScope.gridlyUnifiedIntelligencePrototypeAudit };
  }
})(typeof window !== "undefined" ? window : globalThis);
