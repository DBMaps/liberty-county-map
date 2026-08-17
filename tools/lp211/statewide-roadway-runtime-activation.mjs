import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'../..');
const PATHS={runtime:'data/roadway-runtime-manifest.json',publication:'reports/lp210/statewide-roadway-package-publication.json',certificate:'reports/lp210/statewide-roadway-remote-certification-manifest.json',registry:'data/lp149/runtime-county-registry.json',activation:'reports/lp211/statewide-roadway-runtime-activation.json',activationManifest:'reports/lp211/statewide-roadway-runtime-activation-manifest.json'};
const BEFORE_SHA='56549d67569f2c74cd202a1e93a30f79591b119ef1fdf58c8d138ffdefaad7bd';
const BASE='https://nhwhkbkludzkuyxmkkcj.supabase.co/storage/v1/object/public/gridly-roadways/';
const sha=(value)=>createHash('sha256').update(value).digest('hex');
const readJson=async(path)=>JSON.parse(await readFile(join(ROOT,path),'utf8'));
const canonical=(value)=>`${JSON.stringify(value,null,2)}\n`;

function assert(condition,message){if(!condition) throw new Error(message);}
export function translateLp210County(row){
  assert(row.remoteCertificationStatus==='PASS',`${row.countyId}: certification is not PASS`);
  assert(row.remoteBucket==='gridly-roadways',`${row.countyId}: unexpected bucket`);
  assert(row.remoteManifestStatus==='REMOTE_OBJECT_EXACT_MATCH',`${row.countyId}: manifest is not exact`);
  assert(row.objects?.length===row.partitionCount,`${row.countyId}: partition count mismatch`);
  row.objects.forEach(object=>assert(object.status==='REMOTE_OBJECT_EXACT_MATCH'&&object.remotePath&&object.expectedSha256&&object.expectedBytes>0,`${row.countyId}: invalid certified object`));
  const provenance={milestone:'LP210',countyFips:row.countyFips,countyName:row.countyName,countySlug:row.countySlug,remoteBucket:row.remoteBucket,remoteManifestPath:row.remoteManifestPath,remoteManifestBytes:row.remoteManifestBytes,remoteManifestSha256:row.remoteManifestSha256,remoteCertificationStatus:row.remoteCertificationStatus};
  if(row.partitionCount===1){const object=row.objects[0];return {status:'external_runtime',url:BASE+object.remotePath,version:'lp210',sha256:object.expectedSha256,expectedBytes:object.expectedBytes,featureCount:object.featureCount,lineGeometryCount:object.featureCount,runtimeClassification:'LP210_ACTIVATED',lp210:provenance};}
  return {status:'partition_runtime_ready',url:null,manifestUrl:BASE+row.remoteManifestPath,version:'lp210',packageVersion:'lp210',runtimeType:'lp210_certified_partition_manifest',partitionCount:row.partitionCount,partitions:row.objects.map(object=>({url:BASE+object.remotePath,remotePath:object.remotePath,expectedBytes:object.expectedBytes,sha256:object.expectedSha256,featureCount:object.featureCount})),runtimeClassification:'LP210_ACTIVATED',lp210:provenance};
}

