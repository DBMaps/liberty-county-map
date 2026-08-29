import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildD5} from '../tools/lp24111/d5-readiness.mjs';
import {recoverCommittedEvidence,reconcileBrandAggregate,reconcileRichBrandEvidence,reconcileMetadataEvidence,classifyMetadataFamily,BRANDS,CATEGORIES,EXPECTED_STANDALONE_IDS,BRAND_AUTHORITY_ROLE} from '../tools/lp24111/recover-d5-evidence.mjs';

const report=name=>JSON.parse(fs.readFileSync(new URL(`../reports/lp24111/${name}`,import.meta.url),'utf8'));
const recovered=()=>recoverCommittedEvidence({radius:report('community-radius-coverage.json'),nonPlace:report('governed-non-place-coverage.json'),access:report('category-accessibility.json'),counties:report('county-coverage.json'),metadata:report('metadata-conflicts.json')});

test('D.5 evidence recovery CLI uses a cross-platform entrypoint without import or help side effects',()=>{
 const root=fileURLToPath(new URL('..',import.meta.url));
 const entrypoint=path.join(root,'tools/lp24111/recover-d5-evidence.mjs');
 const output=path.join(root,'owner-local/lp24111/phase-d5-recovered-evidence.json');
 const previous=fs.existsSync(output)?fs.readFileSync(output):null;
 try{
  fs.rmSync(output,{force:true});

  const imported=spawnSync(process.execPath,['--input-type=module','--eval',`import(${JSON.stringify(new URL('../tools/lp24111/recover-d5-evidence.mjs?import-regression',import.meta.url).href)})`],{cwd:root,encoding:'utf8'});
  assert.equal(imported.status,0,imported.stderr);
  assert.equal(fs.existsSync(output),false,'importing the module must not write owner evidence');

  const invoked=spawnSync(process.execPath,[entrypoint],{cwd:root,encoding:'utf8'});
  assert.equal(invoked.status,0,invoked.stderr);
  assert.equal(invoked.stdout,`gridly.lp24111.d5.recovered-evidence.v1: ${output}\n`);
  assert.equal(fs.existsSync(output),true,`CLI must write ${output}`);
  assert.equal(JSON.parse(fs.readFileSync(output,'utf8')).schemaVersion,'gridly.lp24111.d5.recovered-evidence.v1');

  fs.rmSync(output,{force:true});
  const help=spawnSync(process.execPath,[entrypoint,'--help'],{cwd:root,encoding:'utf8'});
  assert.equal(help.status,0,help.stderr);
  assert.match(help.stdout,/phase-d5-recovered-evidence\.json/);
  assert.equal(fs.existsSync(output),false,'--help must not write owner evidence');
 }finally{
  if(previous===null)fs.rmSync(output,{force:true});
  else fs.writeFileSync(output,previous);
 }
});

test('D.5 fails closed on missing D.4 quality and brand detail',()=>{
 const d=buildD5();
 assert.equal(d['d5-quality-class-summary.json'].measuredIdentityCount,0);
 assert.equal(d['d5-quality-class-summary.json'].conservationPassed,false);
 assert.equal(d['d5-brand-readiness.json'].complete,false);
 assert.equal(d['d5-certification.json'].executiveResult,'PHASE_D5_READINESS_INCOMPLETE');
});

test('D.5A recovers only deterministic category evidence and fails closed elsewhere',()=>{
 const e=recovered();
 assert.deepEqual([e.quality.expectedRows,e.quality.placeRows,e.quality.nonPlaceRows],[1888,1859,29]);
 assert.equal(e.quality.status,'QUALITY_CLASS_EVIDENCE_NOT_MATERIALIZED');
 assert.equal(e.quality.rows.length,0);
 assert.equal(e.categories.rows.length,CATEGORIES.length);
 assert.equal(e.categories.rows.find(x=>x.category==='CONVENIENCE').accountedCount,1888);
 assert.equal(e.categories.rows.find(x=>x.category==='CONVENIENCE').recoveredZeroRows,1888);
 assert.equal(e.categories.rows.find(x=>x.category==='PHARMACY').accountedCount,1887);
 assert.deepEqual(e.categories.pharmacyRca.exactMissingIdentity,{governedIdentity:'4872248',identityClass:'CANONICAL_PLACE',placeGeoid:'4872248',displayLabel:null});
 assert.equal(e.categories.convenienceRca.classification,'ACTUAL_NO_AUTHORITY_CATEGORY');
 assert.equal(e.metadata.conflict,149);
 assert.equal(e.metadata.retainedSample.name,'Hitachi Energy Jefferson City');
 assert.equal(e.metadata.retainedSample.sourceRegion,'MO');
 assert.equal(e.brands.rows.length,BRANDS.length);
 assert.equal(e.brands.classification,'BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION');
 assert.deepEqual([e.brands.brandFieldPresent,e.brands.populatedBrandRows,e.brands.aggregateArtifactRows],[true,0,0]);
 assert.ok(e.brands.rows.every(x=>x.status==='BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION'&&x.recordCount===null&&x.countyCount===null));
 assert.equal(e.brands.authorityRole,'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY');
 assert.equal(e.legalState,'LEGAL_REVIEW_REQUIRED');
});

