const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext() {
  const context = {
    console,
    window: {},
    globalThis: {},
    fetch: async () => { throw new Error("Unified Intelligence Prototype must not fetch"); },
    activeHazards: [{ id: "c1", providerId: "community", type: "flood", lat: 30.05, lon: -94.80, updatedAt: "2026-06-30T10:00:00Z" }]
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    "js/gridlyDriveTexasProvider.js",
    "js/gridlyWeatherProvider.js",
    "js/gridlyDriveTexasLiveConnector.js",
    "js/gridlyWeatherLiveConnector.js",
    "js/gridlyUnifiedIntelligencePrototype.js"
  ].forEach((file) => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file }));
  return context;
}

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyUnifiedIntelligencePrototype.js?v=848"));
assert(indexSource.indexOf("js/gridlyUnifiedIntelligenceReadinessAudit.js?v=847") < indexSource.indexOf("js/gridlyUnifiedIntelligencePrototype.js?v=848"));

const context = loadContext();
const driveAuditBefore = context.gridlyDriveTexasConnectorRuntimeAudit();
const weatherAuditBefore = context.gridlyWeatherConnectorRuntimeAudit();

assert.strictEqual(typeof context.gridlyUnifiedIntelligencePrototype, "function");
assert.strictEqual(typeof context.gridlyUnifiedIntelligencePrototypeAudit, "function");

const summary = context.gridlyUnifiedIntelligencePrototype({
  community: [{ id: "c1", providerId: "community", type: "flood", lat: 30.05, lon: -94.8, updatedAt: "2026-06-30T10:00:00Z" }],
  drivetexas: [{ id: "d1", providerId: "drivetexas", type: "flood", lat: 30.051, lon: -94.799, updatedAt: "2026-06-30T10:05:00Z" }],
  weather: [{ id: "w1", providerId: "weather", type: "flash_flood_warning", lat: 30.049, lon: -94.801, updatedAt: "2026-06-30T10:10:00Z" }]
});

assert.strictEqual(summary.available, true);
assert.strictEqual(summary.enabled, false);
assert.strictEqual(summary.active, false);
assert.strictEqual(summary.synthesizedRecordCount, 3);
assert.strictEqual(JSON.stringify(summary.providerCounts), JSON.stringify({ community: 1, drivetexas: 1, weather: 1 }));
assert.strictEqual(summary.relationshipCounts.relationships, 3);
assert.strictEqual(summary.relationshipCounts.overlaps, 1);
assert.strictEqual(summary.relationshipCounts.complements, 2);
assert.strictEqual(summary.relationshipCounts.conflicts, 2);
assert.strictEqual(summary.runtimeHealthy, true);

const audit = context.gridlyUnifiedIntelligencePrototypeAudit();
assert.strictEqual(audit.prototypeExists, true);
assert.strictEqual(audit.providersAvailable.community, true);
assert.strictEqual(audit.providersAvailable.drivetexas, true);
assert.strictEqual(audit.providersAvailable.weather, true);
assert.strictEqual(audit.synthesisCompleted, true);
assert.strictEqual(audit.renderingPerformed, false);
assert.strictEqual(audit.providerActivationPerformed, false);
assert.strictEqual(audit.pollingPerformed, false);
assert.strictEqual(audit.consumerChangesDetected, false);
assert.strictEqual(audit.protectedBoundaries.communityReportsRemainPrimary, true);
assert.strictEqual(audit.protectedBoundaries.driveTexasOfficialRoadwayProvider, true);
assert.strictEqual(audit.protectedBoundaries.weatherOfficialWeatherProvider, true);
assert.strictEqual(audit.protectedBoundaries.unifiedIntelligenceOwnership.ownsProviderNetworking, false);
assert.strictEqual(audit.protectedBoundaries.unifiedIntelligenceOwnership.ownsProviderPresentation, false);

assert.strictEqual(JSON.stringify(context.gridlyDriveTexasConnectorRuntimeAudit()), JSON.stringify(driveAuditBefore));
assert.strictEqual(JSON.stringify(context.gridlyWeatherConnectorRuntimeAudit()), JSON.stringify(weatherAuditBefore));
assert.strictEqual(context.gridlyDriveTexasConnectorRuntimeAudit().automaticPolling, false);
assert.strictEqual(context.gridlyWeatherConnectorRuntimeAudit().automaticPolling, false);
assert.strictEqual(context.gridlyDriveTexasConnectorRuntimeAudit().providerActivated, false);
assert.strictEqual(context.gridlyWeatherConnectorRuntimeAudit().providerActivated, false);
assert.strictEqual(context.gridlyDriveTexasConnectorRuntimeAudit().renderingPerformed, false);
assert.strictEqual(context.gridlyWeatherConnectorRuntimeAudit().renderingPerformed, false);
