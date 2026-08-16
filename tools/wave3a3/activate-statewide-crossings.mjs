#!/usr/bin/env node
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdir,readFile,rename,rm,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const DEFAULT_ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const OUT='evidence/wave3a3-statewide-crossing-activation';
const WAVE32='evidence/wave3a2-crossing-package-manufacture';
const DECISION_PASS='STATEWIDE CROSSING ACTIVATION WHAT-IF CERTIFIED — READY FOR OWNER APPLY';
const DECISION_BLOCKED='STATEWIDE CROSSING ACTIVATION BLOCKED';
const DECISION_APPLIED='STATEWIDE CROSSING ACTIVATION APPLIED / VERIFIED';
const REQUIRED=['candidate-cohort.json','package-certification.json','package-manufacture-summary.json','reconciliation-index.json','reconciliation-summary.json','cross-package-uniqueness.json','consumer-compatibility.json','summary.json'];
const BLOCKED=['019788P','019791X'];
const FRA={bytes:68200491,sha256:'e30bdd2502552fa5e578b2feefc5e2f599c0e8206067e4a87c65dadfa760113c'};
const json=x=>JSON.stringify(x,null,2)+'\n';
const clean=s=>JSON.parse(s.replace(/^\uFEFF/,''));
const sha=b=>createHash('sha256').update(b).digest('hex');
const stable=x=>JSON.parse(JSON.stringify(x));
const slug=c=>c.countyId.replace(/-tx$/,'');
const ids=p=>(p.features||[]).map(f=>String(f.properties?.CROSSING||String(f.properties?.gridlyId||'').replace(/^FRA-/,'')).trim());
const portable=p=>p.replaceAll('\\','/');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=m=>{throw Error(`Wave 3A.3 fail closed: ${m}`)};

/** The certified path contract is JavaScript's locale-independent UTF-16 ordering. */
export const sortGovernedPaths=paths=>[...paths].sort();
export const governedPathOrderMatches=(actual,certified)=>same(actual,certified);
export function orderGovernedWrites(writes){
 return new Map(sortGovernedPaths(writes.keys()).map(path=>[path,writes.get(path)]));
}

/**
 * Return the governed candidate byte stream. Git may materialize an LF blob with
 * CRLF in a Windows working tree; no other byte (including a lone CR) is changed.
 */
export function canonicalCandidateBytes(body){
 if(!Buffer.isBuffer(body))throw new TypeError('candidate body must be a Buffer');
 let crlf=0;for(let i=0;i<body.length-1;i++)if(body[i]===13&&body[i+1]===10){crlf++;i++}
 if(!crlf)return body;
 const canonical=Buffer.allocUnsafe(body.length-crlf);let out=0;
 for(let i=0;i<body.length;i++){if(body[i]===13&&body[i+1]===10)continue;canonical[out++]=body[i]}
 return canonical;
}

export function certifiedCandidateBytes(body,record){
 const canonical=canonicalCandidateBytes(body);
 if(canonical.length!==record.bytes||sha(canonical)!==record.sha256)fail(`candidate byte identity differs for ${record.countyFips||record.packagePath||'unknown package'}`);
 return canonical;
}

function git(root,args){return execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim()}
async function read(root,p){return clean(await readFile(join(root,p),'utf8'))}
async function raw(root,p){return readFile(join(root,p))}
function governedPaths(positiveRows,zeroRows){
 const rows=[...positiveRows,...zeroRows];
 return sortGovernedPaths(['Crossing-Packages/production-crossing-manifest.json','assets/package-registry/runtime-package-registry.json',...rows.map(c=>`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`),...rows.map(c=>`Crossing-Packages/${slug(c)}/package-manifest.json`)]);
}

