import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspect,outputs,run} from '../tools/wave3a3/activate-statewide-crossings.mjs';

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

test('apply always fails closed in the design-only mission',async()=>{
 await assert.rejects(run({mode:'apply'}),/apply is not authorized/);
});

test('missing owner-certified Wave 3A.2 inputs block rather than fabricate certification',async()=>{
 const e=await outputs(), s=e['summary.json'];
 assert.equal(s.productionWrites,0);
 if(e['candidate-input-certification.json'].missing.length)assert.equal(s.decision,'STATEWIDE CROSSING ACTIVATION BLOCKED');
});
