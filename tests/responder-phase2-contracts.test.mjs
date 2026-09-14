import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const negative=JSON.parse(read('tests/contracts/responder/responder-v1-negative-vectors.json'));
const positive=JSON.parse(read('tests/contracts/responder/responder-v1-positive-vectors.json'));
const map=JSON.parse(read('reports/responder/responder-phase2-vector-map.json'));
const all=[...negative.vectors,...positive.vectors];
const executable=['N05-admin-self-promote','N06-last-admin-removal','N07-aal1-dashboard',
  'N30-invite-reuse','N31-expired-invite','N32-wrong-invite-identity',
  'P11-admin-invite','P12-invite-redemption','P13-admin-suspend-member'];

test('Phase 2 map covers each frozen vector exactly once',()=>{
  assert.equal(all.length,54);
  assert.equal(map.contractVersion,'responder.agency.v1.phase0.1');
  assert.equal(map.vectors.length,54);
  assert.deepEqual(new Set(map.vectors.map(v=>v.id)),new Set(all.map(v=>v.id)));
  assert.deepEqual(map.executableVectorIds,executable);
});

test('Phase 2 passed and deferred counts are exact',()=>{
  assert.deepEqual(map.counts,{
    'EXECUTABLE IN PHASE 2':9,
    'DEFERRED PHASE 3':8,
    'DEFERRED PHASE 4':2,
    'DEFERRED PHASE 5':29,
    'DEFERRED DASHBOARD':2,
    'DEFERRED CONSUMER':4,
  });
  for(const [category,count] of Object.entries(map.counts)){
    assert.equal(map.vectors.filter(v=>v.classification===category).length,count);
  }
});

test('Phase 2 local fixture preserves role, state, source and gate contracts',()=>{
  const sql=read('db/responder-local/002_phase2_auth_membership_apply.sql');
  const phase1=read('db/responder-local/001_agency_private_apply.sql');
  assert.match(sql,/status IN \('invited','active','suspended'\)/);
  assert.match(sql,/membership_one_active_org_per_user_idx/);
  assert.match(sql,/GRIDLY_ADMIN/);
  assert.match(sql,/assurance IN \('aal1','aal2'\)/);
  assert.match(phase1,/agency_publishing_enabled boolean NOT NULL DEFAULT false/);
  assert.match(phase1,/source_family text NOT NULL DEFAULT 'AGENCY_OFFICIAL'/);
  assert.doesNotMatch(sql,/\bpublic\.reports\b|\breporting_enabled\b|\breport_retention\.replay_evidence\b/);
});

test('trusted fixture command is not a public or production RPC',()=>{
  const sql=read('db/responder-local/002_phase2_auth_membership_apply.sql');
  assert.match(sql,/REVOKE ALL ON FUNCTION agency_private\.phase2_membership_command/);
  assert.doesNotMatch(sql,/GRANT EXECUTE .*responder_app_fixture/);
  assert.doesNotMatch(sql,/CREATE POLICY|ENABLE ROW LEVEL SECURITY|auth\.users|CREATE FUNCTION public\./i);
});

test('Phase 2 documentation links resolve',()=>{
  const file='docs/RESPONDER/RESPONDER-PHASE2-LOCAL-AUTH-MEMBERSHIP.md';
  for(const match of read(file).matchAll(/\]\(([^)]+)\)/g)){
    const target=match[1].split('#')[0];
    if(target&&!/^https?:/.test(target)) assert.ok(fs.existsSync(path.resolve(root,path.dirname(file),target)),target);
  }
});
