#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVIDENCE_SCHEMA, PACKAGE_SCHEMA, WAVE, stableJson } from './ingest-validation-evidence.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const ENVIRONMENT = 'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION';
export const DIMENSION_CLASSIFICATION = Object.freeze({
  deployment: 'AUTOMATABLE', runtime: 'AUTOMATABLE', regression: 'EXTERNAL_ENVIRONMENT_REQUIRED',
  consumer: 'OWNER_OBSERVATION_REQUIRED', boundary: 'AUTOMATABLE', telemetry: 'OWNER_OBSERVATION_REQUIRED',
  rollback: 'OWNER_OBSERVATION_REQUIRED', operational: 'OWNER_OBSERVATION_REQUIRED',
  executorEvidence: 'OWNER_OBSERVATION_REQUIRED', independentReview: 'INDEPENDENT_REVIEW_REQUIRED'
});
const SECRET = /(authorization|cookie|bearer|client[_-]?secret|access[_-]?token|api[_-]?key|password)/i;
const REQUIRED = ['wave','county-fips','environment','repository-root','evidence-output','protected-url','deployment-id','expected-build-identity','executor-identity-reference'];
const BOUNDARIES = ['no-production-deployment','no-activation','no-public-launch','no-supabase-production-mutation','no-restriction-clearing','no-runtime-operational-membership-mutation'];

export function parseArguments(argv) {
  const values = {}, flags = new Set();
  for (let i=0;i<argv.length;i++) {
    const token=argv[i]; if (!token.startsWith('--')) throw Error(`unexpected argument ${token}`);
    const key=token.slice(2); if (BOUNDARIES.includes(key)) { flags.add(key); continue; }
    if (!REQUIRED.includes(key) || i+1>=argv.length || argv[i+1].startsWith('--')) throw Error(`unsupported or missing argument --${key}`);
    values[key]=argv[++i];
  }
  for (const key of REQUIRED) if (!values[key]) throw Error(`missing --${key}`);
  for (const flag of BOUNDARIES) if (!flags.has(flag)) throw Error(`missing --${flag}`);
  if (values.wave!==WAVE) throw Error('wrong governed wave');
  if (values.environment!==ENVIRONMENT || /production/i.test(values.environment.replace('NON_PRODUCTION',''))) throw Error('protected non-production environment required');
  if (!/^https:\/\//.test(values['protected-url'])) throw Error('protected URL must use HTTPS');
  return {values,flags};
}

export function governedInputs(root=ROOT) {
  const wave=JSON.parse(fs.readFileSync(path.join(root,'reports/lp18810/validation-waves.json'),'utf8')).waves;
  const identities=JSON.parse(fs.readFileSync(path.join(root,'reports/lp1885/community-package-identity-inventory.json'),'utf8')).packages;
  if (wave.length!==1 || wave[0].waveId!==WAVE || wave[0].countyCount!==215 || wave[0].countyFips.length!==215) throw Error('governed wave is not exact');
  const identity=new Map(identities.map(row=>[row.countyFips,row]));
  const packages=wave[0].countyFips.map(fips=>identity.get(fips));
  if (packages.some(x=>!x?.sha256 || x.schemaVersion!==PACKAGE_SCHEMA)) throw Error('mandatory LP188.5 package SHA-256 identity absent');
  return {fips:wave[0].countyFips,packages};
}

export function validateScope(csv, governed) {
  const supplied=csv.split(',');
  if (supplied.length!==215 || supplied.some((x,i)=>x!==governed[i])) throw Error('scope must be the exact 215 approved FIPS in governed order');
}

export function safeEvidence(value) {
  const text=JSON.stringify(value); if (SECRET.test(text)) throw Error('secret-shaped material rejected from portable evidence'); return value;
}

export async function execute(options, {fetchImpl=globalThis.fetch, env=process.env, packageDigest=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex')}={}) {
  const {values}=parseArguments(options), root=path.resolve(values['repository-root']);
  if (root!==path.resolve(root) || !fs.existsSync(path.join(root,'package.json'))) throw Error('invalid repository root');
  const governed=governedInputs(root); validateScope(values['county-fips'],governed.fips);
  const id=env.GRIDLY_VALIDATOR_ACCESS_CLIENT_ID, secret=env.GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET;
  if (!id || !secret) throw Error('GRIDLY_VALIDATOR_ACCESS_CLIENT_ID and GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET are required');
  const headers={'CF-Access-Client-Id':id,'CF-Access-Client-Secret':secret};
  const base=values['protected-url'].replace(/\/$/,'');
  const identityResponse=await fetchImpl(`${base}/gridly-protected-build-identity.json`,{headers,redirect:'error'});
  if (!identityResponse.ok) throw Error(`protected build identity unavailable (${identityResponse.status})`);
  const deployedIdentity=await identityResponse.json();
  if (deployedIdentity.deploymentId!==values['deployment-id'] || deployedIdentity.buildIdentity!==values['expected-build-identity'] || deployedIdentity.environmentClassification!==ENVIRONMENT) throw Error('protected deployment/build identity mismatch');
  const rootResponse=await fetchImpl(`${base}/`,{headers,redirect:'error'});
  if (!rootResponse.ok) throw Error(`protected runtime unavailable (${rootResponse.status})`);
  const rootBytes=Buffer.from(await rootResponse.arrayBuffer());
  const results=[];
  for (const pkg of governed.packages) {
    const response=await fetchImpl(`${base}/${pkg.relativePackagePath}`,{headers,redirect:'error'});
    const bytes=response.ok?Buffer.from(await response.arrayBuffer()):null;
    const match=bytes && packageDigest(bytes,pkg)===pkg.sha256;
    const status=response.ok&&match?'PASS':'FAIL';
    results.push({countyFips:pkg.countyFips,packageSha256:pkg.sha256,schemaVersion:pkg.schemaVersion,executionStatus:status==='PASS'?'ATTEMPTED':'FAILED',deploymentResult:'PASS',runtimeResult:status,regressionResult:'NOT_RUN',consumerResult:'NOT_RUN',boundaryResult:status,telemetryResult:'NOT_RUN',rollbackResult:'NOT_RUN',operationalResult:'NOT_RUN',evidenceReferences:{deployment:`protected/${values['deployment-id']}/deployment.json`,runtime:`protected/${values['deployment-id']}/counties/${pkg.countyFips}.json`,boundary:`protected/${values['deployment-id']}/counties/${pkg.countyFips}.json`},executor:{status:'PRESENT',identityReference:values['executor-identity-reference']},independentReview:{status:'PENDING',reviewerReference:null}});
  }
  const evidence=safeEvidence({schemaVersion:EVIDENCE_SCHEMA,waveId:WAVE,environmentClassification:ENVIRONMENT,productionDeployment:false,productionActivation:false,deploymentIdentity:{deploymentId:values['deployment-id'],expectedBuildIdentity:values['expected-build-identity'],runtimeDocumentSha256:crypto.createHash('sha256').update(rootBytes).digest('hex')},dimensionClassification:DIMENSION_CLASSIFICATION,results});
  const output=path.resolve(root,values['evidence-output']); if (!output.startsWith(`${root}${path.sep}`)) throw Error('evidence output must remain inside repository');
  fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,stableJson(evidence)); return evidence;
}

if (process.argv[1]===fileURLToPath(import.meta.url)) execute(process.argv.slice(2)).then(x=>{process.stdout.write(`Protected validation evidence written for ${x.results.length} governed counties.\n`);}).catch(e=>{process.stderr.write(`${e.message}\n`);process.exitCode=1;});
