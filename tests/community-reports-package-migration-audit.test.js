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

const migrationAudit = context.gridlyCommunityReportsPackageMigrationAudit();

assert.strictEqual(migrationAudit.auditName, "V756 Community Reports Package Migration");
assert.strictEqual(migrationAudit.packageId, "intelligence.community-reports");
assert.strictEqual(migrationAudit.providerId, "community-reports");
assert.strictEqual(migrationAudit.intelligencePackageLinked, true);
assert.strictEqual(migrationAudit.runtimeOwnershipActive, true);
assert.strictEqual(migrationAudit.providerMigrationComplete, true);
assert.strictEqual(JSON.stringify(migrationAudit.ownershipScope), JSON.stringify([
  "provider identity",
  "intelligence package metadata",
  "provider relationship metadata",
  "supported report type metadata",
  "supported community package metadata",
  "migration state",
  "validation state"
]));
assert.strictEqual(migrationAudit.writePathChanged, false);
assert.strictEqual(migrationAudit.readPathChanged, false);
assert.strictEqual(migrationAudit.alertGenerationChanged, false);
assert.strictEqual(migrationAudit.communityPulseChanged, false);
assert.strictEqual(migrationAudit.supabaseSchemaChanged, false);
assert.strictEqual(migrationAudit.trustModelActivated, false);
assert.strictEqual(migrationAudit.freshnessModelActivated, false);
assert.strictEqual(migrationAudit.confidenceModelActivated, false);
assert.strictEqual(migrationAudit.driveTexasActivated, false);
assert.strictEqual(migrationAudit.weatherActivated, false);
assert.strictEqual(migrationAudit.railProviderChanged, false);
assert.strictEqual(migrationAudit.experienceOwnershipChanged, false);
assert.strictEqual(migrationAudit.protectedSystemsPreserved, true);
assert.strictEqual(migrationAudit.packageFoundationCertificationStillPasses, true);
assert.strictEqual(migrationAudit.safeForIntelligencePackageCertification, true);
assert.strictEqual(migrationAudit.validationPassed, true);

console.log(JSON.stringify({ migrationAudit }, null, 2));
