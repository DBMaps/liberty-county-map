// Phase 4 LOCAL/DISPOSABLE RLS fixture. No Supabase Auth or production access.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCountyCatalog } from '../tools/responder-local/load-county-authority.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bin=process.env.RESPONDER_LOCAL_PGBIN || 'C:\\Program Files\\PostgreSQL\\17\\bin';
const port=process.env.RESPONDER_LOCAL_PGPORT;
const owner=process.env.RESPONDER_LOCAL_PGUSER;
const dataDirectory=process.env.RESPONDER_LOCAL_PGDATA && path.resolve(process.env.RESPONDER_LOCAL_PGDATA);
if (!/^\d{4,5}$/.test(port||'') || Number(port)<1024 || Number(port)>65535
  || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(owner||'')
  || !dataDirectory || !fs.existsSync(dataDirectory)
  || !path.basename(dataDirectory).startsWith('gridly-responder-phase4-')
  || path.relative(os.tmpdir(),dataDirectory).startsWith('..')) {
  throw new Error('Set explicit disposable Phase 4 localhost PGPORT, PGUSER, PGDATA under Temp.');
}
const baseEnv={...process.env};
for (const key of Object.keys(baseEnv)) if (/^PG/i.test(key) || /SUPABASE|DATABASE_URL/i.test(key)) delete baseEnv[key];
const env={...baseEnv,PGHOST:'127.0.0.1',PGPORT:String(port),PGCONNECT_TIMEOUT:'3'};
const database=`gridly_responder_p3_${randomUUID().replaceAll('-','').slice(0,20)}`;
const suffix=randomUUID().replaceAll('-','').slice(0,8);
const roles=Object.fromEntries(['viewerA','responderA','supervisorA','adminA','viewerB','responderB',
  'supervisorB','adminB','suspended','revoked','aal1','inactive','governance','governanceAal1',
  'unknown'].map(key=>[key,`p4_${key.toLowerCase()}_${suffix}`]));
const ids=Object.fromEntries(Object.keys(roles).map(key=>[key,randomUUID()]));
const orgA=randomUUID(),orgB=randomUUID(),reviewer=ids.governance;
let created=false,passed=0,failed=0;

function psql(db,args,role=owner,allowFailure=false) {
  const result=spawnSync(path.join(bin,'psql.exe'),
    ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args],{
      cwd:root,env:{...env,PGUSER:role},encoding:'utf8',timeout:180000,windowsHide:true,
    });
  if (result.error) throw result.error;
  if (!allowFailure && result.status!==0) throw new Error(result.stderr||result.stdout);
  return result;
}
const q=(statement,role=owner)=>psql(database,['-c',statement],role).stdout.trim();
const apply=file=>psql(database,['-f',path.join(root,file)]);
function check(label,actual,expected) {
  const okay=String(actual)===String(expected);
  console.log(`${okay?'PASS':'FAIL'} ${label}${okay?'':` expected=${expected} actual=${actual}`}`);
  okay?passed++:failed++;
}
function denied(label,statement,role) {
  const result=psql(database,['-c',statement],role,true);
  const okay=result.status!==0 && /permission denied|row-level security|cannot truncate/i.test(result.stderr);
  console.log(`${okay?'PASS':'FAIL'} ${label}${okay?'':` ${result.stderr.trim()}`}`);
  okay?passed++:failed++;
}
function count(view,role,where='true') {
  return q(`SELECT count(*) FROM agency_private.${view} WHERE ${where}`,roles[role]);
}
function cleanup() {
  if (!created) return;
  try {
    const schema=psql(database,['-c',"SELECT count(*) FROM pg_namespace WHERE nspname='agency_private'"]).stdout.trim();
    if (schema==='1') apply('db/responder-local/001_agency_private_rollback.sql');
  } catch(error) { failed++; console.error(`SCHEMA TEARDOWN FAILED: ${error.message}`); }
  try { psql('postgres',['-c',`DROP DATABASE ${database} WITH (FORCE)`]); created=false; }
  catch(error) { failed++; console.error(`DATABASE TEARDOWN FAILED: ${error.message}`); }
  try {
    psql('postgres',['-c',`DROP ROLE IF EXISTS ${Object.values(roles).join(',')},
      responder_rls_agency_fixture,responder_rls_governance_fixture`]);
  } catch(error) { failed++; console.error(`ROLE TEARDOWN FAILED: ${error.message}`); }
}
process.on('SIGINT',()=>{cleanup();process.exit(130)});

