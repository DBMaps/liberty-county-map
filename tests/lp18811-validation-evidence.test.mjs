import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { build, ingest, stableJson, EVIDENCE_SCHEMA, WAVE } from '../tools/lp18811/ingest-validation-evidence.mjs';

const root = new URL('../', import.meta.url);
const json = async p => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const sha = async p => createHash('sha256').update(await readFile(new URL(p, root))).digest('hex');
const protectedFiles = ['js/app.js','assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json','data/lp150/candidate-membership-contract.json','reports/lp1885/community-package-identity-inventory.json','reports/lp18810/owner-membership-decision.json'];
const fixtures = async () => ({ matrix: await json('reports/lp18810/county-membership-validation-matrix.json'), identities: await json('reports/lp1885/community-package-identity-inventory.json') });
const document = (pkg, overrides={}) => ({ schemaVersion:EVIDENCE_SCHEMA,waveId:WAVE,environmentClassification:'OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION',productionDeployment:false,productionActivation:false,results:[{countyFips:pkg.countyFips,packageSha256:pkg.sha256,schemaVersion:pkg.schemaVersion,executionStatus:'ATTEMPTED',deploymentResult:'PASS',runtimeResult:'PASS',regressionResult:'PASS',consumerResult:'PASS',boundaryResult:'PASS',telemetryResult:'PASS',rollbackResult:'PASS',operationalResult:'PASS',evidenceReferences:Object.fromEntries(['deployment','runtime','regression','consumer','boundary','telemetry','rollback','operational'].map(x=>[x,`portable/${x}.json`])),executor:{status:'PRESENT',identityReference:'owner-controlled-reference'},independentReview:{status:'COMPLETE',reviewerReference:'independent-reference'},...overrides}]});

test('pending reconciliation preserves exact scope, baselines, blockers, and non-activation boundary', async () => {
  const f=await fixtures(), made=ingest({...f,evidenceDocuments:[]}), baseline=await json('reports/lp1888/statewide-county-activation-readiness.json');
  assert.equal(made.matrix.records.length,215); assert.ok(made.matrix.records.every((r,i,a)=>(!i||a[i-1].countyFips<r.countyFips)&&r.membershipApproved&&r.deploymentPrepared&&r.executionAuthorized&&!r.deploymentConfirmed&&!r.runtimeValidated&&r.blockingReasons.length&&r.activationStatus==='NOT_ACTIVATED'));
  const operational=new Set(baseline.records.filter(r=>r.currentOperationalStatus==='ALREADY_OPERATIONAL').map(r=>r.countyFips)), restricted=new Set(baseline.records.filter(r=>r.restrictionStatus==='ACTIVE_PRESERVED').map(r=>r.countyFips));
  assert.equal(operational.size,28); assert.equal(restricted.size,11); assert.ok(made.matrix.records.every(r=>!operational.has(r.countyFips)&&!restricted.has(r.countyFips)));
  assert.deepEqual([made.summary.executionAttemptedCount,made.summary.executionPendingCount,made.summary.executionFailureCount,made.summary.currentOperationalCount,made.summary.restrictedCountyCount,made.summary.newActivatedCount,made.summary.runtimeOperationalCountChanged,made.summary.restrictedCountyStateChanged],[0,215,0,28,11,0,false,false]);
  assert.equal(made.summary.potentialOperationalCountAfterSeparateAuthorizationAndActivation,28);
});

test('real evidence remains county-specific and structural eligibility is not activation authority', async()=>{
  const f=await fixtures(), pkg=f.identities.packages.find(p=>p.countyFips===f.matrix.records[0].countyFips), made=ingest({...f,evidenceDocuments:[document(pkg)]});
  assert.equal(made.summary.executionAttemptedCount,1); assert.equal(made.summary.executionPendingCount,214); assert.equal(made.summary.structurallyActivationEligibleCount,1); assert.equal(made.summary.potentialOperationalCountAfterSeparateAuthorizationAndActivation,29);
  assert.equal(made.matrix.records[0].structuralActivationEligibility,true); assert.equal(made.matrix.records[0].finalActivationAuthorizationStatus,'REQUIRED_NOT_AUTHORIZED'); assert.equal(made.matrix.records[0].activationStatus,'NOT_ACTIVATED'); assert.equal(made.matrix.records[1].structuralActivationEligibility,false);
});