export async function inspect({root=DEFAULT_ROOT}={}){
 const inventory=await read(root,'data/lp104/texas-counties.json'),partition=await read(root,'evidence/wave3a1b-fra-county-authority/projected-partition.json'),manifest=await read(root,'Crossing-Packages/production-crossing-manifest.json'),registry=await read(root,'assets/package-registry/runtime-package-registry.json');
 const byFips=new Map(inventory.counties.map(c=>[c.fips,c]));
 const positiveRows=partition.countyFipsByClass.SOURCE_OR_GEOGRAPHIC_POSITIVE_INACTIVE.map(f=>byFips.get(f)).sort((a,b)=>a.fips.localeCompare(b.fips));
 const zeroRows=partition.countyFipsByClass.ZERO_GEOGRAPHIC_SOURCE_INACTIVE.map(f=>byFips.get(f)).sort((a,b)=>a.fips.localeCompare(b.fips));
 const active=[];for(const record of manifest.records)active.push(...ids(await read(root,portable(record.packageFile))));
 const missingInputs=REQUIRED.filter(n=>!existsSync(join(root,WAVE32,n)));
 const fraBody=await raw(root,'Crossing-Packages/Texas/fra-crossings-tx.geojson'),observedFra={bytes:fraBody.length,sha256:sha(fraBody)};
 const protectedPrefixes=['Crossing-Packages/','assets/package-registry/runtime-package-registry.json','data/roadway-runtime-manifest.json','js/app.js'];
 const changed=git(root,['status','--porcelain=v1','--untracked-files=no']).split('\n').filter(Boolean).map(x=>x.slice(3)).filter(p=>protectedPrefixes.some(q=>q.endsWith('/')?p.startsWith(q):p===q));
 let cohort=null,certification=null,reconciliation=null,uniqueness=null,manufacture=null,reconciliationSummary=null;
 if(!missingInputs.length){[cohort,certification,reconciliation,uniqueness,manufacture,reconciliationSummary]=await Promise.all(['candidate-cohort.json','package-certification.json','reconciliation-index.json','cross-package-uniqueness.json','package-manufacture-summary.json','reconciliation-summary.json'].map(n=>read(root,`${WAVE32}/${n}`)))}
 const candidateIds=[],candidateProblems=[];
 if(certification)for(const record of certification.records){const body=canonicalCandidateBytes(await raw(root,record.packagePath)),pkg=clean(body.toString());candidateIds.push(...ids(pkg));if(body.length!==record.bytes||sha(body)!==record.sha256||pkg.features.length!==record.crossingCount||record.status!=='PASS'||record.geographicOwnership!==true||record.sourcePropertiesPreserved!==true)candidateProblems.push(record.countyFips)}
 const entries=reconciliation?.entries||[],owner=new Map(entries.map(x=>[x.crossingId,x.gridlyCountyFips]));
 const all=[...active,...candidateIds],duplicates=[...new Set(all.filter((x,i,a)=>a.indexOf(x)!==i))].sort(),overlap=[...new Set(candidateIds.filter(x=>active.includes(x)))].sort();
 const mismatches=[];if(certification)for(const record of certification.records)for(const id of ids(await read(root,record.packagePath)))if(owner.get(id)!==record.countyFips)mismatches.push({crossingId:id,packageCountyFips:record.countyFips,certifiedCountyFips:owner.get(id)||null});
 const assigned=new Set(entries.filter(x=>x.gridlyCountyFips).map(x=>x.crossingId)),combined=new Set(all),missing=[...assigned].filter(x=>!combined.has(x)).sort(),extra=[...combined].filter(x=>!assigned.has(x)).sort(),leakage=all.filter(id=>BLOCKED.includes(id));
 const production=governedPaths(positiveRows,zeroRows);
 const gates={activeCountyCount:manifest.records.length===28,activeIdentityCount:new Set(active).size===3784,candidateCountyCount:cohort?.count===175&&positiveRows.length===175,candidateIdentityCount:new Set(candidateIds).size===12315,combinedIdentityCount:combined.size===16099,positiveCountyCount:27+positiveRows.length===202,zeroCountyCount:1+zeroRows.length===52,blockedIdentitySet:same(entries.filter(x=>x.resolution==='OUTSIDE_TEXAS_BORDER_REVIEW').map(x=>x.crossingId).sort(),BLOCKED),blockedAbsent:leakage.length===0,certificationPass:certification?.status==='PASS'&&certification.count===175&&candidateProblems.length===0,noDuplicates:duplicates.length===0,noMissing:missing.length===0,noExtra:extra.length===0,noOverlap:overlap.length===0,ownership:mismatches.length===0,fraSourceIdentity:same(observedFra,FRA),protectedRuntimeWorktreeClean:changed.length===0,wave32InputsPresent:missingInputs.length===0,wave32CompleteDeterministic:manufacture?.allPass===true&&manufacture.candidatePackages===175&&manufacture.candidateRows===12315&&reconciliationSummary?.duplicates===0&&uniqueness?.status==='PASS',registryBaseline:registry.packageTypes.find(x=>x.packageType==='Crossing')?.packageCount===28,writeAllowlistCount:production.length===454};
 return {root,inventory,partition,manifest,registry,active:[...new Set(active)].sort(),candidateIds:[...new Set(candidateIds)].sort(),positiveRows,zeroRows,production,gates,pass:Object.values(gates).every(Boolean),missingInputs,duplicates,missing,extra,overlap,mismatches,leakage,candidateProblems,expectedFra:FRA,observedFra,changed,certification,reconciliation};
}

