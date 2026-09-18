import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const pgbin = process.env.DISPATCH_PHASE21_PGBIN;
const port = process.env.DISPATCH_PHASE21_PGPORT;
const owner = process.env.DISPATCH_PHASE21_PGUSER;
const pgdata = process.env.DISPATCH_PHASE21_PGDATA;

assert.ok(pgbin && port && owner && pgdata, 'runner must provide explicit disposable PostgreSQL settings');
assert.match(pgdata.replaceAll('\\', '/'), /\/gridly-dispatch-phase21-[a-f0-9]+$/);

const psql = join(pgbin, 'psql.exe');
const createdb = join(pgbin, 'createdb.exe');
const dropdb = join(pgbin, 'dropdb.exe');
const db = `dispatch_phase21_${randomBytes(6).toString('hex')}`;
const suffix = randomBytes(5).toString('hex');
const roles = {
  multi: `p21_multi_${suffix}`,
  viewer: `p21_viewer_${suffix}`,
  operator: `p21_operator_${suffix}`,
  orgadmin: `p21_orgadmin_${suffix}`,
  suspended: `p21_suspended_${suffix}`,
  revoked: `p21_revoked_${suffix}`,
  platform: `p21_platform_${suffix}`,
  school: `p21_school_${suffix}`,
  fleet: `p21_fleet_${suffix}`,
  public: `p21_public_${suffix}`,
};

const ids = {
  org1: '20000000-0000-4000-8000-000000000001',
  org2: '20000000-0000-4000-8000-000000000002',
  org3: '20000000-0000-4000-8000-000000000003',
  org4: '20000000-0000-4000-8000-000000000004',
  scope1: '40000000-0000-4000-8000-000000000001',
  scope2: '40000000-0000-4000-8000-000000000002',
  scope6: '40000000-0000-4000-8000-000000000006',
  transfer: '90000000-0000-4000-8000-000000000001',
};

const baseEnv = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: owner };
for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL', 'PGPASSWORD', 'PGSERVICE']) delete baseEnv[key];

function run(binary, args, { env = baseEnv, input, expectFailure = false } = {}) {
  const result = spawnSync(binary, args, { cwd: root, env, input, encoding: 'utf8', windowsHide: true });
  if (expectFailure) {
    assert.notEqual(result.status, 0, `expected failure but command succeeded: ${result.stdout}`);
  } else {
    assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  }
  return (result.stdout ?? '').trim();
}

