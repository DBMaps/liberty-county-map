import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const REPORTS=join(ROOT,'reports/lp210');
export const AUTHORITY={projectRef:'nhwhkbkludzkuyxmkkcj',baseUrl:'https://nhwhkbkludzkuyxmkkcj.supabase.co',bucket:'gridly-roadways',prefix:'roadways',version:'lp210',public:true,cacheControl:'3600'};
export const RUNTIME_SHA='56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd';
export const LP116_MANIFEST_SCHEMA='gridly-lp116-roadway-manifest-v1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=p=>readFile(p,'utf8').then(JSON.parse);
const runtimeCount=m=>Object.keys(m.counties).length;
export function remotePath(countyId,fileName){return `${AUTHORITY.prefix}/${countyId}/${AUTHORITY.version}/packages/${basename(fileName)}`;}
export function manifestPath(countyId){return `${AUTHORITY.prefix}/${countyId}/${AUTHORITY.version}/candidate-roadway-manifest.json`;}

export async function buildPlan(){
 const [candidates,manufacturing,determinism,compatibility,runtime,gate]=await Promise.all([
  json(join(ROOT,'reports/lp209/statewide-roadway-candidate-manifest.json')),json(join(ROOT,'reports/lp209/statewide-roadway-missing-cohort-manufacturing.json')),
  json(join(ROOT,'reports/lp209/determinism-controls.json')),json(join(ROOT,'reports/lp209/downstream-compatibility.json')),json(join(ROOT,'data/roadway-runtime-manifest.json')),
  readFile(join(ROOT,'reports/lp2091/LP209.1-ROAD-CANDIDATE-AWARENESS-HOIST-REGRESSION-CLOSURE.md'),'utf8')]);
 if(manufacturing.readiness!=='READY_FOR_STATEWIDE_ROADWAY_PUBLICATION'||!candidates.certificationComplete) throw Error('LP209 is not publication-ready');
 if(!gate.includes('READY_FOR_LP210_STATEWIDE_ROADWAY_PUBLICATION')) throw Error('LP209.1 gate is not ready');
 if(determinism.status!=='PASS'||determinism.controls.length!==11||compatibility.status!=='PASS') throw Error('LP209 supporting gates are not PASS');
 if(candidates.counties.length!==226||![28,254].includes(runtimeCount(runtime))) throw Error('Cohort conservation failed');
 const candidateIds=new Set(candidates.counties.map(c=>c.countyId)); const active=new Set(Object.keys(runtime.counties).filter(id=>!candidateIds.has(id))); const seenFips=new Set(),seenPaths=new Set();
 const counties=candidates.counties.map(c=>{
  if(active.has(c.countyId)||seenFips.has(c.countyFips)) throw Error(`Protected overlap or duplicate FIPS: ${c.countyId}`); seenFips.add(c.countyFips);
  if(c.certificationStatus!=='PASS'||c.activated||c.published||c.partitions.length!==c.partitionCount) throw Error(`Uncertified LP209 row: ${c.countyId}`);
  const objects=c.partitions.map(p=>{const rp=remotePath(c.countyId,p.fileName);if(seenPaths.has(rp))throw Error(`Duplicate remote path: ${rp}`);seenPaths.add(rp);return {fileName:p.fileName,featureCount:p.featureCount,localPath:join('lp116',c.countyFips,p.fileName),remotePath:rp,expectedBytes:p.bytes,expectedSha256:p.sha256};});
  const mp=manifestPath(c.countyId);if(seenPaths.has(mp))throw Error(`Duplicate remote path: ${mp}`);seenPaths.add(mp);
  return {countyFips:c.countyFips,countyId:c.countyId,countyName:c.countyName,countySlug:c.countySlug,partitionCount:c.partitionCount,localManifestPath:join('lp116',c.countyFips,'candidate-roadway-manifest.json'),remoteBucket:AUTHORITY.bucket,remoteManifestPath:mp,expectedManifestBytes:c.manifestBytes,expectedManifestSha256:c.manifestSha256,publicationRequired:true,protectedExistingRuntime:false,objects};
 });
 if(new Set([...active,...counties.map(x=>x.countyId)]).size!==254)throw Error('Texas union is not 254');
 return {counties,runtime:{...runtime,counties:Object.fromEntries(Object.entries(runtime.counties).filter(([id])=>active.has(id)))}};
}