function evidenceFor(x){
 const projected={schemaVersion:'gridly.wave3a3.projected-state.v1',classification:{ACTIVE_POSITIVE:202,ACTIVE_EMPTY:52,TOTAL:254},identities:16099,counties:x.inventory.counties.map(c=>({countyId:c.countyId,countyFips:c.fips,countyName:`${c.countyName} County`,classification:x.zeroRows.some(z=>z.fips===c.fips)||c.fips==='48457'?'ACTIVE_EMPTY':'ACTIVE_POSITIVE',projectedCrossingCount:c.fips==='48457'||x.zeroRows.some(z=>z.fips===c.fips)?0:null})).sort((a,b)=>a.countyFips.localeCompare(b.countyFips))};
 const status=x.pass?'PASS':'BLOCKED';
 return {
  'preflight.json':{schemaVersion:'gridly.wave3a3.preflight.v1',status,mode:'WHAT_IF',productionWrites:0,gates:x.gates,missingRequiredWave3a2Inputs:x.missingInputs,fraSource:{expected:FRA,observed:x.observedFra,unchanged:x.gates.fraSourceIdentity},protectedRuntimeChanges:x.changed},
  'current-state.json':{schemaVersion:'gridly.wave3a3.current-state.v1',activeCounties:x.manifest.records.length,activeIdentities:x.active.length,activePositive:27,activeEmpty:1,tyler:{countyFips:'48457',classification:'ACTIVE_EMPTY',crossingCount:0},manifest:'Crossing-Packages/production-crossing-manifest.json',registry:'assets/package-registry/runtime-package-registry.json'},
  'candidate-input-certification.json':{schemaVersion:'gridly.wave3a3.candidate-input.v1',status:x.gates.certificationPass?'PASS':'BLOCKED',requiredArtifactRoot:WAVE32,requiredArtifacts:REQUIRED,missing:x.missingInputs,expected:{counties:175,identities:12315}},
  'zero-county-governance.json':{schemaVersion:'gridly.wave3a3.zero-governance.v1',status:'DESIGNED_NOT_APPLIED',existing:{countyId:'tyler-tx',countyFips:'48457',package:'Crossing-Packages/tyler/Production/tyler-production-crossings.geojson',crossingCount:0},additionalCount:x.zeroRows.length,counties:x.zeroRows.map(c=>({countyId:c.countyId,countyFips:c.fips,crossingCount:0,explicitEmptyPackage:`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`})),rules:['explicit FeatureCollection with crossingCount 0 and features []','no fallback','no source-county inference','no synthetic rows']},
  'write-allowlist.json':{schemaVersion:'gridly.wave3a3.write-allowlist.v1',status:'LOCKED',futureApplyOnly:true,count:x.production.length,paths:x.production,categories:{positiveProductionPackages:175,emptyProductionPackages:51,countyPackageManifests:226,productionManifest:1,runtimeRegistry:1},noOtherProductionPathWritable:true},
  'whatif.json':{schemaVersion:'gridly.wave3a3.whatif.v1',status,applied:false,productionWrites:0,projected:projected.classification,activeIdentityCount:16099,controls:{Brazos:95,Lavaca:40,Washington:44,Tyler:0}},
  'projected-254-county-state.json':projected,
  'identity-conservation.json':{schemaVersion:'gridly.wave3a3.identity-conservation.v1',status,equation:{existingActive:3784,certifiedCandidate:12315,projectedActive:16099},observed:{active:x.active.length,candidate:x.candidateIds.length,combined:new Set([...x.active,...x.candidateIds]).size},missing:x.missing,extra:x.extra,duplicates:x.duplicates,activeCandidateOverlap:x.overlap,crossCountyOwnershipMismatches:x.mismatches},
  'blocked-identity-protection.json':{schemaVersion:'gridly.wave3a3.blocked-protection.v1',status:x.leakage.length?'FAIL':'PASS',required:BLOCKED,resolution:'OUTSIDE_TEXAS_BORDER_REVIEW',gridlyCountyId:null,gridlyCountyFips:null,packageLeakage:x.leakage},
  'consumer-compatibility.json':{schemaVersion:'gridly.wave3a3.consumer-compatibility.v1',status:'PASS_DESIGN',checks:{countyCrossingLoading:'explicit manifest and package',countySwitching:'registry entry per governed county',mapCrossingRendering:'unchanged GeoJSON feature contract',roadRuntimeDependencyIntroduced:false,reportIdentityMutation:false,historicalReportLinkageChanged:false,zeroCountyResolution:'SUPPORTED_EMPTY',placeOwnershipMutation:false}},
  'summary.json':{schemaVersion:'gridly.wave3a3.summary.v1',decision:x.pass?DECISION_PASS:DECISION_BLOCKED,status,productionWrites:0,projected:projected.classification,projectedActiveIdentities:16099,blockingReasons:Object.entries(x.gates).filter(([,v])=>!v).map(([k])=>k)}
 };
}

