import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTROL_FIPS, loadPlan, resolveGdalConfiguration, summarize, verifyCommitted, verifyGdal } from '../tools/lp209/statewide-roadway-candidates.mjs';

test('LP209 plan binds all LP206 counties to certified LP208 identities and protects runtime 28', async()=>{
  const before=await readFile('data/roadway-runtime-manifest.json'); const p=await loadPlan();
  assert.equal(p.rows.length,226); assert.equal(new Set(p.rows.map(x=>x.countyFips)).size,226);
  assert.equal(p.rows.every(x=>x.sourceSha256?.length===64&&x.sourceBytes>0),true);
  assert.equal(p.rows.every(x=>!x.protectedExistingRuntime&&x.manufacturingRequired),true);
  assert.deepEqual(await readFile('data/roadway-runtime-manifest.json'),before);
});
test('committed evidence is conservative and honestly blocked before owner manufacturing',async()=>{
  const v=await verifyCommitted(); assert.equal(v.accounting.planned,226); assert.equal(v.accounting.protectedOverlap,0);
  assert.equal(v.accounting.supabaseWrites,0); assert.equal(v.accounting.runtimeActivations,0);
  assert.equal(v.readiness,'BLOCKED_FOR_STATEWIDE_ROADWAY');
});
test('aggregate requires every owner result and never infers certification',async()=>{
  const p=await loadPlan(); const a=summarize(p.rows,[],p); assert.equal(a.accounting.lp118Successful,0); assert.equal(a.accounting.lp116Manufactured,0); assert.equal(a.accounting.pending,226); assert.equal(a.counties.length,226);
  assert.deepEqual(a.partitionLimits,{targetFeatureCount:35000,targetBytes:10485760,hardFeatureCount:45000,hardBytes:20971520});
  assert.equal(CONTROL_FIPS.length,11); assert.equal(a.readiness,'BLOCKED_FOR_STATEWIDE_ROADWAY');
});

test('owner ogr2ogr executable handoff verifies the exact file and yields the LP118 directory contract', async t => {
  const root=await mkdtemp(join(tmpdir(),'lp209-gdal-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const bin=join(root,'QGIS 3.44.11','bin'); await mkdir(bin,{recursive:true});
  const executable=join(bin,'ogr2ogr.exe'); const marker=join(root,'verified.txt');
  await writeFile(executable,`#!/bin/sh\nprintf '%s' "$0" > '${marker}'\nprintf 'GDAL 3.13.0 "Iowa City", released 2026/05/04\\n'\n`); await chmod(executable,0o755);
  const configuration=await resolveGdalConfiguration(executable);
  assert.equal(configuration.executable,executable); assert.equal(configuration.directory,bin);
  assert.match(await verifyGdal(configuration.executable),/^GDAL 3\.13\.0/);
  assert.equal(await readFile(marker,'utf8'),executable);
  await assert.rejects(resolveGdalConfiguration(join(root,'missing','ogr2ogr.exe')),/does not exist/);
});
