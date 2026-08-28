import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
const local=path.join(root,'owner-local/lp24111');
const reports=path.join(root,'reports/lp24111');
const releaseId='2026-08-19.0';
const q=x=>`'${String(x).replaceAll("'","''")}'`;
const parquetSource=files=>Array.isArray(files)?`[${files.map(q).join(',')}]`:q(files);
export const required={authority:'overture-texas-spatial-authority.geoparquet',assignment:'county-assignment-certification.parquet'};
export const expected={shards:168,inputRows:1462893,uniqueIds:1462815,multiShardIds:52,extraRows:78,maxOccurrences:4};
export const matchedColumns=['id','geometry','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources'];

export function detectInputs(directory=local){
 const files=fs.existsSync(directory)?fs.readdirSync(directory):[];
 const shards=files.filter(x=>/^tx-\d{2}-\d{3}\.authority-matched\.parquet$/.test(x)).sort();
 return {authority:fs.existsSync(path.join(directory,required.authority)),assignment:fs.existsSync(path.join(directory,required.assignment)),shards,ready:shards.length===expected.shards&&Object.values(required).every(x=>fs.existsSync(path.join(directory,x)))};
}
export function categoryFor(text){
 const s=String(text??'').toLowerCase();
 if(/veterinar|animal_hospital|animal_clinic|pet_wellness/.test(s))return null;
 const rules=[['EMERGENCY_CARE',/emergency_room|emergency_department/],['URGENT_CARE',/urgent_care/],['HOSPITAL',/(^|[^a-z])hospital/],['PHARMACY',/pharmacy/],['FUEL',/gas_station|fuel_station/],['EV_CHARGING',/charging_station|ev_charging/],['TRUCK_STOP',/truck_stop/],['CONVENIENCE_STORE',/convenience_store/],['GROCERY',/grocery_store|supermarket/],['RESTAURANT',/restaurant|fast_food|cafe/],['LODGING',/hotel|motel|lodge|resort/],['SCHOOL',/school/],['BANK',/(^|[^a-z])bank/],['ATM',/(^|[^a-z])atm/],['AUTO_REPAIR',/auto_repair|car_repair/],['TIRE_SERVICE',/tire_shop|tire_service/],['PARKING',/parking/],['AIRPORT',/airport/],['BUS_STATION',/bus_station/],['TRAIN_STATION',/train_station/],['POLICE',/police/],['FIRE',/fire_station/],['POST_OFFICE',/post_office/],['GOVERNMENT',/government/],['SHOPPING',/shopping_mall/],['GENERAL_RETAIL',/department_store|discount_store|general_store/],['AGRICULTURAL_SERVICE',/agricultural_service|farm_supply/]];
 return rules.find(([,re])=>re.test(s))?.[0]??null;
}
export function eligibilityFor(text){const s=String(text??'').toLowerCase();if(/mountain|river|structure_and_geography|natural_feature|waterfall|glacier|volcano|forest|island/.test(s))return 'GRIDLY_EXCLUDED';if(categoryFor(s))return 'GRIDLY_ELIGIBLE_DESTINATION';if(/place_of_worship|residential|building|intersection|neighborhood|administrative/.test(s))return 'GRIDLY_NON_DESTINATION';return 'GRIDLY_REVIEW_REQUIRED';}
export function duplicateWinner(rows){return [...rows].sort((a,b)=>String(a.shard).localeCompare(String(b.shard))||String(a.id).localeCompare(String(b.id)))[0];}

function duck(sql,options={}){const run=(options.spawn??spawnSync)(options.duckdb??process.env.DUCKDB??'duckdb',['-bail','-json'],{input:sql,encoding:'utf8',maxBuffer:1024**3});if(run.error)throw run.error;if(run.status!==0)throw Error(run.stderr?.trim()||`DuckDB exited ${run.status}`);return run.stdout?.trim()?JSON.parse(run.stdout):[];}
const queryOne=(sql,o)=>duck(sql,o)[0];
const number=(x,k)=>Number(x[k]);
function atomicJson(file,value){const tmp=`${file}.tmp-${process.pid}`;fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,file);}

