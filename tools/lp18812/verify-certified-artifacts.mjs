#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const OUTPUT_PATH='evidence/lp18812/wave0-certified-artifact-owner.local.json';
export const OVERALL_BUDGET_MS=120000;
const contract=()=>JSON.parse(fs.readFileSync(path.join(ROOT,'reports/lp18812/wave0-remaining-fixture-contract.json'),'utf8'));
const sha256=bytes=>`sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;

export function isDirectExecution(moduleUrl,argvPath,{platform=process.platform}={}) {
  if(!argvPath) return false;
  const pathApi=platform==='win32'?path.win32:path;
  let modulePath=fileURLToPath(moduleUrl);
  // fileURLToPath returns a native Windows path on Windows. The leading slash
  // adjustment keeps the platform-injected regression test representative when
  // it runs on a POSIX CI host.
  if(platform==='win32'&&/^\/[a-zA-Z]:\//.test(modulePath)) modulePath=modulePath.slice(1);
  const normalize=value=>pathApi.resolve(value).replaceAll('/',pathApi.sep);
  const expected=normalize(modulePath), actual=normalize(argvPath);
  return platform==='win32'?actual.toLowerCase()===expected.toLowerCase():actual===expected;
}

export function inspectArtifactResponse(fixture,response,bytes) {
  const type=String(response.headers?.get?.('content-type')||'').toLowerCase();
  const prefix=Buffer.from(bytes).subarray(0,512).toString('utf8').trimStart().toLowerCase();
  const authenticationHtml=type.includes('text/html')||prefix.startsWith('<!doctype html')||prefix.startsWith('<html')||/cloudflare access|cf-access/.test(prefix);
  const observedSha256=sha256(bytes), observedByteLength=bytes.byteLength;
  const statusMatched=response.status===fixture.expectedResult.httpStatus;
  const passed=response.redirected!==true&&!authenticationHtml&&observedByteLength>0&&statusMatched&&observedByteLength===fixture.expectedResult.byteLength&&observedSha256===fixture.expectedResult.sha256;
  return {fixtureId:fixture.fixtureId,assertionId:fixture.assertionId,countyFips:fixture.expectedResult.countyFips,protectedPathname:fixture.input.protectedRelativeUrl,status:response.status,observedByteLength,observedSha256,expectedByteLength:fixture.expectedResult.byteLength,expectedSha256:fixture.expectedResult.sha256,passed};
}

export async function executeArtifactVerification({env=process.env,fetchImpl=fetch,now=()=>new Date().toISOString()}={}) {
  for(const key of ['GRIDLY_PROTECTED_URL','GRIDLY_VALIDATOR_ACCESS_CLIENT_ID','GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET']) if(!env[key]) throw Error(`missing_${key}`);
  const base=new URL(env.GRIDLY_PROTECTED_URL), fixtureContract=contract(), fixtures=fixtureContract.fixtures.filter(x=>x.assertionId==='CERTIFIED_ARTIFACT_STABILITY');
  const governedFips=JSON.parse(fs.readFileSync(path.join(ROOT,'reports/lp18810/validation-waves.json'),'utf8')).waves[0].countyFips;
  if(fixtures.length!==governedFips.length||fixtures.some((fixture,index)=>fixture.expectedResult.countyFips!==governedFips[index])) throw Error('artifact_fixture_cohort_mismatch');
  const governedBase=new URL(JSON.parse(fs.readFileSync(path.join(ROOT,'reports/lp18811c/protected-environment-provisioning.json'),'utf8')).selectedEnvironment.rootUrl);
  if(base.origin!==governedBase.origin||!/preview/i.test(base.hostname)) throw Error('production_or_wrong_protected_origin');
  const controller=new AbortController(), timer=setTimeout(()=>controller.abort(Error('artifact_execution_budget_exceeded')),OVERALL_BUDGET_MS);
  const observations=[];
  try {
    for(const fixture of fixtures) {
      const url=new URL(fixture.input.protectedRelativeUrl,base);
      if(url.origin!==base.origin) throw Error('artifact_url_left_protected_origin');
      const response=await fetchImpl(url,{method:'GET',redirect:'manual',signal:controller.signal,headers:{'CF-Access-Client-Id':env.GRIDLY_VALIDATOR_ACCESS_CLIENT_ID,'CF-Access-Client-Secret':env.GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET}});
      const bytes=Buffer.from(await response.arrayBuffer());
      observations.push(inspectArtifactResponse(fixture,response,bytes));
    }
  } finally { clearTimeout(timer); }
  const passed=observations.length===fixtures.length&&observations.every(x=>x.passed);
  return {schemaVersion:'gridly.lp18812.certified-artifact-owner-execution.v1',executionId:'W0-REMAINING-ARTIFACT-BYTES',executedAt:now(),fixtureContractDigest:sha256(fs.readFileSync(path.join(ROOT,'reports/lp18812/wave0-remaining-fixture-contract.json'))),failures:observations.filter(x=>!x.passed).length,productionMutationObserved:false,activationObserved:false,observations,assertionOutcomes:[{assertionId:'CERTIFIED_ARTIFACT_STABILITY',outcome:passed?'PASS':'FAIL',executed:true,evidenceChecks:observations.map(x=>({fixtureId:x.fixtureId,passed:x.passed,evidenceReference:`observations#${x.fixtureId}`}))}]};
}

if(isDirectExecution(import.meta.url,process.argv[1])) {
  const output=path.join(ROOT,OUTPUT_PATH), temp=`${output}.tmp-${process.pid}`;
  try { const evidence=await executeArtifactVerification(); fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(temp,`${JSON.stringify(evidence,null,2)}\n`,{mode:0o600}); fs.renameSync(temp,output); if(evidence.failures) process.exitCode=1; }
  catch(error) { try{fs.unlinkSync(temp);}catch{} console.error(`LP188.12 artifact verification failed: ${error.message}`); process.exitCode=1; }
}
