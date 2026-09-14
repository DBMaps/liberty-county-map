// Run only against a disposable PostgreSQL 17.10 cluster bound to 127.0.0.1.
// Example: $env:RESPONDER_LOCAL_PGPORT='55461'; node tests/responder-phase1-local-schema.test.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const applyFile = path.join(root, 'db/responder-local/001_agency_private_apply.sql');
const rollbackFile = path.join(root, 'db/responder-local/001_agency_private_rollback.sql');
const bin = process.env.RESPONDER_LOCAL_PGBIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const port = process.env.RESPONDER_LOCAL_PGPORT;
if (!/^\d{4,5}$/.test(port || '') || Number(port) < 1024 || Number(port) > 65535) {
  throw new Error('Set RESPONDER_LOCAL_PGPORT to the isolated localhost fixture port.');
}
const user = process.env.RESPONDER_LOCAL_PGUSER;
if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(user || '')) {
  throw new Error('Set RESPONDER_LOCAL_PGUSER to the isolated local cluster owner.');
}
const expectedDataDirectory = process.env.RESPONDER_LOCAL_PGDATA;
const resolvedDataDirectory = expectedDataDirectory && path.resolve(expectedDataDirectory);
if (!resolvedDataDirectory || !fs.existsSync(resolvedDataDirectory)
  || !path.basename(resolvedDataDirectory).startsWith('gridly-responder-phase1-')
  || path.relative(os.tmpdir(), resolvedDataDirectory).startsWith('..')) {
  throw new Error('Set RESPONDER_LOCAL_PGDATA to a disposable gridly-responder-phase1-* directory under Temp.');
}
const db = `gridly_responder_p1_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: user, PGCONNECT_TIMEOUT: '3' };
let created = false;
let rolledBack = false;
let passed = 0;
let failed = 0;

function psql(database, args, { allowFailure = false } = {}) {
  const run = spawnSync(path.join(bin, 'psql.exe'), ['-X', '-w', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-d', database, ...args], {
    cwd: root, env, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  if (run.error) throw run.error;
  if (!allowFailure && run.status !== 0) throw new Error(`psql failed: ${run.stderr || run.stdout}`);
  return run;
}
function sql(query, opts) { return psql(db, ['-c', query], opts); }
function q(query) { return sql(query).stdout.trim(); }
function expectOk(label, query) {
  const result = sql(query, { allowFailure: true });
  const ok = result.status === 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ': ' + result.stderr.trim()}`);
  ok ? passed++ : failed++;
}
function expectDeny(label, query) {
  const result = sql(query, { allowFailure: true });
  const ok = result.status !== 0;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  ok ? passed++ : failed++;
}
function expectValue(label, query, expected) {
  let actual;
  try { actual = q(query); } catch (error) { actual = `ERROR: ${error.message}`; }
  const ok = actual === String(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : `: expected ${expected}, got ${actual}`}`);
  ok ? passed++ : failed++;
}
function fileSql(file) { return psql(db, ['-f', file]); }
function check(label, fn) {
  try { fn(); console.log(`PASS ${label}`); passed++; }
  catch (error) { console.log(`FAIL ${label}: ${error.message}`); failed++; }
}
function teardown() {
  if (!created) return;
  try {
    if (!rolledBack && q("SELECT count(*) FROM pg_namespace WHERE nspname='agency_private'") === '1') fileSql(rollbackFile);
  } catch (error) { console.error(`TEARDOWN ROLLBACK FAILURE: ${error.message}`); }
  try { psql('postgres', ['-c', `DROP DATABASE ${db} WITH (FORCE)`]); created = false; }
  catch (error) { console.error(`TEARDOWN DATABASE FAILURE: ${error.message}`); }
}
process.on('exit', teardown);
process.on('SIGINT', () => { teardown(); process.exit(130); });

const org1 = '11111111-1111-4111-8111-111111111111';
const org2 = '22222222-2222-4222-8222-222222222222';
const user1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const user2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const authority = '33333333-3333-4333-8333-333333333333';
const update = '44444444-4444-4444-8444-444444444444';
const event = '55555555-5555-4555-8555-555555555555';
const polygon = "ST_GeomFromText('POLYGON((-97 30,-96 30,-96 31,-97 31,-97 30))',4326)";
const point = "ST_SetSRID(ST_Point(-96.5,30.5),4326)";
const sha = 'a'.repeat(64);

try {
  const baseline = psql('postgres', ['-c', "SELECT current_setting('server_version')" ]).stdout.trim();
  assert.equal(baseline, '17.10');
  const actualDataDirectory = psql('postgres', ['-c', "SELECT current_setting('data_directory')"]).stdout.trim();
  assert.equal(path.resolve(actualDataDirectory).toLowerCase(), resolvedDataDirectory.toLowerCase(), 'connected server must own the expected disposable data directory');
  psql('postgres', ['-c', `CREATE DATABASE ${db}`]);
  created = true;
  console.log(`FIXTURE_DATABASE=${db} HOST=127.0.0.1 PORT=${port}`);
  sql('CREATE EXTENSION postgis');
  expectValue('exact local PostgreSQL/PostGIS versions', "SELECT current_setting('server_version') || '/' || extversion FROM pg_extension WHERE extname='postgis'", '17.10/3.6.2');
  sql('CREATE TABLE public.phase1_shared_sentinel (id integer PRIMARY KEY); INSERT INTO public.phase1_shared_sentinel VALUES (7)');
  fileSql(applyFile);
  check('all ten private tables exist', () => {
    assert.equal(q("SELECT count(*) FROM information_schema.tables WHERE table_schema='agency_private' AND table_type='BASE TABLE'"), '10');
  });
  const expectedColumns = {
    organizations: ['id','canonical_key','legal_name','public_name','organization_type','verification_state','operation_state','primary_contact_name','operation_epoch','created_at','verified_at','suspended_at','revoked_at'],
    organization_memberships: ['id','organization_id','user_id','role','status','invited_by','approved_by','joined_at','suspended_at','revoked_at','last_role_change'],
    organization_authorities: ['id','organization_id','authority_version','scope_type','county_fips','geometry','source_path','source_sha256','effective_from','effective_until','approved_by','approved_at','revoked_at','status'],
    agency_updates: ['id','organization_id','author_user_id','created_authority_id','current_authority_id','source_family','condition_type','impact_level','title','detail','point','status','revision','created_at','submitted_at','activated_at','updated_at','expires_at','resolved_at','withdrawn_at','resolved_by_user_id'],
    agency_update_events: ['id','update_id','organization_id','actor_user_id','authority_id','action','previous_snapshot','new_snapshot','point','reason','occurred_at','operation_id','revision'],
    organization_verification_events: ['id','organization_id','reviewer_user_id','from_state','to_state','method_reference','reason','occurred_at'],
    organization_governance_events: ['id','organization_id','actor_user_id','affected_membership_id','affected_authority_id','action','before_snapshot','after_snapshot','reason','correlation_id','occurred_at'],
    organization_invites: ['id','organization_id','inviter_user_id','intended_email','proposed_role','token_digest','status','created_at','expires_at','redeemed_at','revoked_at'],
    agency_operation_receipts: ['token_digest','actor_user_id','organization_id','update_id','action','payload_digest','bounded_result','accepted_at'],
    agency_program_controls: ['singleton_key','agency_publishing_enabled','policy_version','changed_by','changed_at'],
  };
  for (const [table, columns] of Object.entries(expectedColumns)) {
    check(`${table} critical columns`, () => {
      const actual = new Set(q(`SELECT column_name FROM information_schema.columns WHERE table_schema='agency_private' AND table_name='${table}'`).split(/\r?\n/));
      for (const column of columns) assert.ok(actual.has(column), `${table}.${column}`);
    });
  }
  expectValue('agency gate singleton default false', 'SELECT count(*) || \'/\' || bool_and(NOT agency_publishing_enabled) FROM agency_private.agency_program_controls', '1/true');
  expectValue('private schema absent from PUBLIC privileges', "SELECT has_schema_privilege('public','agency_private','USAGE')", 'f');
  expectValue('app fixture has no direct schema usage', "SELECT has_schema_privilege('responder_app_fixture','agency_private','USAGE')", 'f');
  expectValue('authority and point PostGIS types', "SELECT a.atttypmod::text || '/' || u.atttypmod::text FROM pg_attribute a CROSS JOIN pg_attribute u WHERE a.attrelid='agency_private.organization_authorities'::regclass AND a.attname='geometry' AND u.attrelid='agency_private.agency_updates'::regclass AND u.attname='point'", '1107468/1107460');
  expectValue('required foreign keys exist', "SELECT count(*) FROM pg_constraint WHERE connamespace='agency_private'::regnamespace AND contype='f'", '15');

  expectOk('insert verified active synthetic organizations', `INSERT INTO agency_private.organizations(id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state) VALUES ('${org1}','county-a','County A','County A','county_agency','verified','active'),('${org2}','county-b','County B','County B','county_agency','verified','active')`);
  expectDeny('invalid verification state', "INSERT INTO agency_private.organizations(canonical_key,legal_name,public_name,organization_type,verification_state) VALUES ('bad-verification','Bad Agency','Bad Agency','county_agency','unknown')");
  expectDeny('invalid operation state', "INSERT INTO agency_private.organizations(canonical_key,legal_name,public_name,organization_type,operation_state) VALUES ('bad-operation','Bad Agency','Bad Agency','county_agency','unknown')");
  expectDeny('duplicate canonical organization key', "INSERT INTO agency_private.organizations(canonical_key,legal_name,public_name,organization_type) VALUES ('county-a','Duplicate','Duplicate','county_agency')");
  expectDeny('unverified organization cannot be active', "INSERT INTO agency_private.organizations(canonical_key,legal_name,public_name,organization_type,operation_state) VALUES ('unverified-active','Bad Agency','Bad Agency','county_agency','active')");
  expectDeny('organization ID immutable', `UPDATE agency_private.organizations SET id='${org2}' WHERE id='${org1}'`);

  expectOk('insert active membership', `INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at) VALUES ('${org1}','${user1}','RESPONDER','active',now())`);
  expectDeny('invalid membership role', `INSERT INTO agency_private.organization_memberships(organization_id,user_id,role) VALUES ('${org1}','${user2}','GRIDLY_ADMIN')`);
  expectDeny('invalid membership status', `INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status) VALUES ('${org1}','${user2}','VIEWER','unknown')`);
  expectDeny('duplicate organization/user membership', `INSERT INTO agency_private.organization_memberships(organization_id,user_id,role) VALUES ('${org1}','${user1}','VIEWER')`);
  expectDeny('second active organization for same user', `INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at) VALUES ('${org2}','${user1}','VIEWER','active',now())`);

  const authorityValues = `('${authority}','${org1}',1,'48001',${polygon},'synthetic-fixture','${sha}','fixture.v1',now(),now() + interval '1 day','${user2}',now(),'approved')`;
  expectOk('insert approved county polygon version', `INSERT INTO agency_private.organization_authorities(id,organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from,effective_until,approved_by,approved_at,status) VALUES ${authorityValues}`);
  expectDeny('invalid county FIPS', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from) VALUES ('${org2}',1,'01001',${polygon},'fixture','${sha}','fixture.v1',now())`);
  expectDeny('null county geometry', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,source_path,source_sha256,source_schema_version,effective_from) VALUES ('${org2}',1,'48003','fixture','${sha}','fixture.v1',now())`);
  expectDeny('wrong geometry SRID', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from) VALUES ('${org2}',1,'48003',ST_SetSRID(${polygon},3857),'fixture','${sha}','fixture.v1',now())`);
  expectDeny('out-of-range county polygon rejected', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from) VALUES ('${org2}',1,'48003',ST_GeomFromText('POLYGON((200 30,201 30,201 31,200 31,200 30))',4326),'fixture','${sha}','fixture.v1',now())`);
  expectDeny('municipal point cannot become authority polygon', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,scope_type,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from) VALUES ('${org2}',1,'MUNICIPAL','48003',${point},'fixture','${sha}','fixture.v1',now())`);
  expectDeny('second approved authority for same org/county', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from,approved_by,approved_at,status) VALUES ('${org1}',2,'48001',${polygon},'fixture','${sha}','fixture.v1',now(),'${user2}',now(),'approved')`);
  expectDeny('approved authority geometry immutable', `UPDATE agency_private.organization_authorities SET geometry=ST_Translate(geometry,1,0) WHERE id='${authority}'`);
  expectDeny('approved authority hard delete denied', `DELETE FROM agency_private.organization_authorities WHERE id='${authority}'`);
  expectValue('county geometry covers synthetic point', `SELECT ST_Contains(a.geometry,${point}) FROM agency_private.organization_authorities a WHERE id='${authority}'`, 't');

  expectDeny('invalid update condition', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point) VALUES ('${org1}','${user1}','${authority}','evacuation','high','Bad',${point})`);
  expectDeny('invalid update lifecycle', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point,status) VALUES ('${org1}','${user1}','${authority}','road_closed','high','Bad',${point},'effective_expired')`);
  expectDeny('out-of-range update point rejected', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point) VALUES ('${org1}','${user1}','${authority}','road_closed','high','Bad',ST_SetSRID(ST_Point(200,95),4326))`);
  expectDeny('community source cannot impersonate agency', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,source_family,condition_type,impact_level,title,point) VALUES ('${org1}','${user1}','${authority}','COMMUNITY','road_closed','high','Bad',${point})`);
  expectDeny('NWS source cannot impersonate agency', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,source_family,condition_type,impact_level,title,point) VALUES ('${org1}','${user1}','${authority}','NWS','road_closed','high','Bad',${point})`);
  expectDeny('cross-organization authority binding rejected', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point) VALUES ('${org2}','${user1}','${authority}','road_closed','high','Bad',${point})`);
  expectDeny('active update requires expiry and activation', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,current_authority_id,condition_type,impact_level,title,point,status) VALUES ('${org1}','${user1}','${authority}','${authority}','road_closed','high','Bad',${point},'active')`);
  expectDeny('negative update revision', `INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point,revision) VALUES ('${org1}','${user1}','${authority}','road_closed','high','Bad',${point},-1)`);
  expectOk('insert valid draft revision zero', `INSERT INTO agency_private.agency_updates(id,organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point) VALUES ('${update}','${org1}','${user1}','${authority}','road_closed','high','Synthetic closure',${point})`);
  expectDeny('source family immutable', `UPDATE agency_private.agency_updates SET source_family='NWS',revision=1 WHERE id='${update}'`);
  expectDeny('revision cannot skip', `UPDATE agency_private.agency_updates SET title='Skip',revision=2 WHERE id='${update}'`);
  expectDeny('draft cannot activate directly', `UPDATE agency_private.agency_updates SET status='active',revision=1,current_authority_id='${authority}',activated_at=now(),expires_at=now()+interval '12 hours' WHERE id='${update}'`);
  expectOk('draft submits for review at revision one', `UPDATE agency_private.agency_updates SET status='pending_review',revision=1,submitted_at=now() WHERE id='${update}'`);
  expectDeny('active expiry before activation', `UPDATE agency_private.agency_updates SET status='active',revision=2,current_authority_id='${authority}',activated_at=now(),expires_at=now()-interval '1 hour' WHERE id='${update}'`);
  expectDeny('active expiry beyond 24 hours', `UPDATE agency_private.agency_updates SET status='active',revision=2,current_authority_id='${authority}',activated_at=now(),expires_at=now()+interval '25 hours' WHERE id='${update}'`);
  expectOk('reviewed update activates within 24 hours', `UPDATE agency_private.agency_updates SET status='active',revision=2,current_authority_id='${authority}',activated_at=now(),expires_at=now()+interval '12 hours' WHERE id='${update}'`);
  expectDeny('hard delete of update denied', `DELETE FROM agency_private.agency_updates WHERE id='${update}'`);

  expectOk('append update event', `INSERT INTO agency_private.agency_update_events(id,update_id,organization_id,actor_user_id,authority_id,action,point,revision) VALUES ('${event}','${update}','${org1}','${user2}','${authority}','update_activated',${point},2)`);
  expectDeny('duplicate update event revision', `INSERT INTO agency_private.agency_update_events(update_id,organization_id,actor_user_id,action,revision) VALUES ('${update}','${org1}','${user2}','duplicate',2)`);
  expectDeny('update event UPDATE denied', `UPDATE agency_private.agency_update_events SET action='tamper' WHERE id='${event}'`);
  expectDeny('update event DELETE denied', `DELETE FROM agency_private.agency_update_events WHERE id='${event}'`);
  expectDeny('update event TRUNCATE denied', 'TRUNCATE agency_private.agency_update_events');
  expectOk('append verification event', `INSERT INTO agency_private.organization_verification_events(organization_id,reviewer_user_id,to_state) VALUES ('${org1}','${user2}','verified')`);
  expectDeny('verification event UPDATE denied', 'UPDATE agency_private.organization_verification_events SET reason=\'tamper\'');
  expectOk('append governance event', `INSERT INTO agency_private.organization_governance_events(organization_id,actor_user_id,action) VALUES ('${org1}','${user2}','approved')`);
  expectDeny('governance event DELETE denied', 'DELETE FROM agency_private.organization_governance_events');

  expectOk('insert live digest-only invite', `INSERT INTO agency_private.organization_invites(organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at) VALUES ('${org1}','${user2}','invite@example.test','VIEWER',decode(repeat('b',64),'hex'),now()+interval '1 day')`);
  expectValue('raw invite token column absent', "SELECT count(*) FROM information_schema.columns WHERE table_schema='agency_private' AND table_name='organization_invites' AND column_name='token'", '0');
  expectDeny('duplicate live invite rejected', `INSERT INTO agency_private.organization_invites(organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at) VALUES ('${org1}','${user2}','invite@example.test','VIEWER',decode(repeat('c',64),'hex'),now()+interval '1 day')`);
  expectDeny('invalid terminal invite timestamp rejected', `INSERT INTO agency_private.organization_invites(organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at,status) VALUES ('${org1}','${user2}','other@example.test','VIEWER',decode(repeat('d',64),'hex'),now()+interval '1 day','redeemed')`);
  expectDeny('invite expiry must follow creation', `INSERT INTO agency_private.organization_invites(organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at) VALUES ('${org1}','${user2}','third@example.test','VIEWER',decode(repeat('e',64),'hex'),now()-interval '1 day')`);
  expectOk('insert effectively expired invite', `INSERT INTO agency_private.organization_invites(organization_id,inviter_user_id,intended_email,proposed_role,token_digest,created_at,expires_at) VALUES ('${org1}','${user2}','expired@example.test','VIEWER',decode(repeat('1',64),'hex'),now()-interval '2 days',now()-interval '1 day')`);
  expectDeny('expired invite cannot redeem', "UPDATE agency_private.organization_invites SET status='redeemed',redeemed_at=now() WHERE intended_email='expired@example.test'");
  expectOk('new invite permitted after effective expiry', `INSERT INTO agency_private.organization_invites(organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at) VALUES ('${org1}','${user2}','expired@example.test','VIEWER',decode(repeat('2',64),'hex'),now()+interval '1 day')`);

  expectOk('insert immutable digest-only operation receipt', `INSERT INTO agency_private.agency_operation_receipts(token_digest,actor_user_id,organization_id,update_id,action,payload_digest,bounded_result) VALUES (decode(repeat('f',64),'hex'),'${user2}','${org1}','${update}','activate_road_closed',decode(repeat('a',64),'hex'),'{}')`);
  expectDeny('duplicate receipt digest rejected', `INSERT INTO agency_private.agency_operation_receipts(token_digest,actor_user_id,organization_id,action,payload_digest,bounded_result) VALUES (decode(repeat('f',64),'hex'),'${user2}','${org1}','other',decode(repeat('a',64),'hex'),'{}')`);
  expectDeny('receipt UPDATE denied', 'UPDATE agency_private.agency_operation_receipts SET action=\'tamper\'');
  expectDeny('receipt DELETE denied', 'DELETE FROM agency_private.agency_operation_receipts');
  expectValue('raw operation token column absent', "SELECT count(*) FROM information_schema.columns WHERE table_schema='agency_private' AND table_name='agency_operation_receipts' AND column_name='operation_token'", '0');

  expectDeny('app role cannot insert update', `SET ROLE responder_app_fixture; INSERT INTO agency_private.agency_updates(organization_id,author_user_id,created_authority_id,condition_type,impact_level,title,point) VALUES ('${org1}','${user1}','${authority}','road_closed','high','Bad',${point})`);
  expectDeny('app role cannot update update', `SET ROLE responder_app_fixture; UPDATE agency_private.agency_updates SET title='Bad' WHERE id='${update}'`);
  expectDeny('app role cannot delete update', `SET ROLE responder_app_fixture; DELETE FROM agency_private.agency_updates WHERE id='${update}'`);
  expectDeny('app role cannot insert event', `SET ROLE responder_app_fixture; INSERT INTO agency_private.agency_update_events(update_id,organization_id,actor_user_id,action,revision) VALUES ('${update}','${org1}','${user1}','bad',3)`);
  expectDeny('app role cannot mutate events', 'SET ROLE responder_app_fixture; DELETE FROM agency_private.agency_update_events');
  expectDeny('app role cannot change authority', `SET ROLE responder_app_fixture; UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=now() WHERE id='${authority}'`);
  expectDeny('app role cannot enable agency gate', 'SET ROLE responder_app_fixture; UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  expectValue('agency gate remains false after denial', 'SELECT agency_publishing_enabled FROM agency_private.agency_program_controls', 'f');
  expectDeny('singleton control cannot duplicate', 'INSERT INTO agency_private.agency_program_controls DEFAULT VALUES');
  expectDeny('singleton control cannot be deleted', 'DELETE FROM agency_private.agency_program_controls');
  expectValue('owner fixture can read private setup', "SET ROLE responder_owner_fixture; SELECT count(*) FROM agency_private.organizations", '2');

  expectOk('resolve active update revision three', `UPDATE agency_private.agency_updates SET status='resolved',revision=3,resolved_at=now(),resolved_by_user_id='${user2}' WHERE id='${update}'`);
  expectDeny('terminal update cannot reactivate', `UPDATE agency_private.agency_updates SET status='active',revision=4 WHERE id='${update}'`);
  expectOk('revoke approved authority version', `UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=now() WHERE id='${authority}'`);
  expectDeny('revoked authority geometry stays immutable', `UPDATE agency_private.organization_authorities SET geometry=ST_Translate(geometry,1,0) WHERE id='${authority}'`);
  expectOk('insert next county authority version', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from,approved_by,approved_at,status) VALUES ('${org1}',2,'48001',${polygon},'fixture','${sha}','fixture.v1',now(),'${user2}',now(),'approved')`);
  expectDeny('stale authority version cannot be inserted', `INSERT INTO agency_private.organization_authorities(organization_id,authority_version,county_fips,geometry,source_path,source_sha256,source_schema_version,effective_from) VALUES ('${org1}',1,'48001',${polygon},'fixture','${sha}','fixture.v1',now())`);

  fileSql(rollbackFile);
  rolledBack = true;
  expectValue('rollback removes responder schema', "SELECT count(*) FROM pg_namespace WHERE nspname='agency_private'", '0');
  expectValue('rollback preserves shared sentinel', 'SELECT id FROM public.phase1_shared_sentinel', '7');
  fileSql(applyFile);
  rolledBack = false;
  expectValue('reapply restores ten tables', "SELECT count(*) FROM information_schema.tables WHERE table_schema='agency_private' AND table_type='BASE TABLE'", '10');
  expectValue('reapply restores gate false', 'SELECT agency_publishing_enabled FROM agency_private.agency_program_controls', 'f');
  fileSql(rollbackFile);
  rolledBack = true;
  expectValue('second rollback preserves shared sentinel', 'SELECT id FROM public.phase1_shared_sentinel', '7');
} finally {
  teardown();
}
console.log(`TOTAL ${passed} PASS ${failed} FAIL`);
if (failed) process.exitCode = 1;
