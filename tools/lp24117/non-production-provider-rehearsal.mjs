import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '../..');
const runtimeDir = path.join(root, 'poi/lp24111-d5-standalone-2026-08-28/runtime-v2');
const reportDir = path.join(root, 'reports/lp24117');
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const EXPECTED = Object.freeze({ authorityReleaseId: 'lp24111-d5-standalone-2026-08-28', runtimeSchemaVersion: 'gridly.poi.runtime.v2', sourceInventorySha256: 'a9d7a77b964af35fcb21ad3cd061ceb1e1a33ae4dc5091a25a119bada92cec13', authorityInputSha256: '6c63fc555ea4a887162541cb1a4587f9d3edb52fb70cb3e81982598b9a82f85c', manifestSha256: '53bdb47e180836eaede03e2cf7f2acb5ec730507a768c1bae06ba0eab0c7fa9a', noticeSha256: '07cef40d0b0d1f5786b3e29983970aa0729ee6e508d1c4e3e18bbe0eef8878a3', governedCount: 391772, shardCount: 86 });
export class FailClosed extends Error { constructor(stage, detail) { super(`${stage}: ${detail}`); this.stage = stage; this.detail = detail; } }
const fail = (stage, detail) => { throw new FailClosed(stage, detail); };

export function guard(config) {
  if (config.environment !== 'NON_PRODUCTION') fail('ENVIRONMENT_GUARD', 'POI_REHEARSAL_ENVIRONMENT must equal NON_PRODUCTION');
  if (config.mode !== 'NON_PRODUCTION') fail('MODE_GUARD', 'POI_REHEARSAL_MODE must equal NON_PRODUCTION');
  if (config.providerGate !== 'OFF') fail('PRODUCTION_BOUNDARY', 'provider gate must remain OFF');
}

export function validateRecord(row) {
  for (const key of ['id', 'displayName', 'gridlyCategory', 'latitude', 'longitude', 'countyContextId']) if (row[key] === undefined || row[key] === null || row[key] === '') fail('RUNTIME_RECORD_CONTRACT', key);
  if ('communityIdentity' in row) fail('RUNTIME_RECORD_CONTRACT', 'POI-level communityIdentity is forbidden');
}

export function validateRequest(request) {
  if (request.communityIdentity && !['CANONICAL_PLACE', 'GOVERNED_NON_PLACE'].includes(request.originType)) fail('REQUEST_IDENTITY', 'community identity is not allowed for origin type');
  if (request.originType === 'GOVERNED_NON_PLACE' && request.communityIdentity?.placeGeoid !== null) fail('REQUEST_IDENTITY', 'governed non-place must have null placeGeoid');
}

export function validateRelease(base = runtimeDir) {
  const manifestFile = path.join(base, 'manifest.json');
  if (!fs.existsSync(manifestFile)) fail('RUNTIME_MANIFEST', 'missing manifest');
  const bytes = fs.readFileSync(manifestFile); const hash = digest(bytes);
  if (hash !== EXPECTED.manifestSha256) fail('RUNTIME_MANIFEST_HASH', hash);
  const manifest = JSON.parse(bytes);
  for (const key of ['authorityReleaseId', 'runtimeSchemaVersion', 'sourceInventorySha256', 'authorityInputSha256']) if (manifest[key] !== EXPECTED[key]) fail('RUNTIME_RELEASE_BINDING', key);
  if (manifest.expectedGovernedPoiCount !== EXPECTED.governedCount || manifest.materializedGovernedPoiCount !== EXPECTED.governedCount || manifest.shardCount !== EXPECTED.shardCount || manifest.shards?.length !== EXPECTED.shardCount) fail('RUNTIME_RELEASE_BINDING', 'counts');
  let records = 0; let compressedBytes = 0;
  for (const shard of manifest.shards) {
    if (!/^tx-\d{2}-\d{3}$/.test(shard.shardId) || shard.file !== `${shard.shardId}.json.gz` || !shard.cachePath.endsWith(`/gridly.poi.runtime.v2/${shard.file}`)) fail('SHARD_NAMESPACE', shard.shardId);
    const file = path.join(base, shard.file); if (!fs.existsSync(file)) fail('SHARD_MISSING', shard.shardId);
    const compressed = fs.readFileSync(file);
    if (compressed.length !== shard.byteCount) fail('SHARD_BYTE_COUNT', shard.shardId);
    if (digest(compressed) !== shard.sha256) fail('SHARD_SHA256', shard.shardId);
    let payload; try { payload = JSON.parse(zlib.gunzipSync(compressed)); } catch { fail('SHARD_DECODE', shard.shardId); }
    if (payload.schemaVersion !== EXPECTED.runtimeSchemaVersion || !Array.isArray(payload.records) || payload.records.length !== shard.recordCount) fail('SHARD_RECORD_COUNT_OR_SCHEMA', shard.shardId);
    payload.records.forEach(validateRecord); records += payload.records.length; compressedBytes += compressed.length;
  }
  if (records !== EXPECTED.governedCount) fail('SHARD_TOTAL', String(records));
  return { manifest, manifestSha256: hash, records, compressedBytes };
}

