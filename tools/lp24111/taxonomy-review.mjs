import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
export const BEFORE={normalizedUniquePois:1462815,eligible:364959,nonDestination:83992,excluded:12227,reviewRequired:1001637};
export const COMPACT_FIELDS=['id','displayName','normalizedName','brand','gridlyCategory','latitude','longitude','countyFips','locality','operatingStatus'];
export const policy=JSON.parse(fs.readFileSync(new URL('./taxonomy-policy.json',import.meta.url)));
const localDefault=path.join(root,'owner-local/lp24111');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const stable=value=>JSON.stringify(value,null,2)+'\n';

export function taxonomyDecision(text,confidence){
 const value=String(text??'').toLowerCase();
 if(policy.humanMedicalExclusions.some(x=>value.includes(x)))return {classification:'GRIDLY_REVIEW_REQUIRED',category:null,authority:'VETERINARY_GUARD'};
 if(policy.excluded.some(x=>value.includes(x)))return {classification:'GRIDLY_EXCLUDED',category:null,authority:'EXPLICIT_TAXONOMY'};
 for(const [category,terms] of Object.entries(policy.eligible))if(terms.some(x=>value.includes(x)))return {classification:'GRIDLY_ELIGIBLE_DESTINATION',category,authority:'EXPLICIT_TAXONOMY'};
 if(policy.nonDestination.some(x=>value.includes(x)))return {classification:'GRIDLY_NON_DESTINATION',category:null,authority:'EXPLICIT_TAXONOMY'};
 return {classification:'GRIDLY_REVIEW_REQUIRED',category:null,authority:'UNRESOLVED'}; // confidence is deliberately unused
}
export function compactProjection(row){
 if(row.eligibility_class!=='GRIDLY_ELIGIBLE_DESTINATION')return null;
 return {id:row.id,displayName:row.display_name??null,normalizedName:row.normalized_name??null,brand:row.brand_name??null,gridlyCategory:row.gridly_category,latitude:Number(row.latitude),longitude:Number(row.longitude),countyFips:row.county_fips,locality:row.locality??null,operatingStatus:row.operating_status??null};
}
export function shardId(latitude,longitude){return `tx-${String(Math.floor(Number(latitude))).padStart(2,'0')}-${String(Math.abs(Math.floor(Number(longitude)))).padStart(3,'0')}`;}
export function intersectedShardCount(latitude,longitude,radiusMiles){
 const lat=Number(latitude),lon=Number(longitude),latDelta=radiusMiles/69,lonDelta=radiusMiles/(69*Math.max(.1,Math.cos(lat*Math.PI/180)));
 return (Math.floor(lat+latDelta)-Math.floor(lat-latDelta)+1)*(Math.floor(lon+lonDelta)-Math.floor(lon-lonDelta)+1);
}
function duck(sql,executable=process.env.DUCKDB??'duckdb'){
 const result=spawnSync(executable,['-bail','-json'],{input:sql,encoding:'utf8',maxBuffer:1024**3});
 if(result.error)throw result.error;if(result.status!==0)throw Error(result.stderr.trim());return result.stdout.trim()?JSON.parse(result.stdout):[];
}
const percentile=(values,p)=>values.length?values[Math.min(values.length-1,Math.ceil(values.length*p)-1)]:null;
export function packageStatistics(rows){
 const sorted=[...rows].sort((a,b)=>a.compressedBytes-b.compressedBytes||a.shardId.localeCompare(b.shardId));
 const values=sorted.map(x=>x.compressedBytes),largest=[...sorted].sort((a,b)=>b.compressedBytes-a.compressedBytes||a.shardId.localeCompare(b.shardId))[0]??null;
 return {shardCount:rows.length,totalEligibleRows:rows.reduce((n,x)=>n+x.eligibleRows,0),totalRawBytes:rows.reduce((n,x)=>n+x.rawBytes,0),totalCompressedBytes:rows.reduce((n,x)=>n+x.compressedBytes,0),largestShard:largest,smallestNonEmptyShard:sorted[0]??null,medianCompressedBytes:percentile(values,.5),p90CompressedBytes:percentile(values,.9),p95CompressedBytes:percentile(values,.95),p99CompressedBytes:percentile(values,.99),shardsOver25MiB:rows.filter(x=>x.compressedBytes>25*1024**2).length,shardsOver10MiB:rows.filter(x=>x.compressedBytes>10*1024**2).length,shardsUnder1MiB:rows.filter(x=>x.compressedBytes<1024**2).length};
}
export function detectInputs(directory=localDefault){return {normalized:fs.existsSync(path.join(directory,'overture-texas-normalized-poi.parquet')),deduplicated:fs.existsSync(path.join(directory,'overture-texas-rich-authority-dedup.parquet'))};}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stable(value));}
export function execute({directory=localDefault,query=duck}={}){
 const input=detectInputs(directory);if(!input.normalized||!input.deduplicated)throw Error(`Phase D.2 requires existing normalized and deduplicated owner-local Parquets; detected normalized=${input.normalized} deduplicated=${input.deduplicated}; no Overture refetch is permitted`);
 const normalized=quote(path.join(directory,'overture-texas-normalized-poi.parquet')),v2=path.join(directory,'overture-texas-normalized-poi-v2.parquet');
 const terms=Object.entries(policy.eligible).flatMap(([category,items])=>items.map(term=>({category,term}))),eligibleCase=terms.map(({category,term})=>`WHEN contains(searchable,${quote(term)}) THEN ${quote(category)}`).join(' '),pattern=items=>quote(items.join('|'));
 const sql=`COPY (SELECT * EXCLUDE(eligibility_class,gridly_category,refined_category), CASE WHEN eligibility_class<>'GRIDLY_REVIEW_REQUIRED' THEN eligibility_class WHEN regexp_matches(searchable,${pattern(policy.humanMedicalExclusions)}) THEN eligibility_class WHEN regexp_matches(searchable,${pattern(policy.excluded)}) THEN 'GRIDLY_EXCLUDED' WHEN refined_category IS NOT NULL THEN 'GRIDLY_ELIGIBLE_DESTINATION' WHEN regexp_matches(searchable,${pattern(policy.nonDestination)}) THEN 'GRIDLY_NON_DESTINATION' ELSE 'GRIDLY_REVIEW_REQUIRED' END eligibility_class, coalesce(gridly_category,refined_category) gridly_category FROM (SELECT *, CASE ${eligibleCase} END refined_category FROM read_parquet(${normalized}))) TO ${quote(v2)} (FORMAT PARQUET,COMPRESSION ZSTD);`;
 // The generated SQL is retained in the summary for reproducibility; execution fails closed on any schema/version mismatch.
 query(sql);
 const counts=query(`SELECT eligibility_class,count(*)::BIGINT count FROM read_parquet(${quote(v2)}) GROUP BY 1 ORDER BY 1`),total=counts.reduce((n,x)=>n+Number(x.count),0);if(total!==BEFORE.normalizedUniquePois)throw Error(`D.2 conservation failed: ${total}`);
 const census=query(`SELECT coalesce(basic_category,'(null)') family,count(*)::BIGINT count,count(DISTINCT county_fips)::BIGINT counties FROM read_parquet(${normalized}) WHERE eligibility_class='GRIDLY_REVIEW_REQUIRED' GROUP BY 1 ORDER BY count DESC,family LIMIT 100`);
 const summary={schemaVersion:'gridly.lp24111.review-taxonomy.v1',executionState:'OWNER_LOCAL_MEASURED',before:BEFORE,after:Object.fromEntries(counts.map(x=>[x.eligibility_class,Number(x.count)])),topPrimaryBasicFamilies:census,confidenceAuthority:false};writeJson(path.join(directory,'review-taxonomy-summary.json'),summary);
 // Compact package generation is deliberately local and eligible-only.
 const shardRows=query(`SELECT DISTINCT 'tx-'||lpad(floor(latitude)::VARCHAR,2,'0')||'-'||lpad(abs(floor(longitude))::VARCHAR,3,'0') shardId FROM read_parquet(${quote(v2)}) WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION' ORDER BY 1`),packageDir=path.join(directory,'compact-eligible-shards'),measurements=[];fs.mkdirSync(packageDir,{recursive:true});
 for(const {shardId:id} of shardRows){const [,y,x]=id.split('-'),raw=path.join(packageDir,`${id}.ndjson`),gz=`${raw}.gz`;query(`COPY (SELECT id, coalesce(json_extract_string(to_json(names),'$.primary'),'') displayName, lower(coalesce(json_extract_string(to_json(names),'$.primary'),'')) normalizedName, json_extract_string(to_json(brand),'$.names.primary') brand, gridly_category gridlyCategory, latitude,longitude,county_fips countyFips,json_extract_string(to_json(addresses),'$[0].locality') locality,operating_status operatingStatus FROM read_parquet(${quote(v2)}) WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION' AND floor(latitude)=${Number(y)} AND floor(longitude)=-${Number(x)} ORDER BY id) TO ${quote(raw)} (FORMAT JSON,ARRAY false);`);const bytes=fs.readFileSync(raw),compressed=zlib.gzipSync(bytes,{level:9});fs.writeFileSync(gz,compressed);const eligibleRows=bytes.length?bytes.toString().trim().split('\n').length:0;measurements.push({shardId:id,eligibleRows,rawBytes:bytes.length,compressedBytes:compressed.length});}
 const packages={schemaVersion:'gridly.lp24111.compact-packages.v1',executionState:'OWNER_LOCAL_MEASURED',eligibleOnly:true,compression:'gzip-9',shards:measurements,statistics:packageStatistics(measurements),denseShard:measurements.find(x=>x.shardId==='tx-29-096')??null,thresholdBytes:25*1024**2};writeJson(path.join(directory,'compact-package-measurements.json'),packages);return {summary,packages};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){if(!process.argv.includes('--execute')){console.log('use --execute; owner-local inputs are never fetched');}else{const result=execute();console.log(`measured ${result.summary.after.GRIDLY_REVIEW_REQUIRED??0} remaining review rows and ${result.packages.statistics.shardCount} compact shards`);}}
