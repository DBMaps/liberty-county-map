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

const migrationAudit = context.gridlyCommunityReportsPackageMigrationAudit();

assert.strictEqual(migrationAudit.auditName, "V756 Community Reports Package Migration");
assert.strictEqual(migrationAudit.packageId, "intelligence.community-reports");
assert.strictEqual(migrationAudit.providerId, "community-reports");
assert.strictEqual(migrationAudit.intelligencePackageLinked, true);
assert.strictEqual(migrationAudit.runtimeOwnershipActive, true);
assert.strictEqual(migrationAudit.providerMigrationComplete, true);
assert.strictEqual(JSON.stringify(migrationAudit.ownershipScope), JSON.stringify([
  "provider identity",
  "intelligence package metadata",
  "provider relationship metadata",
  "supported report type metadata",
  "supported community package metadata",
  "migration state",
  "validation state"
]));
assert.strictEqual(migrationAudit.writePathChanged, false);
assert.strictEqual(migrationAudit.readPathChanged, false);
assert.strictEqual(migrationAudit.alertGenerationChanged, false);
assert.strictEqual(migrationAudit.communityPulseChanged, false);
assert.strictEqual(migrationAudit.supabaseSchemaChanged, false);
assert.strictEqual(migrationAudit.trustModelActivated, false);
assert.strictEqual(migrationAudit.freshnessModelActivated, false);
assert.strictEqual(migrationAudit.confidenceModelActivated, false);
assert.strictEqual(migrationAudit.driveTexasActivated, false);
assert.strictEqual(migrationAudit.weatherActivated, false);
assert.strictEqual(migrationAudit.railProviderChanged, false);
assert.strictEqual(migrationAudit.experienceOwnershipChanged, false);
assert.strictEqual(migrationAudit.protectedSystemsPreserved, true);
assert.strictEqual(migrationAudit.packageFoundationCertificationStillPasses, true);
assert.strictEqual(migrationAudit.safeForIntelligencePackageCertification, true);
assert.strictEqual(migrationAudit.validationPassed, true);

console.log(JSON.stringify({ migrationAudit }, null, 2));

// Active regional membership follows validated package metadata, not a two-county list.
const {validateRegionalCommunityFoundation}=require('../js/gridlyPackageRegistry.js');
const foundation=context.gridlySoutheastTexasCommunityFoundation;
const communities=context.gridlyPackageRegistry.discover({packageType:'community'});
const check=rows=>validateRegionalCommunityFoundation(foundation,{discover:()=>rows});
assert.equal(check(communities).valid,true);
const active=communities.find(p=>p.regional?.activeImplementation && !['liberty-tx','chambers-tx'].includes(p.regional.countyId));
assert.ok(active,'expanded governed regional membership is exercised');
for(const patch of [{status:'reserved'},{validationState:'invalid'},{community:{...active.community,productionEnabled:false}},{operationalRegion:{id:'wrong-region'}}]) {
 assert.equal(check(communities.map(p=>p.id===active.id?{...p,...patch}:p)).valid,false,'invalid activation must fail');
}
