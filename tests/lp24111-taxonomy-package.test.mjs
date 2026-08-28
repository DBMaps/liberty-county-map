import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BEFORE,COMPACT_FIELDS,compactProjection,detectInputs,intersectedShardCount,packageStatistics,policy,shardId,taxonomyDecision} from '../tools/lp24111/taxonomy-review.mjs';

const read=name=>JSON.parse(fs.readFileSync(`reports/lp24111/${name}`));
test('D.2 baseline conserves the certified statewide authority',()=>assert.equal(BEFORE.eligible+BEFORE.nonDestination+BEFORE.excluded+BEFORE.reviewRequired,BEFORE.normalizedUniquePois));
test('taxonomy decisions are explicit, deterministic, and never confidence-only',()=>{
 assert.deepEqual(taxonomyDecision('hardware_store',.01),taxonomyDecision('hardware_store',.99));
 assert.equal(taxonomyDecision('hardware_store',.99).classification,'GRIDLY_ELIGIBLE_DESTINATION');
 assert.equal(taxonomyDecision('unmapped mystery',.999).classification,'GRIDLY_REVIEW_REQUIRED');
 assert.equal(taxonomyDecision('veterinarian animal_hospital pharmacy',.999).classification,'GRIDLY_REVIEW_REQUIRED');
 assert.equal(taxonomyDecision('mountain natural_feature',.999).classification,'GRIDLY_EXCLUDED');
 assert.equal(policy.policy,'EXPLICIT_TAXONOMY_ONLY_CONFIDENCE_NEVER_CLASSIFIES');
});
test('compact projection is eligible-only and has exactly the governed schema',()=>{
 assert.equal(compactProjection({eligibility_class:'GRIDLY_REVIEW_REQUIRED'}),null);
 const projected=compactProjection({eligibility_class:'GRIDLY_ELIGIBLE_DESTINATION',id:'a',display_name:'A',normalized_name:'a',brand_name:null,gridly_category:'FUEL',latitude:30,longitude:-95,county_fips:'48001',locality:'X',operating_status:'open'});
 assert.deepEqual(Object.keys(projected),COMPACT_FIELDS);assert.equal(projected.gridlyCategory,'FUEL');
});
test('package measurements report actual compression thresholds and dense shards deterministically',()=>{
 const rows=[{shardId:'tx-29-096',eligibleRows:20,rawBytes:40,compressedBytes:30*1024**2},{shardId:'tx-30-100',eligibleRows:2,rawBytes:4,compressedBytes:500}];
 const stats=packageStatistics(rows);assert.equal(stats.totalEligibleRows,22);assert.equal(stats.shardsOver25MiB,1);assert.equal(stats.shardsUnder1MiB,1);assert.equal(stats.largestShard.shardId,'tx-29-096');
 assert.equal(shardId(29.2,-95.8),'tx-29-096');assert.ok(intersectedShardCount(30,-95,25)>=intersectedShardCount(30,-95,5));
});
test('absent owner-local inputs remain truthful rather than fabricating D.2 measurements',()=>{
 const found=detectInputs();if(!found.normalized||!found.deduplicated){assert.equal(read('review-taxonomy-census.json').executionState,'NOT_EXECUTED');assert.equal(read('compact-package-measurements.json').statistics,null);}
 assert.equal(read('normalization-summary.json').executionState,'OWNER_LOCAL_MEASURED');
 assert.equal(read('certification.json').productionPoiSearch,'NOT_LAUNCHED_NOT_CERTIFIED');
});
test('D.2 tooling does not alter or activate protected production systems',()=>{
 const source=fs.readFileSync('tools/lp24111/taxonomy-review.mjs','utf8');assert.doesNotMatch(source,/cloudflare|supabase|deploy/i);assert.doesNotMatch(fs.readFileSync('js/app.js','utf8'),/compact-eligible-shards|lp24111-taxonomy/i);
});
