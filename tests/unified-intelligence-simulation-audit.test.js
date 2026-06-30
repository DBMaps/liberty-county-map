const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext() {
  const context = {
    console,
    window: {},
    globalThis: {},
    document: {
      createElement: () => { throw new Error("simulation must not create UI"); },
      querySelector: () => { throw new Error("simulation must not query UI"); }
    },
    fetch: async () => { throw new Error("simulation must not fetch live provider data"); }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
  vm.runInContext(fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8"), context, { filename: "js/gridlyDriveTexasProvider.js" });
  vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });
  vm.runInContext(fs.readFileSync("js/gridlyUnifiedIntelligence.js", "utf8"), context, { filename: "js/gridlyUnifiedIntelligence.js" });
  vm.runInContext(fs.readFileSync("js/gridlyUnifiedIntelligenceSimulation.js", "utf8"), context, { filename: "js/gridlyUnifiedIntelligenceSimulation.js" });
  return context;
}

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyUnifiedIntelligenceSimulation.js?v=835"));
assert(indexSource.indexOf("js/gridlyIntelligenceActivationReadiness.js?v=834") < indexSource.indexOf("js/gridlyUnifiedIntelligenceSimulation.js?v=835"));

const context = loadContext();
assert.strictEqual(typeof context.gridlyUnifiedIntelligenceSimulation, "object");
assert.strictEqual(typeof context.gridlyUnifiedIntelligenceSimulation.evaluate, "function");
assert.strictEqual(typeof context.gridlyUnifiedIntelligenceSimulation.runSampleScenario, "function");
assert.strictEqual(typeof context.gridlyUnifiedSimulationAudit, "function");

const driveBefore = context.gridlyDriveTexasProvider.getRuntimeState();
const weatherBefore = context.gridlyWeatherProvider.getRuntimeState();
const unifiedBefore = context.gridlyUnifiedIntelligence.getState();

const audit = context.gridlyUnifiedSimulationAudit();
assert.strictEqual(audit.simulationAvailable, true);
assert.strictEqual(JSON.stringify(audit.providerSupport), JSON.stringify({ community: true, drivetexas: true, weather: true }));
assert.strictEqual(audit.consumerRenderingPerformed, false);
assert.strictEqual(audit.safeIsolation, true);
assert.strictEqual(audit.readsLiveState, false);
assert.strictEqual(audit.writesLiveState, false);
assert.strictEqual(audit.readyForPresentationDesign, true);

const evaluation = context.gridlyUnifiedIntelligenceSimulation.evaluate([
  { id: "community-flood-us90", providerId: "community", provider: "Community", category: "Flooding", title: "Flooding on US 90", description: "Water over roadway", routeName: "US 90", rawPayloadExposed: false },
  { id: "drivetexas-closure-us90", providerId: "drivetexas", provider: "DriveTexas", category: "Road Closure", title: "Road Closed due to Flooding on US 90", description: "Closed due to flooding", routeName: "US 90", rawPayloadExposed: false },
  { id: "weather-flash-flood", providerId: "weather", provider: "Weather", category: "Flash Flood Warning", title: "Flash Flood Warning", description: "Flash flooding possible near US 90", affectedAreas: ["Liberty"], rawPayloadExposed: false },
  { id: "community-clear-us90", providerId: "community", provider: "Community", category: "Road Clear", title: "Road Clear on US 90", description: "Road clear", routeName: "US 90", rawPayloadExposed: false },
  { id: "raw-rejected", providerId: "weather", category: "Flood Warning", properties: { raw: true }, rawPayloadExposed: true }
]);

assert.strictEqual(evaluation.simulatedRecordCount, 4);
assert.strictEqual(JSON.stringify(evaluation.providersRepresented), JSON.stringify(["community", "drivetexas", "weather"]));
assert(evaluation.categoriesRepresented.includes("Flooding"));
assert(evaluation.categoriesRepresented.includes("Road Closure"));
assert(evaluation.categoriesRepresented.includes("Flash Flood Warning"));
assert(evaluation.categoriesRepresented.includes("Road Clear"));
assert.strictEqual(evaluation.consumerRenderingPerformed, false);
assert(evaluation.duplicateCandidates.length >= 1, "duplicate detection reports related flooding observations");
assert(evaluation.overlappingConditions.length >= 2, "overlap detection reports flood warning, closure, and community overlap");
assert(evaluation.conflictingConditions.length >= 1, "conflict detection reports clear vs closed conditions");
assert.strictEqual(evaluation.observations.length, 4);
assert(!JSON.stringify(evaluation).includes("raw-rejected"));

const sample = context.gridlyUnifiedIntelligenceSimulation.runSampleScenario();
assert.strictEqual(sample.simulatedRecordCount, 3);
assert.strictEqual(sample.consumerRenderingPerformed, false);
assert(sample.duplicateCandidates.length >= 1);
assert(sample.overlappingConditions.length >= 1);

assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), driveBefore);
assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState(), weatherBefore);
assert.deepStrictEqual(context.gridlyUnifiedIntelligence.getState(), unifiedBefore);
assert.strictEqual(JSON.stringify(context.gridlyUnifiedIntelligence.collectNormalizedRecords()), JSON.stringify([]));
assert.strictEqual(context.gridlyUnifiedIntelligenceSimulation.activate, undefined);
assert.strictEqual(context.gridlyUnifiedIntelligenceSimulation.render, undefined);
