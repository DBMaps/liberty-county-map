(function initGridlyUnifiedIntelligenceObservationAudit(globalScope) {
  "use strict";

  if (!globalScope || typeof globalScope !== "object") return;

  const PROVIDERS = Object.freeze(["community", "drivetexas", "weather"]);
  const EMPTY_SCENARIOS = Object.freeze({ community: [], drivetexas: [], weather: [] });
  const SAMPLE_RECORDS = Object.freeze({
    community: [{ id: "v849-community", providerId: "community", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T10:00:00Z" }],
    drivetexas: [{ id: "v849-drivetexas", providerId: "drivetexas", type: "flood", lat: 30.051, lon: -94.799, updatedAt: "2026-06-30T10:05:00Z" }],
    weather: [{ id: "v849-weather", providerId: "weather", type: "flash_flood_warning", lat: 30.049, lon: -94.801, updatedAt: "2026-06-30T10:10:00Z" }]
  });

  function freeze(value) {
    if (!value || typeof value !== "object") return value;
    Object.keys(value).forEach((key) => freeze(value[key]));
    return Object.freeze(value);
  }

  function clone(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return null; }
  }

  function stableString(value) {
    if (Array.isArray(value)) return `[${value.map(stableString).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableString(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  function safeCall(fn, arg) {
    if (typeof fn !== "function") return null;
    try { return fn(arg); } catch (error) { return null; }
  }

  function summarizeModel(model) {
    const providerInventory = model?.providerInventory || {};
    const providerParticipation = PROVIDERS.reduce((memo, providerId) => {
      memo[providerId] = Number(providerInventory[providerId]?.recordCount ?? model?.providerParticipation?.[providerId]) || 0;
      return memo;
    }, {});
    return {
      synthesizedRecordCount: PROVIDERS.reduce((sum, providerId) => sum + providerParticipation[providerId], 0),
      providerParticipation,
      relationshipClusterCount: Array.isArray(model?.relationshipClusters) ? model.relationshipClusters.length : 0,
      overlapCount: Array.isArray(model?.overlapInventory) ? model.overlapInventory.length : 0,
      complementCount: Array.isArray(model?.complementInventory) ? model.complementInventory.length : 0,
      conflictCount: Array.isArray(model?.conflictInventory) ? model.conflictInventory.length : 0,
      strongestEvidenceGroupCount: Array.isArray(model?.strongestEvidenceGroups) ? model.strongestEvidenceGroups.length : 0
    };
  }

  function evaluateScenario(name, providerIds) {
    const input = PROVIDERS.reduce((memo, providerId) => {
      memo[providerId] = providerIds.includes(providerId) ? clone(SAMPLE_RECORDS[providerId]) : [];
      return memo;
    }, {});
    const first = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeEvaluate, input);
    const second = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeEvaluate, input);
    return {
      name,
      providers: providerIds.slice(),
      observations: summarizeModel(first),
      stable: stableString(first) === stableString(second),
      healthy: Boolean(first) && Boolean(second)
    };
  }

  function audit() {
    const prototypeAudit = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeAudit) || {};
    const currentModel = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeSnapshot) || {};
    const firstSnapshot = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeSnapshot) || {};
    const secondSnapshot = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeSnapshot) || {};
    const emptyFirst = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeEvaluate, EMPTY_SCENARIOS);
    const emptySecond = safeCall(globalScope.gridlyUnifiedIntelligencePrototypeEvaluate, EMPTY_SCENARIOS);
    const mixedStateValidations = [
      evaluateScenario("community only", ["community"]),
      evaluateScenario("DriveTexas only", ["drivetexas"]),
      evaluateScenario("Weather only", ["weather"]),
      evaluateScenario("Community + DriveTexas", ["community", "drivetexas"]),
      evaluateScenario("Community + Weather", ["community", "weather"]),
      evaluateScenario("DriveTexas + Weather", ["drivetexas", "weather"]),
      evaluateScenario("All three providers", ["community", "drivetexas", "weather"])
    ];
    const driftDetected = stableString(firstSnapshot) !== stableString(secondSnapshot);
    return freeze({
      observationAuditAvailable: true,
      prototypeExists: typeof globalScope.gridlyUnifiedIntelligencePrototype === "function",
      currentObservations: summarizeModel(currentModel),
      runtimeHealth: {
        synthesisCompleted: prototypeAudit.synthesisCompleted === true,
        runtimeHealthy: prototypeAudit.synthesisCompleted === true && typeof globalScope.gridlyUnifiedIntelligencePrototypeSnapshot === "function",
        providerInventoriesAvailable: Boolean(currentModel.providerInventory),
        relationshipInventoriesAvailable: Array.isArray(currentModel.relationshipInventory)
      },
      consistencyReview: { stableSnapshot: !driftDetected, unexpectedDriftDetected: driftDetected },
      emptyStateValidation: { observations: summarizeModel(emptyFirst), stable: stableString(emptyFirst) === stableString(emptySecond), healthy: Boolean(emptyFirst) && Boolean(emptySecond) },
      mixedStateValidations,
      runtimeContainment: {
        unifiedIntelligenceInactive: prototypeAudit.prototypeExists === true && prototypeAudit.synthesisCompleted === true,
        providerActivation: prototypeAudit.providerActivationPerformed === true,
        rendering: prototypeAudit.renderingPerformed === true,
        polling: prototypeAudit.pollingPerformed === true,
        consumerChanges: prototypeAudit.consumerChangesDetected === true
      },
      certification: {
        stableSynthesis: !driftDetected && mixedStateValidations.every((item) => item.stable),
        noRendering: prototypeAudit.renderingPerformed === false,
        noProviderActivation: prototypeAudit.providerActivationPerformed === false,
        noPolling: prototypeAudit.pollingPerformed === false,
        consumerExperienceUnchanged: prototypeAudit.consumerChangesDetected === false
      }
    });
  }

  globalScope.gridlyUnifiedIntelligenceObservationAudit = audit;
})(typeof window !== "undefined" ? window : globalThis);
