const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext({ includeDriveTexas = true, includeWeather = true, includeUnified = true } = {}) {
  const context = { console, window: {}, globalThis: {}, fetch: async () => { throw new Error("fetch should not be called"); } };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
  if (includeDriveTexas) vm.runInContext(fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8"), context, { filename: "js/gridlyDriveTexasProvider.js" });
  if (includeWeather) vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });
  if (includeUnified) vm.runInContext(fs.readFileSync("js/gridlyUnifiedIntelligence.js", "utf8"), context, { filename: "js/gridlyUnifiedIntelligence.js" });
  vm.runInContext(fs.readFileSync("js/gridlyIntelligenceActivationReadiness.js", "utf8"), context, { filename: "js/gridlyIntelligenceActivationReadiness.js" });
  return context;
}

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyIntelligenceActivationReadiness.js?v=834"));
assert(indexSource.indexOf("js/gridlyUnifiedIntelligence.js?v=833") < indexSource.indexOf("js/gridlyIntelligenceActivationReadiness.js?v=834"));

const context = loadContext();
assert.strictEqual(typeof context.gridlyIntelligenceActivationReadinessAudit, "function");
assert.strictEqual(context.gridlyIntelligenceActivationActivate, undefined);
assert.strictEqual(context.activateUnifiedIntelligence, undefined);

const driveBefore = context.gridlyDriveTexasProvider.getRuntimeState();
const weatherBefore = context.gridlyWeatherProvider.getRuntimeState();
const audit = context.gridlyIntelligenceActivationReadinessAudit();

assert.strictEqual(audit.audit, "V834 Intelligence Activation Readiness");
assert.strictEqual(audit.readyForActivation, true);
assert.strictEqual(audit.activationAllowed, false);
assert(audit.activationPolicy.includes("future milestone"));
assert.strictEqual(audit.providers.community.available, true);
assert.strictEqual(audit.providers.community.recognized, true);
assert.strictEqual(audit.providers.drivetexas.registered, true);
assert.strictEqual(audit.providers.drivetexas.enabled, false);
assert.strictEqual(audit.providers.drivetexas.connected, false);
assert.strictEqual(audit.providers.drivetexas.normalizedModelReady, true);
assert.strictEqual(audit.providers.drivetexas.uiOwnership, false);
assert.strictEqual(audit.providers.drivetexas.safeForActivation, true);
assert.strictEqual(audit.providers.weather.registered, true);
assert.strictEqual(audit.providers.weather.enabled, false);
assert.strictEqual(audit.providers.weather.connected, false);
assert.strictEqual(audit.providers.weather.normalizedModelReady, true);
assert.strictEqual(audit.providers.weather.uiOwnership, false);
assert.strictEqual(audit.providers.weather.safeForActivation, true);
assert.strictEqual(audit.providers.unified.registered, true);
assert.strictEqual(audit.providers.unified.enabled, false);
assert.strictEqual(audit.providers.unified.activated, false);
assert.strictEqual(audit.providers.unified.consumerRenderingActive, false);
assert.strictEqual(audit.providers.unified.uiOwnership, false);
assert.strictEqual(audit.providers.unified.safeForActivation, true);
assert.strictEqual(JSON.stringify(context.gridlyUnifiedIntelligence.collectNormalizedRecords()), JSON.stringify([]));
assert.strictEqual(audit.protectedSystems.awarenessBriefUnchanged, true);
assert.strictEqual(audit.protectedSystems.alertsUnchanged, true);
assert.strictEqual(audit.protectedSystems.communityPulseUnchanged, true);
assert.strictEqual(audit.protectedSystems.routeWatchUnchanged, true);
assert.strictEqual(audit.protectedSystems.crossingsUnchanged, true);
assert.strictEqual(audit.protectedSystems.reportingUnchanged, true);
assert.strictEqual(audit.protectedSystems.supabaseUnchanged, true);
assert(audit.blockers.includes("Unified Intelligence intentionally dormant"));
assert(audit.blockers.includes("Provider activation requires explicit future milestone"));
assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), driveBefore);
assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState(), weatherBefore);

const missingDriveTexas = loadContext({ includeDriveTexas: false }).gridlyIntelligenceActivationReadinessAudit();
assert.strictEqual(missingDriveTexas.readyForActivation, false);
assert.strictEqual(missingDriveTexas.activationAllowed, false);
assert.strictEqual(missingDriveTexas.providers.drivetexas.safeForActivation, false);
assert(missingDriveTexas.blockers.includes("DriveTexas foundation is missing or not dormant"));

const missingWeather = loadContext({ includeWeather: false }).gridlyIntelligenceActivationReadinessAudit();
assert.strictEqual(missingWeather.readyForActivation, false);
assert.strictEqual(missingWeather.activationAllowed, false);
assert.strictEqual(missingWeather.providers.weather.safeForActivation, false);
assert(missingWeather.blockers.includes("Weather foundation is missing or not dormant"));

const missingUnified = loadContext({ includeUnified: false }).gridlyIntelligenceActivationReadinessAudit();
assert.strictEqual(missingUnified.readyForActivation, false);
assert.strictEqual(missingUnified.activationAllowed, false);
assert.strictEqual(missingUnified.providers.unified.safeForActivation, false);
assert(missingUnified.blockers.includes("Unified Intelligence foundation is missing or not dormant"));
