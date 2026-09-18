import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';

const root = resolve(import.meta.dirname, '..');
const pgbin = process.env.DISPATCH_PHASE22_PGBIN;
const port = process.env.DISPATCH_PHASE22_PGPORT;
const owner = process.env.DISPATCH_PHASE22_PGUSER;
const pgdata = process.env.DISPATCH_PHASE22_PGDATA;
assert.ok(pgbin && port && owner && pgdata, 'runner must provide explicit disposable PostgreSQL settings');
assert.match(pgdata.replaceAll('\\', '/'), /\/gridly-dispatch-phase22-[a-f0-9]+$/);

const psql = join(pgbin, 'psql.exe');
const createdb = join(pgbin, 'createdb.exe');
const dropdb = join(pgbin, 'dropdb.exe');
const db = `dispatch_phase22_${randomBytes(6).toString('hex')}`;
const suffix = randomBytes(5).toString('hex');
const roles = Object.fromEntries([
  'owner','viewer','operator','admin','suspended','revoked','platform1','platform2','supervisor',
  'invitee1','invitee2','aal1','stale','mismatch','school','fleet','public'
].map((key) => [key, `p22_${key}_${suffix}`]));

const org1 = '20000000-0000-4000-8000-000000000001';
const org2 = '20000000-0000-4000-8000-000000000002';
const org3 = '20000000-0000-4000-8000-000000000003';
const org4 = '20000000-0000-4000-8000-000000000004';
const scope1 = '40000000-0000-4000-8000-000000000001';
const scope2 = '40000000-0000-4000-8000-000000000002';
const cap1 = '50000000-0000-4000-8000-000000000001';
const membershipOperator = '30000000-0000-4000-8000-000000000004';
const membershipAdmin = '30000000-0000-4000-8000-000000000010';
const membershipSupervisor = '30000000-0000-4000-8000-000000000013';