export async function outputs(options={}){return stable(evidenceFor(await inspect(options)))}

async function requireCommittedCertification(root,x){
 const summaryPath=`${OUT}/summary.json`,allowPath=`${OUT}/write-allowlist.json`;
 if(!existsSync(join(root,summaryPath))||!existsSync(join(root,allowPath)))fail('committed owner-current certification is absent');
 const summary=await read(root,summaryPath),allow=await read(root,allowPath);
 const expected={status:'PASS',decision:DECISION_PASS,productionWrites:0,projected:{ACTIVE_POSITIVE:202,ACTIVE_EMPTY:52,TOTAL:254},projectedActiveIdentities:16099,blockingReasons:[]};
 for(const [key,value] of Object.entries(expected))if(!same(summary[key],value))fail(`certified summary gate ${key}`);
 if(allow.count!==454||!governedPathOrderMatches(allow.paths,x.production)||new Set(allow.paths).size!==454)fail('certified write allowlist differs from planned ordered write set');
 try{if(!git(root,['ls-files','--error-unmatch',summaryPath])||!git(root,['ls-files','--error-unmatch',allowPath]))fail('certification is not committed');git(root,['diff','--quiet','HEAD','--',`${OUT}/`])}catch{fail('certification evidence is not owner-current and committed')}
 return {summary,allow};
}