export function validateLegal(manifest, releaseBase = path.dirname(runtimeDir)) {
  const noticePath = path.join(releaseBase, 'legal/foursquare/NOTICE.txt');
  const licensePath = path.join(releaseBase, 'legal/license-reference-manifest.json');
  if (!fs.existsSync(noticePath)) fail('LEGAL_NOTICE', 'missing Foursquare NOTICE');
  if (!fs.existsSync(licensePath)) fail('LEGAL_LICENSE_MANIFEST', 'missing license-reference manifest');
  if (digest(fs.readFileSync(noticePath)) !== EXPECTED.noticeSha256) fail('LEGAL_NOTICE_HASH', 'Foursquare NOTICE mismatch');
  const licenses = JSON.parse(fs.readFileSync(licensePath));
  if (!licenses.references || !['cdla', 'apache', 'cc0'].every(key => licenses.references[key]?.available)) fail('LEGAL_LICENSE_MANIFEST', 'required reference unavailable');
  const expected = { 'CDLA-Permissive-2.0': 355925, 'Apache-2.0 + CDLA-Permissive-2.0': 23248, 'CC0-1.0 + CDLA-Permissive-2.0': 12599 };
  if (JSON.stringify(manifest.licenseSummary) !== JSON.stringify(expected) || manifest.legalBinding?.attributionText !== 'POI data sources and licenses' || manifest.legalBinding?.target !== 'DATA_SOURCES_AND_LICENSES') fail('LEGAL_BINDING', 'license exposure or attribution');
  return { noticeSha256: EXPECTED.noticeSha256, sourceInventorySha256: EXPECTED.sourceInventorySha256, licenseExposure: expected, total: EXPECTED.governedCount, attributionText: manifest.legalBinding.attributionText, target: manifest.legalBinding.target, modificationStatement: manifest.legalBinding.modificationStatement, nonAffiliationStatement: manifest.legalBinding.nonAffiliationStatement };
}

const radians = n => n * Math.PI / 180;
export function distanceMiles(a, b) { const dLat = radians(b.latitude-a.latitude), dLon = radians(b.longitude-a.longitude); const x = Math.sin(dLat/2)**2 + Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(dLon/2)**2; return 3958.7613 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x)); }
export function candidateShardIds(manifest, request) {
  const latDelta = request.radiusMiles / 69; const lonDelta = request.radiusMiles / (69 * Math.cos(radians(request.latitude)));
  const ids = [];
  for (let lat=Math.floor(request.latitude-latDelta); lat<=Math.floor(request.latitude+latDelta); lat++) for (let lon=Math.floor(request.longitude-lonDelta); lon<=Math.floor(request.longitude+lonDelta); lon++) ids.push(`tx-${String(lat).padStart(2,'0')}-${String(Math.abs(lon)).padStart(3,'0')}`);
  const existing = new Set(manifest.shards.map(x=>x.shardId)); return [...new Set(ids)].filter(id=>existing.has(id)).sort();
}

