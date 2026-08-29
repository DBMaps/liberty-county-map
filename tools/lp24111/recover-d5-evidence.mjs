import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'../..');
export const CATEGORIES=['FUEL','GROCERY','LODGING','HOSPITAL','PHARMACY','RESTAURANT','CONVENIENCE'];
export const BRANDS=['Walmart','H-E-B','Brookshire Brothers','Dollar General','Dollar Tree','Family Dollar','Shell','Chevron','Exxon','Valero',"O'Reilly Auto Parts",'AutoZone','Best Western','Holiday Inn Express','Hampton Inn','Motel 6','Starbucks','Subway','CVS','Walgreens'];
export const EXPECTED_STANDALONE_IDS=391772;
export const EXPECTED_CONFLICT_IDS=149;
export const BRAND_AUTHORITY_ROLE='DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const stable=value=>`${JSON.stringify(value,null,2)}\n`;

function identityRows(reports){
 return [...reports.radius.rows.map(x=>({governedIdentity:x.communityId,identityClass:'CANONICAL_PLACE',placeGeoid:x.placeGeoid??x.communityId,displayLabel:x.displayLabel??null})),...reports.nonPlace.rows.map(x=>({governedIdentity:x.stableGovernedIdentity,identityClass:'GOVERNED_NON_PLACE',placeGeoid:null,displayLabel:x.displayLabel}))];
}

/** Recover only conclusions logically contained in the committed D.4 JSON. */
export function recoverCommittedEvidence(reports){
 const identities=identityRows(reports),access=reports.access.rows;
 const countyTotals=Object.fromEntries(CATEGORIES.map(category=>[category,reports.counties.rows.reduce((n,row)=>n+(row.coreCategoryCounts?.[category]??0),0)]));
 const categoryRows=CATEGORIES.map(category=>{
  const measured=access.filter(row=>row.gridly_category===category),byId=new Map(measured.map(row=>[row.governed_identity,row]));
  const missing=identities.filter(row=>!byId.has(row.governedIdentity));
  const statewideAuthorityCount=countyTotals[category];
  const recoverable=missing.length===0||statewideAuthorityCount===0;
  const rows=recoverable?identities.map(identity=>byId.get(identity.governedIdentity)??{governed_identity:identity.governedIdentity,gridly_category:category,nearest_miles:null,within_5:0,within_10:0,within_25:0,evidence:'STATEWIDE_D4_AUTHORITY_COUNT_ZERO'}):measured;
  return {category,originalMeasuredCount:measured.length,accountedCount:rows.length,missingGovernedIdentities:missing.map(x=>({...x})),statewideAuthorityCount,recoveredZeroRows:rows.length-measured.length,status:rows.length===1888?'MEASURED_RECONCILED':'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE',rows};
 });
 const pharmacy=categoryRows.find(x=>x.category==='PHARMACY'),convenience=categoryRows.find(x=>x.category==='CONVENIENCE');
 return {
  schemaVersion:'gridly.lp24111.d5.recovered-evidence.v1',
  evidenceBasis:'EXISTING_D4_DERIVED_ARTIFACTS_ONLY',
  prohibitedWorkPerformed:[],runtimeActivated:false,productionBehaviorChanged:false,legalState:'LEGAL_REVIEW_REQUIRED',
  artifactAudit:{ownerLocalArtifactsPresent:[],quality:{status:'QUALITY_CLASS_EVIDENCE_NOT_MATERIALIZED',reason:'D.4 names six classes but records neither per-identity classifications nor deterministic classification thresholds.'},categories:{status:'PARTIALLY_RECOVERED'},metadata:{status:'NOT_RECOVERABLE_FROM_COMMITTED_SUMMARY'},brands:{status:'BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION'}},
  quality:{expectedRows:1888,placeRows:1859,nonPlaceRows:29,status:'QUALITY_CLASS_EVIDENCE_NOT_MATERIALIZED',rows:[],reason:'Fail closed: EXISTING_DETERMINISTIC_D4_DESCRIPTIVE_POLICY contains no executable or stated row-classification rules.'},
  categories:{expectedPerCategory:1888,rows:categoryRows,pharmacyRca:{classification:'ZERO_RESULT_HANDLING_DEFECT',measurementStatus:'PHARMACY_TERLINGUA_MEASUREMENT_NOT_MATERIALIZED',exactMissingIdentity:pharmacy.missingGovernedIdentities[0]??null,recovered:false,reason:'The statewide PHARMACY authority is nonzero, so its missing distance row cannot be reconstructed without an existing measured row.'},convenienceRca:{classification:'ACTUAL_NO_AUTHORITY_CATEGORY',taxonomyLabelMeasured:'CONVENIENCE',statewideAuthorityCount:convenience.statewideAuthorityCount,recovered:convenience.accountedCount===1888,reason:'All 254 committed county aggregates conserve to zero CONVENIENCE records; explicit zero-result rows are therefore deterministic and require no spatial rerun.'}},
  metadata:{status:'NOT_RECOVERABLE_FROM_EXISTING_AUTHORITY',audited:reports.metadata.recordsAudited,conflict:reports.metadata.classifications.SPATIAL_METADATA_CONFLICT,incomplete:reports.metadata.classifications.SPATIAL_METADATA_INCOMPLETE,families:null,retainedSample:reports.metadata.retainedSample,reason:'The committed aggregate contains no 149-row field inventory.'},
  recoveryPlan:{brand:{status:'BOUNDED_ID_JOIN_FEASIBILITY_REQUIRES_OWNER_ARTIFACTS',population:'EXACT_D4_STANDALONE_IDS_391772'},metadata:{status:'BOUNDED_ID_JOIN_FEASIBILITY_REQUIRES_OWNER_ARTIFACTS',population:'EXACT_149_D4_CONFLICT_IDS'}},
  brands:{status:'BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION',brandFieldPresent:true,populatedBrandRows:0,aggregateArtifactRows:0,classification:'BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION',authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY',rows:BRANDS.map(brand=>({brand,status:'BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION',recordCount:null,countyCount:null,communityRadiusRepresentation:null,ruralTailPresence:null,authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY'}))}
 };
}

