import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const map=JSON.parse(read('reports/responder/responder-phase6-vector-map.json'));
const prior=JSON.parse(read('reports/responder/responder-phase5-vector-map.json'));
const frozen=[...JSON.parse(read('tests/contracts/responder/responder-v1-negative-vectors.json')).vectors,
  ...JSON.parse(read('tests/contracts/responder/responder-v1-positive-vectors.json')).vectors];

test('all 54 frozen IDs have one classification',()=>{
  assert.equal(frozen.length,54);
  assert.deepEqual(map.vectors.map(v=>v.id).sort(),frozen.map(v=>v.id).sort());
  assert.equal(new Set(map.vectors.map(v=>v.id)).size,54);
});
test('Phase 6 exact full-vector partition',()=>{
  assert.deepEqual(map.counts,{total:54,previouslyComplete:42,newlyCompletePhase6:3,
    totalComplete:45,deferredDashboard:2,deferredConsumer:4,deferredBackend:3});
  assert.deepEqual(map.newlyCompleteVectorIds.sort(),
    ['N33-municipal-point-proxy','P14-gridly-verify-org','P15-gridly-approve-county']);
  assert.equal(map.previouslyCompleteVectorIds.length,prior.counts.totalComplete);
  for(const v of map.vectors.filter(v=>v.classification==='DEFERRED BACKEND'))
    assert.ok(v.reason?.length>30,`${v.id} needs a concrete reason`);
});
test('no policy invention or consumer completion',()=>{
  assert.deepEqual(map.backendDeferredVectorIds.sort(),
    ['N26-unauthorized-governance','N34-mass-publication','P18-suspend-hides-public']);
  assert.equal(map.vectors.filter(v=>v.classification==='DEFERRED CONSUMER').length,4);
  assert.equal(map.vectors.filter(v=>v.classification==='DEFERRED DASHBOARD').length,2);
});
test('local command retains role and immutable receipt boundary',()=>{
  const sql=read('db/responder-local/006_phase6_local_governance_apply.sql');
  assert.match(sql,/LOCAL\/DISPOSABLE ONLY/);
  assert.match(sql,/SECURITY DEFINER SET search_path=pg_catalog/);
  assert.match(sql,/governance_receipts_append_only/);
  assert.match(sql,/TO responder_rls_governance_fixture/);
  assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION agency_private\.phase6_governance_command\(jsonb\)\s+TO responder_rls_agency_fixture/);
  assert.doesNotMatch(sql,/SET agency_publishing_enabled=true/);
});
test('documentation states local gate and deployment boundary',()=>{
  const doc=read('docs/RESPONDER/RESPONDER-PHASE6-LOCAL-GOVERNANCE-VERIFICATION.md');
  assert.match(doc,/agency_publishing_enabled.*false/);
  assert.match(doc,/production deployment.*deferred/i);
});
