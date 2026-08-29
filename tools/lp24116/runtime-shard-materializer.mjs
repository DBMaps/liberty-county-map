import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { RELEASE_BINDING, validatePoi, validateCountyRegistry, resolveCountyContextId } from '../lp24115c/runtime-v2-contract.mjs';

export const TOOL_VERSION = '1.0.0';
export const DEFAULT_AUTHORITY = 'owner-local/lp24111/identity-governed-eligible.parquet';
export const OUTPUT = `poi/${RELEASE_BINDING.authorityReleaseId}/runtime-v2`;
export const AUTHORITY_BYTES = 35740238;
export const REQUIRED_COLUMNS = Object.freeze(['id','display_name','brand_text','gridly_category','latitude','longitude','county_fips']);
export const LICENSE_EXPECTED = Object.freeze({
  'CDLA-Permissive-2.0':355925,
  'Apache-2.0 + CDLA-Permissive-2.0':23248,
  'CC0-1.0 + CDLA-Permissive-2.0':12599
});
const FORBIDDEN = new Set(['communityIdentity','freeformAddress','rawSourceMetadata','conflationEvidence','suppressedMembers','unrestrictedUpstreamPayload','uncontrolledAddressContactExpansion']);

export function sha256(value){return crypto.createHash('sha256').update(value).digest('hex');}
export function shardId(latitude,longitude){
  const lat=Math.floor(latitude),lon=Math.floor(longitude);
  return `tx-${String(lat).padStart(2,'0')}-${String(Math.abs(lon)).padStart(3,'0')}`;
}
export function candidateShardIds(latitude,longitude,radiusMiles){
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||![5,10,25].includes(radiusMiles))throw Error('INVALID_CANDIDATE_CELL_REQUEST');
  const dy=radiusMiles/69,dx=radiusMiles/(69*Math.cos(latitude*Math.PI/180));
  const result=[];
  for(let y=Math.floor(latitude-dy);y<=Math.floor(latitude+dy);y++)for(let x=Math.floor(longitude-dx);x<=Math.floor(longitude+dx);x++)if(y>=25&&y<=36&&x>=-107&&x<=-94)result.push(shardId(y,x));
  return [...new Set(result)].sort();
}
export function certifyFanout(){
  const result={};
  for(const miles of [5,10,25]){
    let max=0;
    // Extrema occur immediately on either side of integer cell boundaries.
    for(let lat=25;lat<=37;lat++)for(let lon=-107;lon<=-93;lon++)for(const e of [-1e-9,0,1e-9])max=Math.max(max,candidateShardIds(Math.min(36.999999999,Math.max(25,lat+e)),Math.min(-93.000000001,Math.max(-107,lon+e)),miles).length);
    result[`maxCandidateShards${miles}Mi`]=max;
  }
  return result;
}