function ownerSql(sql, options = {}) {
  return run(psql, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', db, '-c', sql], options);
}

function fileSql(path) {
  return run(psql, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', db, '-f', path]);
}

function actorSql(role, orgId, sql, options = {}) {
  const env = { ...baseEnv, PGUSER: role };
  const requested = orgId ? `SELECT set_config('dispatch_phase21.requested_organization','${orgId}',true);` : '';
  const output = run(psql, ['-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', db, '-c',
    `BEGIN; ${requested} ${sql}; COMMIT;`], { ...options, env });
  return output.split(/\r?\n/).at(-1);
}

function scalar(sql) {
  return ownerSql(sql).split(/\r?\n/).at(-1);
}

test('Phase 21 disposable neutral schema satisfies structural and adversarial vectors', async (t) => {
  run(createdb, ['-h', '127.0.0.1', '-p', port, '-U', owner, db]);
  try {
    await t.test('apply and seed only the isolated local prototype', () => {
      fileSql(join(root, 'tools', 'responder', 'phase21', 'apply.sql'));
      fileSql(join(root, 'tools', 'responder', 'phase21', 'fixtures.sql'));
      assert.equal(scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dispatch_phase21_local' AND c.relkind='r'"), '20');
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.role_templates"), '5');
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.permissions WHERE scope_class='ORGANIZATION'"), '20');
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.permissions WHERE scope_class='PLATFORM'"), '6');
      assert.equal(scalar("SELECT string_agg(role_key::text||':'||permission_count,',' ORDER BY role_key::text) FROM (SELECT role_key,count(*) permission_count FROM dispatch_phase21_local.role_permissions GROUP BY role_key) x"), 'OPERATOR:8,ORGANIZATION_ADMIN:19,OWNER:20,SUPERVISOR:14,VIEWER:5');
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.organization_memberships WHERE user_id='10000000-0000-4000-8000-000000000001' AND status='ACTIVE'"), '2');
      assert.equal(scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dispatch_phase21_local' AND c.relrowsecurity AND c.relforcerowsecurity"), '17');
    });

    await t.test('bind synthetic login roles without any production identity dependency', () => {
      for (const [key, role] of Object.entries(roles)) {
        ownerSql(`CREATE ROLE ${role} LOGIN INHERIT; GRANT ${key === 'public' ? 'dispatch_phase21_public' : 'dispatch_phase21_app'} TO ${role}`);
      }
      const bindings = [
        [roles.multi, '10000000-0000-4000-8000-000000000001'],
        [roles.viewer, '10000000-0000-4000-8000-000000000002'],
        [roles.operator, '10000000-0000-4000-8000-000000000003'],
        [roles.orgadmin, '10000000-0000-4000-8000-000000000010'],
        [roles.suspended, '10000000-0000-4000-8000-000000000007'],
        [roles.revoked, '10000000-0000-4000-8000-000000000008'],
        [roles.platform, '10000000-0000-4000-8000-000000000009'],
        [roles.school, '10000000-0000-4000-8000-000000000005'],
        [roles.fleet, '10000000-0000-4000-8000-000000000006'],
      ];
      for (const [role, user] of bindings) {
        ownerSql(`INSERT INTO dispatch_phase21_local.local_actor_bindings(session_role,user_id) VALUES ('${role}','${user}')`);
      }
    });

    await t.test('tenant selection is contextual and server-validated', () => {
      assert.equal(actorSql(roles.multi, ids.org1, `SELECT count(*) FROM dispatch_phase21_local.operational_records`), '1');
      assert.equal(actorSql(roles.multi, ids.org2, `SELECT count(*) FROM dispatch_phase21_local.operational_records`), '1');
      assert.equal(actorSql(roles.operator, ids.org2, `SELECT count(*) FROM dispatch_phase21_local.operational_records`), '0');
      assert.equal(actorSql(roles.multi, ids.org3, `SELECT dispatch_phase21_local.can_user_access_organization('${ids.org3}','operations.read')`), 'f');
      assert.equal(actorSql(roles.multi, null, `SELECT dispatch_phase21_local.can_user_access_organization('${ids.org1}','operations.read')`), 'f');
      assert.equal(actorSql(roles.school, ids.org3, `SELECT dispatch_phase21_local.can_user_access_organization('${ids.org3}','operations.read')`), 'f');
      assert.equal(actorSql(roles.fleet, ids.org4, `SELECT dispatch_phase21_local.can_user_access_organization('${ids.org4}','operations.read')`), 'f');
      assert.equal(actorSql(roles.operator, ids.org2, `SELECT count(*) FROM dispatch_phase21_local.organizations`), '0');
    });

    await t.test('role matrix, disabled membership states, and platform plane are enforced', () => {
      assert.equal(actorSql(roles.multi, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','members.manage')`), 't');
      assert.equal(actorSql(roles.multi, ids.org2, `SELECT dispatch_phase21_local.has_permission('${ids.org2}','members.manage')`), 'f');
      assert.equal(actorSql(roles.viewer, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','operations.create')`), 'f');
      assert.equal(actorSql(roles.operator, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','members.manage')`), 'f');
      assert.equal(actorSql(roles.suspended, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','operations.read')`), 'f');
      assert.equal(actorSql(roles.revoked, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','operations.read')`), 'f');
      assert.equal(actorSql(roles.platform, ids.org1, `SELECT dispatch_phase21_local.has_platform_permission('platform.audit.investigate')`), 't');
      assert.equal(actorSql(roles.platform, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','operations.read')`), 'f');
      assert.equal(actorSql(roles.platform, ids.org1, `SELECT dispatch_phase21_local.has_permission('${ids.org1}','projection.publish')`), 'f');
      actorSql(roles.viewer, ids.org1, `INSERT INTO dispatch_phase21_local.operational_records DEFAULT VALUES`, { expectFailure: true });
    });

    await t.test('scope and capability gates fail closed', () => {
      assert.equal(actorSql(roles.multi, ids.org1, `SELECT dispatch_phase21_local.capability_allows('${ids.org1}','awareness.condition.publish','${ids.scope1}')`), 't');
      assert.equal(actorSql(roles.multi, ids.org1, `SELECT dispatch_phase21_local.capability_allows('${ids.org1}','awareness.official_notice.publish','${ids.scope1}')`), 'f');
      assert.equal(actorSql(roles.multi, ids.org2, `SELECT dispatch_phase21_local.capability_allows('${ids.org2}','awareness.hazard.publish','${ids.scope6}')`), 'f');
      assert.equal(actorSql(roles.multi, ids.org2, `SELECT dispatch_phase21_local.capability_allows('${ids.org2}','awareness.hazard.publish','${ids.scope2}')`), 't');
    });

    await t.test('revision, idempotency, append-only, and owner invariants reject hostile writes', () => {
      ownerSql("UPDATE dispatch_phase21_local.operational_records SET current_revision=2 WHERE id='60000000-0000-4000-8000-000000000001'", { expectFailure: true });
      ownerSql("UPDATE dispatch_phase21_local.record_revisions SET payload_snapshot='{}' WHERE id='61000000-0000-4000-8000-000000000001'", { expectFailure: true });
      ownerSql("DELETE FROM dispatch_phase21_local.dispatch_audit_events WHERE id=1", { expectFailure: true });
      const receipt = "(decode(repeat('aa',32),'hex'),'10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','synthetic-replay','60000000-0000-4000-8000-000000000001',decode(repeat('bb',32),'hex'),'accepted')";
      ownerSql(`INSERT INTO dispatch_phase21_local.operation_receipts(token_digest,actor_user_id,organization_id,action,target_id,payload_digest,bounded_result) VALUES ${receipt}`);
      ownerSql(`INSERT INTO dispatch_phase21_local.operation_receipts(token_digest,actor_user_id,organization_id,action,target_id,payload_digest,bounded_result) VALUES ${receipt}`, { expectFailure: true });
      ownerSql("BEGIN; UPDATE dispatch_phase21_local.organization_memberships SET role_template='VIEWER' WHERE id='30000000-0000-4000-8000-000000000001'; COMMIT", { expectFailure: true });
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.organization_memberships WHERE organization_id='20000000-0000-4000-8000-000000000001' AND role_template='OWNER' AND status='ACTIVE'"), '1');
    });

    await t.test('projection boundary exposes safe data only and rejects unsafe or ineligible payloads', () => {
      const cols = actorSql(roles.public, null, "SELECT string_agg(column_name,',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='dispatch_phase21_local' AND table_name='public_safe_projections'");
      assert.equal(cols, 'id,candidate_id,organization_public_name,source_label,consumer_taxonomy,title,summary,public_location,published_at,updated_at,expires_at');
      assert.equal(actorSql(roles.public, null, 'SELECT count(*) FROM dispatch_phase21_local.public_safe_projections'), '1');
      assert.match(actorSql(roles.public, null, 'SELECT title FROM dispatch_phase21_local.public_safe_projections'), /Road condition/);
      ownerSql("UPDATE dispatch_phase21_local.capability_grants SET status='SUSPENDED' WHERE id='50000000-0000-4000-8000-000000000001'");
      assert.equal(actorSql(roles.public, null, 'SELECT count(*) FROM dispatch_phase21_local.public_safe_projections'), '0');
      ownerSql("UPDATE dispatch_phase21_local.capability_grants SET status='ACTIVE' WHERE id='50000000-0000-4000-8000-000000000001'");
      ownerSql("INSERT INTO dispatch_phase21_local.projection_candidates(id,source_record_id,organization_id,source_revision,capability_grant_id,status,requested_by_membership_id,sanitized_payload,consumer_taxonomy,freshness_deadline) VALUES ('70000000-0000-4000-8000-000000000099','60000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',0,'50000000-0000-4000-8000-000000000001','SUBMITTED','30000000-0000-4000-8000-000000000004','{\"nested\":{\"private_notes\":\"leak\"}}','condition',now()+interval '1 hour')", { expectFailure: true });
      ownerSql("INSERT INTO dispatch_phase21_local.public_safe_projections(id,candidate_id,organization_public_name,source_label,consumer_taxonomy,title,summary,expires_at) VALUES ('71000000-0000-4000-8000-000000000099','70000000-0000-4000-8000-000000000002','Synthetic Utility','Organization update','hazard','bad','bad',now()+interval '1 hour')", { expectFailure: true });
    });

    await t.test('ownership transfer is atomic and preserves exactly one owner', () => {
      assert.equal(actorSql(roles.orgadmin, ids.org1, `SELECT dispatch_phase21_local.local_accept_ownership_transfer('${ids.transfer}')`), 'accepted');
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.organization_memberships WHERE organization_id='20000000-0000-4000-8000-000000000001' AND role_template='OWNER' AND status='ACTIVE'"), '1');
      assert.equal(scalar("SELECT status::text FROM dispatch_phase21_local.ownership_transfers WHERE id='90000000-0000-4000-8000-000000000001'"), 'ACCEPTED');
      assert.equal(actorSql(roles.orgadmin, ids.org1, `SELECT dispatch_phase21_local.local_accept_ownership_transfer('${ids.transfer}')`), 'forbidden');
    });

    await t.test('rollback removes only the disposable prototype', () => {
      for (const [key, role] of Object.entries(roles)) {
        ownerSql(`REVOKE ${key === 'public' ? 'dispatch_phase21_public' : 'dispatch_phase21_app'} FROM ${role}; DROP ROLE ${role}`);
      }
      fileSql(join(root, 'tools', 'responder', 'phase21', 'rollback.sql'));
      assert.equal(scalar("SELECT count(*) FROM pg_namespace WHERE nspname='dispatch_phase21_local'"), '0');
      assert.equal(scalar("SELECT count(*) FROM pg_roles WHERE rolname IN ('dispatch_phase21_app','dispatch_phase21_public')"), '0');
    });
  } finally {
    run(dropdb, ['-h', '127.0.0.1', '-p', port, '-U', owner, '--if-exists', '--force', db]);
  }
});
