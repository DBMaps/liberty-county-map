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

const audit = context.gridlyWeatherMigrationReadinessAudit();

assert.strictEqual(audit.auditName, "Weather Migration Readiness Audit");
assert.strictEqual(audit.reviewVersion, "V764");
assert.strictEqual(audit.providerId, "weather");
assert.strictEqual(audit.packageId, "intelligence.weather");
assert.strictEqual(audit.reviewPassed, true);
assert.strictEqual(audit.providerRegistered, true);
assert.strictEqual(audit.intelligencePackageLinked, true);
assert.strictEqual(audit.weatherInactive, true);
assert.strictEqual(audit.runtimeOwnershipActive, false);
assert.strictEqual(audit.providerMigrationComplete, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.futureMigrationSafe, true);
assert.strictEqual(JSON.stringify(audit.ownershipScope), JSON.stringify([
  "provider identity",
  "package metadata",
  "provider relationship metadata",
  "supported intelligence metadata",
  "migration state",
  "validation state"
]));
assert(audit.behaviorOutsideMigrationScope.includes("weather runtime execution"));
assert(audit.behaviorOutsideMigrationScope.includes("mobile portrait behavior"));

console.log(JSON.stringify({ audit }, null, 2));