function packageManifest(c,count){return {packageType:'Crossing',county:c.countyName,status:'manufactured',source:'FRA/Processed/fra-crossings-tx.geojson',packageFile:`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`,crossingCount:count}}
function zeroPackage(c){return {type:'FeatureCollection',packageType:'Crossing',county:c.countyName,source:'FRA/Processed/fra-crossings-tx.geojson',crossingCount:0,features:[]}}

async function prepareWrites(x){
 const writes=new Map(),byFips=new Map(x.inventory.counties.map(c=>[c.fips,c])),candidateByFips=new Map(x.certification.records.map(r=>[r.countyFips,r]));
 for(const c of x.positiveRows){const rec=candidateByFips.get(c.fips);if(!rec)fail(`candidate missing for ${c.fips}`);writes.set(`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`,certifiedCandidateBytes(await raw(x.root,rec.packagePath),rec));writes.set(`Crossing-Packages/${slug(c)}/package-manifest.json`,Buffer.from(json(packageManifest(c,rec.crossingCount))))}
 for(const c of x.zeroRows){writes.set(`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`,Buffer.from(json(zeroPackage(c))));writes.set(`Crossing-Packages/${slug(c)}/package-manifest.json`,Buffer.from(json(packageManifest(c,0))))}
 const records=[];for(const c of [...x.inventory.counties].sort((a,b)=>a.fips.localeCompare(b.fips))){const candidate=candidateByFips.get(c.fips),old=x.manifest.records.find(r=>String(r.county).replace(/ County$/,'')===c.countyName),count=candidate?.crossingCount??(x.zeroRows.some(z=>z.fips===c.fips)?0:old?.crossingCount);if(!Number.isInteger(count))fail(`manifest count unavailable for ${c.fips}`);records.push({county:c.countyName,status:'PASS',crossingCount:count,certificationFile:candidate?`${WAVE32}/package-certification.json`:old?.certificationFile||`${OUT}/post-activation-package-certification.json`,packageFile:`Crossing-Packages/${slug(c)}/Production/${slug(c)}-production-crossings.geojson`})}
 const manifest={...x.manifest,status:'active',totalPackages:254,totalCrossings:16099,passCount:254,blockedCount:0,records};delete manifest.generatedAt;
 const crossingPackages=records.map(r=>({packageType:'Crossing',county:r.county,status:'manufactured',manifest:`Crossing-Packages/${slug(byFips.get(x.inventory.counties.find(c=>c.countyName===r.county).fips))}/package-manifest.json`}));
 const registry={...x.registry,packageTypes:x.registry.packageTypes.map(t=>t.packageType==='Crossing'?{...t,packageCount:254}:t),packages:[...x.registry.packages.filter(p=>p.packageType!=='Crossing'),...crossingPackages]};registry.totalPackages=registry.packages.length;delete registry.generatedAt;
 writes.set('Crossing-Packages/production-crossing-manifest.json',Buffer.from(json(manifest)));writes.set('assets/package-registry/runtime-package-registry.json',Buffer.from(json(registry)));
 const ordered=orderGovernedWrites(writes);if(!governedPathOrderMatches([...ordered.keys()],x.production))fail('actual planned write set does not exactly match certified ordered allowlist');
 validatePrepared(x,ordered,manifest,registry);return ordered;
}

