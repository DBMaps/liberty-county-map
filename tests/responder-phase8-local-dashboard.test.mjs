// Disposable localhost PostgreSQL/PostGIS dashboard contract; synthetic identities only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCountyCatalog} from '../tools/responder-local/load-county-authority.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {RESPONDER_LOCAL_PGBIN:bin,RESPONDER_LOCAL_PGPORT:port,
  RESPONDER_LOCAL_PGUSER:owner,RESPONDER_LOCAL_PGDATA:data}=process.env;
if(!bin || !/^\d{4,5}$/.test(port||'') || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner||'')
  || !data || !fs.existsSync(data)
  || !path.basename(data).startsWith('gridly-responder-phase8-')
  || path.relative(os.tmpdir(),path.resolve(data)).startsWith('..'))
  throw new Error('Explicit disposable Phase 8 localhost PostgreSQL configuration required');
const env={...process.env};
for(const k of Object.keys(env)) if(/^PG/i.test(k)||/SUPABASE|DATABASE_URL/i.test(k)) delete env[k];
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:port,PGCONNECT_TIMEOUT:'3'});
const database=`gridly_responder_p3_${randomUUID().replaceAll('-','').slice(0,20)}`;
const suffix=randomUUID().replaceAll('-','').slice(0,8);
const keys=['viewer','responder','supervisor','admin','other','aal1','inactive',
  'suspended','revoked','governance','unknown'];
const roles=Object.fromEntries(keys.map(k=>[k,`p8_${k}_${suffix}`]));
const ids=Object.fromEntries(keys.filter(k=>k!=='unknown').map(k=>[k,randomUUID()]));
const org={a:randomUUID(),b:randomUUID()};
let created=false,passed=0,failed=0;
function psql(db,args,role=owner,allowFailure=false) {
  const r=spawnSync(path.join(bin,'psql.exe'),
    ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args],
    {cwd:root,env:{...env,PGUSER:role},encoding:'utf8',timeout:180000,windowsHide:true});
  if(r.error) throw r.error;
  if(!allowFailure && r.status!==0) throw new Error(r.stderr||r.stdout);
  return r;
}
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const q=(sql,key)=>psql(database,['-c',sql],key?roles[key]:owner).stdout.trim();
const apply=file=>psql(database,['-f',path.join(root,'db','responder-local',file)]);
function check(label,actual,expected) {
  const ok=String(actual)===String(expected);
  console.log(`${ok?'PASS':'FAIL'} ${label}${ok?'':` expected=${expected} actual=${actual}`}`);
  ok?passed++:failed++;
}
function denied(label,sql,key) {
  const r=psql(database,['-c',sql],roles[key],true);
  check(label,r.status!==0 && /permission denied|row-level security/i.test(r.stderr),true);
}
function absent(label,sql,key) {
  const r=psql(database,['-c',sql],roles[key],true);
  check(label,r.status!==0 && /column .* does not exist/i.test(r.stderr),true);
}
const count=(view,key,where='true')=>q(
  `SELECT count(*) FROM agency_private.${view} WHERE ${where}`,key);
const entry=key=>q("SELECT status||'|'||coalesce(organization_id::text,'')||'|'||coalesce(member_role,'') FROM agency_private.phase8_dashboard_entry()",key);
const read=(view,key,id)=>q(
  `SELECT row_to_json(v) FROM (SELECT * FROM agency_private.${view} WHERE update_id='${id}') v`,key);
const governance=(action,revision,organization=org.a)=>JSON.parse(q(`SELECT agency_private.phase6_governance_command(
  ${quote(JSON.stringify({contract_version:'responder.agency.v1.phase0.1',action,
    operation_token:randomUUID(),organization_id:organization,expected_revision:revision,
    payload:{reason:'Synthetic dashboard governance test'}}))}::jsonb)`, 'governance'));
