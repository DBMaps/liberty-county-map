#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as buildLp18811, stableJson, WAVE } from './ingest-validation-evidence.mjs';
export { stableJson } from './ingest-validation-evidence.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SCHEMA = 'gridly.lp18811e.remaining-validation.v1';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = (root, file) => fs.readFileSync(path.join(root, file));

export const REQUIREMENTS = Object.freeze({
  regression: { classification: 'AUTOMATABLE_WITH_EXISTING_PROTECTED_ENVIRONMENT', scope: 'EXACT_WAVE_WITH_PER_FIPS_RESULTS', requirement: 'Run the established regression assertions read-only against the existing protected deployment, compare with the Wave 0 control, record assertions executed/passed and zero open severity-1/2 defects; do not redeploy or repeat package-byte/runtime/boundary proof.' },
  consumer: { classification: 'OWNER_OBSERVATION_REQUIRED', scope: 'COUNTY_SPECIFIC_RESULTS_MAY_SHARE_ONE_WAVE_ARTIFACT', requirement: 'Record executed county-specific approved-user consumer behavior for discovery/search, community and awareness presentation, location/package context, fallback/error handling, and restricted-county non-leakage; an untested statewide inference is forbidden.' },
  telemetry: { classification: 'OWNER_OBSERVATION_REQUIRED', scope: 'EXACT_WAVE_MAY_SHARE_ONE_OBSERVATION', requirement: 'Inspect protected-environment error, latency/load, alert and availability signals for the governed execution and compare them with the Wave 0 control; record signal references and threshold outcomes.' },
  rollback: { classification: 'OWNER_OBSERVATION_REQUIRED', scope: 'EXACT_WAVE_MAY_SHARE_ONE_REVERSIBILITY_ARTIFACT', requirement: 'Prove the protected-only withdrawal and restore procedure, change/rollback plan, and production isolation. Do not perform a production rollback and do not discard the successful execution evidence.' },
  operational: { classification: 'OWNER_OBSERVATION_REQUIRED', scope: 'COUNTY_SPECIFIC_RESULTS_MAY_SHARE_ONE_WAVE_ARTIFACT', requirement: 'After regression, consumer, telemetry, and rollback pass, record operational-owner, runbook, alert, support, sustained observation, and Wave 0 comparison evidence.' },
  independentReview: { classification: 'INDEPENDENT_REVIEW_REQUIRED', scope: 'ONE_EXACT_WAVE_REVIEW_PERMITTED', requirement: 'A reviewer other than the executor must review the complete identity-bound evidence set and record PASS/REJECTED, reviewer reference and review time; the executor and harness cannot self-certify.' }
});

function observationTemplate(dimension, fips, deployment) {
  return { schemaVersion: SCHEMA, artifactType: 'OWNER_OBSERVATION', waveId: WAVE,
    applicableFips: fips, deploymentId: deployment.deploymentId, buildIdentity: deployment.expectedBuildIdentity,
    dimension, outcome: 'NOT_OBSERVED', evidenceReference: null, observerReference: null,
    productionMutationObserved: false, activationObserved: false };
}

