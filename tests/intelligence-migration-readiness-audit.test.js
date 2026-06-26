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

const audit = context.gridlyIntelligenceMigrationReadinessAudit();

assert.strictEqual(audit.auditName, "V758 Post-Certification Intelligence Migration Readiness");
assert.strictEqual(audit.reviewVersion, "V758");
assert.strictEqual(audit.reviewPassed, true);
assert.strictEqual(audit.intelligenceFoundationCertified, true);
assert.strictEqual(audit.communityReportsCertified, true);
assert.strictEqual(audit.communityReportsOnlyMigratedProvider, true);
assert.strictEqual(audit.futureMigrationSafe, true);
assert.strictEqual(audit.architectureStable, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
assert.strictEqual(audit.migrationReadiness.providerActivationAuthorized, false);
assert.strictEqual(audit.migrationReadiness.recommendationOnly, true);
assert(audit.remainingProviders.every((provider) => provider.inactive === true));
assert.strictEqual(
  JSON.stringify(audit.recommendedMigrationSequence.map((provider) => [provider.order, provider.providerName, provider.state])),
  JSON.stringify([
    [1, "Community Reports", "complete"],
    [2, "DriveTexas", "future"],
    [3, "Weather", "future"],
    [4, "Rail", "future"],
    [5, "Future providers", "future"]
  ])
);

console.log(JSON.stringify({ audit }, null, 2));
