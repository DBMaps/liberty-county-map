#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const APPROVED_ASSERTIONS = Object.freeze(['CERTIFIED_ARTIFACT_STABILITY','OPERATIONAL_COUNTY_RESULT_STABILITY','COUNTY_BOUNDARY_ISOLATION','CONSUMER_RESULT_STABILITY','FALLBACK_BEHAVIOR_STABILITY','ROUTE_AWARENESS_STABILITY']);
export const ASSERTION_OWNERSHIP = Object.freeze(Object.fromEntries(APPROVED_ASSERTIONS.map(assertionId=>[assertionId,'WAVE_0'])));
export const COMPLETED_DIMENSIONS = Object.freeze(['deployment','runtime','boundary']);
export const MUTATING_METHODS = Object.freeze(['POST','PUT','PATCH','DELETE']);
export const BLOCKED_NON_APPLICATION_MUTATIONS = Object.freeze([
  Object.freeze({method:'POST',origin:'https://cloudflareinsights.com',pathname:'/cdn-cgi/rum',category:'THIRD_PARTY_TELEMETRY'})
]);
const CLOUDFLARE_MANAGED_RUM = Object.freeze({method:'POST',pathname:'/cdn-cgi/rum',category:'CLOUDFLARE_MANAGED_RUM_TELEMETRY'});
export const SECRET_NAMES = Object.freeze(['GRIDLY_VALIDATOR_ACCESS_CLIENT_ID','GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET']);
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const canonical = (v) => `${JSON.stringify(v,null,2)}\n`;
export const digest = (v) => `sha256:${crypto.createHash('sha256').update(canonical(v)).digest('hex')}`;
export const fileDigest = (text) => `sha256:${crypto.createHash('sha256').update(text).digest('hex')}`;
export const LEGACY_OWNER_EXECUTION_PROVENANCE = Object.freeze({
  classification:'OWNER_WAVE0_EVIDENCE_SCHEMA_MIGRATION_REQUIRED',
  harnessCommit:'f87fd06c35527bdce11e346d278fa8b8e9837bae',
  harnessBlob:'7724126e7304f1739d4508f38649567d34c53c6f',
  reconciliationBlob:'53dee3b6da8f5b113c6fd026ce6220300406e525',
  legacyContractDigest:'sha256:912062fbbea2667067c01623ed26797c2430ed9011d1f791db048cce1c2d8b09',
  journeyContract:Object.freeze({selectionInputType:'ZIP',resolver:'resolveGridlyAwarenessAreaQuery',assertion:'exact active county FIPS',scope:'all exact governed Wave 0 FIPS'})
});
export function governedTarget(ownerEvidence, provisioningEvidence) {
  const deploymentIdentity = ownerEvidence?.deploymentIdentity;
  const selectedEnvironment = provisioningEvidence?.selectedEnvironment;
  if (!deploymentIdentity?.deploymentId) throw Error('missing_governed_deployment_identity');
  if (!deploymentIdentity.expectedBuildIdentity || !selectedEnvironment?.buildIdentity || deploymentIdentity.expectedBuildIdentity !== selectedEnvironment.buildIdentity) throw Error('governed_build_identity_mismatch');
  return Object.freeze({ classification:'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION', url:selectedEnvironment.rootUrl, deploymentId:deploymentIdentity.deploymentId, buildIdentity:deploymentIdentity.expectedBuildIdentity });
}
export function contract() {
  const wave = read('reports/lp18811f2/wave0-authority-contract.json');
  const fixtures = read('reports/lp18811f4/wave0-fixture-authority.json');
  const defect = read('reports/lp18811f2/defect-inventory.json');
  const env = read('reports/lp18811c/protected-environment-provisioning.json');
  const ownerEvidence = read('evidence/lp18811/execution-results/owner-result.json');
  const statewide = read('reports/lp18811e/remaining-validation-matrix.json');
  const exactFips = wave.exactFipsScope || wave.fipsScope;
  return Object.freeze({ schemaVersion:'gridly.lp18812.closure-contract.v1', milestone:'LP188.12', target:governedTarget(ownerEvidence,env), exactWave0Fips:exactFips, assertions:APPROVED_ASSERTIONS, assertionOwnership:ASSERTION_OWNERSHIP, wave0Assertions:APPROVED_ASSERTIONS, governedFixtures:fixtures.priorFixtures, wave0ContractDigest:digest(wave), defectInventoryDigest:digest(defect), statewideFips:statewide.records.map(x=>x.countyFips).sort(), completedDimensionsNotToRerun:COMPLETED_DIMENSIONS, remainingClosureDimensions:['regression','consumer','telemetry','rollback','operational','independentReview'], network:{ allowedMethods:['GET','HEAD','OPTIONS'], rejectedMethods:MUTATING_METHODS }, state:{currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0}, authorization:{production:false,activation:false,mutation:false} });
}
export function validateEnvironment(env, c=contract()) {
  const url = new URL(env.GRIDLY_PROTECTED_URL || 'https://invalid.invalid');
  if (url.hostname !== new URL(c.target.url).hostname || !/preview/i.test(url.hostname)) throw Error('production_or_wrong_target');
  if (env.GRIDLY_PROTECTED_DEPLOYMENT_ID !== c.target.deploymentId) throw Error('wrong_deployment');
  if (env.GRIDLY_PROTECTED_BUILD_IDENTITY !== c.target.buildIdentity) throw Error('wrong_build');
  for (const key of SECRET_NAMES) if (!env[key]) throw Error(`missing_${key}`);
  return true;
}
export function sanitize(value) {
  let text=JSON.stringify(value);
  for (const key of SECRET_NAMES) if (process.env[key]) text=text.split(process.env[key]).join('[REDACTED]');
  return JSON.parse(text.replace(/CF-Access-Client-(Id|Secret)/gi,'redacted-header'));
}
export function classifyBlockedMutation(method, requestUrl, protectedOrigin) {
  const normalizedMethod=String(method).toUpperCase();
  if (!MUTATING_METHODS.includes(normalizedMethod)) throw Error('method_is_not_mutating');
  const url=new URL(requestUrl);
  const record={method:normalizedMethod,origin:url.origin,pathname:url.pathname,category:'UNKNOWN_MUTATING_ORIGIN',blocked:true,productionMutationObserved:true};
  // On a proxied governed hostname, Cloudflare owns this exact POST endpoint and
  // uses it for Web Analytics/Browser Insights RUM beacons. It is still blocked,
  // but it is not an application mutation. No other method, path, or origin is exempt.
  if (normalizedMethod===CLOUDFLARE_MANAGED_RUM.method && url.origin===protectedOrigin && url.pathname===CLOUDFLARE_MANAGED_RUM.pathname) return {...record,category:CLOUDFLARE_MANAGED_RUM.category,productionMutationObserved:false};
  if (url.origin===protectedOrigin) return {...record,category:'PROTECTED_APPLICATION_MUTATION'};
  if (url.hostname==='supabase.co' || url.hostname.endsWith('.supabase.co')) return {...record,category:'SUPABASE_APPLICATION_DATA_MUTATION'};
  const telemetry=BLOCKED_NON_APPLICATION_MUTATIONS.find(x=>x.method===normalizedMethod&&x.origin===url.origin&&x.pathname===url.pathname);
  if (telemetry) return {...record,category:telemetry.category,productionMutationObserved:false};
  return record;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const exactFips=(input,c)=>[...new Set(input.results?.map(x=>x.fips)||[])].sort();
export function migrateLegacyOwnerExecution(input,c=contract(),sourceArtifactDigest=digest(input)) {
  const fips=exactFips(input,c), expected=[...c.exactWave0Fips].sort();
  const oldNames=input.results?.every(x=>same(x.assertions,['CERTIFIED_ARTIFACT_STABILITY','OPERATIONAL_COUNTY_RESULT_STABILITY','CONSUMER_RESULT_STABILITY']));
  const rum=input.blockedMutatingRequests;
  const allowedRumOrigins=new Set([new URL(c.target.url).origin,'https://cloudflareinsights.com']);
  const rumValid=Array.isArray(rum)&&rum.length===expected.length&&rum.every(x=>x&&x.method==='POST'&&x.pathname==='/cdn-cgi/rum'&&x.blocked===true&&x.productionMutationObserved===false&&['THIRD_PARTY_TELEMETRY','CLOUDFLARE_MANAGED_RUM_TELEMETRY'].includes(x.category)&&allowedRumOrigins.has(x.origin)&&Object.keys(x).every(k=>['method','origin','pathname','category','blocked','productionMutationObserved'].includes(k)));
  if(input.schemaVersion!=='gridly.lp18812.wave0-result.v1'||input.contractDigest!==LEGACY_OWNER_EXECUTION_PROVENANCE.legacyContractDigest||!same(fips,expected)||input.results?.length!==expected.length||!oldNames||input.failures!==0||input.openS1!==0||input.openS2!==0||input.productionMutationObserved!==false||input.activationObserved!==false||!rumValid) throw Error('legacy_owner_execution_not_migratable');
  if(sourceArtifactDigest!==digest(input)) throw Error('legacy_owner_artifact_not_canonical_or_digest_mismatch');
  const notEstablished=APPROVED_ASSERTIONS.filter(x=>x!=='OPERATIONAL_COUNTY_RESULT_STABILITY');
  return {schemaVersion:'gridly.lp18812.owner-evidence-migration.v1',sourceArtifactDigest,sourceArtifact:'evidence/lp18812/wave0-partial-result.json',sourceImmutable:true,exactFips:fips,ownerExecutionClassification:'OWNER_EXECUTION_PASSED_LEGACY_SCHEMA',establishedAssertions:['OPERATIONAL_COUNTY_RESULT_STABILITY'],assertionsNotEstablished:notEstablished,harnessContractProvenance:LEGACY_OWNER_EXECUTION_PROVENANCE,assertionOutcomes:[{assertionId:'OPERATIONAL_COUNTY_RESULT_STABILITY',outcome:'PASS',executed:true,evidenceChecks:fips.map(countyFips=>({passed:true,evidenceReference:`${sourceArtifactDigest}#governed-zip-active-fips:${countyFips}`}))}]};
}
export function validateMigration(input,migration,c=contract()) {
  if(!same(migration,migrateLegacyOwnerExecution(input,c))) throw Error('owner_evidence_migration_mismatch');
  return true;
}
export function writeMigrationOnce(migration,migrationPath) {
  const serialized=canonical(migration);
  if(fs.existsSync(migrationPath)) {
    if(fs.readFileSync(migrationPath,'utf8')!==serialized) throw Error('different_owner_execution_already_ingested');
    return 'ALREADY_INGESTED';
  }
  fs.writeFileSync(migrationPath,serialized,{flag:'wx'});
  return 'INGESTED';
}
export function reconcile(input,c=contract(),migration) {
  const seen=[...new Set(input.results?.map(x=>x.fips) || [])].sort();
  const owned=c.wave0Assertions || Object.entries(c.assertionOwnership || {}).filter(([,owner])=>owner==='WAVE_0').map(([id])=>id);
  if(migration) validateMigration(input,migration,c);
  const outcomes=[...(input.assertionOutcomes || []),...(migration?.assertionOutcomes||[])];
  const outcomeById=new Map(outcomes.map(x=>[x.assertionId,x]));
  const completed=owned.filter(id=>{const x=outcomeById.get(id);return x?.outcome==='PASS'&&x.executed===true&&Array.isArray(x.evidenceChecks)&&x.evidenceChecks.length>0&&x.evidenceChecks.every(check=>check?.passed===true&&typeof check.evidenceReference==='string'&&check.evidenceReference.length>0)});
  const pass=JSON.stringify(seen)===JSON.stringify([...c.exactWave0Fips].sort()) && completed.length===owned.length && input.failures===0 && input.openS1===0 && input.openS2===0 && input.productionMutationObserved===false && input.activationObserved===false;
  return {...sanitize(input),schemaVersion:'gridly.lp18812.wave0-result.v1',contractDigest:digest(c),reconciliationClassification:pass?'WAVE0_COMPLETE':'WAVE0_EXECUTION_EVIDENCE_INCOMPLETE',wave0OwnedAssertions:owned,completedWave0Assertions:completed,missingWave0Assertions:owned.filter(x=>!completed.includes(x)),wave0Result:pass?'PASS':'PENDING'};
}
if(process.argv[2]==='contract') process.stdout.write(canonical(contract()));
if(process.argv[2]==='reconcile') { const input=read(process.argv[3] || 'evidence/lp18812/wave0-result.input.json'); const migrationPath=path.join(ROOT,'evidence/lp18812/wave0-owner-execution-migration.json'); const migration=fs.existsSync(migrationPath)?JSON.parse(fs.readFileSync(migrationPath,'utf8')):undefined; fs.mkdirSync(path.join(ROOT,'evidence/lp18812'),{recursive:true}); fs.writeFileSync(path.join(ROOT,'evidence/lp18812/wave0-result.json'),canonical(reconcile(input,contract(),migration))); }
if(process.argv[2]==='ingest') { const sourcePath=process.argv[3] || 'evidence/lp18812/wave0-partial-result.json'; const sourceText=fs.readFileSync(path.join(ROOT,sourcePath),'utf8'), input=JSON.parse(sourceText); const migration=migrateLegacyOwnerExecution(input,contract(),fileDigest(sourceText)); const directory=path.join(ROOT,'evidence/lp18812'), migrationPath=path.join(directory,'wave0-owner-execution-migration.json'); fs.mkdirSync(directory,{recursive:true}); writeMigrationOnce(migration,migrationPath); fs.writeFileSync(path.join(directory,'wave0-result.json'),canonical(reconcile(input,contract(),migration))); }
