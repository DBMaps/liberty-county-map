import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const map=JSON.parse(read('reports/responder/responder-phase7-vector-map.json'));
const prior=JSON.parse(read('reports/responder/responder-phase6-vector-map.json'));
const frozen=[...JSON.parse(read('tests/contracts/responder/responder-v1-negative-vectors.json')).vectors,
  ...JSON.parse(read('tests/contracts/responder/responder-v1-positive-vectors.json')).vectors];
test('all 54 frozen IDs mapped once',()=>{
  assert.equal(frozen.length,54);
  assert.deepEqual(map.vectors.map(v=>v.id).sort(),frozen.map(v=>v.id).sort());
  assert.equal(new Set(map.vectors.map(v=>v.id)).size,54);
});
test('Phase 7 exact vector partition',()=>{
  assert.deepEqual(map.counts,{total:54,previouslyComplete:45,newlyCompletePhase7:6,
    totalComplete:51,deferredDashboard:2,deferredConsumer:0,deferredBackend:1});
  assert.equal(map.previouslyCompleteVectorIds.length,prior.counts.totalComplete);
  assert.deepEqual(map.newlyCompleteVectorIds.sort(),['N24-expired-active',
    'N27-private-projection-leak','N34-mass-publication','P17-valid-public-projection',
    'P18-suspend-hides-public','P19-expiry-hides-public']);
});
test('remaining IDs and N26 reason are explicit',()=>{
  assert.deepEqual(map.dashboardDeferredVectorIds,['P01-viewer-dashboard','P20-member-self-read']);
  assert.deepEqual(map.consumerDeferredVectorIds,[]);
  assert.deepEqual(map.backendDeferredVectorIds,['N26-unauthorized-governance']);
  assert.match(map.vectors.find(v=>v.id==='N26-unauthorized-governance').reason,/bounded forbidden/);
});
test('owner rate decision is exact and frozen gate stays false',()=>{
  const decisions=read('docs/RESPONDER/RESPONDER-V1-OWNER-DECISIONS.md');
  assert.match(decisions,/60 successful agency activations per organization in a rolling 60-minute window/);
  assert.match(read('db/responder-local/001_agency_private_apply.sql'),
    /agency_publishing_enabled boolean NOT NULL DEFAULT false/);
});
test('owner repair preserves one event per revision and active edit continuity',()=>{
  const projection=read('docs/RESPONDER/RESPONDER-V1-CONSUMER-PROJECTION.md');
  assert.match(projection,/earlier or equal revision/);
  assert.match(projection,/update_edited/);
  assert.match(projection,/update_renewed/);
  assert.match(projection,/one-event-per-revision invariant/);
  assert.match(read('db/responder-local/001_agency_private_apply.sql'),/UNIQUE \(update_id, revision\)/);
});
test('local SQL separates public reader and command replay domains',()=>{
  const sql=read('db/responder-local/007_phase7_local_rate_consumer_apply.sql');
  assert.match(sql,/LOCAL\/DISPOSABLE ONLY/);
  assert.match(sql,/phase7_agency_update_command/);
  assert.match(sql,/phase7_consumer_projection_now/);
  assert.match(sql,/responder_public_reader_fixture/);
  assert.match(sql,/rate_limited/);
  assert.doesNotMatch(sql,/SET agency_publishing_enabled=true/);
});
test('Phase 7 documentation records production boundary',()=>{
  const doc=read('docs/RESPONDER/RESPONDER-PHASE7-LOCAL-RATE-LIMIT-CONSUMER-PROJECTION.md');
  assert.match(doc,/production deployment.*deferred/i);
  assert.match(doc,/agency_publishing_enabled.*false/);
});
