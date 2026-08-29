import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildD5} from '../tools/lp24111/d5-readiness.mjs';
import {recoverCommittedEvidence,BRANDS,CATEGORIES} from '../tools/lp24111/recover-d5-evidence.mjs';

const report=name=>JSON.parse(fs.readFileSync(new URL(`../reports/lp24111/${name}`,import.meta.url),'utf8'));
const recovered=()=>recoverCommittedEvidence({radius:report('community-radius-coverage.json'),nonPlace:report('governed-non-place-coverage.json'),access:report('category-accessibility.json'),counties:report('county-coverage.json'),metadata:report('metadata-conflicts.json')});

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
 assert.equal(e.quality.status,'NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE');
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
 assert.ok(e.brands.rows.every(x=>x.status==='NOT_RECOVERABLE_FROM_EXISTING_EVIDENCE'));
 assert.equal(e.brands.authorityRole,'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY');
 assert.equal(e.legalState,'LEGAL_REVIEW_REQUIRED');
});

test('D.5A recovery has no upstream, network, merge, coverage execution, or activation path',()=>{
 const source=fs.readFileSync(new URL('../tools/lp24111/recover-d5-evidence.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/fetch\(|https?:\/\/|executeCoverage|execute:lp24111|normalize|taxonomy-review|identity-governance|rich-manufacture|OSM merge|runtimeActivated:true/);
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
