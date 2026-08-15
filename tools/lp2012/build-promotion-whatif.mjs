#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FILES = {
  summary: 'reports/lp2011/summary.json', reconciliation: 'reports/lp2011/reconciliation.json',
  presentation: 'data/generated/gridly-statewide-place-presentation-v1.json',
  projection: 'data/generated/gridly-statewide-consumer-community-projection-v1.json',
  owners: 'reports/lp197/governed-place-consumer-presentation-cameras.json'
};
export const OUTPUTS = {
  inventory: 'reports/lp2012/promotion-whatif.json', summary: 'reports/lp2012/promotion-whatif-summary.json',
  review: 'reports/lp2012/promotion-whatif-review.json'
};
export const PROTECTED_SURFACES = ['js/app.js','js/gridlyPackageRegistry.js','assets/package-registry/runtime-package-registry.json','assets/location-resolution/','data/generated/','data/runtime/'];
const AC = new Set(['A_HIGH_CONFIDENCE_UNIQUE','C_DUPLICATE_NAME_GEOGRAPHICALLY_DISAMBIGUATED']);
const EXPECTED = { canonicalPlaces:1859, canonicalResolved:1559, canonicalUnresolved:300, A:1253, C:306, bytes:707715853, sha256:'1d80efe1b19b075d036363d722366870df3efb7fbd4a45dc9f16797868ff4413' };
const REPRESENTATIVE = ['Dayton','Tyler','Waco','Corpus Christi','Austin','Dallas','El Paso','Fort Worth','Liberty','Abbott','Acala','Houston','Kyle'];

const read = rel => fs.readFileSync(path.join(ROOT, rel));
const json = rel => JSON.parse(read(rel));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const serialize = value => `${JSON.stringify(value, null, 2)}\n`;
const round = (n, places=3) => Number(n.toFixed(places));
export function distanceMeters(a,b) {
  const rad=x=>x*Math.PI/180, R=6371008.8;
  const p1=rad(a.latitude), p2=rad(b.latitude), dp=rad(b.latitude-a.latitude), dl=rad(b.longitude-a.longitude);
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return round(2*R*Math.asin(Math.sqrt(h)));
}
function assert(condition, message) { if (!condition) throw new Error(`LP201.2 fail-closed: ${message}`); }

