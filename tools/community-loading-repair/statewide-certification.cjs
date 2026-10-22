// Function-level certification using actual production owners and all governed
// county packages. This is deliberately not labelled full browser/device proof.
const fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict'),path=require('node:path');
const BASE='faac47368da3137b50d53813b7f0299a2f4b1830';
const json=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function source(text,name){const match=text.match(new RegExp(`(?:async )?function ${name}\\([^]*?^\\}`,'m'));assert.ok(match,name);return match[0];}
function declaration(text,name){const match=text.match(new RegExp(`const ${name} = [^]*?;\\r?\\n`));assert.ok(match,name);return match[0];}
const plain=value=>JSON.parse(JSON.stringify(value));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const production=cp.execFileSync('git',['show',BASE+':js/app.js'],{encoding:'utf8',maxBuffer:20*1024*1024});
const candidate=fs.readFileSync('js/app.js','utf8');
const governed=json('Crossing-Packages/production-crossing-manifest.json');
const projection=json('data/generated/gridly-statewide-consumer-community-projection-v1.json').communities;
const presentations=json('data/generated/gridly-statewide-place-presentation-v1.json').places;
const identities=json('data/lp149/runtime-county-registry.json').identities;
const functions=['normalizeGridlyAwarenessAreaLookupText','gridlyNormalizeCountyId','gridlyIsKnownCountyId','gridlyIsCountyOperational','gridlyNormalizeCountyAssetOwnerToken','gridlyParseCoordinateNumber','gridlyCoordinatePairInTexas','extractGridlyCrossingCoordinates','normalizeGridlyReviewedCrossingId','getGridlyReviewedCrossingLocationContext','inferCrossingCity','buildRegionKey','toRegionSlug','calculateBaseRisk','gridlyNormalizeCrossingEligibilityId','gridlyGetCrossingReportEligibility','normalizeGridlyCrossingFeatures','shouldShowCrossingInLaunchMode','isGridlyReportableCrossing','isGridlyPublicRoadwayCrossing','gridlyCrossingSampleMatchesCounty','gridlyGetConsumerCrossingFraId','gridlyCrossingSatisfiesConsumerVisibilityPolicy','gridlyCrossingOwnedByAwarenessArea','gridlyParseOptionalGeographicCoordinate','gridlyProjectAwarenessAreaForGeographicConsumer','gridlySelectConsumerVisibleCrossings','getGridlyAwarenessIntelligenceCrossing','getGridlyIncidentCoordinate','getGridlyAwarenessIntelligenceRecordCoordinate','gridlyRecordTextMatchesAwarenessArea','gridlyGetGovernedAwarenessGeometry','isGridlyRecordInAwarenessArea','gridlyExtractStructuredMetadata','gridlyGetReportCountyId','getDistanceMiles','haversineDistance','toRad','gridlyResolveCanonicalPlaceRegistryIdentity','gridlyResolveCanonicalPlaceGeoid','gridlyGetActiveCountyCrossingInventory'];
async function registry(text){const{countyRegistryRange}=await import('../../scripts/lp189-statewide-runtime-activation-guarded.mjs');const b={Object};vm.createContext(b);vm.runInContext(text.slice(0,countyRegistryRange(text).end)+';this.registry=GRIDLY_COUNTY_REGISTRY',b);return plain(b.registry);}
function boxFor(text,registry,county){
 const b={console:{warn(){},error(){}},GRIDLY_COUNTY_REGISTRY:registry,GRIDLY_DEFAULT_COUNTY_ID:'liberty-tx',county,crossings:[],gridlyCrossingInventoryRevision:1,gridlyActiveCountyTransitionGeneration:1,gridlyCrossingInventoryCountyId:county,gridlyCrossingWatchedFilterRejectBreakdown:{},DEFAULT_NEARBY_RADIUS_MILES:8};b.window=b;
 b.gridlyGetActiveCountyId=()=>b.county;b.gridlyGetCountyRuntimeSources=countyId=>({countyId});
 b.resolveGridlyCanonicalPlacePresentationFocus=area=>{const p=presentations[area.placeGeoid];return p?{lat:p.lat,lng:p.lon,radiusMiles:8,authority:'actual governed PLACE presentation fixture'}:null;};
 // Known county fields short-circuit the coordinate fallback; the tests below
 // assert county ownership explicitly and do not claim boundary-edge execution.
 b.gridlyResolveCountyIdForCoordinate=()=>null;
 vm.createContext(b);
 for(const name of ['LOCATION_DEFAULTS','LIBERTY_COUNTY_CITY_RULES','GRIDLY_REVIEWED_CROSSING_LOCATION_CONTEXT','GRIDLY_REVIEWED_CROSSING_LOCATION_ALIASES','OTHER_HAZARD_STRUCTURED_METADATA_PREFIX'])vm.runInContext(declaration(text,name),b);
 for(const name of functions)vm.runInContext(source(text,name),b);
 return b;
}
function hydrationBox(b,adapted){
 const trace=[],writes=[];let fetches=0,held=null,fail=false;
 Object.assign(b,{crossings:[],crossingReviewOverrides:{},crossingLoadFailed:false,gridlyCrossingInventoryCountyId:null,gridlyCrossingInventoryRevision:0,crossingRenderCrossingsVersion:0,gridlyActiveCountyStaleRequestSuppressions:0,gridlyCrossingInventoryHydrationState:{},gridlyCrossingInventoryFallbackAuditState:{},gridlyCrossingFallbackAuditState:{},gridlyCrossingInventoryReloadPromise:null,crossingMarkers:new Map(),crossingLayer:null});
 Object.assign(b,{gridlyRecordCrossingHydrationTrace:event=>trace.push(event),safeText:(...args)=>writes.push(args),loadCrossingReviewOverrides:async()=>({}),fetchFraCrossingsWithRetry:async()=>{fetches++;if(held)await held.promise;if(fail)throw new Error('controlled transport failure');return{gridlyCrossingSource:'crossing_provider_production',json:async()=>adapted};},recordGridlyCrossingFallbackAudit(){},buildGridlyCrossingCoordinateDiagnostics:()=>({diagnosticNormalizedCount:adapted.features.length}),gridlyResetRoadNameResolverRuntimeCache(){},populateCrossingSelect(){},applyGridlyHomeTownAwarenessContext(){},scheduleRenderCrossings(){},syncGridlyAwarenessAreaSurfacesImmediately(){},evaluateLayoutMode:()=> 'portrait',updateDailyHabitStatus(){},updateLastUpdated(){},renderUnifiedIncidents(){},getGridlySelectedAwarenessArea:()=>({countyId:b.county,countyWide:true})});
 for(const name of ['loadCrossings','gridlyHydrateCrossings','ensureGridlyActiveCountyCrossingInventory'])vm.runInContext(source(candidate,name),b);
 return{trace,writes,get fetches(){return fetches;},hold(){held=deferred();return held;},release(){held=null;},fail(value){fail=value;}};
}
async function testHydration(b,adapted){
 const h=hydrationBox(b,adapted),first=b.loadCrossings();assert.equal(b.loadCrossings(),first);assert.equal(b.ensureGridlyActiveCountyCrossingInventory('statewide-concurrent-ensure'),true);
 await first;await b.gridlyCrossingInventoryReloadPromise;
 assert.equal(h.fetches,1);assert.equal(b.crossingLoadFailed,false);assert.equal(b.gridlyCrossingInventoryHydrationState.completed,true);assert.equal(h.trace.filter(x=>x==='INVENTORY_COMMIT').length,1);assert.equal(b.ensureGridlyActiveCountyCrossingInventory('already-loaded'),false);
 const ids=b.crossings.map(row=>row.id),revision=b.gridlyCrossingInventoryRevision;
 const held=h.hold(),late=b.loadCrossings();await Promise.resolve();await Promise.resolve();b.gridlyActiveCountyTransitionGeneration+=2;held.resolve();h.release();await late;
 assert.equal(b.gridlyCrossingInventoryRevision,revision);assert.deepEqual(b.crossings.map(row=>row.id),ids);assert.ok(h.trace.includes('COMMIT_GUARD_REJECT'));
 h.fail(true);await b.loadCrossings();assert.equal(b.crossingLoadFailed,true);assert.equal(b.loadCrossings.inFlight,null);h.fail(false);await b.loadCrossings();assert.equal(b.crossingLoadFailed,false);assert.equal(b.gridlyCrossingInventoryHydrationState.completed,true);
 return{deduplicated:true,oneCommit:true,emptyIsLoaded:adapted.features.length===0,staleGenerationRejected:true,retryAfterFailure:true};
}
function testSummary(b,point){
 Object.assign(b,{activeReports:[{id:'community-report',countyId:b.county,status:'active'}],activeHazards:[{id:'community-hazard',countyId:b.county,status:'active'}],area:point,context:{countyId:b.county,placeId:point?.placeGeoid,generation:1,health:'FRESH'},gridlyRoadwayDatasetRevision:1,crossingRenderCrossingsVersion:1,coverage:'fresh',communityRevision:'active',drive:[{id:'nearby',countyId:b.county},{id:'distant-countywide',countyId:b.county,lat:point?.lat+0.5,lng:point?.lng+0.5}],weather:[{id:'countywide-warning',countyId:b.county,expirationTime:'2099-01-01'}]});
 b.getGridlySelectedAwarenessArea=()=>b.area;b.gridlyGetCurrentAwarenessContext=()=>b.context;b.gridlyGetCanonicalActiveCommunityState=()=>({revision:b.communityRevision});b.gridlySourceCoverageRevision=()=>b.coverage;b.gridlyDriveTexasConnector={getAllNormalizedRecords:()=>b.drive};b.gridlyWeatherConnector={getNormalizedRecords:()=>b.weather};
 for(const name of ['gridlyAwarenessSummaryInputRevision','getGridlyAwarenessSummaryAreaIdentity','getGridlyCurrentSelectedAwarenessAreaIdentity','isGridlyCachedAwarenessSummaryForCurrentArea'])vm.runInContext(source(candidate,name),b);
 b.drive.push(...Array.from({length:256},(_,index)=>({id:'outside-legacy-prefix-'+index,status:'active',countyId:b.county})));
 const initial=b.gridlyAwarenessSummaryInputRevision();for(const id of ['nearby','distant-countywide','countywide-warning','outside-legacy-prefix-255'])assert.ok(initial.includes(id),'complete source evidence included in revision: '+id);
 const mutations=[()=>{b.activeReports[0].status='cleared';},()=>{b.activeHazards=[];},()=>{b.communityRevision='expired';},()=>{b.coverage='stale';},()=>{b.area={...point,key:'another-area'};},()=>{b.county='liberty-tx'===b.county?'harris-tx':'liberty-tx';},()=>{b.gridlyActiveCountyTransitionGeneration++;},()=>{b.context.health='STALE';},()=>{b.drive.push({id:'independent-official-source'});},()=>{b.weather=[];},()=>{b.gridlyCrossingInventoryRevision++;},()=>{b.gridlyRoadwayDatasetRevision++;},()=>{b.drive[257].status='cleared';}];
 for(const mutate of mutations){const prior={awarenessInputRevision:b.gridlyAwarenessSummaryInputRevision()};assert.ok(prior.awarenessInputRevision);assert.equal(b.isGridlyCachedAwarenessSummaryForCurrentArea(prior),true);mutate();assert.equal(b.isGridlyCachedAwarenessSummaryForCurrentArea(prior),false);}
 return{invalidationCases:mutations.length,fullSourceIdsInitiallyIncluded:true};
}
function testIndexInvalidation(b){
 const inventory=b.crossings,county=b.county,normalize=b.normalizeGridlyAwarenessAreaLookupText;
 const probes=[()=>{b.crossings=inventory.slice();},()=>{b.gridlyCrossingInventoryRevision++;},()=>{b.county=county==='liberty-tx'?'harris-tx':'liberty-tx';},()=>{b.gridlyActiveCountyTransitionGeneration++;},()=>{b.normalizeGridlyAwarenessAreaLookupText=value=>normalize(value);}];
 for(const mutate of probes){b.getGridlyAwarenessIntelligenceCrossing({name:'index-invalidation-probe'});const old=b.getGridlyAwarenessIntelligenceCrossing.index;mutate();b.getGridlyAwarenessIntelligenceCrossing({name:'index-invalidation-probe'});assert.notEqual(b.getGridlyAwarenessIntelligenceCrossing.index,old);b.crossings=inventory;b.county=county;b.normalizeGridlyAwarenessAreaLookupText=normalize;}
 return{inventoryReference:true,revision:true,county:true,generation:true,normalizer:true};
}
async function main(){
 const oldRegistry=await registry(production),nextRegistry=await registry(candidate);assert.deepEqual(nextRegistry,oldRegistry);assert.equal(Object.keys(nextRegistry).length,254);assert.equal(governed.records.length,254);
 const gitTree=new Map(cp.execFileSync('git',['ls-tree','-r',BASE,'--','Crossing-Packages'],{encoding:'utf8',maxBuffer:4*1024*1024}).trim().split('\n').map(line=>{const[m,p]=line.split('\t');return[p,m.split(' ')[2]];}));
 const sourceBox={console};sourceBox.window=sourceBox;sourceBox.fetch=async file=>({ok:fs.existsSync(file),json:async()=>json(file)});vm.createContext(sourceBox);
 for(const file of ['js/gridlyRuntimeSourceRegistryBridge.js','js/gridlyCrossingPackageAdapter.js'])vm.runInContext(fs.readFileSync(file,'utf8'),sourceBox);
 const rows=[];let queries=0,memberships=0;
 for(const identity of identities){
  const county=identity.countyId,config=nextRegistry[county];assert.ok(config?.operational,county);assert.equal(config.id,county);if(config.countyFips)assert.equal(config.countyFips,identity.fips,county);
  assert.equal(config.name.toLowerCase().replace(/[^a-z0-9]/g,''),identity.countyName.toLowerCase().replace(/[^a-z0-9]/g,''),county+'/governed county name');
  const authority=await sourceBox.gridlyRuntimeSourceRegistryBridge.resolveGovernedCrossingSource({county:identity.countyName,countyFips:identity.fips});
  const bytes=fs.readFileSync(authority.packageFile),lf=Buffer.from(bytes.toString().replace(/\r\n/g,'\n'));
  const blobOf=body=>crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');const actualBlob=blobOf(bytes),blob=blobOf(lf),expectedBlob=gitTree.get(authority.packageFile);assert.ok(actualBlob===expectedBlob||blob===expectedBlob,authority.packageFile+'/exact Git or LF checkout identity');
  const raw=JSON.parse(bytes.toString().replace(/^\uFEFF/,''));assert.equal(raw.features.length,authority.governedCount);assert.equal(authority.state,raw.features.length?'ACTIVE_POSITIVE':'ACTIVE_EMPTY');
  const adapted=await sourceBox.gridlyCrossingPackageAdapter.buildAdaptedCrossingGeojson(authority.packageFile,raw);
  const old=boxFor(production,oldRegistry,county),next=boxFor(candidate,nextRegistry,county),opts={countyId:county,source:'crossing_provider_production',overrides:{}};
  old.crossings=old.normalizeGridlyCrossingFeatures(adapted.features,opts);next.crossings=next.normalizeGridlyCrossingFeatures(adapted.features,opts);
  assert.deepEqual(plain(next.crossings),plain(old.crossings));
  for(let i=0;i<next.crossings.length;i++){
   const a=next.crossings[i],b=old.crossings[i];
   for(const query of [{crossingId:a.id},{crossing_id:a.id},{crossing_id_text:a.id},{name:a.name},{crossingId:'missing',crossingName:a.name},{id:a.id,name:a.name}]){assert.equal(next.crossings.indexOf(next.getGridlyAwarenessIntelligenceCrossing(query)),old.crossings.indexOf(old.getGridlyAwarenessIntelligenceCrossing(query)),county+'/'+a.id);queries++;}
   assert.deepEqual(plain(next.gridlyGetCrossingReportEligibility(a)),plain(old.gridlyGetCrossingReportEligibility(b)));
  }
  const countyArea={countyId:county,countyWide:true};assert.deepEqual(plain(next.gridlySelectConsumerVisibleCrossings(countyArea).map(row=>row.id)),plain(old.gridlySelectConsumerVisibleCrossings(countyArea).map(row=>row.id)));
  const places=projection.filter(place=>place.countyMemberships.includes(identity.fips));
  for(const place of places){const area={...place,placeGeoid:place.placeGeoid,countyId:county,key:'place-'+place.placeGeoid,label:place.displayName,lat:presentations[place.placeGeoid]?.lat,lng:presentations[place.placeGeoid]?.lon};assert.equal(next.gridlyResolveCanonicalPlaceGeoid({label:place.displayName,countyId:county}),place.placeGeoid);assert.deepEqual(plain(next.gridlySelectConsumerVisibleCrossings(area).map(row=>row.id)),plain(old.gridlySelectConsumerVisibleCrossings(area).map(row=>row.id)),county+'/'+place.displayName);memberships++;}
  const selected=places[0],point=selected?{...selected,countyId:county,key:'place-'+selected.placeGeoid,lat:presentations[selected.placeGeoid].lat,lng:presentations[selected.placeGeoid].lon}:{countyId:county,key:county,countyWide:true};
  const indexInvalidation=testIndexInvalidation(next),hydration=await testHydration(next,adapted),summary=testSummary(next,point);
  rows.push({county,fips:identity.fips,fipsAuthority:config.countyFips?'runtime registry agrees with LP149':'legacy inline FIPS absent; exact county identity joins governed LP149 authority',source:authority.packageFile,sourceSha256:hash(bytes),canonicalGitBlob:expectedBlob,materialization:actualBlob===expectedBlob?'EXACT_GIT_BLOB':'CANONICAL_LF_MATCH',state:authority.state,crossings:raw.features.length,normalized:old.crossings.length,publicEligible:old.crossings.filter(row=>old.isGridlyPublicRoadwayCrossing(row)&&old.isGridlyReportableCrossing(row)).length,countyConsumerIds:old.gridlySelectConsumerVisibleCrossings(countyArea).map(row=>row.id),placeMemberships:places.length,lookupParity:true,orderedSelectionParity:true,indexInvalidation,hydration,summary});
 }
 const output={date:new Date().toISOString(),baseline:BASE,sourceHashes:{baseline:hash(production),candidate:hash(candidate)},coverage:{auditedCounties:rows.length,functionLevelCounties:rows.length,positive:rows.filter(row=>row.crossings>0).length,empty:rows.filter(row=>!row.crossings).length,sourceCrossings:rows.reduce((sum,row)=>sum+row.crossings,0),canonicalPlaces:projection.length,countyPlaceMemberships:memberships,lookupQueries:queries,missingCountyFixtures:[],fullBrowserCounties:'reported separately by replay matrix',nativeDeviceCounties:0,liveProviderCounties:0},rows,allAssertionsPassed:true,limitations:['Actual shared functions with real adapted packages; external UI/publication callbacks replaced with isolated no-op boundaries','PLACE focus comes from governed presentation fixtures and the existing default 8-mile policy; exact boundary-edge and full app behavior require other suites/browser evidence','NWS/DriveTexas transport lifecycle is separately certified; these crossing rows alone are not provider proof','No full browser or native certification is implied for counties without corresponding replay evidence']};
 const dir=path.resolve(process.env.STATEWIDE_OUTPUT_DIR||'.artifacts/community-loading-statewide');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'county-correctness.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output.coverage,null,2));return output;
}
module.exports={main,source,boxFor,registry};if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
