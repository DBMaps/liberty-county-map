import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {ROOT, generate, validateWave0, validateTaxonomy, validateInventory, deriveCounts, digest, regressionPassAllowed} from '../tools/lp18811/govern-wave0-defects.mjs';
const clone = x => structuredClone(x);
const generated = () => generate(ROOT);
const ownerPath = `${ROOT}/evidence/lp18811/execution-results/owner-result.json`;
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('LP187 planning and LP132 control cannot masquerade as executed Wave 0', () => {
  const lp187 = JSON.parse(fs.readFileSync(`${ROOT}/reports/lp187/texas-activation-wave-plan.json`));
  const lp132 = {waveId:'WAVE_0', exactFipsScope:['48291']};
  assert.throws(() => validateWave0(lp187), /missing/);
  assert.throws(() => validateWave0(lp132), /missing/);
  assert.equal(generated()['wave0-authority-contract.json'].overallOutcome, 'NOT_EXECUTED');
});

test('Wave 0 requires exact scope, runtime/deployment identity, build identity, names and expected results', () => {
  const base = generated()['wave0-authority-contract.json'];
  for (const [mutate, pattern] of [
    [x => {x.exactFipsScope=[]}, /exact canonical FIPS/],
    [x => {x.runtimeDeploymentIdentity={}}, /runtime\/deployment/],
    [x => {x.buildIdentity='latest'}, /build identity/],
    [x => {x.assertions=[]}, /named assertions/],
    [x => {delete x.assertions[0].expectedResult}, /expectedResult/]
  ]) { const x=clone(base); mutate(x); assert.throws(()=>validateWave0(x),pattern); }
});

test('real executed outcomes are mandatory before PASS', () => {
  const x=clone(generated()['wave0-authority-contract.json']); x.overallOutcome='PASS';
  assert.throws(()=>validateWave0(x),/real executed outcomes/);
});

test('S1 and S2 taxonomy are deterministic and closed vocabulary', () => {
  const t=generated()['severity-taxonomy.json'];
  assert.equal(validateTaxonomy(t),true);
  assert.deepEqual(t.severities.map(x=>x.severity),['SEVERITY_1','SEVERITY_2']);
  assert.equal(digest(t),digest(clone(t)));
});

test('inventory rejects arbitrary severity and requires technical closure evidence', () => {
  const base=generated()['defect-inventory.json'];
  const record={defectId:'D-1',title:'supported',severity:'URGENT',status:'OPEN',scopeType:'WAVE',applicableFips:[],waveScope:['WAVE_0'],evidenceReference:'evidence/x',openedAuthority:'owner',technicalDisposition:'reproduced finding',blocksRegressionPass:true};
  let x=clone(base); x.defects=[record]; x.derivedCounts=deriveCounts(x.defects); assert.throws(()=>validateInventory(x),/severity/);
  x=clone(base); x.defects=[{...record,severity:'SEVERITY_1',status:'CLOSED'}]; x.derivedCounts=deriveCounts(x.defects); assert.throws(()=>validateInventory(x),/resolution evidence/);
});

test('open S1 and S2 independently block PASS and counts are derived', () => {
  const wave=clone(generated()['wave0-authority-contract.json']);
  wave.executedOutcomes=wave.assertions.map(a=>({assertionId:a.assertionId,outcome:'PASS',evidenceReference:'evidence/executed.json'})); wave.assertionTotals={executed:6,pass:6,fail:0}; wave.evidenceReferences=['evidence/executed.json']; wave.executorIdentityReference='evidence/executor.json'; wave.overallOutcome='PASS';
  for (const severity of ['SEVERITY_1','SEVERITY_2']) { const inv=clone(generated()['defect-inventory.json']); inv.completeness='COMPLETE'; inv.defects=[{defectId:'D-1',title:'supported',severity,status:'OPEN',scopeType:'WAVE',applicableFips:[],waveScope:['WAVE_0'],evidenceReference:'evidence/x',openedAuthority:'owner',technicalDisposition:'reproduced finding',blocksRegressionPass:true}]; inv.derivedCounts=deriveCounts(inv.defects); validateInventory(inv); assert.equal(regressionPassAllowed(wave,inv),false); assert.equal(inv.derivedCounts[severity==='SEVERITY_1'?'severity1OpenCount':'severity2OpenCount'],1); }
});

