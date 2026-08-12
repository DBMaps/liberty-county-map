#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const APPROVED_ASSERTIONS = Object.freeze(['CERTIFIED_ARTIFACT_STABILITY','OPERATIONAL_COUNTY_RESULT_STABILITY','COUNTY_BOUNDARY_ISOLATION','CONSUMER_RESULT_STABILITY','FALLBACK_BEHAVIOR_STABILITY','ROUTE_AWARENESS_STABILITY']);
export const COMPLETED_DIMENSIONS = Object.freeze(['deployment','runtime','boundary']);
export const MUTATING_METHODS = Object.freeze(['POST','PUT','PATCH','DELETE']);
export const SECRET_NAMES = Object.freeze(['GRIDLY_VALIDATOR_ACCESS_CLIENT_ID','GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET']);
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const canonical = (v) => `${JSON.stringify(v,null,2)}\n`;
export const digest = (v) => `sha256:${crypto.createHash('sha256').update(canonical(v)).digest('hex')}`;
export function contract() {
  const wave = read('reports/lp18811f2/wave0-authority-contract.json');
  const fixtures = read('reports/lp18811f4/wave0-fixture-authority.json');
  const defect = read('reports/lp18811f2/defect-inventory.json');
  const env = read('reports/lp18811c/protected-environment-provisioning.json');
  const statewide = read('reports/lp18811e/remaining-validation-matrix.json');
  const exactFips = wave.exactFipsScope || wave.fipsScope;
  return Object.freeze({ schemaVersion:'gridly.lp18812.closure-contract.v1', milestone:'LP188.12', target:{ classification:'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION', url:env.selectedEnvironment.rootUrl, deploymentId:env.infrastructureAudit.existingDeploymentId, buildIdentity:env.selectedEnvironment.buildIdentity }, exactWave0Fips:exactFips, assertions:APPROVED_ASSERTIONS, governedFixtures:fixtures.priorFixtures, wave0ContractDigest:digest(wave), defectInventoryDigest:digest(defect), statewideFips:statewide.records.map(x=>x.countyFips).sort(), completedDimensionsNotToRerun:COMPLETED_DIMENSIONS, network:{ allowedMethods:['GET','HEAD','OPTIONS'], rejectedMethods:MUTATING_METHODS }, state:{currentOperationalCount:28,restrictedCountyCount:11,newActivatedCount:0}, authorization:{production:false,activation:false,mutation:false} });
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
export function reconcile(input,c=contract()) {
  const seen=[...new Set(input.results?.map(x=>x.fips) || [])].sort();
  const families=[...new Set(input.results?.flatMap(x=>x.assertions || []) || [])].sort();
  const pass=JSON.stringify(seen)===JSON.stringify([...c.exactWave0Fips].sort()) && APPROVED_ASSERTIONS.every(x=>families.includes(x)) && input.failures===0 && input.openS1===0 && input.openS2===0 && input.productionMutationObserved===false && input.activationObserved===false;
  return {...sanitize(input),schemaVersion:'gridly.lp18812.wave0-result.v1',contractDigest:digest(c),wave0Result:pass?'PASS':'FAIL'};
}
if(process.argv[2]==='contract') process.stdout.write(canonical(contract()));
if(process.argv[2]==='reconcile') { const input=read(process.argv[3] || 'evidence/lp18812/wave0-result.input.json'); fs.mkdirSync(path.join(ROOT,'evidence/lp18812'),{recursive:true}); fs.writeFileSync(path.join(ROOT,'evidence/lp18812/wave0-result.json'),canonical(reconcile(input))); }
