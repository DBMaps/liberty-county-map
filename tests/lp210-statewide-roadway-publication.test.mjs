import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {buildPlan,remotePath,manifestPath,RUNTIME_SHA,LP116_MANIFEST_SCHEMA,validateLocalManifest,verifyPortable,getRemote,certifyObject} from '../tools/lp210/statewide-roadway-publication.mjs';
const load=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
test('LP209 and LP209.1 gates, cohorts, and protected runtime conserve Texas',async()=>{const {counties,runtime}=await buildPlan();assert.equal(counties.length,226);assert.equal(Object.keys(runtime.counties).length,28);const active=new Set(Object.keys(runtime.counties));assert.equal(counties.filter(c=>active.has(c.countyId)).length,0);assert.equal(new Set([...active,...counties.map(c=>c.countyId)]).size,254);assert.ok(counties.every(c=>c.protectedExistingRuntime===false));});
test('all candidate rows are certified and exactly seven retain governed partitions',async()=>{const {counties}=await buildPlan();assert.equal(counties.filter(c=>c.partitionCount>1).length,7);assert.deepEqual(counties.filter(c=>c.partitionCount>1).map(c=>c.countyFips),['48029','48085','48113','48121','48215','48439','48453']);assert.equal(counties.reduce((n,c)=>n+c.objects.length,0),237);});
test('all 226 LP116 slug identities bridge explicitly to LP209 runtime identities',async()=>{const {counties}=await buildPlan();assert.ok(counties.every(c=>c.countyId===`${c.countySlug}-tx`));for(const fips of ['48001','48029','48113']){const c=counties.find(x=>x.countyFips===fips);assert.ok(c);assert.ok(c.objects.every(o=>o.fileName.startsWith(`packages/${c.countySlug}-tx`)));}});
test('local manifest contract accepts Anderson and partitioned Bexar and Dallas evidence',async()=>{const {counties}=await buildPlan();for(const fips of ['48001','48029','48113']){const c=counties.find(x=>x.countyFips===fips);const manifest={schemaVersion:LP116_MANIFEST_SCHEMA,fips:Number(c.countyFips),countyId:c.countySlug,candidate:true,activated:false,productionAuthorization:false,packageCount:c.partitionCount,packages:c.objects.map(o=>({packageId:o.fileName.slice('packages/'.length,-'.roadways.candidate.geojson'.length),fileName:o.fileName,featureCount:o.featureCount,byteLength:o.expectedBytes,sha256:o.expectedSha256}))};assert.doesNotThrow(()=>validateLocalManifest(manifest,c));}});
test('local manifest semantic mutations fail closed',async()=>{const {counties}=await buildPlan();const c=counties.find(x=>x.countyFips==='48001');const pkg=c.objects[0];const valid={schemaVersion:LP116_MANIFEST_SCHEMA,fips:c.countyFips,countyId:c.countySlug,candidate:true,activated:false,productionAuthorization:false,packageCount:1,packages:[{packageId:'anderson-tx',fileName:pkg.fileName,featureCount:pkg.featureCount,byteLength:pkg.expectedBytes,sha256:pkg.expectedSha256}]};const cases=[m=>m.fips='48003',m=>m.countyId='anderson-tx',m=>m.schemaVersion='wrong',m=>m.candidate=false,m=>m.activated=true,m=>m.productionAuthorization=true,m=>m.packageCount=2,m=>m.packages=[],m=>m.packages.push({...m.packages[0]}),m=>m.packages[0].fileName='packages/wrong.geojson',m=>m.packages[0].featureCount++,m=>m.packages[0].byteLength++,m=>m.packages[0].sha256='0'.repeat(64),m=>m.packages[0].packageId='anderson'];for(const mutate of cases){const m=structuredClone(valid);mutate(m);assert.throws(()=>validateLocalManifest(m,c),/Local manifest semantics mismatch/);}});
test('local identity checks occur before any remote operation and cover manifests',async()=>{const src=await readFile(new URL('../tools/lp210/statewide-roadway-publication.mjs',import.meta.url),'utf8');assert.match(src,/await localCertify\(plan,workspace\).*for\(const c of plan.counties\)/s);assert.match(src,/Local package identity mismatch/);assert.match(src,/Local manifest identity mismatch/);});
test('remote paths are deterministic, unique, and preserve partitions',async()=>{const {counties}=await buildPlan();const paths=counties.flatMap(c=>[c.remoteManifestPath,...c.objects.map(o=>o.remotePath)]);assert.equal(new Set(paths).size,paths.length);assert.equal(remotePath('lee-tx','packages/lee.geojson'),'roadways/lee-tx/lp210/packages/lee.geojson');assert.equal(manifestPath('lee-tx'),'roadways/lee-tx/lp210/candidate-roadway-manifest.json');});
test('existing exact skips, conflict fails closed, uploads require independent download',async()=>{const src=await readFile(new URL('../tools/lp210/statewide-roadway-publication.mjs',import.meta.url),'utf8');assert.match(src,/REMOTE_OBJECT_EXACT_MATCH/);assert.match(src,/REMOTE_OBJECT_CONFLICT/);assert.match(src,/'x-upsert':'false'/);assert.match(src,/Independent remote verification failed/);});
test('failed upload cannot claim certification and manifests are independently verified',async()=>{const src=await readFile(new URL('../tools/lp210/statewide-roadway-publication.mjs',import.meta.url),'utf8');assert.match(src,/Upload failed/);assert.match(src,/certifyObject\(mi,c.manifestBytes/);assert.match(src,/remoteCertificationStatus=.*'PASS':'PENDING'/);});
test('portable final owner evidence closes all 463 objects without credentials',async()=>{const s=await verifyPortable();const m=await load('../reports/lp210/statewide-roadway-remote-certification-manifest.json');assert.equal(s.readiness,'READY_FOR_STATEWIDE_ROADWAY_RUNTIME_ACTIVATION');assert.equal(m.counties.length,226);assert.equal(s.totalRemoteObjectCount,463);assert.equal(s.supabaseWrites.objectsAlreadyExact,463);assert.equal(s.supabaseWrites.objectsVerified,463);assert.equal(s.runtimeActivations,0);assert.equal(s.productionRuntimeChanges,0);assert.equal(s.productionRuntimeManifest.sha256Before,RUNTIME_SHA);assert.equal(s.productionRuntimeManifest.countyCountBefore,28);});
test('portable verification consumes certificates without owner files, credentials, or downloads',async()=>{const src=await readFile(new URL('../tools/lp210/statewide-roadway-publication.mjs',import.meta.url),'utf8');const portable=src.slice(src.indexOf('export async function verifyPortable'));assert.doesNotMatch(portable,/buildPlan\(/);assert.doesNotMatch(portable,/process\.env|fetch\(|localCertify\(/);});
test('completed evidence has downgrade protection and no runtime activation code',async()=>{const src=await readFile(new URL('../tools/lp210/statewide-roadway-publication.mjs',import.meta.url),'utf8');assert.match(src,/Refusing to overwrite completed owner evidence/);assert.doesNotMatch(src,/writeFile\(join\(ROOT,'data\/roadway-runtime-manifest/);});
test('repository ignores owner bytes and prohibited package types are absent from plan outputs',async()=>{const ignore=await readFile(new URL('../.gitignore',import.meta.url),'utf8');assert.match(ignore,/owner-local/);const {counties}=await buildPlan();assert.ok(counties.every(c=>c.objects.every(o=>o.localPath.startsWith('lp116'))));});

const storageError=(status,body)=>new Response(typeof body==='string'?body:JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
async function withFetch(responses,fn){const original=globalThis.fetch,calls=[];globalThis.fetch=async(...args)=>{calls.push(args);const next=responses.shift();return typeof next==='function'?next(...args):next;};try{return await fn(calls);}finally{globalThis.fetch=original;}}

test('remote GET recognizes transport 404 and Supabase NoSuchKey semantic 404 as absent',async()=>{
 await withFetch([storageError(404,'not found'),storageError(400,{statusCode:'404',error:'not_found',message:'Object not found',code:'NoSuchKey'})],async()=>{
  assert.equal(await getRemote('roadways/anderson-tx/lp210/packages/missing.geojson'),null);
  assert.equal(await getRemote('roadways/anderson-tx/lp210/packages/missing.geojson'),null);
 });
});

test('remote GET fails closed for other 400 errors and preserves safe Storage details',async()=>{
 const cases=[
  [storageError(400,{statusCode:'400',error:'invalid_request',message:'Malformed request',code:'InvalidRequest'}),/HTTP 400; code=InvalidRequest, error=invalid_request, message=Malformed request/],
  [storageError(400,{message:'Invalid object key',code:'InvalidKey'}),/HTTP 400; code=InvalidKey, message=Invalid object key/],
  [storageError(400,'not json'),/HTTP 400$/]
 ];
 for(const [response,pattern] of cases)await withFetch([response],async()=>assert.rejects(getRemote('roadways/anderson-tx/lp210/bad'),pattern));
});

test('remote GET keeps authentication, permission, and server errors fatal',async()=>{
 for(const status of [401,403,500])await withFetch([storageError(status,{error:'storage_error',message:'Denied or unavailable'})],async()=>assert.rejects(getRemote('roadways/anderson-tx/lp210/object','test-secret'),new RegExp(`HTTP ${status}.*storage_error`)));
});

test('WhatIf reports semantic absence without upload while exact objects match and conflicts fail closed',async()=>{
 const item={remotePath:'roadways/anderson-tx/lp210/packages/anderson.geojson'},local=Buffer.from('governed bytes');
 await withFetch([storageError(400,{statusCode:'404',error:'not_found',code:'NoSuchKey'})],async calls=>{const result=await certifyObject(item,local,null,false,'application/geo+json');assert.equal(result.status,'REMOTE_OBJECT_ABSENT');assert.equal(result.uploaded,false);assert.equal(calls.length,1);});
 await withFetch([new Response(local)],async()=>{const result=await certifyObject(item,local,null,false,'application/geo+json');assert.equal(result.status,'REMOTE_OBJECT_EXACT_MATCH');assert.equal(result.uploaded,false);});
 await withFetch([new Response('conflicting bytes')],async()=>assert.rejects(certifyObject(item,local,null,false,'application/geo+json'),/REMOTE_OBJECT_CONFLICT/));
});

test('Apply sends a guarded upload only after semantic absence and independently verifies it',async()=>{
 const item={remotePath:'roadways/anderson-tx/lp210/packages/anderson.geojson'},local=Buffer.from('governed bytes');
 await withFetch([storageError(400,{statusCode:'404',error:'not_found',code:'NoSuchKey'}),new Response(null,{status:200}),new Response(local)],async calls=>{
  const result=await certifyObject(item,local,'owner-token',true,'application/geo+json');
  assert.equal(result.status,'REMOTE_OBJECT_EXACT_MATCH');assert.equal(result.uploaded,true);assert.equal(calls.length,3);
  assert.equal(calls[1][1].method,'POST');assert.equal(calls[1][1].headers['x-upsert'],'false');
 });
});
