import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidence,verifyEvidence} from '../tools/wave3a1/build-fra-reconciliation.mjs';

test('Wave 3A.1 accounts for every baseline exception exactly once',()=>{const e=buildEvidence(),x=e['exceptions.json'];assert.equal(x.count,351+2);assert.equal(new Set(x.exceptions.map(r=>r.crossingId)).size,353);assert.equal(e['summary.json'].statewideRows,16101);});
test('Wave 3A.1 aggregation and distance classifications are deterministic',()=>{const a=buildEvidence(),b=buildEvidence();assert.deepEqual(a['county-pair-summary.json'],b['county-pair-summary.json']);assert.deepEqual(a['distance-summary.json'],b['distance-summary.json']);assert.equal(Object.values(a['distance-summary.json'].buckets).reduce((x,y)=>x+y,0),351);});
test('Wave 3A.1 preserves identities and makes no production writes',()=>{const e=buildEvidence(),p=e['projected-cohort.json'],policy=e['proposed-policy.json'];assert.equal(p.coordinateContainmentWhatIf.statewideIdentityCount,16101);assert.equal(p.coordinateContainmentWhatIf.lostIdentities,0);assert.equal(p.coordinateContainmentWhatIf.duplicatedIdentities,0);assert.equal(policy.productionWrites,false);assert.equal(policy.runtimeChanges,false);});
test('Wave 3A.1 evidence is checked in and deterministic',()=>assert.equal(verifyEvidence().pass,true));