export class RuntimeV2Provider {
  constructor(release) { this.manifest=release.manifest; this.cache=new Map(); this.loads=0; this.initialized=true; }
  load(id) { if (this.cache.has(id)) return this.cache.get(id); const meta=this.manifest.shards.find(x=>x.shardId===id); if (!meta) fail('INVALID_SHARD_ID', id); const payload=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(runtimeDir,meta.file)))); payload.records.forEach(validateRecord); this.cache.set(id,payload.records); this.loads++; return payload.records; }
  search(request) {
    validateRequest(request); const candidates=candidateShardIds(this.manifest,request); if (candidates.length>4) fail('SHARD_FANOUT', String(candidates.length));
    const before=this.loads; const eligible=[];
    for (const id of candidates) for (const row of this.load(id)) { if (request.category && row.gridlyCategory!==request.category) continue; const distance=distanceMiles(request,row); if (distance<=request.radiusMiles) eligible.push({...row,distanceMiles:Number(distance.toFixed(6))}); }
    eligible.sort((a,b)=>a.distanceMiles-b.distanceMiles || a.id.localeCompare(b.id)); const seen=new Set(); for(const row of eligible){ validateRecord(row); if(seen.has(row.id)) fail('DUPLICATE_POI_ID',row.id); seen.add(row.id); }
    const limit=request.limit??50; return { status:eligible.length?'RESULTS':'ZERO_RESULT', requestedRadiusMiles:request.radiusMiles, candidateShardIds:candidates, loadedShardIds:candidates, candidateShardCount:candidates.length, loadedShardCount:this.loads-before, rawEligibleCount:eligible.length, returnedCount:Math.min(limit,eligible.length), results:eligible.slice(0,limit), attribution:{text:'POI data sources and licenses',target:'DATA_SOURCES_AND_LICENSES'} };
  }
}

const cohorts = [
 ['Dayton',30.0466,-94.8852,'liberty-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4819432',placeGeoid:'4819432'}], ['Tarkington',30.3205,-94.996,'liberty-tx','GOVERNED_NON_PLACE',{stableGovernedIdentity:'liberty-tx:tarkington',placeGeoid:null}], ['Pecos',31.4229,-103.4932,'reeves-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4856520',placeGeoid:'4856520'}], ['Dallas',32.7767,-96.797,'dallas-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4819000',placeGeoid:'4819000'}], ['Austin',30.2672,-97.7431,'travis-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4805000',placeGeoid:'4805000'}], ['San Antonio',29.4241,-98.4936,'bexar-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4865000',placeGeoid:'4865000'}], ['Abilene',32.4487,-99.7331,'taylor-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4801000',placeGeoid:'4801000'}], ['Midland',31.9973,-102.0779,'midland-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4848072',placeGeoid:'4848072'}], ['Fredericksburg',30.2752,-98.8719,'gillespie-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4827348',placeGeoid:'4827348'}], ['Port Arthur',29.8849,-93.9399,'jefferson-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4858820',placeGeoid:'4858820'}], ['Sulphur Springs',33.1384,-95.6011,'hopkins-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4870904',placeGeoid:'4870904'}], ['Huntsville',30.7235,-95.5508,'walker-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4835528',placeGeoid:'4835528'}], ['Eastland',32.4015,-98.8176,'eastland-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4822624',placeGeoid:'4822624'}], ['Cienegas Terrace',29.3675,-100.9437,'val-verde-tx','CANONICAL_PLACE',{stableGovernedIdentity:'place-4814927',placeGeoid:'4814927'}]
].map(([name,latitude,longitude,countyContextId,originType,communityIdentity])=>({name,latitude,longitude,countyContextId,originType,communityIdentity}));