export async function buildPlan(){
  const [runtimeText,publication,certificate,registry]=await Promise.all([readFile(join(ROOT,PATHS.runtime)),readJson(PATHS.publication),readJson(PATHS.certificate),readJson(PATHS.registry)]);
  for(const [key,value] of Object.entries({publicationCohortCount:226,publishedCountyCount:226,remoteCertifiedCountyCount:226,totalRemoteObjectCount:463,missingRemoteCount:0,failedRemoteCount:0,conflictingRemoteCount:0,runtimeActivations:0,productionRuntimeChanges:0,retrievalContractVerified:true,readiness:'READY_FOR_STATEWIDE_ROADWAY_RUNTIME_ACTIVATION'})) assert(publication[key]===value,`LP210 ${key} baseline mismatch`);
  const runtime=JSON.parse(runtimeText); const currentIds=Object.keys(runtime.counties); const incoming=certificate.counties;
  assert(incoming.length===226,'LP210 certificate must contain 226 counties');
  const postActive=currentIds.length===254;
  let existingIds;
  if(postActive){const evidence=await readJson(PATHS.activationManifest);const preserved=new Set(evidence.counties.filter(x=>x.classification==='EXISTING_PRESERVED').map(x=>x.countyId));existingIds=currentIds.filter(id=>preserved.has(id));}
  else {assert(currentIds.length===28,'runtime must be the 28-county baseline or exact LP211 target');assert(sha(runtimeText)===BEFORE_SHA,'pre-activation runtime SHA mismatch');existingIds=currentIds;}
  const incomingIds=incoming.map(x=>x.countyId); assert(new Set(incomingIds).size===226,'duplicate LP210 county IDs'); assert(new Set(incoming.map(x=>x.countyFips)).size===226,'duplicate LP210 FIPS'); assert(existingIds.every(id=>!incomingIds.includes(id)),'existing/incoming intersection is not zero');
  const identities=new Map(registry.identities.map(x=>[x.countyId,x])); assert(identities.size===254,'Texas registry must contain 254 identities'); [...existingIds,...incomingIds].forEach(id=>assert(identities.has(id),`unknown Texas identity ${id}`)); assert(new Set([...existingIds,...incomingIds]).size===254,'target union must contain 254 counties');
  const baselineEntries=postActive?Object.fromEntries(existingIds.map(id=>[id,runtime.counties[id]])):runtime.counties;
  const incomingEntries=Object.fromEntries(incoming.map(row=>[row.countyId,translateLp210County(row)]));
  const target={...runtime,contractVersion:runtime.contractVersion,generatedAt:'2026-08-17T00:00:00.000Z',counties:{...baselineEntries,...incomingEntries}};
  assert(Object.keys(target.counties).length===254,'target count is not 254'); existingIds.forEach(id=>assert(JSON.stringify(target.counties[id])===JSON.stringify(baselineEntries[id]),`${id}: protected entry changed`));
  const targetText=canonical(target),afterSha=sha(targetText);
  const counties=Object.entries(target.counties).map(([countyId,entry])=>{const identity=identities.get(countyId);return {countyFips:identity.fips,countyId,countyName:identity.countyName,classification:existingIds.includes(countyId)?'EXISTING_PRESERVED':'LP210_ACTIVATED',runtime:entry};}).sort((a,b)=>a.countyFips.localeCompare(b.countyFips));
  const counts={texasCountyCount:254,existingRuntimeBefore:28,incomingLp210Count:226,targetRuntimeCount:254,existingPreservedCount:28,lp210ActivatedCount:226,runtimeCountAfter:254,duplicateFips:0,duplicateCountyIds:0,missingTexasCount:0,extraCountyCount:0,singlePackageActiveCount:Object.values(target.counties).filter(x=>x.status!=='partition_runtime_ready').length,partitionedActiveCount:Object.values(target.counties).filter(x=>x.status==='partition_runtime_ready').length,localSourceActiveCount:Object.values(target.counties).filter(x=>x.status==='local_runtime').length,remoteSourceActiveCount:Object.values(target.counties).filter(x=>['external_runtime','partition_runtime_ready'].includes(x.status)).length,runtimeManifestSha256Before:BEFORE_SHA,runtimeManifestSha256After:afterSha,supabaseUploads:0,remoteMutations:0,databaseWrites:0};
  return {postActive,runtimeText,targetText,target,afterSha,counties,counts};
}
async function atomicWrite(path,content){const absolute=join(ROOT,path),temp=`${absolute}.lp211.tmp`;await mkdir(dirname(absolute),{recursive:true});await writeFile(temp,content);await rename(temp,absolute);}
export async function run(mode='WhatIf'){
  assert(['WhatIf','Apply','Verify'].includes(mode),'mode must be WhatIf, Apply, or Verify'); const beforeStats={}; for(const path of Object.values(PATHS)) try{beforeStats[path]=(await stat(join(ROOT,path))).mtimeMs}catch{}
  const plan=await buildPlan();
  if(mode==='Verify') assert(plan.postActive&&plan.runtimeText.equals(Buffer.from(plan.targetText)), 'Verify requires exact committed 254-county target');
  if(mode==='Apply'&&!plan.postActive){await atomicWrite(PATHS.runtime,plan.targetText);const activationManifest={schemaVersion:'gridly.lp211.runtime-activation-manifest.v1',generatedAt:'2026-08-17T00:00:00.000Z',counties:plan.counties};const report={schemaVersion:'gridly.lp211.runtime-activation.v1',generatedAt:'2026-08-17T00:00:00.000Z',mode:'Apply',...plan.counts,supabaseObjectsUploaded:0,remoteObjectsModified:0,remoteObjectsDeleted:0,databaseWrites:0,readiness:'STATEWIDE_ROADWAY_RUNTIME_ACTIVE'};await atomicWrite(PATHS.activationManifest,canonical(activationManifest));await atomicWrite(PATHS.activation,canonical(report));}
  if(mode!=='Apply'){for(const path of Object.values(PATHS)) try{assert((await stat(join(ROOT,path))).mtimeMs===beforeStats[path],`${mode} wrote ${path}`)}catch(error){if(beforeStats[path]!==undefined)throw error;}}
  return {...plan.counts,mode,alreadyActive:plan.postActive,readiness:mode==='WhatIf'?'READY_FOR_STATEWIDE_ROADWAY_RUNTIME_APPLY':'STATEWIDE_ROADWAY_RUNTIME_ACTIVE'};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const arg=process.argv.find(x=>x.startsWith('--mode='));const mode=arg?arg.split('=')[1]:'WhatIf';run(mode).then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(`LP211 blocked: ${error.message}`);process.exitCode=1;});}