export function generate(root = ROOT) {
  const current = buildLp18811(root), ownerPath = 'evidence/lp18811/execution-results/owner-result.json';
  const ownerBytes = read(root, ownerPath), owner = JSON.parse(ownerBytes);
  const records = current.matrix.records;
  if (records.length !== 215 || records.some(r => !r.deploymentConfirmed || !r.runtimeValidated || !r.boundaryValidated)) throw Error('authoritative 215-county protected baseline is incomplete');
  const fips = records.map(r => r.countyFips), packages = records.map(r => ({ countyFips:r.countyFips, packageSha256:r.packageSha256 }));
  const validationState = records.map(r => ({countyFips:r.countyFips,packageSha256:r.packageSha256,deploymentConfirmed:r.deploymentConfirmed,runtimeValidated:r.runtimeValidated,boundaryValidated:r.boundaryValidated,regressionValidated:r.regressionValidated,consumerValidated:r.consumerValidated,telemetryValidated:r.telemetryValidated,rollbackValidated:r.rollbackValidated,operationallyValidated:r.operationallyValidated}));
  const evidenceDigest = { schemaVersion: SCHEMA, waveId: WAVE, deploymentId: owner.deploymentIdentity.deploymentId,
    buildIdentity: owner.deploymentIdentity.expectedBuildIdentity, applicableFips:fips, packages,
    executionEvidence:{path:ownerPath,sha256:sha(ownerBytes)}, validationEvidenceSha256:sha(stableJson(validationState)) };
  evidenceDigest.completeEvidenceSetSha256 = sha(stableJson(evidenceDigest));
  const blockers = ['REGRESSION_VALIDATION_NOT_RUN','CONSUMER_VALIDATION_NOT_RUN','TELEMETRY_VALIDATION_NOT_RUN','ROLLBACK_VALIDATION_NOT_RUN','OPERATIONAL_VALIDATION_NOT_RUN','INDEPENDENT_REVIEW_INCOMPLETE','FINAL_ACTIVATION_OWNER_AUTHORIZATION_ABSENT'];
  const matrix = {schemaVersion:SCHEMA,milestone:'LP188.11E',waveId:WAVE,records:records.map(r=>({
    countyFips:r.countyFips,packageSha256:r.packageSha256,deploymentConfirmed:r.deploymentConfirmed,runtimeValidated:r.runtimeValidated,boundaryValidated:r.boundaryValidated,
    regressionValidated:r.regressionValidated,consumerValidated:r.consumerValidated,telemetryValidated:r.telemetryValidated,rollbackValidated:r.rollbackValidated,operationallyValidated:r.operationallyValidated,independentReviewStatus:r.independentReviewStatus,
    structuralActivationEligibility:false,finalActivationAuthorizationStatus:'REQUIRED_NOT_AUTHORIZED',activationStatus:'NOT_ACTIVATED',remainingBlockers:blockers,nextRequiredAction:'RUN_READ_ONLY_PROTECTED_REGRESSION_THEN_CAPTURE_OWNER_OBSERVATIONS_AND_INDEPENDENT_REVIEW'
  }))};
  const summary={...current.summary,schemaVersion:SCHEMA,milestone:'LP188.11E',ownerObservationRequiredCount:215,externalExecutionRequiredCount:215,independentReviewRequiredCount:215,potentialOperationalCountAfterSeparateFinalAuthorization:current.summary.potentialOperationalCountAfterSeparateAuthorizationAndActivation,overallClassification:'REMAINING_PROTECTED_VALIDATION_AND_INDEPENDENT_REVIEW_EVIDENCE_REQUIRED_NO_ACTIVATION'};
  const templates={}; for(const d of ['regression','consumer','telemetry','rollback','operational']) templates[`${d}-observation.template.json`]=observationTemplate(d,fips,owner.deploymentIdentity);
  templates['independent-review.template.json']={schemaVersion:SCHEMA,artifactType:'INDEPENDENT_REVIEW',waveId:WAVE,applicableFips:fips,deploymentId:owner.deploymentIdentity.deploymentId,buildIdentity:owner.deploymentIdentity.expectedBuildIdentity,evidenceSetSha256:evidenceDigest.completeEvidenceSetSha256,outcome:'NOT_REVIEWED',reviewerReference:null,executorReference:owner.results[0].executor.identityReference,reviewedAt:null,productionMutationObserved:false,activationObserved:false};
  return {matrix,summary,requirements:{schemaVersion:SCHEMA,milestone:'LP188.11E',waveId:WAVE,requirements:REQUIREMENTS},evidenceDigest,templates};
}
export function write(root=ROOT,out=path.join(root,'reports/lp18811e')){const made=generate(root);fs.mkdirSync(out,{recursive:true});for(const [name,key] of [['remaining-validation-matrix.json','matrix'],['lp18811e-summary.json','summary'],['governed-requirements.json','requirements'],['evidence-set-digest.json','evidenceDigest']])fs.writeFileSync(path.join(out,name),stableJson(made[key]));const td=path.join(root,'evidence/lp18811/remediation-templates');fs.mkdirSync(td,{recursive:true});for(const [name,value] of Object.entries(made.templates))fs.writeFileSync(path.join(td,name),stableJson(value));return made;}
export function verify(root=ROOT){const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lp18811e-'));try{const a=path.join(tmp,'a'),b=path.join(tmp,'b');write(root,a);write(root,b);for(const f of fs.readdirSync(a))if(!fs.readFileSync(path.join(a,f)).equals(fs.readFileSync(path.join(b,f))))throw Error(`nondeterministic ${f}`);const committed=path.join(root,'reports/lp18811e');for(const f of fs.readdirSync(a))if(!fs.readFileSync(path.join(a,f)).equals(fs.readFileSync(path.join(committed,f))))throw Error(`committed mismatch ${f}`);}finally{fs.rmSync(tmp,{recursive:true,force:true});}}
if(process.argv[1]===fileURLToPath(import.meta.url)){if(process.argv[2]==='build')write();else if(process.argv[2]==='verify')verify();else throw Error('usage: <build|verify>');process.stdout.write(stableJson(generate().summary));}
