import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const BUCKET = Object.freeze({
  HIGH: 'A_HIGH_CONFIDENCE_UNIQUE', MULTIPLE: 'B_MULTIPLE_OSM_CANDIDATES',
  DUPLICATE: 'C_DUPLICATE_NAME_GEOGRAPHICALLY_DISAMBIGUATED',
  NAME_MISMATCH: 'D_NAME_MISMATCH_GEOGRAPHICALLY_PLAUSIBLE', NO_CANDIDATE: 'E_NO_OSM_CANDIDATE',
  UNMATCHED: 'F_OSM_CANDIDATE_UNRECONCILED', CLASSIFICATION: 'G_CLASSIFICATION_CONCERN',
  HARD_CONFLICT: 'H_HARD_CONFLICT_INVALID'
});
export const SELECTION_ELIGIBLE_PLACE_CLASSES = Object.freeze(['city', 'town', 'village', 'hamlet']);
const SAFE = new Set(SELECTION_ELIGIBLE_PLACE_CLASSES);
export const normalizeName = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, ' ').trim();
const stable = value => value && typeof value === 'object' ? Array.isArray(value) ? value.map(stable) : Object.fromEntries(Object.keys(value).sort().map(k => [k, stable(value[k])])) : value;
export const stableJson = value => `${JSON.stringify(stable(value), null, 2)}\n`;
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export function haversineMeters(a, b) { const r=6371008.8, rad=x=>x*Math.PI/180, p1=rad(a.lat),p2=rad(b.lat),dp=p2-p1,dl=rad(b.lon-a.lon); const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return Math.round(2*r*Math.asin(Math.sqrt(q))*1000)/1000; }
function onSegment(p,a,b){const cross=(p[1]-a[1])*(b[0]-a[0])-(p[0]-a[0])*(b[1]-a[1]);return Math.abs(cross)<1e-12&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);}
function inRing(p, ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if(onSegment(p,a,b))return true;if(((b[1]>p[1])!==(a[1]>p[1]))&&(p[0]<(a[0]-b[0])*(p[1]-b[1])/(a[1]-b[1])+b[0]))inside=!inside;}return inside;}
function inPolygon(p, poly){return inRing(p,poly[0])&&!poly.slice(1).some(r=>inRing(p,r));}
export function contains(geometry, lon, lat){if(!geometry)return false;const p=[lon,lat];return geometry.type==='Polygon'?inPolygon(p,geometry.coordinates):geometry.type==='MultiPolygon'?geometry.coordinates.some(x=>inPolygon(p,x)):false;}
const coord = c => ({lat:Number(c.lat),lon:Number(c.lon)});
const candidateRecord = (c, place, statewideCount) => { const inside=contains(place.geometry,Number(c.lon),Number(c.lat)); return {osmId:String(c.osmId),name:c.name,normalizedName:normalizeName(c.name),place:c.place,lat:Number(c.lat),lon:Number(c.lon),insideCanonicalGeometry:inside,countyAgreement:c.countyFips?place.countyMemberships.includes(c.countyFips):null,statewideSameNameCount:statewideCount,distanceToLp199Meters:place.lp199? haversineMeters(coord(c),place.lp199):null,distanceToLp200Meters:place.lp200? haversineMeters(coord(c),place.lp200):null}; };
export function reconcile({places,candidates,source={}}){
  const cleanCandidates=[...candidates].map(c=>({...c,osmId:String(c.osmId)})).sort((a,b)=>a.osmId.localeCompare(b.osmId));
  const nameCounts=new Map(); for(const c of cleanCandidates){const n=normalizeName(c.name);nameCounts.set(n,(nameCounts.get(n)||0)+1);}
  const associated=new Set(); const records=[];
  for(const place of [...places].sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid))){
    const exact=cleanCandidates.filter(c=>normalizeName(c.name)===normalizeName(place.name));
    const insideAll=cleanCandidates.filter(c=>contains(place.geometry,Number(c.lon),Number(c.lat)));
    const plausible=exact.filter(c=>contains(place.geometry,Number(c.lon),Number(c.lat)));
    const selectionEligible=plausible.filter(c=>SAFE.has(String(c.place).toLowerCase()));
    let bucket,reasons,selected=null;
    if(!place.geometry){bucket=BUCKET.HARD_CONFLICT;reasons=['CANONICAL_GEOMETRY_MISSING'];}
    else if(selectionEligible.length>1){bucket=BUCKET.MULTIPLE;reasons=['MULTIPLE_SELECTION_ELIGIBLE_EXACT_NAME_IN_POLYGON'];}
    else if(plausible.length>0&&selectionEligible.length===0){bucket=BUCKET.CLASSIFICATION;reasons=['OSM_CLASS_NOT_AUTOMATICALLY_ELIGIBLE'];}
    else if(selectionEligible.length===1){selected=String(selectionEligible[0].osmId);if((nameCounts.get(normalizeName(place.name))||0)>1){bucket=BUCKET.DUPLICATE;reasons=['STATEWIDE_DUPLICATE_NAME_RESOLVED_BY_POLYGON'];}else{bucket=BUCKET.HIGH;reasons=['EXACT_NORMALIZED_NAME','UNIQUE_SELECTION_ELIGIBLE_IN_CANONICAL_POLYGON','ELIGIBLE_OSM_CLASS'];}}
    else if(insideAll.length){bucket=BUCKET.NAME_MISMATCH;reasons=['IN_POLYGON_NAME_MISMATCH'];}
    else if(exact.length){bucket=BUCKET.HARD_CONFLICT;reasons=['EXACT_NAME_OUTSIDE_CANONICAL_GEOMETRY'];}
    else {bucket=BUCKET.NO_CANDIDATE;reasons=['NO_NAMED_PLACE_IN_CANONICAL_GEOMETRY'];}
    // In-polygon evidence meaningfully participates in A/B/C/D/G. Exact-name
    // out-of-polygon evidence participates in H and must remain reviewable too.
    const participating=plausible.length?plausible:insideAll.length?insideAll:exact;
    const evidence=participating.map(c=>candidateRecord(c,place,nameCounts.get(normalizeName(c.name))||0));
    for(const candidate of evidence)associated.add(candidate.osmId);
    const candidateEligibility={retainedEvidenceCount:evidence.length,selectionEligibleCount:selectionEligible.length,nonSelectionEligibleClasses:[...new Set(plausible.filter(c=>!SAFE.has(String(c.place).toLowerCase())).map(c=>String(c.place).toLowerCase()))].sort()};
    records.push({canonical:{placeGeoid:place.placeGeoid,name:place.name,governedType:place.governedType,countyMemberships:[...place.countyMemberships].sort()},bucket,reasons,selectedOsmId:selected,candidateEligibility,candidates:evidence});
  }
  const unmatched=cleanCandidates.filter(c=>!associated.has(c.osmId)).map(c=>({bucket:BUCKET.UNMATCHED,osmId:c.osmId,name:c.name,place:c.place,lat:Number(c.lat),lon:Number(c.lon),reason:'NOT_ASSOCIATED_WITH_ANY_CANONICAL_PLACE'}));
  const counts=Object.fromEntries(Object.values(BUCKET).map(b=>[b,records.filter(r=>r.bucket===b).length+(b===BUCKET.UNMATCHED?unmatched.length:0)]));
  const canonicalResolved=records.filter(r=>[BUCKET.HIGH,BUCKET.DUPLICATE].includes(r.bucket)).length;
  const canonicalUnresolved=records.length-canonicalResolved;
  return {schemaVersion:'gridly.lp2011.osm-place-reconciliation.v1',scope:{evidenceOnly:true,runtimeActivation:false},source,counts:{canonicalPlaces:records.length,canonicalResolved,canonicalUnresolved,osmCandidates:cleanCandidates.length,osmMatchedOrAssociated:associated.size,osmUnmatched:unmatched.length,...counts,unresolved:canonicalUnresolved},records,unmatched};
}

