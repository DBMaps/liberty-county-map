import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildCertification,rendered,verifyCertification} from '../tools/lp2012/build-owner-visual-certification.mjs';

const root=path.resolve(import.meta.dirname,'..');
const whatif=JSON.parse(fs.readFileSync(path.join(root,'reports/lp2012/promotion-whatif.json')));
const certification=buildCertification();
const reviewed=new Map(certification.reviewedRecords.map(x=>[x.canonicalName,x]));

test('owner certification contains exactly eleven joined PASS decisions',()=>{
  assert.equal(certification.reviewedRecords.length,11);
  for(const x of certification.reviewedRecords){
    assert.equal(x.ownerDecision,'PASS_PROPOSED');
    const source=whatif.records.find(r=>r.canonical.placeGeoid===x.canonicalGeoid);
    assert.ok(source); assert.equal(x.canonicalName,source.canonical.name); assert.deepEqual(x.currentCamera,source.currentCamera); assert.deepEqual(x.proposedCamera,source.proposal); assert.equal(x.distanceMeters,source.comparison.distanceMeters);
  }
});
test('four extreme-distance review values exactly match certified WhatIf',()=>{
  for(const [name,distance] of [['Corpus Christi',22648.585],['Stamford',22225.321],['Galveston',21355.76],['Monahans',20116.473]]) assert.equal(reviewed.get(name).distanceMeters,distance);
});
test('all four LP197 controls remain comparison-only and non-promoted',()=>{
  assert.equal(certification.higherAuthorityControls.length,4);
  for(const x of certification.higherAuthorityControls){assert.equal(x.automaticPromotion,false);assert.equal(x.comparisonOnly,true);assert.equal(x.ownerCameraRetained,true);}
});
test('Kyle and every unresolved bucket fail closed statewide',()=>{
  const k=certification.unresolvedControls[0]; assert.equal(k.canonicalName,'Kyle'); assert.equal(k.lp2011Bucket,'B_MULTIPLE_OSM_CANDIDATES'); assert.equal(k.automaticProposal,false);
  for(const x of whatif.records.filter(x=>/^[BDEGH]_/.test(x.lp2011Bucket)))assert.equal(x.proposal,null);
});
test('cohort, runtime, zoom, and region governance remain protected',()=>{
  assert.equal(certification.promotionCohort.proposed.count,1555); assert.equal(certification.promotionCohort.higherAuthority.count,4); assert.equal(certification.promotionCohort.unresolvedOrIneligible.count,300); assert.equal(certification.runtimeActivation,false);
  assert.equal(certification.certificationConclusions.zoomGovernanceUnchanged,true); assert.equal(certification.certificationConclusions.houstonAndSanAntonioRegionIdentitiesProtected,true);
});
test('serialization is deterministic and tracked certification verifies',()=>{assert.equal(rendered(),rendered());assert.equal(verifyCertification(),true);});
test('certification detects WhatIf drift',()=>{
  const file=path.join(root,'reports/lp2012/promotion-whatif.json'),original=fs.readFileSync(file);
  try{fs.appendFileSync(file,' ');assert.throws(()=>verifyCertification(),/drift/);}finally{fs.writeFileSync(file,original);}
});
test('certification builder cannot write production runtime or apply',()=>{
  const source=fs.readFileSync(path.join(root,'tools/lp2012/build-owner-visual-certification.mjs'),'utf8');
  assert.doesNotMatch(source,/writeFileSync\([^\n]*?(?:js\/|data\/generated|data\/runtime|assets\/)/); assert.match(source,/--apply does not exist/);
  assert.equal(certification.protectedRuntimeResult.result,'NO PRODUCTION RUNTIME CHANGES');
});
