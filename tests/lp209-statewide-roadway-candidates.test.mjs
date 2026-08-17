import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONTROL_FIPS, assertManufacturingComplete, loadPlan, resolveGdalConfiguration, summarize, verifyCommitted, verifyGdal } from '../tools/lp209/statewide-roadway-candidates.mjs';
import { COMPATIBILITY_FIPS, canonicalManifestIdentity, certifyCandidate, compareControl, finalReadiness, runCertificationChecks } from '../tools/lp209/final-certification.mjs';

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

test('manufacturing completion is independent from pending final certification and remains fail closed',()=>{
  const manufacturing={
    readiness:'BLOCKED_FOR_STATEWIDE_ROADWAY',
    accounting:{planned:226,lp118Successful:226,lp116Manufactured:226,certified:226,failed:0,pending:0,protectedOverlap:0,supabaseWrites:0,runtimeActivations:0,productionPackageModifications:0},
    productionRuntimeManifest:{unchanged:true,countyCountBefore:28,countyCountAfter:28}
  };
  assert.equal(assertManufacturingComplete(manufacturing),manufacturing);
  assert.equal(finalReadiness(manufacturing,[],[]),'BLOCKED_FOR_STATEWIDE_ROADWAY');
  const controls=CONTROL_FIPS.map(countyFips=>({countyFips,determinismStatus:'PASS'}));
  assert.equal(finalReadiness(manufacturing,controls,[]),'BLOCKED_FOR_STATEWIDE_ROADWAY');
  const compatibility=COMPATIBILITY_FIPS.map(countyFips=>({countyFips,status:'PASS'}));
  assert.equal(finalReadiness(manufacturing,controls,compatibility),'READY_FOR_STATEWIDE_ROADWAY_PUBLICATION');

  const subset=structuredClone(manufacturing);
  Object.assign(subset.accounting,{lp118Successful:11,lp116Manufactured:11,certified:11,pending:215});
  assert.equal(assertManufacturingComplete(subset,{expectedCount:11,subset:true}),subset);

  for(const patch of [
    {lp118Successful:225,lp116Manufactured:225,certified:225,pending:1},
    {lp118Successful:226,lp116Manufactured:225,certified:225,failed:1,pending:1}
  ]) {
    const incomplete=structuredClone(manufacturing); Object.assign(incomplete.accounting,patch);
    assert.throws(()=>assertManufacturingComplete(incomplete),/manufacturing is incomplete/);
  }
  const changed=structuredClone(manufacturing); changed.productionRuntimeManifest.unchanged=false;
  assert.throws(()=>assertManufacturingComplete(changed),/production runtime changed/);
  const mutatedSubset=structuredClone(subset); mutatedSubset.accounting.productionPackageModifications=1;
  assert.throws(()=>assertManufacturingComplete(mutatedSubset,{expectedCount:11,subset:true}),/production mutation occurred/);
});

test('final certification runs determinism before compatibility and gates readiness at each stage',async()=>{
  const events=[];
  const manufacturing={accounting:{lp118Successful:226,lp116Manufactured:226,certified:226,failed:0,pending:0,supabaseWrites:0,runtimeActivations:0,productionPackageModifications:0},productionRuntimeManifest:{unchanged:true,countyCountAfter:28}};
  const result=await runCertificationChecks({manufacturing,
    runDeterminism:async()=>{events.push('determinism');return CONTROL_FIPS.map(countyFips=>({countyFips,determinismStatus:'PASS'}));},
    runCompatibility:async()=>{events.push('compatibility');return COMPATIBILITY_FIPS.map(countyFips=>({countyFips,status:'PASS'}));}
  });
  assert.deepEqual(events,['determinism','compatibility']);
  assert.equal(result.readinessAfterDeterminism,'BLOCKED_FOR_STATEWIDE_ROADWAY');
  assert.equal(result.readiness,'READY_FOR_STATEWIDE_ROADWAY_PUBLICATION');
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
  const manifestBody=Buffer.from(JSON.stringify({schemaVersion:'v1',county:{fips:'48287'},source:{path:'primary/lp118/48287/source.geojson',sha256:'s'.repeat(64),bytes:10},featureCount:2,packages:[{fileName:'p.geojson',featureCount:2,bytes:30,sha256:'c'.repeat(64)}]},null,2)+'\n');
  const checkpoint={row,manifestBody,x:{output:{sha256:'b'.repeat(64),sizeBytes:20}},m:{certificationStatus:'PASS',packages:[{fileName:'p.geojson',featureCount:2,byteLength:30,sha256:'c'.repeat(64)}],manifest:{sha256:'d'.repeat(64),sizeBytes:manifestBody.length}}};
  assert.equal(compareControl(row,checkpoint,structuredClone(checkpoint)).determinismStatus,'PASS');
  const changed=structuredClone(checkpoint); changed.m.packages[0].sha256='e'.repeat(64);
  assert.equal(compareControl(row,checkpoint,changed).determinismStatus,'FAIL');
});

test('manifest identity canonicalizes only source.path and preserves raw evidence',()=>{
  const manifest={schemaVersion:'v1',county:{id:'bexar',fips:'48029'},source:{path:'owner-local/primary/lp118/48029/a.geojson',sha256:'a'.repeat(64),bytes:100,authority:'Census',vintage:2025},featureCount:7,partitionCount:1,packages:[{fileName:'part.geojson',featureCount:7,bytes:200,sha256:'b'.repeat(64)}]};
  const primary=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  manifest.source.path='owner-local/determinism/lp118/48029/a.geojson';
  const rerun=Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  assert.notEqual(createHash('sha256').update(primary).digest('hex'),createHash('sha256').update(rerun).digest('hex'));
  assert.deepEqual(canonicalManifestIdentity(primary),canonicalManifestIdentity(rerun));
});

test('manifest canonical identity fails closed for every semantic or unexpected field change',()=>{
  const base={schemaVersion:'v1',county:{id:'bexar',fips:'48029'},source:{path:'workspace/a',sha256:'a'.repeat(64),bytes:100},featureCount:7,packages:[{fileName:'part.geojson',featureCount:7,bytes:200,sha256:'b'.repeat(64)}]};
  const identity=x=>canonicalManifestIdentity(JSON.stringify(x)).sha256;
  for(const mutate of [
    x=>x.source.sha256='c'.repeat(64), x=>x.packages[0].sha256='d'.repeat(64), x=>x.featureCount=8,
    x=>x.county.fips='48113', x=>x.outputPath='different/workspace/path'
  ]){const changed=structuredClone(base);mutate(changed);assert.notEqual(identity(base),identity(changed));}
});

test('isolated compatibility harness loads, finds, names, and associates an owner-shaped candidate',async t=>{
  const root=await mkdtemp(join(tmpdir(),'lp209-candidate-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const path=join(root,'candidate.geojson'); await writeFile(path,JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Main Street'},geometry:{type:'LineString',coordinates:[[-96,32],[-95.9,32.1]]}}]}));
  const result=await certifyCandidate(path,'48113'); assert.equal(result.status,'PASS');
  assert.equal(result.roadwayLoader,'PASS'); assert.equal(result.nearestRoadLookup,'PASS'); assert.equal(result.roadNameExtraction,'PASS'); assert.equal(result.hazardReportRoadAssociation,'PASS');
});