function committedReports(){const dir=path.join(root,'reports/lp24111');return {radius:read(path.join(dir,'community-radius-coverage.json')),nonPlace:read(path.join(dir,'governed-non-place-coverage.json')),access:read(path.join(dir,'category-accessibility.json')),counties:read(path.join(dir,'county-coverage.json')),metadata:read(path.join(dir,'metadata-conflicts.json'))};}

function queryParquet(file,sql){
 const executable=process.env.DUCKDB||'duckdb',result=spawnSync(executable,['-json','-c',sql.replaceAll('$FILE',`'${file.replaceAll("'","''")}'`)],{encoding:'utf8',maxBuffer:256*1024*1024});
 if(result.error||result.status!==0)throw Error(`OWNER_ARTIFACT_READ failed for ${path.basename(file)}: ${String(result.stderr||result.error?.message).trim()}`);
 return result.stdout.trim()?JSON.parse(result.stdout):[];
}

function describeParquet(file){
 return queryParquet(file,'DESCRIBE SELECT * FROM read_parquet($FILE)').map(row=>({name:row.column_name,type:row.column_type}));
}

function requireSchema(artifact,schema,requirements){
 const columns=new Map(schema.map(column=>[column.name,column.type]));
 for(const [name,expected] of Object.entries(requirements)){
  const observed=columns.get(name);
  if(!observed||!expected.test(observed))throw Error(`OWNER_ARTIFACT_SCHEMA_FAILED for ${artifact}: required ${name} ${expected}; observed ${observed??'MISSING'}`);
 }
}

function governedLocalityColumn(schema){
 const names=new Set(schema.map(column=>column.name));
 const name=['locality','governed_locality','spatial_locality'].find(candidate=>names.has(candidate));
 if(!name)throw Error('OWNER_ARTIFACT_SCHEMA_FAILED for metadata-conflicts.parquet: required governed locality context; observed none of locality, governed_locality, spatial_locality');
 return name;
}

