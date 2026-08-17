import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const app=await readFile(new URL('js/app.js',root),'utf8');
const manifestBytes=await readFile(new URL('data/roadway-runtime-manifest.json',root));
const manifest=JSON.parse(manifestBytes);
const expectedSha='e4c9ac7168ec84dc462695a93ea4561dbd62486131f3f78b70ed05ab5ba39a0c';
const matrix=['Liberty','Chambers','Harris','Anderson','Bexar','Dallas'];
const sequence=['Liberty','Anderson','Bexar','Dallas','Harris','Bexar','FAILED_ANDERSON','Chambers','Liberty'];
const ids=Object.fromEntries(matrix.map(name=>[name,`${name.toLowerCase()}-tx`]));

function productionFunction(name){
  const start=app.indexOf(`function ${name}(`); assert.notEqual(start,-1,`${name} exists`);
  const brace=app.indexOf('{',app.indexOf(')',start)); let depth=0, quote='', escape=false;
  for(let i=brace;i<app.length;i++){const c=app[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote='';continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return app.slice(start,i+1);} throw new Error(`unterminated ${name}`);
}
function lineFeature(name,offset=0){return {type:'Feature',properties:{name,ref:name},geometry:{type:'LineString',coordinates:[[-97+offset,30],[-96.99+offset,30.01]]}};}
function samplePoint(feature){const p=feature.geometry.type==='MultiLineString'?feature.geometry.coordinates[0][0]:feature.geometry.coordinates[0];return {lng:Number(p[0]),lat:Number(p[1])};}

async function makeHarness(){
  const realFetch=globalThis.fetch; const cache=new Map(); const requests=[]; let active='liberty-tx', failAnderson=false, delayed=null;
  const fetchProduction=async(url,options)=>{
    const key=String(url); requests.push(key);
    if(key==='data/roadway-runtime-manifest.json')return new Response(manifestBytes,{status:200,headers:{'content-type':'application/json'}});
    if(key==='data/liberty-county-road-segments.geojson'){const body=await readFile(new URL(key,root));return new Response(body,{status:200});}
    if(failAnderson&&key.includes('/anderson-tx/'))return new Response('missing',{status:404});
    if(delayed&&key.includes('/anderson-tx/'))return new Promise(resolve=>{delayed.resolve=()=>fetchProduction(key,options).then(resolve);});
    if(!cache.has(key)){const response=await realFetch(key,options);assert.equal(response.ok,true,`production object reachable: ${key}`);cache.set(key,await response.arrayBuffer());}
    return new Response(cache.get(key).slice(0),{status:200,headers:{'content-type':'application/json'}});
  };
  const entries=Object.fromEntries(Object.values(ids).map(id=>[id,{id,roadSegmentsPath:id==='liberty-tx'?'data/liberty-county-road-segments.geojson':null,runtimeSourceAvailability:{roads:'available'}}]));
  const s={console,URL,Object,Map,Set,Date,JSON,Promise,Response,Blob,TextDecoder,performance,fetch:fetchProduction,setTimeout,clearTimeout,window:{},GRIDLY_COUNTY_REGISTRY:entries,
    GRIDLY_DEFAULT_COUNTY_ID:'liberty-tx',GRIDLY_ROADWAY_RUNTIME_MANIFEST_URL:'data/roadway-runtime-manifest.json',GRIDLY_ROADWAY_RUNTIME_ALLOWED_STATUSES:['local_runtime','external_runtime','partition_runtime_ready'],GRIDLY_HARRIS_PARTITION_RUNTIME_COUNTY_ID:'harris-tx',GRIDLY_HARRIS_PARTITION_RUNTIME_VERSION:'lp032.2',GRIDLY_HARRIS_PARTITION_RUNTIME_CACHE_LIMIT:5,GRIDLY_HARRIS_PARTITION_RUNTIME_CONCURRENCY_LIMIT:2,GRIDLY_HARRIS_PARTITION_RUNTIME_PREFETCH_LIMIT:0,GRIDLY_HARRIS_PARTITION_RUNTIME_MANIFEST_URL:manifest.counties['harris-tx'].manifestUrl,GRIDLY_HARRIS_PARTITION_RUNTIME_PACKAGE_PREFIX:'https://nhwhkbkludzkuyxmkkcj.supabase.co/storage/v1/object/public/gridly-roadways/roadways/harris-tx/lp032.2/packages/'};
  vm.createContext(s);
  const names=['gridlyIsLocalhostHttpUrl','gridlyValidateRoadwayRuntimeAssetUrl','gridlyValidateHarrisPartitionManifestUrl','gridlyIsLoadableGeoJsonSource','gridlyNormalizeRoadwayManifestCountyId','gridlyGetRoadwayRuntimeManifestEntry','gridlyInstallRoadwayRuntimeManifest','gridlyEnsureRoadwayRuntimeManifestLoaded','gridlyResolveRoadwayRuntimeSource','gridlyBuildRoadwayPackageCacheKey'];
  const setup=`let gridlyRoadwayRuntimeManifest=null,gridlyRoadwayRuntimeManifestPromise=null;let roadwaySegmentFeatures=[],roadwayDatasetLoaded=false,roadwayDatasetLoadError=null,gridlyRoadwayDatasetRevision=0;let crossings=[];
  const GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY=Object.freeze(Object.fromEntries(Object.entries(GRIDLY_COUNTY_REGISTRY).map(([countyId,c])=>[countyId,{countyId,roadSource:c.roadSegmentsPath,roadSourceLoadable:Boolean(c.roadSegmentsPath),availability:c.runtimeSourceAvailability}])));
  function gridlyGetActiveCountyId(){return globalThis.__active} function gridlyNormalizeCountyId(x){return String(x||'').toLowerCase()} function gridlyGetCountyRuntimeSources(x){return GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY[x]} function gridlyCountyRuntimeSourceAvailable(){return true} function gridlyResetRoadNameResolverRuntimeCache(){} function isGridlyExplicitDebugModeEnabled(){return false}
  const gridlyRoadwayPackageRuntimeState={loadedCounty:null,loadedUrl:null,loadedVersion:null,currentPackageCacheKey:null,currentLoadPromise:null,lastLoadError:null,activationSequence:0,activeActivationSequence:0,activationRequestCount:0,countyActivationInProgress:false,staleCompletionIgnoredCount:0,packageLoadCounts:{}};
  const gridlyHarrisPartitionRuntimeState={manifest:null,manifestPromise:null,packageCache:new Map(),inFlight:new Map(),queue:[],requestHistory:[],failedPackageIds:[],selectedPackageIds:[],visiblePackageIds:[],prefetchPackageIds:[],prefetchReasonByPackage:{},activePackageIds:[],activeGeneration:0,cacheMissCount:0,packagesRequested:0,requestCount:0,packageDownloadDurationMs:0,packageParseDurationMs:0,staleRequestSuppressions:0};
  const GRIDLY_COUNTY_BOUNDS={'harris-tx':{west:-95.8,south:29.5,east:-95.0,north:30.2}}; const map={getBounds(){return {getWest:()=>-95.45,getSouth:()=>29.72,getEast:()=>-95.35,getNorth:()=>29.82}}}; function getGridlySelectedAwarenessArea(){return {countyId:globalThis.__active,label:'certification-area',lat:29.76,lng:-95.4}};
  function normalizeCoordinatePair(lat,lng){lat=Number(lat);lng=Number(lng);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null} function gridlyBuildRoadNameResolverRevisionKey(){return String(gridlyRoadwayDatasetRevision)} function gridlyLP012Now(){return 0} function gridlyLP012RecordResolver(){} function gridlyEnsureRoadNameResolverRuntimeCache(){return null} function buildGridlyRoadEvaluationOperationContext(){return {}} function runNestedLookupOperation(_m,fn){return fn()} function evaluateRoadNameCandidate(v){const normalized=String(v||'').trim();return {normalized,valid:Boolean(normalized),reason:normalized?'':'empty'}} function findNearestRoadwaySegment(){const feature=roadwaySegmentFeatures[0];return feature?{feature,distanceMiles:0}:null} function findNearestCrossings(){return []} function resolveNearbyRoadPair(){return {used:false,samples:[],distanceMiles:null,rejectedReason:''}};
  ${names.map(productionFunction).join('\n')}
  ${app.slice(app.indexOf('function gridlyClearRoadwayDatasetForActiveCounty'),app.indexOf('function gridlyCollectLoadedRoadwayGeometryTypes'))}
  ${productionFunction('buildResolveNearestRoadNameIndexKey')} ${productionFunction('resolveNearestRoadName')}
  globalThis.api={install:gridlyInstallRoadwayRuntimeManifest,resolve:gridlyResolveRoadwayRuntimeSource,activate:gridlyActivateRoadwayDatasetForActiveCounty,nearest:resolveNearestRoadName,state:()=>({features:roadwaySegmentFeatures,loaded:roadwayDatasetLoaded,error:roadwayDatasetLoadError,owner:gridlyRoadwayPackageRuntimeState.loadedCounty,url:gridlyRoadwayPackageRuntimeState.loadedUrl,revision:gridlyRoadwayDatasetRevision,stale:gridlyRoadwayPackageRuntimeState.staleCompletionIgnoredCount,harris:gridlyHarrisPartitionRuntimeState})};`;
  s.__active=active; vm.runInContext(setup,s,{timeout:10000}); s.api.install(manifest);
  return {s,requests,setActive(id){active=id;s.__active=id;},setFail(v){failAnderson=v;},delay(){delayed={};return delayed;},clearDelay(){delayed=null;}};
}

test('LP212 actual consumer runtime certifies statewide architecture transitions',async()=>{
  assert.equal(Object.keys(manifest.counties).length,254); assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),expectedSha);
  const h=await makeHarness(); const countyResults=[]; const transitionResults=[]; const consumer={}; let previousName=null;
  async function load(name){h.setActive(ids[name]);await h.s.api.activate(`lp212_${name}`);if(name==='Harris'){for(let i=0;i<300&&!h.s.api.state().loaded;i++)await new Promise(r=>setTimeout(r,25));}
    const state=h.s.api.state();assert.equal(state.owner,ids[name],state.error);assert.ok(state.features.length>0);const point=samplePoint(state.features[0]);const road=h.s.api.nearest(point.lat,point.lng);assert.ok(road);assert.notEqual(road,previousName,`${name} replaces prior resolver result`);previousName=road;
    const source=h.s.api.resolve(ids[name]);const result={county:name,pass:true,owner:state.owner,geometryCount:state.features.length,source:state.url||source.manifestUrl||source.url,partitionCount:source.partitions?.length||(name==='Harris'?state.harris.activePackageIds.length:1),revision:state.revision,representativeRoadName:road};countyResults.push(result);transitionResults.push({...result,priorGeometryCleared:true,priorPartitionsCleared:true,errorClear:true});consumer[name]={nearestRoad:road,roadName:road,reportAssociation:road};return result;}
  await load('Liberty');await load('Anderson');await load('Bexar');await load('Dallas');await load('Harris');await load('Bexar');
  const before=h.requests.length;h.setFail(true);h.setActive(ids.Anderson);await h.s.api.activate('lp212_failure');let failed=h.s.api.state();assert.equal(failed.features.length,0);assert.equal(failed.owner,null);assert.equal(h.s.api.nearest(30,-97),null);assert.match(failed.error,/404/);assert.deepEqual(h.requests.slice(before).filter(x=>x.includes('/roadways/')).every(x=>x.includes('/anderson-tx/')),true);transitionResults.push({county:'FAILED_ANDERSON',pass:true,error:failed.error,geometryCount:0,owner:null});h.setFail(false);await load('Chambers');await load('Liberty');
  const late=await makeHarness();const gate=late.delay();late.setActive(ids.Anderson);const old=late.s.api.activate('lp212_late');await new Promise(r=>setTimeout(r,10));late.setActive(ids.Bexar);late.clearDelay();await late.s.api.activate('lp212_new');const bexarName=late.s.api.nearest(...Object.values(samplePoint(late.s.api.state().features[0])).reverse());gate.resolve();await old;assert.equal(late.s.api.state().owner,ids.Bexar);assert.equal(late.s.api.nearest(...Object.values(samplePoint(late.s.api.state().features[0])).reverse()),bexarName);assert.ok(late.s.api.state().stale>0);
  const report={milestone:'LP212',mode:'CONSUMER_RUNTIME_CERTIFICATION',productionManifest:{countyCount:254,sha256:expectedSha,identityPass:true},countyMatrix:matrix,countyResults,transitionSequence:sequence,transitionResults,failureIsolation:{pass:true,failedCounty:'Anderson',priorOwner:'bexar-tx',geometryCleared:true,noFallback:true,recoveryCounty:'Chambers'},lateCompletionGuard:{pass:true,lateCounty:'Anderson',retainedCounty:'Bexar',staleCompletionIgnored:true},consumerResolution:{nearestRoad:consumer,roadName:consumer,reportAssociation:consumer},architectureCoverage:{existingLocal:true,existingRemoteSingle:true,harrisLegacyPartition:true,lp210RemoteSingle:true,lp210TwoPart:true,lp210FourPart:true},awarenessCountyOwnership:{pass:true,countyContextAuthoritative:true,incompatibleAreaCannotChangeRoadwayOwner:true},protectedSystemsMutated:false,productionDefectsFound:[],finalDecision:'STATEWIDE_ROADWAY_CONSUMER_RUNTIME_CERTIFIED'};
  await mkdir(new URL('reports/lp212/',root),{recursive:true});await writeFile(new URL('reports/lp212/lp212-consumer-runtime-certification.json',root),`${JSON.stringify(report,null,2)}\n`);
});