function validatePrepared(x,writes,manifest,registry){
 let positive=0,empty=0,totalIds=0;const seen=new Set(),owner=new Map(x.reconciliation.entries.map(e=>[e.crossingId,e.gridlyCountyFips]));
 for(const r of manifest.records){const c=x.inventory.counties.find(v=>v.countyName===r.county),body=writes.get(portable(r.packageFile));let pkg;if(body)pkg=clean(body.toString());else pkg=null;if(pkg){if(pkg.type!=='FeatureCollection'||!Array.isArray(pkg.features)||(pkg.crossingCount!==undefined&&pkg.crossingCount!==pkg.features.length)||(pkg.features.length===0&&pkg.crossingCount!==0))fail(`invalid prepared package ${r.packageFile}`);for(const id of ids(pkg)){if(seen.has(id))fail(`duplicate prepared identity ${id}`);if(owner.get(id)!==c.fips)fail(`prepared ownership mismatch ${id}`);if(BLOCKED.includes(id))fail(`blocked identity leakage ${id}`);seen.add(id)}}const count=pkg?pkg.features.length:r.crossingCount;totalIds+=count;count===0?empty++:positive++}
 if(!same({positive,empty,total:manifest.records.length,identities:totalIds},{positive:202,empty:52,total:254,identities:16099}))fail('prepared 254-county projection');
 const crossing=registry.packages.filter(p=>p.packageType==='Crossing');if(crossing.length!==254||registry.packageTypes.find(p=>p.packageType==='Crossing')?.packageCount!==254||!same(crossing.map(p=>p.county),manifest.records.map(r=>r.county)))fail('prepared manifest/registry disagreement');
}

/** Safest available filesystem-wide transaction: stage every byte, rename, and restore every prior byte on any failure. */
export async function guardedReplace(root,writes,{failAfter=Infinity,validate=async()=>{}}={}){
 const stage=join(root,'.git',`wave3a3-stage-${randomUUID()}`),backups=new Map();let replaced=0;
 await mkdir(stage,{recursive:true});
 try{
  for(const [p,b] of writes){JSON.parse(b.toString().replace(/^\uFEFF/,''));const target=join(root,p);backups.set(p,existsSync(target)?await readFile(target):null);const staged=join(stage,p);await mkdir(dirname(staged),{recursive:true});await writeFile(staged,b)}
  for(const [p] of writes){if(replaced===failAfter)throw Error('injected transaction failure');const target=join(root,p);await mkdir(dirname(target),{recursive:true});await rename(join(stage,p),target);replaced++}
  await validate();
 }catch(error){
  for(const [p,b] of [...backups].slice(0,replaced).reverse()){const target=join(root,p);if(b===null)await rm(target,{force:true});else {const restore=`${target}.wave3a3-restore`;await writeFile(restore,b);await rename(restore,target)}}
  throw Error(`Wave 3A.3 transaction rolled back: ${error.message}`);
 }finally{await rm(stage,{recursive:true,force:true})}
 return replaced;
}

async function postActivation(root){
 const inventory=await read(root,'data/lp104/texas-counties.json'),manifest=await read(root,'Crossing-Packages/production-crossing-manifest.json'),registry=await read(root,'assets/package-registry/runtime-package-registry.json'),reconciliation=await read(root,`${WAVE32}/reconciliation-index.json`),owner=new Map(reconciliation.entries.map(e=>[e.crossingId,e.gridlyCountyFips]));
 const seen=new Set(),duplicates=[],mismatches=[],leakage=[],counts={};let positive=0,empty=0;
 if(manifest.records.length!==254||manifest.totalPackages!==254||manifest.totalCrossings!==16099||manifest.passCount!==254||manifest.blockedCount!==0)fail('post-activation production manifest totals');
 for(const r of manifest.records){const c=inventory.counties.find(x=>x.countyName===r.county);if(!c)fail(`unknown manifest county ${r.county}`);const pkg=await read(root,portable(r.packageFile)),values=ids(pkg),countyManifest=await read(root,`Crossing-Packages/${slug(c)}/package-manifest.json`);if(pkg.type!=='FeatureCollection'||!Array.isArray(pkg.features)||r.crossingCount!==values.length||countyManifest.crossingCount!==values.length||portable(countyManifest.packageFile)!==portable(r.packageFile))fail(`package certification differs for ${c.fips}`);counts[c.countyName]=values.length;values.length?positive++:empty++;for(const id of values){if(seen.has(id))duplicates.push(id);seen.add(id);if(owner.get(id)!==c.fips)mismatches.push(id);if(BLOCKED.includes(id))leakage.push(id)}}
 const assigned=new Set(reconciliation.entries.filter(e=>e.gridlyCountyFips).map(e=>e.crossingId)),missing=[...assigned].filter(id=>!seen.has(id)),extra=[...seen].filter(id=>!assigned.has(id)),crossing=registry.packages.filter(p=>p.packageType==='Crossing');
 const result={classification:{ACTIVE_POSITIVE:positive,ACTIVE_EMPTY:empty,TOTAL:manifest.records.length},activeIdentities:seen.size,missing,extra,duplicates,mismatches,blockedLeakage:leakage,controls:{Brazos:counts.Brazos,Lavaca:counts.Lavaca,Washington:counts.Washington,Tyler:counts.Tyler},fraSource:{expected:FRA,observed:{bytes:(await raw(root,'Crossing-Packages/Texas/fra-crossings-tx.geojson')).length,sha256:sha(await raw(root,'Crossing-Packages/Texas/fra-crossings-tx.geojson'))}},manifestRegistryAgree:crossing.length===254&&registry.packageTypes.find(p=>p.packageType==='Crossing')?.packageCount===254&&same(crossing.map(p=>p.county),manifest.records.map(r=>r.county))};
 const expected={classification:{ACTIVE_POSITIVE:202,ACTIVE_EMPTY:52,TOTAL:254},activeIdentities:16099,missing:[],extra:[],duplicates:[],mismatches:[],blockedLeakage:[],controls:{Brazos:95,Lavaca:40,Washington:44,Tyler:0},fraSource:{expected:FRA,observed:FRA},manifestRegistryAgree:true};if(!same(result,expected))fail(`post-write certification failed: ${JSON.stringify(result)}`);return result;
}

