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

const audit = context.gridlyIntelligencePackageCertificationAudit();

assert.strictEqual(audit.auditName, "V757 Intelligence Package Certification");
assert.strictEqual(audit.certificationVersion, "V757");
assert.strictEqual(audit.certificationPassed, true);
assert.strictEqual(audit.communityReportsControlledMigrated, true);
assert.strictEqual(audit.communityReportsOnlyMigratedProvider, true);
assert.strictEqual(audit.noAdditionalProviderMigration, true);
assert.strictEqual(audit.driveTexasPaused, true);
assert.strictEqual(audit.weatherInactive, true);
assert.strictEqual(audit.railInactive, true);
assert.strictEqual(audit.trustModelInactive, true);
assert.strictEqual(audit.freshnessModelInactive, true);
assert.strictEqual(audit.confidenceModelInactive, true);
assert.strictEqual(audit.readPathPreserved, true);
assert.strictEqual(audit.writePathPreserved, true);
assert.strictEqual(audit.alertGenerationPreserved, true);
assert.strictEqual(audit.communityPulsePreserved, true);
assert.strictEqual(audit.supabaseSchemaPreserved, true);
assert.strictEqual(audit.experienceOwnershipPreserved, true);
assert.strictEqual(audit.transportationOwnershipPreserved, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.safeForFutureIntelligenceProviderMigration, true);

const packages = context.gridlyPackageRegistry.discover({ packageType: "intelligence" });
const migratedProviders = packages.filter((pkg) => pkg.status === "controlled-migrated" || pkg.intelligence.runtimeOwnershipActive || pkg.intelligence.providerMigrationComplete).map((pkg) => pkg.intelligence.providerId);
assert.strictEqual(JSON.stringify(migratedProviders), JSON.stringify(["community-reports"]));
assert(packages.filter((pkg) => pkg.intelligence.providerId !== "community-reports").every((pkg) => pkg.status === "planned-foundation" && pkg.intelligence.runtimeOwnershipActive === false && pkg.intelligence.providerMigrationComplete === false));

console.log(JSON.stringify({ audit, migratedProviders }, null, 2));
