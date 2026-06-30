const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const appSource = fs.readFileSync("js/app.js", "utf8");
const prototypeSource = fs.readFileSync("js/gridlyUnifiedIntelligencePrototype.js", "utf8");
const indexSource = fs.readFileSync("index.html", "utf8");

assert(appSource.includes("GRIDLY_UNIFIED_INTELLIGENCE_AWARENESS_PROTOTYPE"), "feature flag is present");
assert(appSource.includes("window.gridlyUnifiedIntelligenceAwarenessPrototypeAudit = function gridlyUnifiedIntelligenceAwarenessPrototypeAudit()"), "browser audit is exposed");
assert(appSource.includes("function buildGridlyUnifiedIntelligenceAwarenessExperienceContract"), "Awareness Brief has a contained consumer contract helper");
assert(appSource.includes('surface !== "awarenessBrief"'), "only Awareness Brief contract outputs are accepted");
assert(appSource.includes("exposesRawProviderRecords") && appSource.includes("exposesSourceTrace") && appSource.includes("exposesNormalizedRecords"), "raw/internal fields are rejected");
assert(appSource.includes("communityStillPrimary: true"), "community remains primary in audit");
assert(appSource.includes("providerActivationPerformed: false"), "no provider activation is reported");
assert(appSource.includes("renderingOutsideAwarenessBrief: false"), "rendering outside Awareness Brief is blocked");
assert(appSource.includes("awareness_narrative_story_assembly.unified_intelligence_support"), "Awareness Brief participates when enabled");
assert(!appSource.includes("gridlyUnifiedIntelligenceAwarenessPrototypeAlert"), "Alerts are not modified by the prototype");
assert(!appSource.includes("gridlyUnifiedIntelligenceAwarenessPrototypeCommunityPulse"), "Community Pulse is not modified by the prototype");
assert(!appSource.includes("gridlyUnifiedIntelligenceAwarenessPrototypeRouteWatch"), "Route Watch is not modified by the prototype");
assert(indexSource.includes("js/gridlyUnifiedIntelligencePrototype.js?v=853"), "prototype script version is loaded");
assert(indexSource.includes("js/app.js?v=1714"), "app script version is loaded");

const context = { window: {}, globalThis: {}, console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(prototypeSource, context, { filename: "js/gridlyUnifiedIntelligencePrototype.js" });

assert.strictEqual(typeof context.gridlyUnifiedIntelligenceExperienceContract, "function", "experience contract is exposed");
const contract = context.gridlyUnifiedIntelligenceExperienceContract({
  community: [{ id: "c1", providerId: "community", type: "flood", lat: 30.05, lon: -94.8 }],
  drivetexas: [{ id: "d1", providerId: "drivetexas", type: "flood", lat: 30.05, lon: -94.8 }],
  weather: []
});
assert.strictEqual(contract.surface, "awarenessBrief", "contract is scoped to Awareness Brief");
assert.strictEqual(contract.communityPrimary, true, "community remains primary");
assert.strictEqual(contract.supportingOnly, true, "Unified Intelligence remains supporting");
assert.strictEqual(contract.providerActivationPerformed, false, "contract performs no provider activation");
assert.strictEqual(contract.pollingPerformed, false, "contract performs no polling");
assert.strictEqual(contract.renderingOutsideAwarenessBrief, false, "contract renders nowhere else");
assert.strictEqual(contract.exposesRawProviderRecords, false, "contract exposes no raw provider records");
assert.strictEqual(contract.exposesSourceTrace, false, "contract exposes no source trace");
assert.strictEqual(contract.exposesNormalizedRecords, false, "contract exposes no normalized records");
assert.strictEqual(contract.exposesRuntimeDiagnostics, false, "contract exposes no runtime diagnostics");
assert.strictEqual(contract.exposesProviderMetadata, false, "contract exposes no provider metadata");
assert.match(contract.approvedOutputs.awarenessSupportText, /^Community reports and official road information indicate travel may be affected\.$/);

const driveSource = fs.readFileSync("js/gridlyDriveTexasLiveConnector.js", "utf8");
const weatherSource = fs.readFileSync("js/gridlyWeatherLiveConnector.js", "utf8");
assert(driveSource.includes("automaticPolling: false"), "DriveTexas remains dormant");
assert(weatherSource.includes("automaticPolling: false"), "Weather remains dormant");
console.log("V853 unified intelligence Awareness Brief prototype audit passed");
