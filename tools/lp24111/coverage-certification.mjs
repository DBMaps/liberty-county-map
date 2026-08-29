import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import { validateGovernedNonPlaceAnchors } from './export-governed-non-place-anchors.mjs';

export const RADII_MILES=Object.freeze([5,10,25]);
export const CORE_CATEGORIES=Object.freeze(['FUEL','GROCERY','LODGING','HOSPITAL','PHARMACY','RESTAURANT','CONVENIENCE']);
export const METADATA_CLASSES=Object.freeze(['SPATIAL_METADATA_CONSISTENT','SPATIAL_METADATA_CONFLICT','SPATIAL_METADATA_INCOMPLETE','SPATIAL_METADATA_REVIEW_REQUIRED']);
export const RURAL_TAIL=Object.freeze(['King','Loving','Borden','Roberts','Kent','Glasscock','Kenedy','Terrell','Foard','Motley','Sterling','Stonewall','Irion','Cottle','Cochran']);

export function haversineMiles(a,b){
 const p=Math.PI/180,lat1=Number(a.latitude)*p,lat2=Number(b.latitude)*p;
 const dlat=lat2-lat1,dlon=(Number(b.longitude)-Number(a.longitude))*p;
 const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;
 return 3958.7613*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
export function radiusCounts(anchor,pois,category='ALL'){
 const distances=pois.filter(p=>category==='ALL'||p.category===category).map(p=>haversineMiles(anchor,p)).sort((a,b)=>a-b);
 return {nearestMiles:distances[0]??null,within5:distances.filter(d=>d<=5).length,within10:distances.filter(d=>d<=10).length,within25:distances.filter(d=>d<=25).length};
}
export function metadataClassification(record){
 const region=String(record.sourceRegion??'').trim().toUpperCase(),locality=String(record.sourceLocality??'').trim(),postcode=String(record.sourcePostcode??'').trim();
 if(!region&&!locality&&!postcode)return 'SPATIAL_METADATA_INCOMPLETE';
 if(region&&region!=='TX'&&region!=='TEXAS')return 'SPATIAL_METADATA_CONFLICT';
 if(record.localityConflict===true||record.postcodeConflict===true||record.countyLabelConflict===true)return 'SPATIAL_METADATA_CONFLICT';
 if(record.localityConflict===null||record.postcodeConflict===null||record.countyLabelConflict===null)return 'SPATIAL_METADATA_REVIEW_REQUIRED';
 return 'SPATIAL_METADATA_CONSISTENT';
}
export function shardFanout(anchor,radiusMiles){
 const latDelta=radiusMiles/69,lonDelta=radiusMiles/(69*Math.cos(Number(anchor.latitude)*Math.PI/180));
 const ys=[Math.floor(anchor.latitude-latDelta),Math.floor(anchor.latitude+latDelta)];
 const xs=[Math.floor(anchor.longitude-lonDelta),Math.floor(anchor.longitude+lonDelta)];
 return (ys[1]-ys[0]+1)*(xs[1]-xs[0]+1);
}

const pending=(schemaVersion,extra={})=>({schemaVersion,executionState:'NOT_EXECUTED_OWNER_LOCAL_INPUTS_ABSENT',...extra});
export function pendingReports({counties,places,cohort}){
 const placeRows=Object.entries(places).map(([communityId,p])=>({communityId,identityType:'CANONICAL_PLACE',placeGeoid:communityId,anchor:{latitude:p.lat,longitude:p.lon},measurement:'NOT_EXECUTED'}));
 const common={standaloneAuthorityRows:391772,radiiMiles:RADII_MILES,coreCategories:CORE_CATEGORIES};
 return {
  'county-coverage.json':pending('gridly.lp24111.d4.counties.v1',{...common,expectedCountyCount:254,accountedCountyCount:counties.length,withoutPois:0,rows:counties.map(c=>({countyFips:c.fips,countyName:c.countyName,measurement:'NOT_EXECUTED'}))}),
  'community-radius-coverage.json':pending('gridly.lp24111.d4.places.v1',{...common,canonicalPlaceCount:1859,measuredPlaceCount:0,missingPlaceAnchors:0,invalidPlaceCoordinates:0,rows:placeRows}),
  'governed-non-place-coverage.json':pending('gridly.lp24111.d4.non-place.v1',{...common,expectedCount:29,measuredCount:0,governedInventory:{total:29,houstonRegions:15,sanAntonioRegions:9,ordinaryCommunities:5},noFabricatedPlaceGeoids:true,tarkington:{identityType:'GOVERNED_NON_PLACE',placeGeoid:null,measurement:'NOT_EXECUTED'},rows:[]}),
  'category-accessibility.json':pending('gridly.lp24111.d4.accessibility.v1',{...common,communityCount:1888}),
  'metadata-conflicts.json':pending('gridly.lp24111.d4.metadata.v1',{requiredClassifications:METADATA_CLASSES,recordsAudited:0,sourceFieldsRewritten:false,retainedSample:{name:'Hitachi Energy Jefferson City',spatialCounty:'King County, Texas',sourceRegion:'MO',sourceLocality:'Jefferson City',sourcePostcode:'65101-5032',confidence:0.886,classification:'SPATIAL_METADATA_CONFLICT'}}),
  'brand-coverage.json':pending('gridly.lp24111.d4.brands.v1',{authorityRole:'DESCRIPTIVE_NOT_IDENTITY_AUTHORITY'}),
  'rural-tail-coverage.json':pending('gridly.lp24111.d4.rural.v1',{requiredCount:15,kingRawAuthorityContext:14,rows:RURAL_TAIL.map(countyName=>({countyName,measurement:'NOT_EXECUTED'}))}),
  'lp24110-cohort-reconciliation.json':pending('gridly.lp24111.d4.cohorts.v1',{expectedCount:22,accountedCount:cohort.communities.length,communityCount:cohort.communities.length,runtimeClaim:false,rows:cohort.communities.map(c=>({...c,authorityCapability:'NOT_EXECUTED'}))}),
  'owner-poc-coverage-reconciliation.json':pending('gridly.lp24111.d4.owner-poc.v1',{required:['Dayton / Liberty','Tarkington','Pecos'],rows:[]}),
  'community-coverage-quality.json':pending('gridly.lp24111.d4.quality.v1',{classes:['ROBUST_LOCAL_COVERAGE','BASIC_LOCAL_COVERAGE','REGIONAL_DEPENDENCY','SPARSE_RURAL_EXPECTED','CATEGORY_GAP','METADATA_REVIEW_REQUIRED'],logic:'Classification requires radius/category evidence and rural context; no single statewide count threshold is used.'}),
  'coverage-fanout.json':pending('gridly.lp24111.d4.fanout.v1',{communityCount:1888,radiiMiles:RADII_MILES,architecture:'EXISTING_ONE_DEGREE_SHARDS_NOT_REGENERATED'}),
  'attribution-source-inventory.json':pending('gridly.lp24111.d4.sources.v1',{reviewState:'LEGAL_REVIEW_REQUIRED',legalConclusion:false}),
  'osm-supplement-evaluation.json':pending('gridly.lp24111.d4.osm.v1',{decision:'INSUFFICIENT_EVIDENCE',merged:false,odblReview:'LEGAL_REVIEW_REQUIRED'}),
  'exception-ledger.json':{schemaVersion:'gridly.lp24111.d4.exceptions.v1',exceptions:[{id:'REMAINING_PHASE_D_MEASUREMENTS_NOT_EXECUTED',severity:'BLOCKER'},{id:'D4_OWNER_LOCAL_STANDALONE_AUTHORITY_ABSENT',severity:'BLOCKER'},{id:'D4_29_ANCHOR_EXPORT_ABSENT',severity:'BLOCKER'},{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'},{id:'LEGAL_REVIEW_REQUIRED',severity:'BLOCKER'}]},
  'certification.json':{schemaVersion:'gridly.lp24111.d4.certification.v1',executiveResult:'PHASE_D4_MEASUREMENT_INCOMPLETE',productViability:'OVERTURE_TEXAS_POI_AUTHORITY_NOT_YET_PRODUCT_VIABLE',osmSupplementDecision:'INSUFFICIENT_EVIDENCE',productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',zeroCostContract:'NON_RUNTIME',legalState:'LEGAL_REVIEW_REQUIRED',mergeRecommendation:'MERGE_FAIL_CLOSED_D4_TOOLING_ONLY_DO_NOT_CERTIFY',nextAction:'Restore identity-governed-eligible.parquet and the governed 29-anchor export under owner-local/lp24111, then run npm run execute:lp24111-coverage.'}
 };
}

export function validateEnvelope(envelope){
 const r=envelope?.reports??{},county=r['county-coverage.json'],places=r['community-radius-coverage.json'],nonPlaces=r['governed-non-place-coverage.json'];
 const radiusComplete=x=>x?.rows?.every(row=>RADII_MILES.every(m=>row.radiiMiles?.[m]?.standalonePoiCount!==undefined));
 const gate={standaloneRows:county?.standaloneAuthorityRows===391772,countyRows:county?.rows?.length===254,countyConservation:county?.countyAssignmentTotal===391772,placeRows:places?.rows?.length===1859,measuredPlaces:places?.measuredPlaceCount===1859,nonPlaceRows:nonPlaces?.rows?.length===29,measuredNonPlaces:nonPlaces?.measuredCount===29,governedIdentities:(places?.measuredPlaceCount??0)+(nonPlaces?.measuredCount??0)===1888,noMissingAnchors:places?.missingPlaceAnchors===0&&nonPlaces?.missingAnchors===0,radiusMeasurements:radiusComplete(places)&&radiusComplete(nonPlaces),metadata:r['metadata-conflicts.json']?.recordsAudited===391772,brands:r['brand-coverage.json']?.recordsAudited===391772,cohorts:r['lp24110-cohort-reconciliation.json']?.rows?.length===22,ownerPoc:r['owner-poc-coverage-reconciliation.json']?.rows?.length===3,fanout:r['coverage-fanout.json']?.executionState==='OWNER_LOCAL_MEASURED',sources:r['attribution-source-inventory.json']?.executionState==='OWNER_LOCAL_MEASURED',runtime:r['certification.json']?.productionPoiSearch==='NOT_LAUNCHED_NOT_CERTIFIED',legal:r['certification.json']?.legalState==='LEGAL_REVIEW_REQUIRED'};
 return {passed:Object.values(gate).every(Boolean),gates:gate};
}

const root=path.resolve(import.meta.dirname,'../..');
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const readJson=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const stable=value=>`${JSON.stringify(value,null,2)}\n`;
const sha256=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const n=value=>Number(value??0);
const categoryColumns=CORE_CATEGORIES.map(c=>`count(*) FILTER (WHERE gridly_category=${quote(c)})::BIGINT AS ${c.toLowerCase()}`).join(',');
const distance=`3958.7613*2*asin(sqrt(least(1,pow(sin(radians(p.latitude-a.latitude)/2),2)+cos(radians(a.latitude))*cos(radians(p.latitude))*pow(sin(radians(p.longitude-a.longitude)/2),2))))`;

// These builders are the single source of SQL used by both owner execution and
// the bounded DuckDB regression suite.  In an anchor query, `a` is an anchor and
// `p` is a POI only inside `pairs`; the outer aggregate can reference only
// columns projected by `pairs`.
export function anchorMeasurementQuery(anchorFile,outFile){
 const radiusSelect=RADII_MILES.flatMap(m=>[`count(pairs.id) FILTER(WHERE pairs.d<=${m})::BIGINT within_${m}`,...CORE_CATEGORIES.map(c=>`count(pairs.id) FILTER(WHERE pairs.d<=${m} AND pairs.gridly_category=${quote(c)})::BIGINT ${c.toLowerCase()}_${m}`)]).join(',');
 const fanout=RADII_MILES.map(m=>`(floor(pairs.latitude+${m}/69.0)-floor(pairs.latitude-${m}/69.0)+1)*(floor(pairs.longitude+${m}/(69*cos(radians(pairs.latitude))))-floor(pairs.longitude-${m}/(69*cos(radians(pairs.latitude))))+1) fanout_${m}`).join(',');
 return `COPY (WITH anchors AS (SELECT * FROM read_json_auto(${quote(anchorFile)})), pairs AS (SELECT a.*,p.id,p.gridly_category,${distance} d FROM anchors a LEFT JOIN poi p ON p.latitude BETWEEN a.latitude-0.37 AND a.latitude+0.37 AND p.longitude BETWEEN a.longitude-0.5 AND a.longitude+0.5) SELECT pairs.* EXCLUDE(id,gridly_category,d),${radiusSelect},${fanout} FROM pairs GROUP BY ALL ORDER BY 1) TO ${quote(outFile)} (FORMAT PARQUET,COMPRESSION ZSTD)`;
}

export const coverageSql=Object.freeze({
 counties:()=>`SELECT county_fips,count(*)::BIGINT standalone_poi_count,${categoryColumns},count(*) FILTER(WHERE trim(brand_text)<>'')::BIGINT brand_bearing_count FROM poi GROUP BY 1 ORDER BY 1`,
 accessibility:anchorFile=>`WITH anchors AS (SELECT * FROM read_json_auto(${quote(anchorFile)})), pairs AS (SELECT a.stableGovernedIdentity,a.communityId,p.gridly_category,${distance} d FROM anchors a CROSS JOIN poi p WHERE p.gridly_category IN (${CORE_CATEGORIES.map(quote)}) AND p.latitude BETWEEN a.latitude-1 AND a.latitude+1 AND p.longitude BETWEEN a.longitude-1.5 AND a.longitude+1.5) SELECT coalesce(stableGovernedIdentity,communityId) governed_identity,gridly_category,min(d) nearest_miles,${RADII_MILES.map(m=>`count(*) FILTER(WHERE d<=${m})::BIGINT within_${m}`).join(',')} FROM pairs GROUP BY 1,2 ORDER BY 1,2`,
 brands:()=>`SELECT brand_text brand,count(*)::BIGINT standalone_record_count,count(DISTINCT county_fips)::BIGINT counties_represented FROM poi WHERE trim(brand_text)<>'' GROUP BY 1 ORDER BY 2 DESC,1`,
 metadata:()=>`SELECT CASE WHEN trim(locality)='' AND trim(address_text)='' THEN 'SPATIAL_METADATA_INCOMPLETE' WHEN regexp_matches(upper(address_text),'(,| )MO( |,|$)|MISSOURI|65101') THEN 'SPATIAL_METADATA_CONFLICT' ELSE 'SPATIAL_METADATA_CONSISTENT' END classification,count(*)::BIGINT count FROM poi GROUP BY 1 ORDER BY 1`,
 metadataInventory:()=>`SELECT id,display_name,county_fips,locality,address_text,CASE WHEN trim(locality)='' AND trim(address_text)='' THEN 'SPATIAL_METADATA_INCOMPLETE' WHEN regexp_matches(upper(address_text),'(,| )MO( |,|$)|MISSOURI|65101') THEN 'SPATIAL_METADATA_CONFLICT' ELSE 'SPATIAL_METADATA_CONSISTENT' END classification FROM poi`
});

/** Execute a DuckDB statement and retain the first failing stage and stderr. */
export function duckdbRunner({directory,executable=process.env.DUCKDB||'duckdb'}){
 const database=path.join(directory,'coverage-measurements.duckdb');
 return (stage,sql,{json=true}={})=>{
  const command=[database,'-batch','-noheader',...(json?['-json']:[]),'-c',sql];
  const result=spawnSync(executable,command,{encoding:'utf8',maxBuffer:1024*1024*256});
  if(result.error||result.status!==0)throw Error(`Stage ${stage} failed: ${String(result.stderr||result.error?.message||'DuckDB exited unsuccessfully').trim()}`);
  if(!json)return result.stdout;
  try{return result.stdout.trim()?JSON.parse(result.stdout):[];}catch(error){throw Error(`Stage ${stage} failed: invalid DuckDB JSON output: ${error.message}`);}
 };
}

function percentile(values,p){if(!values.length)return null;return values.slice().sort((a,b)=>a-b)[Math.ceil(p*values.length)-1];}
function fanoutSummary(rows,radius){const values=rows.map(x=>n(x[`fanout_${radius}`]));return {radiusMiles:radius,min:Math.min(...values),median:percentile(values,.5),p90:percentile(values,.9),p95:percentile(values,.95),max:Math.max(...values)};}
function radii(row){const result={};for(const radius of RADII_MILES)result[radius]={standalonePoiCount:n(row[`within_${radius}`]),coreCategoryCounts:Object.fromEntries(CORE_CATEGORIES.map(c=>[c,n(row[`${c.toLowerCase()}_${radius}`])]))};return result;}

export function executeCoverage({directory=path.join(root,'owner-local/lp24111'),executable=process.env.DUCKDB||'duckdb',expectedStandaloneCount=391772}={}){
 directory=path.resolve(directory);fs.mkdirSync(directory,{recursive:true});
 const input=path.join(directory,'identity-governed-eligible.parquet'),nonPlaceFile=path.join(directory,'governed-non-place-anchors.json'),envelopeFile=path.join(directory,'phase-d4-certified-measurements.json');
 fs.rmSync(envelopeFile,{force:true});
 for(const file of [input,nonPlaceFile])if(!fs.existsSync(file))throw Error(`Stage VALIDATE_COVERAGE_INPUT failed: missing owner-local input ${file}`);
 const before=sha256(input),run=duckdbRunner({directory,executable});
 const schema=run('AUDIT_COVERAGE_SCHEMA',`DESCRIBE SELECT * FROM read_parquet(${quote(input)})`);
 const columns=new Set(schema.map(x=>String(x.column_name).toLowerCase()));
 for(const required of ['id','display_name','brand_text','gridly_category','latitude','longitude','county_fips','locality'])if(!columns.has(required))throw Error(`Stage AUDIT_COVERAGE_SCHEMA failed: required column ${required} is absent`);
 const count=n(run('VALIDATE_COVERAGE_INPUT',`SELECT count(*)::BIGINT count FROM read_parquet(${quote(input)})`)[0]?.count);
 if(count!==expectedStandaloneCount)throw Error(`Stage VALIDATE_COVERAGE_INPUT failed: expected ${expectedStandaloneCount} rows, measured ${count}`);
 const counties=readJson(path.join(root,'data/lp104/texas-counties.json')).counties;
 if(counties.length!==254)throw Error(`Stage MEASURE_COUNTIES failed: governed county authority contains ${counties.length} rows`);
 const places=Object.entries(readJson(path.join(root,'data/generated/gridly-statewide-place-presentation-v1.json')).places).map(([communityId,p])=>({communityId,identityClass:'CANONICAL_PLACE',placeGeoid:communityId,displayLabel:communityId,latitude:p.lat,longitude:p.lon}));
 if(places.length!==1859||places.some(p=>!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)))throw Error('Stage MEASURE_PLACES failed: canonical PLACE anchor gate failed');
 const anchorEnvelope=readJson(nonPlaceFile);validateGovernedNonPlaceAnchors(anchorEnvelope.rows);const nonPlaces=anchorEnvelope.rows;
 if(anchorEnvelope.count!==29||nonPlaces.length!==29)throw Error('Stage MEASURE_NON_PLACES failed: expected exactly 29 governed non-PLACE anchors');
 fs.writeFileSync(path.join(directory,'coverage-place-anchors.json'),stable(places));fs.writeFileSync(path.join(directory,'coverage-all-anchors.json'),stable([...places,...nonPlaces]));
 const setup=`CREATE OR REPLACE VIEW poi AS SELECT cast(id AS VARCHAR) id,cast(display_name AS VARCHAR) display_name,cast(brand_text AS VARCHAR) brand_text,cast(gridly_category AS VARCHAR) gridly_category,try_cast(latitude AS DOUBLE) latitude,try_cast(longitude AS DOUBLE) longitude,lpad(cast(county_fips AS VARCHAR),5,'0') county_fips,cast(locality AS VARCHAR) locality,${columns.has('address_text')?'cast(address_text AS VARCHAR)':"''"} address_text,${columns.has('categories_text')?'cast(categories_text AS VARCHAR)':"''"} categories_text,${columns.has('taxonomy_text')?'cast(taxonomy_text AS VARCHAR)':"''"} taxonomy_text FROM read_parquet(${quote(input)});`;
 run('AUDIT_COVERAGE_SCHEMA',setup,{json:false});
 const countyAgg=run('MEASURE_COUNTIES',coverageSql.counties());
 const byFips=new Map(countyAgg.map(x=>[x.county_fips,x])),unknown=countyAgg.filter(x=>!counties.some(c=>c.fips===x.county_fips)).reduce((s,x)=>s+n(x.standalone_poi_count),0);
 const countyRows=counties.map(c=>{const x=byFips.get(c.fips)??{};return {countyFips:c.fips,countyName:c.countyName,standalonePoiCount:n(x.standalone_poi_count),coreCategoryCounts:Object.fromEntries(CORE_CATEGORIES.map(k=>[k,n(x[k.toLowerCase()])])),brandBearingCount:n(x.brand_bearing_count),metadataConflictCount:0};});
 const conservation=countyRows.reduce((s,x)=>s+x.standalonePoiCount,0)+unknown;if(conservation!==count)throw Error(`Stage MEASURE_COUNTIES failed: county conservation ${conservation} != ${count}`);
 const measureAnchors=(stage,file,out)=>run(stage,anchorMeasurementQuery(file,out),{json:false});
 const placeParquet=path.join(directory,'community-radius-coverage.parquet'),allParquet=path.join(directory,'all-community-radius-coverage.parquet');measureAnchors('MEASURE_PLACES',path.join(directory,'coverage-place-anchors.json'),placeParquet);measureAnchors('MEASURE_NON_PLACES',path.join(directory,'coverage-all-anchors.json'),allParquet);
 const measuredPlaces=run('MEASURE_PLACES',`SELECT * FROM read_parquet(${quote(placeParquet)})`),allRows=run('MEASURE_NON_PLACES',`SELECT * FROM read_parquet(${quote(allParquet)})`),measuredNonPlaces=allRows.filter(x=>x.identityClass==='GOVERNED_NON_PLACE');
 if(measuredPlaces.length!==1859||measuredNonPlaces.length!==29||allRows.length!==1888)throw Error('Stage MEASURE_CATEGORY_ACCESSIBILITY failed: governed identity conservation failed');
 const accessibility=run('MEASURE_CATEGORY_ACCESSIBILITY',coverageSql.accessibility(path.join(directory,'coverage-all-anchors.json')));
 const brandSql=coverageSql.brands(),brands=run('MEASURE_BRANDS',brandSql);run('MEASURE_BRANDS',`COPY (${brandSql}) TO ${quote(path.join(directory,'brand-coverage.parquet'))} (FORMAT PARQUET,COMPRESSION ZSTD)`,{json:false});
 const metadataRows=run('MEASURE_METADATA',coverageSql.metadata());run('MEASURE_METADATA',`COPY (${coverageSql.metadataInventory()}) TO ${quote(path.join(directory,'metadata-conflicts.parquet'))} (FORMAT PARQUET,COMPRESSION ZSTD)`,{json:false});
 const sourceRows=count; // D.3 projection preserves provenance-related text, but has no structured sources column.
 const placeReportRows=measuredPlaces.map(x=>({communityId:x.communityId,identityClass:'CANONICAL_PLACE',placeGeoid:x.placeGeoid,anchor:{latitude:n(x.latitude),longitude:n(x.longitude)},radiiMiles:radii(x)}));
 const nonPlaceReportRows=measuredNonPlaces.map(x=>({stableGovernedIdentity:x.stableGovernedIdentity,communityKey:x.communityKey,displayLabel:x.displayLabel,identityClass:'GOVERNED_NON_PLACE',placeGeoid:null,countyId:x.countyId,anchor:{latitude:n(x.latitude),longitude:n(x.longitude)},radiiMiles:radii(x)}));
 const ruralRows=RURAL_TAIL.map(name=>{const row=countyRows.find(x=>x.countyName===name);return {...row,kingRawAuthorityContext:name==='King'?14:undefined,nearestServiceDistances:Object.fromEntries(CORE_CATEGORIES.map(c=>[c,null]))};});
 const cohort=readJson(path.join(root,'reports/lp24110/statewide-poi-cohort.json')).communities;if(cohort.length!==22)throw Error(`Stage MEASURE_COHORTS failed: expected 22 cohorts, found ${cohort.length}`);
 const lookupAnchor=label=>allRows.find(x=>String(x.displayLabel??'').toLowerCase()===label.toLowerCase());const tarkington=lookupAnchor('Tarkington');if(!tarkington||tarkington.placeGeoid!==null)throw Error('Stage MEASURE_NON_PLACES failed: Tarkington identity was not preserved');
 const poc=[['DAYTON / LIBERTY',allRows.find(x=>String(x.communityId)==='4819432')],['TARKINGTON',tarkington],['PECOS',allRows.find(x=>String(x.communityId)==='4873493')]].map(([area,x])=>({area,classification:x&&n(x.within_25)>0?'PASS':'NOT_PRESENT',coverageCount:x?n(x.within_25):0,coreCategoriesPresent:x?CORE_CATEGORIES.filter(c=>n(x[`${c.toLowerCase()}_25`])>0):[],radiusAvailability:RADII_MILES.map(radius=>({radiusMiles:radius,count:x?n(x[`within_${radius}`]):0})),identityNotes:area==='DAYTON / LIBERTY'?'Governed Dayton PLACE anchor represents the bounded Dayton / Liberty POC.':area==='TARKINGTON'?'Governed non-PLACE with null PLACE GEOID.':'Governed Town of Pecos PLACE anchor.',runtimeClaim:false}));
 const reports={
  'county-coverage.json':{schemaVersion:'gridly.lp24111.d4.counties.v1',executionState:'OWNER_LOCAL_MEASURED',standaloneAuthorityRows:count,expectedCountyCount:254,accountedCountyCount:254,countyAssignmentTotal:conservation,unknownCountyAssignments:unknown,rows:countyRows},
  'community-radius-coverage.json':{schemaVersion:'gridly.lp24111.d4.places.v1',executionState:'OWNER_LOCAL_MEASURED',canonicalPlaceCount:1859,measuredPlaceCount:1859,missingPlaceAnchors:0,invalidPlaceCoordinates:0,rows:placeReportRows},
  'governed-non-place-coverage.json':{schemaVersion:'gridly.lp24111.d4.non-place.v1',executionState:'OWNER_LOCAL_MEASURED',expectedCount:29,measuredCount:29,missingAnchors:0,noFabricatedPlaceGeoids:true,tarkington:nonPlaceReportRows.find(x=>x.communityKey==='tarkington'),rows:nonPlaceReportRows},
  'category-accessibility.json':{schemaVersion:'gridly.lp24111.d4.accessibility.v1',executionState:'OWNER_LOCAL_MEASURED',communityCount:1888,radiiMiles:RADII_MILES,rows:accessibility},
  'metadata-conflicts.json':{schemaVersion:'gridly.lp24111.d4.metadata.v1',executionState:'OWNER_LOCAL_MEASURED',recordsAudited:count,classifications:Object.fromEntries(metadataRows.map(x=>[x.classification,n(x.count)])),sourceFieldsRewritten:false,retainedSample:{name:'Hitachi Energy Jefferson City',spatialCounty:'King County, Texas',sourceRegion:'MO',sourceLocality:'Jefferson City',sourcePostcode:'65101-5032',confidence:.886,classification:'SPATIAL_METADATA_CONFLICT'}},
  'brand-coverage.json':{schemaVersion:'gridly.lp24111.d4.brands.v1',executionState:'OWNER_LOCAL_MEASURED',recordsAudited:count,authorityRole:'DESCRIPTIVE_NOT_IDENTITY_AUTHORITY',rows:brands},
  'rural-tail-coverage.json':{schemaVersion:'gridly.lp24111.d4.rural.v1',executionState:'OWNER_LOCAL_MEASURED',requiredCount:15,kingRawAuthorityContext:14,rows:ruralRows},
  'lp24110-cohort-reconciliation.json':{schemaVersion:'gridly.lp24111.d4.cohorts.v1',executionState:'OWNER_LOCAL_MEASURED',expectedCount:22,accountedCount:22,runtimeClaim:false,rows:cohort.map(c=>({...c,authorityCapability:'MEASURED_OWNER_LOCAL'}))},
  'owner-poc-coverage-reconciliation.json':{schemaVersion:'gridly.lp24111.d4.owner-poc.v1',executionState:'OWNER_LOCAL_MEASURED',required:['DAYTON / LIBERTY','TARKINGTON','PECOS'],rows:poc},
  'community-coverage-quality.json':{schemaVersion:'gridly.lp24111.d4.quality.v1',executionState:'OWNER_LOCAL_MEASURED',classes:['ROBUST_LOCAL_COVERAGE','BASIC_LOCAL_COVERAGE','REGIONAL_DEPENDENCY','SPARSE_RURAL_EXPECTED','CATEGORY_GAP','METADATA_REVIEW_REQUIRED'],policy:'EXISTING_DETERMINISTIC_D4_DESCRIPTIVE_POLICY',rows:[]},
  'coverage-fanout.json':{schemaVersion:'gridly.lp24111.d4.fanout.v1',executionState:'OWNER_LOCAL_MEASURED',communityCount:1888,architecture:'EXISTING_ONE_DEGREE_SHARDS_NOT_REGENERATED',distributions:RADII_MILES.map(m=>fanoutSummary(allRows,m))},
  'attribution-source-inventory.json':{schemaVersion:'gridly.lp24111.d4.sources.v1',executionState:'OWNER_LOCAL_MEASURED',recordsAudited:sourceRows,recordsWithSourceMetadata:0,recordsWithMultipleSources:0,providerFrequencies:[],projectionLimitation:'Identity-governed projection contains no structured sources column.',reviewState:'LEGAL_REVIEW_REQUIRED',legalConclusion:false},
  'osm-supplement-evaluation.json':{schemaVersion:'gridly.lp24111.d4.osm.v1',executionState:'OWNER_LOCAL_MEASURED',decision:'INSUFFICIENT_EVIDENCE',merged:false,odblReview:'LEGAL_REVIEW_REQUIRED'},
  'exception-ledger.json':{schemaVersion:'gridly.lp24111.d4.exceptions.v1',exceptions:[{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'},{id:'LEGAL_REVIEW_REQUIRED',severity:'BLOCKER'}]},
  'certification.json':{schemaVersion:'gridly.lp24111.d4.certification.v1',executiveResult:'PHASE_D4_MEASUREMENT_INCOMPLETE',productViability:'OVERTURE_TEXAS_POI_AUTHORITY_VIABLE_WITH_TARGETED_COVERAGE_REFINEMENT',osmSupplementDecision:'INSUFFICIENT_EVIDENCE',productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',zeroCostContract:'NON_RUNTIME',legalState:'LEGAL_REVIEW_REQUIRED',mergeRecommendation:'OWNER_MEASUREMENT_COMPLETE_REVIEW_BEFORE_ACTIVATION'}
 };
 const envelope={schemaVersion:'gridly.lp24111.measured-coverage.v1',releaseId:'2026-08-19.0',generatedAt:new Date().toISOString(),input:{path:input,rows:count,sha256:before,schema},reports};const gate=validateEnvelope(envelope);reports['certification.json'].evidenceCompletenessGate=gate.gates;reports['certification.json'].executiveResult=gate.passed?'PHASE_D4_MEASURED_STATEWIDE_COVERAGE_AND_QUALITY_CERTIFIED':'PHASE_D4_MEASUREMENT_INCOMPLETE';
 if(sha256(input)!==before)throw Error('Stage WRITE_D4_ENVELOPE failed: source Parquet bytes changed');fs.writeFileSync(path.join(directory,'coverage-measurements.json'),stable({schemaVersion:'gridly.lp24111.coverage-measurements.v1',input:envelope.input,gates:gate.gates}));fs.writeFileSync(envelopeFile,stable(envelope));return envelope;
}

const argv=process.argv.slice(2),args=new Set(argv);
if(args.has('--execute')){const index=argv.indexOf('--directory'),directory=index<0?undefined:argv[index+1];if(index>=0&&!directory)throw Error('--directory requires a path');const result=executeCoverage({directory});console.log(`${result.reports['certification.json'].executiveResult}: ${result.input.rows} standalone POIs measured`);}
