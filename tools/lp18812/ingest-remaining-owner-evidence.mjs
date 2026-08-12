#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isDirectExecution } from './verify-certified-artifacts.mjs';
import { contract, reconcile, validateMigration } from './statewide-validation-closure.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const FIXTURE_PATH='reports/lp18812/wave0-remaining-fixture-contract.json';
export const DEFAULT_ARTIFACT_PATH='evidence/lp18812/wave0-certified-artifact-owner.local.json';
export const DEFAULT_RUNTIME_PATH='evidence/lp18812/wave0-remaining-runtime-owner.local.json';
export const DEFAULT_RECEIPT_PATH='evidence/lp18812/wave0-remaining-owner-ingestion.local.json';
export const DEFAULT_RESULT_PATH='evidence/lp18812/wave0-final-result.local.json';
const parse=p=>JSON.parse(fs.readFileSync(path.resolve(ROOT,p),'utf8'));
const digestBytes=p=>`sha256:${crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT,p))).digest('hex')}`;
const canonical=v=>`${JSON.stringify(v,null,2)}\n`;
const expectedContractDigest=()=>digestBytes(FIXTURE_PATH);
// Execution B was completed against the immutable pre-repair contract. Its
// non-artifact fixtures are unchanged; only Execution A's cohort was repaired.
export const COMPLETED_RUNTIME_CONTRACT_DIGEST='sha256:a18c93ab2100c91a9d200244615b768d558fbaac92eb809f199d419a693481a6';
const families=['CERTIFIED_ARTIFACT_STABILITY','COUNTY_BOUNDARY_ISOLATION','CONSUMER_RESULT_STABILITY','FALLBACK_BEHAVIOR_STABILITY','ROUTE_AWARENESS_STABILITY'];

export function validateRemainingEvidence(artifact,runtime,fixtureContract=parse(FIXTURE_PATH)) {
  if(artifact.fixtureContractDigest!==expectedContractDigest()||![expectedContractDigest(),COMPLETED_RUNTIME_CONTRACT_DIGEST].includes(runtime.fixtureContractDigest)) throw Error('remaining_fixture_contract_digest_mismatch');
  if(artifact.schemaVersion!=='gridly.lp18812.certified-artifact-owner-execution.v1'||runtime.schemaVersion!=='gridly.lp18812.remaining-runtime-owner-execution.v1') throw Error('owner_evidence_schema_mismatch');
  if(artifact.failures!==0||runtime.failures!==0||runtime.openS1!==0||runtime.openS2!==0||artifact.productionMutationObserved!==false||runtime.productionMutationObserved!==false||artifact.activationObserved!==false||runtime.activationObserved!==false) throw Error('owner_evidence_fail_closed_gate_failed');
  const observations=[...artifact.observations,...runtime.observations], expected=fixtureContract.fixtures;
  if(observations.length!==expected.length||new Set(observations.map(x=>x.fixtureId)).size!==expected.length) throw Error('owner_evidence_fixture_scope_mismatch');
  for(const fixture of expected) { const row=observations.find(x=>x.fixtureId===fixture.fixtureId); if(!row||row.assertionId!==fixture.assertionId||row.passed!==true) throw Error(`owner_evidence_fixture_failed:${fixture.fixtureId}`); }
  const outcomes=[...artifact.assertionOutcomes,...runtime.assertionOutcomes];
  if(outcomes.length!==5||families.some(id=>!outcomes.some(x=>x.assertionId===id&&x.outcome==='PASS'&&x.executed===true&&x.evidenceChecks?.length===expected.filter(f=>f.assertionId===id).length&&x.evidenceChecks.every(c=>c.passed===true&&observations.some(o=>o.fixtureId===c.fixtureId&&c.evidenceReference===`observations#${c.fixtureId}`))))) throw Error('owner_evidence_outcome_not_supported');
  const forbidden=/CF-Access-Client|GRIDLY_VALIDATOR|client.?secret|responseBody|requestHeaders/i;
  if(forbidden.test(JSON.stringify({artifact,runtime}))) throw Error('owner_evidence_contains_forbidden_material');
  return outcomes;
}
export function ingestRemainingEvidence({artifactPath=DEFAULT_ARTIFACT_PATH,runtimePath=DEFAULT_RUNTIME_PATH,receiptPath=DEFAULT_RECEIPT_PATH,resultPath=DEFAULT_RESULT_PATH,migrationPath='evidence/lp18812/wave0-owner-execution-migration.json',partialPath='evidence/lp18812/wave0-partial-result.json'}={}) {
  const artifact=parse(artifactPath),runtime=parse(runtimePath), outcomes=validateRemainingEvidence(artifact,runtime);
  const receipt={schemaVersion:'gridly.lp18812.remaining-owner-ingestion.v1',fixtureContractDigest:expectedContractDigest(),sourceDigests:{certifiedArtifactEvidence:digestBytes(artifactPath),remainingRuntimeEvidence:digestBytes(runtimePath)},assertionOutcomes:outcomes};
  const receiptFile=path.resolve(ROOT,receiptPath), serialized=canonical(receipt); fs.mkdirSync(path.dirname(receiptFile),{recursive:true});
  if(fs.existsSync(receiptFile)&&fs.readFileSync(receiptFile,'utf8')!==serialized) throw Error('different_remaining_owner_evidence_already_ingested');
  if(!fs.existsSync(receiptFile)) fs.writeFileSync(receiptFile,serialized,{flag:'wx',mode:0o600});
  const migration=parse(migrationPath);
  if(!migration.assertionOutcomes?.some(x=>x.assertionId==='OPERATIONAL_COUNTY_RESULT_STABILITY'&&x.outcome==='PASS')) throw Error('migrated_operational_outcome_missing');
  const c=contract(), partial=parse(partialPath); validateMigration(partial,migration,c);
  const input={...partial,assertionOutcomes:[...outcomes,...migration.assertionOutcomes]};
  const result=reconcile(input,c); fs.writeFileSync(path.resolve(ROOT,resultPath),canonical(result),{mode:0o600}); return result;
}
if(isDirectExecution(import.meta.url,process.argv[1])){try{const result=ingestRemainingEvidence({artifactPath:process.argv[2]||DEFAULT_ARTIFACT_PATH,runtimePath:process.argv[3]||DEFAULT_RUNTIME_PATH}); console.log(`LP188.12 remaining evidence reconciled: ${result.wave0Result}`);}catch(error){console.error(`LP188.12 remaining evidence rejected: ${error.message}`);process.exitCode=1;}}