test('owner-approved technical review makes inventory counts authoritative only for its exact snapshot', () => {
  const files=generated(), inv=files['defect-inventory.json'], decision=files['owner-governance-decision.json']; validateInventory(inv);
  assert.equal(decision.wave0ScopeApproval,'OWNER_APPROVED'); assert.equal(decision.severityTaxonomyApproval,'OWNER_APPROVED');
  assert.equal(decision.defectInventoryCompletenessApproval,'NOT_APPROVED_AS_COMPLETE'); assert.equal(decision.technicalDefectReviewAuthorized,true);
  assert.equal(inv.scope.applicableFips.length,28); assert.equal(inv.completeness,'COMPLETE');
  assert.equal(inv.sourceAudit.reviewedSourceCount,16); assert.equal(inv.sourceAudit.reviewedArtifactCount,41); assert.equal(inv.sourceAudit.reviewComplete,true);
  assert.deepEqual(inv.derivedCounts,deriveCounts(inv.defects));
});

test('Wave 0 and inventory digests and two generations are deterministic', () => {
  const a=generated(), b=generated(); assert.deepEqual(a,b);
  assert.equal(digest(a['wave0-authority-contract.json']),digest(b['wave0-authority-contract.json']));
  assert.equal(digest(a['defect-inventory.json']),digest(b['defect-inventory.json']));
  for (const [name,value] of Object.entries(a)) assert.equal(fs.readFileSync(`${ROOT}/reports/lp18811f2/${name}`,'utf8'),`${JSON.stringify(value,null,2)}\n`);
});

test('no 215-county regression, activation, redeployment, or owner-result mutation occurs', () => {
  const before=sha(ownerPath); const files=generated(); const s=files['lp18811f2-summary.json'];
  assert.equal(s.state.regressionValidatedCount,0); assert.equal(s.state.currentOperationalCount,28); assert.equal(s.state.restrictedCountyCount,11); assert.equal(s.state.newActivatedCount,0); assert.equal(s.protectedRegressionRunnerUnblocked,false); assert.equal(sha(ownerPath),before);
  const source=fs.readFileSync(`${ROOT}/tools/lp18811/govern-wave0-defects.mjs`,'utf8');
  for (const forbidden of ['fetch(', 'activateCounty(', 'supabase.from', 'wrangler deploy']) assert.equal(source.includes(forbidden),false);
});

test('owner decision binds immutable approved digests and denies every broader authority', () => {
  const files=generated(), d=files['owner-governance-decision.json'];
  assert.equal(d.approvedBindings.wave0ContractDigest,'sha256:a05d8fbb07bcdf1ee4b067d0aacbe6e690a8531f160396472f76757f3beeb257');
  assert.equal(d.approvedBindings.severityTaxonomyDigest,'sha256:f920f96e8a6175f594368e400bef26717662aa4e316503acd4c867fc95654329');
  assert.equal(d.protectedNonProductionWave0ExecutionAuthorized,true);
  for (const key of ['regression215CountyExecutionAuthorized','productionActivationAuthorized','productionDeploymentAuthorized','publicLaunchAuthorized','supabaseProductionMutationAuthorized','restrictionClearingAuthorized']) assert.equal(d[key],false);
});

test('existing deployment fails closed because it cannot execute the six approved controls', () => {
  const r=generated()['wave0-execution-readiness.json'];
  assert.equal(r.authorized,true); assert.equal(r.executionReady,false); assert.equal(r.executed,false); assert.equal(r.runnerImplemented,false);
  assert.equal(r.approvedAssertionCapability.length,6);
  assert.match(r.stopReason,/CANNOT TRUTHFULLY EXECUTE THE SIX APPROVED/);
});
