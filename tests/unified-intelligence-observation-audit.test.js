const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext() {
  const context = {
    console,
    window: {},
    globalThis: {},
    fetch: async () => { throw new Error("V849 observation audit must not fetch"); },
    setInterval: () => { throw new Error("V849 observation audit must not introduce polling"); },
    activeHazards: []
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    "js/gridlyDriveTexasProvider.js",
    "js/gridlyWeatherProvider.js",
    "js/gridlyDriveTexasLiveConnector.js",
    "js/gridlyWeatherLiveConnector.js",
    "js/gridlyUnifiedIntelligencePrototype.js",
    "js/gridlyUnifiedIntelligenceObservationAudit.js"
  ].forEach((file) => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file }));
  return context;
}

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyUnifiedIntelligenceObservationAudit.js?v=849"));
assert(indexSource.indexOf("js/gridlyUnifiedIntelligencePrototype.js?v=848") < indexSource.indexOf("js/gridlyUnifiedIntelligenceObservationAudit.js?v=849"));

const context = loadContext();
assert.strictEqual(typeof context.gridlyUnifiedIntelligencePrototype, "function", "prototype exists");
assert.strictEqual(typeof context.gridlyUnifiedIntelligencePrototypeAudit, "function", "prototype audit exists");
assert.strictEqual(typeof context.gridlyUnifiedIntelligenceObservationAudit, "function", "observation audit is available");

const beforeDriveTexas = JSON.stringify(context.gridlyDriveTexasConnectorRuntimeAudit());
const beforeWeather = JSON.stringify(context.gridlyWeatherConnectorRuntimeAudit());
const initialModel = context.gridlyUnifiedIntelligencePrototype({
  community: [{ id: "c1", providerId: "community", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T10:00:00Z" }],
  drivetexas: [{ id: "d1", providerId: "drivetexas", type: "flood", lat: 30.051, lon: -94.799, updatedAt: "2026-06-30T10:05:00Z" }],
  weather: [{ id: "w1", providerId: "weather", type: "flash_flood_warning", lat: 30.049, lon: -94.801, updatedAt: "2026-06-30T10:10:00Z" }]
});
const snapshotBeforeAudit = JSON.stringify(context.gridlyUnifiedIntelligencePrototypeSnapshot());

const audit = context.gridlyUnifiedIntelligenceObservationAudit();
const snapshotAfterAudit = JSON.stringify(context.gridlyUnifiedIntelligencePrototypeSnapshot());

assert.strictEqual(snapshotAfterAudit, snapshotBeforeAudit, "observation audit does not modify current synthesized model");
assert.strictEqual(audit.observationAuditAvailable, true);
assert.strictEqual(audit.prototypeExists, true);
assert.strictEqual(audit.currentObservations.synthesizedRecordCount, 3);
assert.strictEqual(JSON.stringify(audit.currentObservations.providerParticipation), JSON.stringify({ community: 1, drivetexas: 1, weather: 1 }));
assert.strictEqual(audit.currentObservations.relationshipClusterCount, 3);
assert.strictEqual(audit.currentObservations.overlapCount, 1);
assert.strictEqual(audit.currentObservations.complementCount, 2);
assert.strictEqual(audit.currentObservations.conflictCount, 2);
assert.strictEqual(audit.currentObservations.strongestEvidenceGroupCount, 1);
assert.strictEqual(audit.runtimeHealth.synthesisCompleted, true);
assert.strictEqual(audit.runtimeHealth.runtimeHealthy, true);
assert.strictEqual(audit.runtimeHealth.providerInventoriesAvailable, true);
assert.strictEqual(audit.runtimeHealth.relationshipInventoriesAvailable, true);
assert.strictEqual(audit.consistencyReview.stableSnapshot, true);
assert.strictEqual(audit.consistencyReview.unexpectedDriftDetected, false);
assert.strictEqual(audit.emptyStateValidation.healthy, true);
assert.strictEqual(audit.emptyStateValidation.stable, true);
assert.strictEqual(audit.emptyStateValidation.observations.synthesizedRecordCount, 0);
assert.strictEqual(audit.emptyStateValidation.observations.relationshipClusterCount, 0);
assert.strictEqual(audit.mixedStateValidations.length, 7);
assert(audit.mixedStateValidations.every((scenario) => scenario.healthy && scenario.stable), "all mixed states are healthy and stable");
assert.strictEqual(JSON.stringify(audit.mixedStateValidations.map((scenario) => scenario.observations.synthesizedRecordCount)), JSON.stringify([1, 1, 1, 2, 2, 2, 3]));
assert.strictEqual(audit.runtimeContainment.unifiedIntelligenceInactive, true);
assert.strictEqual(audit.runtimeContainment.providerActivation, false);
assert.strictEqual(audit.runtimeContainment.rendering, false);
assert.strictEqual(audit.runtimeContainment.polling, false);
assert.strictEqual(audit.runtimeContainment.consumerChanges, false);
assert.strictEqual(audit.certification.stableSynthesis, true);
assert.strictEqual(audit.certification.noRendering, true);
assert.strictEqual(audit.certification.noProviderActivation, true);
assert.strictEqual(audit.certification.noPolling, true);
assert.strictEqual(audit.certification.consumerExperienceUnchanged, true);
assert.strictEqual(JSON.stringify(context.gridlyDriveTexasConnectorRuntimeAudit()), beforeDriveTexas, "DriveTexas consumer/provider runtime unchanged");
assert.strictEqual(JSON.stringify(context.gridlyWeatherConnectorRuntimeAudit()), beforeWeather, "Weather consumer/provider runtime unchanged");
assert.strictEqual(initialModel.synthesizedRecordCount, 3);