try {
  check('PostgreSQL 17.10',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  assert.equal(path.resolve(psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim()).toLowerCase(),
    dataDirectory.toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]); created=true;
  console.log(`FIXTURE_DATABASE=${database} HOST=127.0.0.1 PORT=${port}`);
  q('CREATE EXTENSION postgis');
  check('PostGIS 3.6.2',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  for (const file of ['001_agency_private_apply.sql','002_phase2_auth_membership_apply.sql',
    '003_phase3_county_authority_apply.sql','004_phase4_rls_authorization_apply.sql'])
    apply(`db/responder-local/${file}`);
  check('13 private tables enabled and forced RLS',q(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='agency_private' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity`),13);
  check('no private table lacks forced RLS',q(`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='agency_private' AND c.relkind='r' AND NOT (c.relrowsecurity AND c.relforcerowsecurity)`),0);
  check('only five agency SELECT policies',q(`SELECT count(*) FROM pg_policies
    WHERE schemaname='agency_private' AND cmd='SELECT'`),5);
  check('no ordinary write policies',q(`SELECT count(*) FROM pg_policies
    WHERE schemaname='agency_private' AND cmd<>'SELECT'`),0);
  check('publishing gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const loaded=loadCountyCatalog({database,bin,port,user:owner});
  check('certified 254-county loader reused',loaded.counties,254);

  for (const [key,role] of Object.entries(roles)) {
    psql('postgres',['-c',`CREATE ROLE ${role} LOGIN INHERIT`]);
    if (key!=='unknown') psql('postgres',['-c',`GRANT responder_rls_${key.startsWith('governance')?'governance':'agency'}_fixture TO ${role}`]);
  }
  q(`INSERT INTO agency_private.organizations(id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state)
    VALUES ('${orgA}','phase4-a','Synthetic Agency A','Agency A','county_agency','verified','active'),
      ('${orgB}','phase4-b','Synthetic Agency B','Agency B','county_agency','verified','active')`);
  q(`INSERT INTO agency_private.local_auth_identities(user_id,normalized_email,identity_kind,assurance,session_active,eligibility)
    VALUES ${Object.keys(roles).filter(key=>key!=='unknown').map(key=>
      `('${ids[key]}','phase4-${key.toLowerCase()}-${suffix}@example.test',
      '${key.startsWith('governance')?'GRIDLY_ADMIN':'RESPONDER'}',
      '${key==='aal1'||key==='governanceAal1'?'aal1':'aal2'}',
      ${key==='inactive'?'false':'true'},'eligible')`).join(',')}`);
  q(`INSERT INTO agency_private.phase4_session_bindings(db_role,user_id,actor_kind)
    VALUES ${Object.keys(roles).filter(key=>key!=='unknown').map(key=>
      `('${roles[key]}','${ids[key]}','${key.startsWith('governance')?'GRIDLY_ADMIN':'RESPONDER'}')`).join(',')}`);
  q(`INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at,suspended_at,revoked_at)
    VALUES ${['viewerA','responderA','supervisorA','adminA','viewerB','responderB','supervisorB','adminB',
      'suspended','revoked','aal1','inactive'].map(key=>{
        const org=key.endsWith('B')?orgB:orgA;
        const role=key.toLowerCase().startsWith('viewer')?'VIEWER':key.toLowerCase().startsWith('supervisor')?'SUPERVISOR':
          key.toLowerCase().startsWith('admin')?'AGENCY_ADMIN':'RESPONDER';
        const status=key==='suspended'?'suspended':key==='revoked'?'revoked':'active';
        return `('${org}','${ids[key]}','${role}','${status}',now(),
          ${status==='suspended'?'now()':'NULL'},${status==='revoked'?'now()':'NULL'})`;
      }).join(',')}`);
  const authA=q(`SELECT agency_private.phase3_create_county_authority('${reviewer}','${orgA}','48291',1,
    now()-interval '1 day',now()+interval '1 day')`);
  const authB=q(`SELECT agency_private.phase3_create_county_authority('${reviewer}','${orgB}','48071',1,
    now()-interval '1 day',now()+interval '1 day')`);
  check('governance approval events retained',q('SELECT count(*) FROM agency_private.organization_governance_events'),2);
  q(`INSERT INTO agency_private.organization_invites
    (organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at)
    VALUES ('${orgA}','${ids.adminA}','new-a@example.test','RESPONDER',decode(repeat('a',64),'hex'),now()+interval '1 day'),
      ('${orgB}','${ids.adminB}','new-b@example.test','RESPONDER',decode(repeat('b',64),'hex'),now()+interval '1 day')`);
  const updateIds={};
  for (const [name,org,auth,fips,author,status] of [
    ['aDraft',orgA,authA,'48291',ids.responderA,'draft'],
    ['aPending',orgA,authA,'48291',ids.responderA,'pending_review'],
    ['aActive',orgA,authA,'48291',ids.responderA,'active'],
    ['aResolved',orgA,authA,'48291',ids.adminA,'resolved'],
    ['aWithdrawn',orgA,authA,'48291',ids.adminA,'withdrawn'],
    ['aExpired',orgA,authA,'48291',ids.adminA,'active'],
    ['bDraft',orgB,authB,'48071',ids.responderB,'draft'],
    ['bPending',orgB,authB,'48071',ids.responderB,'pending_review']]) {
    const state=name==='aExpired'?'expired':status;
    updateIds[name]=q(`INSERT INTO agency_private.agency_updates
      (organization_id,author_user_id,created_authority_id,current_authority_id,
       condition_type,impact_level,title,point,status,activated_at,expires_at,resolved_at,withdrawn_at)
      SELECT '${org}','${author}','${auth}',${status==='active'?`'${auth}'`:'NULL'},
       'obstruction','moderate','Synthetic ${name}',public.ST_PointOnSurface(geometry),
       '${status}',${status==='active'?(state==='expired'?"now()-interval '25 hours'":"now()-interval '1 hour'"):'NULL'},
       ${status==='active'?(state==='expired'?"now()-interval '2 hours'":"now()+interval '1 hour'"):'NULL'},
       ${status==='resolved'?'now()':'NULL'},${status==='withdrawn'?'now()':'NULL'}
      FROM agency_private.county_geometry_catalog WHERE county_fips='${fips}' RETURNING id`);
  }
  q(`INSERT INTO agency_private.agency_update_events
    (update_id,organization_id,actor_user_id,authority_id,action,revision)
    VALUES ('${updateIds.bDraft}','${orgB}','${ids.responderB}','${authB}','draft_created',0)`);
  q(`INSERT INTO agency_private.organization_verification_events
    (organization_id,reviewer_user_id,to_state) VALUES ('${orgB}','${reviewer}','verified')`);
  q(`INSERT INTO agency_private.agency_operation_receipts
    (token_digest,actor_user_id,organization_id,update_id,action,payload_digest,bounded_result)
    VALUES (decode(repeat('c',64),'hex'),'${ids.responderB}','${orgB}','${updateIds.bDraft}',
      'create_draft',decode(repeat('d',64),'hex'),'{}')`);

  check('server session binds actor UUID',q('SELECT agency_private.phase4_actor_id()',roles.responderA),ids.responderA);
  check('session role matches PostgreSQL login',q('SELECT session_user',roles.responderA),roles.responderA);
  check('valid own-org role',q(`SELECT agency_private.phase4_member_role('${orgA}')`,roles.responderA),'RESPONDER');
  check('client custom actor claim ignored',q(`SELECT agency_private.phase4_actor_id()::text || '|' ||
    set_config('gridly.actor_user_id','${ids.adminB}',false)`,roles.responderA),
    `${ids.responderA}|${ids.adminB}`);
  check('wrong-org role absent',q(`SELECT agency_private.phase4_member_role('${orgB}')`,roles.responderA),'');
  check('aal1 role absent',q(`SELECT agency_private.phase4_member_role('${orgA}')`,roles.aal1),'');
  check('inactive session role absent',q(`SELECT agency_private.phase4_member_role('${orgA}')`,roles.inactive),'');
  denied('unknown identity has no organization access',
    'SELECT count(*) FROM agency_private.responder_organization_context',roles.unknown);
  denied('client cannot impersonate another DB role',`SET ROLE ${roles.adminB}`,roles.responderA);
  denied('client cannot assume owner fixture',
    'SET ROLE responder_owner_fixture',roles.responderA);
  check('all five safe views invoke caller security',q(`SELECT count(*) FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='agency_private'
    AND c.relkind='v' AND c.relname LIKE 'responder_%'
    AND 'security_invoker=true'=ANY(c.reloptions)`),5);

  for (const key of ['viewerA','responderA','supervisorA','adminA']) {
    check(`${key} own organization visible`,count('responder_organization_context',key,`id='${orgA}'`),1);
    check(`${key} other organization hidden`,count('responder_organization_context',key,`id='${orgB}'`),0);
    check(`${key} other membership hidden`,count('responder_membership_roster',key,`organization_id='${orgB}'`),0);
    check(`${key} other invite hidden`,count('responder_invite_summary',key,`organization_id='${orgB}'`),0);
    check(`${key} other authority hidden`,count('responder_current_authority',key,`organization_id='${orgB}'`),0);
    check(`${key} other draft hidden`,count('responder_update_queue',key,`id='${updateIds.bDraft}'`),0);
    check(`${key} other pending hidden`,count('responder_update_queue',key,`id='${updateIds.bPending}'`),0);
  }
  check('viewer sees self membership only',count('responder_membership_roster','viewerA'),1);
  check('responder sees self membership only',count('responder_membership_roster','responderA'),1);
  check('supervisor sees own-org roster',count('responder_membership_roster','supervisorA'),8);
  check('admin sees own-org roster',count('responder_membership_roster','adminA'),8);
  check('viewer cannot enumerate invites',count('responder_invite_summary','viewerA'),0);
  check('responder cannot enumerate invites',count('responder_invite_summary','responderA'),0);
  check('supervisor cannot enumerate invites',count('responder_invite_summary','supervisorA'),0);
  check('admin sees own invite metadata',count('responder_invite_summary','adminA'),1);
  denied('admin cannot select invite token digest',
    'SELECT token_digest FROM agency_private.organization_invites',roles.adminA);
  check('raw invite token column absent',q(`SELECT count(*) FROM information_schema.columns
    WHERE table_schema='agency_private' AND table_name='organization_invites' AND column_name='token'`),0);
  check('raw organization base table still RLS-scoped',q(`SELECT count(*) FROM agency_private.organizations
    WHERE id='${orgB}'`,roles.adminA),0);
  check('raw membership base table still RLS-scoped',q(`SELECT count(*) FROM agency_private.organization_memberships
    WHERE organization_id='${orgB}'`,roles.adminA),0);
  check('raw invite base table still RLS-scoped',q(`SELECT count(*) FROM agency_private.organization_invites
    WHERE organization_id='${orgB}'`,roles.adminA),0);
  check('raw authority base table still RLS-scoped',q(`SELECT count(*) FROM agency_private.organization_authorities
    WHERE organization_id='${orgB}'`,roles.adminA),0);
  check('raw update base table still RLS-scoped',q(`SELECT count(*) FROM agency_private.agency_updates
    WHERE organization_id='${orgB}'`,roles.adminA),0);
  check('own current authority bounded',count('responder_current_authority','responderA'),1);
  denied('authority geometry withheld',
    'SELECT geometry FROM agency_private.organization_authorities',roles.adminA);
  denied('authority source hash withheld',
    'SELECT source_sha256 FROM agency_private.organization_authorities',roles.adminA);
  check('viewer has no draft',count('responder_update_queue','viewerA',"status='draft'"),0);
  check('viewer has no pending review',count('responder_update_queue','viewerA',"status='pending_review'"),0);
  check('viewer sees own-org operational history',count('responder_update_queue','viewerA'),4);
  check('responder sees own draft',count('responder_update_queue','responderA',`id='${updateIds.aDraft}'`),1);
  check('responder sees own pending',count('responder_update_queue','responderA',`id='${updateIds.aPending}'`),1);
  check('supervisor sees full own-org queue',count('responder_update_queue','supervisorA'),6);
  check('admin sees full own-org queue',count('responder_update_queue','adminA'),6);
  check('expired active row displays derived expired state',
    q(`SELECT display_status FROM agency_private.responder_update_queue WHERE id='${updateIds.aExpired}'`,roles.adminA),'expired');

  for (const table of ['agency_update_events','organization_verification_events',
    'organization_governance_events','agency_operation_receipts','agency_program_controls',
    'local_auth_identities','county_geometry_catalog','phase4_session_bindings']) {
    denied(`${table} raw agency read denied`,`SELECT count(*) FROM agency_private.${table}`,roles.adminA);
  }
  denied('session binding direct mutation denied',
    `UPDATE agency_private.phase4_session_bindings SET user_id='${ids.adminB}'`,roles.responderA);
  check('governance identity has explicit path',q('SELECT agency_private.phase4_governance_ok()',roles.governance),'t');
  check('governance path sees two organizations',
    q('SELECT count(*) FROM agency_private.phase4_governance_organization_context()',roles.governance),2);
  check('governance aal1 sees no organizations',
    q('SELECT count(*) FROM agency_private.phase4_governance_organization_context()',roles.governanceAal1),0);
  denied('governance cannot read agency dashboard view',
    'SELECT count(*) FROM agency_private.responder_organization_context',roles.governance);
  denied('agency role cannot use governance path',
    'SELECT count(*) FROM agency_private.phase4_governance_organization_context()',roles.adminA);
  denied('governance raw organization table denied',
    'SELECT count(*) FROM agency_private.organizations',roles.governance);

  const protectedTables={
    organizations:'id',organization_memberships:'id',organization_authorities:'id',
    agency_updates:'id',agency_update_events:'id',organization_verification_events:'id',
    organization_governance_events:'id',organization_invites:'id',
    agency_operation_receipts:'token_digest',agency_program_controls:'singleton_key',
  };
  for (const [table,column] of Object.entries(protectedTables)) {
    check(`${table} has no ordinary DML/TRUNCATE privilege`,q(`SELECT
      has_table_privilege('${roles.adminA}','agency_private.${table}','INSERT') OR
      has_table_privilege('${roles.adminA}','agency_private.${table}','UPDATE') OR
      has_table_privilege('${roles.adminA}','agency_private.${table}','DELETE') OR
      has_table_privilege('${roles.adminA}','agency_private.${table}','TRUNCATE')`),'f');
    denied(`${table} direct INSERT denied`,`INSERT INTO agency_private.${table} DEFAULT VALUES`,roles.adminA);
    denied(`${table} direct UPDATE denied`,
      `UPDATE agency_private.${table} SET ${column}=${column}`,roles.adminA);
    denied(`${table} direct DELETE denied`,`DELETE FROM agency_private.${table}`,roles.adminA);
    denied(`${table} direct TRUNCATE denied`,`TRUNCATE agency_private.${table}`,roles.adminA);
  }
  check('program gate still false after direct-write attacks',
    q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  check('cross-org governance event retained',q(`SELECT count(*) FROM agency_private.organization_governance_events
    WHERE organization_id='${orgB}'`),1);
  check('cross-org receipt retained privately',q(`SELECT count(*) FROM agency_private.agency_operation_receipts
    WHERE organization_id='${orgB}'`),1);
  for (const table of ['agency_update_events','organization_verification_events',
    'organization_governance_events','agency_operation_receipts']) {
    const result=psql(database,['-c',`UPDATE agency_private.${table} SET organization_id='${orgA}'`],owner,true);
    const okay=result.status!==0 && /append-only|protected row/i.test(result.stderr);
    console.log(`${okay?'PASS':'FAIL'} ${table} append-only owner UPDATE denied`);
    okay?passed++:failed++;
  }
  q(`UPDATE agency_private.organization_memberships SET status='suspended',suspended_at=now()
    WHERE user_id='${ids.responderA}'`);
  check('suspended member stale role denied',count('responder_organization_context','responderA'),0);
  q(`UPDATE agency_private.organization_memberships SET status='revoked',revoked_at=now()
    WHERE user_id='${ids.supervisorA}'`);
  check('revoked member stale role denied',count('responder_organization_context','supervisorA'),0);
  q(`UPDATE agency_private.organizations SET operation_state='suspended',suspended_at=now() WHERE id='${orgA}'`);
  check('suspended org denies admin',count('responder_organization_context','adminA'),0);
  check('suspended org denies private update reads',count('responder_update_queue','adminA'),0);
  check('inactive session denies dashboard',count('responder_organization_context','inactive'),0);
  check('aal1 denies dashboard',count('responder_organization_context','aal1'),0);
  check('historical agency updates retained',q(`SELECT count(*) FROM agency_private.agency_updates WHERE organization_id='${orgA}'`),6);
  check('gate remains false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
} catch(error) {
  failed++;
  console.error(`FAIL fixture: ${error.stack||error.message}`);
} finally {
  cleanup();
  console.log(`RESULT ${passed} passed, ${failed} failed`);
  if (failed) process.exitCode=1;
}
