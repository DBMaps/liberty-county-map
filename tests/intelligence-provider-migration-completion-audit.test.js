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

const audit = context.gridlyIntelligenceProviderMigrationCompletionAudit();

assert.strictEqual(audit.auditName, "V774 Intelligence Provider Migration Completion Certification");
assert.strictEqual(audit.certificationVersion, "V774");
assert.strictEqual(audit.certificationPassed, true);
assert.strictEqual(audit.metadataOwnershipComplete, true);
assert.strictEqual(audit.runtimeActivationPerformed, false);
assert.strictEqual(audit.transportationIntelligenceActivated, false);
assert.strictEqual(audit.directionalIntelligenceActivated, false);
assert.strictEqual(audit.trustModelActivated, false);
assert.strictEqual(audit.freshnessModelActivated, false);
assert.strictEqual(audit.confidenceModelActivated, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.futureProvidersRemainPlanned, true);
assert.strictEqual(audit.safeForFutureProviderExpansion, true);
assert.strictEqual(audit.intelligenceFoundationCertified, true);
assert.strictEqual(audit.packageFoundationCertified, true);

assert.strictEqual(JSON.stringify(audit.certifiedProviders.map((provider) => provider.providerName)), JSON.stringify(["Community Reports", "DriveTexas", "Weather", "Rail"]));
assert(audit.certifiedProviders.every((provider) => provider.certified === true && provider.metadataOnly === true));
assert.strictEqual(audit.plannedProviders.length, 1);
assert.strictEqual(audit.plannedProviders[0].providerName, "Future Providers");
assert.strictEqual(audit.plannedProviders[0].status, "planned-foundation");
assert.strictEqual(audit.plannedProviders[0].inactive, true);
assert.strictEqual(audit.plannedProviders[0].runtimeOwnershipActive, false);
assert.strictEqual(audit.plannedProviders[0].providerMigrationComplete, false);

console.log(JSON.stringify({ audit }, null, 2));
