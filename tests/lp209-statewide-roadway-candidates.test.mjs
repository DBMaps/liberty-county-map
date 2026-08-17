import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTROL_FIPS, loadPlan, resolveGdalConfiguration, summarize, verifyCommitted, verifyGdal } from '../tools/lp209/statewide-roadway-candidates.mjs';
import { COMPATIBILITY_FIPS, certifyCandidate, compareControl, finalReadiness } from '../tools/lp209/final-certification.mjs';

test('LP209 plan binds all LP206 counties to certified LP208 identities and protects runtime 28', async()=>{
  const before=await readFile('data/roadway-runtime-manifest.json'); const p=await loadPlan();
  assert.equal(p.rows.length,226); assert.equal(new Set(p.rows.map(x=>x.countyFips)).size,226);
  assert.equal(p.rows.every(x=>x.sourceSha256?.length===64&&x.sourceBytes>0),true);
  assert.equal(p.rows.every(x=>!x.protectedExistingRuntime&&x.manufacturingRequired),true);
  assert.deepEqual(await readFile('data/roadway-runtime-manifest.json'),before);
});
test('committed evidence records complete owner manufacturing but stays blocked for final owner checks',async()=>{
  const v=await verifyCommitted(); assert.equal(v.accounting.planned,226); assert.equal(v.accounting.protectedOverlap,0);
  assert.equal(v.accounting.lp118Successful,226); assert.equal(v.accounting.lp116Manufactured,226); assert.equal(v.accounting.certified,226); assert.equal(v.accounting.pending,0);
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

test('final readiness requires manufacturing, determinism, compatibility, and production safety together',()=>{
  const manufacturing={accounting:{lp118Successful:226,lp116Manufactured:226,certified:226,failed:0,pending:0,supabaseWrites:0,runtimeActivations:0,productionPackageModifications:0},productionRuntimeManifest:{unchanged:true,countyCountAfter:28}};
  const controls=CONTROL_FIPS.map(countyFips=>({countyFips,determinismStatus:'PASS'}));
  const compatibility=COMPATIBILITY_FIPS.map(countyFips=>({countyFips,status:'PASS'}));
  assert.equal(finalReadiness(manufacturing,controls,compatibility),'READY_FOR_STATEWIDE_ROADWAY_PUBLICATION');
  controls[0].determinismStatus='FAIL'; assert.equal(finalReadiness(manufacturing,controls,compatibility),'BLOCKED_FOR_STATEWIDE_ROADWAY');
});

test('control comparison uses governed hashes/bytes and ordered LP116 package identity',()=>{
  const row={countyFips:'48287',countyId:'lee',sourceSha256:'a'.repeat(64),sourceBytes:10};
  const checkpoint={row,x:{output:{sha256:'b'.repeat(64),sizeBytes:20}},m:{certificationStatus:'PASS',packages:[{fileName:'p.geojson',featureCount:2,byteLength:30,sha256:'c'.repeat(64)}],manifest:{sha256:'d'.repeat(64),sizeBytes:40}}};
  assert.equal(compareControl(row,checkpoint,structuredClone(checkpoint)).determinismStatus,'PASS');
  const changed=structuredClone(checkpoint); changed.m.packages[0].sha256='e'.repeat(64);
  assert.equal(compareControl(row,checkpoint,changed).determinismStatus,'FAIL');
});

test('isolated compatibility harness loads, finds, names, and associates an owner-shaped candidate',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp209-candidate-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const path=join(root,'candidate.geojson'); await writeFile(path,JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Main Street'},geometry:{type:'LineString',coordinates:[[-96,32],[-95.9,32.1]]}}]}));
  const result=await certifyCandidate(path,'48113'); assert.equal(result.status,'PASS');
  assert.equal(result.roadwayLoader,'PASS'); assert.equal(result.nearestRoadLookup,'PASS'); assert.equal(result.roadNameExtraction,'PASS'); assert.equal(result.hazardReportRoadAssociation,'PASS');
});