async function requireCommittedFile(root,path){
 if(!existsSync(join(root,path)))fail(`committed apply evidence is absent: ${path.split('/').at(-1)}`);
 try{git(root,['ls-files','--error-unmatch',path]);git(root,['diff','--quiet','HEAD','--',path])}catch{fail(`apply evidence is not owner-current and committed: ${path.split('/').at(-1)}`)}
 return read(root,path);
}

/** Validate the applied lifecycle without regenerating or comparing historical WHAT-IF evidence. */
export async function verifyPostActivation({root=DEFAULT_ROOT,reinspect=postActivation}={}){
 const names=['apply-preflight.json','apply-write-plan.json','apply-result.json','post-activation-state.json','post-activation-conservation.json','post-activation-registry-certification.json','post-activation-package-certification.json'];
 const values=await Promise.all(names.map(name=>requireCommittedFile(root,`${OUT}/${name}`))),e=Object.fromEntries(names.map((name,i)=>[name,values[i]])),result=e['apply-result.json'];
 if(result.status!=='PASS'||result.decision!==DECISION_APPLIED||result.productionWrites!==454)fail('committed apply result is not the certified applied decision');
 const preflight=e['apply-preflight.json'],plan=e['apply-write-plan.json'];
 if(preflight.status!=='PASS'||preflight.productionWrites!==0||plan.status!=='PASS'||plan.count!==454||plan.files?.length!==454||!governedPathOrderMatches(plan.orderedPaths,plan.files.map(f=>f.path))||new Set(plan.orderedPaths).size!==454)fail('committed apply plan contract');
 for(const file of plan.files){const body=canonicalCandidateBytes(await raw(root,portable(file.path)));if(body.length!==file.bytes||sha(body)!==file.sha256)fail(`applied file differs from committed write plan: ${file.path}`)}
 const post=await reinspect(root),expected={
  'post-activation-state.json':{schemaVersion:'gridly.wave3a3.post-state.v1',status:'PASS',...post},
  'post-activation-conservation.json':{schemaVersion:'gridly.wave3a3.post-conservation.v1',status:'PASS',activeIdentities:post.activeIdentities,missing:post.missing,extra:post.extra,duplicates:post.duplicates,ownershipMismatches:post.mismatches,blockedLeakage:post.blockedLeakage},
  'post-activation-registry-certification.json':{schemaVersion:'gridly.wave3a3.post-registry.v1',status:'PASS',manifestRegistryAgree:post.manifestRegistryAgree,counties:254},
  'post-activation-package-certification.json':{schemaVersion:'gridly.wave3a3.post-packages.v1',status:'PASS',positive:202,empty:52,total:254,identities:16099,controls:post.controls}
 };
 for(const [name,value] of Object.entries(expected))if(!same(e[name],value))fail(`post-activation evidence mismatch: ${name}`);
 return result;
}

