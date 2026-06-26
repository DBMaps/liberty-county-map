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

const audit = context.gridlyDriveTexasMigrationReadinessAudit();

assert.strictEqual(audit.auditName, "V759 DriveTexas Migration Readiness");
assert.strictEqual(audit.reviewVersion, "V759");
assert.strictEqual(audit.reviewPassed, true);
assert.strictEqual(audit.providerRegistered, true);
assert.strictEqual(audit.intelligencePackageLinked, true);
assert.strictEqual(audit.driveTexasPaused, true);
assert.strictEqual(audit.runtimeOwnershipActive, true);
assert.strictEqual(audit.providerMigrationComplete, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.futureMigrationSafe, true);
assert.strictEqual(audit.currentStatus, "controlled-migrated");
assert.strictEqual(
  JSON.stringify(audit.ownershipScope),
  JSON.stringify([
    "provider identity",
    "package metadata",
    "provider relationship metadata",
    "supported intelligence metadata",
    "migration state",
    "validation state"
  ])
);
assert(audit.behaviorOutsideMigrationScope.includes("live incident ingestion"));
assert(audit.behaviorOutsideMigrationScope.includes("Transportation Intelligence"));
assert(audit.behaviorOutsideMigrationScope.includes("Supabase schema"));

console.log(JSON.stringify({ audit }, null, 2));
