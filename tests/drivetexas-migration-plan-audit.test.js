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

const audit = context.gridlyDriveTexasMigrationPlanAudit();

assert.strictEqual(audit.auditName, "V760 DriveTexas Metadata Ownership Migration Plan");
assert.strictEqual(audit.planVersion, "V760");
assert.strictEqual(audit.providerId, "drivetexas");
assert.strictEqual(audit.packageId, "intelligence.drivetexas");
assert.strictEqual(audit.planPassed, true);
assert.strictEqual(audit.migrationType, "metadata-only");
assert.strictEqual(audit.activationAuthorized, false);
assert.strictEqual(audit.runtimeOwnershipTransferred, false);
assert.strictEqual(audit.providerMigrationPerformed, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.safeForFutureMigration, true);
assert.strictEqual(audit.certificationRequired, true);
assert(audit.migrationScope.includes("provider identity"));
assert(audit.migrationScope.includes("package ownership metadata"));
assert(audit.migrationScope.includes("validation metadata"));
assert(audit.migrationExclusions.includes("live DriveTexas ingestion"));
assert(audit.migrationExclusions.includes("Transportation Intelligence"));
assert(audit.migrationExclusions.includes("Supabase schema"));
assert(audit.migrationExclusions.includes("mobile portrait behavior"));
assert(audit.validationGates.includes("Intelligence Foundation certified"));
assert(audit.validationGates.includes("separate migration authorization approved"));
assert(audit.rollbackStrategy.includes("restore planned-foundation status"));
assert(audit.rollbackStrategy.includes("preserve runtime behavior"));

console.log(JSON.stringify({ audit }, null, 2));
