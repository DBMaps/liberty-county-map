import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonicalCandidateBytes,certifiedCandidateBytes,governedPathOrderMatches,guardedReplace,inspect,orderGovernedWrites,outputs,run,sortGovernedPaths} from '../tools/wave3a3/activate-statewide-crossings.mjs';

const sha256=body=>createHash('sha256').update(body).digest('hex');

test('candidate certification tolerates only CRLF checkout materialization and retains LF identity',()=>{
 const lf=Buffer.from('{\n  "type": "FeatureCollection",\n  "features": [{"properties":{"CROSSING":"A1","name":"Main"},"geometry":{"type":"Point","coordinates":[-95.1,30.2]}}]\n}\n');
 const crlf=Buffer.from(lf.toString().replaceAll('\n','\r\n'));
 const certification={countyFips:'48001',bytes:lf.length,sha256:sha256(lf)};

 assert.deepEqual(certifiedCandidateBytes(lf,certification),lf);
 assert.deepEqual(certifiedCandidateBytes(crlf,certification),lf);
 assert.deepEqual(canonicalCandidateBytes(crlf),lf);
 assert.equal(sha256(certifiedCandidateBytes(crlf,certification)),certification.sha256);

 const substantive=Buffer.from(lf);substantive[substantive.indexOf('Main')]='m'.charCodeAt(0);
 assert.throws(()=>certifiedCandidateBytes(substantive,certification),/byte identity differs/);
 assert.throws(()=>certifiedCandidateBytes(Buffer.from(lf.toString().replace('"Main"','"Changed"')),certification),/byte identity differs/);
 assert.throws(()=>certifiedCandidateBytes(Buffer.from(lf.toString().replace('-95.1','-95.2')),certification),/byte identity differs/);
});

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
 assert.equal(a.paths.filter(p=>p.includes('/Production/')&&p.endsWith('.geojson')).length,226);
 assert.equal(a.paths.filter(p=>p.endsWith('/package-manifest.json')).length,226);
 assert.equal(a.paths.filter(p=>p==='Crossing-Packages/production-crossing-manifest.json').length,1);
 assert.equal(a.paths.filter(p=>p==='assets/package-registry/runtime-package-registry.json').length,1);
 assert(a.paths.every(p=>p.startsWith('Crossing-Packages/')||p==='assets/package-registry/runtime-package-registry.json'));
});

test('prepared writes use the certified locale-independent governed path order',()=>{
 const fixture=[
  'Crossing-Packages/anderson/Production/anderson-production-crossings.geojson',
  'Crossing-Packages/anderson/package-manifest.json',
  'Crossing-Packages/andrews/Production/andrews-production-crossings.geojson',
  'assets/package-registry/runtime-package-registry.json'
 ];
 const allowlist=sortGovernedPaths(fixture);
 assert.deepEqual(allowlist,[fixture[0],fixture[1],fixture[2],fixture[3]]);
 assert.deepEqual(sortGovernedPaths([...fixture].reverse()),allowlist);
 assert.notDeepEqual([...fixture].sort((a,b)=>a.localeCompare(b,'en')),allowlist);

 const prepared=[...orderGovernedWrites(new Map([...fixture].reverse().map(path=>[path,Buffer.from('{}\n')]))).keys()];
 assert.deepEqual(prepared,allowlist);
 assert.equal(governedPathOrderMatches(prepared,allowlist),true);
 assert.equal(governedPathOrderMatches(prepared.slice(0,-1),allowlist),false);
 assert.equal(governedPathOrderMatches([...prepared,'Crossing-Packages/extra/package-manifest.json'],allowlist),false);
 assert.equal(governedPathOrderMatches([prepared[1],prepared[0],...prepared.slice(2)],allowlist),false);
});

test('what-if is deterministic and performs no production writes',async()=>{
 const x=await inspect(), paths=x.production, before=await Promise.all(paths.filter(async()=>true).map(async p=>{try{return [p,await readFile(new URL(`../${p}`,import.meta.url))]}catch{return [p,null]}}));
 assert.deepEqual(await outputs(),await outputs()); await run({mode:'whatif',writeEvidence:false});
 for(const [p,b] of before){let after=null;try{after=await readFile(new URL(`../${p}`,import.meta.url))}catch{}assert.deepEqual(after,b,p)}
});

