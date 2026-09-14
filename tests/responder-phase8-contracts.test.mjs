import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const map=JSON.parse(read('reports/responder/responder-phase8-vector-map.json'));
const prior=JSON.parse(read('reports/responder/responder-phase7-vector-map.json'));
const sql=read('db/responder-local/008_phase8_local_dashboard_apply.sql');
const docs=read('docs/RESPONDER/RESPONDER-PHASE8-LOCAL-DASHBOARD-CONTRACT.md');
const frozen=['tests/contracts/responder/responder-v1-negative-vectors.json',
  'tests/contracts/responder/responder-v1-positive-vectors.json']
  .flatMap(f=>JSON.parse(read(f)).vectors);
test('all 54 frozen vector IDs remain mapped once',()=>{
  assert.equal(frozen.length,54);
  assert.equal(new Set(frozen.map(v=>v.id)).size,54);
  assert.deepEqual(new Set(map.vectors.map(v=>v.id)),new Set(frozen.map(v=>v.id)));
});
test('Phase 8 partition is exactly 51 prior plus P01 P20 N26',()=>{
  assert.deepEqual(map.counts,{total:54,previouslyComplete:51,
    newlyCompletePhase8:3,totalComplete:54,deferredDashboard:0,
    deferredConsumer:0,deferredBackend:0});
  assert.deepEqual(new Set(map.newlyCompleteVectorIds),
    new Set(['P01-viewer-dashboard','P20-member-self-read','N26-unauthorized-governance']));
  assert.deepEqual(new Set(map.previouslyCompleteVectorIds),
    new Set(prior.vectors.filter(v=>v.classification.includes('PASSED')).map(v=>v.id)));
  assert.ok(map.vectors.every(v=>v.classification.includes('PASSED')));
});
test('frozen read and denial action semantics match vector claims',()=>{
  const byId=Object.fromEntries(frozen.map(v=>[v.id,v]));
  assert.deepEqual(['P01-viewer-dashboard','P20-member-self-read','N26-unauthorized-governance']
    .map(id=>[byId[id].action,byId[id].expectedResult]),
    [['read_dashboard','accepted'],['read_own_membership','accepted'],
      ['approve_authority','forbidden']]);
  for(const id of map.newlyCompleteVectorIds)
    assert.deepEqual(byId[id].expectedSideEffects,
      {businessState:'unchanged',newBusinessEvents:0,newReceiptClaims:0});
});
test('new dashboard views retain invoker RLS and canonical record lineage',()=>{
  assert.equal((sql.match(/WITH \(security_invoker=true\)/g)||[]).length,5);
  for(const surface of ['queue','map','inspector','affordances'])
    assert.match(sql,new RegExp(`CREATE VIEW agency_private\\.phase8_dashboard_${surface}[\\s\\S]*?FROM agency_private\\.phase8_dashboard_records`));
  assert.match(sql,/CREATE VIEW agency_private\.phase8_dashboard_records WITH \(security_invoker=true\)/);
  assert.match(sql,/LEFT JOIN agency_private\.responder_current_authority/);
});
test('entry requires existing live organization and membership boundary',()=>{
  assert.match(sql,/phase8_dashboard_entry\(\)/);
  assert.match(sql,/responder_membership_roster/);
  assert.match(sql,/responder_organization_context/);
  assert.match(sql,/phase4_actor_id\(\)/);
  assert.match(sql,/m\.status='active'/);
  assert.match(sql,/o\.verification_state='verified' AND o\.operation_state='active'/);
});
test('N26 denial is inert and governance command grant remains absent',()=>{
  const body=sql.match(/CREATE FUNCTION agency_private\.phase8_agency_governance_denial\(p_request jsonb\)([\s\S]*?)\$\$;/)?.[1];
  assert.ok(body);
  assert.match(body,/SECURITY INVOKER/);
  assert.match(body,/\{"status":"forbidden"\}/);
  assert.doesNotMatch(body,/phase6_governance_command|INSERT|UPDATE|DELETE|EXECUTE/i);
  assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION agency_private\.phase6_governance_command/);
});
test('local-only scope and frozen publishing gate remain explicit',()=>{
  assert.match(sql,/LOCAL\/DISPOSABLE ONLY/);
  assert.doesNotMatch(sql,/agency_publishing_enabled\s*=\s*true/i);
  assert.match(docs,/agency publishing gate remains false/i);
  assert.match(docs,/production/i);
  assert.ok(!fs.existsSync(path.join(root,'supabase/migrations/008_phase8_local_dashboard_apply.sql')));
});
test('documentation records desktop surfaces, privacy, expiry and backend authority',()=>{
  for(const phrase of ['left queue','center map','right selected-update inspector',
    'invoker','expired','N26','candidate','without a business event'])
    assert.ok(docs.toLowerCase().includes(phrase.toLowerCase()),phrase);
});
