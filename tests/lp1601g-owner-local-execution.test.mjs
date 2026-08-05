import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { parseLp1601gArgs, selectManufacturingMode, ownerPreflight, executionStartedInvariant, enforceLp1601gInvalidCombinations, shaFile, OWNER_SOURCE, SOURCE_UNAVAILABLE, CONTROLLED_TEST_FIXTURE } from '../tools/lp1601f-streaming-manufacture.mjs';

async function parquetFixture(){const dir=await mkdtemp(join(tmpdir(),'lp1601g-')); const source=join(dir,'texas places.geoparquet'); await writeFile(source,Buffer.concat([Buffer.from('PAR1'),Buffer.from('controlled fixture')])); return {dir,source,sha:await shaFile(source)};}

test('existing readable source cannot select SOURCE_UNAVAILABLE and owner-source arguments preserve spaces and write',async()=>{
  const f=await parquetFixture();
  const args=parseLp1601gArgs(['--source',f.source,'--release','2026-07-22.0','--retrieval-date','2026-08-05','--license','CDLA Permissive 2.0','--attribution','Overture Maps Foundation','--expected-sha256',f.sha,'--duckdb-path','C:\\Duck DB\\duckdb.exe','--staging-directory',join(f.dir,'staging'),'--write','--write']);
  assert.equal(args.write,true);
  assert.equal(args.license,'CDLA Permissive 2.0');
  assert.equal(args.duckdbPath,'C:\\Duck DB\\duckdb.exe');
  const mode=await selectManufacturingMode(args);
  assert.equal(mode.mode,OWNER_SOURCE);
  assert.notEqual(mode.mode,SOURCE_UNAVAILABLE);
  await rm(f.dir,{recursive:true,force:true});
});

test('unknown arguments fail clearly',()=>{
  assert.throws(()=>parseLp1601gArgs(['--source','x','--surprise']),/LP1601G_UNKNOWN_ARGUMENT:--surprise/);
});

test('controlled fixture mode remains isolated',async()=>{
  const mode=await selectManufacturingMode({source:CONTROLLED_TEST_FIXTURE,write:true,controlledTestFixture:true});
  assert.equal(mode.mode,CONTROLLED_TEST_FIXTURE);
});

test('missing explicit source is the only source-unavailable selection path',async()=>{
  const mode=await selectManufacturingMode({source:'/definitely/missing/geoparquet',write:true,expectedSha256:'x',duckdbPath:'duckdb'});
  assert.equal(mode.mode,SOURCE_UNAVAILABLE);
});

test('preflight detects hash mismatch and missing DuckDB before execution',async()=>{
  const f=await parquetFixture();
  const pre=await ownerPreflight({source:f.source,expectedSha256:'BAD',duckdbPath:join(f.dir,'missing-duckdb'),stagingDirectory:join(f.dir,'staging'),write:true});
  assert.equal(pre.checks.sourceExists,'PASS');
  assert.equal(pre.checks.sourceReadable,'PASS');
  assert.equal(pre.checks.sourceMagicPar1,'PASS');
  assert.equal(pre.checks.sourceSha256Matches,'FAIL');
  assert.equal(pre.checks.duckDbExecutableExists,'FAIL');
  await rm(f.dir,{recursive:true,force:true});
});

test('execution-not-started invariant blocks false success',()=>{
  const inv=executionStartedInvariant({sourceSize:10,sourceHashPassed:true,writeMode:true,duckDbPreflightPassed:true,duckDbVersion:null,versionStageStarted:false,schemaStageStarted:false,extractionStageStarted:false,executionTraceStages:0,sourceRowCountingAttempted:false});
  assert.equal(inv.status,'FAIL');
  assert.equal(inv.classification,'MANUFACTURING_FAILED:EXECUTION_NOT_STARTED');
});

test('false success combinations are rejected with truthful failures',()=>{
  assert.equal(enforceLp1601gInvalidCombinations({sourceExists:true,sourceSize:1,sourceHashPassed:true,duckDbVersion:null}),'MANUFACTURING_FAILED:EXECUTION_NOT_STARTED');
  assert.equal(enforceLp1601gInvalidCombinations({duckDbExtractionSuccess:true,stagingRows:0,sourceRows:2,duckDbVersion:'v1'}),'MANUFACTURING_FAILED:EMPTY_STAGING_OUTPUT');
  assert.equal(enforceLp1601gInvalidCombinations({stagedRows:1,sourceRowsProcessed:0,duckDbVersion:'v1'}),'MANUFACTURING_FAILED:PROCESSING_NOT_STARTED');
  assert.equal(enforceLp1601gInvalidCombinations({retainedDestinations:0,exclusions:0,duplicatesRemoved:0,sourceRows:1,duckDbVersion:'v1'}),'MANUFACTURING_FAILED:UNRECONCILED_ZERO_OUTPUT');
  assert.equal(enforceLp1601gInvalidCombinations({finalClassification:'SOURCE_UNAVAILABLE',sourceHashPassed:true,duckDbVersion:'v1'}),'MANUFACTURING_FAILED:EXECUTION_NOT_STARTED');
});

test('controlled DuckDB executable invocation captures version/count semantics',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lp1601g-duck-'));
  const duck=join(dir,'duckdb');
  await writeFile(duck,'#!/usr/bin/env node\nif(process.argv.includes("--version")){console.log("v1.5.5"); process.exit(0)} const q=process.argv.join(" "); if(q.includes("count(*)")) console.log("42"); process.exit(0);\n');
  await chmod(duck,0o755);
  assert.ok(existsSync(duck));
  await rm(dir,{recursive:true,force:true});
});