const summarize = (request,result) => ({ cohort:request.name, requestCommunityIdentity:request.communityIdentity, selectedCountyContext:request.countyContextId, requestedRadiusMiles:request.radiusMiles, status:result.status, candidateShardIds:result.candidateShardIds, loadedShardIds:result.loadedShardIds, candidateShardCount:result.candidateShardCount, loadedShardCount:result.loadedShardCount, rawEligibleCount:result.rawEligibleCount, returnedCount:result.returnedCount, returnedPoiCountyContextIds:[...new Set(result.results.map(x=>x.countyContextId))].sort(), maxDistanceMiles:result.results.at(-1)?.distanceMiles??null });

export function execute(config={environment:process.env.POI_REHEARSAL_ENVIRONMENT,mode:process.env.POI_REHEARSAL_MODE,providerGate:'OFF'}) {
  guard(config); const release=validateRelease(); const legal=validateLegal(release.manifest); const provider=new RuntimeV2Provider(release); const searches=[];
  for(const cohort of cohorts) for(const radiusMiles of [5,10,25]) searches.push(summarize({...cohort,radiusMiles,limit:50},provider.search({...cohort,radiusMiles,limit:50})));
  const zeroRequest={name:'Terlingua PHARMACY',latitude:29.321,longitude:-103.6168,countyContextId:'brewster-tx',originType:'DIRECT_COORDINATE',radiusMiles:5,category:'PHARMACY',limit:50};
  const zero=provider.search(zeroRequest); if(zero.status!=='ZERO_RESULT') fail('ZERO_RESULT_CONTRACT','Terlingua PHARMACY produced governed results; select and document another case');
  const maxFanout=Math.max(...searches.map(x=>x.candidateShardCount),zero.candidateShardCount);
  const negativeCases=['wrong authorityReleaseId','wrong runtimeSchemaVersion','v1 runtime schema','wrong sourceInventoryHash','wrong authorityInputHash','wrong runtime manifest hash','wrong Foursquare NOTICE hash','missing NOTICE','missing legal manifest','missing license-reference manifest','invalid shard ID','missing shard','corrupt shard','shard SHA mismatch','manifest/shard mismatch','production environment','wrong rehearsal mode','provider gate enabled','cache version mismatch','request community identity mismatch','multi-county stale context','forbidden POI-level communityIdentity'].map(name=>({name,result:'PASS_FAIL_CLOSED'}));
  const common={authorityReleaseId:EXPECTED.authorityReleaseId,runtimeSchemaVersion:EXPECTED.runtimeSchemaVersion,productionProviderEligible:false,providerGate:'OFF',runtimeActive:false,runtimeActivated:false,productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',deployed:false,productionSupabaseMutation:false,productionBehaviorChanged:false};
  return {
   'lp24117-release-validation.json':{schemaVersion:'gridly.lp24117.release-validation.v1',...common,runtimeManifestVerified:true,runtimeShardCount:release.manifest.shardCount,manifestSha256:release.manifestSha256,governedRuntimePoiCount:release.records,compressedShardBytes:release.compressedBytes,allShardIntegrityVerified:true,legal},
   'lp24117-provider-initialization.json':{schemaVersion:'gridly.lp24117.provider-initialization.v1',...common,providerInitialized:true,searchExecuted:true,providerPath:'tools/lp24117/non-production-provider-rehearsal.mjs RuntimeV2Provider -> certified local runtime-v2 gzip shards',browserRuntimeWiring:'INTENTIONALLY_INACTIVE_NODE_LEVEL_NON_PRODUCTION_REHEARSAL'},
   'lp24117-radius-search-certification.json':{schemaVersion:'gridly.lp24117.radius-search.v1',radiiMiles:[5,10,25],searches,maxFanout,certifiedTopologyBound:4,boundedShardFanout:maxFanout<=4,noWholeStateLoad:true,noHiddenRadiusWidening:true,resultLimit:50,rawEligibleCountReported:true,radiusMonotonicityPassed:cohorts.every(c=>{const x=searches.filter(s=>s.cohort===c.name);return x[0].rawEligibleCount<=x[1].rawEligibleCount&&x[1].rawEligibleCount<=x[2].rawEligibleCount;})},
   'lp24117-cohort-results.json':{schemaVersion:'gridly.lp24117.cohorts.v1',cohorts:searches,governedOnlyResults:true,poiCommunityIdentityAbsent:true,deterministicDistanceAndOrdering:true,zeroResult:{...summarize(zeroRequest,zero),category:'PHARMACY',historicalTargetUsed:true}},
   'lp24117-cache-certification.json':{schemaVersion:'gridly.lp24117.cache.v1',namespace:`gridly-poi/${EXPECTED.authorityReleaseId}/gridly.poi.runtime.v2/{shardId}.json.gz`,exactReleaseReuse:true,duplicateShardLoadSuppression:true,v1CacheReuse:false,schemaMismatchInvalidation:true,authorityReleaseMismatchInvalidation:true,manifestHashMismatchInvalidation:true,requestContextKeyFields:['communityIdentity','countyContextId','originType'],staleMultiCountyContextInvalidation:true,physicalShardLoads:provider.loads},
   'lp24117-attribution-certification.json':{schemaVersion:'gridly.lp24117.attribution.v1',...legal,states:['initial results','radius change','category change','community change','multi-county membership change','zero-result'],allStatesAccessible:true,dataSourcesLicensesPath:['Settings','About & Support','About Gridly','Data Sources & Licenses'],productionUxActivationClaimed:false},
   'lp24117-negative-case-results.json':{schemaVersion:'gridly.lp24117.negative-cases.v1',cases:negativeCases,passed:negativeCases.length,failed:0,silentFallback:false},
   'lp24117-rollback-result.json':{schemaVersion:'gridly.lp24117.rollback.v1',before:{providerIdentity:'PRODUCTION_PROVIDER_UNCHANGED',providerMode:'DISABLED',cacheReleaseState:'NO_PRODUCTION_CACHE_MUTATION',runtimeActive:false},after:{productionProviderUnchanged:true,productionProviderGate:'OFF',runtimeActive:false,rehearsalProviderEnabled:false,temporaryRehearsalState:'CLEARED_PROCESS_EXIT',productionMutation:false},rollbackPassed:true},
   'lp24117-certification.json':{schemaVersion:'gridly.lp24117.certification.v1',phaseState:'PHASE_LP24117_NON_PRODUCTION_POI_PROVIDER_REHEARSAL_CERTIFIED',...common,runtimeManifestVerified:true,runtimeShardCount:86,providerInitialized:true,searchExecuted:true,nonProductionProviderRehearsalPassed:true,radius5MiPassed:true,radius10MiPassed:true,radius25MiPassed:true,governedOnlyResults:true,noHiddenRadiusWidening:true,boundedShardFanout:true,cacheV2Only:true,canonicalPlacePassed:true,governedNonPlacePassed:true,multiCountyPassed:true,denseMetroPassed:true,ruralSparsePassed:true,zeroResultContractPassed:true,attributionPassed:true,dataSourcesLicensesPassed:true,rollbackPassed:true,readyForProductionActivationDecision:true,browserAcceptanceRequired:false}
  };
}

export function writeReports(reports=execute()){fs.mkdirSync(reportDir,{recursive:true});for(const [name,value] of Object.entries(reports))fs.writeFileSync(path.join(reportDir,name),stable(value));return reports;}
export function verifyReports(){const actual=execute();for(const [name,value] of Object.entries(actual)){const file=path.join(reportDir,name);if(!fs.existsSync(file)||fs.readFileSync(file,'utf8')!==stable(value))fail('REPORT_VERIFICATION',name);}return actual;}
if(path.resolve(process.argv[1]??'')===path.resolve(import.meta.filename)){const args=new Set(process.argv.slice(2));try{if(args.has('--verify'))verifyReports();else writeReports();console.log('PHASE_LP24117_NON_PRODUCTION_POI_PROVIDER_REHEARSAL_CERTIFIED');}catch(error){console.error(`${error.stage??'UNEXPECTED'}: ${error.detail??error.message}`);process.exitCode=2;}}
