import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'reports/lp24111');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const stable=x=>`${JSON.stringify(x,null,2)}\n`;
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const release='2026-08-19.0';
const uri=`s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*`;
const UNKNOWN='NOT_EXECUTED';
const measured={evidenceType:'OWNER_EXECUTED_AUTHORITATIVE_PHASE_B',duckdb:'1.5.5 (Variegata)',releaseId:release,
 bbox:{bounds:{xmin:-106.7,xmax:-93.5,ymin:25.8,ymax:36.6},role:'PERFORMANCE_PREFILTER_NOT_INCLUSION_AUTHORITY',rows:1993312,probeSeconds:16.354,materializeSeconds:42.6501065,bytes:79755333},
 authority:{rows:1462815,seconds:1353.794,bytes:58107610,projection:['id','geometry','bbox']},
 counties:{measured:254,withPois:254,withoutPois:0,assignmentTotal:1462815,maximumPois:264066},
 king:{fips:'48269',count:14,bounds:{xmin:-100.51869951397825,xmax:-99.99098835649599,ymin:33.397002693291206,ymax:33.83615278134176},literalProbeSeconds:6.460},
 rural:[['48269','King',14],['48301','Loving',21],['48033','Borden',38],['48393','Roberts',41],['48263','Kent',42],['48173','Glasscock',47],['48261','Kenedy',55],['48443','Terrell',74],['48155','Foard',75],['48345','Motley',81],['48431','Sterling',84],['48433','Stonewall',85],['48235','Irion',86],['48101','Cottle',92],['48079','Cochran',102]]};
const schema=['id','geometry','categories','confidence','websites','emails','socials','phones','brand','addresses','names','sources','operating_status','basic_category','taxonomy','version','bbox','theme','type'];

