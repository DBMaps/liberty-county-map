import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {contracts,resolveShards,evaluateGate,rollback,MAX_SHARD_FANOUT} from '../tools/lp24112/runtime-activation-design.mjs';
const c=contracts();

test('authority and compact schema admit only governed standalone POIs',()=>{
 const a=c['lp24112-runtime-data-contract.json'];
 assert.equal(a.authority.rowCount,391772);
 for(const population of ['D2_REVIEW_REQUIRED','CHILD_POI','SUPPRESSED_DUPLICATE_MEMBER'])assert.ok(a.authority.excluded.includes(population));
 assert.deepEqual(Object.keys(a.record.required),['id','displayName','gridlyCategory','latitude','longitude','countyContextId','communityIdentity']);
 assert.ok(a.fieldsForbidden.includes('suppressedMembers'));
});
test('shard resolution is deterministic, unique, ordered, and bounded',()=>{
 for(const radiusMiles of [5,10,25]){const first=resolveShards({latitude:30.3205,longitude:-94.996,radiusMiles});assert.deepEqual(first,resolveShards({latitude:30.3205,longitude:-94.996,radiusMiles}));assert.deepEqual(first,[...new Set(first)].sort());assert.ok(first.length<=MAX_SHARD_FANOUT);}
 assert.throws(()=>resolveShards({latitude:31,longitude:-99,radiusMiles:100}),/UNBOUNDED_RADIUS/);
});
test('search is local, sorted, result-bounded, and explicit about zero and invalid states',()=>{
 const s=c['lp24112-search-bounds.json'],z=c['lp24112-zero-result-contract.json'];
 assert.equal(s.wholeTexasSearch,'PROHIBITED');assert.equal(s.maximumRadiusMiles,25);assert.equal(s.maximumResultCount,50);
 assert.equal(z.state,'SUCCESS_WITH_ZERO_RESULTS');assert.equal(z.shardFailureIsNotZeroResult,true);
 assert.throws(()=>resolveShards({latitude:NaN,longitude:-99,radiusMiles:10}),/INVALID_COORDINATES/);
});
test('identity, metadata, and brand authority remain governed',()=>{
 const i=c['lp24112-identity-context-contract.json'],m=c['lp24112-metadata-presentation-guardrails.json'],b=c['lp24112-brand-presentation.json'];
 assert.deepEqual(i.tarkington,{identityDisposition:'GOVERNED_NON_PLACE',communityId:'liberty-tx:tarkington',placeGeoid:null});
 assert.equal(m.stateTokenInferenceCanOverride,false);assert.equal(m.rewriteOriginalSourceMetadata,false);
 assert.equal(b.authorityRole,'DESCRIPTIVE_ONLY_NOT_IDENTITY_OR_LAUNCH_AUTHORITY');assert.ok(Object.values(b.determines).every(x=>x===false));
});
test('gate defaults off, mismatches fail closed, and rollback restores prior provider',()=>{
 const g=c['lp24112-feature-gate-design.json'];assert.equal(g.default.state,'OFF');assert.equal(g.default.runtimeActivated,false);
 assert.equal(evaluateGate({provider:'GRIDLY_GOVERNED_POI',environmentEnabled:true,manifestApproved:true,legalClearance:true,authorityReleaseId:'wrong',schemaVersion:'gridly.poi.runtime.v1'}).active,false);
 assert.equal(rollback().provider,'PREVIOUS_RUNTIME');assert.equal(rollback().runtimeActivated,false);
});
test('diagnostics, legal boundary, acceptance cohorts, and non-runtime certification are complete',()=>{
 const d=c['lp24112-runtime-diagnostics-contract.json'],legal=c['lp24112-legal-ready-integration.json'],cert=c['lp24112-certification.json'];
 for(const field of ['authorityReleaseId','loadedShardIds','radiusMiles','communityIdentity','countyContext'])assert.ok(d.fields.includes(field));
 assert.equal(legal.legalState,'LEGAL_REVIEW_REQUIRED');assert.equal(cert.runtimeActivated,false);assert.equal(cert.deployed,false);assert.equal(cert.productionSupabaseMutation,false);
 assert.equal(c['lp24112-activation-acceptance-plan.json'].cohorts.length,14);
});
test('tool contains no deployment, remote fetch, or production database mutation path',()=>{
 const source=fs.readFileSync(new URL('../tools/lp24112/runtime-activation-design.mjs',import.meta.url),'utf8');
 assert.doesNotMatch(source,/\bfetch\s*\(|supabase\.from|wrangler\s+deploy|execSync|spawnSync/);
});
