import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'../..');
const output=path.join(root,'reports/lp24112');
const stable=value=>`${JSON.stringify(value,null,2)}\n`;
export const AUTHORITY_RELEASE_ID='lp24111-d5-standalone-2026-08-28';
export const SCHEMA_VERSION='gridly.poi.runtime.v1';
export const MAX_RADIUS_MILES=25;
export const MAX_SHARD_FANOUT=4;
export const FEATURE_GATE=Object.freeze({provider:'PREVIOUS_RUNTIME',environmentEnabled:false,manifestApproved:false,legalClearance:false,runtimeActivated:false,state:'OFF'});

const texas={minLat:25,maxLat:36,minLon:-107,maxLon:-93};
const shardId=(lat,lon)=>`tx-${String(Math.floor(lat)).padStart(2,'0')}-${String(Math.abs(Math.floor(lon))).padStart(3,'0')}`;
export function resolveShards({latitude,longitude,radiusMiles}){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)throw Error('INVALID_COORDINATES');
 if(![5,10,25].includes(radiusMiles))throw Error('UNBOUNDED_RADIUS');
 const latDelta=radiusMiles/69;
 const lonDelta=radiusMiles/(69*Math.cos(latitude*Math.PI/180));
 const ids=[];
 for(let lat=Math.floor(latitude-latDelta);lat<=Math.floor(latitude+latDelta);lat++)for(let lon=Math.floor(longitude-lonDelta);lon<=Math.floor(longitude+lonDelta);lon++){
  if(lat>=texas.minLat&&lat<texas.maxLat&&lon>=texas.minLon&&lon<texas.maxLon)ids.push(shardId(lat,lon));
 }
 const result=[...new Set(ids)].sort();
 if(result.length>MAX_SHARD_FANOUT)throw Error('SHARD_FANOUT_EXCEEDED');
 return result;
}
export function evaluateGate(config={}){
 const reasons=[];
 if(config.provider!=='GRIDLY_GOVERNED_POI')reasons.push('PROVIDER_NOT_SELECTED');
 if(config.environmentEnabled!==true)reasons.push('ENVIRONMENT_GATE_OFF');
 if(config.manifestApproved!==true)reasons.push('RELEASE_MANIFEST_NOT_APPROVED');
 if(config.legalClearance!==true)reasons.push('LEGAL_CLEARANCE_REQUIRED');
 if(config.authorityReleaseId!==AUTHORITY_RELEASE_ID)reasons.push('AUTHORITY_RELEASE_MISMATCH');
 if(config.schemaVersion!==SCHEMA_VERSION)reasons.push('SCHEMA_VERSION_MISMATCH');
 return {active:reasons.length===0,state:reasons.length?'OFF':'ON',reasons};
}
export function rollback(){return {...FEATURE_GATE,cacheAction:'IGNORE_NAMESPACED_GRIDLY_POI_CACHE',diagnostic:'ROLLBACK_CONFIRMED_PREVIOUS_RUNTIME'};}
export function contracts(){
 const common={milestone:'LP241.12',designOnly:true,runtimeActivated:false,productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED'};
 const files={
  'lp24112-runtime-data-contract.json':{schemaVersion:SCHEMA_VERSION,authorityReleaseId:AUTHORITY_RELEASE_ID,authority:{classification:'IDENTITY_GOVERNED_STANDALONE_POIS_ONLY',rowCount:391772,excluded:['RAW_OVERTURE_AUTHORITY','D2_REVIEW_REQUIRED','CHILD_POI','SUPPRESSED_DUPLICATE_MEMBER','UNRESOLVED_UPSTREAM_AUTHORITY']},record:{required:{id:'non-empty string; unique within release',displayName:'non-empty string',gridlyCategory:'governed enum string',latitude:'finite number [-90,90]',longitude:'finite number [-180,180]',countyContextId:'governed county identifier',communityIdentity:'CANONICAL_PLACE or GOVERNED_NON_PLACE object'},optional:{brand:'non-empty display string',provenanceSummary:'counsel-approved display token'}},validation:'REJECT_RECORD_AND_COUNT_DIAGNOSTIC; REJECT_SHARD_ON_DUPLICATE_ID_OR_MANIFEST_CONSERVATION_FAILURE',fieldsForbidden:['freeformAddress','rawSourceMetadata','conflationEvidence','suppressedMembers'],...common},
  'lp24112-shard-resolution-contract.json':{schemaVersion:'gridly.lp24112.shards.v1',architecture:'ONE_DEGREE',formula:'tx-{floor(latitude),2 digits}-{abs(floor(longitude)),3 digits}',allowedRadiiMiles:[5,10,25],inputs:['CANONICAL_PLACE_ANCHOR','GOVERNED_NON_PLACE_ANCHOR','USER_INITIATED_MAP_CENTER'],algorithm:['validate coordinates and radius','compute radius bounding box using 69 miles per latitude degree and latitude-adjusted longitude','enumerate intersecting Texas one-degree cells','deduplicate','lexically sort','fail closed above fanout'],boundaryHandling:'INCLUDE_EVERY_CELL_INTERSECTED_BY_RADIUS_BOUNDING_BOX; CLIP_TO_TEXAS_ENVELOPE',maximumFanout:MAX_SHARD_FANOUT,wholeTexas:false,...common},
  'lp24112-search-bounds.json':{schemaVersion:'gridly.lp24112.search.v1',defaultRadiusMiles:10,allowedRadiiMiles:[5,10,25],maximumRadiusMiles:25,maximumResultCount:50,categoryFilter:'optional governed exact enum; AND with text',textFilter:'optional trimmed case-folded displayName/brand substring; maximum 80 code points',sorting:['distanceMiles ascending','displayName ascending','id ascending'],distance:'haversine after shard load',invalidCoordinates:'INVALID_REQUEST; NO_SHARD_LOAD',wholeTexasSearch:'PROHIBITED',zeroResult:'explicit reason; not an error',...common},
  'lp24112-identity-context-contract.json':{schemaVersion:'gridly.lp24112.identity.v1',canonicalPlaceCount:1859,governedNonPlaceCount:29,precedence:['governed community identity','structured county context','descriptive source locality'],resultCountyBehavior:'countyContextId describes result location and never replaces the search community identity',tarkington:{identityDisposition:'GOVERNED_NON_PLACE',communityId:'liberty-tx:tarkington',placeGeoid:null},fabricatePlaceIdentity:false,...common},
  'lp24112-metadata-presentation-guardrails.json':{schemaVersion:'gridly.lp24112.metadata.v1',historicalD4Conflicts:149,structuredReconciliation:'149_FALSE_POSITIVES_0_UNEXPLAINED',authority:['structured region metadata','governed spatial community and county identity'],freeformAddressRole:'DESCRIPTIVE_ONLY',stateTokenInferenceCanOverride:false,rewriteOriginalSourceMetadata:false,onConflict:'retain original descriptive value; render governed context; emit bounded diagnostic; never promote freeform text to authority',...common},
  'lp24112-brand-presentation.json':{schemaVersion:'gridly.lp24112.brand.v1',authorityRole:'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY',display:'MAY_DISPLAY_WHEN_NON_EMPTY',absenceSuppressesPoi:false,determines:{identity:false,deduplication:false,category:false,launchEligibility:false},...common},
  'lp24112-zero-result-contract.json':{schemaVersion:'gridly.lp24112.zero.v1',state:'SUCCESS_WITH_ZERO_RESULTS',reasons:['NO_NEARBY_POIS','NO_CATEGORY_MATCH','NO_TEXT_MATCH','EXPECTED_SPARSE_AREA','REGIONAL_DEPENDENCY_UNAVAILABLE'],copy:{NO_NEARBY_POIS:'No nearby places found within this area.',NO_CATEGORY_MATCH:'No places in this category were found nearby.',EXPECTED_SPARSE_AREA:'This area may have limited nearby place data.'},missingOptionalFields:'omit field without suppressing result or producing error',shardFailureIsNotZeroResult:true,...common},
  'lp24112-feature-gate-design.json':{schemaVersion:'gridly.lp24112.gate.v1',default:FEATURE_GATE,activationRequires:['provider=GRIDLY_GOVERNED_POI','environmentEnabled=true','manifestApproved=true','legalClearance=true',`authorityReleaseId=${AUTHORITY_RELEASE_ID}`,`schemaVersion=${SCHEMA_VERSION}`],combination:'ALL_REQUIRED_FAIL_CLOSED',mismatch:'OFF_WITH_DIAGNOSTIC',singleRollback:'provider=PREVIOUS_RUNTIME',...common},
  'lp24112-runtime-diagnostics-contract.json':{schemaVersion:'gridly.lp24112.diagnostics.v1',helper:'gridlyPoiAudit()',bounded:true,maxResultIds:50,fields:['activePoiProvider','authorityReleaseId','schemaVersion','loadedShardIds','loadedRowCount','dedupedResultCount','radiusMiles','communityIdentity','countyContext','resultIds','fallbackReason','zeroResultReason','featureGateState'],redaction:'NO_RAW_SOURCE_METADATA_OR_USER_TEXT',...common},
  'lp24112-cache-delivery-contract.json':{schemaVersion:'gridly.lp24112.cache.v1',cacheKey:'gridly-poi/{authorityReleaseId}/{schemaVersion}/{shardId}.json.gz',strategy:'IMMUTABLE_VERSIONED_ASSETS',ttl:'31536000, immutable',invalidation:'change authorityReleaseId or schemaVersion; old namespace ignored and may be opportunistically deleted',failedShard:'do not cache failure; diagnose shard ID',partialLoad:'FAIL_QUERY_CLOSED_TO_PREVIOUS_PROVIDER; NEVER_LABEL_PARTIAL_DATA_AS_COMPLETE_OR_ZERO',retry:{attempts:2,backoffMilliseconds:[250,1000],sameImmutableUrlOnly:true},paidDependencyAdded:false,...common},
  'lp24112-rollback-contract.json':{schemaVersion:'gridly.lp24112.rollback.v1',trigger:'SET_SINGLE_PROVIDER_GATE_TO_PREVIOUS_RUNTIME',steps:['gate OFF before new queries','cancel/ignore pending Gridly POI responses','restore previous provider behavior','ignore versioned POI cache namespace','emit rollback diagnostic'],dataMigration:false,userStateMutation:false,cacheDeletionRequired:false,confirmation:'activePoiProvider=PREVIOUS_RUNTIME AND runtimeActivated=false',...common},
  'lp24112-legal-ready-integration.json':{schemaVersion:'gridly.lp24112.legal.v1',legalState:'LEGAL_REVIEW_REQUIRED',legalConclusion:false,activationAllowed:false,hooks:[{id:'MAP_ATTRIBUTION',surface:'POI results/map footer'},{id:'SOURCE_DISCLOSURE',surface:'About / Legal'},{id:'LEGAL_LINK',surface:'POI results to About / Legal'},{id:'DATA_VERSION',value:AUTHORITY_RELEASE_ID},{id:'SOURCE_INVENTORY',surface:'counsel-approved immutable source inventory reference'}],approvalArtifactRequired:'COUNSEL_APPROVED_RELEASE_MANIFEST',...common},
  'lp24112-activation-acceptance-plan.json':{schemaVersion:'gridly.lp24112.acceptance.v1',executionState:'PLANNED_NOT_EXECUTED',phoneTesting:false,cohorts:['Dayton','Tarkington','Pecos','Dallas','Austin','San Antonio','Abilene','Midland','Fredericksburg','Port Arthur','Sulphur Springs','Huntsville','Eastland','Cienegas Terrace'].map(name=>({name,requiredRadiiMiles:[5,10,25],assertions:['identity preserved','fanout bounded','governed-only result IDs','distance/order deterministic','zero result explicit when applicable']})),requiredScenarios:['CANONICAL_PLACE','GOVERNED_NON_PLACE','MULTI_COUNTY_COMMUNITY','RURAL_SPARSE','DENSE_METRO','ZERO_RESULT_CATEGORY'],launchPrerequisites:['legal clearance artifact','approved immutable release manifest','all gate mismatch tests','desktop deterministic suite','subsequent separately authorized phone testing'],...common},
  'lp24112-certification.json':{schemaVersion:'gridly.lp24112.certification.v1',phaseState:'PHASE_LP24112_RUNTIME_ACTIVATION_DESIGN_CERTIFIED',productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',runtimeActivated:false,legalState:'LEGAL_REVIEW_REQUIRED',productionBehaviorChanged:false,technicalActivationBlockers:0,deployed:false,providerSwitched:false,productionSupabaseMutation:false,phoneTesting:false,nextOwnerAction:'Obtain external counsel approval of attribution, licensing, source inventory, and the exact authority release manifest; do not enable the gate.',...common}
 };
 return files;
}
export function verify(){
 const c=contracts();
 if(c['lp24112-runtime-data-contract.json'].authority.rowCount!==391772)throw Error('AUTHORITY_DRIFT');
 if(c['lp24112-certification.json'].runtimeActivated||c['lp24112-certification.json'].legalState!=='LEGAL_REVIEW_REQUIRED')throw Error('BOUNDARY_VIOLATION');
 return c;
}
if(path.resolve(process.argv[1]??'')===path.resolve(import.meta.filename)){
 const files=verify(),args=new Set(process.argv.slice(2));
 if(args.has('--write')){fs.mkdirSync(output,{recursive:true});for(const [name,value] of Object.entries(files))fs.writeFileSync(path.join(output,name),stable(value));console.log(`wrote ${Object.keys(files).length} LP241.12 design artifacts`);}
 else if(args.has('--verify')){for(const [name,value] of Object.entries(files)){const file=path.join(output,name);if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==stable(value))throw Error(`stale/missing ${name}`);}console.log(`verified ${Object.keys(files).length} LP241.12 design artifacts`);}
 else console.log('use --write or --verify');
}
