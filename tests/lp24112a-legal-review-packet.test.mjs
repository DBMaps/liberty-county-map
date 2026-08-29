import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reports,verify} from '../tools/lp24112a/legal-review-packet.mjs';

const r=reports();
test('release and certified package facts are conserved',()=>{
 const id=r['lp24112a-release-identity.json'], d=r['lp24112a-runtime-distribution-model.json'];
 assert.equal(id.authorityReleaseId,'lp24111-d5-standalone-2026-08-28');
 assert.equal(id.runtimeSchemaVersion,'gridly.poi.runtime.v1');
 assert.equal(id.governedStandalonePois,391772);
 assert.deepEqual(d.measurements,{standaloneRows:391772,statewideCompressedBytes:24040589,largestShard:'tx-29-096',largestShardCompressedBytes:4144301,shardsOver10MiB:0,shardsOver25MiB:0});
});
test('rich source-entry inventory and compact projection limitation are both preserved',()=>{
 const s=r['lp24112a-source-inventory.json'], l=r['lp24112a-license-observations.json'];
 assert.deepEqual(l.distinctObservedLicenseStrings,['CDLA-Permissive-2.0','Apache-2.0','CC0-1.0']);
 assert.equal(l.observation.runtimeProjection.recordsWithSourceMetadata,0);
 assert.equal(l.observation.richOwnerLocalAuthority.structuredSourceMetadataPresent,true);
 assert.equal(s.richSourceInventory.length,10);
 assert.ok(s.richSourceInventory.every(x=>x.evidenceScope==='RICH_OWNER_LOCAL_AUTHORITY'&&x.runtimeRetained===false));
 assert.ok(s.richSourceInventory.every(x=>x.legalInterpretation==='COUNSEL_DECISION_REQUIRED'));
 assert.equal(s.countingUnit,'SOURCE_ENTRIES_NOT_UNIQUE_POIS');
 assert.equal(l.countingUnit,'SOURCE_ENTRIES_NOT_UNIQUE_POIS');
 assert.match(s.evidenceScopeDistinction.runtimeProjection,/metadata is absent/i);
 assert.match(s.evidenceScopeDistinction.richOwnerLocalAuthority,/metadata is present/i);
 assert.match(s.observationLimitation,/not retained in runtime packages/i);
 assert.ok(s.sources.every(x=>x.technicalEvidence.length));
});
test('license contexts and source-entry totals match owner measurements without legal inference',()=>{
 const l=r['lp24112a-license-observations.json'];
 assert.deepEqual(l.licenses.map(x=>[x.license,x.sourceEntryTotal]),[
  ['CDLA-Permissive-2.0',3662091],['Apache-2.0',101480],['CC0-1.0',23971]
 ]);
 assert.ok(l.licenses.every(x=>x.applicableLegalObligations==='COUNSEL_DECISION_REQUIRED'));
 assert.equal(l.legalConclusion,false);
});
test('all legal decisions remain external and unapproved',()=>{
 const q=r['lp24112a-counsel-decision-matrix.json'].decisions;
 assert.equal(q.length,8);
 assert.ok(q.every(x=>x.status==='COUNSEL_DECISION_REQUIRED'&&x.owner==='EXTERNAL_COUNSEL'));
 const m=r['lp24112a-legal-approval-manifest-template.json'];
 assert.equal(m.legalClearanceStatus,'NOT_APPROVED');
 assert.equal(m.approvedBy,null); assert.equal(m.approvedAt,null);
 assert.ok(['runtimeAttributionSurfaceApproved','redistributionApproved','cacheModelApproved','brandPresentationApproved'].every(k=>m[k]===false));
 assert.match(m.attributionText,/^\[COUNSEL-APPROVED/);
 assert.equal(r['lp24112a-certification.json'].reviewedSourceInventoryHash,m.reviewedSourceInventoryHash);
});
test('activation, deployment, mutation, remote, phone and OSM boundaries remain closed',()=>{
 const c=r['lp24112a-certification.json'];
 assert.deepEqual({legal:c.legalState,gate:c.providerGate,runtime:c.runtimeActivated,deploy:c.deployed,mutation:c.productionSupabaseMutation,remote:c.remoteFetch,phone:c.phoneTesting,osm:c.osmMerged},{legal:'LEGAL_REVIEW_REQUIRED',gate:'OFF',runtime:false,deploy:false,mutation:false,remote:false,phone:false,osm:false});
 assert.equal(c.legalClearanceGranted,false);
 assert.equal(c.productionBehaviorChanged,false);
});
test('tooling has no deployment, remote fetch, Supabase mutation, or phone execution path',()=>{
 const source=fs.readFileSync(new URL('../tools/lp24112a/legal-review-packet.mjs',import.meta.url),'utf8');
 for(const forbidden of ['fetch(','https.request','supabase.from','child_process','adb '])assert.equal(source.includes(forbidden),false,forbidden);
 assert.doesNotThrow(()=>verify());
});