export function normalizationStages(directory=local,populatedShards=null){
 const glob=path.join(directory,'tx-*.authority-matched.parquet'),richInput=parquetSource(populatedShards?.map(shard=>path.join(directory,shard))??glob),authority=path.join(directory,required.authority),assignment=path.join(directory,required.assignment);
 const dedup=path.join(directory,'overture-texas-rich-authority-dedup.parquet'),normalized=path.join(directory,'overture-texas-normalized-poi.parquet'),eligible=path.join(directory,'overture-texas-eligible-poi.parquet');
 const settings='LOAD spatial; SET preserve_insertion_order=false;';
 const ranked=`SELECT *, row_number() OVER(PARTITION BY id ORDER BY filename, to_json(struct_pack(names:=names,categories:=categories,brand:=brand,addresses:=addresses,sources:=sources))) rn, count(*) OVER(PARTITION BY id) occurrences, count(DISTINCT md5(to_json(struct_pack(names:=names,categories:=categories,brand:=brand,addresses:=addresses,confidence:=confidence,operating_status:=operating_status,sources:=sources)))) OVER(PARTITION BY id) content_versions FROM read_parquet(${richInput}, filename=true, union_by_name=true)`;
 const base=`SELECT r.*, a.county_fips, lower(to_json(struct_pack(categories:=r.categories,basic_category:=r.basic_category,taxonomy:=r.taxonomy,names:=r.names,brand:=r.brand))) searchable, ST_X(r.geometry) longitude, ST_Y(r.geometry) latitude FROM read_parquet(${q(dedup)}) r JOIN read_parquet(${q(assignment)}) a USING(id)`;
 const category=`SELECT *, CASE
 WHEN regexp_matches(searchable,'veterinar|animal_hospital|animal_clinic|pet_wellness') THEN NULL
 WHEN regexp_matches(searchable,'emergency_room|emergency_department') THEN 'EMERGENCY_CARE' WHEN regexp_matches(searchable,'urgent_care') THEN 'URGENT_CARE' WHEN regexp_matches(searchable,'hospital') THEN 'HOSPITAL' WHEN regexp_matches(searchable,'pharmacy') THEN 'PHARMACY'
 WHEN regexp_matches(searchable,'gas_station|fuel_station') THEN 'FUEL' WHEN regexp_matches(searchable,'charging_station|ev_charging') THEN 'EV_CHARGING' WHEN regexp_matches(searchable,'truck_stop') THEN 'TRUCK_STOP' WHEN regexp_matches(searchable,'convenience_store') THEN 'CONVENIENCE_STORE'
 WHEN regexp_matches(searchable,'grocery_store|supermarket') THEN 'GROCERY' WHEN regexp_matches(searchable,'restaurant|fast_food|cafe') THEN 'RESTAURANT' WHEN regexp_matches(searchable,'hotel|motel|lodge|resort') THEN 'LODGING' WHEN regexp_matches(searchable,'school') THEN 'SCHOOL'
 WHEN regexp_matches(searchable,'bank') THEN 'BANK' WHEN regexp_matches(searchable,'atm') THEN 'ATM' WHEN regexp_matches(searchable,'auto_repair|car_repair') THEN 'AUTO_REPAIR' WHEN regexp_matches(searchable,'tire_shop|tire_service') THEN 'TIRE_SERVICE' WHEN regexp_matches(searchable,'parking') THEN 'PARKING' WHEN regexp_matches(searchable,'airport') THEN 'AIRPORT' WHEN regexp_matches(searchable,'bus_station') THEN 'BUS_STATION' WHEN regexp_matches(searchable,'train_station') THEN 'TRAIN_STATION' WHEN regexp_matches(searchable,'police') THEN 'POLICE' WHEN regexp_matches(searchable,'fire_station') THEN 'FIRE' WHEN regexp_matches(searchable,'post_office') THEN 'POST_OFFICE' WHEN regexp_matches(searchable,'government') THEN 'GOVERNMENT' WHEN regexp_matches(searchable,'shopping_mall') THEN 'SHOPPING' WHEN regexp_matches(searchable,'department_store|discount_store|general_store') THEN 'GENERAL_RETAIL' WHEN regexp_matches(searchable,'agricultural_service|farm_supply') THEN 'AGRICULTURAL_SERVICE' END gridly_category FROM (${base}) base`;
 return [
  {name:'RICH_INPUT_READ',artifact:glob,sql:`${settings} SELECT count(*)::BIGINT row_count FROM read_parquet(${richInput}, filename=true, union_by_name=true);`},
  {name:'MATERIALIZE_DEDUP',artifact:dedup,sql:`${settings} COPY (SELECT * EXCLUDE(filename,rn) FROM (${ranked}) ranked WHERE rn=1 ORDER BY id) TO ${q(dedup)} (FORMAT PARQUET,COMPRESSION ZSTD,ROW_GROUP_SIZE 100000);`},
  {name:'MATERIALIZE_NORMALIZED',artifact:normalized,sql:`${settings} COPY (SELECT *, CASE WHEN regexp_matches(searchable,'mountain|river|structure_and_geography|natural_feature|waterfall|glacier|volcano|forest|island') THEN 'GRIDLY_EXCLUDED' WHEN gridly_category IS NOT NULL THEN 'GRIDLY_ELIGIBLE_DESTINATION' WHEN regexp_matches(searchable,'place_of_worship|residential|building|intersection|neighborhood|administrative') THEN 'GRIDLY_NON_DESTINATION' ELSE 'GRIDLY_REVIEW_REQUIRED' END eligibility_class FROM (${category}) normalized ORDER BY id) TO ${q(normalized)} (FORMAT PARQUET,COMPRESSION ZSTD,ROW_GROUP_SIZE 100000);`},
  {name:'MATERIALIZE_ELIGIBLE',artifact:eligible,sql:`${settings} COPY (SELECT * FROM read_parquet(${q(normalized)}) WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION' ORDER BY id) TO ${q(eligible)} (FORMAT PARQUET,COMPRESSION ZSTD,ROW_GROUP_SIZE 100000);`}
 ];
}

