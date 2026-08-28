import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {BEFORE,COMPACT_FIELDS,EXPECTED_PROMOTIONS,SHARD_ID_PATTERN,compactProjection,detectInputs,execute,intersectedShardCount,jsonReportField,jsonReportText,measurementQueries,packageMeasurementQueries,packageStatistics,policy,shardId,shardIdSql,taxonomyDecision} from '../tools/lp24111/taxonomy-review.mjs';

const read=name=>JSON.parse(fs.readFileSync(`reports/lp24111/${name}`));
test('D.2 baseline conserves the certified statewide authority',()=>assert.equal(BEFORE.eligible+BEFORE.nonDestination+BEFORE.excluded+BEFORE.reviewRequired,BEFORE.normalizedUniquePois));
test('taxonomy decisions are explicit, deterministic, and never confidence-only',()=>{
 assert.deepEqual(taxonomyDecision('hardware_store',.01),taxonomyDecision('hardware_store',.99));
 assert.equal(taxonomyDecision('hardware_store',.99).classification,'GRIDLY_ELIGIBLE_DESTINATION');
 assert.equal(taxonomyDecision('unmapped mystery',.999).classification,'GRIDLY_REVIEW_REQUIRED');
 assert.equal(taxonomyDecision('veterinarian animal_hospital pharmacy',.999).classification,'GRIDLY_REVIEW_REQUIRED');
 assert.equal(taxonomyDecision('mountain natural_feature',.999).classification,'GRIDLY_EXCLUDED');
 assert.equal(policy.policy,'EXPLICIT_TAXONOMY_ONLY_CONFIDENCE_NEVER_CLASSIFIES');
});
test('compact projection is eligible-only and has exactly the governed schema',()=>{
 assert.equal(compactProjection({eligibility_class:'GRIDLY_REVIEW_REQUIRED'}),null);
 const projected=compactProjection({eligibility_class:'GRIDLY_ELIGIBLE_DESTINATION',id:'a',display_name:'A',normalized_name:'a',brand_name:null,gridly_category:'FUEL',latitude:30,longitude:-95,county_fips:'48001',locality:'X',operating_status:'open'});
 assert.deepEqual(Object.keys(projected),COMPACT_FIELDS);assert.equal(projected.gridlyCategory,'FUEL');
});
test('package measurements report actual compression thresholds and dense shards deterministically',()=>{
 const rows=[{shardId:'tx-29-096',eligibleRows:20,rawBytes:40,compressedBytes:30*1024**2},{shardId:'tx-30-100',eligibleRows:2,rawBytes:4,compressedBytes:500}];
 const stats=packageStatistics(rows);assert.equal(stats.totalEligibleRows,22);assert.equal(stats.shardsOver25MiB,1);assert.equal(stats.shardsUnder1MiB,1);assert.equal(stats.largestShard.shardId,'tx-29-096');
 assert.equal(shardId(29.2,-95.8),'tx-29-096');assert.ok(intersectedShardCount(30,-95,25)>=intersectedShardCount(30,-95,5));
});
test('D.2C fixes the measured promotion gate and canonical package identities',()=>{
 assert.equal(EXPECTED_PROMOTIONS,28079);
 assert.deepEqual([[29.2,-95.8],[29.1,-98.2],[32.5,-96.1],[33.4,-94.2]].map(x=>shardId(...x)),['tx-29-096','tx-29-099','tx-32-097','tx-33-095']);
 for(const id of ['tx-29-096','tx-29-099','tx-32-097','tx-33-095','tx-33-100'])assert.match(id,SHARD_ID_PATTERN);
 assert.doesNotMatch('tx-29-96.',SHARD_ID_PATTERN);
 assert.match(shardIdSql(),/printf\('%02d'/);assert.match(shardIdSql(),/printf\('%03d'/);
});
test('absent owner-local inputs remain truthful rather than fabricating D.2 measurements',()=>{
 const found=detectInputs();if(!found.normalized||!found.deduplicated){assert.equal(read('review-taxonomy-census.json').executionState,'NOT_EXECUTED');assert.equal(read('compact-package-measurements.json').statistics,null);}
 assert.equal(read('normalization-summary.json').executionState,'OWNER_LOCAL_MEASURED');
 assert.equal(read('certification.json').productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
});
test('D.2 tooling does not alter or activate protected production systems',()=>{
 const source=fs.readFileSync('tools/lp24111/taxonomy-review.mjs','utf8');assert.doesNotMatch(source,/cloudflare|supabase|deploy/i);assert.doesNotMatch(source,/\bfetch\s*\(|https?:\/\//i);assert.doesNotMatch(fs.readFileSync('js/app.js','utf8'),/compact-eligible-shards|lp24111-taxonomy/i);
});
test('every centralized D.2 measurement query uses explicit aliases',()=>{
 const sql={...measurementQueries({normalized:"'normalized.parquet'",v2:"'v2.parquet'"}),...packageMeasurementQueries([{shardId:'tx-29-096',eligibleRows:1,rawBytes:2,compressedBytes:1}])};
 for(const [name,text] of Object.entries(sql)){assert.match(text,/\bAS\s+[a-z_][a-z0-9_]*/i,name);assert.doesNotMatch(text,/\)\s+(family|count|category|hierarchy|name|brand|county|density|decision|classification|rows|bytes|compressed|shard|minimum|median|p90|p95|p99|maximum|raw|eligible|review|excluded|nonDestination|fanout|radius)\b/i,name);}
});
test('complex report expressions explicitly cross the JSON-to-text boundary',()=>{
 assert.equal(jsonReportText('taxonomy'),'CAST(to_json(taxonomy) AS VARCHAR)');
 for(const value of ['categories','brand','addresses','names'])assert.match(jsonReportField(value,'$.primary'),new RegExp(`^json_extract_string\\(CAST\\(to_json\\(${value}\\) AS VARCHAR\\),`));
 const queries=measurementQueries({normalized:"'normalized.parquet'",v2:"'v2.parquet'"});
 assert.match(queries.hierarchy,/coalesce\(CAST\(to_json\(taxonomy\) AS VARCHAR\),'\(null\)'\)/i);
 assert.doesNotMatch(queries.hierarchy,/coalesce\(to_json\(/i);
 for(const name of ['primaryCategory','hierarchy','nameCategory'])assert.doesNotMatch(queries[name],/coalesce\(to_json\([^)]*\),\s*'/i,name);
});
test('actual centralized D.2 query families parse and return their DuckDB contracts',t=>{
 const executable=process.env.DUCKDB??'duckdb',version=spawnSync(executable,['--version'],{encoding:'utf8'});if(version.error?.code==='ENOENT')return t.skip('DuckDB CLI is not installed in this environment');assert.equal(version.status,0,version.stderr);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-d2-sql-')),normalized=path.join(dir,'normalized.parquet'),v2=path.join(dir,'v2.parquet'),q=value=>`'${value.replaceAll("'","''")}'`;
 const fixture=`COPY (SELECT * FROM (VALUES ('a','48001','GRIDLY_REVIEW_REQUIRED',NULL,'hardware_store',struct_pack(primary := 'Hardware'),struct_pack(primary := 'Hardware'),struct_pack(primary := 'Ace'),struct_pack(names := struct_pack(primary := 'Ace')),[struct_pack(locality := 'Town')],['x'],['1'],29.2,-95.8),('b','48003','GRIDLY_REVIEW_REQUIRED',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,30.1,-96.1),('c','48005','GRIDLY_ELIGIBLE_DESTINATION','FUEL','fuel',struct_pack(primary := 'Fuel'),struct_pack(primary := 'Fuel'),struct_pack(primary := 'Stop'),NULL,NULL,NULL,NULL,30.2,-96.2)) AS t(id,county_fips,eligibility_class,gridly_category,basic_category,taxonomy,categories,names,brand,addresses,websites,phones,latitude,longitude)) TO ${q(normalized)} (FORMAT PARQUET); COPY (SELECT * FROM read_parquet(${q(normalized)})) TO ${q(v2)} (FORMAT PARQUET);`;
 let result=spawnSync(executable,['-bail'],{input:fixture,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 const queries=measurementQueries({normalized:q(normalized),v2:q(v2)}),contracts={basicCategory:['family_name','record_count','county_count'],primaryCategory:['category_name','record_count'],hierarchy:['hierarchy_value','record_count'],nameCategory:['place_name','category_name','record_count'],presence:['record_count','name_present_count','brand_present_count','address_present_count','contact_present_count'],countyDensity:['county_fips_code','review_record_count','records_per_occupied_degree'],classification:['classification_name','record_count'],searchFanout:['radius_miles','minimum_shard_count','median_shard_count','maximum_shard_count']};
 for(const [name,sql] of Object.entries(queries)){result=spawnSync(executable,['-bail','-json'],{input:sql,encoding:'utf8'});assert.equal(result.status,0,`${name}: ${result.stderr}`);const rows=JSON.parse(result.stdout);assert.ok(rows.length,name);assert.deepEqual(Object.keys(rows[0]),contracts[name],name);}
 result=spawnSync(executable,['-bail','-json'],{input:`SELECT hierarchy_value, typeof(hierarchy_value) AS value_type FROM (${queries.hierarchy}) ORDER BY hierarchy_value`,encoding:'utf8'});assert.equal(result.status,0,result.stderr);const hierarchyRows=JSON.parse(result.stdout);assert.ok(hierarchyRows.some(row=>row.hierarchy_value==='(null)'));assert.ok(hierarchyRows.some(row=>row.hierarchy_value.includes('Hardware')));assert.ok(hierarchyRows.every(row=>row.value_type==='VARCHAR'));
 const packageContracts={statistics:['shard_count','eligible_row_count','raw_byte_count','compressed_byte_count','minimum_compressed_bytes','median_compressed_bytes','p90_compressed_bytes','p95_compressed_bytes','p99_compressed_bytes','maximum_compressed_bytes'],thresholds:['over_25_mib_count','over_10_mib_count','under_1_mib_count'],denseShard:['shard_id','eligible_row_count','raw_byte_count','compressed_byte_count']};
 for(const [name,sql] of Object.entries(packageMeasurementQueries([{shardId:'tx-29-096',eligibleRows:2,rawBytes:20,compressedBytes:10}]))){result=spawnSync(executable,['-bail','-json'],{input:sql,encoding:'utf8'});assert.equal(result.status,0,`${name}: ${result.stderr}`);assert.deepEqual(Object.keys(JSON.parse(result.stdout)[0]),packageContracts[name],name);}
});
test('D.2 fails at the first named measurement stage and writes no measured envelope',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-d2-fail-'));for(const file of ['overture-texas-normalized-poi.parquet','overture-texas-rich-authority-dedup.parquet'])fs.writeFileSync(path.join(dir,file),'certified input');const calls=[];
 assert.throws(()=>execute({directory:dir,query:sql=>{calls.push(sql);if(calls.length===1)return [];throw Error('alias parser defect');}}),/Stage TAXONOMY_BASIC_CENSUS failed; DuckDB: alias parser defect/);assert.equal(calls.length,2);assert.equal(fs.existsSync(path.join(dir,'review-taxonomy-summary.json')),false);assert.equal(fs.existsSync(path.join(dir,'compact-package-measurements.json')),false);for(const file of ['overture-texas-normalized-poi.parquet','overture-texas-rich-authority-dedup.parquet'])assert.equal(fs.readFileSync(path.join(dir,file),'utf8'),'certified input');
});
test('D.2 hierarchy failure remains fail-fast and preserves certified inputs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-d2-hierarchy-fail-')),inputs=['overture-texas-normalized-poi.parquet','overture-texas-rich-authority-dedup.parquet'];for(const file of inputs)fs.writeFileSync(path.join(dir,file),'certified input');const calls=[];
 assert.throws(()=>execute({directory:dir,query:sql=>{calls.push(sql);if(calls.length<4)return [];throw Error('hierarchy defect');}}),/Stage TAXONOMY_HIERARCHY_CENSUS failed; DuckDB: hierarchy defect/);assert.equal(calls.length,4);for(const file of inputs)assert.equal(fs.readFileSync(path.join(dir,file),'utf8'),'certified input');assert.equal(fs.existsSync(path.join(dir,'review-taxonomy-summary.json')),false);assert.equal(fs.existsSync(path.join(dir,'compact-package-measurements.json')),false);
});
