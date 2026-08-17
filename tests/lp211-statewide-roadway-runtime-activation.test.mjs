import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { buildPlan, run, translateLp210County } from '../tools/lp211/statewide-roadway-runtime-activation.mjs';

const json=async(path)=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));

test('LP211 conserves 28 + 226 = 254 exact Texas identities',async()=>{
  const plan=await buildPlan(); assert.equal(plan.counts.existingRuntimeBefore,28); assert.equal(plan.counts.incomingLp210Count,226); assert.equal(plan.counts.runtimeCountAfter,254);
  assert.deepEqual([plan.counts.duplicateFips,plan.counts.duplicateCountyIds,plan.counts.missingTexasCount,plan.counts.extraCountyCount],[0,0,0,0]);
  assert.equal(new Set(plan.counties.map(x=>x.countyId)).size,254); assert.equal(new Set(plan.counties.map(x=>x.countyFips)).size,254);
});

test('LP210 translation uses only exact certified paths and seven governed partition manifests',async()=>{
  const certificate=await json('reports/lp210/statewide-roadway-remote-certification-manifest.json'); const entries=certificate.counties.map(row=>[row,translateLp210County(row)]);
  assert.equal(entries.filter(([,entry])=>entry.runtimeType==='lp210_certified_partition_manifest').length,7);
  for(const [row,entry] of entries){assert.equal(row.remoteCertificationStatus,'PASS');assert.ok((entry.url||entry.manifestUrl).includes(`/roadways/${row.countyId}/lp210/`));if(row.partitionCount>1)assert.deepEqual(entry.partitions.map(x=>x.remotePath),row.objects.map(x=>x.remotePath));else assert.ok(entry.url.endsWith(row.objects[0].remotePath));}
  assert.deepEqual(entries.filter(([row])=>row.partitionCount>1).map(([row])=>row.countyFips),['48029','48085','48113','48121','48215','48439','48453']);
});

test('existing protected controls and Harris architecture are unchanged',async()=>{
  const activation=await json('reports/lp211/statewide-roadway-runtime-activation-manifest.json'); const byId=Object.fromEntries(activation.counties.map(x=>[x.countyId,x]));
  for(const id of ['liberty-tx','san-jacinto-tx','chambers-tx','harris-tx'])assert.equal(byId[id].classification,'EXISTING_PRESERVED');
  assert.equal(byId['liberty-tx'].runtime.url,'data/liberty-county-road-segments.geojson'); assert.match(byId['san-jacinto-tx'].runtime.url,/san-jacinto/); assert.equal(byId['harris-tx'].runtime.partitionRuntimeType,'harris_lp032_adaptive_spatial_runtime');
});

test('WhatIf and Verify are read-only and Apply is explicit/idempotent',async()=>{
  const path=new URL('../data/roadway-runtime-manifest.json',import.meta.url); const before=await readFile(path); const mtime=(await stat(path)).mtimeMs;
  assert.equal((await run('WhatIf')).mode,'WhatIf'); assert.equal((await run('Verify')).readiness,'STATEWIDE_ROADWAY_RUNTIME_ACTIVE'); assert.deepEqual(await readFile(path),before); assert.equal((await stat(path)).mtimeMs,mtime);
  const applied=await run('Apply'); assert.equal(applied.alreadyActive,true); assert.deepEqual(await readFile(path),before);
});

test('runtime loader has generic fail-closed LP210 partition and stale-request guards',async()=>{
  const source=await readFile(new URL('../js/app.js',import.meta.url),'utf8'); assert.match(source,/lp210_certified_partition_manifest/); assert.match(source,/Roadway partition manifest returned/); assert.match(source,/roadway_partition_retrieval_failed/); assert.match(source,/requestStillActive/); assert.match(source,/roadwaySegmentFeatures = \[\]/); assert.match(source,/staleCompletionIgnoredCount/);
});

test('activation evidence freezes zero mutation accounting and exact final decision',async()=>{
  const report=await json('reports/lp211/statewide-roadway-runtime-activation.json'); assert.equal(report.runtimeCountAfter,254); assert.equal(report.lp210ActivatedCount,226); assert.equal(report.existingPreservedCount,28); assert.deepEqual([report.supabaseObjectsUploaded,report.remoteObjectsModified,report.remoteObjectsDeleted,report.databaseWrites],[0,0,0,0]); assert.equal(report.readiness,'STATEWIDE_ROADWAY_RUNTIME_ACTIVE');
});
