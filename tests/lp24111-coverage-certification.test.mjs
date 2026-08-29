import test from 'node:test';
import assert from 'node:assert/strict';
import {artifacts,verify} from '../tools/lp24111/manufacture.mjs';
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
 const nonPlace=a['governed-non-place-coverage.json'];
 if(nonPlace.executionState==='OWNER_LOCAL_MEASURED'){
  const tarkington=nonPlace.rows.find(row=>row.communityKey==='tarkington');
  assert.equal(tarkington.identityClass,'GOVERNED_NON_PLACE');
  assert.equal(tarkington.placeGeoid,null);
 }else{
  assert.equal(nonPlace.governedInventory.total,29);
  assert.equal(nonPlace.tarkington.identityType,'GOVERNED_NON_PLACE');
  assert.equal(nonPlace.tarkington.placeGeoid,null);
 }
 assert.equal(a['lp24110-cohort-reconciliation.json'].rows.length,22);
 assert.equal(RURAL_TAIL.length,15);
 assert.equal(a['metadata-conflicts.json'].retainedSample.classification,'SPATIAL_METADATA_CONFLICT');
 assert.equal(a['metadata-conflicts.json'].retainedSample.sourceRegion,'MO');
 assert.equal(a['attribution-source-inventory.json'].reviewState,'LEGAL_REVIEW_REQUIRED');
 assert.equal(a['osm-supplement-evaluation.json'].merged,false);
 assert.equal(a['certification.json'].productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
 const d4Measured=a['county-coverage.json'].executionState==='OWNER_LOCAL_MEASURED'
  &&Object.values(a['certification.json'].evidenceCompletenessGate??{}).length>0
  &&Object.values(a['certification.json'].evidenceCompletenessGate).every(Boolean);
 assert.equal(a['certification.json'].executiveResult,d4Measured?'PHASE_D4_MEASURED_STATEWIDE_COVERAGE_AND_QUALITY_CERTIFIED':'PHASE_D4_MEASUREMENT_INCOMPLETE');
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

function measuredEnvelope(){
 const absent=artifacts({d4MeasurementsPath:path.join(os.tmpdir(),'lp24111-no-d4-envelope.json')});
 const names=['county-coverage.json','community-radius-coverage.json','governed-non-place-coverage.json','category-accessibility.json','metadata-conflicts.json','brand-coverage.json','rural-tail-coverage.json','lp24110-cohort-reconciliation.json','owner-poc-coverage-reconciliation.json','community-coverage-quality.json','coverage-fanout.json','attribution-source-inventory.json','osm-supplement-evaluation.json','certification.json','exception-ledger.json'];
 const reports=Object.fromEntries(names.map(name=>[name,structuredClone(absent[name])]));
 const radiiMiles={5:{standalonePoiCount:1},10:{standalonePoiCount:1},25:{standalonePoiCount:1}};
 Object.assign(reports['county-coverage.json'],{executionState:'OWNER_LOCAL_MEASURED',expectedCountyCount:254,accountedCountyCount:254,countyAssignmentTotal:391772,unknownCountyAssignments:0});
 delete reports['county-coverage.json'].withoutPois;
 reports['county-coverage.json'].rows=reports['county-coverage.json'].rows.map((row,index)=>({...row,measurement:'OWNER_LOCAL_MEASURED',standalonePoiCount:index===0?391519:1}));
 Object.assign(reports['community-radius-coverage.json'],{executionState:'OWNER_LOCAL_MEASURED',measuredPlaceCount:1859});
 reports['community-radius-coverage.json'].rows=reports['community-radius-coverage.json'].rows.map(row=>({...row,measurement:'OWNER_LOCAL_MEASURED',radiiMiles}));
 const nonPlaceRows=Array.from({length:29},(_,i)=>({stableGovernedIdentity:i===0?'liberty-tx:tarkington':`fixture-${i}`,communityKey:i===0?'tarkington':`fixture-${i}`,displayLabel:i===0?'Tarkington':`Fixture ${i}`,identityClass:'GOVERNED_NON_PLACE',placeGeoid:null,radiiMiles}));
 Object.assign(reports['governed-non-place-coverage.json'],{executionState:'OWNER_LOCAL_MEASURED',measuredCount:29,missingAnchors:0,rows:nonPlaceRows});
 delete reports['governed-non-place-coverage.json'].governedInventory;
 delete reports['governed-non-place-coverage.json'].tarkington;
 Object.assign(reports['metadata-conflicts.json'],{executionState:'OWNER_LOCAL_MEASURED',recordsAudited:391772});
 Object.assign(reports['brand-coverage.json'],{executionState:'OWNER_LOCAL_MEASURED',recordsAudited:391772});
 reports['lp24110-cohort-reconciliation.json'].rows=reports['lp24110-cohort-reconciliation.json'].rows.slice(0,22);
 reports['owner-poc-coverage-reconciliation.json'].rows=[{area:'Dayton / Liberty'},{area:'Tarkington'},{area:'Pecos'}];
 reports['coverage-fanout.json'].executionState='OWNER_LOCAL_MEASURED';
 reports['attribution-source-inventory.json'].executionState='OWNER_LOCAL_MEASURED';
 reports['exception-ledger.json'].exceptions=[{id:'LICENSE_COUNSEL_REVIEW',severity:'BLOCKER'},{id:'LEGAL_REVIEW_REQUIRED',severity:'BLOCKER'}];
 Object.assign(reports['certification.json'],{executiveResult:'PHASE_D4_MEASURED_STATEWIDE_COVERAGE_AND_QUALITY_CERTIFIED',productViability:'OVERTURE_TEXAS_POI_AUTHORITY_VIABLE_WITH_TARGETED_COVERAGE_REFINEMENT',productionPoiSearch:'NOT_LAUNCHED_NOT_CERTIFIED',legalState:'LEGAL_REVIEW_REQUIRED'});
 return {schemaVersion:'gridly.lp24111.measured-coverage.v1',releaseId:'2026-08-19.0',reports};
}

test('D.4 fallback remains truthful and a valid measured envelope reconciles every measured state',()=>{
 const missing=path.join(os.tmpdir(),`missing-d4-${process.pid}.json`);
 const fallback=artifacts({d4MeasurementsPath:missing});
 assert.equal(fallback['county-coverage.json'].executionState,'NOT_EXECUTED_OWNER_LOCAL_INPUTS_ABSENT');
 assert.equal(fallback['certification.json'].executiveResult,'PHASE_D4_MEASUREMENT_INCOMPLETE');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-envelope-')),file=path.join(directory,'phase-d4.json');
 fs.writeFileSync(file,JSON.stringify(measuredEnvelope()));
 const measured=verify({d4MeasurementsPath:file});
 assert.equal(measured['county-coverage.json'].executionState,'OWNER_LOCAL_MEASURED');
 assert.equal(measured['county-coverage.json'].accountedCountyCount,254);
 assert.equal(measured['community-radius-coverage.json'].rows.length,1859);
 assert.equal(measured['governed-non-place-coverage.json'].rows.length,29);
 const tarkington=measured['governed-non-place-coverage.json'].rows.find(row=>row.communityKey==='tarkington');
 assert.deepEqual([tarkington.identityClass,tarkington.placeGeoid],['GOVERNED_NON_PLACE',null]);
 assert.equal(measured['certification.json'].executiveResult,'PHASE_D4_MEASURED_STATEWIDE_COVERAGE_AND_QUALITY_CERTIFIED');
 assert.equal(measured['exception-ledger.json'].exceptions.some(x=>x.id==='REMAINING_PHASE_D_MEASUREMENTS_NOT_EXECUTED'),false);
 assert.ok(measured['exception-ledger.json'].exceptions.some(x=>x.id==='LICENSE_COUNSEL_REVIEW'&&x.severity==='BLOCKER'));
 assert.ok(measured['exception-ledger.json'].exceptions.some(x=>x.id==='LEGAL_REVIEW_REQUIRED'&&x.severity==='BLOCKER'));
 assert.equal(measured['certification.json'].productViability,'OVERTURE_TEXAS_POI_AUTHORITY_VIABLE_WITH_TARGETED_COVERAGE_REFINEMENT');
 assert.equal(measured['certification.json'].zeroCostContract,'NON_RUNTIME');
 assert.equal(measured['certification.json'].legalState,'LEGAL_REVIEW_REQUIRED');
 assert.equal('reason' in measured['county-coverage.json'],false);
 assert.doesNotMatch(JSON.stringify(measured['county-coverage.json']),/NOT_EXECUTED_OWNER_LOCAL_INPUTS_ABSENT|inputs are absent/i);
});

test('D.4 envelope schema, release, report allowlist, and report objects fail closed',()=>{
 const write=envelope=>{const directory=fs.mkdtempSync(path.join(os.tmpdir(),'lp24111-invalid-d4-')),file=path.join(directory,'d4.json');fs.writeFileSync(file,JSON.stringify(envelope));return file;};
 assert.throws(()=>artifacts({d4MeasurementsPath:write({...measuredEnvelope(),schemaVersion:'wrong'})}),/Invalid D\.4 measured envelope/);
 assert.throws(()=>artifacts({d4MeasurementsPath:write({...measuredEnvelope(),releaseId:'latest'})}),/Invalid D\.4 measured release/);
 const unknown=measuredEnvelope();unknown.reports['arbitrary.json']={schemaVersion:'arbitrary.v1'};
 assert.throws(()=>artifacts({d4MeasurementsPath:write(unknown)}),/Unknown D\.4 measured report arbitrary\.json/);
 const malformed=measuredEnvelope();malformed.reports['county-coverage.json']=null;
 assert.throws(()=>artifacts({d4MeasurementsPath:write(malformed)}),/Malformed D\.4 measured report county-coverage\.json/);
});

test('ordinary build wiring cannot execute coverage, fetch, activate runtime, or publish Parquet',()=>{
 const packageJson=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url)));
 assert.equal(packageJson.scripts['build:lp24111'],'node tools/lp24111/manufacture.mjs --write');
 const manufacture=fs.readFileSync(new URL('../tools/lp24111/manufacture.mjs',import.meta.url),'utf8');
 const publisher=fs.readFileSync(new URL('../tools/lp24111/publish-coverage-envelope.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(manufacture,/import\s*\{[^}]*executeCoverage|spawnSync|execSync|fetch\(/i);
 assert.doesNotMatch(publisher,/\.parquet|fetch\(|deploy|activate|spawn/i);
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
 const fixture=path.join(directory,'fail-duckdb.mjs');
 fs.writeFileSync(fixture,"console.error('Binder Error: fixture failure');\nprocess.exit(1);\n");
 const run=duckdbRunner({directory,executable:process.execPath,executableArgs:[fixture]});
 assert.throws(()=>run('MEASURE_PLACES','SELECT invalid'),/Stage MEASURE_PLACES failed: Binder Error: fixture failure/);
 assert.equal(fs.existsSync(path.join(directory,'phase-d4-certified-measurements.json')),false);
});
