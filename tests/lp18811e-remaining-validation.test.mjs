import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {generate,REQUIREMENTS,stableJson} from '../tools/lp18811/prepare-remaining-validation.mjs';

const root=new URL('../',import.meta.url), json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const digest=async p=>createHash('sha256').update(await readFile(new URL(p,root))).digest('hex');
const protectedFiles=['evidence/lp18811/execution-results/owner-result.json','reports/lp1885/community-package-identity-inventory.json','js/app.js','assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json','data/lp150/candidate-membership-contract.json'];

test('preserves real successful evidence and exact non-activation baseline',async()=>{
 const before=await Promise.all(protectedFiles.map(digest)), made=generate(), owner=await json('evidence/lp18811/execution-results/owner-result.json');
 assert.equal(owner.results.length,215); assert.ok(owner.results.every(r=>r.deploymentResult==='PASS'&&r.runtimeResult==='PASS'&&r.boundaryResult==='PASS'));
 assert.equal(made.matrix.records.length,215); assert.equal(new Set(made.matrix.records.map(r=>r.countyFips)).size,215);
 assert.deepEqual([made.summary.deploymentConfirmedCount,made.summary.runtimeValidatedCount,made.summary.boundaryValidatedCount],[215,215,215]);
 assert.deepEqual([made.summary.currentOperationalCount,made.summary.restrictedCountyCount,made.summary.newActivatedCount],[28,11,0]);
 assert.equal(made.summary.runtimeOperationalCountChanged,false); assert.equal(made.summary.restrictedCountyStateChanged,false);
 assert.ok(made.matrix.records.every(r=>!r.structuralActivationEligibility&&r.finalActivationAuthorizationStatus==='REQUIRED_NOT_AUTHORIZED'&&r.activationStatus==='NOT_ACTIVATED'));
 assert.deepEqual(await Promise.all(protectedFiles.map(digest)),before);
});

test('all remaining requirements are governed, explicit, and fail closed',()=>{
 const made=generate();
 assert.deepEqual(Object.keys(REQUIREMENTS),['regression','consumer','telemetry','rollback','operational','independentReview']);
 assert.match(REQUIREMENTS.regression.requirement,/read-only|read only/i); assert.match(REQUIREMENTS.consumer.requirement,/county-specific/);
 assert.match(REQUIREMENTS.telemetry.requirement,/error, latency\/load, alert and availability/); assert.match(REQUIREMENTS.rollback.requirement,/protected-only withdrawal and restore/);
 assert.match(REQUIREMENTS.operational.requirement,/After regression, consumer, telemetry, and rollback pass/);
 assert.match(REQUIREMENTS.independentReview.requirement,/other than the executor/);
 assert.ok(made.matrix.records.every(r=>r.remainingBlockers.length===7&&r.nextRequiredAction.includes('READ_ONLY_PROTECTED_REGRESSION')));
});

test('wave artifacts retain exact FIPS applicability and never fabricate observation or review',()=>{
 const made=generate(), expected=made.matrix.records.map(r=>r.countyFips);
 for(const [name,a] of Object.entries(made.templates)){assert.deepEqual(a.applicableFips,expected,name);assert.equal(a.productionMutationObserved,false);assert.equal(a.activationObserved,false);if(a.artifactType==='OWNER_OBSERVATION'){assert.equal(a.outcome,'NOT_OBSERVED');assert.equal(a.evidenceReference,null);assert.equal(a.observerReference,null);}else{assert.equal(a.outcome,'NOT_REVIEWED');assert.equal(a.reviewerReference,null);assert.notEqual(a.executorReference,a.reviewerReference);}}
 assert.equal(made.summary.ownerObservationRequiredCount,215);assert.equal(made.summary.externalExecutionRequiredCount,215);assert.equal(made.summary.independentReviewRequiredCount,215);
});

test('complete evidence digest binds wave, deployment, build, exact packages and authoritative evidence',async()=>{
 const a=generate(),b=generate(),d=a.evidenceDigest;
 assert.equal(stableJson(a),stableJson(b)); assert.equal(d.waveId,'LP18810-NP-001');assert.ok(d.deploymentId&&d.buildIdentity);assert.equal(d.applicableFips.length,215);assert.equal(d.packages.length,215);
 assert.equal(d.executionEvidence.sha256,await digest('evidence/lp18811/execution-results/owner-result.json'));assert.match(d.validationEvidenceSha256,/^[a-f0-9]{64}$/);assert.match(d.completeEvidenceSetSha256,/^[a-f0-9]{64}$/);
});

test('generator source cannot redeploy, activate, rewrite packages, or mutate production',async()=>{
 const source=await readFile(new URL('tools/lp18811/prepare-remaining-validation.mjs',root),'utf8');
 assert.doesNotMatch(source,/fetch\(|supabase\.from|defaultAwarenessAreas|GRIDLY_COUNTY_REGISTRY|writeFileSync\([^\n]*(counties|owner-result)/);
});
