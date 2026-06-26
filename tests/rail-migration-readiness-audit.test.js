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

const audit = context.gridlyRailMigrationReadinessAudit();

assert.strictEqual(audit.auditName, "V769 Rail Migration Readiness Audit");
assert.strictEqual(audit.reviewVersion, "V769");
assert.strictEqual(audit.providerId, "rail");
assert.strictEqual(audit.packageId, "intelligence.rail");
assert.strictEqual(audit.reviewPassed, true);
assert.strictEqual(audit.providerRegistered, true);
assert.strictEqual(audit.intelligencePackageLinked, true);
assert.strictEqual(audit.railInactive, false);
assert.strictEqual(audit.railMetadataOnlyMigrated, true);
assert.strictEqual(audit.runtimeOwnershipActive, true);
assert.strictEqual(audit.providerMigrationComplete, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.futureMigrationSafe, true);
assert.strictEqual(audit.currentStatus, "controlled-migrated");
assert.strictEqual(JSON.stringify(audit.ownershipScope), JSON.stringify([
  "provider identity",
  "package metadata",
  "provider relationship metadata",
  "supported intelligence metadata",
  "migration state",
  "validation state"
]));
[
  "Rail runtime execution",
  "Rail data ingestion",
  "crossing runtime behavior",
  "alert generation",
  "Transportation Intelligence",
  "Directional Intelligence",
  "trust model",
  "freshness model",
  "confidence model",
  "report reads",
  "report writes",
  "Community Pulse",
  "Supabase schema",
  "UI rendering",
  "Experience ownership",
  "Transportation ownership",
  "Operations Center",
  "mobile portrait behavior"
].forEach((excludedBehavior) => assert(audit.behaviorOutsideMigrationScope.includes(excludedBehavior)));

console.log(JSON.stringify({ audit }, null, 2));
