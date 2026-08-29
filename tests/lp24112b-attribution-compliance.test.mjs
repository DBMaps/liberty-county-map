import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {identity,providerEligible,reports,verify} from '../tools/lp24112b/attribution-compliance.mjs';

const r=reports();
test('runtime license combinations conserve exactly without an Apache-only combination',()=>{
 const e=r['lp24112b-runtime-license-exposure.json'];
 assert.deepEqual(e.combinations.map(x=>x.count),[355925,23248,12599]);
 assert.equal(e.combinations.reduce((n,x)=>n+x.count,0),391772);
 assert.equal(e.total,391772); assert.equal(e.apacheOnlyObserved,false);
});
test('source-entry evidence remains a distinct measurement universe',()=>{
 const e=r['lp24112b-runtime-license-exposure.json'];
 assert.equal(e.countingUnit,'UNIQUE_FINAL_RUNTIME_POIS');
 assert.equal(e.sourceEntryEvidence.countingUnit,'SOURCE_ENTRIES_NOT_UNIQUE_POIS');
 assert.equal(e.sourceEntryEvidence.entries.length,10);
});
test('release-specific approval contract defaults closed',()=>{
 const g=r['lp24112b-attribution-approval-gates.json'];
 assert.deepEqual([g.authorityReleaseId,g.runtimeSchemaVersion,g.sourceInventoryHash],[identity.authorityReleaseId,identity.runtimeSchemaVersion,identity.sourceInventoryHash]);
 for(const key of ['resultsAttributionApproved','dataSourcesPageApproved','cdlaNoticeApproved','apacheNoticeApproved','foursquareNoticeApproved','cc0NoticeReviewed','censusAcknowledgementApproved'])assert.equal(g[key],false);
 assert.equal(g.legalClearanceStatus,'NOT_APPROVED'); assert.equal(g.providerGateEligible,false); assert.equal(g.runtimeActive,false);
 assert.equal(providerEligible({...g,legalClearanceStatus:'APPROVED'}),false);
 assert.equal(providerEligible({...g,legalClearanceStatus:'APPROVED',resultsAttributionApproved:true,dataSourcesPageApproved:true,cdlaNoticeApproved:true,apacheNoticeApproved:true,foursquareNoticeApproved:true,cc0NoticeReviewed:true,censusAcknowledgementApproved:true}),true);
});
test('wording, NOTICE, Census and OSM scopes remain governed and non-active',()=>{
 const f=r['lp24112b-foursquare-notice-plan.json'], s=r['lp24112b-scope.json'];
 assert.equal(f.noticeStatus,'COUNSEL_APPROVAL_REQUIRED'); assert.equal(f.noticeText,null); assert.equal(f.fabricated,false);
 assert.equal(s.census.acknowledgementText,null); assert.match(s.census.role,/not the POI source authority/);
 assert.equal(s.osm.merged,false); assert.equal(s.osm.supplement,'not part of this POI release');
});
test('no deployment, production mutation, remote fetch, or phone path exists',()=>{
 const c=r['lp24112b-certification.json'];
 assert.deepEqual([c.deployed,c.productionSupabaseMutation,c.remoteFetch,c.phoneTesting,c.runtimeActive],[false,false,false,false,false]);
 const source=fs.readFileSync(new URL('../tools/lp24112b/attribution-compliance.mjs',import.meta.url),'utf8');
 for(const forbidden of ['fetch(','supabase.from','child_process','adb '])assert.equal(source.includes(forbidden),false);
 assert.doesNotThrow(()=>verify());
});
