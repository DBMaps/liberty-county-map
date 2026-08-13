import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildReport, EXPECTED_FIPS, PROTECTED_RUNTIME, run } from '../scripts/lp1903-reconcile-final-restricted-counties.mjs';

const input=JSON.parse(await readFile('reports/lp1902/restricted-county-restoration-recertification.json'));
const clone=x=>structuredClone(x);

test('exact governed 11 reconcile from complete LP190.2 evidence',()=>{const r=buildReport(input);assert.deepEqual(r.counties.map(x=>x.countyFips),EXPECTED_FIPS);assert.equal(r.aggregate.reconciledCount,11);assert.equal(r.aggregate.activationEligibleCount,11);assert.equal(r.aggregate.safeForGuardedRuntimeActivation,true);assert.ok(r.counties.every(x=>x.reconciliationClassification==='RESTRICTION_RECONCILED_ACTIVATION_ELIGIBLE'));});
test('partial, failed, nondeterministic, SHA, and byte evidence fail closed',()=>{for(const mutate of [x=>x.counties.pop(),x=>x.counties[0].lp134Run1.status='FAIL',x=>x.counties[0].lp134Run2=null,x=>x.counties[0].lp134Deterministic=false,x=>x.counties[0].actualSha256='0'.repeat(64),x=>x.counties[0].actualByteLength++] ){const value=clone(input);mutate(value);const r=buildReport(value);assert.equal(r.aggregate.safeForGuardedRuntimeActivation,false);assert.ok(r.aggregate.evidenceFailures>0);}});
test('reconciliation changes reports only and preserves the 243/11 runtime',()=>{const r=run('whatif');assert.deepEqual(r.filesThatWouldChange,['reports/lp1903/final-11-county-activation-reconciliation.json','reports/lp1903/final-11-county-activation-reconciliation.md']);assert.ok(!r.filesThatWouldChange.some(p=>PROTECTED_RUNTIME.includes(p)||p.startsWith('Crossing-Packages/')));assert.deepEqual(r.runtime,{operationalCountyCount:243,restrictedCountyCount:11,changed:false});assert.equal(r.activationPerformed,false);});
test('committed reconciliation is deterministic and current',()=>{assert.doesNotThrow(()=>run('verify'));});
