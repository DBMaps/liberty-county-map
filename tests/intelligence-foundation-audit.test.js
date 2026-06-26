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

const registryAudit = context.gridlyPackageRegistryAudit();
const communityAudit = context.gridlyCommunityPackageAudit();
const regionalAudit = context.gridlyRegionalCommunityFoundationAudit();
const transportationAudit = context.gridlyTransportationFoundationAudit();
const intelligenceAudit = context.gridlyIntelligenceFoundationAudit();

assert.strictEqual(registryAudit.validationPassed, true);
assert.strictEqual(registryAudit.packageTypes.intelligence, 5);
assert.strictEqual(communityAudit.validationPassed, true);
assert.strictEqual(regionalAudit.validationPassed, true);
assert.strictEqual(transportationAudit.validationPassed, true);
assert.strictEqual(intelligenceAudit.auditName, "V751 Southeast Texas Intelligence Foundation");
assert.strictEqual(intelligenceAudit.intelligenceFoundationAvailable, true);
assert.strictEqual(intelligenceAudit.operationalRegionId, "operational-region.southeast-texas");
assert.strictEqual(intelligenceAudit.intelligencePackageCount, 5);
assert.strictEqual(
  JSON.stringify(intelligenceAudit.plannedIntelligencePackages.map((pkg) => pkg.providerId)),
  JSON.stringify(["community-reports", "drivetexas", "weather", "rail", "future-providers"])
);
assert.strictEqual(intelligenceAudit.runtimeOwnershipMigrated, true);
assert.strictEqual(intelligenceAudit.providerMigrationComplete, true);
assert.strictEqual(intelligenceAudit.communityReportsControlledMigrated, true);
assert.strictEqual(intelligenceAudit.driveTexasControlledMigrated, true);
assert.strictEqual(JSON.stringify(intelligenceAudit.controlledMigratedProviders), JSON.stringify(["community-reports", "drivetexas", "weather"]));
assert.strictEqual(JSON.stringify(intelligenceAudit.remainingPlannedProviders), JSON.stringify(["Rail", "Future Providers"]));
assert.strictEqual(intelligenceAudit.trustModelActivated, false);
assert.strictEqual(intelligenceAudit.freshnessModelActivated, false);
assert.strictEqual(intelligenceAudit.confidenceModelActivated, false);
assert.strictEqual(intelligenceAudit.driveTexasActivated, false);
assert.strictEqual(intelligenceAudit.weatherActivated, false);
assert.strictEqual(intelligenceAudit.railProviderChanged, false);
assert.strictEqual(intelligenceAudit.communityReportsChanged, false);
assert.strictEqual(intelligenceAudit.communityOwnershipChanged, false);
assert.strictEqual(intelligenceAudit.transportationOwnershipChanged, false);
assert.strictEqual(intelligenceAudit.experienceOwnershipChanged, false);
assert.strictEqual(intelligenceAudit.protectedSystems.historicalReadsEnabled, false);
assert.strictEqual(intelligenceAudit.protectedSystems.historyUiEnabled, false);
assert.strictEqual(intelligenceAudit.protectedSystems.DriveTexasPaused, true);
assert.strictEqual(intelligenceAudit.protectedSystemsPreserved, true);
assert.strictEqual(intelligenceAudit.safeForIntelligencePackageMigration, true);
assert.strictEqual(intelligenceAudit.safeForExperienceConsumption, true);
assert.strictEqual(intelligenceAudit.validationPassed, true);

console.log(JSON.stringify({ intelligenceAudit }, null, 2));
