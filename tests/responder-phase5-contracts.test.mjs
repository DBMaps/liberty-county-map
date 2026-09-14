import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const map=JSON.parse(read('reports/responder/responder-phase5-vector-map.json'));
const prior=JSON.parse(read('reports/responder/responder-phase4-vector-map.json'));
const negative=JSON.parse(read('tests/contracts/responder/responder-v1-negative-vectors.json'));
const positive=JSON.parse(read('tests/contracts/responder/responder-v1-positive-vectors.json'));
const frozen=[...negative.vectors,...positive.vectors];
const deferredBackend=new Set(map.backendDeferredVectorIds);

test('all 54 frozen vectors are mapped once without changing Phase 0 IDs',()=>{
  assert.equal(frozen.length,54);
  assert.equal(map.vectors.length,54);
  assert.deepEqual(map.vectors.map(v=>v.id).sort(),frozen.map(v=>v.id).sort());
  assert.equal(new Set(map.vectors.map(v=>v.id)).size,54);
  assert.deepEqual(map.previouslyPassedVectorIds,prior.previouslyPassedVectorIds);
});

test('exact passed and deferred partition',()=>{
  const counts=map.counts;
  assert.deepEqual(counts,{total:54,previouslyPassed:9,newlyPassedPhase5:33,
    totalComplete:42,deferredDashboard:2,deferredConsumer:4,deferredBackend:6});
  for (const [category,expected] of [
    ['PREVIOUSLY PASSED FULL VECTOR',9],['NEWLY PASSED PHASE 5 FULL VECTOR',33],
    ['DEFERRED DASHBOARD',2],['DEFERRED CONSUMER',4],['DEFERRED BACKEND',6]])
    assert.equal(map.vectors.filter(v=>v.classification===category).length,expected);
  assert.equal([...deferredBackend].length,6);
  for (const v of map.vectors.filter(v=>v.classification==='DEFERRED BACKEND'))
    assert.ok(v.reason && v.reason.length>20,`${v.id} needs a reason`);
});

test('Phase 5 completion only claims agency command vectors',()=>{
  const commands=new Set(['create_draft','edit_own_draft','submit_for_review',
    'return_for_changes','activate_non_closure','activate_road_closed',
    'edit_active_update','renew_update','resolve_update']);
  const byId=new Map(frozen.map(v=>[v.id,v]));
  for (const id of map.newlyPassedVectorIds)
    assert.ok(commands.has(byId.get(id).action),`${id} is outside implemented agency action`);
  for (const id of map.backendDeferredVectorIds)
    assert.ok(!map.newlyPassedVectorIds.includes(id));
});

test('SQL is local-only and follows frozen activation lifecycle',()=>{
  const sql=read('db/responder-local/005_phase5_local_command_apply.sql');
  assert.match(sql,/LOCAL\/DISPOSABLE ONLY/);
  assert.match(sql,/phase5_agency_update_command/);
  assert.match(sql,/SECURITY DEFINER SET search_path = pg_catalog/);
  assert.match(sql,/CREATE ROLE responder_command_fixture NOLOGIN BYPASSRLS/);
  assert.match(sql,/ALTER FUNCTION agency_private\.phase5_agency_update_command\(jsonb\) OWNER TO responder_command_fixture/);
  assert.match(sql,/activate_non_closure/);
  assert.match(sql,/activate_road_closed/);
  assert.match(sql,/road_closure_activated/);
  assert.doesNotMatch(sql,/\bapproved_update\b|\bupdate_approved\b|\bapprove_update\b/);
  assert.match(sql,/REVOKE ALL ON FUNCTION agency_private\.phase5_agency_update_command/);
  assert.match(sql,/TO responder_rls_agency_fixture/);
  assert.doesNotMatch(sql,/GRANT (INSERT|UPDATE|DELETE) ON agency_private\.agency_updates/);
  assert.match(read('db/responder-local/001_agency_private_apply.sql'),
    /agency_publishing_enabled boolean NOT NULL DEFAULT false/);
});

test('Phase 5 documentation records local and production boundary',()=>{
  const doc=read('docs/RESPONDER/RESPONDER-PHASE5-LOCAL-COMMAND-RPC.md');
  assert.match(doc,/no.*separate approval command/i);
  assert.match(doc,/agency_publishing_enabled.*false/);
  assert.match(doc,/production.*deferred/i);
});
