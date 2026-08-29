import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {certificationGate} from './identity-governance.mjs';
import {pendingReports,validateEnvelope} from './coverage-certification.mjs';

const root=path.resolve(import.meta.dirname,'../..');
const out=path.join(root,'reports/lp24111');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const stable=x=>`${JSON.stringify(x,null,2)}\n`;
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
const release='2026-08-19.0';
const uri=`s3://overturemaps-us-west-2/release/${release}/theme=places/type=place/*`;
const UNKNOWN='NOT_EXECUTED';
const assignment={authorityIds:1462815,uniqueIds:1462815,uniqueCountyAssignments:1462815,unassigned:0,boundaryMulti:0,totalCountyIntersections:1462815,elapsedSeconds:41.4236056,artifactBytes:29744844};
const measured={evidenceType:'OWNER_EXECUTED_AUTHORITATIVE_PHASE_B',duckdb:'1.5.5 (Variegata)',releaseId:release,
 bbox:{bounds:{xmin:-106.7,xmax:-93.5,ymin:25.8,ymax:36.6},role:'PERFORMANCE_PREFILTER_NOT_INCLUSION_AUTHORITY',rows:1993312,probeSeconds:16.354,materializeSeconds:42.6501065,bytes:79755333},
 authority:{rows:1462815,seconds:1353.794,bytes:58107610,projection:['id','geometry','bbox']},
 counties:{measured:254,withPois:254,withoutPois:0,assignmentTotal:1462815,maximumPois:264066},
 king:{fips:'48269',count:14,bounds:{xmin:-100.51869951397825,xmax:-99.99098835649599,ymin:33.397002693291206,ymax:33.83615278134176},literalProbeSeconds:6.460},
 rural:[['48269','King',14],['48301','Loving',21],['48033','Borden',38],['48393','Roberts',41],['48263','Kent',42],['48173','Glasscock',47],['48261','Kenedy',55],['48443','Terrell',74],['48155','Foard',75],['48345','Motley',81],['48431','Sterling',84],['48433','Stonewall',85],['48235','Irion',86],['48101','Cottle',92],['48079','Cochran',102]]};
const richConservation={inputShardRows:1462893,uniqueIds:1462815,crossShardDuplicateIds:52,extraDuplicateRows:78,maximumShardOccurrencesPerId:4,missingAuthorityIds:0,outsideAuthorityIds:0};
const schema=['id','geometry','categories','confidence','websites','emails','socials','phones','brand','addresses','names','sources','operating_status','basic_category','taxonomy','version','bbox','theme','type'];

const unavailableReason='The 168 owner-local matched Parquet shards are absent from this checkout; counts are not inferred from raw authority totals.';

