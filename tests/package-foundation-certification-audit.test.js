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

const certificationAudit = context.gridlyPackageFoundationCertificationAudit();

assert.strictEqual(certificationAudit.auditName, "V752 Package Foundation Certification");
assert.strictEqual(certificationAudit.packageRegistryAvailable, true);
assert.strictEqual(certificationAudit.operationalRegionAvailable, true);
assert.strictEqual(certificationAudit.communityFoundationValid, true);
assert.strictEqual(certificationAudit.transportationFoundationValid, true);
assert.strictEqual(certificationAudit.intelligenceFoundationValid, true);
assert.strictEqual(certificationAudit.communityPackageCount, 11);
assert.strictEqual(certificationAudit.transportationPackageCount, 10);
assert.strictEqual(certificationAudit.intelligencePackageCount, 5);
assert.strictEqual(certificationAudit.libertyReferenceImplementation, true);
assert.strictEqual(certificationAudit.montgomeryOperationalMaintenance, true);
assert.strictEqual(certificationAudit.sanJacintoOperationalMaintenance, true);
assert.strictEqual(certificationAudit.noCommunityOwnershipRegression, true);
assert.strictEqual(certificationAudit.noTransportationOwnershipMigration, true);
assert.strictEqual(certificationAudit.noIntelligenceOwnershipMigration, true);
assert.strictEqual(certificationAudit.noExperienceOwnershipChange, true);
assert.strictEqual(certificationAudit.noProviderActivation, true);
assert.strictEqual(certificationAudit.noDirectionalDisplayActivation, true);
assert.strictEqual(certificationAudit.protectedSystems.historicalReadsEnabled, false);
assert.strictEqual(certificationAudit.protectedSystems.historyUiEnabled, false);
assert.strictEqual(certificationAudit.protectedSystems.DriveTexasPaused, true);
assert.strictEqual(certificationAudit.protectedSystemsPreserved, true);
assert.strictEqual(certificationAudit.safeForCommunityPackageMigration, true);
assert.strictEqual(certificationAudit.safeForTransportationPackageMigration, true);
assert.strictEqual(certificationAudit.safeForIntelligencePackageMigration, true);
assert.strictEqual(certificationAudit.safeForExperienceLayerConsumption, true);
assert.strictEqual(certificationAudit.validationPassed, true);

console.log(JSON.stringify({ certificationAudit }, null, 2));
