const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

let fetchCalled = false;
const context = {
  console,
  window: {},
  globalThis: {},
  fetch: async () => {
    fetchCalled = true;
    throw new Error("V838 audit must not fetch external data");
  },
  document: {
    createElement: () => { throw new Error("V838 audit must not render"); },
    querySelector: () => { throw new Error("V838 audit must not query UI"); }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });
const beforeRuntime = context.gridlyWeatherProvider.getRuntimeState();
vm.runInContext(fs.readFileSync("js/gridlyWeatherConnectorEndpointAudit.js", "utf8"), context, { filename: "js/gridlyWeatherConnectorEndpointAudit.js" });

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyWeatherConnectorEndpointAudit.js?v=838"));
assert(indexSource.indexOf("js/gridlyDriveTexasConnectorEndpointAudit.js?v=837") < indexSource.indexOf("js/gridlyWeatherConnectorEndpointAudit.js?v=838"));

const docSource = fs.readFileSync("GRIDLY-V838-WEATHER-CONNECTOR-ENDPOINT-VALIDATION.md", "utf8");
assert(docSource.includes("https://api.weather.gov/alerts/active?area={state}"));
assert(docSource.includes("https://api.weather.gov/alerts/active.atom?area={state}"));
assert(docSource.includes("Connector Specification"));
assert(docSource.includes("runtimeNetworkingPerformed\": false"));
assert(docSource.includes("providerActivated\": false"));
assert(docSource.includes("Fail-closed behavior"));
assert(docSource.includes("Flash Flood Warning"));
assert(docSource.includes("Air Quality"));

assert.strictEqual(typeof context.gridlyWeatherConnectorEndpointAudit, "function");
const audit = context.gridlyWeatherConnectorEndpointAudit();

assert.strictEqual(audit.audit, "V838 Weather Connector Endpoint Validation");
assert.strictEqual(audit.endpointDocumented, true);
assert.strictEqual(audit.endpointValidated, true);
assert.strictEqual(audit.authenticationKnown, true);
assert.strictEqual(audit.runtimeNetworkingPerformed, false);
assert.strictEqual(audit.providerActivated, false);
assert.strictEqual(audit.connectorReady, true);
assert.strictEqual(audit.providerDormant, true);
assert.strictEqual(audit.endpoints[0].url, "https://api.weather.gov/alerts/active?area={state}");
assert.strictEqual(audit.endpoints[0].method, "GET");
assert.strictEqual(audit.connectorSpecification.requestMethod, "GET");
assert.strictEqual(audit.connectorSpecification.timeoutMs, 8000);
assert.strictEqual(audit.supportedEvents.flashFloodWarning, true);
assert.strictEqual(audit.supportedEvents.floodWarning, true);
assert.strictEqual(audit.supportedEvents.severeThunderstormWarning, true);
assert.strictEqual(audit.supportedEvents.tornadoWarning, true);
assert.strictEqual(audit.supportedEvents.tropicalStorm, true);
assert.strictEqual(audit.supportedEvents.hurricane, true);
assert.strictEqual(audit.supportedEvents.denseFog, true);
assert.strictEqual(audit.supportedEvents.highWind, true);
assert.strictEqual(audit.supportedEvents.winterWeather, true);
assert.strictEqual(audit.supportedEvents.extremeHeat, true);
assert.strictEqual(audit.supportedEvents.fireWeather, true);
assert.strictEqual(audit.supportedEvents.airQuality, true);
assert.strictEqual(fetchCalled, false);
assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState(), beforeRuntime);
assert.strictEqual(context.gridlyWeatherProvider.getRuntimeState().enabled, false);
assert.strictEqual(context.gridlyWeatherProvider.getRuntimeState().connected, false);

console.log(JSON.stringify({ audit }, null, 2));