export function normalizationSql(directory=local){return normalizationStages(directory).map(x=>x.sql).join('\n');}

export function measurementQueries({glob,dedup,normalized,authority}){
 return {
  conservation:`WITH x AS (SELECT id, count(*) AS n, count(DISTINCT md5(to_json(struct_pack(names:=names,categories:=categories,brand:=brand,addresses:=addresses,confidence:=confidence,operating_status:=operating_status,sources:=sources)))) AS versions FROM read_parquet(${glob}) GROUP BY id) SELECT (SELECT count(*) FROM read_parquet(${glob})) AS input_rows, count(*) AS unique_ids, count(*) FILTER(WHERE n>1) AS multi_ids, sum(n-1) AS extra_rows, max(n) AS max_occurrences, sum(CASE WHEN versions>1 THEN 1 ELSE 0 END) AS content_conflicts, (SELECT count(*) FROM read_parquet(${authority}) AS a LEFT JOIN x USING(id) WHERE x.id IS NULL) AS missing_authority, (SELECT count(*) FROM x LEFT JOIN read_parquet(${authority}) AS a USING(id) WHERE a.id IS NULL) AS outside_authority FROM x`,
  eligibility:`SELECT eligibility_class AS eligibilityClass, count(*)::BIGINT AS count FROM read_parquet(${normalized}) GROUP BY 1 ORDER BY 1`,
  categories:`SELECT gridly_category AS category, count(*)::BIGINT AS count, count(DISTINCT county_fips)::BIGINT AS countiesRepresented FROM read_parquet(${normalized}) WHERE gridly_category IS NOT NULL GROUP BY 1 ORDER BY 1`,
  confidence:`SELECT eligibility_class AS segment, count(*) AS n, count(*) FILTER(WHERE confidence>=.5) AS ge_05, count(*) FILTER(WHERE confidence>=.7) AS ge_07, count(*) FILTER(WHERE confidence>=.8) AS ge_08, count(*) FILTER(WHERE confidence>=.9) AS ge_09 FROM read_parquet(${normalized}) GROUP BY 1 ORDER BY 1`,
  medical:`SELECT count(*) FILTER(WHERE regexp_matches(searchable,'hospital|emergency_room|emergency_department|urgent_care|pharmacy|veterinar|animal_hospital|animal_clinic|pet_wellness')) AS raw_candidates, count(*) FILTER(WHERE regexp_matches(searchable,'veterinar|animal_hospital|animal_clinic|pet_wellness')) AS veterinary_exclusions, count(*) FILTER(WHERE gridly_category='HOSPITAL') AS hospital, count(*) FILTER(WHERE gridly_category='EMERGENCY_CARE') AS emergency, count(*) FILTER(WHERE gridly_category='URGENT_CARE') AS urgent, count(*) FILTER(WHERE gridly_category='PHARMACY') AS pharmacy FROM read_parquet(${normalized})`,
  counties:`SELECT county_fips AS county_fips, count(*) AS rawUniqueRich, count(*) FILTER(WHERE eligibility_class='GRIDLY_ELIGIBLE_DESTINATION') AS eligibleDestination, count(*) FILTER(WHERE eligibility_class='GRIDLY_NON_DESTINATION') AS nonDestination, count(*) FILTER(WHERE eligibility_class='GRIDLY_EXCLUDED') AS excluded, count(*) FILTER(WHERE eligibility_class='GRIDLY_REVIEW_REQUIRED') AS reviewRequired FROM read_parquet(${normalized}) GROUP BY 1 ORDER BY 1`,
  packages:`SELECT regexp_extract(filename,'(tx-[0-9]{2}-[0-9]{3})',1) AS shardId, count(*) AS rawRows FROM read_parquet(${glob},filename=true) GROUP BY 1 ORDER BY 1`
 };
}