test('empty brand projection is not manufactured as zero while a measured aggregate can contain actual zero',()=>{
 assert.equal(reconcileBrandAggregate([]),null);
 const measured=reconcileBrandAggregate([{brand:'Walmart',standalone_record_count:12,counties_represented:4}]);
 assert.equal(measured.rows.find(x=>x.brand==='Walmart').status,'MEASURED_PRESENT');
 assert.equal(measured.rows.find(x=>x.brand==='H-E-B').status,'MEASURED_ZERO');
 const d=buildD5();
 assert.equal(d['d5-brand-readiness.json'].classification,'BRAND_SIGNAL_UNAVAILABLE_IN_D4_PROJECTION');
 assert.ok(d['d5-brand-readiness.json'].rows.every(x=>x.recordCount===null));
});

test('unmaterialized evidence remains fail-closed and recovery plans are narrowly bounded',()=>{
 const e=recovered();
 assert.equal(e.quality.rows.length,0,'quality classes must not be invented');
 assert.equal(e.categories.pharmacyRca.measurementStatus,'PHARMACY_TERLINGUA_MEASUREMENT_NOT_MATERIALIZED');
 assert.equal(e.categories.pharmacyRca.recovered,false,'Terlingua PHARMACY must not be invented');
 assert.equal(e.metadata.families,null,'metadata families must not be inferred');
 assert.equal(e.metadata.retainedSample.name,'Hitachi Energy Jefferson City');
 assert.equal(e.recoveryPlan.brand.population,'EXACT_D4_STANDALONE_IDS_391772');
 assert.equal(e.recoveryPlan.metadata.population,'EXACT_149_D4_CONFLICT_IDS');
});

