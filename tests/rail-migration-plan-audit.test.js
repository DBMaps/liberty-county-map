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

const audit = context.gridlyRailMigrationPlanAudit();

assert.strictEqual(audit.auditName, "V770 Rail Metadata Ownership Migration Plan");
assert.strictEqual(audit.planVersion, "V770");
assert.strictEqual(audit.providerId, "rail");
assert.strictEqual(audit.packageId, "intelligence.rail");
assert.strictEqual(audit.planPassed, true);
assert.strictEqual(audit.migrationType, "metadata-only");
assert.strictEqual(audit.activationAuthorized, false);
assert.strictEqual(audit.runtimeOwnershipTransferred, false);
assert.strictEqual(audit.providerMigrationPerformed, false);
assert.strictEqual(audit.railInactive, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.safeForFutureMigration, true);
assert.strictEqual(JSON.stringify(audit.migrationScope), JSON.stringify([
  "provider identity",
  "package ownership metadata",
  "provider relationship metadata",
  "supported intelligence metadata",
  "migration status metadata",
  "validation metadata"
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
  "mobile portrait behavior",
  "Operations Center",
  "Experience ownership",
  "Transportation ownership"
].forEach((excludedBehavior) => assert(audit.migrationExclusions.includes(excludedBehavior)));
[
  "Intelligence Foundation certified",
  "V757 Intelligence Package Certification passed",
  "V758 Post-Certification Readiness Review passed",
  "V769 Rail Migration Readiness Audit passed",
  "protected systems preserved",
  "runtime behavior unchanged",
  "Rail remains inactive",
  "separate migration authorization approved"
].forEach((gate) => assert(audit.validationGates.includes(gate)));
[
  "restore planned-foundation status",
  "remove migration metadata",
  "preserve provider identity",
  "preserve runtime behavior",
  "preserve protected systems"
].forEach((rollbackStep) => assert(audit.rollbackStrategy.includes(rollbackStep)));

console.log(JSON.stringify({ audit }, null, 2));
