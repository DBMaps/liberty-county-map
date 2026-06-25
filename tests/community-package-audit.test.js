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

assert.strictEqual(regionalAudit.regionalFoundationAvailable, true);
assert.strictEqual(regionalAudit.communityPackageCount, 11);
assert.strictEqual(JSON.stringify(regionalAudit.operationalCommunities), JSON.stringify(["liberty-tx", "montgomery-tx", "san-jacinto-tx"]));
assert.strictEqual(JSON.stringify(regionalAudit.plannedCommunities), JSON.stringify(["chambers-tx", "jefferson-tx", "hardin-tx", "orange-tx", "polk-tx", "tyler-tx", "walker-tx", "harris-tx"]));
assert.strictEqual(regionalAudit.regionalMembershipValid, true);
assert.strictEqual(regionalAudit.libertyReferenceImplementation, true);
assert.strictEqual(regionalAudit.transportationOwnershipMigrated, false);
assert.strictEqual(regionalAudit.intelligenceOwnershipMigrated, false);
assert.strictEqual(regionalAudit.experienceOwnershipChanged, false);
assert.strictEqual(regionalAudit.safeForTransportationFoundation, true);

console.log(JSON.stringify({ registryAudit, communityAudit, regionalAudit }, null, 2));
