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
const transportationAudit = context.gridlyTransportationFoundationAudit();

assert.strictEqual(registryAudit.validationPassed, true);
assert.strictEqual(registryAudit.packageTypes.transportation, 10);
assert.strictEqual(transportationAudit.auditName, "V750 Southeast Texas Transportation Foundation");
assert.strictEqual(transportationAudit.transportationFoundationAvailable, true);
assert.strictEqual(transportationAudit.operationalRegionId, "operational-region.southeast-texas");
assert.strictEqual(transportationAudit.transportationPackageCount, 10);
assert.strictEqual(
  JSON.stringify(transportationAudit.plannedTransportationPackages.map((pkg) => pkg.corridorId)),
  JSON.stringify(["tx146", "us90", "us59-i69", "i45", "i10", "tx105", "tx321", "fm1960", "fm1409", "fm1011"])
);
assert.strictEqual(transportationAudit.runtimeOwnershipMigrated, false);
assert.strictEqual(transportationAudit.assetMigrationComplete, false);
assert.strictEqual(transportationAudit.directionalDisplayAllowed, false);
assert.strictEqual(transportationAudit.transportationIntelligenceActivated, false);
assert.strictEqual(transportationAudit.communityOwnershipChanged, false);
assert.strictEqual(transportationAudit.intelligenceOwnershipChanged, false);
assert.strictEqual(transportationAudit.experienceOwnershipChanged, false);
assert.strictEqual(transportationAudit.protectedSystemsPreserved, true);
assert.strictEqual(transportationAudit.safeForTransportationPackageMigration, true);
assert.strictEqual(transportationAudit.safeForIntelligenceFoundation, true);
assert.strictEqual(transportationAudit.validationPassed, true);

console.log(JSON.stringify({ transportationAudit }, null, 2));