export function buildEvidence({ mutate }={}) {
  const s=json(FILES.summary), recon=json(FILES.reconciliation), presentation=json(FILES.presentation), projection=json(FILES.projection), owners=json(FILES.owners);
  assert(s.runtimeActivation===false,'LP201.1 runtimeActivation is not false');
  assert(s.counts.canonicalPlaces===EXPECTED.canonicalPlaces && s.counts.canonicalResolved===EXPECTED.canonicalResolved && s.counts.canonicalUnresolved===EXPECTED.canonicalUnresolved,'certified canonical counts drifted');
  assert(s.counts.A_HIGH_CONFIDENCE_UNIQUE===EXPECTED.A && s.counts.C_DUPLICATE_NAME_GEOGRAPHICALLY_DISAMBIGUATED===EXPECTED.C && EXPECTED.A+EXPECTED.C===EXPECTED.canonicalResolved,'certified A/C counts drifted');
  assert(s.inputHashes.bytes===EXPECTED.bytes && s.inputHashes.sha256===EXPECTED.sha256,'frozen PBF identity drifted');
  assert(recon.counts.canonicalPlaces===1859 && recon.records.length===1859,'reconciliation inventory drifted');
  const proj=new Map(projection.communities.map(x=>[x.placeGeoid,x])), owner=new Map(owners.cameras.map(x=>[x.placeGeoid,x]));
  const seen=new Set();
  const records=recon.records.map(source => {
    const r=structuredClone(source); if (mutate) mutate(r);
    const c=r.canonical, geoid=c.placeGeoid;
    assert(!seen.has(geoid),`duplicate canonical GEOID ${geoid}`); seen.add(geoid);
    const p=presentation.places[geoid], q=proj.get(geoid), o=owner.get(geoid);
    const identityOk=!!p && !!q && q.displayName===c.name && q.governedType===c.governedType && JSON.stringify(q.countyMemberships)===JSON.stringify(c.countyMemberships);
    const current=p ? {latitude:o?.lat??p.lat,longitude:o?.lng??p.lon,zoom:o?.zoom??13,authority:o?'LP197_OWNER_APPROVED':'STATEWIDE_CENSUS_PRESENTATION',provenance:o?'reports/lp197/governed-place-consumer-presentation-cameras.json':'data/generated/gridly-statewide-place-presentation-v1.json'} : null;
    const matches=r.selectedOsmId==null?[]:r.candidates.filter(x=>String(x.osmId)===String(r.selectedOsmId));
    const selected=matches.length===1?matches[0]:null;
    const candidateValid=!!selected && Number.isFinite(selected.lat)&&selected.lat>=-90&&selected.lat<=90&&Number.isFinite(selected.lon)&&selected.lon>=-180&&selected.lon<=180;
    const selectionEligible=!!selected && r.candidateEligibility.selectionEligibleCount>0 && !r.candidateEligibility.nonSelectionEligibleClasses.includes(selected.place);
    const candidate=selected?{osmId:String(selected.osmId),name:selected.name,place:selected.place,latitude:selected.lat,longitude:selected.lon,bucket:r.bucket,insideCanonicalGeometry:selected.insideCanonicalGeometry,statewideSameNameCount:selected.statewideSameNameCount,countyAgreement:selected.countyAgreement??null,selectionEligible,provenance:'reports/lp2011/reconciliation.json'}:null;
    let decision, reason, eligible=false;
    if (!AC.has(r.bucket)) { decision='RETAIN_CURRENT_FALLBACK_UNRESOLVED_BUCKET'; reason=`LP201.1 bucket ${r.bucket} is not automatically promotable`; }
    else if (o) { decision='RETAIN_HIGHER_AUTHORITY_CAMERA'; reason=`Higher-authority LP197 owner-approved camera exists for ${o.label}`; }
    else if (!identityOk) { decision='RETAIN_CURRENT_FALLBACK_IDENTITY_GUARD'; reason='Canonical identity failed presentation/projection exact join'; }
    else if (matches.length!==1 || !candidateValid || !selectionEligible) { decision='RETAIN_CURRENT_FALLBACK_INVALID_CANDIDATE'; reason=matches.length!==1?'selectedOsmId did not join exactly one retained candidate':'Selected candidate is invalid or selection-ineligible'; }
    else { decision='PROPOSE_NAMED_PLACE_ANCHOR'; reason='A/C candidate passed every governed eligibility gate'; eligible=true; }
    const proposal=eligible?{latitude:candidate.latitude,longitude:candidate.longitude,zoom:current.zoom,authority:'LP2012_NAMED_PLACE_ANCHOR_PROPOSED',provenance:'reports/lp2011/reconciliation.json',runtimeActivation:false}:null;
    return {canonical:{placeGeoid:geoid,name:c.name,governedType:c.governedType,countyMemberships:[...c.countyMemberships]},lp2011EvidenceExists:true,lp2011Bucket:r.bucket,currentCamera:current,namedPlaceCandidate:candidate,higherAuthority:{exists:!!o,authority:o?'LP197_OWNER_APPROVED':null},promotionEligible:eligible,proposal,decision,decisionReason:reason,comparison:current&&candidate?{distanceMeters:distanceMeters(current,candidate),method:'HAVERSINE_IUGG_MEAN_EARTH_RADIUS_6371008_8_METERS'}:null,regionSeparation:{canonicalPlaceEvaluated:true,dedicatedHoustonAndSanAntonioRegionIdentitiesUnaffected:true}};
  }).sort((a,b)=>a.canonical.placeGeoid.localeCompare(b.canonical.placeGeoid));
  assert(records.length===1859,'output is not complete');
  const countsBy=(fn)=>records.reduce((m,x)=>(m[fn(x)]=(m[fn(x)]||0)+1,m),{});
  const distances=records.filter(x=>x.comparison).map(x=>x.comparison.distanceMeters).sort((a,b)=>a-b), sum=distances.reduce((a,b)=>a+b,0);
  const pct=p=>distances[Math.ceil(p*distances.length)-1];
  const bucketCounts=countsBy(x=>x.lp2011Bucket), decisions=countsBy(x=>x.decision);
  const type={incorporatedPlace:{proposed:0,retained:0},cdp:{proposed:0,retained:0},multiCounty:{proposed:0,retained:0}};
  for(const x of records){const k=x.promotionEligible?'proposed':'retained'; type[x.canonical.governedType==='CENSUS_DESIGNATED_PLACE'?'cdp':'incorporatedPlace'][k]++; if(x.canonical.countyMemberships.length>1)type.multiCounty[k]++;}
  const inputIdentities=Object.fromEntries(Object.entries(FILES).map(([k,v])=>[k,{path:v,sha256:sha256(read(v))}])); inputIdentities.frozenOsmPbf={path:s.inputHashes.path,bytes:s.inputHashes.bytes,sha256:s.inputHashes.sha256,readDuringLp2012:false};
  const summary={schemaVersion:'gridly.lp2012.promotion-whatif-summary.v1',runtimeActivation:false,inputIdentities,totalCanonicalCount:records.length,bucketCounts,potentialACCount:(bucketCounts.A_HIGH_CONFIDENCE_UNIQUE||0)+(bucketCounts.C_DUPLICATE_NAME_GEOGRAPHICALLY_DISAMBIGUATED||0),proposedCount:decisions.PROPOSE_NAMED_PLACE_ANCHOR||0,retainedCount:records.length-(decisions.PROPOSE_NAMED_PLACE_ANCHOR||0),higherAuthorityRetainedCount:decisions.RETAIN_HIGHER_AUTHORITY_CAMERA||0,unresolvedRetainedCount:decisions.RETAIN_CURRENT_FALLBACK_UNRESOLVED_BUCKET||0,otherEligibilityGuardRetainedCount:(decisions.RETAIN_CURRENT_FALLBACK_IDENTITY_GUARD||0)+(decisions.RETAIN_CURRENT_FALLBACK_INVALID_CANDIDATE||0)+(decisions.RETAIN_CURRENT_FALLBACK_INELIGIBLE||0),typeCounts:type,distanceDistributionMeters:{count:distances.length,minimum:distances[0],median:round((distances[(distances.length-1)>>1]+distances[distances.length>>1])/2),mean:round(sum/distances.length),percentile95:pct(.95),maximum:distances.at(-1)},decisionTaxonomyCounts:decisions,protectedRuntimeSurfaces:{result:'PASS_NO_WRITES',paths:PROTECTED_SURFACES},zoomPolicy:{result:records.every(x=>!x.proposal||x.proposal.zoom===x.currentCamera.zoom)?'PASS_PRESERVED':'FAIL',source:'current governed camera; never OSM'},regionSeparation:{result:'PASS',policy:'Dedicated Houston and San Antonio region identities are outside this canonical PLACE-only evidence tool.'}};
  const byDistance=[...records].filter(x=>x.comparison).sort((a,b)=>b.comparison.distanceMeters-a.comparison.distanceMeters||a.canonical.placeGeoid.localeCompare(b.canonical.placeGeoid));
  const review={schemaVersion:'gridly.lp2012.promotion-whatif-review.v1',runtimeActivation:false,notice:'Distance is review evidence only and is not a quality judgment. Owner visual certification remains required.',representativeRecords:REPRESENTATIVE.map(n=>records.find(x=>x.canonical.name===n)),largestDistanceRecords:byDistance.slice(0,30),higherAuthorityComparisons:records.filter(x=>x.higherAuthority.exists),duplicateNameCRecords:records.filter(x=>x.lp2011Bucket.startsWith('C_')).slice(0,30),cdpRecords:records.filter(x=>x.canonical.governedType==='CENSUS_DESIGNATED_PLACE').slice(0,30),multiCountyRecords:records.filter(x=>x.canonical.countyMemberships.length>1).slice(0,30),unexpectedOrIneligibleRecords:records.filter(x=>AC.has(x.lp2011Bucket)&&!x.promotionEligible&&!x.higherAuthority.exists),regionSeparationEvidence:{houstonParentPlace:records.find(x=>x.canonical.name==='Houston'),dedicatedRegionIdentities:['HOUSTON_REGION','SAN_ANTONIO_REGION'],replacementAttempted:false}};
  const inventory={schemaVersion:'gridly.lp2012.promotion-whatif.v1',runtimeActivation:false,scope:'All canonical Texas PLACEs; evidence only; no apply mode',records};
  return {inventory,summary,review};
}

export function rendered(e=buildEvidence()){return Object.fromEntries(Object.entries(OUTPUTS).map(([k,v])=>[v,serialize(e[k])]));}
export function writeEvidence(){for(const [f,b] of Object.entries(rendered()))fs.writeFileSync(path.join(ROOT,f),b);}
export function verifyEvidence(){for(const [f,b] of Object.entries(rendered()))assert(fs.existsSync(path.join(ROOT,f))&&read(f).equals(Buffer.from(b)),`${f} byte/content drift`);return true;}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const args=new Set(process.argv.slice(2)); assert(!args.has('--apply'),'--apply does not exist in LP201.2');
  assert(args.has('--whatif')!==args.has('--verify'),'choose exactly one of --whatif or --verify');
  if(args.has('--whatif'))writeEvidence(); else verifyEvidence();
  const out=buildEvidence().summary; console.log(args.has('--json')?serialize(out):`LP201.2 ${args.has('--verify')?'verification':'WhatIf generation'} PASS: ${out.proposedCount} proposed, ${out.retainedCount} retained, runtimeActivation=false`);
}
