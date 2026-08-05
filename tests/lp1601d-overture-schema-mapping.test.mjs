import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { P, P1601C, P1601D, OVERTURE_2026_07_22_SCHEMA_ADAPTER, assertNoNumericOvertureMapAccess, buildArtifacts, buildOverture20260722ExtractionSql } from '../tools/lp1601-manufacture-overture-texas-destinations.mjs';

function controlledGeoParquet(){const dir=mkdtempSync(join(tmpdir(),'lp1601d-src-')); const p=join(dir,'CONTROLLED_TEST_FIXTURE.geoparquet'); writeFileSync(p,Buffer.from('PAR1CONTROLLED_TEST_FIXTURE_LP1601D')); return p;}
function fixtureSha(){return createHash('sha256').update(Buffer.from('PAR1CONTROLLED_TEST_FIXTURE_LP1601D')).digest('hex').toUpperCase();}
function fakeDuck(){const dir=mkdtempSync(join(tmpdir(),'lp1601d-duck-')); const p=join(dir,'duckdb'); writeFileSync(p,`#!/usr/bin/env node
const fs=require('fs'); const args=process.argv.slice(2);
if(args.includes('--version')){console.log('v1.5.5');process.exit(0)}
const sql=args[args.indexOf('-c')+1]||'';
if(/names\\[1\\]|names\\.common\\[1\\]|brand\\.names\\.common\\[1\\]|map_extract_value\\([^,]+,\\s*1\\)/.test(sql)){console.error('numeric map access regression');process.exit(9)}
if(sql.includes('DESCRIBE')){console.log('id VARCHAR\\nnames STRUCT(primary VARCHAR, common MAP(VARCHAR, VARCHAR))\\ncategories STRUCT(primary VARCHAR, alternate VARCHAR[])\\naddresses STRUCT(freeform VARCHAR, locality VARCHAR, postcode VARCHAR, region VARCHAR)\\nbrand STRUCT(wikidata VARCHAR, names STRUCT(primary VARCHAR, common MAP(VARCHAR, VARCHAR)))\\nconfidence DOUBLE\\ngeometry GEOMETRY');process.exit(0)}
const m=sql.match(/TO '([^']+)'/); if(m){fs.writeFileSync(m[1], [
 JSON.stringify({id:'tx-primary',name:'Primary Store',name_source:'PRIMARY',primary_name:'Primary Store',common_name_en:'English Store',common_names:{en:'English Store',es:'Tienda'},primary_category:'unknown_primary',alternate_categories:['grocery_store','supermarket'],brand_wikidata:'Q1',brand_primary:'Brand Primary',brand_common_en:'Brand EN',brand_name:'Brand Primary',brand_name_source:'PRIMARY',brand_common_names:{en:'Brand EN'},formatted_address:'1 Main',locality:'Liberty',postcode:'77575',region:'TX',confidence:.91,longitude:-94.79548,latitude:30.05799,geometry_valid:true,lifecycle_status:'UNKNOWN',countyFips:'48291'}),
 JSON.stringify({id:'tx-common',name:'Common Cafe',name_source:'COMMON_EN',primary_name:null,common_name_en:'Common Cafe',common_names:{en:'Common Cafe'},primary_category:'restaurant',alternate_categories:[],brand_wikidata:null,brand_primary:null,brand_common_en:null,brand_name:null,brand_name_source:'UNRESOLVED',brand_common_names:null,formatted_address:null,locality:null,postcode:null,region:null,confidence:null,longitude:-95.3698,latitude:29.7604,geometry_valid:true,lifecycle_status:'UNKNOWN',countyFips:'48201'})
].join('\\n')+'\\n');}
process.exit(0);
`); chmodSync(p,0o755); return p;}
const opts={release:'2026-07-22.0',retrievalDate:'2026-08-05',license:'CDLA Permissive 2.0',attribution:'Overture Maps Foundation'};

test('LP160.1D adapter uses inspected struct/map schema and string-key map access',()=>{const sql=buildOverture20260722ExtractionSql("'source.geoparquet'","'out.jsonl'"); assertNoNumericOvertureMapAccess(sql); assert.match(sql,/COALESCE\(names\.primary, map_extract_value\(names\.common, 'en'\)\)/); assert.match(sql,/brand\.names\.primary/); assert.match(sql,/map_extract_value\(brand\.names\.common, 'en'\)/); assert.match(sql,/addresses\.freeform/); assert.match(sql,/categories\.primary/); assert.match(sql,/categories\.alternate/); assert.match(sql,/ST_X\(geometry\).*longitude/); assert.match(sql,/ST_Y\(geometry\).*latitude/); assert.equal(OVERTURE_2026_07_22_SCHEMA_ADAPTER.verifiedSchema.names.includes('MAP(VARCHAR, VARCHAR)'),true); assert.throws(()=>assertNoNumericOvertureMapAccess('SELECT names[1].value, map_extract_value(names.common, 1)'),/NUMERIC_MAP_ACCESS/);});

test('LP160.1D staged normalization consumes corrected fields and alternate category mapping',()=>{const src=controlledGeoParquet(); const a=buildArtifacts({...opts,sourcePath:src,expectedSha256:fixtureSha(),duckdbPath:fakeDuck(),stagingDirectory:mkdtempSync(join(tmpdir(),'lp1601d-stage-'))}); assert.equal(a[P1601D.final].finalClassification,'SCHEMA_MAPPING_COMPLETE'); assert.equal(a[P1601D.compat].numericMapAccessAbsent,true); assert.equal(a[P.summary].retainedDestinations,2); const primary=a[P.registry].destinations.find(d=>d.sourceId==='tx-primary'); assert.equal(primary.categoryFamily,'Retail'); assert.equal(primary.lifecycle,'UNKNOWN'); assert.equal(primary.longitude,-94.79548); assert.equal(primary.latitude,30.05799); assert.ok(primary.searchAliases.includes('Brand Primary')); assert.ok(primary.searchAliases.includes('English Store')); assert.equal(a[P1601C.schema].selectedExtractionExpressions.geometry,'ST_X/ST_Y(geometry)'); assert.equal(a[P1601D.adapter].release,'2026-07-22.0'); assert.equal(a[P1601D.smoke].checks.jsonLinesParsed,true);});