function artifacts(){
 const counties=read('data/lp104/texas-counties.json').counties;
 const places=read('data/generated/gridly-statewide-place-presentation-v1.json').places;
 const projection=read('data/generated/gridly-statewide-consumer-community-projection-v1.json');
 const cohort=read('reports/lp24110/statewide-poi-cohort.json');
 const categoryMap=read('tools/lp24111/category-map.json');
 const rural=new Map(measured.rural.map(([f,n,c])=>[f,{countyName:n,rawPoiCount:c}]));
 const countyRows=counties.map(c=>({countyFips:c.fips,countyName:c.countyName,rawPoiCount:rural.get(c.fips)?.rawPoiCount??null,evidence:rural.has(c.fips)?'OWNER_MEASURED_EXACT':'OWNER_AGGREGATE_ONLY'}));
 const communityRows=Object.entries(places).map(([id,p])=>({communityId:id,latitude:p.lat,longitude:p.lon,radiusMiles:{5:null,10:null,25:null},measurement:UNKNOWN}));
 const nonPlace=[
  ['moss-hill','Moss Hill','liberty-tx',30.253,-94.748],['raywood','Raywood','liberty-tx',30.0366,-94.6716],['tarkington','Tarkington','liberty-tx',30.3205,-94.996],['new-caney','New Caney','montgomery-tx',null,null],['porter','Porter','montgomery-tx',null,null]
 ].map(([id,name,countyId,lat,lon])=>({governedId:id,name,countyId,placeGeoid:null,anchor:lat===null?null:{latitude:lat,longitude:lon},radiiMiles:{5:null,10:null,25:null},coverage:UNKNOWN}));
 const files={};
 files['execution-summary.json']={schemaVersion:'gridly.lp24111.phase-b.execution.v1',...measured,richFieldManufacturing:UNKNOWN,normalization:UNKNOWN,source:'OWNER_EXECUTED_EVIDENCE_INGESTED_2026-08-28'};
 files['overture-release.json']={schemaVersion:'gridly.lp24111.release.v2',releaseId:release,pinPolicy:'EXACT_RELEASE_ONLY',sourceUri:uri,theme:'places',type:'place',retrievalDate:'2026-08-28',duckdb:measured.duckdb,observedGeometryCrs:'OGC:CRS84',censusInputCrs:'EPSG:4269'};
 files['schema-inventory.json']={schemaVersion:'gridly.lp24111.schema.v2',evidenceState:'OWNER_OBSERVED',fields:schema.map(field=>({field,observed:true})),richProjection:['id','geometry','bbox','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources','websites','phones']};
 files['texas-extraction-summary.json']={schemaVersion:'gridly.lp24111.extraction.v2',executionState:'OWNER_EXECUTED',releaseId:release,coarsePrefilter:measured.bbox,spatialAuthority:measured.authority,inclusionAuthority:'2025_CENSUS_TEXAS_COUNTY_GEOMETRY_INTERSECTION',crsTransform:"EPSG:4269 -> OGC:CRS84; always_xy=true",outputIgnored:true};
 files['county-coverage.json']={schemaVersion:'gridly.lp24111.counties.v2',executionState:'OWNER_EXECUTED_AGGREGATE_AND_RURAL_TAIL',...measured.counties,expectedCountyCount:254,accountedCountyCount:countyRows.length,rows:countyRows};
 files['county-assignment-certification.json']={schemaVersion:'gridly.lp24111.assignment.v1',authorityUniqueRows:1462815,assignmentRows:1462815,aggregateConservation:true,exactUniqueIdConservation:UNKNOWN,unassignedPoiCount:null,multiAssignedPoiCount:null,boundaryBehavior:'GENERATED_CERTIFIER_CLASSIFIES_BOUNDARY_MULTI_INTERSECTION',certification:'PENDING_OWNER_RERUN_WITH_NEW_CERTIFICATION_ARTIFACT',reason:'Equal aggregate totals do not prove per-ID uniqueness.'};
 files['rural-tail.json']={schemaVersion:'gridly.lp24111.rural.v1',executionState:'OWNER_EXECUTED',minimumCounty:{fips:'48269',name:'King',rawPoiCount:14},rows:measured.rural.map(([countyFips,countyName,rawPoiCount])=>({countyFips,countyName,rawPoiCount})),rawPlacesNotBusinessCount:true};
 files['community-coverage.json']={schemaVersion:'gridly.lp24111.community.v2',executionState:UNKNOWN,canonicalPlaceExpected:1859,canonicalPlaceAccounted:communityRows.length,radiiMiles:[5,10,25],rows:communityRows};
 files['governed-non-place-coverage.json']={schemaVersion:'gridly.lp24111.non-place.v1',executionState:UNKNOWN,governedInventory:{total:29,houstonRegions:15,sanAntonioRegions:9,ordinaryCommunities:5},note:'All 29 remain governed; five ordinary identities are enumerated here. Region anchors require build-authority export before measurement.',rows:nonPlace,noFabricatedPlaceGeoids:true};
 files['category-coverage.json']={schemaVersion:'gridly.lp24111.categories.v2',executionState:UNKNOWN,mappingSha256:sha('tools/lp24111/category-map.json'),mapping:categoryMap,results:Object.keys(categoryMap.categories).map(category=>({category,rawCount:null,normalizedCount:null,countiesRepresented:null}))};
 files['brand-coverage.json']={schemaVersion:'gridly.lp24111.brands.v2',executionState:UNKNOWN,brands:['Walmart','H-E-B','Brookshire Brothers','Dollar General','Family Dollar','Best Western','Holiday Inn Express','Hampton Inn','Fairfield','Comfort Suites','Home2 Suites','Motel 6'].map(brand=>({brand,count:null,status:UNKNOWN}))};
 files['duplicate-child-poi-analysis.json']={schemaVersion:'gridly.lp24111.identity.v2',executionState:UNKNOWN,classifications:['PARENT_POI','CHILD_POI','LIKELY_DUPLICATE','DISTINCT_POI','AMBIGUOUS'],families:['Walmart Pharmacy','Walmart Bakery','Walmart Vision','Walmart Photo','Walmart Auto Care'],audits:['lodging duplication','gas/convenience overlap'],destructiveConflation:false};
 files['confidence-analysis.json']={schemaVersion:'gridly.lp24111.confidence.v2',executionState:'KING_SAMPLE_ONLY',candidateThresholds:[0.5,0.7,0.8,0.9],requiredSegments:['statewide','rural counties','metro counties','named brands','Gridly traveler categories','metadata conflicts','probable duplicates','child POIs'],distributions:null,policy:'NO_CUTOFF_RECOMMENDED_CONFIDENCE_IS_NOT_ACCEPTANCE_AUTHORITY',evidence:'0.886 conflict and plausible rural records at 0.762, 0.485, and 0.176'};
 files['spatial-metadata-conflicts.json']={schemaVersion:'gridly.lp24111.metadata-conflict.v1',executionState:'KING_SAMPLE_ONLY',classification:'SPATIAL_METADATA_CONFLICT',sample:{name:'Hitachi Energy Jefferson City',spatialCountyFips:'48269',region:'MO',locality:'Jefferson City',postcode:'65101-5032',confidence:0.886},statewideCount:null,policy:'QUARANTINE_OR_CLASSIFY; NEVER REWRITE SOURCE METADATA'};
 files['address-locality-quality.json']={schemaVersion:'gridly.lp24111.address.v2',executionState:'KING_SAMPLE_ONLY',statewideMetrics:{address:null,locality:null,region:null,postcode:null},policy:'Compare against governed spatial identity; do not fabricate or silently correct source addresses.'};
 files['normalized-schema-proposal.json']={schemaVersion:'gridly.lp24111.normalized.v2',status:'BUILD_PROPOSAL_NOT_RUNTIME',fields:['poiId','name','normalizedName','brand','gridlyCategories','latitude','longitude','sourceAddress','sourceLocality','sourceRegion','sourcePostcode','countyFips','spatialAuthority','metadataConsistency','identityClassification','confidence','operatingStatus','source'],buildOnly:['bbox','alternateNames','alternateCategories','taxonomy','phones','websites','sources','conflationSignals'],zeroQueryCost:true};
 files['package-size-model.json']={schemaVersion:'gridly.lp24111.shards.v1',executionState:UNKNOWN,architecture:['literal/precomputed shard bounds','remote bounded rich projection','local authoritative-ID match','normalize','category map','identity audit','quality audit','package','verify','immutable manifest'],literalPushdownEvidence:{kingRows:14,seconds:6.460},measurements:{rawRowsPerShard:null,normalizedRowsPerShard:null,compressedBytes:null,denseMetroWorstCase:null,ruralShardBytes:null,queryFanout:null},constraints:{singleAssetBytes:26214400,wholeTexasPhoneDownloadForbidden:true,neighborAndRadiusExpansionRequired:true},productionChoice:'NOT_SELECTED_PENDING_MEASUREMENTS'};
 files['refresh-pipeline.json']={schemaVersion:'gridly.lp24111.refresh.v2',stages:['PIN','LITERAL_BOUNDS','SPATIAL_PROJECTION','LOCAL_CENSUS_ASSIGN','AUTHORITATIVE_IDS','SHARDED_RICH_FETCH','LOCAL_ID_MATCH','NORMALIZE','CATEGORY_MAP','IDENTITY_AUDIT','QUALITY','PACKAGE','VERIFY','IMMUTABLE_MANIFEST'],latestForbidden:true,deployIncluded:false};
 files['attribution-licensing.json']={schemaVersion:'gridly.lp24111.license.v2',reviewState:'LEGAL_REVIEW_REQUIRED',sourceInventoryExecution:UNKNOWN,observedProvenanceField:'sources',legalConclusion:false};
 files['osm-supplement-evaluation.json']={schemaVersion:'gridly.lp24111.osm.v2',classification:'INSUFFICIENT_EVIDENCE',incrementalUniqueCoverage:null,duplicateOverlap:null,odbl:'LEGAL_REVIEW_REQUIRED',merged:false};
 files['lp24110-cohort-reconciliation.json']={schemaVersion:'gridly.lp24111.cohort.v2',executionState:UNKNOWN,communityCount:cohort.communities.length,communities:cohort.communities.map(c=>({...c,normalizedCapability:UNKNOWN})),runtimeClaim:false};
 files['owner-poc-reconciliation.json']={schemaVersion:'gridly.lp24111.owner-poc.v1',executionState:'OWNER_OBSERVED_NOT_INDEPENDENTLY_REPRODUCED',areas:[{area:'Dayton / Liberty',evidence:['Walmart inventory','fuel','hospital/medical']},{area:'Tarkington / rural Liberty County',evidence:['H-E-B','Brookshire Brothers','Walmart','Tarkington Country Mart','local markets','convenience stores','gas','Dollar General','Family Dollar']},{area:'Pecos / West Texas',evidence:['Best Western','Holiday Inn Express','Hampton Inn','Fairfield','Comfort Suites','Home2 Suites','Motel 6','local/other lodging']} ]};
 files['exception-ledger.json']={schemaVersion:'gridly.lp24111.exceptions.v2',exceptions:[{id:'UNIQUE_ASSIGNMENT_OWNER_RERUN_REQUIRED',severity:'BLOCKER'},{id:'RICH_FIELDS_NOT_MATERIALIZED',severity:'BLOCKER'},{id:'NORMALIZED_STATEWIDE_ANALYSIS_NOT_EXECUTED',severity:'BLOCKER'},{id:'PACKAGE_MEASUREMENTS_NOT_EXECUTED',severity:'BLOCKER'},{id:'NON_PLACE_RADIUS_MEASUREMENT_NOT_EXECUTED',severity:'OPEN'},{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'},{id:'OSM_INCREMENT_NOT_MEASURED',severity:'OPEN'}]};
 files['certification.json']={schemaVersion:'gridly.lp24111.certification.v2',classifications:['OVERTURE_TEXAS_SPATIAL_AUTHORITY_MEASURED','OVERTURE_TEXAS_AUTHORITY_VIABLE_WITH_NORMALIZATION','MANUFACTURING_EXECUTION_REQUIRED','LEGAL_REVIEW_REQUIRED','OWNER_DECISION_REQUIRED'],productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',zeroCostContract:'NON_RUNTIME',mergeRecommendation:'MERGE_AUDIT_TOOLING_AND_EVIDENCE_ONLY',nextAction:'Rerun repaired extraction to emit per-ID county assignment certification, then execute literal-bound rich shard manufacturing and normalization.'};
 return files;
}

export function verify(){
 const a=artifacts();
 if(a['overture-release.json'].releaseId!==release || uri.includes('latest')) throw Error('release pin failed');
 if(a['texas-extraction-summary.json'].spatialAuthority.rows!==1462815) throw Error('owner authority count failed');
 if(a['county-coverage.json'].accountedCountyCount!==254 || a['county-coverage.json'].withoutPois!==0) throw Error('county evidence failed');
 if(a['community-coverage.json'].canonicalPlaceAccounted!==1859) throw Error('PLACE inventory failed');
 if(a['governed-non-place-coverage.json'].governedInventory.total!==29) throw Error('non-PLACE governance failed');
 if(!a['category-coverage.json'].mapping.nonDestinationExclusions.includes('mountain') || !a['category-coverage.json'].mapping.humanMedicalExclusions.includes('animal_hospital')) throw Error('category exclusions failed');
 if(!a['confidence-analysis.json'].policy.startsWith('NO_CUTOFF_RECOMMENDED')) throw Error('confidence policy failed');
 if(a['certification.json'].productionPoiSearch!=='NOT_LAUNCHED_NOT_CERTIFIED') throw Error('runtime boundary failed');
 return a;
}
const args=new Set(process.argv.slice(2)); const a=verify();
if(args.has('--write')){fs.mkdirSync(out,{recursive:true}); for(const [f,v] of Object.entries(a)) fs.writeFileSync(path.join(out,f),stable(v)); console.log(`wrote ${Object.keys(a).length} LP241.11 artifacts`);}
else if(args.has('--verify')){for(const [f,v] of Object.entries(a)){const p=path.join(out,f); if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==stable(v)) throw Error(`stale/missing ${f}`);} console.log(`verified ${Object.keys(a).length} LP241.11 artifacts`);}
else console.log('use --write or --verify');
