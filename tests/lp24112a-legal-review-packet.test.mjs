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
test('source and license observations preserve measured limitations',()=>{
 const s=r['lp24112a-source-inventory.json'], l=r['lp24112a-license-observations.json'];
 assert.deepEqual(l.distinctObservedLicenseStrings,[]);
 assert.equal(l.observation.recordsWithSourceMetadata,0);
 assert.match(s.observationLimitation,/no distinct license strings were observed/i);
 assert.ok(s.sources.every(x=>x.technicalEvidence.length));
});
test('all legal decisions remain external and unapproved',()=>{
 const q=r['lp24112a-counsel-decision-matrix.json'].decisions;
 assert.equal(q.length,12);
 assert.ok(q.every(x=>x.status==='COUNSEL_DECISION_REQUIRED'&&x.owner==='EXTERNAL_COUNSEL'));
 const m=r['lp24112a-legal-approval-manifest-template.json'];
 assert.equal(m.legalClearanceStatus,'NOT_APPROVED');
 assert.equal(m.approvedBy,null); assert.equal(m.approvedAt,null);
 assert.match(m.attributionText,/^\[COUNSEL-APPROVED/);
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