test('wrong FIPS, SHA, schema, duplicate, production, missing, and contradictory evidence fail closed', async()=>{
  const f=await fixtures(), pkg=f.identities.packages.find(p=>p.countyFips===f.matrix.records[0].countyFips), run=d=>ingest({...f,evidenceDocuments:[d]});
  assert.throws(()=>run(document(pkg,{countyFips:'48999'})),/unknown FIPS/); assert.throws(()=>run(document(pkg,{packageSha256:'0'.repeat(64)})),/SHA-256/); assert.throws(()=>run(document(pkg,{schemaVersion:'wrong'})),/package schema/);
  assert.throws(()=>ingest({...f,evidenceDocuments:[document(pkg),document(pkg)]}),/duplicate/); assert.throws(()=>run({...document(pkg),environmentClassification:'PRODUCTION'}),/protected non-production/); assert.throws(()=>run(document(pkg,{runtimeResult:undefined})),/runtime evidence/); assert.throws(()=>run(document(pkg,{deploymentResult:'FAIL'})),/contradictory/);
});

test('approval and execution authorization are mandatory and authorization/preparation never imply execution', async()=>{
  const f=await fixtures(), pkg=f.identities.packages.find(p=>p.countyFips===f.matrix.records[0].countyFips);
  const noApproval=structuredClone(f); noApproval.matrix.records[0].ownerMembershipDecision='PENDING'; assert.throws(()=>ingest({...noApproval,evidenceDocuments:[document(pkg)]}),/authorization absent/);
  const noExecution=structuredClone(f); noExecution.matrix.records[0].nonProductionExecutionAuthorization='NOT_AUTHORIZED'; assert.throws(()=>ingest({...noExecution,evidenceDocuments:[]}),/authorization absent/);
  const pending=ingest({...f,evidenceDocuments:[]});
  assert.ok(pending.matrix.records.every(r=>r.deploymentPrepared&&!r.deploymentConfirmed&&!r.runtimeValidated));
});

test('failed evidence has explicit blockers and does not leak PASS across counties', async()=>{
  const f=await fixtures(), pkg=f.identities.packages.find(p=>p.countyFips===f.matrix.records[0].countyFips), failed=document(pkg,{executionStatus:'FAILED',deploymentResult:'FAIL',runtimeResult:'NOT_RUN',regressionResult:'NOT_RUN',consumerResult:'NOT_RUN',boundaryResult:'NOT_RUN',telemetryResult:'NOT_RUN',rollbackResult:'NOT_RUN',operationalResult:'NOT_RUN',executor:{status:'ABSENT'},independentReview:{status:'PENDING'}}), made=ingest({...f,evidenceDocuments:[failed]});
  assert.equal(made.summary.executionFailureCount,1); assert.ok(made.matrix.records.every(r=>r.blockingReasons.length)); assert.equal(made.summary.deploymentConfirmedCount,0);
});

test('build is byte deterministic and does not mutate runtime, awareness, Supabase, packages, or geometry', async()=>{
  const before=await Promise.all(protectedFiles.map(sha)); assert.equal(stableJson(build()),stableJson(build())); assert.deepEqual(await Promise.all(protectedFiles.map(sha)),before);
  const source=await readFile(new URL('tools/lp18811/ingest-validation-evidence.mjs',root),'utf8'); assert.doesNotMatch(source,/defaultAwarenessAreas|supabase\.from|manufacture|Census/);
});

test('owner invocation preserves every non-production authorization boundary', async()=>{
  const source=await readFile(new URL('tools/lp18811/invoke-owner-validation.ps1',root),'utf8');
  for (const guard of ['--no-production-deployment','--no-activation','--no-public-launch','--no-supabase-production-mutation','--no-restriction-clearing','--no-runtime-operational-membership-mutation']) assert.match(source,new RegExp(guard));
  assert.match(source,/tools\/lp18811\/protected-validation-harness\.mjs/);
  assert.match(source,/GRIDLY_VALIDATOR_ACCESS_CLIENT_SECRET/);
  assert.match(source,/OWNER_CONTROLLED_PROTECTED_NON_PRODUCTION/);
});
