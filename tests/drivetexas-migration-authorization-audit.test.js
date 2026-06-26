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

const audit = context.gridlyDriveTexasMigrationAuthorizationAudit();

assert.strictEqual(audit.auditName, "V761 DriveTexas Metadata Ownership Migration Authorization");
assert.strictEqual(audit.authorizationVersion, "V761");
assert.strictEqual(audit.providerId, "drivetexas");
assert.strictEqual(audit.packageId, "intelligence.drivetexas");
assert.strictEqual(audit.prerequisiteCertificationPassed, true);
assert.strictEqual(audit.readinessReviewPassed, true);
assert.strictEqual(audit.migrationPlanCompleted, true);
assert.strictEqual(audit.providerStillPaused, true);
assert.strictEqual(audit.reviewPassed, true);
assert.strictEqual(audit.authorizationGranted, true);
assert.strictEqual(audit.futureMetadataMigrationAuthorized, true);
assert.strictEqual(audit.activationAuthorized, false);
assert.strictEqual(audit.runtimeOwnershipTransferred, true);
assert.strictEqual(audit.providerMigrationPerformed, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert(audit.authorizationScope.includes("future metadata ownership migration"));
assert(audit.authorizationScope.includes("provider identity metadata"));
assert(audit.authorizationScope.includes("package ownership metadata"));
assert(audit.authorizationScope.includes("provider relationship metadata"));
assert(audit.authorizationScope.includes("migration metadata"));
assert(audit.authorizationScope.includes("validation metadata"));
assert(audit.authorizationLimitations.includes("live DriveTexas ingestion"));
assert(audit.authorizationLimitations.includes("Transportation Intelligence"));
assert(audit.authorizationLimitations.includes("mobile portrait changes"));
assert.strictEqual(audit.authorizationStatement, "This milestone authorizes only a future metadata-only ownership migration.");
assert(audit.notAuthorized.includes("runtime activation"));
assert(audit.notAuthorized.includes("provider activation"));
assert(audit.notAuthorized.includes("Transportation Intelligence"));
assert(audit.notAuthorized.includes("user-facing behavior"));
assert(audit.notAuthorized.includes("ingestion changes"));

console.log(JSON.stringify({ audit }, null, 2));