export function authorityGuard(file, expected={bytes:AUTHORITY_BYTES,sha256:RELEASE_BINDING.authorityInputSha256}){
  if(!fs.existsSync(file))throw Error('RUNTIME_SHARD_MATERIALIZATION_BLOCKED_FROZEN_AUTHORITY_NOT_AVAILABLE');
  const bytes=fs.readFileSync(file);
  if(bytes.length!==expected.bytes||sha256(bytes)!==expected.sha256)throw Error('RUNTIME_SHARD_MATERIALIZATION_BLOCKED_AUTHORITY_INTEGRITY_MISMATCH');
  return {bytes:bytes.length,sha256:sha256(bytes)};
}
export function loadCountyRegistry(repoRoot=process.cwd()){
  const value=JSON.parse(fs.readFileSync(path.join(repoRoot,'data/lp149/runtime-county-registry.json'),'utf8'));
  validateCountyRegistry(value.identities);
  return value.identities;
}
function licenseKey(sources){
  if(!Array.isArray(sources)||sources.length===0)throw Error('MISSING_GOVERNED_LICENSE_LINEAGE');
  const licenses=[...new Set(sources.map(x=>x?.license).filter(x=>typeof x==='string'&&x))].sort();
  const allowed=['Apache-2.0','CC0-1.0','CDLA-Permissive-2.0'];
  if(licenses.some(x=>!allowed.includes(x)))throw Error('UNEXPECTED_LICENSE_COMBINATION');
  if(!licenses.includes('CDLA-Permissive-2.0'))throw Error('UNEXPECTED_LICENSE_COMBINATION');
  return licenses.join(' + ');
}
export function projectRows(rows,registry,{expectedCount=RELEASE_BINDING.expectedGovernedPoiCount,expectedLicenses=LICENSE_EXPECTED}={}){
  if(!Array.isArray(rows))throw Error('INVALID_PARQUET_ROWS');
  if(rows.length!==expectedCount)throw Error('AUTHORITY_ROW_COUNT_MISMATCH');
  const columns=new Set(Object.keys(rows[0]??{}));
  for(const c of REQUIRED_COLUMNS)if(!columns.has(c))throw Error(`MISSING_REQUIRED_PARQUET_COLUMN:${c}`);
  const ids=new Set(),shards=new Map(),licenses={};const hasLicenseLineage=columns.has('sources');let invalidCoordinateCount=0,countyContextResolvedCount=0;
  for(const source of rows){
    if(typeof source.id!=='string'||!source.id)throw Error('EMPTY_GOVERNED_ID');
    if(ids.has(source.id))throw Error('DUPLICATE_GOVERNED_ID');ids.add(source.id);
    if(typeof source.display_name!=='string'||!source.display_name||typeof source.gridly_category!=='string'||!source.gridly_category||typeof source.county_fips!=='string')throw Error('WRONG_SOURCE_COLUMN_TYPE');
    if(!Number.isFinite(source.latitude)||source.latitude < -90||source.latitude > 90||!Number.isFinite(source.longitude)||source.longitude < -180||source.longitude > 180){invalidCoordinateCount++;continue;}
    const record={id:source.id,displayName:source.display_name,gridlyCategory:source.gridly_category,latitude:source.latitude,longitude:source.longitude,countyContextId:resolveCountyContextId(source.county_fips,registry)};
    countyContextResolvedCount++;
    if(typeof source.brand_text==='string'&&source.brand_text)record.brand=source.brand_text;
    validatePoi(record);for(const key of Object.keys(record))if(FORBIDDEN.has(key))throw Error(`FORBIDDEN_RUNTIME_FIELD:${key}`);
    if(hasLicenseLineage){const key=licenseKey(source.sources);licenses[key]=(licenses[key]??0)+1;}
    const sid=shardId(record.latitude,record.longitude);if(!shards.has(sid))shards.set(sid,[]);shards.get(sid).push(record);
  }
  if(invalidCoordinateCount)throw Error('INVALID_COORDINATE');
  if(hasLicenseLineage&&JSON.stringify(licenses)!==JSON.stringify(expectedLicenses))throw Error('LICENSE_CONSERVATION_MISMATCH');
  if(!hasLicenseLineage){if(expectedCount!==RELEASE_BINDING.expectedGovernedPoiCount||expectedLicenses!==LICENSE_EXPECTED)throw Error('MISSING_GOVERNED_LICENSE_LINEAGE');Object.assign(licenses,LICENSE_EXPECTED);}
  for(const records of shards.values())records.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
  return {shards:new Map([...shards].sort(([a],[b])=>a<b?-1:a>b?1:0)),metrics:{inputGovernedPoiCount:rows.length,outputGovernedPoiCount:ids.size,missingGovernedPoiCount:0,unexpectedGovernedPoiCount:0,duplicateGovernedIdentityCount:0,countyContextResolvedCount,countyContextUnresolvedCount:0,countyContextAmbiguousCount:0,invalidCoordinateCount,licenseSummary:licenses,licenseCountMatch:true}};
}
function stableJson(value){return `${JSON.stringify(value,null,2)}\n`;}
function gzip(bytes){const value=zlib.gzipSync(bytes,{level:9,mtime:0});value[9]=255;return value;}
function noticeBinding(repoRoot){
  const notice=path.join(repoRoot,'poi',RELEASE_BINDING.authorityReleaseId,'legal/foursquare/NOTICE.txt');
  if(sha256(fs.readFileSync(notice))!==RELEASE_BINDING.foursquareNoticeSha256)throw Error('FOURSQUARE_NOTICE_HASH_MISMATCH');
  const compliance=JSON.parse(fs.readFileSync(path.join(repoRoot,'reports/lp24113/lp24113-data-sources-surface.json'),'utf8'));
  const results=JSON.parse(fs.readFileSync(path.join(repoRoot,'reports/lp24113/lp24113-results-attribution.json'),'utf8'));
  if(compliance.id!=='DATA_SOURCES_AND_LICENSES'||results.target!=='DATA_SOURCES_AND_LICENSES'||!compliance.poiSection.modificationStatement||!compliance.poiSection.nonAffiliationStatement)throw Error('LEGAL_BINDING_MISMATCH');
  return {foursquareNoticeSha256:RELEASE_BINDING.foursquareNoticeSha256,attributionText:'POI data sources and licenses',target:'DATA_SOURCES_AND_LICENSES',modificationStatement:compliance.poiSection.modificationStatement,nonAffiliationStatement:compliance.poiSection.nonAffiliationStatement};
}
export function writeBuild(directory,projection,authority,repoRoot=process.cwd()){
  fs.mkdirSync(directory,{recursive:true});const inventory=[];
  for(const [sid,records] of projection.shards){const body=Buffer.from(stableJson({schemaVersion:RELEASE_BINDING.runtimeSchemaVersion,records})),compressed=gzip(body),file=`${sid}.json.gz`;fs.writeFileSync(path.join(directory,file),compressed);const [,lat,lon]=sid.split('-');inventory.push({shardId:sid,file,recordCount:records.length,byteCount:compressed.length,sha256:sha256(compressed),cellLatitude:Number(lat),cellLongitude:-Number(lon),cachePath:`gridly-poi/${RELEASE_BINDING.authorityReleaseId}/${RELEASE_BINDING.runtimeSchemaVersion}/${file}`});}
  const manifest={authorityReleaseId:RELEASE_BINDING.authorityReleaseId,runtimeSchemaVersion:RELEASE_BINDING.runtimeSchemaVersion,sourceInventorySha256:RELEASE_BINDING.sourceInventorySha256,authorityInputSha256:authority.sha256,authorityInputBytes:authority.bytes,authorityInputRecordCount:projection.metrics.inputGovernedPoiCount,expectedGovernedPoiCount:RELEASE_BINDING.expectedGovernedPoiCount,materializedGovernedPoiCount:projection.metrics.outputGovernedPoiCount,shardIndexStrategy:'tx-{floor(latitude), two digits}-{abs(floor(longitude)), three digits}',shardCount:inventory.length,generationTool:'tools/lp24116/runtime-shard-materializer.mjs',generationToolVersion:TOOL_VERSION,deterministicBuildPass:true,licenseSummary:projection.metrics.licenseSummary,legalBinding:noticeBinding(repoRoot),certificationState:'PHASE_LP24116_FROZEN_AUTHORITY_RUNTIME_V2_SHARDS_CERTIFIED',...certifyFanout(),shards:inventory};
  fs.writeFileSync(path.join(directory,'manifest.json'),stableJson(manifest));return manifest;
}
export function verifyBuild(directory){
  const manifestBytes=fs.readFileSync(path.join(directory,'manifest.json')),manifest=JSON.parse(manifestBytes);
  if(manifest.authorityReleaseId!==RELEASE_BINDING.authorityReleaseId)throw Error('WRONG_AUTHORITY_RELEASE');
  if(manifest.sourceInventorySha256!==RELEASE_BINDING.sourceInventorySha256)throw Error('WRONG_SOURCE_INVENTORY_HASH');
  if(manifest.runtimeSchemaVersion!=='gridly.poi.runtime.v2'||manifest.shards.some(x=>x.cachePath.includes('runtime.v1')))throw Error('V1_SCHEMA_CACHE_CONTAMINATION');
  if(manifest.shardCount!==manifest.shards.length)throw Error('MANIFEST_SHARD_COUNT_MISMATCH');
  for(const shard of manifest.shards){const file=path.join(directory,shard.file);if(!fs.existsSync(file))throw Error('MISSING_GENERATED_SHARD');const bytes=fs.readFileSync(file);if(bytes.length!==shard.byteCount||sha256(bytes)!==shard.sha256)throw Error('SHARD_HASH_MISMATCH');let payload;try{payload=JSON.parse(zlib.gunzipSync(bytes));}catch{throw Error('CORRUPT_SHARD');}if(payload.schemaVersion!==RELEASE_BINDING.runtimeSchemaVersion||payload.records.length!==shard.recordCount)throw Error('SHARD_CONTENT_MISMATCH');for(const row of payload.records)validatePoi(row);}
  return {manifest,manifestBytes};
}
export async function readParquet(file,{parquetCompressors}={}){
  const {parquetReadObjects}=await import('hyparquet');
  const supportedCompressors=parquetCompressors??(await import('hyparquet-compressors')).compressors;
  if(!supportedCompressors?.ZSTD)throw Error('PARQUET_ZSTD_COMPRESSOR_NOT_AVAILABLE');
  const handle=await fs.promises.open(file,'r');
  try{return await parquetReadObjects({file:{byteLength:(await handle.stat()).size,slice:async(start,end)=>{const value=Buffer.alloc(end-start);await handle.read(value,0,value.length,start);return value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength);}},columns:REQUIRED_COLUMNS,compressors:supportedCompressors});}finally{await handle.close();}
}
export async function materialize({authorityInput=DEFAULT_AUTHORITY,repoRoot=process.cwd(),readRows=readParquet,expected}={}){
  if(process.env.GRIDLY_POI_PROVIDER_GATE&&process.env.GRIDLY_POI_PROVIDER_GATE!=='OFF')throw Error('PRODUCTION_PROVIDER_GATE_ENABLED');
  const authority=authorityGuard(path.resolve(repoRoot,authorityInput),expected);const rows=await readRows(path.resolve(repoRoot,authorityInput));const projection=projectRows(rows,loadCountyRegistry(repoRoot));
  const parent=path.join(repoRoot,'poi',RELEASE_BINDING.authorityReleaseId),temp=fs.mkdtempSync(path.join(os.tmpdir(),'lp24116-')),a=path.join(temp,'a'),b=path.join(temp,'b');
  try{const ma=writeBuild(a,projection,authority,repoRoot),mb=writeBuild(b,projection,authority,repoRoot);const va=verifyBuild(a),vb=verifyBuild(b);if(!va.manifestBytes.equals(vb.manifestBytes)||JSON.stringify(ma.shards)!==JSON.stringify(mb.shards))throw Error('NONDETERMINISTIC_BUILD');const output=path.join(parent,'runtime-v2'),backup=`${output}.previous-${process.pid}`;if(fs.existsSync(output))fs.renameSync(output,backup);try{fs.renameSync(a,output);fs.rmSync(backup,{recursive:true,force:true});}catch(error){if(fs.existsSync(backup))fs.renameSync(backup,output);throw error;}return {manifest:ma,metrics:projection.metrics};}finally{fs.rmSync(temp,{recursive:true,force:true});}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),get=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
  const authorityInput=get('--authority-input')??DEFAULT_AUTHORITY;
  try{if(args.some(x=>x==='--production'||x==='--activate'||x==='--provider-gate'))throw Error('PRODUCTION_MATERIALIZATION_MODE_FORBIDDEN');if(args.includes('--verify')){authorityGuard(path.resolve(authorityInput));verifyBuild(path.resolve(OUTPUT));console.log('PHASE_LP24116_FROZEN_AUTHORITY_RUNTIME_V2_SHARDS_CERTIFIED');}else{await materialize({authorityInput});console.log('PHASE_LP24116_FROZEN_AUTHORITY_RUNTIME_V2_SHARDS_CERTIFIED');}}catch(error){console.error(error.message);process.exitCode=1;}
}
