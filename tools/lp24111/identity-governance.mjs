import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const IDENTITY_CLASSES=Object.freeze(['PARENT_POI','CHILD_POI','LIKELY_DUPLICATE','DISTINCT_POI','AMBIGUOUS']);
export const D2_ELIGIBLE_BASELINE=393038;
export const MAX_BLOCK_MEMBERS=250;
const CHILD=/\b(pharmacy|bakery|vision(?:\s*(?:and|&)\s*glasses)?|photo center|auto care(?: center)?|optical|fuel center|locker|kiosk|key cutting)\b/i;
const PARENT=/\b(supercenter|department store|hospital|medical center|travel center|truck stop)\b/i;
const VET=/\b(veterinar(?:y|ian)|animal hospital|animal health)\b/i;
const LODGING=/\b(hotel|motel|resort|lodge|lodging|inn|suites?)\b/i;
const MEDICAL=/\b(hospital|emergency|urgent care|imaging|laboratory|medical center|clinic|pharmacy)\b/i;
const FUEL=/\b(gas|fuel|convenience|travel center|truck stop)\b/i;
const norm=v=>String(v??'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const val=(r,...keys)=>keys.map(k=>r[k]).find(v=>v!==undefined&&v!==null&&v!=='');
const name=r=>norm(val(r,'normalized_name','normalizedName','display_name','displayName','name'));
const brand=r=>norm(val(r,'brand_name','brandName','brand'));
const address=r=>norm(val(r,'address','source_address','sourceAddress'));
const domain=r=>norm(val(r,'website_domain','websiteDomain','website'));
const phone=r=>norm(val(r,'phone','phones'));
const categories=r=>norm([val(r,'basic_category','basicCategory'),val(r,'gridly_category','gridlyCategory'),val(r,'categories'),val(r,'taxonomy')].join(' '));
export function distanceMeters(a,b){const p=Math.PI/180,lat1=Number(a.latitude),lat2=Number(b.latitude),dl=(Number(b.longitude)-Number(a.longitude))*p,dp=(lat2-lat1)*p;const x=dl*Math.cos((lat1+lat2)*p/2);return 6371000*Math.hypot(x,dp);}
export function signals(a,b){const d=distanceMeters(a,b),na=name(a),nb=name(b),ba=brand(a),bb=brand(b),aa=address(a),ab=address(b),pa=phone(a),pb=phone(b),wa=domain(a),wb=domain(b);return {distanceMeters:Number.isFinite(d)?d:null,sameName:!!na&&na===nb,sameBrand:!!ba&&ba===bb,sameAddress:!!aa&&aa===ab,samePhone:!!pa&&pa===pb,sameWebsite:!!wa&&wa===wb,nearName:!!na&&!!nb&&(na.includes(nb)||nb.includes(na)),categoryA:categories(a),categoryB:categories(b)};}
export function childFamily(record){const n=name(record);if(!CHILD.test(n))return null;if(/walmart/.test(n)||brand(record)==='walmart')return 'WALMART_DEPARTMENT';if(/target|cvs/.test(n)||/target|cvs/.test(brand(record)))return 'TARGET_CVS_DEPARTMENT';if(/locker|kiosk|key cutting/.test(n))return 'KIOSK_LOCKER';return 'RETAIL_DEPARTMENT';}
export function classifyPair(a,b){const s=signals(a,b),na=name(a),nb=name(b),ca=categories(a),cb=categories(b);
 if(VET.test(`${na} ${ca}`)||VET.test(`${nb} ${cb}`)){if(MEDICAL.test(`${ca} ${cb}`))return {classification:'DISTINCT_POI',reason:'VETERINARY_HUMAN_MEDICAL_SEPARATION',signals:s};}
 const af=childFamily(a),bf=childFamily(b),aParent=PARENT.test(`${na} ${ca}`),bParent=PARENT.test(`${nb} ${cb}`);
 if((af&&!bf&&bParent)||(bf&&!af&&aParent)){if(s.distanceMeters<=100&&(s.sameAddress||s.sameBrand||s.samePhone||s.sameWebsite))return {classification:'CHILD_POI',childId:af?a.id:b.id,parentId:af?b.id:a.id,reason:'EXPLICIT_DEPARTMENT_WITH_PARENT_CORROBORATION',signals:s};return {classification:'AMBIGUOUS',reason:'DEPARTMENT_NAME_WITHOUT_COLOCATION_CORROBORATION',signals:s};}
 const compatible=(LODGING.test(ca)&&LODGING.test(cb))||(FUEL.test(ca)&&FUEL.test(cb))||(MEDICAL.test(ca)&&MEDICAL.test(cb));
 if(s.distanceMeters<=30&&compatible&&((s.sameName&&s.sameAddress)||(s.samePhone&&s.nearName)||(s.sameWebsite&&s.nearName)))return {classification:'LIKELY_DUPLICATE',reason:'MULTIPLE_STRONG_IDENTITY_SIGNALS',signals:s};
 if(s.sameAddress&&s.distanceMeters<=30&&MEDICAL.test(ca)&&MEDICAL.test(cb))return {classification:'AMBIGUOUS',reason:'HOSPITAL_CAMPUS_RELATIONSHIP_REQUIRES_REVIEW',signals:s};
 if(s.sameAddress&&s.distanceMeters<=30&&!(s.sameName||s.sameBrand||s.samePhone||s.sameWebsite||s.nearName))return {classification:'DISTINCT_POI',reason:'SAME_ADDRESS_DISTINCT_BUSINESS_PROTECTION',signals:s};
 if(s.distanceMeters<=100&&(s.sameBrand||s.sameAddress||s.nearName))return {classification:'AMBIGUOUS',reason:'MEDIUM_SIGNALS_REQUIRE_REVIEW',signals:s};
 return {classification:'DISTINCT_POI',reason:'INSUFFICIENT_IDENTITY_OVERLAP',signals:s};
}
export function blockKey(r){const lat=Math.floor(Number(r.latitude)*100),lon=Math.floor(Number(r.longitude)*100);return `${r.county_fips??r.countyFips??''}|${lat}|${lon}`;}
export function candidatePairs(records){const blocks=new Map;for(const r of [...records].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){const k=blockKey(r);const rows=blocks.get(k)??[];if(rows.length<MAX_BLOCK_MEMBERS)rows.push(r);blocks.set(k,rows);}const pairs=[];for(const [block,rows] of [...blocks].sort())for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++)if(distanceMeters(rows[i],rows[j])<=150)pairs.push({block,a:rows[i],b:rows[j]});return pairs;}
export function clusterId(ids){return `idc-${crypto.createHash('sha256').update([...ids].sort().join('\n')).digest('hex').slice(0,16)}`;}
export function selectParent(records){const ranked=records.map(r=>({r,parent:PARENT.test(`${name(r)} ${categories(r)}`),child:!!childFamily(r),complete:[address(r),phone(r),domain(r)].filter(Boolean).length})).sort((a,b)=>Number(b.parent)-Number(a.parent)||Number(a.child)-Number(b.child)||b.complete-a.complete||String(a.r.id).localeCompare(String(b.r.id)));if(!ranked.length||(!ranked[0].parent&&ranked.length>1&&ranked[0].complete===ranked[1].complete))return {selectedParentId:null,reason:'NO_DETERMINISTIC_PARENT',classification:'AMBIGUOUS'};return {selectedParentId:ranked[0].r.id,reason:ranked[0].parent?'EXPLICIT_PARENT_ROLE':'METADATA_COMPLETENESS_THEN_OVERTURE_ID',classification:'PARENT_POI'};}
export function project(records,dispositions){const byId=new Map(dispositions.map(d=>[d.id,d.classification]));let child=0,duplicate=0,ambiguous=0,distinct=0,parent=0;for(const r of records){const c=byId.get(r.id)??'DISTINCT_POI';if(c==='CHILD_POI')child++;else if(c==='LIKELY_DUPLICATE')duplicate++;else if(c==='AMBIGUOUS')ambiguous++;else if(c==='PARENT_POI')parent++;else distinct++;}return {rawEligibleCount:records.length,parentDestinationCount:parent,childPoiCount:child,likelyDuplicateCount:duplicate,distinctPoiCount:distinct,ambiguousCount:ambiguous,identityGovernedStandaloneCount:records.length-child-duplicate,suppressedChildCount:child,suppressedDuplicateMemberCount:duplicate,ambiguousRetainedCount:ambiguous};}
export function detectInputs(directory='owner-local/lp24111'){return ['overture-texas-normalized-poi-v2.parquet','overture-texas-normalized-poi.parquet'].map(f=>path.join(directory,f)).find(fs.existsSync)??null;}
export function execute({directory='owner-local/lp24111'}={}){const input=detectInputs(directory);if(!input)throw Error('D.3 requires an existing owner-local normalized Parquet; no Overture refetch or normalization rerun was attempted.');throw Error(`D.3 owner executor requires DuckDB adapter for ${input}; source was left unchanged.`);}
if(process.argv.includes('--execute')){try{execute();}catch(e){console.error(e.message);process.exitCode=1;}}
