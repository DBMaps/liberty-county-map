const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext({ includeWeatherEndpoint = true } = {}) {
  let fetchCalled = false;
  const context = {
    console,
    window: {},
    globalThis: {},
    fetch: async () => {
      fetchCalled = true;
      throw new Error("V839 audit must not fetch external data");
    },
    document: {
      createElement: () => { throw new Error("V839 audit must not render"); },
      querySelector: () => { throw new Error("V839 audit must not query consumer UI"); }
    },
    __fetchCalled: () => fetchCalled
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  [
    "js/gridlyPackageRegistry.js",
    "js/gridlyDriveTexasProvider.js",
    "js/gridlyWeatherProvider.js",
    "js/gridlyUnifiedIntelligence.js",
    "js/gridlyIntelligenceActivationReadiness.js",
    "js/gridlyUnifiedIntelligenceSimulation.js",
    "js/gridlyOfficialProviderSourceEvaluation.js",
    "js/gridlyDriveTexasConnectorEndpointAudit.js"
  ].forEach((file) => vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file }));
  if (includeWeatherEndpoint) {
    vm.runInContext(fs.readFileSync("js/gridlyWeatherConnectorEndpointAudit.js", "utf8"), context, { filename: "js/gridlyWeatherConnectorEndpointAudit.js" });
  }
  vm.runInContext(fs.readFileSync("js/gridlyLiveConnectorDesignReadinessAudit.js", "utf8"), context, { filename: "js/gridlyLiveConnectorDesignReadinessAudit.js" });
  return context;
}

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyLiveConnectorDesignReadinessAudit.js?v=839"));
assert(indexSource.indexOf("js/gridlyWeatherConnectorEndpointAudit.js?v=838") < indexSource.indexOf("js/gridlyLiveConnectorDesignReadinessAudit.js?v=839"));

const docSource = fs.readFileSync("GRIDLY-V839-LIVE-CONNECTOR-DESIGN-READINESS.md", "utf8");
assert(docSource.includes("DriveTexas Connector Readiness"));
assert(docSource.includes("Weather Connector Readiness"));
assert(docSource.includes("Shared Connector Rules"));
assert(docSource.includes("Implementation Non-Goals"));

const context = loadContext();
assert.strictEqual(typeof context.gridlyLiveConnectorDesignReadinessAudit, "function");
assert.strictEqual(context.activateUnifiedIntelligence, undefined);

const driveBefore = context.gridlyDriveTexasProvider.getRuntimeState();
const weatherBefore = context.gridlyWeatherProvider.getRuntimeState();
const unifiedBefore = context.gridlyUnifiedIntelligence.getState();
const audit = context.gridlyLiveConnectorDesignReadinessAudit();

assert.strictEqual(audit.audit, "V839 Live Connector Design Readiness");
assert.strictEqual(audit.designReady, true);
assert.strictEqual(audit.implementationAllowed, false);
assert.strictEqual(audit.liveNetworkingAllowed, false);
assert.strictEqual(audit.providerActivationAllowed, false);
assert.strictEqual(audit.sources.officialProviderSourceEvaluation, true);
assert.strictEqual(audit.sources.driveTexasEndpointValidation, true);
assert.strictEqual(audit.sources.weatherEndpointValidation, true);
assert.strictEqual(audit.providers.drivetexas.registered, true);
assert.strictEqual(audit.providers.drivetexas.dormant, true);
assert.strictEqual(audit.providers.drivetexas.connectorEndpointReady, true);
assert.strictEqual(audit.providers.weather.registered, true);
assert.strictEqual(audit.providers.weather.dormant, true);
assert.strictEqual(audit.providers.weather.connectorEndpointReady, true);
assert.strictEqual(audit.providers.unified.registered, true);
assert.strictEqual(audit.providers.unified.dormant, true);
assert.strictEqual(audit.connectorRequirements.timeoutMs, 8000);
assert.strictEqual(audit.connectorRequirements.retryPolicyDefined, true);
assert.strictEqual(audit.connectorRequirements.failClosedRequired, true);
assert.strictEqual(audit.connectorRequirements.rawPayloadSuppressionRequired, true);
assert.strictEqual(audit.connectorRequirements.sourceTracingRequired, true);
assert.strictEqual(audit.connectorRequirements.spatialFilteringRequired, true);
assert.strictEqual(audit.connectorRequirements.noConsumerRenderingDuringConnectorMilestone, true);
assert.strictEqual(audit.prerequisites.noRuntimeNetworking, true);
assert.strictEqual(audit.prerequisites.noActivation, true);
assert.strictEqual(audit.prerequisites.noConsumerRendering, true);
assert(audit.policy.designReadyStatement.includes("design-ready"));
assert(audit.policy.runtimeNetworkingPolicy.includes("not allowed"));
assert(audit.policy.providerActivationPolicy.includes("not allowed"));
assert(audit.policy.futureMilestonePolicy.includes("explicit future milestones"));
assert.strictEqual(JSON.stringify(audit.nextMilestones), JSON.stringify([
  "DriveTexas live connector implementation",
  "Weather live connector implementation",
  "Live provider validation"
]));
assert.strictEqual(context.__fetchCalled(), false);
assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), driveBefore);
assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState(), weatherBefore);
assert.deepStrictEqual(context.gridlyUnifiedIntelligence.getState(), unifiedBefore);
assert.strictEqual(JSON.stringify(context.gridlyUnifiedIntelligence.collectNormalizedRecords()), JSON.stringify([]));

const missingPrerequisiteAudit = loadContext({ includeWeatherEndpoint: false }).gridlyLiveConnectorDesignReadinessAudit();
assert.strictEqual(missingPrerequisiteAudit.designReady, false);
assert.strictEqual(missingPrerequisiteAudit.sources.weatherEndpointValidation, false);
assert.strictEqual(missingPrerequisiteAudit.prerequisiteAudits.weatherConnectorEndpointAudit, false);
assert.strictEqual(missingPrerequisiteAudit.implementationAllowed, false);
assert.strictEqual(missingPrerequisiteAudit.liveNetworkingAllowed, false);
assert.strictEqual(missingPrerequisiteAudit.providerActivationAllowed, false);

console.log(JSON.stringify({ audit }, null, 2));
