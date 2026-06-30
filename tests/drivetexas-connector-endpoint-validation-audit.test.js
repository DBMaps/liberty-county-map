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
    throw new Error("V837 audit must not fetch external data");
  },
  document: {
    createElement: () => { throw new Error("V837 audit must not render"); },
    querySelector: () => { throw new Error("V837 audit must not query UI"); }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
vm.runInContext(fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8"), context, { filename: "js/gridlyDriveTexasProvider.js" });
const beforeRuntime = context.gridlyDriveTexasProvider.getRuntimeState();
vm.runInContext(fs.readFileSync("js/gridlyDriveTexasConnectorEndpointAudit.js", "utf8"), context, { filename: "js/gridlyDriveTexasConnectorEndpointAudit.js" });

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyDriveTexasConnectorEndpointAudit.js?v=837"));
assert(indexSource.indexOf("js/gridlyOfficialProviderSourceEvaluation.js?v=836") < indexSource.indexOf("js/gridlyDriveTexasConnectorEndpointAudit.js?v=837"));

const docSource = fs.readFileSync("GRIDLY-V837-DRIVETEXAS-CONNECTOR-ENDPOINT-VALIDATION.md", "utf8");
assert(docSource.includes("https://api.drivetexas.org/api/conditions.geojson?key={api_key}"));
assert(docSource.includes("Connector Specification"));
assert(docSource.includes("runtimeNetworkingPerformed\": false"));
assert(docSource.includes("providerActivated\": false"));
assert(docSource.includes("Fail-closed behavior"));

assert.strictEqual(typeof context.gridlyDriveTexasConnectorEndpointAudit, "function");
const audit = context.gridlyDriveTexasConnectorEndpointAudit();

assert.strictEqual(audit.audit, "V837 DriveTexas Connector Endpoint Validation");
assert.strictEqual(audit.endpointDocumented, true);
assert.strictEqual(audit.endpointValidated, true);
assert.strictEqual(audit.authenticationKnown, true);
assert.strictEqual(audit.runtimeNetworkingPerformed, false);
assert.strictEqual(audit.providerActivated, false);
assert.strictEqual(audit.connectorReady, true);
assert.strictEqual(audit.providerDormant, true);
assert.strictEqual(audit.endpoint.url, "https://api.drivetexas.org/api/conditions.geojson?key={api_key}");
assert.strictEqual(audit.endpoint.responseFormat, "GeoJSON FeatureCollection");
assert.strictEqual(audit.connectorSpecification.requestMethod, "GET");
assert.strictEqual(audit.connectorSpecification.timeoutMs, 8000);
assert.strictEqual(audit.suitability.statewideIncidents, true);
assert.strictEqual(audit.suitability.roadwayEvents, true);
assert.strictEqual(audit.suitability.closures, true);
assert.strictEqual(audit.suitability.flooding, true);
assert.strictEqual(audit.suitability.laneClosures, true);
assert.strictEqual(audit.suitability.construction, true);
assert.strictEqual(audit.suitability.travelAdvisories, true);
assert.strictEqual(fetchCalled, false);
assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), beforeRuntime);
assert.strictEqual(context.gridlyDriveTexasProvider.getRuntimeState().enabled, false);
assert.strictEqual(context.gridlyDriveTexasProvider.getRuntimeState().connected, false);

console.log(JSON.stringify({ audit }, null, 2));