test('apply fails before writes when the committed certification or any preflight gate is absent',async()=>{
 const fixture=await mkdtemp(join(tmpdir(),'wave3a3-missing-certification-'));
 try{
  execFileSync('git',['clone','--quiet','--no-local',fileURLToPath(new URL('..',import.meta.url)),fixture]);
  await rm(join(fixture,'evidence/wave3a3-statewide-crossing-activation/summary.json'));
  const paths=(await inspect({root:fixture})).production;
  const bytes=async path=>{try{return await readFile(join(fixture,path))}catch(error){if(error.code==='ENOENT')return null;throw error}};
  const before=await Promise.all(paths.map(async path=>[path,await bytes(path)]));

  await assert.rejects(run({mode:'apply',root:fixture}),/fail closed/);

  for(const [path,body] of before)assert.deepEqual(await bytes(path),body,path);
  assert(before.some(([,body])=>body===null),'fixture must include at least one not-yet-created governed target');
 }finally{await rm(fixture,{recursive:true,force:true})}
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
 assert.match(source,/governedPathOrderMatches\(allow\.paths,x\.production\)/);
 assert.match(source,/canonicalCandidateBytes\(await raw\(root,record\.packagePath\)\)/);
 assert.match(source,/certifiedCandidateBytes\(await raw\(x\.root,rec\.packagePath\),rec\)/);
 assert.match(source,/roadRuntimeDependencyIntroduced:false/);
 assert.match(source,/reportIdentityMutation:false/);
 assert.match(source,/postActivation\(root\)/);
 assert.doesNotMatch(source,/data\/roadway-runtime-manifest\.json[^\n]*writes\.set/);
});

test('verify dispatches by lifecycle and post-activation verification stays read-only and fail closed',async()=>{
 const source=await readFile(new URL('../tools/wave3a3/activate-statewide-crossings.mjs',import.meta.url),'utf8');
 assert.match(source,/mode==='verify'&&existsSync\(join\(root,OUT,'apply-result\.json'\)\).*verifyPostActivation/);
 assert.match(source,/result\.status!==['"]PASS['"].*result\.decision!==DECISION_APPLIED.*result\.productionWrites!==454/);
 assert.match(source,/for\(const file of plan\.files\).*raw\(root,portable\(file\.path\)\).*sha\(body\)!==file\.sha256/);
 assert.match(source,/post-activation evidence mismatch/);
 assert.match(source,/committed apply evidence is absent/);
 const verifier=source.slice(source.indexOf('export async function verifyPostActivation'),source.indexOf('\nasync function apply'));
 assert.doesNotMatch(verifier,/\bapply\s*\(/);
 assert.doesNotMatch(verifier,/writeFile|rename|guardedReplace|prepareWrites/);
});

test('post-activation reinspection covers registry, package, identity, FRA, blocked, and control contracts',async()=>{
 const source=await readFile(new URL('../tools/wave3a3/activate-statewide-crossings.mjs',import.meta.url),'utf8');
 const inspector=source.slice(source.indexOf('async function postActivation'),source.indexOf('\nasync function requireCommittedFile'));
 for(const contract of ['production manifest totals','package certification differs','missing','extra','duplicates','mismatches','blockedLeakage','Brazos','Lavaca','Washington','Tyler','fraSource','manifestRegistryAgree'])assert.match(inspector,new RegExp(contract));
 assert.match(inspector,/packageCount===254/);
 assert.match(inspector,/reconciliation-index\.json/);
});

test('missing owner-certified Wave 3A.2 inputs block rather than fabricate certification',async()=>{
 const e=await outputs(), s=e['summary.json'];
 assert.equal(s.productionWrites,0);
 if(e['candidate-input-certification.json'].missing.length)assert.equal(s.decision,'STATEWIDE CROSSING ACTIVATION BLOCKED');
});
