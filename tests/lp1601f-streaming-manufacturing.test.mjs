import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditOversizedStringPaths, extractionSql, streamJsonl, writeControlledLp1601fReports, verifyLp1601f, PARTITION_COUNT, CONTROLLED_TEST_FIXTURE } from '../tools/lp1601f-streaming-manufacture.mjs';

test('CONTROLLED_TEST_FIXTURE DuckDB extraction writes partitioned output directly to disk',()=>{
  const sql=extractionSql('/tmp/texas-places.geoparquet','/tmp/staging','2026-07-22.0');
  assert.match(sql,/COPY \(/);
  assert.match(sql,/FORMAT PARQUET/);
  assert.match(sql,/PARTITION_BY \(partition_key\)/);
  assert.doesNotMatch(sql,/SELECT \* FROM read_parquet[^]*;\s*$/);
});

test('CONTROLLED_TEST_FIXTURE audit marks statewide string paths replaced',()=>{
  const audit=auditOversizedStringPaths();
  assert.equal(audit.realGeoParquetPathContainsStatewideWholeStringOperation,false);
  assert.ok(audit.paths.every(p=>p.status.includes('REPLACED')||p.status.includes('BOUNDED')));
});

test('CONTROLLED_TEST_FIXTURE JSONL reader streams line by line',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'lp1601f-'));
  const file=join(dir,'part.jsonl');
  await writeFile(file,'{"a":1}\n{"a":2}\nnot json\n');
  let sum=0;
  const r=await streamJsonl(file,rec=>{sum+=rec.a});
  assert.equal(sum,3);
  assert.equal(r.processedRows,2);
  assert.equal(r.malformedRows,1);
  assert.equal(r.peakBufferedRecordCount,1);
  await rm(dir,{recursive:true,force:true});
});

test('CONTROLLED_TEST_FIXTURE reports contain 254 counties and bounded memory flags',async()=>{
  await writeControlledLp1601fReports({source:CONTROLLED_TEST_FIXTURE});
  const verify=await verifyLp1601f();
  assert.equal(verify.status,'PASS');
  const manifest=JSON.parse(await readFile(new URL('../data/lp1601/texas-destination-candidate-registry-manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.counties.length,254);
  assert.equal(manifest.monolithicStatewideRegistry,false);
  const mem=JSON.parse(await readFile(new URL('../reports/lp1601f/memory-safety-report.json',import.meta.url),'utf8'));
  assert.equal(mem.fullSourceStringCreated,false);
  assert.equal(mem.fullRegistryArrayCreated,false);
  const stage=JSON.parse(await readFile(new URL('../data/lp1601f/staging-manifest.json',import.meta.url),'utf8'));
  assert.equal(stage.partitionCount,PARTITION_COUNT);
});
