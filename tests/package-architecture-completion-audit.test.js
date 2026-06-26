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

const audit = context.gridlyPackageArchitectureCompletionAudit();

assert.strictEqual(audit.auditName, "V776 Package Architecture Completion Certification");
assert.strictEqual(audit.certificationVersion, "V776");
assert.strictEqual(audit.certificationPassed, true);
assert.strictEqual(audit.architectureComplete, true);
assert.strictEqual(audit.metadataOwnershipArchitectureComplete, true);
assert.strictEqual(audit.runtimeActivationAuthorized, false);
assert.strictEqual(audit.runtimeActivationPerformed, false);
assert.strictEqual(audit.transportationIntelligenceActivated, false);
assert.strictEqual(audit.directionalIntelligenceActivated, false);
assert.strictEqual(audit.trustModelActivated, false);
assert.strictEqual(audit.freshnessModelActivated, false);
assert.strictEqual(audit.confidenceModelActivated, false);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.safeForFutureArchitectureExpansion, true);

assert.strictEqual(JSON.stringify(audit.certifiedCommunityPackages.map((pkg) => pkg.name)), JSON.stringify(["Liberty", "Montgomery", "San Jacinto"]));
assert.strictEqual(JSON.stringify(audit.certifiedTransportationPackages.map((pkg) => pkg.name)), JSON.stringify(["TX146", "US90", "US59/I69", "I45", "I10", "TX105", "TX321", "FM1960", "FM1409", "FM1011"]));
assert.strictEqual(JSON.stringify(audit.certifiedIntelligenceProviders.map((provider) => provider.name)), JSON.stringify(["Community Reports", "DriveTexas", "Weather", "Rail"]));
assert.strictEqual(JSON.stringify(audit.plannedProviders.map((provider) => provider.name)), JSON.stringify(["Future Providers"]));
assert(Object.values(audit.protectedBehaviorVerification).every((value) => value === true));

console.log(JSON.stringify({ audit }, null, 2));
