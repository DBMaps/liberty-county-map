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

const adapterAudit = context.gridlyCommunityReportsAdapterAudit();

assert.strictEqual(adapterAudit.auditName, "V755 Community Reports Adapter Foundation");
assert.strictEqual(adapterAudit.adapterAvailable, true);
assert.strictEqual(adapterAudit.providerId, "community-reports");
assert.strictEqual(adapterAudit.packageId, "intelligence.community-reports");
assert.strictEqual(adapterAudit.intelligencePackageLinked, true);
assert.strictEqual(adapterAudit.operationalRegionId, "operational-region.southeast-texas");
assert.strictEqual(JSON.stringify(adapterAudit.supportedCommunityPackages), JSON.stringify(["community.liberty-tx", "community.montgomery-tx", "community.san-jacinto-tx"]));
assert.strictEqual(JSON.stringify(adapterAudit.supportedReportTypes), JSON.stringify(["flooding", "crash", "disabled_vehicle", "debris", "road_closed", "construction", "traffic_backup", "rail_blockage_delay", "rail_issue", "other_hazard"]));
assert.strictEqual(adapterAudit.runtimeOwnershipActive, false);
assert.strictEqual(adapterAudit.providerMigrationComplete, false);
assert.strictEqual(adapterAudit.behaviorChanged, false);
assert.strictEqual(adapterAudit.writePathChanged, false);
assert.strictEqual(adapterAudit.readPathChanged, false);
assert.strictEqual(adapterAudit.alertGenerationChanged, false);
assert.strictEqual(adapterAudit.communityPulseChanged, false);
assert.strictEqual(adapterAudit.trustModelActivated, false);
assert.strictEqual(adapterAudit.freshnessModelActivated, false);
assert.strictEqual(adapterAudit.confidenceModelActivated, false);
assert.strictEqual(adapterAudit.driveTexasActivated, false);
assert.strictEqual(adapterAudit.weatherActivated, false);
assert.strictEqual(adapterAudit.railProviderChanged, false);
assert.strictEqual(adapterAudit.protectedSystemsPreserved, true);
assert.strictEqual(adapterAudit.safeForCommunityReportsMigration, true);
assert.strictEqual(adapterAudit.safeForDriveTexasPause, true);
assert.strictEqual(adapterAudit.validationPassed, true);

console.log(JSON.stringify({ adapterAudit }, null, 2));
