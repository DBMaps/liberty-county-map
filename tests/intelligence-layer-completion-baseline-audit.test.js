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

const audit = context.gridlyIntelligenceLayerCompletionBaselineAudit();

assert.strictEqual(audit.auditName, "V775 Intelligence Layer Completion Baseline");
assert.strictEqual(audit.baselineVersion, "V775");
assert.strictEqual(audit.baselinePassed, true);
assert.strictEqual(audit.intelligenceLayerStructurallyComplete, true);
assert.strictEqual(audit.firstGenerationProviderMigrationComplete, true);
assert.strictEqual(audit.providerMigrationCompletionCertified, true);
assert.strictEqual(audit.metadataOnlyMigrationsConfirmed, true);
assert.strictEqual(audit.runtimeActivationAuthorized, false);
assert.strictEqual(audit.runtimeActivationPerformed, false);
assert.strictEqual(audit.providerBehaviorChanged, false);
assert.strictEqual(audit.transportationIntelligenceActivated, false);
assert.strictEqual(audit.directionalIntelligenceActivated, false);
assert.strictEqual(audit.trustModelActivated, false);
assert.strictEqual(audit.freshnessModelActivated, false);
assert.strictEqual(audit.confidenceModelActivated, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.safeForFutureProviderExpansion, true);
assert.strictEqual(audit.safeForFutureRuntimeActivationPlanning, true);

assert.strictEqual(JSON.stringify(audit.certifiedProviders.map((provider) => provider.providerName)), JSON.stringify(["Community Reports", "DriveTexas", "Weather", "Rail"]));
assert(audit.certifiedProviders.every((provider) => provider.certified === true && provider.metadataOnly === true));
assert.strictEqual(audit.plannedProviders.length, 1);
assert.strictEqual(audit.plannedProviders[0].providerName, "Future Providers");
assert.strictEqual(audit.plannedProviders[0].status, "planned-foundation");
assert.strictEqual(audit.plannedProviders[0].inactive, true);
assert.strictEqual(audit.plannedProviders[0].runtimeOwnershipActive, false);
assert.strictEqual(audit.plannedProviders[0].providerMigrationComplete, false);
assert.strictEqual(audit.runtimeActivationProhibition, "This baseline does not authorize runtime activation.");
assert.strictEqual(audit.futureRuntimeActivationRequirement, "Future runtime activation, if ever considered, requires a separate readiness review, plan, authorization, implementation, and certification sequence.");
assert(Object.values(audit.protectedSystemVerification).every((value) => value === true));

console.log(JSON.stringify({ audit }, null, 2));
