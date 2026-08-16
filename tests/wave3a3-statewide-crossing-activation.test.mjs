import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {guardedReplace,inspect,outputs,run} from '../tools/wave3a3/activate-statewide-crossings.mjs';

test('projects the exact governed statewide contract and zero cohort',async()=>{
 const e=await outputs(), p=e['projected-254-county-state.json'], z=e['zero-county-governance.json'];
 assert.deepEqual(p.classification,{ACTIVE_POSITIVE:202,ACTIVE_EMPTY:52,TOTAL:254});
 assert.equal(p.counties.length,254); assert.equal(z.additionalCount,51); assert.equal(z.existing.crossingCount,0);
 assert.equal(p.counties.filter(x=>x.classification==='ACTIVE_EMPTY').length,52);
});

test('conserves the certified identity contract and protects border rows',async()=>{
 const e=await outputs(), i=e['identity-conservation.json'], b=e['blocked-identity-protection.json'];
 assert.deepEqual(i.equation,{existingActive:3784,certifiedCandidate:12315,projectedActive:16099});
 assert.deepEqual(b.required,['019788P','019791X']); assert.deepEqual(b.packageLeakage,[]);
});

test('write allowlist is exact, scoped, and covers explicit empty packages',async()=>{
 const e=await outputs(), a=e['write-allowlist.json'];
 assert.equal(a.count,454); assert.equal(new Set(a.paths).size,a.count);
 assert.deepEqual(a.categories,{positiveProductionPackages:175,emptyProductionPackages:51,countyPackageManifests:226,productionManifest:1,runtimeRegistry:1});
 assert(a.paths.every(p=>p.startsWith('Crossing-Packages/')||p==='assets/package-registry/runtime-package-registry.json'));
});

test('what-if is deterministic and performs no production writes',async()=>{
 const x=await inspect(), paths=x.production, before=await Promise.all(paths.filter(async()=>true).map(async p=>{try{return [p,await readFile(new URL(`../${p}`,import.meta.url))]}catch{return [p,null]}}));
 assert.deepEqual(await outputs(),await outputs()); await run({mode:'whatif',writeEvidence:false});
 for(const [p,b] of before){let after=null;try{after=await readFile(new URL(`../${p}`,import.meta.url))}catch{}assert.deepEqual(after,b,p)}
});

test('apply fails before writes when the committed certification or any preflight gate is absent',async()=>{
 const x=await inspect(),paths=x.production,before=await Promise.all(paths.map(async p=>{try{return [p,await readFile(new URL(`../${p}`,import.meta.url))]}catch{return [p,null]}}));
 await assert.rejects(run({mode:'apply'}),/fail closed/);
 for(const [p,b] of before){let after=null;try{after=await readFile(new URL(`../${p}`,import.meta.url))}catch{}assert.deepEqual(after,b,p)}
});

test('guarded replacement stages valid JSON and rolls every partial replacement back',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wave3a3-'));
 try{
  await mkdir(join(root,'.git'));await mkdir(join(root,'Crossing-Packages/a'),{recursive:true});
  await writeFile(join(root,'Crossing-Packages/a/one.json'),'{"old":1}\n');
  const writes=new Map([['Crossing-Packages/a/one.json',Buffer.from('{"new":1}\n')],['Crossing-Packages/a/two.json',Buffer.from('{"new":2}\n')]]);
  await assert.rejects(guardedReplace(root,writes,{failAfter:1}),/transaction rolled back/);
  assert.equal(await readFile(join(root,'Crossing-Packages/a/one.json'),'utf8'),'{"old":1}\n');
  await assert.rejects(readFile(join(root,'Crossing-Packages/a/two.json')),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('apply implementation preserves immutable domains and performs post-write certification',async()=>{
 const source=await readFile(new URL('../tools/wave3a3/activate-statewide-crossings.mjs',import.meta.url),'utf8');
 assert.match(source,/same\(allow\.paths,x\.production\)/);
 assert.match(source,/body\.length!==record\.bytes\|\|sha\(body\)!==record\.sha256/);
 assert.match(source,/roadRuntimeDependencyIntroduced:false/);
 assert.match(source,/reportIdentityMutation:false/);
 assert.match(source,/postActivation\(root\)/);
 assert.doesNotMatch(source,/data\/roadway-runtime-manifest\.json[^\n]*writes\.set/);
});

test('missing owner-certified Wave 3A.2 inputs block rather than fabricate certification',async()=>{
 const e=await outputs(), s=e['summary.json'];
 assert.equal(s.productionWrites,0);
 if(e['candidate-input-certification.json'].missing.length)assert.equal(s.decision,'STATEWIDE CROSSING ACTIVATION BLOCKED');
});