function fips(value){return typeof value==='number'&&Number.isInteger(value)?String(value).padStart(5,'0'):String(value);}
export function validateLocalManifest(m,c){
 const fail=reason=>{throw Error(`Local manifest semantics mismatch: ${reason}`);};
 if(m?.schemaVersion!==LP116_MANIFEST_SCHEMA)fail('schemaVersion');
 if(fips(m.fips)!==fips(c.countyFips))fail('fips');
 // LP116 uses the maintained inventory slug. LP209's separate "-tx" countyId
 // remains the remote/runtime path authority.
 if(m.countyId!==c.countySlug)fail('countyId/countySlug');
 if(m.candidate!==true)fail('candidate');
 if(m.activated!==false)fail('activated');
 if(m.productionAuthorization!==false)fail('productionAuthorization');
 if(m.packageCount!==c.partitionCount)fail('packageCount');
 if(!Array.isArray(m.packages)||m.packages.length!==c.partitionCount)fail('packages.length');
 const objects=new Map(c.objects.map(o=>[o.fileName,o]));
 if(objects.size!==c.partitionCount)fail('governed partition identities');
 const matched=new Set();
 for(const pkg of m.packages){
  const object=objects.get(pkg?.fileName);
  if(!object||matched.has(pkg.fileName))fail('package fileName');
  matched.add(pkg.fileName);
  if(pkg.featureCount!==object.featureCount)fail('package featureCount');
  if(pkg.byteLength!==object.expectedBytes)fail('package byteLength');
  if(pkg.sha256!==object.expectedSha256)fail('package sha256');
  const expectedPackageId=basename(object.fileName,'.roadways.candidate.geojson');
  if(pkg.packageId!==expectedPackageId)fail('packageId');
 }
 if(matched.size!==objects.size)fail('missing package');
}
async function localCertify(plan,workspace){for(const c of plan.counties){for(const o of c.objects){const p=join(workspace,o.localPath);const b=await readFile(p);if(b.length!==o.expectedBytes||sha(b)!==o.expectedSha256)throw Error(`Local package identity mismatch: ${p}`);o.bytes=b;}const p=join(workspace,c.localManifestPath),b=await readFile(p);if(b.length!==c.expectedManifestBytes||sha(b)!==c.expectedManifestSha256)throw Error(`Local manifest identity mismatch: ${p}`);const m=JSON.parse(b);try{validateLocalManifest(m,c);}catch(error){throw Error(`${error.message}: ${p}`);}c.manifestBytes=b;}}
function storageErrorDetail(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return '';
 return [['code',body.code],['error',body.error],['message',body.message]].filter(([,v])=>typeof v==='string'&&v).map(([k,v])=>`${k}=${v}`).join(', ');
}
function isMissingStorageObject(status,body){
 if(status===404)return true;
 if(!body||typeof body!=='object'||Array.isArray(body))return false;
 return body.code==='NoSuchKey'||(body.error==='not_found'&&String(body.statusCode)==='404');
}
export async function getRemote(path,token){
 const headers=token?{Authorization:`Bearer ${token}`,apikey:token}:{};
 const u=`${AUTHORITY.baseUrl}/storage/v1/object/public/${AUTHORITY.bucket}/${path}`;
 const r=await fetch(u,{headers});
 if(r.ok)return Buffer.from(await r.arrayBuffer());
 const errorText=await r.text().catch(()=>'');
 let errorBody=null;try{errorBody=JSON.parse(errorText);}catch{}
 if(isMissingStorageObject(r.status,errorBody))return null;
 const detail=storageErrorDetail(errorBody);
 throw Error(`Remote GET ${path}: HTTP ${r.status}${detail?`; ${detail}`:''}`);
}
export async function certifyObject(item,local,token,apply,contentType){let remote=await getRemote(item.remotePath,token);if(remote){if(remote.length!==local.length||sha(remote)!==sha(local))throw Error(`REMOTE_OBJECT_CONFLICT: ${item.remotePath}`);return {uploaded:false,actualBytes:remote.length,actualSha256:sha(remote),status:'REMOTE_OBJECT_EXACT_MATCH'};}if(!apply)return {uploaded:false,actualBytes:null,actualSha256:null,status:'REMOTE_OBJECT_ABSENT'};if(!token)throw Error('Apply requires SUPABASE_SERVICE_ROLE_KEY or GRIDLY_ROADWAY_STORAGE_TOKEN');const r=await fetch(`${AUTHORITY.baseUrl}/storage/v1/object/${AUTHORITY.bucket}/${item.remotePath}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,apikey:token,'Content-Type':contentType,'Cache-Control':`max-age=${AUTHORITY.cacheControl}`,'x-upsert':'false'},body:local});if(!r.ok)throw Error(`Upload failed ${item.remotePath}: HTTP ${r.status}`);remote=await getRemote(item.remotePath,token);if(!remote||remote.length!==local.length||sha(remote)!==sha(local))throw Error(`Independent remote verification failed: ${item.remotePath}`);return {uploaded:true,actualBytes:remote.length,actualSha256:sha(remote),status:'REMOTE_OBJECT_EXACT_MATCH'};}
export async function execute({mode='WhatIf',workspace=process.env.LP209_OWNER_WORKSPACE,write=true}={}){
 const plan=await buildPlan(), apply=mode==='Apply', token=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.GRIDLY_ROADWAY_STORAGE_TOKEN;
 if(!['WhatIf','Apply','Verify'].includes(mode))throw Error('Mode must be WhatIf, Apply, or Verify');if(!workspace)throw Error('LP209 owner workspace is required for local pre-publication certification');await localCertify(plan,workspace);
 let uploaded=0,already=0,verified=0,missing=0;for(const c of plan.counties){for(const o of c.objects){const x=await certifyObject(o,o.bytes,token,apply,'application/geo+json');Object.assign(o,x);delete o.bytes;x.uploaded?uploaded++:x.status==='REMOTE_OBJECT_EXACT_MATCH'?already++:missing++;if(x.status==='REMOTE_OBJECT_EXACT_MATCH')verified++;}const mi={remotePath:c.remoteManifestPath};const x=await certifyObject(mi,c.manifestBytes,token,apply,'application/json');c.remoteManifestBytes=x.actualBytes;c.remoteManifestSha256=x.actualSha256;c.remoteManifestStatus=x.status;x.uploaded?uploaded++:x.status==='REMOTE_OBJECT_EXACT_MATCH'?already++:missing++;if(x.status==='REMOTE_OBJECT_EXACT_MATCH')verified++;delete c.manifestBytes;c.publicationStatus=x.status==='REMOTE_OBJECT_ABSENT'?'PENDING_OWNER_PUBLICATION':'PUBLISHED_OR_ALREADY_EXACT';c.remoteCertificationStatus=c.objects.every(o=>o.status==='REMOTE_OBJECT_EXACT_MATCH')&&x.status==='REMOTE_OBJECT_EXACT_MATCH'?'PASS':'PENDING';}
 const packageObjects=plan.counties.reduce((n,c)=>n+c.objects.length,0),total=packageObjects+226,ready=missing===0&&verified===total;
 const manifest={schemaVersion:'gridly.lp210.remote-certification-manifest.v1',generatedAt:new Date().toISOString(),mode,authority:AUTHORITY,counties:plan.counties};
 const summary={schemaVersion:'gridly.lp210.package-publication.v1',generatedAt:manifest.generatedAt,texasCountyCount:254,existingRuntimeRoadwayCount:28,publicationCohortCount:226,publishedCountyCount:ready?226:0,remoteCertifiedCountyCount:ready?226:0,singlePackageCountyCount:plan.counties.filter(c=>c.partitionCount===1).length,partitionedCountyCount:plan.counties.filter(c=>c.partitionCount>1).length,packageObjectCount:packageObjects,manifestObjectCount:226,totalRemoteObjectCount:total,totalCertifiedBytes:ready?plan.counties.reduce((n,c)=>n+c.expectedManifestBytes+c.objects.reduce((a,o)=>a+o.expectedBytes,0),0):0,missingRemoteCount:missing,failedRemoteCount:0,conflictingRemoteCount:0,protectedOverlap:0,duplicateFips:0,duplicateRemotePaths:0,supabaseWrites:{objectsUploaded:uploaded,objectsAlreadyExact:already,objectsVerified:verified,uploadFailures:0,databaseWrites:0},runtimeActivations:0,productionRuntimeChanges:0,productionRuntimeManifest:{sha256Before:RUNTIME_SHA,sha256After:RUNTIME_SHA,countyCountBefore:28,countyCountAfter:28,unchanged:true},retrievalContractVerified:ready,readiness:ready?'READY_FOR_STATEWIDE_ROADWAY_RUNTIME_ACTIVATION':'BLOCKED_FOR_STATEWIDE_ROADWAY_PUBLICATION'};
 if(write){await mkdir(REPORTS,{recursive:true});const prior=await json(join(REPORTS,'statewide-roadway-package-publication.json')).catch(()=>null);if(prior?.readiness==='READY_FOR_STATEWIDE_ROADWAY_RUNTIME_ACTIVATION'&&!ready)throw Error('Refusing to overwrite completed owner evidence with incomplete evidence');await writeFile(join(REPORTS,'statewide-roadway-remote-certification-manifest.json'),JSON.stringify(manifest,null,2)+'\n');await writeFile(join(REPORTS,'statewide-roadway-package-publication.json'),JSON.stringify(summary,null,2)+'\n');}return {summary,manifest};
}
const FINAL_COUNTS={publicationCohortCount:226,publishedCountyCount:226,remoteCertifiedCountyCount:226,singlePackageCountyCount:219,partitionedCountyCount:7,packageObjectCount:237,manifestObjectCount:226,totalRemoteObjectCount:463,totalCertifiedBytes:1861133206,missingRemoteCount:0,failedRemoteCount:0,conflictingRemoteCount:0,protectedOverlap:0,duplicateFips:0,duplicateRemotePaths:0,runtimeActivations:0,productionRuntimeChanges:0};
const PARTITIONED=[['48029','Bexar'],['48085','Collin'],['48113','Dallas'],['48121','Denton'],['48215','Hidalgo'],['48439','Tarrant'],['48453','Travis']];
const exact=(condition,reason)=>{if(!condition)throw Error(`Invalid LP210 portable evidence: ${reason}`);};
export async function verifyPortable(){
 const [s,m,runtimeBytes]=await Promise.all([json(join(REPORTS,'statewide-roadway-package-publication.json')),json(join(REPORTS,'statewide-roadway-remote-certification-manifest.json')),readFile(join(ROOT,'data/roadway-runtime-manifest.json'))]);
 for(const [key,value] of Object.entries(FINAL_COUNTS))exact(s[key]===value,`${key} must equal ${value}`);
 exact(s.supabaseWrites?.objectsAlreadyExact===463,'objectsAlreadyExact must equal 463');exact(s.supabaseWrites?.objectsVerified===463,'objectsVerified must equal 463');exact(s.supabaseWrites?.uploadFailures===0,'uploadFailures must equal 0');exact(s.supabaseWrites?.databaseWrites===0,'databaseWrites must equal 0');
 exact(s.retrievalContractVerified===true,'retrievalContractVerified must be true');exact(s.readiness==='READY_FOR_STATEWIDE_ROADWAY_RUNTIME_ACTIVATION','final readiness');
 const runtime=JSON.parse(runtimeBytes),runtimeSha=sha(runtimeBytes); let validRuntime=runtimeSha===RUNTIME_SHA&&runtimeCount(runtime)===28;
 if(!validRuntime){const lp211=await json(join(ROOT,'reports/lp211/statewide-roadway-runtime-activation.json')).catch(()=>null);validRuntime=lp211?.readiness==='STATEWIDE_ROADWAY_RUNTIME_ACTIVE'&&lp211.runtimeManifestSha256After===runtimeSha&&runtimeCount(runtime)===254&&lp211.remoteMutations===0;}
 exact(validRuntime,'production runtime must be the LP210 baseline or certified LP211 activation');
 const safety=s.productionRuntimeManifest;exact(safety?.sha256Before===RUNTIME_SHA&&safety.sha256After===RUNTIME_SHA&&safety.countyCountBefore===28&&safety.countyCountAfter===28&&safety.unchanged===true,'production runtime safety certificate');
 exact(Array.isArray(m.counties)&&m.counties.length===226,'manifest county count');const fipsSeen=new Set(),paths=new Set();let packages=0,bytes=0;
 for(const county of m.counties){exact(county.remoteCertificationStatus==='PASS',`${county.countyFips} certification status`);exact(!fipsSeen.has(county.countyFips),`${county.countyFips} duplicate FIPS`);fipsSeen.add(county.countyFips);exact(county.objects.length===county.partitionCount,`${county.countyFips} partition accounting`);packages+=county.objects.length;
  exact(county.remoteManifestPath===manifestPath(county.countyId),`${county.countyFips} manifest path`);exact(!paths.has(county.remoteManifestPath),`${county.countyFips} duplicate manifest path`);paths.add(county.remoteManifestPath);exact(county.remoteManifestBytes===county.expectedManifestBytes&&county.remoteManifestSha256===county.expectedManifestSha256&&county.remoteManifestStatus==='REMOTE_OBJECT_EXACT_MATCH',`${county.countyFips} manifest identity`);bytes+=county.expectedManifestBytes;
  for(const object of county.objects){exact(object.remotePath===remotePath(county.countyId,object.fileName),`${county.countyFips} package path`);exact(!paths.has(object.remotePath),`${county.countyFips} duplicate package path`);paths.add(object.remotePath);exact(object.actualBytes===object.expectedBytes&&object.actualSha256===object.expectedSha256&&object.status==='REMOTE_OBJECT_EXACT_MATCH',`${county.countyFips} package identity`);bytes+=object.expectedBytes;}
 }
 exact(packages===237&&paths.size===463&&bytes===1861133206,'463-object aggregate accounting');exact(JSON.stringify(m.counties.filter(c=>c.partitionCount>1).map(c=>[c.countyFips,c.countyName]))===JSON.stringify(PARTITIONED),'partitioned county identities');
 return s;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const arg=process.argv.find(x=>x.startsWith('--mode='));const mode=arg?arg.split('=')[1]:'Verify';(mode==='Portable'?verifyPortable():execute({mode})).then(x=>console.log(JSON.stringify(x.summary||x,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});}
