import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { P, P1601C, buildArtifacts, detectSourceFormat, resolveDuckDb } from '../tools/lp1601-manufacture-overture-texas-destinations.mjs';

function controlledGeoParquet(){const dir=mkdtempSync(join(tmpdir(),'lp1601c-src-')); const p=join(dir,'CONTROLLED_TEST_FIXTURE.geoparquet'); writeFileSync(p,Buffer.from('PAR1CONTROLLED_TEST_FIXTURE_LP1601C')); return p;}
function fakeDuck({version='v1.5.5',failStage=''}={}){const dir=mkdtempSync(join(tmpdir(),'lp1601c-duck-')); const p=join(dir,'duckdb'); writeFileSync(p,`#!/usr/bin/env node
const fs=require('fs');
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('${version}');process.exit(0)}
const sql=args[args.indexOf('-c')+1]||'';
if('${failStage}' && sql.includes('${failStage}')){console.error('CONTROLLED stderr from '+ '${failStage}');process.exit(7)}
if(sql.includes('DESCRIBE')){console.log('id VARCHAR\\nnames STRUCT\\ncategories STRUCT\\naddresses STRUCT\\ngeometry GEOMETRY\\nconfidence DOUBLE');process.exit(0)}
const m=sql.match(/TO '([^']+)'/); if(m){fs.writeFileSync(m[1], JSON.stringify({id:'tx-duck-1',name:'CONTROLLED_TEST_FIXTURE Duck Store',category:'grocery_store',alternate_categories:['supermarket'],address:'1 Main',locality:'Liberty',postalCode:'77575',latitude:30.05799,longitude:-94.79548,confidence:.9,countyFips:'48291'})+'\\n');}
process.exit(0);
`); chmodSync(p,0o755); return p;}
function shaFileLabel(){return createHash('sha256').update(Buffer.from('PAR1CONTROLLED_TEST_FIXTURE_LP1601C')).digest('hex').toUpperCase();}
const opts={release:'2026-07-22.0',retrievalDate:'2026-08-05',license:'CDLA Permissive 2.0',attribution:'Overture Maps Foundation'};

test('LP160.1C removes hardcoded GeoParquet stop and invokes DuckDB extraction',()=>{const src=controlledGeoParquet(); const a=buildArtifacts({...opts,sourcePath:src,expectedSha256:shaFileLabel(),duckdbPath:fakeDuck(),stagingDirectory:mkdtempSync(join(tmpdir(),'lp1601c-stage-'))}); assert.equal(detectSourceFormat(src).format,'GeoParquet'); assert.equal(a[P1601C.assessment].hardcodedGeoParquetStopRemoved,true); assert.equal(a[P1601C.duckdb].stagesExecuted.some(s=>s.stage==='staged-extraction'),true); assert.equal(a[P.summary].retainedDestinations,1);});

test('LP160.1C hash mismatch fails before DuckDB extraction',()=>{const src=controlledGeoParquet(); assert.throws(()=>buildArtifacts({...opts,sourcePath:src,expectedSha256:'BAD',duckdbPath:fakeDuck()}),/SOURCE_HASH_MISMATCH/);});

test('LP160.1C DuckDB version validation and missing DuckDB failures are clear',()=>{assert.throws(()=>resolveDuckDb({duckdbPath:fakeDuck({version:'v0.9.9'}),env:{DUCKDB_PATH:''}}),/DUCKDB_UNAVAILABLE/); assert.throws(()=>resolveDuckDb({duckdbPath:join(tmpdir(),'definitely-missing-duckdb'),env:{DUCKDB_PATH:''}}),/DUCKDB_UNAVAILABLE/);});

test('LP160.1C surfaces DuckDB stderr and stage name',()=>{const src=controlledGeoParquet(); assert.throws(()=>buildArtifacts({...opts,sourcePath:src,expectedSha256:shaFileLabel(),duckdbPath:fakeDuck({failStage:'DESCRIBE'}),stagingDirectory:mkdtempSync(join(tmpdir(),'lp1601c-stage-'))}),/DUCKDB_STAGE_FAILED:schema-inspection.*CONTROLLED stderr/);});

test('LP160.1C reports all 254 counties and deterministic manifests',()=>{const src=controlledGeoParquet(); const common={...opts,sourcePath:src,expectedSha256:shaFileLabel(),duckdbPath:fakeDuck(),stagingDirectory:mkdtempSync(join(tmpdir(),'lp1601c-stage-'))}; const a=buildArtifacts(common); const b=buildArtifacts(common); assert.equal(a[P1601C.county].counties.length,254); assert.deepEqual(a[P1601C.staging],b[P1601C.staging]); assert.equal(a[P1601C.liberty].productionDestinationRegistryReplaced,false); assert.equal(a[P1601C.assessment].deploymentOccurred,false); assert.equal(a[P1601C.assessment].activationOccurred,false);});
