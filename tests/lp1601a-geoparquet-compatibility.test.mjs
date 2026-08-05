import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import test from 'node:test';
import { assignCounty, buildArtifacts, json, P } from '../tools/lp1601a-geoparquet-compatibility.mjs';
function hash(x){return createHash('sha256').update(x).digest('hex')}

test('GeoParquet is the governed real-source format and JSONL cannot complete statewide readiness',()=>{
  const a=buildArtifacts({sourcePath:'data/source/lp160/destination-source-snapshot.json'});
  assert.deepEqual(a[P.contract].acceptedSourceTypes,['.parquet','.geoparquet']);
  assert.ok(a[P.contract].rejectedStatewideSourceTypes.includes('.jsonl'));
  assert.equal(a[P.final].finalClassification,'SOURCE_UNAVAILABLE');
  assert.equal(a[P.sample].fixtureLabel,'CONTROLLED_TEST_FIXTURE');
  assert.equal(a[P.sample].cannotSatisfyManufacturingReadiness,true);
});

test('source identity, hashes, unsupported formats, and schema inspection are deterministic',()=>{
  const a=buildArtifacts();
  const b=buildArtifacts();
  assert.equal(hash(json(a)),hash(json(b)));
  assert.equal(a[P.source].sourceIdentityRequired,true);
  assert.equal(a[P.source].unsupportedInputTypesRejected,true);
  assert.equal(a[P.schema].requiredFieldStatus.id,'REQUIRED');
  assert.equal(a[P.schema].requiredFieldStatus.geometry,'REQUIRED');
  assert.equal(a[P.schema].schemaCompatibilityStatus,'STRUCTURAL_FIXTURE_COMPATIBLE');
});

test('county FIPS is derived by authoritative geometry containment and non-Texas is unresolved',()=>{
  const liberty=assignCounty(-94.79548,30.05799);
  assert.equal(liberty.countyFips,'48291');
  assert.equal(liberty.method,'GEOMETRY_CONTAINMENT');
  const outside=assignCounty(-97.5164,35.4676);
  assert.equal(outside.method,'UNRESOLVED');
});

test('category mapping supports actual nested Overture fields and leaves unmapped values visible',()=>{
  const a=buildArtifacts();
  assert.ok(a[P.mapping].sourceCategoryFields.includes('categories.primary'));
  assert.ok(a[P.mapping].mappings.some(m=>m.sourceCategory==='restaurant'&&m.categoryFamily==='Restaurant'));
  assert.equal(a[P.cat].unmappedPolicy,'UNMAPPED');
  assert.deepEqual(a[P.unmapped].unmappedCategories,[]);
});

test('bounded-memory staging, verification no writes, and owner instructions use source-data GeoParquet with SHA-256',()=>{
  const a=buildArtifacts();
  assert.ok(a[P.memory].prohibitedNodeOperations.some(x=>x.includes('readFileSync')));
  assert.equal(a[P.staging].selectedFormat,'partitioned-jsonl');
  assert.equal(a[P.staging].streamReadable,true);
  assert.equal(a[P.source].networkDuringVerification,false);
  const ps=a[P.owner].powershell.join('\n');
  assert.match(ps,/Gridly-Source-Data/);
  assert.match(ps,/texas-places\.geoparquet/);
  assert.match(ps,/Get-FileHash -Algorithm SHA256/);
  assert.doesNotMatch(ps,/overture-places\.jsonl/);
});

test('Liberty behavior and production boundaries remain protected',()=>{
  const a=buildArtifacts();
  assert.equal(a[P.liberty].status,'PASS');
  assert.equal(a[P.liberty].productionDestinationRegistryReplaced,false);
  assert.equal(a[P.final].deploymentOccurred,false);
  assert.equal(a[P.final].activationOccurred,false);
  assert.equal(a[P.final].runtimeChanged,false);
  assert.equal(a[P.final].protectedArtifactsChanged,false);
});

test('verification performs no writes against generated LP160.1A artifacts',()=>{
  const a=buildArtifacts();
  for(const [p,o] of Object.entries(a)){mkdirSync(p.split('/').slice(0,-1).join('/'),{recursive:true}); writeFileSync(p,json(o));}
  const before=Object.fromEntries(Object.keys(a).map(p=>[p,hash(readFileSync(p))]));
  const afterArtifacts=buildArtifacts();
  const after=Object.fromEntries(Object.keys(afterArtifacts).map(p=>[p,hash(readFileSync(p))]));
  assert.deepEqual(after,before);
});
