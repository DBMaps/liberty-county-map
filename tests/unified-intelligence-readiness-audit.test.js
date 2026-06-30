const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext(overrides = {}) {
  const context = Object.assign({ console, module: { exports: {} } }, overrides);
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyUnifiedIntelligenceReadinessAudit.js", "utf8"), context, { filename: "js/gridlyUnifiedIntelligenceReadinessAudit.js" });
  return context;
}

const context = loadContext({
  gridlyDriveTexasConnectorRuntimeAudit() { return { automaticPolling: false, providerActivated: false, renderingPerformed: false, normalizedRecordCount: 1 }; },
  gridlyWeatherConnectorRuntimeAudit() { return { automaticPolling: false, providerActivated: false, renderingPerformed: false, normalizedRecordCount: 1 }; },
  gridlyUnifiedIntelligenceAudit() { return { enabled: false, activated: false, consumerRenderingActive: false }; },
  gridlyCrossProviderEvaluationAudit() {
    return {
      auditOnly: true,
      providers: { community: { available: true }, drivetexas: { available: true }, weather: { available: true } },
      relationshipAnalysis: { overlap: {}, duplicate: {}, complement: {}, conflict: {} },
      runtimeContainment: { noProviderActivationOccurred: true, noRenderingOccurred: true, noAutomaticPollingOccurred: true }
    };
  }
});

assert.strictEqual(typeof context.gridlyUnifiedIntelligenceReadinessAudit, "function", "readiness audit is available");
const audit = context.gridlyUnifiedIntelligenceReadinessAudit();
assert.strictEqual(audit.auditOnly, true, "audit is review-only");
assert.strictEqual(audit.unifiedIntelligenceActive, false, "Unified Intelligence remains inactive");
assert.strictEqual(audit.automaticPolling, false, "no polling is introduced");
assert.strictEqual(audit.providerActivated, false, "no provider activation is introduced");
assert.strictEqual(audit.renderingPerformed, false, "no rendering is introduced");
assert.strictEqual(audit.readinessMatrix.validatedProviders.ready, true, "provider readiness is reported");
assert.strictEqual(audit.readinessMatrix.validatedNormalization.ready, true, "normalization readiness is reported");
assert.strictEqual(audit.readinessMatrix.validatedRelationshipAnalysis.ready, true, "relationship readiness is reported");
assert.strictEqual(audit.readinessMatrix.runtimeContainment.ready, true, "runtime containment is reported");
assert(audit.ownershipModel.communityReportsOwns.includes("community observations"), "community ownership is documented");
assert(audit.ownershipModel.driveTexasOwns.includes("lane closures"), "DriveTexas ownership is documented");
assert(audit.ownershipModel.weatherOwns.includes("warnings"), "Weather ownership is documented");
assert(audit.ownershipModel.unifiedIntelligenceEventuallyOwnsOnly.includes("evidence synthesis"), "future Unified Intelligence ownership is limited");
assert(audit.ownershipModel.unifiedIntelligenceMustNotOwn.includes("provider networking"), "forbidden ownership is documented");
assert.strictEqual(audit.protectedBoundaries.noProviderActivation, true, "provider activation boundary holds");
assert.strictEqual(audit.protectedBoundaries.noRendering, true, "rendering boundary holds");
assert.strictEqual(audit.protectedBoundaries.noPolling, true, "polling boundary holds");
assert.strictEqual(audit.implementationGate.recommendation, "READY FOR PROTOTYPE", "implementation gate is prototype-only");
assert.strictEqual(audit.implementationGate.limitedImplementationReady, false, "limited implementation is not authorized");
assert(fs.readFileSync("index.html", "utf8").includes("js/gridlyUnifiedIntelligenceReadinessAudit.js?v=847"), "readiness audit is loaded by index");

const blocked = loadContext({
  gridlyDriveTexasConnectorRuntimeAudit() { return { automaticPolling: true, providerActivated: false, renderingPerformed: false }; },
  gridlyWeatherConnectorRuntimeAudit() { return { automaticPolling: false, providerActivated: false, renderingPerformed: false }; },
  gridlyCrossProviderEvaluationAudit() { return { auditOnly: true, providers: {}, relationshipAnalysis: {} }; },
  gridlyUnifiedIntelligenceAudit() { return { enabled: false, activated: false, consumerRenderingActive: false }; }
}).gridlyUnifiedIntelligenceReadinessAudit();
assert.strictEqual(blocked.protectedBoundaries.noPolling, false, "polling regression is detected");
assert.strictEqual(blocked.implementationGate.recommendation, "NOT READY", "gate blocks when containment fails");

console.log(JSON.stringify({ ok: true, gate: audit.implementationGate.recommendation }, null, 2));
