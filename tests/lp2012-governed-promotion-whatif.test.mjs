import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildEvidence,rendered,verifyEvidence,PROTECTED_SURFACES} from '../tools/lp2012/build-promotion-whatif.mjs';

const root=path.resolve(import.meta.dirname,'..');
const evidence=buildEvidence(), records=evidence.inventory.records;
const named=n=>records.find(x=>x.canonical.name===n), bucket=b=>records.filter(x=>x.lp2011Bucket.startsWith(b));

test('complete certified statewide baseline remains non-activating',()=>{
  assert.equal(records.length,1859); assert.equal(evidence.summary.potentialACCount,1559); assert.equal(evidence.inventory.runtimeActivation,false);
  assert.equal(evidence.summary.bucketCounts.A_HIGH_CONFIDENCE_UNIQUE,1253); assert.equal(evidence.summary.bucketCounts.C_DUPLICATE_NAME_GEOGRAPHICALLY_DISAMBIGUATED,306);
});
test('A and C eligible examples propose while preserving governed zoom',()=>{
  for(const n of ['Abbott','Tyler']) { const x=named(n); assert.equal(x.promotionEligible,true); assert.equal(x.decision,'PROPOSE_NAMED_PLACE_ANCHOR'); assert.equal(x.proposal.zoom,x.currentCamera.zoom); }
});
test('all four LP197 cameras retain higher authority and comparison evidence',()=>{
  for(const n of ['Austin','Dallas','El Paso','Fort Worth']) { const x=named(n); assert.equal(x.currentCamera.authority,'LP197_OWNER_APPROVED'); assert.equal(x.promotionEligible,false); assert.equal(x.decision,'RETAIN_HIGHER_AUTHORITY_CAMERA'); assert.equal(x.proposal,null); assert.ok(x.comparison.distanceMeters>=0); }
});
test('B/D/E/G/H and four genuine B cases never receive proposals',()=>{
  for(const b of ['B_','D_','E_','G_','H_']) for(const x of bucket(b)) assert.notEqual(x.decision,'PROPOSE_NAMED_PLACE_ANCHOR');
  for(const n of ['Kyle','Pecan Plantation','Runaway Bay','Sherwood Shores']) assert.equal(named(n).decision,'RETAIN_CURRENT_FALLBACK_UNRESOLVED_BUCKET');
});
test('selectedOsmId must join exactly one retained candidate',()=>{
  const e=buildEvidence({mutate:r=>{if(r.canonical.name==='Abbott')r.candidates.push(structuredClone(r.candidates[0]));}}); const x=e.inventory.records.find(x=>x.canonical.name==='Abbott');
  assert.equal(x.promotionEligible,false); assert.equal(x.decision,'RETAIN_CURRENT_FALLBACK_INVALID_CANDIDATE');
});
test('invalid coordinate fails closed',()=>{
  const e=buildEvidence({mutate:r=>{if(r.canonical.name==='Abbott')r.candidates[0].lat=Infinity;}}); assert.equal(e.inventory.records.find(x=>x.canonical.name==='Abbott').promotionEligible,false);
});
test('missing production identity fails closed',()=>{
  const e=buildEvidence({mutate:r=>{if(r.canonical.name==='Abbott')r.canonical.placeGeoid='9999999';}}); const x=e.inventory.records.find(x=>x.canonical.name==='Abbott');
  assert.equal(x.promotionEligible,false); assert.equal(x.decision,'RETAIN_CURRENT_FALLBACK_IDENTITY_GUARD'); assert.equal(x.currentCamera,null);
});
test('CDPs and multi-county PLACEs retain identity and are not blanket-excluded',()=>{
  const acala=named('Acala'), corpus=named('Corpus Christi'); assert.equal(acala.canonical.governedType,'CENSUS_DESIGNATED_PLACE'); assert.equal(acala.promotionEligible,true);
  const projection=JSON.parse(fs.readFileSync(path.join(root,'data/generated/gridly-statewide-consumer-community-projection-v1.json'))); const governed=projection.communities.find(x=>x.placeGeoid===corpus.canonical.placeGeoid);
  assert.ok(corpus.canonical.countyMemberships.length>1); assert.deepEqual(corpus.canonical.countyMemberships,governed.countyMemberships); assert.equal(corpus.promotionEligible,true);
});
test('dedicated region identities remain separate from parent PLACE proposal',()=>{
  assert.equal(named('Houston').regionSeparation.dedicatedHoustonAndSanAntonioRegionIdentitiesUnaffected,true); assert.equal(evidence.review.regionSeparationEvidence.replacementAttempted,false);
});
test('ordering and serialization are deterministic',()=>{
  assert.deepEqual(records.map(x=>x.canonical.placeGeoid),[...records].map(x=>x.canonical.placeGeoid).sort()); assert.deepEqual(rendered(),rendered(buildEvidence()));
});
test('tracked artifacts verify and drift is detected',()=>{
  assert.equal(verifyEvidence(),true); const f=path.join(root,'reports/lp2012/promotion-whatif-summary.json'), original=fs.readFileSync(f);
  try { fs.appendFileSync(f,' '); assert.throws(()=>verifyEvidence(),/drift/); } finally { fs.writeFileSync(f,original); }
});
test('tool has no production runtime writes or apply mode',()=>{
  const source=fs.readFileSync(path.join(root,'tools/lp2012/build-promotion-whatif.mjs'),'utf8'); assert.doesNotMatch(source,/writeFileSync\(path\.join\(ROOT,(?!f\))/); assert.match(source,/--apply does not exist/);
  assert.deepEqual(evidence.summary.protectedRuntimeSurfaces.paths,PROTECTED_SURFACES); assert.equal(evidence.summary.protectedRuntimeSurfaces.result,'PASS_NO_WRITES');
});
