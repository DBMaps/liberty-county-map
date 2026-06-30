const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
  console,
  window: {},
  globalThis: {},
  fetch: async () => { throw new Error("V836 source audit must not fetch external data"); },
  document: {
    createElement: () => { throw new Error("V836 source audit must not render"); },
    querySelector: () => { throw new Error("V836 source audit must not query UI"); }
  }
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
vm.runInContext(fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8"), context, { filename: "js/gridlyDriveTexasProvider.js" });
vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });
vm.runInContext(fs.readFileSync("js/gridlyOfficialProviderSourceEvaluation.js", "utf8"), context, { filename: "js/gridlyOfficialProviderSourceEvaluation.js" });

const indexSource = fs.readFileSync("index.html", "utf8");
assert(indexSource.includes("js/gridlyOfficialProviderSourceEvaluation.js?v=836"));
assert(indexSource.indexOf("js/gridlyUnifiedIntelligenceSimulation.js?v=835") < indexSource.indexOf("js/gridlyOfficialProviderSourceEvaluation.js?v=836"));

const docSource = fs.readFileSync("GRIDLY-V836-OFFICIAL-PROVIDER-SOURCE-EVALUATION.md", "utf8");
assert(docSource.includes("Provider Source Certification"));
assert(docSource.includes("TxDOT DriveTexas"));
assert(docSource.includes("National Weather Service CAP"));
assert(docSource.includes("Connector Requirements"));
assert(docSource.includes("runtimeIntegrationPerformed: false"));

assert.strictEqual(typeof context.gridlyOfficialProviderSourceAudit, "function");
const audit = context.gridlyOfficialProviderSourceAudit();
assert.strictEqual(audit.audit, "Official Provider Source Evaluation");
assert.strictEqual(audit.milestone, "V836");
assert.strictEqual(audit.driveTexasSourceCertified, true);
assert.strictEqual(audit.weatherSourceCertified, true);
assert.strictEqual(audit.sourceCertificationPresent, true);
assert.strictEqual(audit.runtimeIntegrationPerformed, false);
assert.strictEqual(audit.providerActivationPerformed, false);
assert.strictEqual(audit.runtimeConnected, false);
assert.strictEqual(audit.providersRemainDormant, true);
assert.strictEqual(audit.driveTexasProviderDormant, true);
assert.strictEqual(audit.weatherProviderDormant, true);
assert.strictEqual(audit.activationPerformed, false);
assert.strictEqual(audit.renderingPerformed, false);
assert.strictEqual(audit.connectorImplementationRequired, true);
assert.strictEqual(audit.readyForConnectorMilestone, true);
assert.strictEqual(audit.validationPassed, true);
assert.strictEqual(audit.driveTexas.sourceRecommended.includes("TxDOT"), true);
assert.strictEqual(audit.weather.sourceRecommended.includes("National Weather Service"), true);
assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState().connected, false);
assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState().connected, false);

console.log(JSON.stringify({ audit }, null, 2));
