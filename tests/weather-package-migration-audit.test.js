const fs = require("fs");
const vm = require("vm");
const assert = require("assert");

const context = { window: {}, globalThis: {}, console };
context.globalThis = context;
context.window = context;
vm.createContext(context);

vm.runInContext(fs.readFileSync("js/gridlyPackageRegistry.js", "utf8"), context, { filename: "js/gridlyPackageRegistry.js" });
const appSource = fs.readFileSync("js/app.js", "utf8");
const auditPrefix = appSource.slice(0, appSource.indexOf("function gridlyGetCountyRuntimeSources"));
vm.runInContext(auditPrefix, context, { filename: "js/app.js#audit-prefix" });

const audit = context.gridlyWeatherPackageMigrationAudit();

assert.strictEqual(audit.auditName, "V767 Weather Package Metadata Ownership Migration");
assert.strictEqual(audit.migrationVersion, "V767");
assert.strictEqual(audit.providerId, "weather");
assert.strictEqual(audit.packageId, "intelligence.weather");
assert.strictEqual(audit.validationPassed, true);
assert.strictEqual(audit.runtimeOwnershipActive, true);
assert.strictEqual(audit.providerMigrationComplete, true);
assert.strictEqual(audit.runtimeActivationPerformed, false);
assert.strictEqual(audit.weatherRuntimeActivated, false);
assert.strictEqual(audit.transportationIntelligenceActivated, false);
assert.strictEqual(audit.directionalIntelligenceActivated, false);
assert.strictEqual(audit.trustModelActivated, false);
assert.strictEqual(audit.freshnessModelActivated, false);
assert.strictEqual(audit.confidenceModelActivated, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.safeForProviderCertification, true);
assert.strictEqual(JSON.stringify(audit.ownershipScope), JSON.stringify([
  "provider identity",
  "package metadata",
  "provider relationship metadata",
  "supported intelligence metadata",
  "migration metadata",
  "validation metadata"
]));
assert(Object.values(audit.behaviorPreserved).every((value) => value === "unchanged"));

console.log(JSON.stringify({ audit }, null, 2));