export function artifacts(options={}){
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
 const shardRows=[];
 for(let y=25;y<37;y++) for(let x=-107;x<-93;x++) {
  const bounds={xmin:Math.max(x,-106.7),ymin:Math.max(y,25.8),xmax:Math.min(x+1,-93.5),ymax:Math.min(y+1,36.6)};
  if(bounds.xmin>=bounds.xmax||bounds.ymin>=bounds.ymax) continue;
  shardRows.push({shardId:`tx-${String(y).padStart(2,'0')}-${String(Math.abs(x)).padStart(3,'0')}`,bounds,rawRows:null,richFieldBytes:null,normalizedRows:null,compressedPackageBytes:null,measurement:UNKNOWN});
 }
 files['rich-shard-manifest.json']={schemaVersion:'gridly.lp24111.rich-shards.v1',releaseId:release,immutableInput:true,design:'ONE_DEGREE_GEOGRAPHIC_GRID_CLIPPED_TO_TEXAS_PREFILTER',countyHardWalls:false,borderAndMultiCountySupported:true,radiusExpansion:'LOAD_ALL_INTERSECTING_SHARDS',projection:schema.filter(f=>['id','geometry','bbox','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources','websites','phones'].includes(f)),shardCount:shardRows.length,rows:shardRows};
 files['execution-summary.json']={schemaVersion:'gridly.lp24111.phase-c.execution.v1',...measured,countyAssignment:assignment,richFieldManufacturing:UNKNOWN,normalization:UNKNOWN,source:'OWNER_EXECUTED_EVIDENCE_INGESTED_2026-08-28'};
 files['overture-release.json']={schemaVersion:'gridly.lp24111.release.v2',releaseId:release,pinPolicy:'EXACT_RELEASE_ONLY',sourceUri:uri,theme:'places',type:'place',retrievalDate:'2026-08-28',duckdb:measured.duckdb,observedGeometryCrs:'OGC:CRS84',censusInputCrs:'EPSG:4269'};
 files['schema-inventory.json']={schemaVersion:'gridly.lp24111.schema.v2',evidenceState:'OWNER_OBSERVED',fields:schema.map(field=>({field,observed:true})),richProjection:['id','geometry','bbox','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources','websites','phones']};
 files['texas-extraction-summary.json']={schemaVersion:'gridly.lp24111.extraction.v2',executionState:'OWNER_EXECUTED',releaseId:release,coarsePrefilter:measured.bbox,spatialAuthority:measured.authority,inclusionAuthority:'2025_CENSUS_TEXAS_COUNTY_GEOMETRY_INTERSECTION',crsTransform:"EPSG:4269 -> OGC:CRS84; always_xy=true",outputIgnored:true};
 files['county-coverage.json']={schemaVersion:'gridly.lp24111.counties.v2',executionState:'OWNER_EXECUTED_AGGREGATE_AND_RURAL_TAIL',...measured.counties,expectedCountyCount:254,accountedCountyCount:countyRows.length,rows:countyRows};
 files['county-assignment-certification.json']={schemaVersion:'gridly.lp24111.assignment.v2',executionState:'OWNER_EXECUTED_MEASURED',artifact:'owner-local/lp24111/county-assignment-certification.parquet',...assignment,zeroCountLoss:true,exactUniqueIdConservation:'CERTIFIED',certification:'CERTIFIED_EXACT_PER_ID_CONSERVATION',source:'OWNER_ACCEPTANCE_RESULT_2026-08-28'};
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
 files['rich-field-extraction.json']={schemaVersion:'gridly.lp24111.rich-extraction.v1',executionState:UNKNOWN,reason:'Required owner-local spatial-authority Parquet is not present in this checkout; no remote rich-field measurement was inferred.',projection:['id','geometry','bbox','names','categories','basic_category','taxonomy','confidence','brand','addresses','operating_status','sources','websites','phones'],remoteStrategy:'LITERAL_BBOX_SHARDS',localAuthorityMatch:true,globalSelectStar:false,globalAuthorityJoin:false};
 files['rich-authority-conservation.json']={schemaVersion:'gridly.lp24111.rich-conservation.v1',executionState:'OWNER_CERTIFIED',releaseId:release,authorityIds:assignment.authorityIds,...richConservation,conservationPassed:true,deduplicatedArtifact:'owner-local/lp24111/overture-texas-rich-authority-dedup.parquet',deduplicatedArtifactPresent:false,normalizationGate:'BLOCKED_LOCAL_INPUTS_ABSENT'};
 files['normalization-summary.json']={schemaVersion:'gridly.lp24111.normalization.v1',executionState:UNKNOWN,rawUniquePois:richConservation.uniqueIds,normalizedUniquePois:null,eligibleDestinations:null,nonDestination:null,excluded:null,reviewRequired:null,reason:unavailableReason};
 files['human-medical-quality.json']={schemaVersion:'gridly.lp24111.human-medical.v1',executionState:UNKNOWN,rawHumanMedicalCandidates:null,veterinaryExclusions:null,retainedHospital:null,retainedEmergencyCare:null,retainedUrgentCare:null,retainedPharmacy:null,animalHealthAcceptedAsHumanMedical:false};
 files['metadata-conflicts.json']={...files['spatial-metadata-conflicts.json'],schemaVersion:'gridly.lp24111.metadata-conflict.v2',requiredClassifications:['SPATIAL_METADATA_CONSISTENT','SPATIAL_METADATA_CONFLICT','SPATIAL_METADATA_INCOMPLETE','SPATIAL_METADATA_REVIEW_REQUIRED']};
 files['normalized-county-coverage.json']={schemaVersion:'gridly.lp24111.normalized-counties.v1',executionState:UNKNOWN,expectedCountyCount:254,accountedCountyCount:countyRows.length,rows:countyRows.map(row=>({...row,eligibleDestinations:null,excludedNonDestinations:null,reviewRequired:null,metadataConflicts:null,childOrDuplicate:null,coverageClass:'UNKNOWN'}))};
 files['compact-runtime-schema.json']={schemaVersion:'gridly.lp24111.compact-runtime-schema.v2',status:'MEASUREMENT_PROJECTION_NOT_RUNTIME',eligibleOnly:true,fields:['id','displayName','normalizedName','brand','gridlyCategory','latitude','longitude','countyFips','locality','operatingStatus'],buildOnly:['sourceMetadata','fullAddresses','alternateNames','fullCategories','taxonomy','phones','websites','emails','socials','bbox','conflationEvidence'],qualityClassIncluded:false,estimatedPackageBytes:null};
 files['package-size-model.json']={schemaVersion:'gridly.lp24111.shards.v2',executionState:UNKNOWN,architecture:['literal/precomputed shard bounds','remote bounded rich projection','local authoritative-ID match','normalize','category map','identity audit','quality audit','package','verify','immutable manifest'],manifest:'reports/lp24111/rich-shard-manifest.json',literalPushdownEvidence:{kingRows:14,seconds:6.460},measurements:{rawRowsPerShard:null,richFieldBytesPerShard:null,normalizedRowsPerShard:null,compressedBytes:null,largestShard:null,smallestShard:null,denseMetroExamples:null,ruralShardExamples:null,expectedSearchFanout:null},constraints:{singleAssetBytes:26214400,wholeTexasPhoneDownloadForbidden:true,neighborAndRadiusExpansionRequired:true},productionChoice:'NOT_SELECTED_PENDING_MEASUREMENTS'};
 files['review-taxonomy-census.json']={schemaVersion:'gridly.lp24111.review-taxonomy-census.v1',executionState:UNKNOWN,input:'owner-local/lp24111/overture-texas-normalized-poi.parquet',reviewRequiredBefore:1001637,topPrimaryBasicFamilies:null,topHierarchyValues:null,topNameCategoryCombinations:null,evidencePresence:{brand:null,address:null,phoneOrWebsite:null},byCounty:null,byDensity:null,reason:'The owner-local normalized and rich Parquets required for the D.2 census are absent from this checkout; no taxonomy frequencies are inferred.'};
 files['taxonomy-resolution-ledger.json']={schemaVersion:'gridly.lp24111.taxonomy-resolution-ledger.v1',executionState:UNKNOWN,policy:'EXPLICIT_TAXONOMY_ONLY_CONFIDENCE_NEVER_CLASSIFIES',decisions:[],candidatePolicy:'tools/lp24111/taxonomy-policy.json',before:{eligible:364959,nonDestination:83992,excluded:12227,reviewRequired:1001637},after:{eligible:null,nonDestination:null,excluded:null,reviewRequired:null},reason:'Governed candidate rules require owner-local census measurement before their counts can be accepted as a D.2 resolution ledger.'};
 files['compact-package-measurements.json']={schemaVersion:'gridly.lp24111.compact-packages.v1',executionState:UNKNOWN,eligibleOnly:true,compression:'gzip-9',compactFields:['id','displayName','normalizedName','brand','gridlyCategory','latitude','longitude','countyFips','locality','operatingStatus'],statistics:null,denseShard:null,thresholdBytes:26214400,searchFanout:null,reason:'Compact artifacts must be measured from the absent owner-local normalized Parquet; estimates are prohibited.'};
 files['refresh-pipeline.json']={schemaVersion:'gridly.lp24111.refresh.v2',stages:['PIN','LITERAL_BOUNDS','SPATIAL_PROJECTION','LOCAL_CENSUS_ASSIGN','AUTHORITATIVE_IDS','SHARDED_RICH_FETCH','LOCAL_ID_MATCH','NORMALIZE','CATEGORY_MAP','IDENTITY_AUDIT','QUALITY','PACKAGE','VERIFY','IMMUTABLE_MANIFEST'],latestForbidden:true,deployIncluded:false};
 files['attribution-licensing.json']={schemaVersion:'gridly.lp24111.license.v2',reviewState:'LEGAL_REVIEW_REQUIRED',sourceInventoryExecution:UNKNOWN,observedProvenanceField:'sources',legalConclusion:false};
 files['osm-supplement-evaluation.json']={schemaVersion:'gridly.lp24111.osm.v2',classification:'INSUFFICIENT_EVIDENCE',incrementalUniqueCoverage:null,duplicateOverlap:null,odbl:'LEGAL_REVIEW_REQUIRED',merged:false};
 files['lp24110-cohort-reconciliation.json']={schemaVersion:'gridly.lp24111.cohort.v2',executionState:UNKNOWN,communityCount:cohort.communities.length,communities:cohort.communities.map(c=>({...c,normalizedCapability:UNKNOWN})),runtimeClaim:false};
 files['owner-poc-reconciliation.json']={schemaVersion:'gridly.lp24111.owner-poc.v1',executionState:'OWNER_OBSERVED_NOT_INDEPENDENTLY_REPRODUCED',areas:[{area:'Dayton / Liberty',evidence:['Walmart inventory','fuel','hospital/medical']},{area:'Tarkington / rural Liberty County',evidence:['H-E-B','Brookshire Brothers','Walmart','Tarkington Country Mart','local markets','convenience stores','gas','Dollar General','Family Dollar']},{area:'Pecos / West Texas',evidence:['Best Western','Holiday Inn Express','Hampton Inn','Fairfield','Comfort Suites','Home2 Suites','Motel 6','local/other lodging']} ]};
 const d3Pending={executionState:'NOT_EXECUTED',reason:'Owner-local normalized Parquet and D.3 measured envelope are absent; no counts are inferred.',nonRuntime:true};
 files['poi-identity-summary.json']={schemaVersion:'gridly.lp24111.poi-identity-summary.v1',...d3Pending,identityClasses:['PARENT_POI','CHILD_POI','LIKELY_DUPLICATE','DISTINCT_POI','AMBIGUOUS'],rawEligibleCount:393038,parentDestinationCount:null,childPoiCount:null,likelyDuplicateCount:null,distinctPoiCount:null,ambiguousCount:null,identityGovernedStandaloneCount:null,sourceRecordsDeleted:0};
 files['child-poi-analysis.json']={schemaVersion:'gridly.lp24111.child-poi.v1',...d3Pending,families:['WALMART_DEPARTMENT','TARGET_CVS_DEPARTMENT','RETAIL_DEPARTMENT','KIOSK_LOCKER'],rules:['explicit department naming','parent role','within 100 metres','brand/address/phone/domain corroboration'],results:null};
 files['duplicate-cluster-analysis.json']={schemaVersion:'gridly.lp24111.duplicate-clusters.v1',...d3Pending,architecture:{blocking:'county + 0.01-degree spatial cell',maximumBlockMembers:250,maximumPairDistanceMeters:150,unrestrictedN2:false},candidatePairs:null,candidateClusters:null,largestClusterSize:null,distanceDistribution:null,signalCombinations:null};
 files['parent-selection-ledger.json']={schemaVersion:'gridly.lp24111.parent-selection.v1',...d3Pending,precedence:['explicit parent role','non-child role','metadata completeness','lexical Overture ID'],confidenceAuthority:false,rows:[]};
 files['fuel-convenience-identity.json']={schemaVersion:'gridly.lp24111.fuel-convenience.v1',...d3Pending,overlapCandidates:null,mergedIdentityProposals:null,distinctColocated:null,ambiguous:null,categoryRichnessPreserved:true};
 files['medical-identity-analysis.json']={schemaVersion:'gridly.lp24111.medical-identity.v1',...d3Pending,parentFacilities:null,childDepartments:null,separateFacilities:null,ambiguousCampusRelationships:null,veterinaryHumanMedicalMerges:0};
 files['lodging-duplicate-analysis.json']={schemaVersion:'gridly.lp24111.lodging-duplicates.v1',...d3Pending,pecosCohort:['Best Western','Holiday Inn Express','Hampton Inn','Fairfield','Comfort Suites','Home2 Suites','Motel 6'],candidateClusters:null,likelyDuplicateClusters:null,distinctSameLocationClusters:null,ambiguousClusters:null};
 files['owner-poc-identity-reconciliation.json']={schemaVersion:'gridly.lp24111.owner-poc-identity.v1',...d3Pending,areas:[{area:'DAYTON / LIBERTY',result:'AMBIGUOUS'},{area:'TARKINGTON',result:'AMBIGUOUS'},{area:'PECOS',result:'AMBIGUOUS'}],runtimeClaim:false};
 files['identity-package-impact.json']={schemaVersion:'gridly.lp24111.identity-package-impact.v1',...d3Pending,baseline:{eligibleRows:393038,statewideCompressedBytes:24693819,largestShardBytes:4262172},measurement:null,separateFromD2:true};
 files['identity-exception-ledger.json']={schemaVersion:'gridly.lp24111.identity-exceptions.v1',...d3Pending,requiredTypes:['UNRESOLVED_AMBIGUOUS','MULTI_PARENT','CONFLICTING_ADDRESS_NAME','SAME_ADDRESS_DISTINCT_BUSINESSES','SHARED_PHONE_FALSE_POSITIVE','MALL_STRIP_CENTER_COLOCATION','HOSPITAL_CAMPUS_AMBIGUITY','FUEL_CONVENIENCE_AMBIGUITY'],rows:[]};
 files['exception-ledger.json']={schemaVersion:'gridly.lp24111.exceptions.v4',exceptions:[{id:'OWNER_CERTIFIED_RICH_SHARDS_ABSENT_FROM_CHECKOUT',severity:'BLOCKER',expectedFiles:168},{id:'DEDUP_ARTIFACT_NOT_MATERIALIZED',severity:'BLOCKER'},{id:'NORMALIZED_STATEWIDE_ANALYSIS_NOT_EXECUTED',severity:'BLOCKER'},{id:'PACKAGE_MEASUREMENTS_NOT_EXECUTED',severity:'BLOCKER'},{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'},{id:'OSM_INCREMENT_NOT_MEASURED',severity:'OPEN'}]};
 files['certification.json']={schemaVersion:'gridly.lp24111.certification.v4',executiveResult:'PHASE_D_NOT_EXECUTED_INPUT_ARTIFACTS_UNAVAILABLE',richAuthorityConservation:'OWNER_CERTIFIED',productViability:'OVERTURE_TEXAS_POI_AUTHORITY_NOT_YET_PRODUCT_VIABLE',classifications:['OVERTURE_TEXAS_SPATIAL_AUTHORITY_CERTIFIED_EXACT','RICH_AUTHORITY_CONSERVATION_OWNER_CERTIFIED','NORMALIZATION_NOT_EXECUTED','LEGAL_REVIEW_REQUIRED'],productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',zeroCostContract:'NON_RUNTIME',mergeRecommendation:'DO_NOT_MERGE_PRODUCT_VIABILITY_CERTIFICATION',nextAction:'Place all 168 tx-*.authority-matched.parquet files plus both certified authority Parquets in owner-local/lp24111, then rerun npm run build:lp24111.'};
 const ownerMeasured=path.join(root,'owner-local/lp24111/normalized-measurements.json');
 const measuredPath=options.measurementsPath??(fs.existsSync(ownerMeasured)?ownerMeasured:path.join(root,'data/lp24111/phase-d-certified-measurements.json'));
 if(fs.existsSync(measuredPath)){
  const localMeasured=JSON.parse(fs.readFileSync(measuredPath,'utf8'));
  if(localMeasured.schemaVersion!=='gridly.lp24111.measured-normalization.v1'||localMeasured.releaseId!==release||!localMeasured.reports) throw Error('Invalid owner-local normalized measurements');
  for(const [name,value] of Object.entries(localMeasured.reports)){
   if(!(name in files)) throw Error(`Unknown measured report ${name}`);
   files[name]={...files[name],...value};
  }
  const normalization=files['normalization-summary.json'];
  if(normalization.executionState==='OWNER_LOCAL_MEASURED'&&normalization.reason===unavailableReason)delete normalization.reason;
 }
 const ownerD2=path.join(root,'owner-local/lp24111/phase-d2-certified-measurements.json');
 const d2Path=options.d2MeasurementsPath??(fs.existsSync(ownerD2)?ownerD2:path.join(root,'data/lp24111/phase-d2-certified-measurements.json'));
 if(fs.existsSync(d2Path)){
  const d2=JSON.parse(fs.readFileSync(d2Path,'utf8'));
  if(d2.schemaVersion!=='gridly.lp24111.measured-taxonomy-package.v1'||!d2.reports)throw Error('Invalid owner-local D.2 measurements');
  for(const [name,value] of Object.entries(d2.reports)){if(!(name in files))throw Error(`Unknown D.2 measured report ${name}`);files[name]={...files[name],...value};delete files[name].reason;}
 }
 const ownerD3=path.join(root,'owner-local/lp24111/phase-d3-identity-measurements.json');
 const d3Path=options.d3MeasurementsPath??(fs.existsSync(ownerD3)?ownerD3:path.join(root,'data/lp24111/phase-d3-identity-measurements.json'));
 if(fs.existsSync(d3Path)){
  const d3=JSON.parse(fs.readFileSync(d3Path,'utf8'));
  if(d3.schemaVersion!=='gridly.lp24111.measured-identity.v1'||d3.releaseId!==release||!d3.reports)throw Error('Invalid owner-local D.3 identity measurements');
 for(const [name,value] of Object.entries(d3.reports)){if(!(name in files))throw Error(`Unknown D.3 measured report ${name}`);files[name]={...files[name],...value};delete files[name].reason;}
  const gate=certificationGate(files);
  files['certification.json']={...files['certification.json'],evidenceCompletenessGate:gate.gates,executiveResult:gate.passed?'PHASE_D3_MEASURED_POI_IDENTITY_CERTIFIED':'PHASE_D3_MEASURED_IDENTITY_COUNTS_EVIDENCE_RECONCILIATION_PENDING',productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',mergeRecommendation:gate.passed?'IDENTITY_EVIDENCE_COMPLETE_MERGE_ELIGIBLE':'DO_NOT_CERTIFY_IDENTITY_EVIDENCE_RECONCILIATION_REQUIRED'};
 } else {
  files['certification.json']={...files['certification.json'],schemaVersion:'gridly.lp24111.certification.v5',executiveResult:'PHASE_D3_IDENTITY_GOVERNANCE_READY_MEASUREMENT_PENDING',classifications:[...files['certification.json'].classifications,'D3_IDENTITY_POLICY_AND_BOUNDED_EXECUTION_READY','D3_OWNER_LOCAL_MEASUREMENT_NOT_EXECUTED'],mergeRecommendation:'MERGE_D3_GOVERNANCE_TOOLING_MEASURE_BEFORE_IDENTITY_CERTIFICATION',nextAction:'Restore the certified normalized Parquet in owner-local/lp24111 and run npm run execute:lp24111-identity; then run build, verify, and test.'};
 }
 const d4Defaults=pendingReports({counties,places,cohort});
 for(const [name,value] of Object.entries(d4Defaults))files[name]=value;
 const d4Path=options.d4MeasurementsPath??path.join(root,'owner-local/lp24111/phase-d4-certified-measurements.json');
 if(fs.existsSync(d4Path)){
  const d4=JSON.parse(fs.readFileSync(d4Path,'utf8'));
  if(d4.schemaVersion!=='gridly.lp24111.measured-coverage.v1'||!d4.reports)throw Error('Invalid owner-local D.4 measurements');
  for(const [name,value] of Object.entries(d4.reports)){if(!(name in d4Defaults))throw Error(`Unknown D.4 measured report ${name}`);files[name]=value;}
  const gate=validateEnvelope(d4);
  files['certification.json']={...files['certification.json'],evidenceCompletenessGate:gate.gates,executiveResult:gate.passed?'PHASE_D4_MEASURED_STATEWIDE_COVERAGE_AND_QUALITY_CERTIFIED':'PHASE_D4_MEASUREMENT_INCOMPLETE'};
 }
 return files;
}

export function verify(options={}){
 const a=artifacts(options);
 if(a['overture-release.json'].releaseId!==release || uri.includes('latest')) throw Error('release pin failed');
 if(a['texas-extraction-summary.json'].spatialAuthority.rows!==1462815) throw Error('owner authority count failed');
 if(a['county-assignment-certification.json'].uniqueIds!==1462815 || a['county-assignment-certification.json'].uniqueCountyAssignments!==1462815 || a['county-assignment-certification.json'].unassigned!==0 || a['county-assignment-certification.json'].boundaryMulti!==0 || !a['county-assignment-certification.json'].zeroCountLoss) throw Error('exact assignment conservation failed');
 if(a['county-coverage.json'].accountedCountyCount!==254 || a['county-coverage.json'].withoutPois!==0) throw Error('county evidence failed');
 const r=a['rich-authority-conservation.json'];
 if(r.inputShardRows!==1462893 || r.uniqueIds!==1462815 || r.crossShardDuplicateIds!==52 || r.extraDuplicateRows!==78 || r.maximumShardOccurrencesPerId!==4 || r.missingAuthorityIds!==0 || r.outsideAuthorityIds!==0) throw Error('rich conservation evidence failed');
 if(a['community-coverage.json'].canonicalPlaceAccounted!==1859) throw Error('PLACE inventory failed');
 if(a['governed-non-place-coverage.json'].governedInventory.total!==29) throw Error('non-PLACE governance failed');
 if(!a['category-coverage.json'].mapping.nonDestinationExclusions.includes('mountain') || !a['category-coverage.json'].mapping.humanMedicalExclusions.includes('animal_hospital')) throw Error('category exclusions failed');
 if(!a['confidence-analysis.json'].policy.startsWith('NO_CUTOFF_RECOMMENDED')) throw Error('confidence policy failed');
 if(a['certification.json'].productionPoiSearch!=='NOT_LAUNCHED_NOT_CERTIFIED') throw Error('runtime boundary failed');
 if(a['poi-identity-summary.json'].rawEligibleCount!==393038||a['poi-identity-summary.json'].sourceRecordsDeleted!==0)throw Error('D.3 baseline/source conservation failed');
 if(a['community-radius-coverage.json'].canonicalPlaceCount!==1859||a['governed-non-place-coverage.json'].expectedCount!==29)throw Error('D.4 governed inventory failed');
 if(a['certification.json'].productionPoiSearch!=='NOT_LAUNCHED_NOT_CERTIFIED'||a['osm-supplement-evaluation.json'].merged!==false)throw Error('D.4 non-runtime/no-merge boundary failed');
 return a;
}
const args=new Set(process.argv.slice(2)); const a=verify();
if(args.has('--write')){fs.mkdirSync(out,{recursive:true}); for(const [f,v] of Object.entries(a)) fs.writeFileSync(path.join(out,f),stable(v)); console.log(`wrote ${Object.keys(a).length} LP241.11 artifacts`);}
else if(args.has('--verify')){for(const [f,v] of Object.entries(a)){const p=path.join(out,f); if(!fs.existsSync(p)||fs.readFileSync(p,'utf8')!==stable(v)) throw Error(`stale/missing ${f}`);} console.log(`verified ${Object.keys(a).length} LP241.11 artifacts`);}
else console.log('use --write or --verify');