test('D.5A recovery has no upstream, network, merge, coverage execution, or activation path',()=>{
 const source=fs.readFileSync(new URL('../tools/lp24111/recover-d5-evidence.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|https?:\/\/|executeCoverage|execute:lp24111|normalize.mjs|taxonomy-review|identity-governance|rich-manufacture|OSM merge|runtimeActivated:true/);
});

test('D.5 preserves measured populations, cohorts, rural sparsity, and package measurements',()=>{
 const d=buildD5(),rural=d['d5-rural-tail-readiness.json'];
 assert.equal(rural.rows.length,15);
 assert.equal(rural.sparseAutomaticallyBlocking,false);
 assert.ok(rural.rows.every(x=>x.blockingDataDefect===false));
 assert.equal(d['d5-lp24110-cohort-readiness.json'].rows.length,22);
 assert.equal(d['d5-owner-poc-readiness.json'].rows.length,3);
 assert.deepEqual([d['d5-package-delivery-readiness.json'].standaloneRows,d['d5-package-delivery-readiness.json'].statewideCompressedBytes,d['d5-package-delivery-readiness.json'].largestShardBytes],[391772,24040589,4144301]);
});

test('D.5 category and conflict triage retain measured evidence and source values',()=>{
 const d=buildD5(),categories=d['d5-category-gap-triage.json'];
 assert.equal(categories.source,'reports/lp24111/category-accessibility.json');
 assert.equal(categories.rows.find(x=>x.category==='CONVENIENCE').measuredCommunityCount,0);
 const metadata=d['d5-metadata-conflict-triage.json'];
 assert.equal(metadata.retainedSample.name,'Hitachi Energy Jefferson City');
 assert.equal(metadata.retainedSample.sourceRegion,'MO');
 assert.equal(metadata.sourceFieldsRewritten,false);
});

test('D.5 remains non-runtime, excludes unsafe populations, and distinguishes blockers',()=>{
 const d=buildD5(),contract=d['d5-runtime-authority-contract.json'],ledger=d['d5-activation-blocker-ledger.json'];
 assert.deepEqual(contract.excludedPopulations,['RAW_OVERTURE_AUTHORITY','REVIEW_REQUIRED','SUPPRESSED_CHILDREN','SUPPRESSED_DUPLICATE_MEMBERS']);
 assert.ok(d['d5-activation-guardrails.json'].guards.length>=10);
 assert.ok(ledger.ACTIVATION_BLOCKERS.every(x=>x.blocking));
 assert.ok(ledger.POST_ACTIVATION_REFINEMENT_BACKLOG.every(x=>!x.blocking));
 assert.equal(d['d5-osm-supplement-decision.json'].merged,false);
 assert.equal(d['d5-legal-attribution-readiness.json'].legalState,'LEGAL_REVIEW_REQUIRED');
 assert.equal(d['d5-certification.json'].productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
 assert.equal(d['d5-certification.json'].runtimeActivated,false);
 const source=fs.readFileSync(new URL('../tools/lp24111/d5-readiness.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|https?:\/\/|execSync|spawnSync/);
});


test('D.5D rich brand recovery conserves the standalone authority and distinguishes unavailable from measured zero',()=>{
 const result=reconcileRichBrandEvidence({conservation:{standalone_rows:EXPECTED_STANDALONE_IDS,unique_standalone_ids:EXPECTED_STANDALONE_IDS,joined_richer_ids:EXPECTED_STANDALONE_IDS-2,duplicate_richer_ids:0,rows_with_brand:25,distinct_brands:4},aggregates:[{brand:'Walmart',record_count:20,county_count:8},{brand:'H-E-B',record_count:5,county_count:3}]});
 assert.equal(result.joinConservation.missingRicherIds,2);
 assert.equal(result.rows.find(x=>x.brand==='Walmart').status,'MEASURED_PRESENT');
 assert.equal(result.rows.find(x=>x.brand==='Shell').status,'MEASURED_ZERO');
 assert.equal(result.globalSummary.requestedBrandsPresent,2);
 assert.equal(result.globalSummary.requestedBrandsZero,18);
 assert.equal(result.authorityRole,BRAND_AUTHORITY_ROLE);
 assert.deepEqual(result.precedence,['brand.names.primary',"brand.names.common['en']"]);
 assert.throws(()=>reconcileRichBrandEvidence({conservation:{standalone_rows:EXPECTED_STANDALONE_IDS,unique_standalone_ids:EXPECTED_STANDALONE_IDS,joined_richer_ids:EXPECTED_STANDALONE_IDS,duplicate_richer_ids:1},aggregates:[]}),/DUPLICATE_ID_GATE/);
 assert.throws(()=>reconcileRichBrandEvidence({conservation:{standalone_rows:20,unique_standalone_ids:20},aggregates:[]}),/STANDALONE_CONSERVATION/);
});

test('D.5D metadata assigns each of the exact 149 IDs once and preserves Hitachi source evidence',()=>{
 const rows=Array.from({length:149},(_,i)=>({id:`id-${i}`,name:i===0?'Hitachi Energy Jefferson City':`record-${i}`,richerMatched:true,regionConflict:i%4===0,localityConflict:i%4===1,postcodeConflict:i%4===2,sourceRegion:i===0?'MO':'TX',sourceLocality:i===0?'Jefferson City':'local',sourcePostcode:i===0?'65101-5032':'75001'}));
 rows.filter((x,i)=>i%4===3).forEach(x=>{x.regionConflict=true;x.localityConflict=true;});
 rows[0].postcodeConflict=true;
 const result=reconcileMetadataEvidence(rows);
 assert.equal(result.joinConservation.conflictIdsInput,149);
 assert.equal(result.joinConservation.familyCountSum,149);
 assert.equal(result.joinConservation.duplicateClassifications,0);
 assert.equal(result.joinConservation.unexplainedConflictIds,0);
 assert.equal(result.hitachi.family,'MULTI_FIELD_CONFLICT');
 assert.deepEqual([result.hitachi.sourceRegion,result.hitachi.sourceLocality,result.hitachi.sourcePostcode],['MO','Jefferson City','65101-5032']);
 assert.equal(result.sourceFieldsRewritten,false);
 assert.equal(classifyMetadataFamily({regionConflict:true}),'STATE_REGION_CONFLICT');
 assert.equal(classifyMetadataFamily({localityConflict:true}),'LOCALITY_CONFLICT');
 assert.equal(classifyMetadataFamily({postcodeConflict:true}),'POSTCODE_CONFLICT');
 assert.equal(classifyMetadataFamily({regionConflict:true,postcodeConflict:true}),'MULTI_FIELD_CONFLICT');
});

test('D.5D recovery source is bounded to local ID joins and preserves legal and production boundaries',()=>{
 const source=fs.readFileSync(new URL('../tools/lp24111/recover-d5-evidence.mjs',import.meta.url),'utf8');
 assert.match(source,/LEGAL_REVIEW_REQUIRED/);
 assert.match(source,/DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY/);
 assert.doesNotMatch(source,/fetch\(|https?:\/\/|ST_Distance|OSM|runtimeActivated:true|productionBehaviorChanged:true/);
});
