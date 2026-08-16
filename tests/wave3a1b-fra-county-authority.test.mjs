import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvidence,verifyEvidence} from '../tools/wave3a1b/build-fra-county-authority.mjs';
test('owner comparison aggregates cover every authority exception',()=>{const x=buildEvidence()['owner-source-certification.json'].comparison;for(const k of ['rawRecordFound','crossingIdEqual','coordinatesEqual','STCYFIPSEqual','CountyCodeEqual','COUNTYNAMEEqual','stateIdentityEqual'])assert.equal(x[k],353)});
test('classification accounts for all exceptions without distance assignment',()=>{const x=buildEvidence()['exception-classification.json'];assert.deepEqual(x.counts,{CLEAR_GEOGRAPHIC_REASSIGNMENT:343,BORDER_TOLERANCE_REVIEW:8,OUTSIDE_TEXAS_BORDER_REVIEW:2,UNRESOLVED:0});assert.match(x.thresholdPolicy,/distance never assigns/)});
test('geographic projection preserves identities and excludes only blocked borders from county counts',()=>{const x=buildEvidence()['geographic-county-counts.json'].statewide;assert.equal(x.identitiesBefore,16101);assert.equal(x.identitiesRetained,16101);assert.equal(x.geographicallyAssignedAfter,16099);assert.equal(x.duplicatesAfter,0)});
test('partition is exhaustive and no production action is authorized',()=>{const e=buildEvidence();assert.equal(e['projected-partition.json'].union,254);assert.equal(e['projected-partition.json'].duplicates,0);assert.equal(e['authority-policy.json'].manufacturePackages,false);assert.equal(e['authority-policy.json'].activateCrossings,false)});
test('checked-in evidence is deterministic',()=>assert.equal(verifyEvidence().pass,true));
