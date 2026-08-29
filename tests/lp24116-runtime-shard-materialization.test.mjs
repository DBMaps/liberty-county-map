import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {authorityGuard,projectRows,shardId,candidateShardIds,certifyFanout,writeBuild,verifyBuild,sha256,readParquet} from '../tools/lp24116/runtime-shard-materializer.mjs';
import {compressors} from 'hyparquet-compressors';
import {validatePoi} from '../tools/lp24115c/runtime-v2-contract.mjs';
const registry=JSON.parse(fs.readFileSync('data/lp149/runtime-county-registry.json')).identities;
const source=(id='a')=>({id,display_name:'Cafe',brand_text:'',gridly_category:'RESTAURANT',latitude:30.1,longitude:-94.8,county_fips:'48001',sources:[{license:'CDLA-Permissive-2.0'}]});
const licenses={'CDLA-Permissive-2.0':1};
const projection=rows=>projectRows(rows,registry,{expectedCount:rows.length,expectedLicenses:{'CDLA-Permissive-2.0':rows.length}});
test('source projection is exact, v2-only, sorted and one-degree indexed',()=>{const p=projection([source('b'),source('a')]);assert.equal(shardId(30.1,-94.8),'tx-30-095');assert.deepEqual([...p.shards.values()][0].map(x=>x.id),['a','b']);assert.deepEqual(Object.keys([...p.shards.values()][0][0]),['id','displayName','gridlyCategory','latitude','longitude','countyContextId']);});
test('candidate algorithm proves bounded fanout',()=>{assert.deepEqual(certifyFanout(),{maxCandidateShards5Mi:4,maxCandidateShards10Mi:4,maxCandidateShards25Mi:4});assert.ok(candidateShardIds(30,-95,25).length<=4);});
test('missing, size and hash authority guards fail closed',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp16-')),f=path.join(d,'a');assert.throws(()=>authorityGuard(f),/NOT_AVAILABLE/);fs.writeFileSync(f,'x');assert.throws(()=>authorityGuard(f,{bytes:2,sha256:sha256('x')}),/INTEGRITY/);assert.throws(()=>authorityGuard(f,{bytes:1,sha256:'0'.repeat(64)}),/INTEGRITY/);});
for(const [name,change,pattern] of [
 ['wrong row count',()=>[],/ROW_COUNT/],['missing required column',r=>{delete r.gridly_category;return [r]},/MISSING_REQUIRED/],['wrong source type',r=>[{...r,display_name:1}],/WRONG_SOURCE/],['duplicate ID',r=>[r,r],/DUPLICATE/],['empty ID',r=>[{...r,id:''}],/EMPTY/],['invalid latitude',r=>[{...r,latitude:NaN}],/INVALID_COORDINATE/],['invalid longitude',r=>[{...r,longitude:181}],/INVALID_COORDINATE/],['unknown county',r=>[{...r,county_fips:'48999'}],/UNKNOWN/]
])test(name,()=>{const rows=change(source());assert.throws(()=>projectRows(rows,registry,{expectedCount:name==='duplicate ID'?2:1,expectedLicenses:licenses}),pattern);});
test('ambiguous county mapping fails',()=>assert.throws(()=>projectRows([source()],[...registry,registry[0]],{expectedCount:1,expectedLicenses:licenses}),/AMBIGUOUS/));
test('communityIdentity and forbidden fields are rejected by v2',()=>{assert.throws(()=>validatePoi({...projection([source()]).shards.values().next().value[0],communityIdentity:{}}),/FORBIDDEN/);assert.throws(()=>validatePoi({...projection([source()]).shards.values().next().value[0],rawSourceMetadata:{}}),/FORBIDDEN/);});
test('shard verification catches missing, corrupt, hash and count failures',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp16-out-')),p=projection([source()]),a={bytes:1,sha256:'x'};const m=writeBuild(d,p,a);const file=path.join(d,m.shards[0].file),original=fs.readFileSync(file);fs.rmSync(file);assert.throws(()=>verifyBuild(d),/MISSING/);fs.writeFileSync(file,'bad');assert.throws(()=>verifyBuild(d),/HASH/);m.shards[0].sha256=sha256(Buffer.from('bad'));m.shards[0].byteCount=3;fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify(m));assert.throws(()=>verifyBuild(d),/CORRUPT/);fs.writeFileSync(file,original);m.shards[0].sha256=sha256(original);m.shards[0].byteCount=original.length;m.shardCount=2;fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify(m));assert.throws(()=>verifyBuild(d),/COUNT/);});
test('independent fixture builds are byte-identical',()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'lp16-det-')),a=path.join(root,'a'),b=path.join(root,'b'),p=projection([source('b'),source('a')]),authority={bytes:1,sha256:'x'};writeBuild(a,p,authority);writeBuild(b,p,authority);for(const file of fs.readdirSync(a).sort())assert.deepEqual(fs.readFileSync(path.join(a,file)),fs.readFileSync(path.join(b,file)));});
test('release, inventory and v1 contamination fail closed',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'lp16-bind-')),m=writeBuild(d,projection([source()]),{bytes:1,sha256:'x'});for(const [key,value,pattern] of [['authorityReleaseId','wrong',/RELEASE/],['sourceInventorySha256','wrong',/INVENTORY/],['runtimeSchemaVersion','gridly.poi.runtime.v1',/V1/]]){const copy={...m,[key]:value};fs.writeFileSync(path.join(d,'manifest.json'),JSON.stringify(copy));assert.throws(()=>verifyBuild(d),pattern);}});
test('wrong license, NOTICE, provider and production modes have explicit fail-closed codes',()=>{assert.throws(()=>projectRows([source()],registry,{expectedCount:1,expectedLicenses:{wrong:1}}),/LICENSE/);const sourceText=fs.readFileSync('tools/lp24116/runtime-shard-materializer.mjs','utf8');for(const token of ['FOURSQUARE_NOTICE_HASH_MISMATCH','PRODUCTION_PROVIDER_GATE_ENABLED','PRODUCTION_MATERIALIZATION_MODE_FORBIDDEN','NONDETERMINISTIC_BUILD'])assert.match(sourceText,new RegExp(token));});
test('companion compressor performs actual bounded ZSTD decompression',async()=>{
  // ZSTD single-segment frame containing one raw, final five-byte block: "hello".
  const frame=Uint8Array.from([0x28,0xb5,0x2f,0xfd,0x20,0x05,0x29,0x00,0x00,0x68,0x65,0x6c,0x6c,0x6f]);
  assert.equal(Buffer.from(await compressors.ZSTD(frame,5)).toString(),'hello');
});
test('Parquet read path fails explicitly when ZSTD support is disabled',async()=>{
  await assert.rejects(readParquet(import.meta.filename,{parquetCompressors:{}}),/PARQUET_ZSTD_COMPRESSOR_NOT_AVAILABLE/);
});