export function buildLp197Comparison(reconciliation, references){
  const byGeoid=new Map(reconciliation.records.map(r=>[r.canonical.placeGeoid,r]));
  return [...references].sort((a,b)=>a.placeGeoid.localeCompare(b.placeGeoid)).map(ref=>{const r=byGeoid.get(ref.placeGeoid),c=r?.candidates.find(x=>x.osmId===r.selectedOsmId);return {placeGeoid:ref.placeGeoid,label:ref.label,reference:ref.reference,lp199:ref.lp199??null,lp200:ref.lp200??null,osm:c?{osmId:c.osmId,lat:c.lat,lon:c.lon,place:c.place}:null,bucket:r?.bucket??BUCKET.NO_CANDIDATE,osmToReferenceMeters:c?haversineMeters(c,ref.reference):null,lp199ToReferenceMeters:ref.lp199?haversineMeters(ref.lp199,ref.reference):null,lp200ToReferenceMeters:ref.lp200?haversineMeters(ref.lp200,ref.reference):null,evidenceOnly:true};});
}

export function verifySource(file, expected){if(!fs.existsSync(file))throw Error(`LP2011_SOURCE_MISSING:${file}`);const bytes=fs.readFileSync(file);if(bytes.length!==expected.bytes)throw Error(`LP2011_SOURCE_SIZE_MISMATCH:${bytes.length}`);const hash=sha256(bytes);if(hash!==expected.sha256)throw Error(`LP2011_SOURCE_SHA256_MISMATCH:${hash}`);return {path:file,bytes:bytes.length,sha256:hash};}
export function writeAtomic(target, content){fs.mkdirSync(path.dirname(target),{recursive:true});const tmp=`${target}.tmp-${process.pid}`;fs.writeFileSync(tmp,content);fs.renameSync(tmp,target);}
