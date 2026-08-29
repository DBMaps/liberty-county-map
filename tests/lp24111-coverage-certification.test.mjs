import test from 'node:test';
import assert from 'node:assert/strict';
import {artifacts} from '../tools/lp24111/manufacture.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {haversineMiles,radiusCounts,metadataClassification,shardFanout,RURAL_TAIL,validateEnvelope,anchorMeasurementQuery,coverageSql,duckdbRunner} from '../tools/lp24111/coverage-certification.mjs';

test('D.4 governed inventories and fail-closed boundaries are preserved',()=>{
 const a=artifacts();
 assert.equal(a['county-coverage.json'].rows.length,254);
 assert.equal(a['community-radius-coverage.json'].rows.length,1859);
 assert.equal(a['governed-non-place-coverage.json'].expectedCount,29);
 assert.equal(a['governed-non-place-coverage.json'].tarkington.identityType,'GOVERNED_NON_PLACE');
 assert.equal(a['governed-non-place-coverage.json'].tarkington.placeGeoid,null);
 assert.equal(a['lp24110-cohort-reconciliation.json'].rows.length,22);
 assert.equal(RURAL_TAIL.length,15);
 assert.equal(a['metadata-conflicts.json'].retainedSample.classification,'SPATIAL_METADATA_CONFLICT');
 assert.equal(a['metadata-conflicts.json'].retainedSample.sourceRegion,'MO');
 assert.equal(a['attribution-source-inventory.json'].reviewState,'LEGAL_REVIEW_REQUIRED');
 assert.equal(a['osm-supplement-evaluation.json'].merged,false);
 assert.equal(a['certification.json'].productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
 assert.equal(a['certification.json'].executiveResult,'PHASE_D4_MEASUREMENT_INCOMPLETE');
});

test('radius, nearest category, metadata, and fanout calculations are deterministic',()=>{
 const anchor={latitude:30,longitude:-95},pois=[{latitude:30,longitude:-95,category:'FUEL'},{latitude:30.1,longitude:-95,category:'GROCERY'}];
 assert.equal(haversineMiles(anchor,anchor),0);
 assert.deepEqual(radiusCounts(anchor,pois,'FUEL'),{nearestMiles:0,within5:1,within10:1,within25:1});
 assert.equal(radiusCounts(anchor,pois,'GROCERY').nearestMiles,haversineMiles(anchor,pois[1]));
 assert.equal(metadataClassification({sourceRegion:'MO',sourceLocality:'Jefferson City',sourcePostcode:'65101-5032'}),'SPATIAL_METADATA_CONFLICT');
 assert.equal(shardFanout(anchor,25),shardFanout(anchor,25));
});

test('certification envelope fails closed when measurements are absent',()=>{
 const result=validateEnvelope({reports:{}});
 assert.equal(result.passed,false);
 assert.ok(Object.values(result.gates).some(value=>!value));
});

const duckdb=process.env.DUCKDB||'duckdb';
const hasDuckdb=spawnSync(duckdb,['--version'],{encoding:'utf8'}).status===0;
const sqlQuote=value=>`'${String(value).replaceAll("'","''")}'`;
const runDuck=(database,sql,json=true)=>{
 const result=spawnSync(duckdb,[database,'-batch','-noheader',...(json?['-json']:[]),'-c',sql],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 return json&&result.stdout.trim()?JSON.parse(result.stdout):[];
};

test('production D.4 SQL parses and measures PLACE and non-PLACE fixtures',{skip:!hasDuckdb},()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-d4-sql-')),database=path.join(directory,'test.duckdb');
 const places=path.join(directory,'places.json'),nonPlaces=path.join(directory,'non-places.json');
 fs.writeFileSync(places,JSON.stringify([
  {communityId:'4800001',identityClass:'CANONICAL_PLACE',placeGeoid:'4800001',displayLabel:'Fixture Place',stableGovernedIdentity:null,latitude:30,longitude:-95},
  {communityId:'4800002',identityClass:'CANONICAL_PLACE',placeGeoid:'4800002',displayLabel:'Zero Place',stableGovernedIdentity:null,latitude:31,longitude:-96}
 ]));
 fs.writeFileSync(nonPlaces,JSON.stringify([{communityId:null,identityClass:'GOVERNED_NON_PLACE',placeGeoid:null,displayLabel:'Tarkington',stableGovernedIdentity:'liberty-tx:tarkington',countyId:'liberty-tx',latitude:30,longitude:-95}]));
 const setup=`CREATE TABLE poi(id VARCHAR,display_name VARCHAR,brand_text VARCHAR,gridly_category VARCHAR,latitude DOUBLE,longitude DOUBLE,county_fips VARCHAR,locality VARCHAR,address_text VARCHAR); INSERT INTO poi VALUES ('p1','Fuel One','Brand A','FUEL',30,-95,'48001','Here',''),('p2','Grocery','', 'GROCERY',30.1,-95,'48001','',''),('p3','Fuel Far','Brand A','FUEL',30.3,-95,'48003','There','Missouri MO');`;
 runDuck(database,setup,false);
 const placeOut=path.join(directory,'places.parquet'),nonPlaceOut=path.join(directory,'non-places.parquet');
 runDuck(database,anchorMeasurementQuery(places,placeOut),false);
 runDuck(database,anchorMeasurementQuery(nonPlaces,nonPlaceOut),false);
 const rows=runDuck(database,`SELECT * FROM read_parquet(${sqlQuote(placeOut)}) ORDER BY communityId`);
 assert.equal(rows.length,2);
 assert.deepEqual([Number(rows[0].within_5),Number(rows[0].within_10),Number(rows[0].within_25)],[1,2,3]);
 assert.deepEqual([Number(rows[0].fuel_5),Number(rows[0].fuel_10),Number(rows[0].fuel_25)],[1,1,2]);
 assert.deepEqual([Number(rows[1].within_5),Number(rows[1].within_10),Number(rows[1].within_25)],[0,0,0]);
 const tarkington=runDuck(database,`SELECT * FROM read_parquet(${sqlQuote(nonPlaceOut)})`)[0];
 assert.equal(tarkington.identityClass,'GOVERNED_NON_PLACE');
 assert.equal(tarkington.placeGeoid,null);
 assert.equal(tarkington.stableGovernedIdentity,'liberty-tx:tarkington');
 // Execute every SQL family used downstream, not merely inspect its text.
 assert.equal(runDuck(database,coverageSql.counties()).length,2);
 assert.ok(runDuck(database,coverageSql.accessibility(places)).length>0);
 assert.equal(runDuck(database,coverageSql.brands()).length,1);
 assert.equal(runDuck(database,coverageSql.metadata()).length,3);
 assert.equal(runDuck(database,coverageSql.metadataInventory()).length,3);
 assert.doesNotMatch(anchorMeasurementQuery(places,placeOut),/count\(p\./);
});

test('DuckDB runner reports the first SQL stage and does not continue',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-fail-fast-'));
 const executable=path.join(directory,'fail-duckdb.sh');
 fs.writeFileSync(executable,"#!/bin/sh\necho 'Binder Error: fixture failure' >&2\nexit 1\n",{mode:0o755});
 const run=duckdbRunner({directory,executable});
 assert.throws(()=>run('MEASURE_PLACES','SELECT invalid'),/Stage MEASURE_PLACES failed: Binder Error: fixture failure/);
 assert.equal(fs.existsSync(path.join(directory,'phase-d4-certified-measurements.json')),false);
});
