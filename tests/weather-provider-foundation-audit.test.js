const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyDriveTexasProvider.js?v=831"));
assert(indexSource.includes("js/gridlyWeatherProvider.js?v=832"));
assert(indexSource.indexOf("js/gridlyDriveTexasProvider.js?v=831") < indexSource.indexOf("js/gridlyWeatherProvider.js?v=832"));

const context = {
  console,
  window: {},
  globalThis: {},
  fetch: async () => { throw new Error("network should remain dormant"); }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });

const provider = context.gridlyWeatherProvider;
const runtime = provider.getRuntimeState();
const audit = context.gridlyWeatherProviderAudit();

assert.strictEqual(provider.id, "weather");
assert.strictEqual(provider.name, "Weather");
assert.strictEqual(runtime.provider, "Weather");
assert.strictEqual(runtime.registered, true);
assert.strictEqual(runtime.enabled, false);
assert.strictEqual(runtime.connected, false);
assert.strictEqual(runtime.lastRefresh, null);
assert.strictEqual(runtime.recordCount, 0);
assert.strictEqual(runtime.runtimeHealthy, true);
assert.strictEqual(runtime.uiOwnership, false);
assert.strictEqual(audit.normalizedModelReady, true);
assert.strictEqual(audit.safeForActivation, true);
assert.strictEqual(context.gridlyIntelligenceProviders.weather, provider);

[
  "Flash Flood Warning",
  "Flood Warning",
  "Severe Thunderstorm Warning",
  "Tornado Warning",
  "Tropical Storm",
  "Hurricane",
  "Dense Fog",
  "High Wind",
  "Winter Weather",
  "Extreme Heat",
  "Fire Weather",
  "Air Quality"
].forEach((category) => assert(provider.categories.includes(category), `${category} is normalized`));

const normalized = provider.normalizeRecords({
  features: [{
    id: "nws-alert-1",
    properties: {
      event: "Flash Flood Warning",
      headline: "Flash Flood Warning for Liberty County",
      description: "Flooding is possible.",
      severity: "Severe",
      areaDesc: "Liberty; Montgomery",
      effective: "2026-06-30T00:00:00Z",
      expires: "2026-06-30T02:00:00Z"
    }
  }]
});

assert.strictEqual(normalized.length, 1);
assert.strictEqual(normalized[0].provider, "Weather");
assert.strictEqual(normalized[0].providerId, "weather");
assert.strictEqual(normalized[0].category, "Flash Flood Warning");
assert.deepStrictEqual(Array.from(normalized[0].affectedAreas), ["Liberty", "Montgomery"]);
assert.strictEqual(normalized[0].rawPayloadExposed, false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(normalized[0], "properties"), false);

provider.refresh().then((refreshRuntime) => {
  assert.strictEqual(refreshRuntime.enabled, false);
  assert.strictEqual(refreshRuntime.connected, false);
  assert.strictEqual(refreshRuntime.runtimeHealthy, true);
  assert.strictEqual(provider.getNormalizedRecords().length, 0);
  console.log(JSON.stringify({ runtime, audit, normalizedCount: normalized.length }, null, 2));
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
