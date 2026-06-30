const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext({ includeDriveTexas = true, includeWeather = true } = {}) {
  const context = { console, window: {}, globalThis: {}, fetch: async () => { throw new Error("fetch should not be called"); } };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
  if (includeDriveTexas) vm.runInContext(fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8"), context, { filename: "js/gridlyDriveTexasProvider.js" });
  if (includeWeather) vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });
  vm.runInContext(fs.readFileSync("js/gridlyUnifiedIntelligence.js", "utf8"), context, { filename: "js/gridlyUnifiedIntelligence.js" });
  return context;
}

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyUnifiedIntelligence.js?v=833"));
assert(indexSource.indexOf("js/gridlyWeatherProvider.js?v=832") < indexSource.indexOf("js/gridlyUnifiedIntelligence.js?v=833"));

const context = loadContext();
const driveBefore = context.gridlyDriveTexasProvider.getRuntimeState();
const weatherBefore = context.gridlyWeatherProvider.getRuntimeState();
const summary = context.gridlyUnifiedIntelligence.getState();
const audit = context.gridlyUnifiedIntelligenceAudit();

assert.strictEqual(summary.system, "Unified Intelligence");
assert.strictEqual(summary.registered, true);
assert.strictEqual(summary.enabled, false);
assert.strictEqual(summary.activated, false);
assert.strictEqual(summary.providerCount, 3);
assert.strictEqual(summary.providers.community.available, true);
assert.strictEqual(summary.providers.community.enabled, true);
assert.strictEqual(summary.providers.drivetexas.available, true);
assert.strictEqual(summary.providers.drivetexas.enabled, false);
assert.strictEqual(summary.providers.weather.available, true);
assert.strictEqual(summary.providers.weather.enabled, false);
assert.strictEqual(summary.recordCount, 0);
assert.strictEqual(summary.uiOwnership, false);
assert.strictEqual(summary.consumerRenderingActive, false);
assert.strictEqual(JSON.stringify(summary.missingRequiredProviders), JSON.stringify([]));
assert.strictEqual(summary.safeForActivation, true);
assert.strictEqual(JSON.stringify(context.gridlyUnifiedIntelligence.collectNormalizedRecords()), JSON.stringify([]));
assert.strictEqual(audit.driveTexasVisible, true);
assert.strictEqual(audit.weatherVisible, true);
assert.strictEqual(audit.communityRecognized, true);
assert.strictEqual(audit.consumerRenderingActive, false);
assert.strictEqual(audit.safeForActivation, true);
assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), driveBefore);
assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState(), weatherBefore);

const missingDriveTexasContext = loadContext({ includeDriveTexas: false });
const missingDriveTexasAudit = missingDriveTexasContext.gridlyUnifiedIntelligenceAudit();
assert.strictEqual(missingDriveTexasAudit.driveTexasVisible, false);
assert.strictEqual(missingDriveTexasAudit.weatherVisible, true);
assert.strictEqual(JSON.stringify(missingDriveTexasAudit.missingRequiredProviders), JSON.stringify(["drivetexas"]));
assert.strictEqual(missingDriveTexasAudit.safeForActivation, false);
assert.strictEqual(JSON.stringify(missingDriveTexasContext.gridlyUnifiedIntelligence.collectNormalizedRecords()), JSON.stringify([]));

const missingWeatherContext = loadContext({ includeWeather: false });
const missingWeatherAudit = missingWeatherContext.gridlyUnifiedIntelligenceAudit();
assert.strictEqual(missingWeatherAudit.driveTexasVisible, true);
assert.strictEqual(missingWeatherAudit.weatherVisible, false);
assert.strictEqual(JSON.stringify(missingWeatherAudit.missingRequiredProviders), JSON.stringify(["weather"]));
assert.strictEqual(missingWeatherAudit.safeForActivation, false);
assert.strictEqual(JSON.stringify(missingWeatherContext.gridlyUnifiedIntelligence.collectNormalizedRecords()), JSON.stringify([]));
