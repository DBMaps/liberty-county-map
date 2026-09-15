import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql=read('db/responder-local/phase16_production_candidate.sql');
const rollback=read('db/responder-local/phase16_production_candidate_rollback.sql');
const bootstrap=read('db/responder-local/phase16_test_bootstrap.sql');
const doc=read('docs/RESPONDER/RESPONDER-PHASE16-PRODUCTION-SCHEMA-RLS-COMMAND-DESIGN.md');
const report=JSON.parse(read('reports/responder/responder-phase16-production-schema-design.json'));

test('candidate is explicitly non-deployed and outside migration history',()=>{
  assert.match(sql,/PRODUCTION MIGRATION CANDIDATE, NOT DEPLOYED/);
  assert.doesNotMatch(import.meta.url,/supabase[\\/]migrations/i);
  assert.equal(report.deploymentStatus,'NOT_DEPLOYED');
});

test('candidate creates only the two responder schemas',()=>{
  assert.deepEqual([...sql.matchAll(/CREATE SCHEMA ([a-z_]+);/g)].map(m=>m[1]),
    ['agency_private','responder_public']);
  assert.deepEqual(report.schemas,{private:'agency_private',dataApi:'responder_public'});
});

test('live Auth helper encodes the full Phase 15A predicate',()=>{
  for(const token of ['auth.uid()','auth.jwt()','auth.sessions','auth.mfa_factors',
    'auth.mfa_amr_claims',"s.aal::text = 'aal2'","f.factor_type::text = 'totp'",
    "f.status::text = 'verified'",'s.factor_id IS NOT NULL','p.minimum_iat']) assert.match(sql,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));
  assert.match(sql,/SECURITY DEFINER SET search_path = ''/);
  assert.match(sql,/REVOKE ALL ON FUNCTION agency_private\._live_auth_context\(\) FROM PUBLIC, anon, authenticated, service_role/);
});

test('actor, organization and county spoofing are structurally blocked',()=>{
  const updateFunction=sql.split('CREATE FUNCTION agency_private.agency_update_command')[1]
    .split('REVOKE ALL ON FUNCTION agency_private.agency_update_command')[0];
  assert.match(sql,/WHERE k NOT IN \('contract_version','action','operation_token',[\s\S]*?'organization_id','update_id','expected_revision','payload'\)/);
  assert.doesNotMatch(updateFunction,/v_payload->>'(?:actor|actor_user_id|county_fips|authority_id)'/);
  assert.match(updateFunction,/v_context\.organization_id <> v_org/);
  assert.match(sql,/ST_Contains\(c\.geom,p_location\)/);
  assert.doesNotMatch(updateFunction,/ST_Covers|ST_Buffer|ST_DWithin|nearest/i);
});

test('private tables use RLS without mutation policies or grants',()=>{
  assert.match(sql,/ALTER TABLE agency_private\.%I ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/ALTER TABLE agency_private\.%I FORCE ROW LEVEL SECURITY/);
  assert.doesNotMatch(sql,/CREATE POLICY[\s\S]{0,120}FOR (?:INSERT|UPDATE|DELETE|ALL)/i);
  assert.doesNotMatch(sql,/GRANT (?:INSERT|UPDATE|DELETE|ALL).*agency_private/i);
  assert.equal(report.policies.privateMutationPolicies,0);
});

test('public command surface is security invoker and explicit',()=>{
  assert.equal((sql.match(/SECURITY INVOKER SET search_path = ''/g)||[]).length,3);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION responder_public\.agency_update_command\(jsonb\),/);
  assert.match(sql,/REVOKE ALL ON FUNCTION responder_public\.agency_update_command\(jsonb\),[\s\S]*?FROM PUBLIC, anon, service_role/);
  assert.match(sql,/agency_governance_command\(jsonb\) TO authenticated/);
});

test('two-person closure evidence is database constrained',()=>{
  assert.match(sql,/CHECK \(creator_user_id <> approver_user_id\)/);
  assert.match(sql,/UNIQUE \(update_id,pending_revision\)/);
  assert.match(sql,/event_type = 'road_closure_activated'[\s\S]*approval_id IS NOT NULL/);
  assert.equal(report.roadClosed.databaseDistinctConstraint,true);
});

test('revision, event and rate evidence are unique and indexed',()=>{
  assert.match(sql,/PRIMARY KEY \(update_id,revision\)/);
  assert.match(sql,/CREATE TABLE agency_private\.agency_update_events[\s\S]*UNIQUE \(update_id,revision\)/);
  assert.match(sql,/CREATE TABLE agency_private\.activation_rate_events[\s\S]*UNIQUE \(update_id,revision\)/);
  assert.match(sql,/activation_rate_events_rolling_idx[\s\S]*organization_id,activated_at DESC/);
});

test('exact 18-key projection is documented and machine recorded',()=>{
  assert.equal(report.consumerProjection.columnCount,18);
  assert.match(doc,/exactly these 18 columns/i);
  for(const privateName of ['employee_email','actor_user_id','actor_session_id','internal_role',
    'authority_id','operation_token_digest']) assert.doesNotMatch(sql.split('CREATE TABLE responder_public.agency_updates')[1].split(');')[0],new RegExp(privateName,'i'));
});

test('rollback is gated and preserves community domains',()=>{
  assert.match(rollback,/Responder evidence exists; preserve\/export it and use a forward recovery migration/);
  assert.match(rollback,/DROP SCHEMA responder_public CASCADE;[\s\S]*DROP SCHEMA agency_private CASCADE/);
  assert.doesNotMatch(rollback,/reports|report_retention|history_capture|gridly_control/i);
});

test('test bootstrap is conspicuously local-only',()=>{
  assert.match(bootstrap,/TEST-ONLY BOOTSTRAP\. Disposable localhost PostgreSQL only/);
  assert.doesNotMatch(bootstrap,/https?:\/\/|supabase\.co|DATABASE_URL|password\s*=/i);
});

test('evidence records all green counts and no production mutation',()=>{
  assert.deepEqual(report.verification.requiredSecurityVectors,{passed:36,failed:0,total:36});
  assert.deepEqual(report.verification.additionalReplayVectors,{passed:2,failed:0,total:2});
  assert.deepEqual(report.verification.databaseStructuralChecks,{passed:22,failed:0,total:22});
  assert.equal(report.productionMutations,'NONE');
  assert.equal(report.secretsRecorded,false);
});