const number=value=>Number(value??0);
const normalized=value=>String(value??'').trim().toLocaleLowerCase('en-US');

/** Pure bounded reconciliation used by the owner execution and synthetic tests. */
export function reconcileRichBrandEvidence({conservation,aggregates,sourceInventory=[]}){
 const input=number(conservation.standalone_rows),unique=number(conservation.unique_standalone_ids),joined=number(conservation.joined_richer_ids);
 const duplicateJoinIds=number(conservation.duplicate_richer_ids),joinMissingIds=input-joined;
 if(input!==EXPECTED_STANDALONE_IDS||unique!==EXPECTED_STANDALONE_IDS)throw Error(`STANDALONE_CONSERVATION_FAILED: expected ${EXPECTED_STANDALONE_IDS} unique IDs; got ${input} rows / ${unique} unique`);
 if(duplicateJoinIds!==0)throw Error(`RICHER_DUPLICATE_ID_GATE_FAILED: ${duplicateJoinIds} duplicate IDs`);
 const lookup=new Map(aggregates.map(row=>[normalized(row.brand),row]));
 const rows=BRANDS.map(brand=>{const row=lookup.get(normalized(brand));return {brand,status:row?'MEASURED_PRESENT':'MEASURED_ZERO',recordCount:number(row?.record_count),countyCount:number(row?.county_count),communityRadiusRepresentation:null,ruralTailPresence:null,authorityRole:BRAND_AUTHORITY_ROLE};});
 return {status:'MEASURED_RECONCILED',classification:'RICH_STRUCTURED_BRAND_MEASURED',authorityRole:BRAND_AUTHORITY_ROLE,precedence:['brand.names.primary',"brand.names.common['en']"],joinConservation:{standaloneInputIds:input,uniqueStandaloneIds:unique,joinedRicherIds:joined,missingRicherIds:joinMissingIds,duplicateRicherMatches:duplicateJoinIds},globalSummary:{standaloneRowsAudited:input,rowsWithStructuredBrand:number(conservation.rows_with_brand),rowsWithoutStructuredBrand:input-number(conservation.rows_with_brand),distinctNormalizedBrands:number(conservation.distinct_brands),requestedBrandsPresent:rows.filter(x=>x.status==='MEASURED_PRESENT').length,requestedBrandsZero:rows.filter(x=>x.status==='MEASURED_ZERO').length,joinMissingIds,duplicateJoinIds},rows,sourceInventory:sourceInventory[0]??null};
}

export function classifyMetadataFamily({regionConflict=false,localityConflict=false,postcodeConflict=false}){
 const fields=[regionConflict,localityConflict,postcodeConflict].filter(Boolean).length;
 if(fields>1)return 'MULTI_FIELD_CONFLICT';
 if(regionConflict)return 'STATE_REGION_CONFLICT';
 if(localityConflict)return 'LOCALITY_CONFLICT';
 if(postcodeConflict)return 'POSTCODE_CONFLICT';
 return null;
}

export function reconcileMetadataEvidence(rows){
 if(rows.length!==EXPECTED_CONFLICT_IDS||new Set(rows.map(x=>x.id)).size!==EXPECTED_CONFLICT_IDS)throw Error(`METADATA_CONFLICT_CONSERVATION_FAILED: expected ${EXPECTED_CONFLICT_IDS} unique IDs`);
 const classified=rows.map(row=>({...row,family:classifyMetadataFamily(row)}));
 if(classified.some(x=>!x.family))throw Error('METADATA_UNEXPLAINED_CONFLICT_ID_GATE_FAILED');
 const families=Object.fromEntries(['STATE_REGION_CONFLICT','LOCALITY_CONFLICT','POSTCODE_CONFLICT','MULTI_FIELD_CONFLICT'].map(name=>[name,classified.filter(x=>x.family===name).length]));
 const hitachi=classified.find(x=>x.displayName==='Hitachi Energy Jefferson City');
 return {status:'MEASURED_RECONCILED',joinConservation:{conflictIdsInput:rows.length,uniqueConflictIds:new Set(rows.map(x=>x.id)).size,richerAuthorityMatches:rows.filter(x=>x.richerMatched).length,classifiedFamilyRows:classified.length,familyCountSum:Object.values(families).reduce((a,b)=>a+b,0),duplicateClassifications:0,unexplainedConflictIds:0},families,precedence:'MULTI_FIELD_CONFLICT_WHEN_MORE_THAN_ONE_INDEPENDENT_FIELD_CONFLICTS_OTHERWISE_SINGLE_FIELD',sourceFieldsRewritten:false,hitachi,rows:classified};
}

