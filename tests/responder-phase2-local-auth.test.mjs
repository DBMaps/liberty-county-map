// Trusted local-only fixture. No Supabase Auth, SMTP, browser, or remote database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = process.env.RESPONDER_LOCAL_PGBIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const port = process.env.RESPONDER_LOCAL_PGPORT;
const user = process.env.RESPONDER_LOCAL_PGUSER;
const expectedDataDirectory = process.env.RESPONDER_LOCAL_PGDATA;
const dataDirectory = expectedDataDirectory && path.resolve(expectedDataDirectory);
if (!/^\d{4,5}$/.test(port || '') || Number(port) < 1024 || Number(port) > 65535
  || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(user || '')
  || !dataDirectory || !fs.existsSync(dataDirectory)
  || !path.basename(dataDirectory).startsWith('gridly-responder-phase2-')
  || path.relative(os.tmpdir(), dataDirectory).startsWith('..')) {
  throw new Error('Set explicit disposable Phase 2 localhost PGPORT, PGUSER, and PGDATA under Temp.');
}
const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: port, PGUSER: user, PGCONNECT_TIMEOUT: '3' };
const database = `gridly_responder_p2_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
let created = false;
let passed = 0;
let failed = 0;

function psql(db, args, allowFailure = false) {
  const result = spawnSync(path.join(bin, 'psql.exe'), ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args], {
    cwd: root, env, encoding: 'utf8', timeout: 30000, windowsHide: true,
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result;
}
const sql = statement => psql(database, ['-c', statement]);
const q = statement => sql(statement).stdout.trim();
const file = relative => psql(database, ['-f', path.join(root, relative)]);
function check(label, actual, expected) {
  const okay = String(actual) === String(expected);
  console.log(`${okay ? 'PASS' : 'FAIL'} ${label}${okay ? '' : ` expected=${expected} actual=${actual}`}`);
  okay ? passed++ : failed++;
}
function denial(label, statement) {
  const result = psql(database, ['-c', statement], true);
  const okay = result.status !== 0;
  console.log(`${okay ? 'PASS' : 'FAIL'} ${label}`);
  okay ? passed++ : failed++;
}
function cleanup() {
  if (!created) return;
  try {
    if (psql(database, ['-c', "SELECT count(*) FROM pg_namespace WHERE nspname='agency_private'"]).stdout.trim() === '1') {
      file('db/responder-local/001_agency_private_rollback.sql');
    }
  } catch (error) { console.error(`FIXTURE SCHEMA TEARDOWN FAILED: ${error.message}`); }
  try { psql('postgres', ['-c', `DROP DATABASE ${database} WITH (FORCE)`]); created = false; }
  catch (error) { console.error(`FIXTURE TEARDOWN FAILED: ${error.message}`); }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

const orgA='11111111-1111-4111-8111-111111111111';
const orgB='22222222-2222-4222-8222-222222222222';
const orgC='33333333-3333-4333-8333-333333333333';
const orgD='44444444-4444-4444-8444-444444444444';
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const D='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const F='ffffffff-ffff-4fff-8fff-ffffffffffff';
const G='99999999-9999-4999-8999-999999999999';
const H='88888888-8888-4888-8888-888888888888';
const digests=['a','b','c','d','e','f','1','2','3','4'].map(c=>c.repeat(64));
const literal = value => value == null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const uuid = value => `${literal(value)}::uuid`;
const txt = value => `${literal(value)}::text`;
const digest = value => value == null ? 'NULL::bytea' : `decode(${literal(value)},'hex')`;
function command(action, actor, org, options={}) {
  const { target=null, role=null, invite=null, tokenDigest=null, reason=null, reviewed=false }=options;
  const statement=`SELECT agency_private.phase2_membership_command(${txt(action)},${uuid(actor)},${uuid(org)},${uuid(target)},${txt(role)},${uuid(invite)},${digest(tokenDigest)},${txt(reason)},${uuid(randomUUID())},${reviewed})`;
  return q(statement);
}
const expectCommand=(label,expected,action,actor,org,options)=>check(label,command(action,actor,org,options),expected);
const auditCount=()=>Number(q('SELECT count(*) FROM agency_private.organization_governance_events'));

try {
  check('connected PostgreSQL is 17.10',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  const actualDirectory=psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim();
  assert.equal(path.resolve(actualDirectory).toLowerCase(),dataDirectory.toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]);
  created=true;
  console.log(`FIXTURE_DATABASE=${database} HOST=127.0.0.1 PORT=${port}`);
  sql('CREATE EXTENSION postgis');
  check('PostGIS is 3.6.2',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  file('db/responder-local/001_agency_private_apply.sql');
  file('db/responder-local/002_phase2_auth_membership_apply.sql');
  check('Phase 2 local identity table exists',q("SELECT count(*) FROM information_schema.tables WHERE table_schema='agency_private' AND table_name='local_auth_identities'"),'1');
  check('one-active-org index preserved',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='membership_one_active_org_per_user_idx'"),'1');
  check('one-current-membership index installed',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='memberships_one_current_org_user_idx'"),'1');
  check('agency gate remains false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');

  sql(`INSERT INTO agency_private.organizations(id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state)
    VALUES ('${orgA}','phase2-a','Phase 2 A','Phase 2 A','county_agency','verified','active'),
      ('${orgB}','phase2-b','Phase 2 B','Phase 2 B','county_agency','verified','active'),
      ('${orgC}','phase2-c','Phase 2 C','Phase 2 C','county_agency','verified','active'),
      ('${orgD}','phase2-d','Phase 2 D','Phase 2 D','county_agency','verified','active')`);
  sql(`INSERT INTO agency_private.local_auth_identities(user_id,normalized_email,identity_kind,assurance,session_active,eligibility)
    VALUES ('${A}','admin-a@example.test','RESPONDER','aal2',true,'eligible'),
      ('${B}','responder-b@example.test','RESPONDER','aal1',true,'eligible'),
      ('${C}','admin-c@example.test','RESPONDER','aal2',true,'eligible'),
      ('${D}','responder-d@example.test','RESPONDER','aal2',true,'eligible'),
      ('${F}','responder-f@example.test','RESPONDER','aal2',true,'eligible'),
      ('${G}','gridly-g@example.test','GRIDLY_ADMIN','aal2',true,'eligible'),
      ('${H}','admin-h@example.test','RESPONDER','aal2',true,'eligible')`);
  sql(`INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at,suspended_at,revoked_at)
    VALUES ('${orgA}','${A}','AGENCY_ADMIN','active',now(),NULL,NULL),
      ('${orgB}','${C}','AGENCY_ADMIN','active',now(),NULL,NULL),
      ('${orgC}','${H}','AGENCY_ADMIN','suspended',now()-interval '1 day',now(),NULL),
      ('${orgD}','${D}','AGENCY_ADMIN','revoked',now()-interval '1 day',NULL,now())`);

  check('unknown user dashboard denied',q(`SELECT agency_private.phase2_dashboard_access('00000000-0000-4000-8000-000000000000')`),'forbidden');
  check('aal2 active admin dashboard accepted',q(`SELECT agency_private.phase2_dashboard_access('${A}')`),'accepted');
  sql(`UPDATE agency_private.local_auth_identities SET session_active=false WHERE user_id='${A}'`);
  check('inactive session denied',q(`SELECT agency_private.phase2_dashboard_access('${A}')`),'forbidden');
  sql(`UPDATE agency_private.local_auth_identities SET session_active=true WHERE user_id='${A}'`);
  check('Gridly governance identity has no agency dashboard',q(`SELECT agency_private.phase2_dashboard_access('${G}')`),'forbidden');

  const beforeInvite=auditCount();
  expectCommand('P11 admin invites responder','accepted','invite_member',A,orgA,{target:B,role:'RESPONDER',tokenDigest:digests[0]});
  check('invite creation audited once',auditCount(),beforeInvite+1);
  const inviteB=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgA}' AND intended_email='responder-b@example.test' AND status='created'`);
  expectCommand('duplicate live invite rejected','invalid_request','invite_member',A,orgA,{target:B,role:'RESPONDER',tokenDigest:digests[1]});
  expectCommand('aal1 invitation redemption denied','forbidden','redeem_invite',B,orgA,{invite:inviteB,tokenDigest:digests[0]});
  const beforeWrongIdentity=auditCount();
  expectCommand('N32 wrong identity redemption denied','forbidden','redeem_invite',D,orgA,{invite:inviteB,tokenDigest:digests[0]});
  check('N32 wrong identity leaves no business event',auditCount(),beforeWrongIdentity);
  sql(`UPDATE agency_private.local_auth_identities SET assurance='aal2' WHERE user_id='${B}'`);
  const beforeRedeem=auditCount();
  expectCommand('P12 matching aal2 redemption activates membership','accepted','redeem_invite',B,orgA,{invite:inviteB,tokenDigest:digests[0]});
  check('redemption and activation each audited',auditCount(),beforeRedeem+2);
  check('membership active after redemption',q(`SELECT status FROM agency_private.organization_memberships WHERE organization_id='${orgA}' AND user_id='${B}' AND status='active'`),'active');
  const beforeReplay=auditCount();
  expectCommand('N30 redeemed invite replay bounded','already_processed','redeem_invite',B,orgA,{invite:inviteB,tokenDigest:digests[0]});
  check('invite replay appends no event',auditCount(),beforeReplay);
  sql(`UPDATE agency_private.local_auth_identities SET assurance='aal1' WHERE user_id='${B}'`);
  const beforeAal1Dashboard=auditCount();
  check('N07 aal1 active responder dashboard denied',q(`SELECT agency_private.phase2_dashboard_access('${B}')`),'forbidden');
  check('N07 dashboard denial leaves no business event',auditCount(),beforeAal1Dashboard);
  sql(`UPDATE agency_private.local_auth_identities SET assurance='aal2' WHERE user_id='${B}'`);
  check('aal2 restored dashboard access',q(`SELECT agency_private.phase2_dashboard_access('${B}')`),'accepted');

  expectCommand('valid role change to Supervisor','accepted','change_member_role',A,orgA,{target:B,role:'SUPERVISOR',reason:'reviewed fixture change'});
  check('role change audited',q(`SELECT count(*) FROM agency_private.organization_governance_events WHERE action='member_role_changed'`),'1');
  expectCommand('invalid role rejected','invalid_request','change_member_role',A,orgA,{target:B,role:'GRIDLY_ADMIN',reason:'invalid role'});
  const beforeSelfPromotion=auditCount();
  expectCommand('N05 admin self-promotion rejected','forbidden','change_member_role',A,orgA,{target:A,role:'GRIDLY_ADMIN',reason:'self escalation'});
  check('N05 self-promotion leaves no business event',auditCount(),beforeSelfPromotion);
  expectCommand('Supervisor self-promotion rejected','forbidden','change_member_role',B,orgA,{target:B,role:'AGENCY_ADMIN',reason:'self escalation'});
  expectCommand('cross-org admin role change rejected','forbidden','change_member_role',C,orgA,{target:B,role:'VIEWER',reason:'wrong org'});
  expectCommand('last admin demotion rejected','forbidden','change_member_role',A,orgA,{target:A,role:'VIEWER',reason:'last admin'});
  expectCommand('last admin suspension rejected','forbidden','suspend_member',A,orgA,{target:A,reason:'last admin'});
  const beforeLastAdmin=auditCount();
  expectCommand('N06 last admin revocation rejected','forbidden','revoke_member',A,orgA,{target:A,reason:'last admin'});
  check('N06 last-admin denial leaves no business event',auditCount(),beforeLastAdmin);
  sql(`UPDATE agency_private.local_auth_identities SET assurance='aal1' WHERE user_id='${A}'`);
  expectCommand('aal1 role change denied','forbidden','change_member_role',A,orgA,{target:B,role:'RESPONDER',reason:'aal1'});
  sql(`UPDATE agency_private.local_auth_identities SET assurance='aal2' WHERE user_id='${A}'`);

  expectCommand('second-org invite may exist without activation','accepted','invite_member',C,orgB,{target:B,role:'VIEWER',tokenDigest:digests[1]});
  const inviteB2=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgB}' AND intended_email='responder-b@example.test' AND status='created'`);
  expectCommand('second active organization redemption denied','forbidden','redeem_invite',B,orgB,{invite:inviteB2,tokenDigest:digests[1]});
  check('one active organization remains',q(`SELECT count(*) FROM agency_private.organization_memberships WHERE user_id='${B}' AND status='active'`),'1');
  expectCommand('revoke second-org invite','accepted','revoke_invite',C,orgB,{invite:inviteB2,reason:'withdraw duplicate'});
  check('historical revoked membership retained',q(`SELECT count(*) FROM agency_private.organization_memberships WHERE organization_id='${orgB}' AND user_id='${B}' AND status='revoked'`),'1');

  sql(`UPDATE agency_private.organizations SET operation_state='suspended',suspended_at=now() WHERE id='${orgA}'`);
  expectCommand('suspended org blocks invitations','suspended','invite_member',A,orgA,{target:F,role:'VIEWER',tokenDigest:digests[2]});
  check('suspended org blocks dashboard',q(`SELECT agency_private.phase2_dashboard_access('${A}')`),'suspended');
  sql(`UPDATE agency_private.organizations SET operation_state='active',suspended_at=NULL WHERE id='${orgA}'`);

  expectCommand('create expiring invite','accepted','invite_member',A,orgA,{target:F,role:'VIEWER',tokenDigest:digests[2]});
  const inviteF=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgA}' AND intended_email='responder-f@example.test' AND status='created'`);
  sql(`UPDATE agency_private.organization_invites SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id='${inviteF}'`);
  const beforeExpired=auditCount();
  expectCommand('N31 expired invite denied','expired','redeem_invite',F,orgA,{invite:inviteF,tokenDigest:digests[2]});
  check('expired denial has no business event',auditCount(),beforeExpired);
  expectCommand('revoke expired fixture invite','accepted','revoke_invite',A,orgA,{invite:inviteF,reason:'expired fixture cleanup'});
  expectCommand('create replacement invite','accepted','invite_member',A,orgA,{target:F,role:'VIEWER',tokenDigest:digests[3]});
  const inviteF2=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgA}' AND intended_email='responder-f@example.test' AND status='created'`);
  expectCommand('revoke live invite','accepted','revoke_invite',A,orgA,{invite:inviteF2,reason:'owner fixture revocation'});
  expectCommand('revoked invite cannot redeem','forbidden','redeem_invite',F,orgA,{invite:inviteF2,tokenDigest:digests[3]});
  check('raw invite token column absent',q("SELECT count(*) FROM information_schema.columns WHERE table_schema='agency_private' AND table_name='organization_invites' AND column_name='token'"),'0');

  const epochBefore=Number(q(`SELECT session_epoch FROM agency_private.local_auth_identities WHERE user_id='${B}'`));
  const beforeSuspension=auditCount();
  expectCommand('P13 admin suspends non-last-admin member','accepted','suspend_member',A,orgA,{target:B,reason:'terminated employee'});
  check('P13 suspension appends one business event',auditCount(),beforeSuspension+1);
  check('suspension increments session epoch',q(`SELECT session_epoch FROM agency_private.local_auth_identities WHERE user_id='${B}'`),epochBefore+1);
  check('suspension invalidates local session',q(`SELECT session_active FROM agency_private.local_auth_identities WHERE user_id='${B}'`),'f');
  check('stale role claim cannot authorize offboarded member',q(`SELECT agency_private.phase2_membership_access('${B}','${orgA}')`),'forbidden');
  expectCommand('suspended member cannot make privileged change','forbidden','change_member_role',B,orgA,{target:B,role:'AGENCY_ADMIN',reason:'stale claim'});
  sql(`UPDATE agency_private.local_auth_identities SET session_active=true,assurance='aal2' WHERE user_id='${B}'`);
  expectCommand('reviewed suspended-to-active reinstatement','accepted','reactivate_member',A,orgA,{target:B,reason:'reviewed rehire'});
  expectCommand('active member revocation','accepted','revoke_member',A,orgA,{target:B,reason:'final offboarding'});
  check('revoked membership blocks dashboard',q(`SELECT agency_private.phase2_dashboard_access('${B}')`),'forbidden');
  expectCommand('revoked row cannot direct reinstate','forbidden','reactivate_member',A,orgA,{target:B,reason:'invalid direct reactivation'});
  sql(`UPDATE agency_private.local_auth_identities SET session_active=true,assurance='aal2' WHERE user_id='${B}'`);
  expectCommand('new invite after revocation accepted','accepted','invite_member',A,orgA,{target:B,role:'RESPONDER',tokenDigest:digests[4]});
  const inviteB3=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgA}' AND intended_email='responder-b@example.test' AND status='created'`);
  expectCommand('new membership record activates through new invite','accepted','redeem_invite',B,orgA,{invite:inviteB3,tokenDigest:digests[4]});
  check('revoked history and new active membership both retained',q(`SELECT count(*) FROM agency_private.organization_memberships WHERE organization_id='${orgA}' AND user_id='${B}'`),'2');

  expectCommand('new invite for suspended-to-revoked test','accepted','invite_member',A,orgA,{target:F,role:'RESPONDER',tokenDigest:digests[5]});
  const inviteF3=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgA}' AND intended_email='responder-f@example.test' AND status='created'`);
  expectCommand('new F invite redeems','accepted','redeem_invite',F,orgA,{invite:inviteF3,tokenDigest:digests[5]});
  expectCommand('F active to suspended','accepted','suspend_member',A,orgA,{target:F,reason:'temporary offboarding'});
  expectCommand('F suspended to revoked','accepted','revoke_member',A,orgA,{target:F,reason:'permanent offboarding'});

  expectCommand('Gridly recovery denied while ordinary admin exists','forbidden','recover_admin',G,orgA,{target:B,reason:'not lost',reviewed:true});
  expectCommand('unreviewed Gridly recovery denied','forbidden','recover_admin',G,orgC,{target:H,reason:'lost admin',reviewed:false});
  const beforeRecovery=auditCount();
  expectCommand('reviewed Gridly suspended-admin recovery','accepted','recover_admin',G,orgC,{target:H,reason:'verified official callback',reviewed:true});
  check('suspended-admin recovery audited',auditCount(),beforeRecovery+1);
  check('recovered admin active',q(`SELECT status FROM agency_private.organization_memberships WHERE organization_id='${orgC}' AND user_id='${H}'`),'active');
  expectCommand('recovery denied after usable admin restored','forbidden','recover_admin',G,orgC,{target:H,reason:'repeat',reviewed:true});
  expectCommand('Gridly cannot recover self','forbidden','recover_admin',G,orgD,{target:G,reason:'self claim',reviewed:true});
  expectCommand('reviewed recovery creates new admin invitation','accepted','recover_admin',G,orgD,{target:D,tokenDigest:digests[6],reason:'independent agency evidence',reviewed:true});
  const recoveryInvite=q(`SELECT id FROM agency_private.organization_invites WHERE organization_id='${orgD}' AND intended_email='responder-d@example.test' AND status='created'`);
  expectCommand('recovery invite requires target aal2 redemption','accepted','redeem_invite',D,orgD,{invite:recoveryInvite,tokenDigest:digests[6]});
  check('prior revoked admin history preserved',q(`SELECT count(*) FROM agency_private.organization_memberships WHERE organization_id='${orgD}' AND user_id='${D}' AND status='revoked'`),'1');
  check('new recovered admin membership active',q(`SELECT count(*) FROM agency_private.organization_memberships WHERE organization_id='${orgD}' AND user_id='${D}' AND status='active'`),'1');

  denial('governance audit UPDATE denied',"UPDATE agency_private.organization_governance_events SET action='tamper'");
  denial('governance audit DELETE denied','DELETE FROM agency_private.organization_governance_events');
  denial('app fixture cannot direct-write memberships',`SET ROLE responder_app_fixture; UPDATE agency_private.organization_memberships SET role='AGENCY_ADMIN' WHERE user_id='${B}'`);
  denial('app fixture cannot invoke trusted local command',`SET ROLE responder_app_fixture; SELECT agency_private.phase2_membership_command('revoke_member','${B}','${orgA}')`);
  check('agency gate still false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  check('all membership governance events retained',q("SELECT count(*) > 10 FROM agency_private.organization_governance_events"),'t');
} finally {
  cleanup();
}
console.log(`TOTAL ${passed} PASS ${failed} FAIL`);
if (failed) process.exitCode=1;