export function validateMatchedSchemas(directory=local,options={}){
 const input=detectInputs(directory),query=options.query??(sql=>duck(sql,options));
 const classifications=[],populatedShards=[],emptyShards=[];
 for(const shard of input.shards){
  const file=path.join(directory,shard); let schema,rowCount;
  try{rowCount=number(query(`LOAD spatial; SELECT count(*)::BIGINT row_count FROM read_parquet(${q(file)});`)[0],'row_count');schema=query(`LOAD spatial; DESCRIBE SELECT * FROM read_parquet(${q(file)});`);}catch(error){throw Error(`Stage VALIDATE_INPUT_SCHEMA failed; input=${file}; DuckDB: ${error.message}`);}
  if(!Number.isSafeInteger(rowCount)||rowCount<0)throw Error(`Stage VALIDATE_INPUT_SCHEMA failed; input=${file}; invalid row count ${rowCount}`);
  const columns=new Map(schema.map(x=>[x.column_name,String(x.column_type??x.column_type_name??'')]));
  const missing=matchedColumns.filter(x=>!columns.has(x));if(missing.length)throw Error(`Stage VALIDATE_INPUT_SCHEMA failed; input=${file}; missing columns: ${missing.join(', ')}`);
  const geometry=columns.get('geometry'),nativeCrs84=/^GEOMETRY\s*\(\s*['"]OGC:CRS84['"]\s*\)$/i.test(geometry),emptyBlob=rowCount===0&&/^BLOB$/i.test(geometry);
  if(!nativeCrs84&&!emptyBlob)throw Error(`Stage VALIDATE_INPUT_SCHEMA failed; input=${file}; incompatible geometry logical type ${geometry||'(unknown)'} for row_count=${rowCount}; expected native GEOMETRY / OGC:CRS84${rowCount===0?' or empty-shard BLOB':''}`);
  const classification=emptyBlob?'EMPTY_BLOB_SCHEMA_COMPATIBLE':rowCount===0?'EMPTY_NATIVE_GEOMETRY':'POPULATED_NATIVE_GEOMETRY';
  (rowCount===0?emptyShards:populatedShards).push(shard);classifications.push({shard,rowCount,geometry,classification});
 }
 return {shardCount:input.shards.length,populatedShardCount:populatedShards.length,emptyShardCount:emptyShards.length,populatedShards,emptyShards,classifications,geometry:'populated native GEOMETRY / OGC:CRS84; empty BLOB schema compatible'};
}

export function execute(options={}){
 const directory=options.directory??local,input=detectInputs(directory);if(!input.ready)throw Error(`Phase D normalization requires authority, county assignment, and exactly 168 matched shards; detected authority=${input.authority} assignment=${input.assignment} shards=${input.shards.length}`);
 const measurementsFile=path.join(directory,'normalized-measurements.json'),run=options.query??(sql=>duck(sql,options)),schemaValidation=validateMatchedSchemas(directory,{...options,query:run});if(fs.existsSync(measurementsFile))fs.rmSync(measurementsFile);
 const stages=normalizationStages(directory,schemaValidation.populatedShards);for(const output of stages.slice(1).map(x=>x.artifact))if(fs.existsSync(output))fs.rmSync(output);
 for(const stage of stages)try{run(stage.sql);}catch(error){for(const output of stages.slice(1).map(x=>x.artifact))if(fs.existsSync(output))fs.rmSync(output);throw Error(`Stage ${stage.name} failed; artifact/input=${stage.artifact}; DuckDB: ${error.message}`);}
 const glob=parquetSource(schemaValidation.populatedShards.map(shard=>path.join(directory,shard))),dedup=q(path.join(directory,'overture-texas-rich-authority-dedup.parquet')),normalized=q(path.join(directory,'overture-texas-normalized-poi.parquet')),authority=q(path.join(directory,required.authority));
 const measurements=measurementQueries({glob,dedup,normalized,authority}),measure=(stage,sql,one=false)=>{try{return one?queryOne(sql,options):duck(sql,options);}catch(error){throw Error(`Stage ${stage} failed; DuckDB: ${error.message}`);}};
 const conservation=measure('MEASURE_CONSERVATION',measurements.conservation,true);
 const got=[number(conservation,'input_rows'),number(conservation,'unique_ids'),number(conservation,'multi_ids'),number(conservation,'extra_rows'),number(conservation,'max_occurrences')],want=[expected.inputRows,expected.uniqueIds,expected.multiShardIds,expected.extraRows,expected.maxOccurrences];if(got.some((x,i)=>x!==want[i])||number(conservation,'missing_authority')||number(conservation,'outside_authority'))throw Error(`Certified conservation mismatch: got ${got.join('/')}`);
 const classes=measure('MEASURE_ELIGIBILITY',measurements.eligibility),categories=measure('MEASURE_CATEGORIES',measurements.categories),confidence=measure('MEASURE_CONFIDENCE',measurements.confidence);
 const byClass=Object.fromEntries(classes.map(x=>[x.eligibilityClass,Number(x.count)])),eligibleCount=byClass.GRIDLY_ELIGIBLE_DESTINATION??0;
 const medical=measure('MEASURE_HUMAN_MEDICAL',measurements.medical,true);
 const countyRows=measure('MEASURE_COUNTY_COVERAGE',measurements.counties);if(countyRows.length!==254)throw Error(`Stage MEASURE_COUNTY_COVERAGE failed; normalized county coverage is ${countyRows.length}, expected 254`);
 const packageRows=measure('MEASURE_PACKAGES',measurements.packages);
 const reportOverrides={
  'normalization-summary.json':{schemaVersion:'gridly.lp24111.normalization.v1',executionState:'OWNER_LOCAL_MEASURED',rawUniquePois:expected.uniqueIds,normalizedUniquePois:expected.uniqueIds,eligibleDestinations:eligibleCount,nonDestination:byClass.GRIDLY_NON_DESTINATION??0,excluded:byClass.GRIDLY_EXCLUDED??0,reviewRequired:byClass.GRIDLY_REVIEW_REQUIRED??0},
  'category-coverage.json':{schemaVersion:'gridly.lp24111.categories.v2',executionState:'OWNER_LOCAL_MEASURED',results:categories.map(x=>({...x,count:Number(x.count),countiesRepresented:Number(x.countiesRepresented)}))},
  'human-medical-quality.json':{schemaVersion:'gridly.lp24111.human-medical.v1',executionState:'OWNER_LOCAL_MEASURED',rawHumanMedicalCandidates:number(medical,'raw_candidates'),veterinaryExclusions:number(medical,'veterinary_exclusions'),retainedHospital:number(medical,'hospital'),retainedEmergencyCare:number(medical,'emergency'),retainedUrgentCare:number(medical,'urgent'),retainedPharmacy:number(medical,'pharmacy'),animalHealthAcceptedAsHumanMedical:false},
  'normalized-county-coverage.json':{schemaVersion:'gridly.lp24111.normalized-counties.v1',executionState:'OWNER_LOCAL_MEASURED',expectedCountyCount:254,accountedCountyCount:countyRows.length,rows:countyRows},
  'confidence-analysis.json':{schemaVersion:'gridly.lp24111.confidence.v2',executionState:'OWNER_LOCAL_MEASURED',candidateThresholds:[.5,.7,.8,.9],distributions:confidence,policy:'NO_CUTOFF_RECOMMENDED_CONFIDENCE_IS_NOT_ACCEPTANCE_AUTHORITY'},
  'rich-authority-conservation.json':{schemaVersion:'gridly.lp24111.rich-conservation.v1',executionState:'OWNER_LOCAL_MEASURED',inputShardRows:number(conservation,'input_rows'),uniqueIds:number(conservation,'unique_ids'),crossShardDuplicateIds:number(conservation,'multi_ids'),extraDuplicateRows:number(conservation,'extra_rows'),maximumShardOccurrencesPerId:number(conservation,'max_occurrences'),missingAuthorityIds:number(conservation,'missing_authority'),outsideAuthorityIds:number(conservation,'outside_authority'),duplicateContentConflicts:number(conservation,'content_conflicts'),deduplicatedArtifact:'owner-local/lp24111/overture-texas-rich-authority-dedup.parquet',deduplicatedArtifactPresent:true,normalizationGate:'EXECUTED',conservationPassed:true},
  'package-size-model.json':{schemaVersion:'gridly.lp24111.shards.v2',executionState:'OWNER_LOCAL_MEASURED',measurements:{rawRowsPerShard:packageRows,normalizedRows:expected.uniqueIds,eligibleRows:eligibleCount},constraints:{singleAssetBytes:26214400},productionChoice:'NOT_SELECTED_PENDING_COMPACT_PACKAGE_MEASUREMENTS'},
  'certification.json':{schemaVersion:'gridly.lp24111.certification.v4',executiveResult:'PHASE_D_OWNER_LOCAL_NORMALIZATION_EXECUTED',richAuthorityConservation:'OWNER_LOCAL_MEASURED',productViability:'OVERTURE_TEXAS_POI_AUTHORITY_NOT_YET_PRODUCT_VIABLE',classifications:['OVERTURE_TEXAS_SPATIAL_AUTHORITY_CERTIFIED_EXACT','RICH_AUTHORITY_CONSERVATION_MEASURED','NORMALIZATION_EXECUTED','PACKAGE_REFINEMENT_AND_LEGAL_REVIEW_REQUIRED'],productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',zeroCostContract:'NON_RUNTIME',mergeRecommendation:'MEASURE_REMAINING_PHASE_D_DIMENSIONS_BEFORE_PRODUCT_CERTIFICATION',nextAction:'Review measured normalization and execute the remaining community, identity, metadata, package compression, attribution, and reconciliation audits.'},
  'exception-ledger.json':{schemaVersion:'gridly.lp24111.exceptions.v4',exceptions:[{id:'RICH_DUPLICATE_CONTENT_CONFLICT',severity:number(conservation,'content_conflicts')?'REVIEW_REQUIRED':'CLOSED',count:number(conservation,'content_conflicts')},{id:'REMAINING_PHASE_D_MEASUREMENTS_NOT_EXECUTED',severity:'BLOCKER'},{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'}]}
 };
 const output={schemaVersion:'gridly.lp24111.measured-normalization.v1',releaseId,executedAt:new Date().toISOString(),schemaValidation,conservation,reports:reportOverrides,productionRuntimeChanged:false};fs.mkdirSync(directory,{recursive:true});atomicJson(measurementsFile,output);return output;
}

function main(){if(!process.argv.includes('--execute'))throw Error('Explicit --execute is required; build never launches statewide normalization.');const result=execute();console.log(`normalized ${result.conservation.unique_ids} certified rich POIs; run npm run build:lp24111`);}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)try{main();}catch(error){console.error(error.message);process.exitCode=1;}