/** Build the bounded metadata ID-join query with parser-stable, explicit aliases. */
export function metadataRecoveryQuery({conflictFile,richFile,governedLocality}){
 const q=value=>`'${value.replaceAll("'","''")}'`;
 const conflicts=`read_parquet(${q(conflictFile)})`,rich=`read_parquet(${q(richFile)})`;
 return `WITH m AS (SELECT CAST(id AS VARCHAR) AS id,CAST(display_name AS VARCHAR) AS displayName,CAST(${governedLocality} AS VARCHAR) AS governedLocality FROM ${conflicts} WHERE classification='SPATIAL_METADATA_CONFLICT'), r AS (SELECT CAST(id AS VARCHAR) AS id,addresses FROM ${rich}) SELECT m.id AS id,m.displayName AS displayName,(r.id IS NOT NULL) AS richerMatched,(upper(trim(r.addresses.region)) NOT IN ('TX','TEXAS','')) AS regionConflict,(coalesce(trim(m.governedLocality),'')<>'' AND coalesce(trim(r.addresses.locality),'')<>'' AND lower(trim(m.governedLocality))<>lower(trim(r.addresses.locality))) AS localityConflict,(coalesce(trim(r.addresses.postcode),'')<>'' AND NOT regexp_matches(trim(r.addresses.postcode),'^(733|7[5-9]|885)')) AS postcodeConflict,r.addresses.region AS sourceRegion,r.addresses.locality AS sourceLocality,r.addresses.postcode AS sourcePostcode,m.governedLocality AS governedLocality FROM m LEFT JOIN r ON m.id=r.id ORDER BY m.id`;
}

export function reconcileBrandAggregate(measured){
 if(measured.length===0)return null;
 const lookup=new Map(measured.map(row=>[String(row.brand).toLocaleLowerCase('en-US'),row]));
 return {status:'MEASURED_RECONCILED',brandFieldPresent:true,populatedBrandRows:null,aggregateArtifactRows:measured.length,classification:'MEASURED_BRAND_AGGREGATE',authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY',rows:BRANDS.map(brand=>{const row=lookup.get(brand.toLocaleLowerCase('en-US'));return {brand,status:row?'MEASURED_PRESENT':'MEASURED_ZERO',recordCount:Number(row?.standalone_record_count??0),countyCount:Number(row?.counties_represented??0),communityRadiusRepresentation:null,ruralTailPresence:null,authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY'};})};
}

