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

const audit = context.gridlyRailMigrationAuthorizationAudit();

assert.strictEqual(audit.auditName, "V771 Rail Metadata Ownership Migration Authorization");
assert.strictEqual(audit.authorizationVersion, "V771");
assert.strictEqual(audit.providerId, "rail");
assert.strictEqual(audit.packageId, "intelligence.rail");
assert.strictEqual(audit.reviewPassed, true);
assert.strictEqual(audit.authorizationGranted, true);
assert.strictEqual(audit.futureMetadataMigrationAuthorized, true);
assert.strictEqual(audit.activationAuthorized, false);
assert.strictEqual(audit.runtimeOwnershipTransferred, false);
assert.strictEqual(audit.providerMigrationPerformed, false);
assert.strictEqual(audit.providerStillInactive, true);
assert.strictEqual(audit.protectedSystemsPreserved, true);
[
  "future metadata ownership migration",
  "provider identity metadata",
  "package ownership metadata",
  "provider relationship metadata",
  "migration metadata",
  "validation metadata"
].forEach((scope) => assert(audit.authorizationScope.includes(scope)));
[
  "Rail runtime execution",
  "Rail data ingestion",
  "crossing runtime behavior",
  "alert generation",
  "Transportation Intelligence",
  "Directional Intelligence",
  "trust model",
  "freshness model",
  "confidence model",
  "report reads",
  "report writes",
  "Community Pulse",
  "Supabase schema",
  "UI rendering",
  "Experience ownership",
  "Transportation ownership",
  "Operations Center",
  "mobile portrait behavior"
].forEach((limitation) => assert(audit.authorizationLimitations.includes(limitation)));
assert(audit.authorizationStatement.includes("future metadata-only ownership migration"));
assert(audit.authorizationStatement.includes("does NOT authorize runtime activation") || audit.authorizationStatement.includes("does NOT authorize runtime activation"));

console.log(JSON.stringify({ audit }, null, 2));
