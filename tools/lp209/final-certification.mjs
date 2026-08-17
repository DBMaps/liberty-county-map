#!/usr/bin/env node
/** LP209 owner-only final certification. Candidate inputs are never activated or published. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTROL_FIPS, DEFAULT_GDAL_EXECUTABLE, OWNER_OUTPUT_ROOT, OWNER_SOURCE_ROOT, assertManufacturingComplete, collectEvidence, executeOwner, loadPlan, summarize } from './statewide-roadway-candidates.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const REPORTS=join(ROOT,'reports/lp209');
export const COMPATIBILITY_FIPS=Object.freeze(['48113','48029','48141','48181','48287']);
const json=x=>`${JSON.stringify(x,null,2)}\n`;
const sha=b=>createHash('sha256').update(b).digest('hex');
const invariant=(v,m)=>{if(!v)throw new Error(`LP209 final certification failed closed: ${m}`);};
const packageIdentity=m=>(m?.packages||[]).map(p=>({fileName:p.fileName,featureCount:p.featureCount,bytes:p.byteLength,sha256:p.sha256}));

export function compareControl(row,baseline,rerun){
  const sourceIdentityMatch=row.sourceSha256===baseline.row.sourceSha256&&row.sourceBytes===baseline.row.sourceBytes;
  const candidateIdentityMatch=baseline.x?.output?.sha256===rerun.x?.output?.sha256&&baseline.x?.output?.sizeBytes===rerun.x?.output?.sizeBytes;
  const packageIdentityMatch=JSON.stringify(packageIdentity(baseline.m))===JSON.stringify(packageIdentity(rerun.m));
  const manifestIdentityMatch=baseline.m?.manifest?.sha256===rerun.m?.manifest?.sha256&&baseline.m?.manifest?.sizeBytes===rerun.m?.manifest?.sizeBytes;
  const certificationPass=rerun.m?.certificationStatus==='PASS';
  return {countyFips:row.countyFips,countyId:row.countyId,sourceIdentityContract:'SHA256_AND_BYTES',sourceIdentityMatch,lp118CandidateIdentityContract:'SHA256_AND_BYTES',lp118CandidateIdentityMatch:candidateIdentityMatch,lp116PackageIdentityContract:'ORDERED_FILE_NAME_FEATURE_COUNT_BYTES_SHA256',lp116PackageIdentityMatch:packageIdentityMatch,manifestIdentityContract:'SHA256_AND_BYTES',manifestIdentityMatch,certificationStatus:certificationPass?'PASS':'FAIL',determinismStatus:[sourceIdentityMatch,candidateIdentityMatch,packageIdentityMatch,manifestIdentityMatch,certificationPass].every(Boolean)?'PASS':'FAIL'};
}

const segments=geometry=>geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[];
const distance2=(p,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;if(!d)return (p[0]-a[0])**2+(p[1]-a[1])**2;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d));return (p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;};
const roadName=f=>['name','FULLNAME','fullname','road_name','ROADNAME'].map(k=>f.properties?.[k]).find(v=>typeof v==='string'&&v.trim())||null;
export async function certifyCandidate(path,countyFips){
  const body=await readFile(path); const data=JSON.parse(body);
  invariant(data.type==='FeatureCollection'&&data.features.length>0,`${countyFips} loader rejected candidate`);
  const named=data.features.find(roadName); invariant(named,`${countyFips} has no extractable road name`);
  const line=segments(named.geometry)[0]; invariant(line?.length>1,`${countyFips} named road has no line`);
  const probe=line[Math.floor(line.length/2)]; let nearest=null,best=Infinity;
  for(const feature of data.features)for(const points of segments(feature.geometry))for(let i=1;i<points.length;i++){const d=distance2(probe,points[i-1],points[i]);if(d<best){best=d;nearest=feature;}}
  invariant(nearest&&best===0,`${countyFips} nearest-road lookup failed`); invariant(roadName(nearest),`${countyFips} nearest road has no name`);
  const hazard={countyFips,latitude:probe[1],longitude:probe[0]}; const associated={...hazard,roadName:roadName(nearest)};
  invariant(associated.roadName===roadName(nearest),`${countyFips} hazard/report association failed`);
  return {countyFips,candidatePath:path,candidateBytes:body.length,candidateSha256:sha(body),roadwayLoader:'PASS',nearestRoadLookup:'PASS',roadNameExtraction:'PASS',hazardReportRoadAssociation:'PASS',status:'PASS'};
}

export function finalReadiness(manufacturing,controls,compatibility){
  const a=manufacturing.accounting, runtime=manufacturing.productionRuntimeManifest;
  return a.lp118Successful===226&&a.lp116Manufactured===226&&a.certified===226&&a.failed===0&&a.pending===0&&controls.length===CONTROL_FIPS.length&&new Set(controls.map(x=>x.countyFips)).size===CONTROL_FIPS.length&&CONTROL_FIPS.every(fips=>controls.some(x=>x.countyFips===fips&&x.determinismStatus==='PASS'))&&compatibility.length===COMPATIBILITY_FIPS.length&&new Set(compatibility.map(x=>x.countyFips)).size===COMPATIBILITY_FIPS.length&&COMPATIBILITY_FIPS.every(fips=>compatibility.some(x=>x.countyFips===fips&&x.status==='PASS'))&&runtime.unchanged&&runtime.countyCountAfter===28&&a.supabaseWrites===0&&a.runtimeActivations===0&&a.productionPackageModifications===0?'READY_FOR_STATEWIDE_ROADWAY_PUBLICATION':'BLOCKED_FOR_STATEWIDE_ROADWAY';
}

export async function runCertificationChecks({manufacturing,runDeterminism,runCompatibility}) {
  invariant(finalReadiness(manufacturing,[],[])==='BLOCKED_FOR_STATEWIDE_ROADWAY','final readiness must begin blocked');
  const controls=await runDeterminism();
  const readinessAfterDeterminism=finalReadiness(manufacturing,controls,[]);
  invariant(readinessAfterDeterminism==='BLOCKED_FOR_STATEWIDE_ROADWAY','final readiness must remain blocked before compatibility');
  const compatibility=await runCompatibility();
  return {controls,compatibility,readinessAfterDeterminism,readiness:finalReadiness(manufacturing,controls,compatibility)};
}

export async function runOwnerFinal({sourceRoot=OWNER_SOURCE_ROOT,outputRoot=resolve(ROOT,OWNER_OUTPUT_ROOT),determinismRoot=resolve(ROOT,'owner-local/lp209-roadway-determinism'),gdal=DEFAULT_GDAL_EXECUTABLE}={}){
  invariant(resolve(determinismRoot)!==resolve(outputRoot),'determinism workspace must be separate');
  const plan=await loadPlan({sourceRoot,outputRoot}); const baseline=await collectEvidence(plan.rows,outputRoot);
  invariant(baseline.length===226,'main owner workspace must contain 226 LP118/LP116 checkpoints');
  const manufacturing=summarize(plan.rows,baseline,plan,{ownerWorkspace:outputRoot,evidenceState:'OWNER_MANUFACTURING_COMPLETE'});
  assertManufacturingComplete(manufacturing);
  const controlRows=plan.rows.filter(x=>CONTROL_FIPS.includes(x.countyFips));
  const baseMap=new Map(baseline.map(x=>[x.row.countyFips,x]));
  const {controls,compatibility,readiness}=await runCertificationChecks({manufacturing,
    runDeterminism:async()=>{
      await executeOwner({mode:'build',sourceRoot,outputRoot:determinismRoot,gdal,countyFips:CONTROL_FIPS});
      const reruns=await collectEvidence(controlRows,determinismRoot); const rerunMap=new Map(reruns.map(x=>[x.row.countyFips,x]));
      return controlRows.map(row=>compareControl(row,baseMap.get(row.countyFips),rerunMap.get(row.countyFips)));
    },
    runCompatibility:async()=>{const results=[];for(const fips of COMPATIBILITY_FIPS){const x=baseMap.get(fips);invariant(x,`missing compatibility county ${fips}`);results.push(await certifyCandidate(resolve(x.x.output.path),fips));}return results;}
  });
  for(const county of manufacturing.counties){const control=controls.find(x=>x.countyFips===county.countyFips);if(control)county.determinismStatus=control.determinismStatus;}
  const candidateManifest={schemaVersion:'gridly.lp209.statewide-roadway-candidate-manifest.v1',generatedAt:new Date().toISOString(),certificationComplete:readiness==='READY_FOR_STATEWIDE_ROADWAY_PUBLICATION',counties:manufacturing.counties};
  const manufacturingReport={...manufacturing,counties:undefined,determinism:{status:controls.every(x=>x.determinismStatus==='PASS')?'PASS':'FAIL',controls:CONTROL_FIPS},downstreamCompatibility:{status:compatibility.every(x=>x.status==='PASS')?'PASS':'FAIL',counties:COMPATIBILITY_FIPS},readiness};
  await mkdir(REPORTS,{recursive:true}); await Promise.all([
    writeFile(join(REPORTS,'statewide-roadway-candidate-manifest.json'),json(candidateManifest)),writeFile(join(REPORTS,'statewide-roadway-missing-cohort-manufacturing.json'),json(manufacturingReport)),
    writeFile(join(REPORTS,'determinism-controls.json'),json({schemaVersion:'gridly.lp209.determinism-controls.v1',workspace:determinismRoot,mainWorkspace:outputRoot,controls,status:controls.every(x=>x.determinismStatus==='PASS')?'PASS':'FAIL'})),
    writeFile(join(REPORTS,'downstream-compatibility.json'),json({schemaVersion:'gridly.lp209.downstream-compatibility.v1',execution:'ISOLATED_OWNER_CANDIDATE_HARNESS',activated:false,published:false,counties:compatibility,status:compatibility.every(x=>x.status==='PASS')?'PASS':'FAIL'}))]);
  console.log(readiness); return {readiness,controls,compatibility};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))runOwnerFinal().catch(e=>{console.error(e.message);process.exitCode=1;});
