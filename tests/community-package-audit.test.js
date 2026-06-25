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

assert.strictEqual(registryAudit.validationPassed, true);
assert.strictEqual(communityAudit.communityPackageSystemAvailable, true);
assert.strictEqual(communityAudit.libertyPackageRegistered, true);
assert.strictEqual(communityAudit.libertyPackageNoLongerPlaceholderOnly, true);
assert.strictEqual(communityAudit.libertyHasAwarenessAreas, true);
assert.strictEqual(communityAudit.daytonAwarenessAreaWorks, true);
assert.strictEqual(communityAudit.libertyHasAdministrativeBoundaryRelationship, true);
assert.strictEqual(communityAudit.libertyProductionEnabled, true);
assert.strictEqual(communityAudit.libertySelectable, true);
assert.strictEqual(communityAudit.montgomeryUnchanged, true);
assert.strictEqual(communityAudit.sanJacintoUnchanged, true);
assert.strictEqual(communityAudit.noTransportationOwnershipMigrated, true);
assert.strictEqual(communityAudit.noIntelligenceOwnershipMigrated, true);
assert.strictEqual(communityAudit.safeForMontgomeryMigration, true);
assert.strictEqual(communityAudit.safeForSanJacintoMigration, true);
assert.strictEqual(communityAudit.safeForTransportationMigration, true);
assert.strictEqual(communityAudit.validationPassed, true);

console.log(JSON.stringify({ registryAudit, communityAudit }, null, 2));