function update(name,organization,authority,fips,author,status,condition='obstruction') {
  const active=status==='active';
  const expired=name==='expired';
  return q(`INSERT INTO agency_private.agency_updates
    (organization_id,author_user_id,created_authority_id,current_authority_id,
      condition_type,impact_level,title,detail,road_name,cross_street,point,status,
      activated_at,expires_at,resolved_at,withdrawn_at,revision)
    SELECT '${organization}','${author}','${authority}',${active?quote(authority):'NULL'},
      '${condition}','moderate','Synthetic ${name}','Synthetic operational detail',
      'County Road','Crossing',public.ST_PointOnSurface(geometry),'${status}',
      ${active?(expired?"now()-interval '13 hours'":"now()-interval '1 hour'"):'NULL'},
      ${active?(expired?"now()-interval '1 hour'":"now()+interval '11 hours'"):'NULL'},
      ${status==='resolved'?'now()':'NULL'},${status==='withdrawn'?'now()':'NULL'},0
    FROM agency_private.county_geometry_catalog WHERE county_fips='${fips}' RETURNING id`);
}
try {
  check('PostgreSQL version',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  assert.equal(path.resolve(psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim()).toLowerCase(),path.resolve(data).toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]);created=true;
  q('CREATE EXTENSION postgis');
  check('PostGIS version',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  for(const f of ['001_agency_private_apply.sql','002_phase2_auth_membership_apply.sql',
    '003_phase3_county_authority_apply.sql','004_phase4_rls_authorization_apply.sql',
    '005_phase5_local_command_apply.sql','006_phase6_local_governance_apply.sql',
    '007_phase7_local_rate_consumer_apply.sql','008_phase8_local_dashboard_apply.sql']) apply(f);
  check('254 certified counties',loadCountyCatalog({database,bin,port,user:owner}).counties,254);
  check('gate initially false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  for(const k of keys) {
    psql('postgres',['-c',`CREATE ROLE ${roles[k]} LOGIN INHERIT`]);
    psql('postgres',['-c',`GRANT responder_rls_${k==='governance'?'governance':'agency'}_fixture TO ${roles[k]}`]);
  }
  q(`INSERT INTO agency_private.organizations
    (id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state)
    VALUES ('${org.a}','phase8-a','Synthetic Agency A','Agency A','county_agency','verified','active'),
      ('${org.b}','phase8-b','Synthetic Agency B','Agency B','county_agency','verified','active')`);
  q(`INSERT INTO agency_private.local_auth_identities
    (user_id,normalized_email,identity_kind,assurance,session_active,eligibility)
    VALUES ${keys.filter(k=>k!=='unknown').map(k=>`('${ids[k]}','phase8-${k}-${suffix}@example.test',
      '${k==='governance'?'GRIDLY_ADMIN':'RESPONDER'}','${k==='aal1'?'aal1':'aal2'}',
      ${k==='inactive'?'false':'true'},'eligible')`).join(',')}`);
  q(`INSERT INTO agency_private.phase4_session_bindings(db_role,user_id,actor_kind)
    VALUES ${keys.filter(k=>k!=='unknown').map(k=>`('${roles[k]}','${ids[k]}',
      '${k==='governance'?'GRIDLY_ADMIN':'RESPONDER'}')`).join(',')}`);
  const roleFor=k=>({viewer:'VIEWER',supervisor:'SUPERVISOR',admin:'AGENCY_ADMIN',other:'AGENCY_ADMIN'})[k]||'RESPONDER';
  q(`INSERT INTO agency_private.organization_memberships
    (organization_id,user_id,role,status,joined_at,suspended_at,revoked_at)
    VALUES ${keys.filter(k=>!['governance','unknown'].includes(k)).map(k=>{
      const state=k==='suspended'?'suspended':k==='revoked'?'revoked':'active';
      return `('${k==='other'?org.b:org.a}','${ids[k]}','${roleFor(k)}','${state}',now(),
        ${state==='suspended'?'now()':'NULL'},${state==='revoked'?'now()':'NULL'})`;
    }).join(',')}`);
  const authA=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}',
    '${org.a}','48291',1,now()-interval '1 day',now()+interval '2 days')`);
  const authB=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}',
    '${org.b}','48071',1,now()-interval '1 day',now()+interval '2 days')`);
  const historicalAuth=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}',
    '${org.a}','48071',1,now()-interval '1 day',now()+interval '2 days')`);
  q(`UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=now()
    WHERE id='${historicalAuth}'`);
  q(`INSERT INTO agency_private.organization_invites
    (organization_id,inviter_user_id,intended_email,proposed_role,token_digest,expires_at)
    VALUES ('${org.a}','${ids.admin}','invite-a@example.test','RESPONDER',
      decode(repeat('a',64),'hex'),now()+interval '1 day'),
      ('${org.b}','${ids.other}','invite-b@example.test','RESPONDER',
      decode(repeat('b',64),'hex'),now()+interval '1 day')`);
  const rows={draft:update('draft',org.a,authA,'48291',ids.responder,'draft'),
    pending:update('pending',org.a,authA,'48291',ids.responder,'pending_review'),
    roadPending:update('road-pending',org.a,authA,'48291',ids.supervisor,'pending_review','road_closed'),
    active:update('active',org.a,authA,'48291',ids.responder,'active'),
    expired:update('expired',org.a,authA,'48291',ids.admin,'active'),
    resolved:update('resolved',org.a,authA,'48291',ids.admin,'resolved'),
    withdrawn:update('withdrawn',org.a,authA,'48291',ids.admin,'withdrawn'),
    other:update('other',org.b,authB,'48071',ids.other,'draft')};

  for(const k of ['viewer','responder','supervisor','admin'])
    check(`${k} aal2 dashboard entry`,entry(k),`accepted|${org.a}|${roleFor(k)}`);
  for(const k of ['aal1','inactive','suspended','revoked','unknown'])
    check(`${k} dashboard denied`,entry(k),'forbidden||');
  check('cross-org context denied',q(`SELECT count(*) FROM agency_private.responder_organization_context WHERE id='${org.b}'`,'admin'),'0');
  check('Gridly admin has no agency dashboard membership',psql(database,['-c','SELECT * FROM agency_private.phase8_dashboard_entry()'],roles.governance,true).status!==0,true);
  for(const k of ['viewer','responder','supervisor','admin']) {
    check(`${k} own org context`,count('responder_organization_context',k,`id='${org.a}'`),1);
    check(`${k} no other org context`,count('responder_organization_context',k,`id='${org.b}'`),0);
    check(`${k} current county`,q('SELECT county_fips FROM agency_private.responder_current_authority',k),'48291');
    check(`${k} no cross-org authority`,count('responder_current_authority',k,`organization_id='${org.b}'`),0);
  }
  check('P01 viewer own active organization',entry('viewer'),`accepted|${org.a}|VIEWER`);
  check('P01 no business event',q('SELECT count(*) FROM agency_private.agency_update_events'),0);
  check('viewer self membership',count('responder_membership_roster','viewer'),1);
  check('P20 responder self membership',q('SELECT user_id FROM agency_private.responder_membership_roster','responder'),ids.responder);
  check('P20 bounded membership status',q('SELECT status FROM agency_private.responder_membership_roster','responder'),'active');
  check('responder no other roster',count('responder_membership_roster','responder',`user_id='${ids.admin}'`),0);
  check('supervisor own-org roster',count('responder_membership_roster','supervisor'),8);
  check('admin own-org roster',count('responder_membership_roster','admin'),8);
  check('admin no cross-org roster',count('responder_membership_roster','admin',`organization_id='${org.b}'`),0);
  absent('roster has no email', 'SELECT normalized_email FROM agency_private.responder_membership_roster','admin');
  check('current authority only',count('responder_current_authority','admin'),1);
  check('historical authority absent',count('responder_current_authority','admin',`id='${historicalAuth}'`),0);
  absent('authority has no private source hash','SELECT source_sha256 FROM agency_private.responder_current_authority','admin');
  denied('authority geometry direct denied','SELECT geometry FROM agency_private.organization_authorities','admin');
  for(const [k,n] of [['viewer',4],['responder',6],['supervisor',7],['admin',7]]) {
    for(const view of ['phase8_dashboard_queue','phase8_dashboard_map','phase8_dashboard_inspector'])
      check(`${k} ${view} row count`,count(view,k),n);
    check(`${k} no cross-org record`,count('phase8_dashboard_queue',k,`update_id='${rows.other}'`),0);
  }
  for(const [name,state] of [['draft','draft'],['pending','pending_review'],
    ['active','active'],['expired','expired'],['resolved','resolved'],['withdrawn','withdrawn']])
    check(`${name} display state`,JSON.parse(read('phase8_dashboard_inspector','admin',rows[name])).display_status,state);
  const exactExpiryId=randomUUID();
  check('dashboard expires exactly at expires_at',q(`BEGIN;
    INSERT INTO agency_private.agency_updates
      (id,organization_id,author_user_id,created_authority_id,current_authority_id,
       condition_type,impact_level,title,point,status,activated_at,updated_at,expires_at)
      SELECT '${exactExpiryId}','${org.a}','${ids.responder}','${authA}','${authA}',
        'obstruction','moderate','Exact expiry synthetic',public.ST_PointOnSurface(geometry),
        'active',now()-interval '1 hour',now(),now()
      FROM agency_private.county_geometry_catalog WHERE county_fips='48291';
    SELECT display_status FROM agency_private.phase8_dashboard_inspector
      WHERE update_id='${exactExpiryId}';
    ROLLBACK`),'expired');
  check('viewer draft hidden',read('phase8_dashboard_queue','viewer',rows.draft),'');
  check('responder other-author pending hidden',read('phase8_dashboard_queue','responder',rows.roadPending),'');
  check('supervisor review queue',count('phase8_dashboard_queue','supervisor',"stored_status='pending_review'"),2);
  check('status filter safe',count('phase8_dashboard_queue','responder',"display_status='expired'"),1);
  check('county filter safe',count('phase8_dashboard_queue','admin',"county_fips='48291'"),7);
  check('condition filter safe',count('phase8_dashboard_queue','admin',"condition_type='road_closed'"),1);
  check('own authored filter safe',count('phase8_dashboard_queue','responder','is_author'),3);
  const signature=view=>q(`SELECT string_agg(update_id::text||':'||display_status||':'||revision,
    ',' ORDER BY update_id) FROM agency_private.${view}`,'admin');
  check('queue/map canonical IDs states revisions',signature('phase8_dashboard_queue'),signature('phase8_dashboard_map'));
  check('queue/inspector canonical IDs states revisions',signature('phase8_dashboard_queue'),signature('phase8_dashboard_inspector'));
  check('map selection inspector same ID',JSON.parse(read('phase8_dashboard_map','admin',rows.active)).update_id,
    JSON.parse(read('phase8_dashboard_inspector','admin',rows.active)).update_id);
  check('map source fixed',JSON.parse(read('phase8_dashboard_map','admin',rows.active)).source_family,'AGENCY_OFFICIAL');
  check('map safe coordinate',Number.isFinite(JSON.parse(read('phase8_dashboard_map','admin',rows.active)).longitude),true);
  absent('map has no author identity','SELECT author_user_id FROM agency_private.phase8_dashboard_map','admin');
  absent('inspector has no receipt','SELECT token_digest FROM agency_private.phase8_dashboard_inspector','admin');
  check('inspector operational detail',JSON.parse(read('phase8_dashboard_inspector','admin',rows.active)).detail,'Synthetic operational detail');
  check('admin bounded invite summary',count('responder_invite_summary','admin'),1);
  for(const k of ['viewer','responder','supervisor'])
    check(`${k} invite denied`,count('responder_invite_summary',k),0);
  denied('invite digest hidden','SELECT token_digest FROM agency_private.organization_invites','admin');
  check('responder own draft edit candidate',q(`SELECT can_edit_draft FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.draft}'`,'responder'),'t');
  check('responder cannot return review',q(`SELECT can_return FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.pending}'`,'responder'),'f');
  check('responder may withdraw own pending work',q(`SELECT can_withdraw FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.pending}'`,'responder'),'t');
  check('supervisor can return review',q(`SELECT can_return FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.pending}'`,'supervisor'),'t');
  check('road author not own approver',q(`SELECT can_activate_road_closed FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.roadPending}'`,'supervisor'),'f');
  check('different admin road candidate',q(`SELECT can_activate_road_closed FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.roadPending}'`,'admin'),'t');
  check('expired has no edit candidate',q(`SELECT can_edit_active FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.expired}'`,'admin'),'f');
  check('expired has no resolve candidate',q(`SELECT can_resolve FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.expired}'`,'admin'),'f');
  check('expired has no withdraw candidate',q(`SELECT can_withdraw FROM agency_private.phase8_dashboard_affordances WHERE update_id='${rows.expired}'`,'admin'),'f');
  const draftRequest={contract_version:'responder.agency.v1.phase0.1',action:'create_draft',
    operation_token:randomUUID(),organization_id:org.a,payload:{condition_type:'obstruction',
      impact_level:'moderate',title:'Unauthorized synthetic draft',longitude:-97,latitude:30}};
  check('viewer backend command denies despite UI',JSON.parse(q(`SELECT agency_private.phase7_agency_update_command(${quote(JSON.stringify(draftRequest))}::jsonb)`,'viewer')).status,'forbidden');
  check('backend denial made no draft',count('phase8_dashboard_queue','admin'),7);
  for(const operation of ['INSERT','UPDATE','DELETE','TRUNCATE'])
    check(`agency direct ${operation} privilege absent`,q(`SELECT has_table_privilege('${roles.admin}',
      'agency_private.agency_updates','${operation}')`),'f');
  denied('agency direct update denied',`UPDATE agency_private.agency_updates
    SET title='Unauthorized' WHERE id='${rows.draft}'`,'admin');
  const attempt={contract_version:'responder.agency.v1.phase0.1',action:'approve_authority',
    organization_id:org.a,payload:{county_fips:'48291'}};
  const before=q(`SELECT (SELECT count(*) FROM agency_private.organization_governance_events)||'|'
    ||(SELECT count(*) FROM agency_private.governance_operation_receipts)||'|'
    ||(SELECT count(*) FROM agency_private.organization_authorities)`);
  for(const k of ['viewer','responder','supervisor','admin']) {
    check(`${k} N26 bounded forbidden`,JSON.parse(q(`SELECT agency_private.phase8_agency_governance_denial(${quote(JSON.stringify(attempt))}::jsonb)`,k)).status,'forbidden');
    denied(`${k} no governance EXECUTE`,`SELECT agency_private.phase6_governance_command('{}'::jsonb)`,k);
  }
  check('N26 no governance mutation/event/receipt',q(`SELECT (SELECT count(*) FROM agency_private.organization_governance_events)||'|'
    ||(SELECT count(*) FROM agency_private.governance_operation_receipts)||'|'
    ||(SELECT count(*) FROM agency_private.organization_authorities)`),before);
  check('N26 no governance grant',q(`SELECT has_function_privilege('${roles.admin}',
    'agency_private.phase6_governance_command(jsonb)','EXECUTE')`),'f');
  for(const table of ['organization_verification_events','organization_governance_events',
    'agency_update_events','agency_operation_receipts','governance_operation_receipts',
    'agency_program_controls','phase4_session_bindings','local_auth_identities'])
    denied(`raw ${table} denied`,`SELECT count(*) FROM agency_private.${table}`,'admin');
  denied('public reader denied dashboard entry','SELECT * FROM agency_private.phase8_dashboard_entry()','governance');
  check('suspend organization governance accepted',governance('suspend_organization',0).status,'accepted');
  check('suspension denies dashboard',entry('admin'),'forbidden||');
  check('suspension withdrew active update',q(`SELECT status FROM agency_private.agency_updates WHERE id='${rows.active}'`),'withdrawn');
  check('reinstate organization governance accepted',governance('reinstate_organization',1).status,'accepted');
  check('reinstatement restores eligible dashboard',entry('admin'),`accepted|${org.a}|AGENCY_ADMIN`);
  check('reinstatement does not resurrect withdrawn update',q(`SELECT status FROM agency_private.agency_updates WHERE id='${rows.active}'`),'withdrawn');
  check('reinstatement does not restore revoked member',entry('revoked'),'forbidden||');
  for(const [view,sql] of [
    ['queue',`SELECT * FROM agency_private.phase8_dashboard_queue WHERE organization_id='${org.a}' ORDER BY created_at DESC LIMIT 50`],
    ['map',`SELECT * FROM agency_private.phase8_dashboard_map WHERE organization_id='${org.a}'`],
    ['inspector',`SELECT * FROM agency_private.phase8_dashboard_inspector WHERE update_id='${rows.active}'`],
    ['roster',`SELECT * FROM agency_private.responder_membership_roster WHERE organization_id='${org.a}'`],
    ['invites',`SELECT * FROM agency_private.responder_invite_summary WHERE organization_id='${org.a}'`]]) {
    const plan=JSON.parse(q(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`,'admin'));
    check(`${view} query plan executes`,plan[0]['Execution Time']<5000,true);
  }
  check('existing scoped update index retained',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='updates_org_status_expiry_idx'"),1);
  check('existing roster index retained',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='memberships_org_status_role_idx'"),1);
  check('existing invite index retained',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='invites_org_identity_status_idx'"),1);
  check('final agency publishing gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  check('final public projection empty',q('SELECT count(*) FROM responder_public.agency_updates'),'0');
} catch(error) {
  failed++;console.error(`FAIL unhandled: ${error.stack||error.message}`);
} finally {
  if(created) {
    try {psql('postgres',['-c',`DROP DATABASE ${database} WITH (FORCE)`]);created=false;}
    catch(error) {failed++;console.error(`DATABASE CLEANUP FAILED ${error.message}`);}
  }
  const fixtureRoles=[...Object.values(roles),'responder_projection_fixture',
    'responder_public_reader_fixture','responder_governance_fixture',
    'responder_rls_agency_fixture','responder_rls_governance_fixture',
    'responder_command_fixture','responder_app_fixture','responder_owner_fixture'];
  const drop=psql('postgres',['-c',`DROP ROLE IF EXISTS ${fixtureRoles.join(',')}`],owner,true);
  if(drop.status!==0) {failed++;console.error(`ROLE CLEANUP FAILED ${drop.stderr}`);}
}
console.log(`TOTAL ${passed} passed ${failed} failed`);
process.exitCode=failed?1:0;
