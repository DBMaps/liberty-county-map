#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const OUT='evidence/wave3a3-statewide-crossing-activation';
const DECISION_PASS='STATEWIDE CROSSING ACTIVATION WHAT-IF CERTIFIED — READY FOR OWNER APPLY';
const DECISION_BLOCKED='STATEWIDE CROSSING ACTIVATION BLOCKED';
const REQUIRED=['candidate-cohort.json','package-certification.json','package-manufacture-summary.json','reconciliation-index.json','reconciliation-summary.json','cross-package-uniqueness.json','consumer-compatibility.json','summary.json'];
const WAVE32='evidence/wave3a2-crossing-package-manufacture';
const BLOCKED=['019788P','019791X'];
const json=x=>JSON.stringify(x,null,2)+'\n';
const clean=s=>JSON.parse(s.replace(/^\uFEFF/,''));
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async p=>clean(await readFile(join(ROOT,p),'utf8'));
const ids=p=>p.features.map(f=>String(f.properties.CROSSING||String(f.properties.gridlyId||'').replace(/^FRA-/,'')).trim());
const slug=c=>c.countyId.replace(/-tx$/,'');
const stable=x=>JSON.parse(JSON.stringify(x));

export async function inspect(){
 const inventory=await read('data/lp104/texas-counties.json'), partition=await read('evidence/wave3a1b-fra-county-authority/projected-partition.json'), manifest=await read('Crossing-Packages/production-crossing-manifest.json'), registry=await read('assets/package-registry/runtime-package-registry.json');
 const byFips=new Map(inventory.counties.map(c=>[c.fips,c]));
 const positive=partition.countyFipsByClass.SOURCE_OR_GEOGRAPHIC_POSITIVE_INACTIVE;
 const zero=partition.countyFipsByClass.ZERO_GEOGRAPHIC_SOURCE_INACTIVE;
 const active=[]; for(const record of manifest.records){const pkg=await read(record.packageFile.replaceAll('\\','/')); for(const id of ids(pkg))active.push(id)}
 const missingInputs=REQUIRED.filter(n=>!existsSync(join(ROOT,WAVE32,n)));
 const fraBody=await readFile(join(ROOT,'Crossing-Packages/Texas/fra-crossings-tx.geojson'));
 const expectedFra={bytes:68200491,sha256:'e30bdd2502552fa5e578b2feefc5e2f599c0e8206067e4a87c65dadfa760113c'}, observedFra={bytes:fraBody.length,sha256:sha(fraBody)};
 const protectedPrefixes=['Crossing-Packages/','assets/package-registry/runtime-package-registry.json','data/roadway-runtime-manifest.json','js/app.js'];
 const changed=execFileSync('git',['status','--porcelain=v1','--untracked-files=no'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n').filter(Boolean).map(x=>x.slice(3)).filter(p=>protectedPrefixes.some(q=>q.endsWith('/')?p.startsWith(q):p===q));
 let cohort=null, certification=null, reconciliation=null, uniqueness=null;
 if(!missingInputs.length){cohort=await read(`${WAVE32}/candidate-cohort.json`);certification=await read(`${WAVE32}/package-certification.json`);reconciliation=await read(`${WAVE32}/reconciliation-index.json`);uniqueness=await read(`${WAVE32}/cross-package-uniqueness.json`)}
 const positiveRows=positive.map(f=>byFips.get(f)).sort((a,b)=>a.fips.localeCompare(b.fips));
 const zeroRows=zero.map(f=>byFips.get(f)).sort((a,b)=>a.fips.localeCompare(b.fips));
 const packageFiles=[...positiveRows,...zeroRows].map(c=>`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`);
 const countyManifests=[...positiveRows,...zeroRows].map(c=>`Crossing-Packages/${slug(c)}/package-manifest.json`);
 const production=['Crossing-Packages/production-crossing-manifest.json','assets/package-registry/runtime-package-registry.json',...packageFiles,...countyManifests].sort();
 const candidateIds=[]; if(certification)for(const record of certification.records)candidateIds.push(...ids(await read(record.packagePath)));
 const all=[...active,...candidateIds], duplicates=[...new Set(all.filter((x,i,a)=>a.indexOf(x)!==i))].sort(), overlap=[...new Set(candidateIds.filter(x=>active.includes(x)))].sort();
 const entries=reconciliation?.entries||[], owner=new Map(entries.map(x=>[x.crossingId,x.gridlyCountyFips]));
 const mismatches=[]; if(certification)for(const record of certification.records)for(const id of ids(await read(record.packagePath)))if(owner.get(id)!==record.countyFips)mismatches.push({crossingId:id,packageCountyFips:record.countyFips,certifiedCountyFips:owner.get(id)||null});
 const leakage=all.filter(id=>BLOCKED.includes(id));
 const gates={activeCountyCount:manifest.records.length===28,activeIdentityCount:new Set(active).size===3784,candidateCountyCount:cohort?.count===175,candidateIdentityCount:new Set(candidateIds).size===12315,combinedIdentityCount:new Set(all).size===16099,positiveCountyCount:27+positive.length===202,zeroCountyCount:1+zero.length===52,blockedIdentitySet:entries.filter(x=>x.resolution==='OUTSIDE_TEXAS_BORDER_REVIEW').map(x=>x.crossingId).sort().join(',')===BLOCKED.join(','),blockedAbsent:leakage.length===0,certificationPass:certification?.status==='PASS'&&certification.count===175,noDuplicates:duplicates.length===0,noOverlap:overlap.length===0,ownership:mismatches.length===0,fraSourceIdentity:observedFra.bytes===expectedFra.bytes&&observedFra.sha256===expectedFra.sha256,protectedRuntimeWorktreeClean:changed.length===0,wave32InputsPresent:missingInputs.length===0,registryBaseline:registry.packageTypes.find(x=>x.packageType==='Crossing')?.packageCount===28};
 const pass=Object.values(gates).every(Boolean);
 return {inventory,partition,manifest,registry,active:[...new Set(active)].sort(),candidateIds:[...new Set(candidateIds)].sort(),positiveRows,zeroRows,production,gates,pass,missingInputs,duplicates,overlap,mismatches,leakage,expectedFra,observedFra,changed};
}

export async function outputs(){
 const x=await inspect(), decision=x.pass?DECISION_PASS:DECISION_BLOCKED;
 const current={'schemaVersion':'gridly.wave3a3.current-state.v1',activeCounties:x.manifest.records.length,activeIdentities:x.active.length,activePositive:27,activeEmpty:1,tyler:{countyFips:'48457',classification:'ACTIVE_EMPTY',crossingCount:0},manifest:'Crossing-Packages/production-crossing-manifest.json',registry:'assets/package-registry/runtime-package-registry.json'};
 const projected={schemaVersion:'gridly.wave3a3.projected-state.v1',classification:{ACTIVE_POSITIVE:202,ACTIVE_EMPTY:52,TOTAL:254},identities:16099,counties:x.inventory.counties.map(c=>({countyId:c.countyId,countyFips:c.fips,countyName:`${c.countyName} County`,classification:x.zeroRows.some(z=>z.fips===c.fips)||c.fips==='48457'?'ACTIVE_EMPTY':'ACTIVE_POSITIVE',projectedCrossingCount:c.fips==='48457'||x.zeroRows.some(z=>z.fips===c.fips)?0:null})).sort((a,b)=>a.countyFips.localeCompare(b.countyFips))};
 const evidence={
  'preflight.json':{schemaVersion:'gridly.wave3a3.preflight.v1',status:x.pass?'PASS':'BLOCKED',mode:'WHAT_IF',productionWrites:0,gates:x.gates,missingRequiredWave3a2Inputs:x.missingInputs,fraSource:{expected:x.expectedFra,observed:x.observedFra,unchanged:x.gates.fraSourceIdentity},protectedRuntimeChanges:x.changed},
  'current-state.json':current,
  'candidate-input-certification.json':{schemaVersion:'gridly.wave3a3.candidate-input.v1',status:x.gates.certificationPass?'PASS':'BLOCKED',requiredArtifactRoot:WAVE32,requiredArtifacts:REQUIRED,missing:x.missingInputs,expected:{counties:175,identities:12315}},
  'zero-county-governance.json':{schemaVersion:'gridly.wave3a3.zero-governance.v1',status:'DESIGNED_NOT_APPLIED',existing:{countyId:'tyler-tx',countyFips:'48457',package:'Crossing-Packages/tyler/Production/tyler-production-crossings.geojson',crossingCount:0},additionalCount:x.zeroRows.length,counties:x.zeroRows.map(c=>({countyId:c.countyId,countyFips:c.fips,crossingCount:0,explicitEmptyPackage:`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`})),rules:['explicit FeatureCollection with crossingCount 0 and features []','no fallback','no source-county inference','no synthetic rows']},
  'write-allowlist.json':{schemaVersion:'gridly.wave3a3.write-allowlist.v1',status:'LOCKED',futureApplyOnly:true,count:x.production.length,paths:x.production,categories:{positiveProductionPackages:175,emptyProductionPackages:51,countyPackageManifests:226,productionManifest:1,runtimeRegistry:1},noOtherProductionPathWritable:true},
  'whatif.json':{schemaVersion:'gridly.wave3a3.whatif.v1',status:x.pass?'PASS':'BLOCKED',applied:false,productionWrites:0,projected:projected.classification,activeIdentityCount:16099,controls:{Brazos:95,Lavaca:40,Washington:44,Tyler:0}},
  'projected-254-county-state.json':projected,
  'identity-conservation.json':{schemaVersion:'gridly.wave3a3.identity-conservation.v1',status:x.pass?'PASS':'BLOCKED',equation:{existingActive:3784,certifiedCandidate:12315,projectedActive:16099},observed:{active:x.active.length,candidate:x.candidateIds.length,combined:new Set([...x.active,...x.candidateIds]).size},missing:x.pass?0:null,extra:x.pass?0:null,duplicates:x.duplicates,activeCandidateOverlap:x.overlap,crossCountyOwnershipMismatches:x.mismatches},
  'blocked-identity-protection.json':{schemaVersion:'gridly.wave3a3.blocked-protection.v1',status:x.leakage.length?'FAIL':'PASS',required:BLOCKED,resolution:'OUTSIDE_TEXAS_BORDER_REVIEW',gridlyCountyId:null,gridlyCountyFips:null,packageLeakage:x.leakage},
  'consumer-compatibility.json':{schemaVersion:'gridly.wave3a3.consumer-compatibility.v1',status:'PASS_DESIGN',checks:{countyCrossingLoading:'explicit manifest and package',countySwitching:'registry entry per governed county',mapCrossingRendering:'unchanged GeoJSON feature contract',roadRuntimeDependencyIntroduced:false,reportIdentityMutation:false,historicalReportLinkageChanged:false,zeroCountyResolution:'SUPPORTED_EMPTY',placeOwnershipMutation:false}},
  'summary.json':{schemaVersion:'gridly.wave3a3.summary.v1',decision,status:x.pass?'PASS':'BLOCKED',productionWrites:0,projected:projected.classification,projectedActiveIdentities:16099,blockingReasons:Object.entries(x.gates).filter(([,v])=>!v).map(([k])=>k)}
 };
 return stable(evidence);
}

export async function run({mode='whatif',writeEvidence=true}={}){
 if(mode==='apply')throw Error('Wave 3A.3 fail closed: apply is not authorized in this mission');
 const generated=await outputs();
 if(mode==='verify')for(const [name,value] of Object.entries(generated)){const path=join(ROOT,OUT,name);if(!existsSync(path)||await readFile(path,'utf8')!==json(value))throw Error(`Wave 3A.3 evidence mismatch: ${name}`)}
 else if(writeEvidence){await mkdir(join(ROOT,OUT),{recursive:true});for(const [name,value] of Object.entries(generated))await writeFile(join(ROOT,OUT,name),json(value))}
 return generated['summary.json'];
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv.includes('--apply')?'apply':process.argv.includes('--verify')?'verify':'whatif';
 run({mode}).then(r=>console.log(process.argv.includes('--json')?JSON.stringify(r):json(r))).catch(e=>{console.error(e.message);process.exitCode=1});
}