export function recoverOwnerEvidence(directory=path.join(root,'owner-local/lp24111')){
 const evidence=recoverCommittedEvidence(committedReports()),present=[];
 const standaloneFile=path.join(directory,'identity-governed-eligible.parquet');
 const richFile=path.join(directory,'overture-texas-rich-authority-dedup.parquet');
 const conflictFile=path.join(directory,'metadata-conflicts.parquet');
 const ownerFiles={standalone:standaloneFile,rich:richFile,metadata:conflictFile};
 const schemas=Object.fromEntries(Object.entries(ownerFiles).filter(([,file])=>fs.existsSync(file)).map(([role,file])=>[role,describeParquet(file)]));
 evidence.artifactAudit.schemaAudit={status:'OBSERVED_BEFORE_RECOVERY',relations:Object.fromEntries(Object.entries(schemas).map(([role,columns])=>[role,{artifact:path.basename(ownerFiles[role]),columns}]))};
 if(fs.existsSync(standaloneFile)&&fs.existsSync(richFile)){
  requireSchema(path.basename(standaloneFile),schemas.standalone,{id:/./,county_fips:/./});
  requireSchema(path.basename(richFile),schemas.rich,{id:/./,brand:/^STRUCT\((?=.*names)(?=.*primary)(?=.*common)/is,sources:/^STRUCT\((?=.*property)(?=.*dataset)(?=.*license)[\s\S]*\)\[\]$/is});
  present.push(path.basename(standaloneFile),path.basename(richFile));
  const files=`read_parquet('${standaloneFile.replaceAll("'","''")}')`,rich=`read_parquet('${richFile.replaceAll("'","''")}')`;
  const label="coalesce(nullif(trim(r.brand.names.primary),''),nullif(trim(map_extract_value(r.brand.names.common,'en')),''))";
  const conservation=queryParquet(standaloneFile,`WITH s AS (SELECT cast(id AS varchar) id FROM ${files}), r AS (SELECT cast(id AS varchar) id,brand FROM ${rich}), duplicates AS (SELECT id,count(*) n FROM r GROUP BY id HAVING count(*)>1), j AS (SELECT s.id,r.id richer_id,${label} brand_label FROM s LEFT JOIN r ON s.id=r.id) SELECT (SELECT count(*) FROM s) standalone_rows,(SELECT count(DISTINCT id) FROM s) unique_standalone_ids,count(*) FILTER(WHERE j.richer_id IS NOT NULL) joined_richer_ids,(SELECT count(*) FROM duplicates) duplicate_richer_ids,count(*) FILTER(WHERE j.brand_label IS NOT NULL) rows_with_brand,count(DISTINCT lower(j.brand_label)) distinct_brands FROM j`)[0];
  const aggregates=queryParquet(standaloneFile,`WITH r AS (SELECT cast(id AS varchar) id,${label} brand FROM ${rich} r), s AS (SELECT cast(id AS varchar) id,lpad(cast(county_fips AS varchar),5,'0') county_fips FROM ${files}) SELECT r.brand,count(*) record_count,count(DISTINCT s.county_fips) county_count FROM s JOIN r USING(id) WHERE r.brand IS NOT NULL GROUP BY r.brand`);
  const sourceCtes=`WITH s AS (SELECT cast(id AS varchar) id FROM ${files}),r AS (SELECT cast(id AS varchar) id,sources FROM ${rich}),joined AS (SELECT r.id,r.sources FROM s JOIN r ON s.id=r.id),source_rows AS (SELECT joined.id,src FROM joined CROSS JOIN UNNEST(joined.sources) AS u(src))`;
  const sourceInventory=queryParquet(standaloneFile,`${sourceCtes} SELECT (SELECT count(*) FROM s) standalonePopulation,count(DISTINCT id) rowsWithSourceStruct,count(*) sourceEntryCount,list(DISTINCT src.dataset ORDER BY src.dataset) FILTER(WHERE src.dataset IS NOT NULL) datasets,list(DISTINCT src.license ORDER BY src.license) FILTER(WHERE src.license IS NOT NULL) licenses FROM source_rows`);
  sourceInventory[0].sourcePropertyFrequencies=queryParquet(standaloneFile,`${sourceCtes} SELECT src.property property,count(*) frequency FROM source_rows WHERE src.property IS NOT NULL GROUP BY 1 ORDER BY 2 DESC,1`);
  evidence.brands=reconcileRichBrandEvidence({conservation,aggregates,sourceInventory});
  evidence.sourceInventory={...evidence.brands.sourceInventory,legalState:'LEGAL_REVIEW_REQUIRED',legalConclusion:false};
  evidence.artifactAudit.brands={status:'MEASURED_RECONCILED'};
 }
 const brandFile=path.join(directory,'brand-coverage.parquet');
 if(evidence.brands.status!=='MEASURED_RECONCILED'&&fs.existsSync(brandFile)){
  present.push(path.basename(brandFile));const measured=queryParquet(brandFile,'SELECT brand, standalone_record_count, counties_represented FROM read_parquet($FILE)');
  evidence.brands=reconcileBrandAggregate(measured)??evidence.brands;
 }
 if(fs.existsSync(conflictFile)&&fs.existsSync(richFile)){
  requireSchema(path.basename(conflictFile),schemas.metadata,{id:/./,display_name:/./,classification:/./});
  requireSchema(path.basename(richFile),schemas.rich,{id:/./,addresses:/^STRUCT\((?=.*region)(?=.*locality)(?=.*postcode)/is});
  const governedLocality=governedLocalityColumn(schemas.metadata);
  present.push(path.basename(conflictFile));
  const rows=queryParquet(conflictFile,metadataRecoveryQuery({conflictFile,richFile,governedLocality}));
  if(rows.some(x=>!x.richerMatched))throw Error(`METADATA_RICHER_JOIN_FAILED: ${rows.filter(x=>!x.richerMatched).length} missing IDs`);
  evidence.metadata=reconcileMetadataEvidence(rows);
  evidence.metadata.retainedSample=evidence.metadata.hitachi;
  evidence.artifactAudit.metadata={status:'MEASURED_RECONCILED'};
 }else if(fs.existsSync(conflictFile)){present.push(path.basename(conflictFile));evidence.metadata.ownerArtifactPresent=true;evidence.metadata.reason='Rich authority or standalone authority is not mounted; exact recovery was not attempted.';}
 for(const name of ['coverage-measurements.duckdb','community-radius-coverage.parquet','identity-governed-eligible.parquet'])if(fs.existsSync(path.join(directory,name)))present.push(name);
 evidence.categories.pharmacyRca.measurementStatus='PHARMACY_TERLINGUA_MEASUREMENT_NOT_MATERIALIZED';
 evidence.recoveryPlan={brand:{status:'BOUNDED_ID_JOIN_FEASIBILITY_REQUIRES_OWNER_ARTIFACTS',population:'EXACT_D4_STANDALONE_IDS_391772',operation:'Join the exact D.4 poi.id population read-only to an existing richer authority id, then aggregate only the 20 requested brands; no spatial operation.'},metadata:{status:'BOUNDED_ID_JOIN_FEASIBILITY_REQUIRES_OWNER_ARTIFACTS',population:'EXACT_149_D4_CONFLICT_IDS',requiredFields:['source_region','source_postcode','governed_spatial_locality'],families:['STATE_REGION_CONFLICT','LOCALITY_CONFLICT','POSTCODE_CONFLICT','MULTI_FIELD_CONFLICT']},pharmacy:{status:'PHARMACY_TERLINGUA_MEASUREMENT_NOT_MATERIALIZED',futureMeasurement:'One bounded nearest/radius measurement for governed identity 4872248 and PHARMACY only.'},quality:{status:'QUALITY_CLASS_EVIDENCE_NOT_MATERIALIZED',futureMeasurement:'None authorized; locate the original executable D.4 policy and classify only already-measured D.4 rows.'}};
 evidence.artifactAudit.ownerLocalArtifactsPresent=[...new Set(present)].sort();return evidence;
}

const args=new Set(process.argv.slice(2));
const isMain=process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href;
if(isMain){
 if(args.has('--help'))console.log('Reads existing D.4 JSON/owner-local derived artifacts only; writes owner-local/lp24111/phase-d5-recovered-evidence.json.');
 else {const output=path.join(root,'owner-local/lp24111/phase-d5-recovered-evidence.json');fs.mkdirSync(path.dirname(output),{recursive:true});const evidence=recoverOwnerEvidence();fs.writeFileSync(output,stable(evidence));console.log(`${evidence.schemaVersion}: ${output}`);}
}