async function apply(root){
 const x=await inspect({root});if(!x.pass)fail(`pre-write gates: ${Object.entries(x.gates).filter(([,v])=>!v).map(([k])=>k).join(',')}`);
 const certification=await requireCommittedCertification(root,x),writes=await prepareWrites(x);
 const preflight={schemaVersion:'gridly.wave3a3.apply-preflight.v1',status:'PASS',certifiedSummarySha256:sha(Buffer.from(json(certification.summary))),gates:x.gates,productionWrites:0};
 const plan={schemaVersion:'gridly.wave3a3.apply-write-plan.v1',status:'PASS',count:writes.size,orderedPaths:[...writes.keys()],files:[...writes].map(([path,body])=>({path,bytes:body.length,sha256:sha(body)}))};
 let post;await guardedReplace(root,writes,{validate:async()=>{post=await postActivation(root)}});
 const evidence={'apply-preflight.json':preflight,'apply-write-plan.json':plan,'apply-result.json':{schemaVersion:'gridly.wave3a3.apply-result.v1',status:'PASS',decision:DECISION_APPLIED,productionWrites:writes.size,rollbackStrategy:'all bytes staged under .git; prior bytes restored in reverse order on any replacement failure'},'post-activation-state.json':{schemaVersion:'gridly.wave3a3.post-state.v1',status:'PASS',...post},'post-activation-conservation.json':{schemaVersion:'gridly.wave3a3.post-conservation.v1',status:'PASS',activeIdentities:post.activeIdentities,missing:post.missing,extra:post.extra,duplicates:post.duplicates,ownershipMismatches:post.mismatches,blockedLeakage:post.blockedLeakage},'post-activation-registry-certification.json':{schemaVersion:'gridly.wave3a3.post-registry.v1',status:'PASS',manifestRegistryAgree:post.manifestRegistryAgree,counties:254},'post-activation-package-certification.json':{schemaVersion:'gridly.wave3a3.post-packages.v1',status:'PASS',positive:202,empty:52,total:254,identities:16099,controls:post.controls}};
 await mkdir(join(root,OUT),{recursive:true});for(const [name,value] of Object.entries(evidence))await writeFile(join(root,OUT,name),json(value));return evidence['apply-result.json'];
}

export async function run({mode='whatif',writeEvidence=true,root=DEFAULT_ROOT}={}){
 if(mode==='apply')return apply(root);
 if(mode==='verify'&&existsSync(join(root,OUT,'apply-result.json')))return verifyPostActivation({root});
 const generated=await outputs({root});
 if(mode==='verify')for(const [name,value] of Object.entries(generated)){const path=join(root,OUT,name);if(!existsSync(path)||await readFile(path,'utf8')!==json(value))fail(`evidence mismatch: ${name}`)}
 else if(mode==='whatif'&&writeEvidence){await mkdir(join(root,OUT),{recursive:true});for(const [name,value] of Object.entries(generated))await writeFile(join(root,OUT,name),json(value))}
 else if(mode!=='whatif')fail('use --whatif, --verify, or --apply');
 return generated['summary.json'];
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const mode=process.argv.includes('--apply')?'apply':process.argv.includes('--verify')?'verify':'whatif';
 run({mode}).then(r=>console.log(process.argv.includes('--json')?JSON.stringify(r):json(r))).catch(e=>{console.error(e.message);process.exitCode=1});
}
