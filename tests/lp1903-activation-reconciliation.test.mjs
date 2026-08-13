import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReport, EXPECTED_FIPS, INPUT, OUTPUT_JSON, OUTPUT_MD, PROTECTED_RUNTIME, run } from '../scripts/lp1903-reconcile-final-restricted-counties.mjs';

const input=JSON.parse(readFileSync(INPUT));
const clone=x=>structuredClone(x);

function verificationFixture() {
  const root=mkdtempSync(path.join(tmpdir(),'lp1903-'));
  const copy=file=>{const target=path.join(root,file);mkdirSync(path.dirname(target),{recursive:true});cpSync(file,target);};
  copy(INPUT);
  for(const county of input.counties){copy(county.lp134Run1.evidencePath);copy(county.lp134Run2.evidencePath);}
  run('apply',root);
  return root;
}

test('exact governed 11 reconcile from complete LP190.2 evidence',()=>{const r=buildReport(input);assert.deepEqual(r.counties.map(x=>x.countyFips),EXPECTED_FIPS);assert.deepEqual(r.aggregate,{expectedCountyCount:11,reconciledCount:11,alreadyReconciledCount:0,evidenceFailures:0,remainingGovernanceBlockers:0,ownerAuthorizationRequiredCount:0,activationEligibleCount:11,stillRestrictedByGovernanceCount:0,safeForGuardedRuntimeActivation:true});assert.equal(r.activationPerformed,false);assert.deepEqual(r.runtime,{operationalCountyCount:243,restrictedCountyCount:11,changed:false});assert.ok(r.counties.every(x=>x.reconciliationClassification==='RESTRICTION_RECONCILED_ACTIVATION_ELIGIBLE'));});
test('partial, failed, nondeterministic, SHA, and byte evidence fail closed',()=>{for(const mutate of [x=>x.counties.pop(),x=>x.counties[0].lp134Run1.status='FAIL',x=>x.counties[0].lp134Run2=null,x=>x.counties[0].lp134Deterministic=false,x=>x.counties[0].actualSha256='0'.repeat(64),x=>x.counties[0].actualByteLength++] ){const value=clone(input);mutate(value);const r=buildReport(value);assert.equal(r.aggregate.safeForGuardedRuntimeActivation,false);assert.ok(r.aggregate.evidenceFailures>0);}});
test('reconciliation changes reports only and preserves the 243/11 runtime',()=>{const r=run('whatif');assert.deepEqual(r.filesThatWouldChange,['reports/lp1903/final-11-county-activation-reconciliation.json','reports/lp1903/final-11-county-activation-reconciliation.md']);assert.ok(!r.filesThatWouldChange.some(p=>PROTECTED_RUNTIME.includes(p)||p.startsWith('Crossing-Packages/')));assert.deepEqual(r.runtime,{operationalCountyCount:243,restrictedCountyCount:11,changed:false});assert.equal(r.activationPerformed,false);});
test('committed reconciliation is deterministic and current',()=>{assert.doesNotThrow(()=>run('verify'));});
test('verification accepts canonical LF and equivalent CRLF Markdown materialization',t=>{const root=verificationFixture();t.after(()=>rmSync(root,{recursive:true,force:true}));assert.doesNotThrow(()=>run('verify',root));const markdown=readFileSync(path.join(root,OUTPUT_MD),'utf8');writeFileSync(path.join(root,OUTPUT_MD),markdown.replace(/\n/g,'\r\n'));assert.doesNotThrow(()=>run('verify',root));});
test('verification rejects substantive Markdown alteration',t=>{const root=verificationFixture();t.after(()=>rmSync(root,{recursive:true,force:true}));const report=path.join(root,OUTPUT_MD);writeFileSync(report,readFileSync(report,'utf8').replace('243 operational','242 operational'));assert.throws(()=>run('verify',root),/stale or missing reports\/lp1903\/final-11-county-activation-reconciliation\.md/);});
test('verification rejects stale JSON',t=>{const root=verificationFixture();t.after(()=>rmSync(root,{recursive:true,force:true}));const report=path.join(root,OUTPUT_JSON);writeFileSync(report,readFileSync(report,'utf8').replace('"reconciledCount": 11','"reconciledCount": 10'));assert.throws(()=>run('verify',root),/stale or missing reports\/lp1903\/final-11-county-activation-reconciliation\.json/);});
