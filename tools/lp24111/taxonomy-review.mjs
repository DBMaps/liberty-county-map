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
// DuckDB's to_json returns JSON, so cast before combining a complex value with
// report labels.  Keeping this in the shared query builder prevents a VARCHAR
// fallback from being implicitly parsed as JSON.
export const jsonReportText=value=>`CAST(to_json(${value}) AS VARCHAR)`;
export const jsonReportField=(value,jsonPath)=>`json_extract_string(${jsonReportText(value)},${quote(jsonPath)})`;

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
export function measurementQueries({normalized,v2}){
 const review=`FROM read_parquet(${normalized}) WHERE eligibility_class='GRIDLY_REVIEW_REQUIRED'`;
 return {
  basicCategory:`SELECT coalesce(basic_category,'(null)') AS family_name, count(*)::BIGINT AS record_count, count(DISTINCT county_fips)::BIGINT AS county_count ${review} GROUP BY 1 ORDER BY record_count DESC, family_name LIMIT 100`,
  primaryCategory:`SELECT coalesce(${jsonReportField('categories','$.primary')},'(null)') AS category_name, count(*)::BIGINT AS record_count ${review} GROUP BY 1 ORDER BY record_count DESC, category_name LIMIT 100`,
  hierarchy:`SELECT coalesce(${jsonReportText('taxonomy')},'(null)') AS hierarchy_value, count(*)::BIGINT AS record_count ${review} GROUP BY 1 ORDER BY record_count DESC, hierarchy_value LIMIT 100`,
  nameCategory:`SELECT coalesce(${jsonReportField('names','$.primary')},'(null)') AS place_name, coalesce(basic_category,'(null)') AS category_name, count(*)::BIGINT AS record_count ${review} GROUP BY 1,2 ORDER BY record_count DESC, place_name, category_name LIMIT 100`,
  presence:`SELECT count(*)::BIGINT AS record_count, count(*) FILTER (WHERE names IS NOT NULL)::BIGINT AS name_present_count, count(*) FILTER (WHERE brand IS NOT NULL)::BIGINT AS brand_present_count, count(*) FILTER (WHERE addresses IS NOT NULL)::BIGINT AS address_present_count, count(*) FILTER (WHERE websites IS NOT NULL OR phones IS NOT NULL)::BIGINT AS contact_present_count ${review}`,
  countyDensity:`SELECT county_fips AS county_fips_code, count(*)::BIGINT AS review_record_count, count(*)/greatest(count(DISTINCT floor(latitude)||':'||floor(longitude)),1)::DOUBLE AS records_per_occupied_degree ${review} GROUP BY 1 ORDER BY review_record_count DESC, county_fips_code`,
  classification:`SELECT eligibility_class AS classification_name, count(*)::BIGINT AS record_count FROM read_parquet(${v2}) GROUP BY 1 ORDER BY classification_name`,
  searchFanout:`WITH radii(radius_miles) AS (VALUES (5),(10),(25),(50)), eligible AS (SELECT latitude, longitude FROM read_parquet(${v2}) WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION') SELECT radius_miles AS radius_miles, min((floor(latitude+radius_miles/69.0)-floor(latitude-radius_miles/69.0)+1)*(floor(longitude+radius_miles/(69.0*greatest(.1,cos(latitude*pi()/180))))-floor(longitude-radius_miles/(69.0*greatest(.1,cos(latitude*pi()/180))))+1))::BIGINT AS minimum_shard_count, median((floor(latitude+radius_miles/69.0)-floor(latitude-radius_miles/69.0)+1)*(floor(longitude+radius_miles/(69.0*greatest(.1,cos(latitude*pi()/180))))-floor(longitude-radius_miles/(69.0*greatest(.1,cos(latitude*pi()/180))))+1))::DOUBLE AS median_shard_count, max((floor(latitude+radius_miles/69.0)-floor(latitude-radius_miles/69.0)+1)*(floor(longitude+radius_miles/(69.0*greatest(.1,cos(latitude*pi()/180))))-floor(longitude-radius_miles/(69.0*greatest(.1,cos(latitude*pi()/180))))+1))::BIGINT AS maximum_shard_count FROM eligible CROSS JOIN radii GROUP BY radius_miles ORDER BY radius_miles`
 };
}
export function packageMeasurementQueries(rows){
 const values=rows.length?rows.map(x=>`(${quote(x.shardId)},${Number(x.eligibleRows)},${Number(x.rawBytes)},${Number(x.compressedBytes)})`).join(','):`(NULL::VARCHAR,0::BIGINT,0::BIGINT,0::BIGINT)`;
 const data=`WITH measurements(shard_id,eligible_rows,raw_bytes,compressed_bytes) AS (VALUES ${values})`;
 return {
  statistics:`${data} SELECT count(*) FILTER (WHERE shard_id IS NOT NULL)::BIGINT AS shard_count, sum(eligible_rows)::BIGINT AS eligible_row_count, sum(raw_bytes)::BIGINT AS raw_byte_count, sum(compressed_bytes)::BIGINT AS compressed_byte_count, min(compressed_bytes)::BIGINT AS minimum_compressed_bytes, median(compressed_bytes)::DOUBLE AS median_compressed_bytes, quantile_disc(compressed_bytes,.90)::BIGINT AS p90_compressed_bytes, quantile_disc(compressed_bytes,.95)::BIGINT AS p95_compressed_bytes, quantile_disc(compressed_bytes,.99)::BIGINT AS p99_compressed_bytes, max(compressed_bytes)::BIGINT AS maximum_compressed_bytes FROM measurements WHERE shard_id IS NOT NULL`,
  thresholds:`${data} SELECT count(*) FILTER (WHERE compressed_bytes>25*1024*1024)::BIGINT AS over_25_mib_count, count(*) FILTER (WHERE compressed_bytes>10*1024*1024)::BIGINT AS over_10_mib_count, count(*) FILTER (WHERE compressed_bytes<1024*1024)::BIGINT AS under_1_mib_count FROM measurements WHERE shard_id IS NOT NULL`,
  denseShard:`${data} SELECT shard_id AS shard_id, eligible_rows AS eligible_row_count, raw_bytes AS raw_byte_count, compressed_bytes AS compressed_byte_count FROM measurements WHERE shard_id='tx-29-096'`
 };
}
export function execute({directory=localDefault,query=duck}={}){
 const input=detectInputs(directory);if(!input.normalized||!input.deduplicated)throw Error(`Phase D.2 requires existing normalized and deduplicated owner-local Parquets; detected normalized=${input.normalized} deduplicated=${input.deduplicated}; no Overture refetch is permitted`);
 const normalized=quote(path.join(directory,'overture-texas-normalized-poi.parquet')),v2Path=path.join(directory,'overture-texas-normalized-poi-v2.parquet'),v2=quote(v2Path),summaryPath=path.join(directory,'review-taxonomy-summary.json'),packagesPath=path.join(directory,'compact-package-measurements.json'),packageDir=path.join(directory,'compact-eligible-shards');
 for(const output of [summaryPath,packagesPath])if(fs.existsSync(output))fs.rmSync(output);if(fs.existsSync(v2Path))fs.rmSync(v2Path);if(fs.existsSync(packageDir))fs.rmSync(packageDir,{recursive:true,force:true});
 const run=(stage,sql)=>{try{return query(sql);}catch(error){throw Error(`Stage ${stage} failed; DuckDB: ${error.message}`);}};
 try{
  const terms=Object.entries(policy.eligible).flatMap(([category,items])=>items.map(term=>({category,term}))),eligibleCase=terms.map(({category,term})=>`WHEN contains(searchable,${quote(term)}) THEN ${quote(category)}`).join(' '),pattern=items=>quote(items.join('|'));
  const resolutionSql=`COPY (SELECT * EXCLUDE(eligibility_class,gridly_category,refined_category), CASE WHEN eligibility_class<>'GRIDLY_REVIEW_REQUIRED' THEN eligibility_class WHEN regexp_matches(searchable,${pattern(policy.humanMedicalExclusions)}) THEN eligibility_class WHEN regexp_matches(searchable,${pattern(policy.excluded)}) THEN 'GRIDLY_EXCLUDED' WHEN refined_category IS NOT NULL THEN 'GRIDLY_ELIGIBLE_DESTINATION' WHEN regexp_matches(searchable,${pattern(policy.nonDestination)}) THEN 'GRIDLY_NON_DESTINATION' ELSE 'GRIDLY_REVIEW_REQUIRED' END AS eligibility_class, coalesce(gridly_category,refined_category) AS gridly_category FROM (SELECT *, CASE ${eligibleCase} END AS refined_category FROM read_parquet(${normalized}))) TO ${v2} (FORMAT PARQUET,COMPRESSION ZSTD);`;
  run('TAXONOMY_RESOLUTION',resolutionSql);
  const queries=measurementQueries({normalized,v2});
  const basic=run('TAXONOMY_BASIC_CENSUS',queries.basicCategory),primary=run('TAXONOMY_PRIMARY_CENSUS',queries.primaryCategory),hierarchy=run('TAXONOMY_HIERARCHY_CENSUS',queries.hierarchy),nameCategory=run('TAXONOMY_NAME_CATEGORY_CENSUS',queries.nameCategory),presence=run('TAXONOMY_BRAND_CENSUS',queries.presence),counties=run('TAXONOMY_COUNTY_CENSUS',queries.countyDensity),counts=run('TAXONOMY_CLASSIFICATION_CONSERVATION',queries.classification);
  const total=counts.reduce((n,x)=>n+Number(x.record_count),0);if(total!==BEFORE.normalizedUniquePois)throw Error(`Stage TAXONOMY_CLASSIFICATION_CONSERVATION failed; D.2 conservation expected ${BEFORE.normalizedUniquePois}, got ${total}`);
  const summary={schemaVersion:'gridly.lp24111.review-taxonomy.v1',executionState:'OWNER_LOCAL_MEASURED',before:BEFORE,after:Object.fromEntries(counts.map(x=>[x.classification_name,Number(x.record_count)])),topPrimaryBasicFamilies:basic,primaryCategoryCensus:primary,hierarchyCensus:hierarchy,nameCategoryCensus:nameCategory,presenceCensus:presence,countyDensityCensus:counties,confidenceAuthority:false};
  const shardRows=run('COMPACT_PACKAGE_MATERIALIZATION',`SELECT DISTINCT 'tx-'||lpad(floor(latitude)::VARCHAR,2,'0')||'-'||lpad(abs(floor(longitude))::VARCHAR,3,'0') AS shard_id FROM read_parquet(${v2}) WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION' ORDER BY shard_id`),measurements=[];fs.mkdirSync(packageDir,{recursive:true});
  for(const {shard_id:id} of shardRows){const [,y,x]=id.split('-'),raw=path.join(packageDir,`${id}.ndjson`),gz=`${raw}.gz`;run('COMPACT_PACKAGE_MATERIALIZATION',`COPY (SELECT id AS id, coalesce(${jsonReportField('names','$.primary')},'') AS displayName, lower(coalesce(${jsonReportField('names','$.primary')},'')) AS normalizedName, ${jsonReportField('brand','$.names.primary')} AS brand, gridly_category AS gridlyCategory, latitude AS latitude, longitude AS longitude, county_fips AS countyFips, ${jsonReportField('addresses','$[0].locality')} AS locality, operating_status AS operatingStatus FROM read_parquet(${v2}) WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION' AND floor(latitude)=${Number(y)} AND floor(longitude)=-${Number(x)} ORDER BY id) TO ${quote(raw)} (FORMAT JSON,ARRAY false);`);const bytes=fs.readFileSync(raw),compressed=zlib.gzipSync(bytes,{level:9});fs.writeFileSync(gz,compressed);measurements.push({shardId:id,eligibleRows:bytes.length?bytes.toString().trim().split('\n').length:0,rawBytes:bytes.length,compressedBytes:compressed.length});}
  const packageQueries=packageMeasurementQueries(measurements),statisticsRows=run('COMPACT_PACKAGE_MEASUREMENT',packageQueries.statistics),thresholdRows=run('COMPACT_PACKAGE_MEASUREMENT',packageQueries.thresholds),denseRows=run('COMPACT_PACKAGE_MEASUREMENT',packageQueries.denseShard),fanout=run('SEARCH_FANOUT_MEASUREMENT',queries.searchFanout);
  const packages={schemaVersion:'gridly.lp24111.compact-packages.v1',executionState:'OWNER_LOCAL_MEASURED',eligibleOnly:true,compression:'gzip-9',shards:measurements,statistics:packageStatistics(measurements),sqlStatistics:statisticsRows[0]??null,thresholdStatistics:thresholdRows[0]??null,denseShard:denseRows[0]??null,searchFanout:fanout,thresholdBytes:25*1024**2};
  writeJson(summaryPath,summary);writeJson(packagesPath,packages);return {summary,packages};
 }catch(error){for(const output of [summaryPath,packagesPath,v2Path])if(fs.existsSync(output))fs.rmSync(output);if(fs.existsSync(packageDir))fs.rmSync(packageDir,{recursive:true,force:true});throw error;}
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){if(!process.argv.includes('--execute')){console.log('use --execute; owner-local inputs are never fetched');}else{const result=execute();console.log(`measured ${result.summary.after.GRIDLY_REVIEW_REQUIRED??0} remaining review rows and ${result.packages.statistics.shardCount} compact shards`);}}