const baseEnv = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: owner };
for (const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL','PGPASSWORD','PGSERVICE']) delete baseEnv[key];

function run(binary, args, { env = baseEnv, expectFailure = false } = {}) {
  const result = spawnSync(binary, args, { cwd: root, env, encoding: 'utf8', windowsHide: true });
  if (expectFailure) assert.notEqual(result.status, 0, `expected failure but command succeeded: ${result.stdout}`);
  else assert.equal(result.status, 0, `${result.stderr}\n${result.stdout}`);
  return (result.stdout ?? '').trim();
}
function ownerSql(sql, options = {}) {
  return run(psql, ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',sql], options);
}
function fileSql(path) {
  return run(psql, ['-X','-q','-v','ON_ERROR_STOP=1','-d',db,'-f',path]);
}
function scalar(sql) { return ownerSql(sql).split(/\r?\n/).at(-1); }
function actorSql(role, requestedOrg, sql, options = {}) {
  const context = requestedOrg
    ? `SELECT set_config('dispatch_phase21.requested_organization','${requestedOrg}',true);`
    : '';
  const output = run(psql, ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',
    `BEGIN; SET LOCAL statement_timeout='10s'; ${context} ${sql}; COMMIT;`],
    { ...options, env: { ...baseEnv, PGUSER: role } });
  return output.split(/\r?\n/).at(-1);
}
function actorSqlAsync(role, requestedOrg, sql) {
  const context = `SELECT set_config('dispatch_phase21.requested_organization','${requestedOrg}',true);`;
  const args = ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',
    `BEGIN; SET LOCAL statement_timeout='10s'; ${context} ${sql}; COMMIT;`];
  return new Promise((resolvePromise) => {
    const child = spawn(psql, args, { cwd: root, env: { ...baseEnv, PGUSER: role }, windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (status) => resolvePromise({ status, stdout: stdout.trim(), stderr: stderr.trim() }));
  });
}
function sqlUuid(value) { assert.match(value, /^[0-9a-f-]{36}$/i); return `'${value}'`; }

let recordId;
let projectionRecordId;
let publishedProjectionId;
let grantedCapabilityId;

test('Phase 22 local RLS and command prototype', async (t) => {
  run(createdb, ['-h','127.0.0.1','-p',port,'-U',owner,db]);
  try {
    await t.test('load Phase 21 plus the isolated Phase 22 layer', () => {
      fileSql(join(root,'tools','responder','phase21','apply.sql'));
      fileSql(join(root,'tools','responder','phase21','fixtures.sql'));
      fileSql(join(root,'tools','responder','phase22','apply.sql'));
      fileSql(join(root,'tools','responder','phase22','commands.sql'));
      fileSql(join(root,'tools','responder','phase22','fixtures.sql'));
      assert.equal(scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dispatch_phase22_local' AND c.relkind='r'"), '6');
      assert.equal(scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dispatch_phase22_local' AND c.relrowsecurity AND c.relforcerowsecurity"), '6');
      assert.equal(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_phase22_local' AND p.prosecdef"), '33');
    });

    await t.test('bind server-side synthetic sessions to isolated login roles', () => {
      const binding = {
        owner: ['a0000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'],
        viewer: ['a0000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002'],
        operator: ['a0000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003'],
        admin: ['a0000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000010'],
        suspended: ['a0000000-0000-4000-8000-000000000005','10000000-0000-4000-8000-000000000007'],
        revoked: ['a0000000-0000-4000-8000-000000000006','10000000-0000-4000-8000-000000000008'],
        platform1: ['a0000000-0000-4000-8000-000000000007','10000000-0000-4000-8000-000000000009'],
        platform2: ['a0000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000011'],
        supervisor: ['a0000000-0000-4000-8000-000000000009','10000000-0000-4000-8000-000000000013'],
        invitee1: ['a0000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000012'],
        invitee2: ['a0000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000014'],
        aal1: ['a0000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000003'],
        stale: ['a0000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000003'],
        mismatch: ['a0000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000002'],
        school: ['a0000000-0000-4000-8000-000000000015','10000000-0000-4000-8000-000000000005'],
        fleet: ['a0000000-0000-4000-8000-000000000016','10000000-0000-4000-8000-000000000006'],
      };
      for (const [key, role] of Object.entries(roles)) {
        ownerSql(`CREATE ROLE ${role} LOGIN INHERIT; GRANT ${key === 'public' ? 'dispatch_phase21_public' : 'dispatch_phase21_app'} TO ${role}`);
        if (key !== 'public') {
          const [session, actor] = binding[key];
          ownerSql(`INSERT INTO dispatch_phase22_local.session_bindings(session_role,session_id,asserted_auth_user_id) VALUES ('${role}','${session}','${actor}')`);
        }
      }
    });

    await t.test('live AAL2/TOTP, session identity, membership, and organization state gate reads and commands', () => {
      assert.equal(actorSql(roles.owner, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '1');
      assert.equal(actorSql(roles.aal1, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.stale, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.mismatch, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.suspended, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.revoked, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.school, org3, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.fleet, org4, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      const denied = `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','denied','denied','${scope1}','{}','${randomUUID()}')`;
      actorSql(roles.aal1, org1, denied, { expectFailure: true });
      actorSql(roles.stale, org1, denied.replace(/'[0-9a-f-]{36}'\)$/, `'${randomUUID()}')`), { expectFailure: true });
      actorSql(roles.mismatch, org1, denied.replace(/'[0-9a-f-]{36}'\)$/, `'${randomUUID()}')`), { expectFailure: true });
    });

    await t.test('RLS and grants deny cross-tenant, public, platform, and direct-write bypasses', () => {
      assert.equal(actorSql(roles.operator, org2, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      assert.equal(actorSql(roles.platform1, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      actorSql(roles.public, null, 'SELECT count(*) FROM dispatch_phase21_local.operational_records', { expectFailure: true });
      actorSql(roles.public, null, 'SELECT count(*) FROM dispatch_phase21_local.organization_memberships', { expectFailure: true });
      actorSql(roles.public, null, 'SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events', { expectFailure: true });
      assert.equal(actorSql(roles.public, null, 'SELECT count(*) FROM dispatch_phase21_local.public_safe_projections'), '1');
      actorSql(roles.viewer, org1, 'INSERT INTO dispatch_phase21_local.operational_records DEFAULT VALUES', { expectFailure: true });
      actorSql(roles.operator, org1, `UPDATE dispatch_phase21_local.organization_memberships SET role_template='OWNER' WHERE id='${membershipOperator}'`, { expectFailure: true });
      actorSql(roles.platform1, org1, "INSERT INTO dispatch_phase21_local.capability_grants DEFAULT VALUES", { expectFailure: true });
      actorSql(roles.supervisor, org1, 'INSERT INTO dispatch_phase21_local.public_safe_projections DEFAULT VALUES', { expectFailure: true });
      actorSql(roles.admin, org1, "INSERT INTO dispatch_phase21_local.dispatch_audit_events DEFAULT VALUES", { expectFailure: true });
      actorSql(roles.owner, org1, "INSERT INTO dispatch_phase22_local.command_receipts DEFAULT VALUES", { expectFailure: true });
      actorSql(roles.public, null, `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','x','x','${scope1}','{}','${randomUUID()}')`, { expectFailure: true });
    });

    await t.test('record commands provide exact replay, atomic evidence, and optimistic concurrency', async () => {
      const createKey = randomUUID();
      const createSql = `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','Phase 22 record','private detail','${scope1}','{"private_ref":"synthetic"}','${createKey}')`;
      recordId = actorSql(roles.operator, org1, createSql);
      sqlUuid(recordId);
      assert.equal(actorSql(roles.operator, org1, createSql), recordId);
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE idempotency_key='${createKey}'`), '1');
      actorSql(roles.operator, org1, createSql.replace('Phase 22 record','different payload'), { expectFailure: true });
      const updateKey = randomUUID();
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.update_operational_record('${org1}','${recordId}',0,'IN_PROGRESS','HIGH','Phase 22 updated','private update','{}','${updateKey}')`);
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.update_operational_record('${org1}','${recordId}',0,'MONITORING','HIGH','stale','stale','{}','${randomUUID()}')`, { expectFailure: true });
      const c1 = actorSqlAsync(roles.operator, org1, `SELECT dispatch_phase22_local.update_operational_record('${org1}','${recordId}',1,'MONITORING','HIGH','concurrent A','A','{}','${randomUUID()}')`);
      const c2 = actorSqlAsync(roles.operator, org1, `SELECT dispatch_phase22_local.update_operational_record('${org1}','${recordId}',1,'IN_PROGRESS','HIGH','concurrent B','B','{}','${randomUUID()}')`);
      const results = await Promise.all([c1,c2]);
      assert.deepEqual(results.map((r) => r.status).sort(), [0,1]);
      assert.equal(scalar(`SELECT current_revision FROM dispatch_phase21_local.operational_records WHERE id='${recordId}'`), '2');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.record_revisions WHERE record_id='${recordId}'`), '3');
      const assignment = actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.assign_operational_record('${org1}','${recordId}',2,'${membershipOperator}','${randomUUID()}')`);
      sqlUuid(assignment);
      actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.close_operational_record('${org1}','${recordId}',3,'CLOSED','${randomUUID()}')`);
      assert.equal(scalar(`SELECT status::text||':'||current_revision FROM dispatch_phase21_local.operational_records WHERE id='${recordId}'`), 'CLOSED:4');
    });

    await t.test('controlled post-mutation failure rolls back business, revision, receipt, and audit', () => {
      const key = randomUUID();
      ownerSql(`INSERT INTO dispatch_phase22_local.failure_injections(session_role,command_name,fail_after_step) VALUES ('${roles.operator}','create_operational_record','BUSINESS_MUTATION')`);
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.create_operational_record('${org1}','HAZARD','OPEN','NORMAL','atomic failure probe','private','${scope1}','{}','${key}')`, { expectFailure: true });
      ownerSql(`DELETE FROM dispatch_phase22_local.failure_injections WHERE session_role='${roles.operator}' AND command_name='create_operational_record'`);
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.operational_records WHERE title='atomic failure probe'"), '0');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE idempotency_key='${key}'`), '0');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE operation_correlation_id='${key}'`), '0');
    });

    await t.test('multi-organization context and receipt domains remain independent', () => {
      const key = randomUUID();
      const a = actorSql(roles.owner, org1, `SELECT dispatch_phase22_local.create_operational_record('${org1}','HAZARD','OPEN','NORMAL','org A','a','${scope1}','{}','${key}')`);
      const b = actorSql(roles.owner, org2, `SELECT dispatch_phase22_local.create_operational_record('${org2}','HAZARD','OPEN','NORMAL','org B','b','${scope2}','{}','${key}')`);
      assert.notEqual(a,b);
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE idempotency_key='${key}'`), '2');
      actorSql(roles.owner, org1, `SELECT dispatch_phase22_local.create_operational_record('${org2}','HAZARD','OPEN','NORMAL','stale context','x','${scope2}','{}','${randomUUID()}')`, { expectFailure: true });
      actorSql(roles.owner, org2, `SELECT dispatch_phase22_local.invite_member('${org2}',0,'10000000-0000-4000-8000-000000000012','VIEWER',decode(repeat('ac',32),'hex'),now()+interval '1 day','${randomUUID()}')`, { expectFailure: true });
    });

    await t.test('live session, membership, and organization revocation apply on the next command', () => {
      ownerSql("UPDATE dispatch_phase22_local.synthetic_sessions SET revoked_at=statement_timestamp() WHERE session_id='a0000000-0000-4000-8000-000000000003'");
      assert.equal(actorSql(roles.operator, org1, 'SELECT count(*) FROM dispatch_phase21_local.operational_records'), '0');
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','revoked session','x','${scope1}','{}','${randomUUID()}')`, { expectFailure: true });
      ownerSql("UPDATE dispatch_phase22_local.synthetic_sessions SET revoked_at=NULL WHERE session_id='a0000000-0000-4000-8000-000000000003'");
      ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='SUSPENDED',suspended_at=statement_timestamp() WHERE id='${membershipOperator}'`);
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','suspended member','x','${scope1}','{}','${randomUUID()}')`, { expectFailure: true });
      ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='ACTIVE' WHERE id='${membershipOperator}'`);
      ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='SUSPENDED' WHERE id='${org1}'`);
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','suspended org','x','${scope1}','{}','${randomUUID()}')`, { expectFailure: true });
      ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='ACTIVE' WHERE id='${org1}'`);
    });

    await t.test('invitation and membership commands enforce lifecycle, roles, replay, and concurrent acceptance', async () => {
      actorSql(roles.viewer, org1, `SELECT dispatch_phase22_local.invite_member('${org1}',0,'10000000-0000-4000-8000-000000000012','VIEWER',decode(repeat('cd',32),'hex'),now()+interval '1 day','${randomUUID()}')`, { expectFailure: true });
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.invite_member('${org1}',0,'10000000-0000-4000-8000-000000000012','VIEWER',decode(repeat('cd',32),'hex'),now()+interval '1 day','${randomUUID()}')`, { expectFailure: true });
      actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.revoke_member('${org1}','30000000-0000-4000-8000-000000000001',0,'${randomUUID()}')`, { expectFailure: true });
      const orgRevision = Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`));
      const inviteKey = randomUUID();
      const inviteSql = `SELECT dispatch_phase22_local.invite_member('${org1}',${orgRevision},'10000000-0000-4000-8000-000000000012','VIEWER',decode(repeat('cd',32),'hex'),'2099-01-01 00:00:00+00','${inviteKey}')`;
      const invitation = actorSql(roles.admin, org1, inviteSql);
      assert.equal(actorSql(roles.admin, org1, inviteSql), invitation);
      const acceptedMembership = actorSql(roles.invitee1, org1, `SELECT dispatch_phase22_local.accept_invitation('${org1}','${invitation}',decode(repeat('cd',32),'hex'),'${randomUUID()}')`);
      actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.change_member_role('${org1}','${acceptedMembership}',0,'OPERATOR','${randomUUID()}')`);
      actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.suspend_member('${org1}','${acceptedMembership}',1,'${randomUUID()}')`);
      actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.activate_membership('${org1}','${acceptedMembership}',2,'${randomUUID()}')`);
      actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.revoke_member('${org1}','${acceptedMembership}',3,'${randomUUID()}')`);
      const revision2 = Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`));
      const invitation2 = actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.invite_member('${org1}',${revision2},'10000000-0000-4000-8000-000000000014','VIEWER',decode(repeat('de',32),'hex'),statement_timestamp()+interval '1 day','${randomUUID()}')`);
      const acceptKey = randomUUID();
      const acceptSql = `SELECT dispatch_phase22_local.accept_invitation('${org1}','${invitation2}',decode(repeat('de',32),'hex'),'${acceptKey}')`;
      const results = await Promise.all([
        actorSqlAsync(roles.invitee2,org1,acceptSql),actorSqlAsync(roles.invitee2,org1,acceptSql)
      ]);
      assert.deepEqual(results.map((r) => r.status), [0,0]);
      assert.equal(results[0].stdout.split(/\r?\n/).at(-1),results[1].stdout.split(/\r?\n/).at(-1));
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.organization_memberships WHERE organization_id='20000000-0000-4000-8000-000000000001' AND user_id='10000000-0000-4000-8000-000000000014' AND status='ACTIVE'"), '1');
      ownerSql(`INSERT INTO dispatch_phase21_local.organization_invitations(id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id,created_at) VALUES (gen_random_uuid(),'${org1}','user:10000000-0000-4000-8000-000000000012','VIEWER',decode(repeat('ef',32),'hex'),'PENDING',now()-interval '1 day','${membershipAdmin}',now()-interval '2 days')`);
      const expired = scalar("SELECT id FROM dispatch_phase21_local.organization_invitations WHERE token_digest=decode(repeat('ef',32),'hex')");
      actorSql(roles.invitee1, org1, `SELECT dispatch_phase22_local.accept_invitation('${org1}','${expired}',decode(repeat('ef',32),'hex'),'${randomUUID()}')`, { expectFailure: true });
      ownerSql(`INSERT INTO dispatch_phase21_local.organization_invitations(id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id,created_at,revoked_at) VALUES (gen_random_uuid(),'${org1}','user:10000000-0000-4000-8000-000000000012','VIEWER',decode(repeat('fa',32),'hex'),'REVOKED','2099-01-01 00:00:00+00','${membershipAdmin}',now()-interval '1 day',now())`);
      const revokedInvitation = scalar("SELECT id FROM dispatch_phase21_local.organization_invitations WHERE token_digest=decode(repeat('fa',32),'hex')");
      actorSql(roles.invitee1, org1, `SELECT dispatch_phase22_local.accept_invitation('${org1}','${revokedInvitation}',decode(repeat('fa',32),'hex'),'${randomUUID()}')`, { expectFailure: true });
    });

    await t.test('capability and projection commands preserve review/public boundaries and invalidation', async () => {
      actorSql(roles.admin, org1, `SELECT dispatch_phase22_local.grant_capability('${org1}',0,'awareness.planned_work.publish','${scope1}','VERIFIED_PUBLIC_ENTITY',now(),now()+interval '1 day','unauthorized','${randomUUID()}')`, { expectFailure: true });
      actorSql(roles.owner, org1, `SELECT dispatch_phase22_local.grant_capability('${org1}',0,'awareness.planned_work.publish','${scope1}','VERIFIED_PUBLIC_ENTITY',now(),now()+interval '1 day','unauthorized owner','${randomUUID()}')`, { expectFailure: true });
      const orgRevision = Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`));
      grantedCapabilityId = actorSql(roles.platform1, org1, `SELECT dispatch_phase22_local.grant_capability('${org1}',${orgRevision},'awareness.planned_work.publish','${scope1}','VERIFIED_PUBLIC_ENTITY',statement_timestamp(),statement_timestamp()+interval '1 day','synthetic governance','${randomUUID()}')`);
      sqlUuid(grantedCapabilityId);
      projectionRecordId = actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','projection source','private','${scope1}','{}','${randomUUID()}')`);
      const unsafeKey = randomUUID();
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.submit_projection_candidate('${org1}','${projectionRecordId}',0,'${cap1}','{"title":"bad","summary":"bad","private_notes":"leak"}','condition',now()+interval '1 hour','${unsafeKey}')`, { expectFailure: true });
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE idempotency_key='${unsafeKey}'`), '0');
      const candidate = actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.submit_projection_candidate('${org1}','${projectionRecordId}',0,'${cap1}','{"title":"Safe title","summary":"Safe summary","public_location":{"label":"Synthetic"}}','condition',now()+interval '1 hour','${randomUUID()}')`);
      actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.approve_projection('${org1}','${candidate}',0,'${randomUUID()}')`);
      publishedProjectionId = actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.publish_projection('${org1}','${candidate}',1,'${randomUUID()}')`);
      assert.equal(actorSql(roles.public, null, `SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${publishedProjectionId}'`), '1');
      const rejected = actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.submit_projection_candidate('${org1}','${projectionRecordId}',0,'${cap1}','{"title":"Reject","summary":"Reject"}','condition',now()+interval '1 hour','${randomUUID()}')`);
      actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.reject_projection('${org1}','${rejected}',0,'bounded reason','${randomUUID()}')`);
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE candidate_id='${rejected}'`), '0');
      const concurrentCandidate = actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.submit_projection_candidate('${org1}','${projectionRecordId}',0,'${cap1}','{"title":"Concurrent","summary":"Review"}','condition',now()+interval '1 hour','${randomUUID()}')`);
      const results = await Promise.all([
        actorSqlAsync(roles.supervisor,org1,`SELECT dispatch_phase22_local.approve_projection('${org1}','${concurrentCandidate}',0,'${randomUUID()}')`),
        actorSqlAsync(roles.admin,org1,`SELECT dispatch_phase22_local.approve_projection('${org1}','${concurrentCandidate}',0,'${randomUUID()}')`)
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(),[0,1],JSON.stringify(results));
      ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='SUSPENDED' WHERE id='${org1}'`);
      assert.equal(actorSql(roles.public,null,`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${publishedProjectionId}'`),'0');
      ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='ACTIVE' WHERE id='${org1}'`);
      ownerSql(`UPDATE dispatch_phase21_local.operational_scopes SET status='SUSPENDED' WHERE id='${scope1}'`);
      assert.equal(actorSql(roles.public,null,`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${publishedProjectionId}'`),'0');
      ownerSql(`UPDATE dispatch_phase21_local.operational_scopes SET status='ACTIVE' WHERE id='${scope1}'`);
      actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.update_operational_record('${org1}','${projectionRecordId}',0,'IN_PROGRESS','NORMAL','projection source updated','private','{}','${randomUUID()}')`);
      assert.equal(actorSql(roles.public,null,`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${publishedProjectionId}'`),'0');
      const terminalCandidate = actorSql(roles.operator, org1, `SELECT dispatch_phase22_local.submit_projection_candidate('${org1}','${projectionRecordId}',1,'${cap1}','{"title":"Terminal","summary":"Before close"}','condition',now()+interval '1 hour','${randomUUID()}')`);
      actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.approve_projection('${org1}','${terminalCandidate}',0,'${randomUUID()}')`);
      const terminalProjection = actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.publish_projection('${org1}','${terminalCandidate}',1,'${randomUUID()}')`);
      assert.equal(actorSql(roles.public,null,`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${terminalProjection}'`),'1');
      actorSql(roles.supervisor, org1, `SELECT dispatch_phase22_local.close_operational_record('${org1}','${projectionRecordId}',1,'CLOSED','${randomUUID()}')`);
      assert.equal(actorSql(roles.public,null,`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${terminalProjection}'`),'0');
      assert.equal(actorSql(roles.public,null,"SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='71000000-0000-4000-8000-000000000001'"),'1');
      const capResults = await Promise.all([
        actorSqlAsync(roles.platform1,org1,`SELECT dispatch_phase22_local.revoke_capability('${org1}','${cap1}',0,'synthetic revoke A','${randomUUID()}')`),
        actorSqlAsync(roles.platform2,org1,`SELECT dispatch_phase22_local.revoke_capability('${org1}','${cap1}',0,'synthetic revoke B','${randomUUID()}')`)
      ]);
      assert.deepEqual(capResults.map((r) => r.status).sort(),[0,1]);
      assert.equal(actorSql(roles.public,null,"SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='71000000-0000-4000-8000-000000000001'"),'0');
      assert.equal(actorSql(roles.public,null,`SELECT count(*) FROM dispatch_phase21_local.public_safe_projections WHERE id='${publishedProjectionId}'`),'0');
    });

    await t.test('ownership transfer and two-person recovery are revisioned, replay-safe, and quorum-bound', async () => {
      const orgRevision = Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`));
      actorSql(roles.supervisor,org1,`SELECT dispatch_phase22_local.initiate_ownership_transfer('${org1}',${orgRevision},'${membershipAdmin}','unauthorized supervisor',now()+interval '1 day','${randomUUID()}')`,{expectFailure:true});
      const transfer = actorSql(roles.owner, org1, `SELECT dispatch_phase22_local.initiate_ownership_transfer('${org1}',${orgRevision},'${membershipAdmin}','synthetic transfer',now()+interval '1 day','${randomUUID()}')`);
      const acceptRevision = orgRevision+1;
      const results = await Promise.all([
        actorSqlAsync(roles.admin,org1,`SELECT dispatch_phase22_local.accept_ownership_transfer('${org1}','${transfer}',${acceptRevision},'${randomUUID()}')`),
        actorSqlAsync(roles.admin,org1,`SELECT dispatch_phase22_local.accept_ownership_transfer('${org1}','${transfer}',${acceptRevision},'${randomUUID()}')`)
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(),[0,1],JSON.stringify(results));
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.organization_memberships WHERE organization_id='${org1}' AND status='ACTIVE' AND role_template='OWNER'`),'1');
      const recoveryRevision = Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`));
      const recoveryCase = actorSql(roles.platform1,org1,`SELECT dispatch_phase22_local.start_ownership_recovery('${org1}','${membershipSupervisor}',${recoveryRevision},'synthetic-case-22','synthetic evidence','${randomUUID()}')`);
      actorSql(roles.platform1,org1,`SELECT dispatch_phase22_local.approve_ownership_recovery('${org1}','${recoveryCase}','${randomUUID()}')`,{expectFailure:true});
      actorSql(roles.platform2,org1,`SELECT dispatch_phase22_local.approve_ownership_recovery('${org1}','${recoveryCase}','${randomUUID()}')`);
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.recovery_approvals WHERE recovery_case_id='${recoveryCase}'`),'2');
      assert.equal(scalar(`SELECT user_id::text FROM dispatch_phase21_local.organization_memberships WHERE organization_id='${org1}' AND status='ACTIVE' AND role_template='OWNER'`),'10000000-0000-4000-8000-000000000013');
      assert.equal(actorSql(roles.platform1,org1,`SELECT dispatch_phase21_local.has_permission('${org1}','projection.publish')`),'f');
    });

    await t.test('security-definer surface is pinned, qualified, and minimally granted', () => {
      assert.equal(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_phase22_local' AND p.prosecdef AND NOT ('search_path=\"\"'=ANY(COALESCE(p.proconfig,'{}')))"), '0');
      assert.equal(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_phase22_local' AND has_function_privilege('dispatch_phase21_public',p.oid,'EXECUTE')"), '0');
      assert.equal(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_phase22_local' AND p.prosrc ~* '\\mexecute\\M'"), '0');
      assert.equal(scalar("SELECT prosecdef AND ('search_path=\"\"'=ANY(COALESCE(proconfig,'{}'))) AND NOT has_function_privilege('dispatch_phase21_app',oid,'EXECUTE') FROM pg_proc WHERE oid='dispatch_phase21_local.enforce_exactly_one_owner()'::regprocedure"), 't');
      assert.equal(scalar("SELECT has_function_privilege('dispatch_phase21_app','dispatch_phase22_local.begin_command(uuid,text,uuid,bytea)','EXECUTE')"), 'f');
      assert.equal(scalar("SELECT has_function_privilege('dispatch_phase21_app','dispatch_phase22_local.create_operational_record(uuid,dispatch_phase21_local.record_type,dispatch_phase21_local.record_status,dispatch_phase21_local.record_priority,text,text,uuid,jsonb,uuid)','EXECUTE')"), 't');
    });

    await t.test('required audit vocabulary was emitted and evidence remains append-only', () => {
      const events = ['MEMBER_INVITED','INVITATION_ACCEPTED','MEMBER_SUSPENDED','MEMBER_REVOKED','ROLE_CHANGED',
        'OWNERSHIP_TRANSFERRED','OWNERSHIP_RECOVERED','CAPABILITY_GRANTED','CAPABILITY_REVOKED','RECORD_CREATED',
        'RECORD_UPDATED','RECORD_ASSIGNED','RECORD_CLOSED','PROJECTION_SUBMITTED','PROJECTION_APPROVED','PROJECTION_REJECTED'];
      assert.equal(scalar(`SELECT count(DISTINCT event_type) FROM dispatch_phase21_local.dispatch_audit_events WHERE event_type::text IN (${events.map((e)=>`'${e}'`).join(',')})`), String(events.length));
      ownerSql('UPDATE dispatch_phase22_local.command_receipts SET status=status', { expectFailure: true });
      ownerSql('DELETE FROM dispatch_phase22_local.recovery_approvals', { expectFailure: true });
      ownerSql('DELETE FROM dispatch_phase21_local.dispatch_audit_events', { expectFailure: true });
    });

    await t.test('rollback removes Phase 22 and Phase 21 from the disposable database', () => {
      ownerSql('DELETE FROM dispatch_phase22_local.session_bindings');
      for (const [key, role] of Object.entries(roles)) {
        ownerSql(`REVOKE ${key === 'public' ? 'dispatch_phase21_public' : 'dispatch_phase21_app'} FROM ${role}; DROP ROLE ${role}`);
      }
      fileSql(join(root,'tools','responder','phase22','rollback.sql'));
      fileSql(join(root,'tools','responder','phase21','rollback.sql'));
      assert.equal(scalar("SELECT count(*) FROM pg_namespace WHERE nspname IN ('dispatch_phase21_local','dispatch_phase22_local')"), '0');
      assert.equal(scalar("SELECT count(*) FROM pg_roles WHERE rolname IN ('dispatch_phase21_app','dispatch_phase21_public')"), '0');
    });
  } finally {
    run(dropdb, ['-h','127.0.0.1','-p',port,'-U',owner,'--if-exists','--force',db]);
  }
});
