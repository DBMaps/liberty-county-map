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

const audit = context.gridlyWeatherMigrationAuthorizationAudit();

assert.strictEqual(audit.auditName, "V766 Weather Metadata Ownership Migration Authorization");
assert.strictEqual(audit.authorizationVersion, "V766");
assert.strictEqual(audit.providerId, "weather");
assert.strictEqual(audit.packageId, "intelligence.weather");
assert.strictEqual(audit.prerequisiteCertificationPassed, true);
assert.strictEqual(audit.readinessReviewPassed, true);
assert.strictEqual(audit.migrationPlanCompleted, true);
assert.strictEqual(audit.providerStillInactive, true);
assert.strictEqual(audit.runtimeOwnershipTransferred, true);
assert.strictEqual(audit.providerMigrationPerformed, true);
assert.strictEqual(audit.authorizationGranted, true);
assert.strictEqual(audit.futureMetadataMigrationAuthorized, true);
assert.strictEqual(audit.activationAuthorized, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.reviewPassed, true);
assert(audit.authorizationScope.includes("future metadata ownership migration"));
assert(audit.authorizationScope.includes("provider identity metadata"));
assert(audit.authorizationScope.includes("package ownership metadata"));
assert(audit.authorizationScope.includes("provider relationship metadata"));
assert(audit.authorizationScope.includes("migration metadata"));
assert(audit.authorizationScope.includes("validation metadata"));
assert(audit.authorizationLimitations.includes("Weather runtime execution"));
assert(audit.authorizationLimitations.includes("Weather data ingestion"));
assert(audit.authorizationLimitations.includes("Transportation Intelligence"));
assert(audit.authorizationLimitations.includes("Supabase schema"));
assert(audit.authorizationLimitations.includes("mobile portrait behavior"));
assert.strictEqual(audit.authorizationStatement, "This milestone authorizes only a future metadata-only ownership migration.");
assert(audit.notAuthorized.includes("runtime activation"));
assert(audit.notAuthorized.includes("provider activation"));
assert(audit.notAuthorized.includes("Weather runtime execution"));
assert(audit.notAuthorized.includes("Transportation Intelligence"));
assert(audit.notAuthorized.includes("Directional Intelligence"));
assert(audit.notAuthorized.includes("user-facing behavior"));
assert(audit.notAuthorized.includes("ingestion changes"));

console.log(JSON.stringify({ audit }, null, 2));
