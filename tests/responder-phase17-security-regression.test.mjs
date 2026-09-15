// Phase 17 guarded-migration security regression in an explicit disposable localhost cluster.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {RESPONDER_PHASE17_PGBIN:bin,RESPONDER_PHASE17_PGPORT:port,
  RESPONDER_PHASE17_PGUSER:owner,RESPONDER_PHASE17_PGDATA:data,
  RESPONDER_PHASE17_PGPASSWORD:password,
  RESPONDER_PHASE17_EXPECTED_POSTGIS:expectedPostgis='3.6.2'}=process.env;
if(!bin||!/^[0-9]{4,5}$/.test(port||'')||!data||!fs.existsSync(data)
  ||!path.basename(data).startsWith('gridly-responder-phase17-')
  ||path.relative(os.tmpdir(),path.resolve(data)).startsWith('..'))
  throw new Error('Explicit disposable Phase 17 localhost PostgreSQL configuration required');
const env={...process.env};
for(const k of Object.keys(env)) if(/^PG/i.test(k)||/SUPABASE|DATABASE_URL/i.test(k)) delete env[k];
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:port,PGUSER:owner,PGCONNECT_TIMEOUT:'3'});
if(password) env.PGPASSWORD=password;
const database=`gridly_responder_p17_${randomUUID().replaceAll('-','').slice(0,18)}`;
let created=false,passed=0,failed=0,dbPassed=0,dbFailed=0;
function psql(db,args,allowFailure=false){
  const r=spawnSync(path.join(bin,'psql.exe'),['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args],
    {cwd:root,env,encoding:'utf8',timeout:240000,windowsHide:true});
  if(r.error) throw r.error;
  if(!allowFailure&&r.status!==0) throw new Error(r.stderr||r.stdout);
  return r;
}
const q=sql=>psql(database,['-c',sql]).stdout.trim();
const quote=s=>`'${String(s).replaceAll("'","''")}'`;
const apply=f=>psql(database,['-f',path.join(root,'db','responder-local',f)]);
function check(n,label,actual,expected){
  const ok=String(actual)===String(expected);
  console.log(`${ok?'PASS':'FAIL'} V${String(n).padStart(2,'0')} ${label}${ok?'':` expected=${expected} actual=${actual}`}`);
  ok?passed++:failed++;
}
function dbCheck(label,actual,expected){
  const ok=String(actual)===String(expected);
  console.log(`${ok?'PASS':'FAIL'} DB ${label}${ok?'':` expected=${expected} actual=${actual}`}`);
  ok?dbPassed++:dbFailed++;
}
function asRole(role,claims,sql,allowFailure=false){
  const claimSql=claims===null?"set_config('request.jwt.claims','',true)":
    `set_config('request.jwt.claims',${quote(JSON.stringify(claims))},true)`;
  return psql(database,['-c',`BEGIN; SET LOCAL ROLE ${role}; SELECT ${claimSql}; ${sql}; COMMIT;`],allowFailure);
}
const ids=Object.fromEntries(['creator','supervisor','admin','viewer','gridly','other','aal1jwt',
  'liveaal1','nullfactor','webauthn','noamr','cross','disabled','inactive','unverified']
  .map(k=>[k,randomUUID()]));
const sessions=Object.fromEntries(Object.keys(ids).map(k=>[k,randomUUID()]));
const factors=Object.fromEntries(Object.keys(ids).map(k=>[k,randomUUID()]));
const org={a:randomUUID(),b:randomUUID(),u:randomUUID(),rate:randomUUID()};
function claims(k,overrides={}){return {sub:ids[k],session_id:sessions[k],aal:'aal2',iat:2000000000,
  amr:[{method:'password'},{method:'totp'}],...overrides};}
function call(role,k,fn,request,claim=claims(k)){
  const r=asRole(role,claim,`SELECT responder_public.${fn}(${quote(JSON.stringify(request))}::jsonb)`);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1));
}
const envelope=(action,organization,payload={},extra={})=>({contract_version:'responder.agency.v1.phase0.1',
  action,operation_token:randomUUID(),organization_id:organization,payload,...extra});
const content=(lon=-95.5,lat=30.5,type='obstruction')=>({condition_type:type,impact_level:'moderate',
  title:`Synthetic ${type}`,detail:'Synthetic responder test',longitude:lon,latitude:lat,
  road_name:'County Road'});
const update=(k,request,claim)=>call('authenticated',k,'agency_update_command',request,claim);
try{
  psql('postgres',['-c',`CREATE DATABASE ${database}`]); created=true;
  apply('phase17_test_bootstrap.sql');
  apply('phase17_production_migration.sql');
  assert.match(q("SELECT current_setting('server_version')"),/^17\./);
  assert.equal(q("SELECT extensions.postgis_lib_version()"),expectedPostgis);
  dbCheck('private schema created',q("SELECT count(*) FROM pg_namespace WHERE nspname='agency_private'"),'1');
  dbCheck('public schema created',q("SELECT count(*) FROM pg_namespace WHERE nspname='responder_public'"),'1');
  dbCheck('13 private tables',q("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='agency_private' AND c.relkind='r'"),'13');
  dbCheck('all private tables enable and force RLS',q("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='agency_private' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity"),'13');
  dbCheck('public projection enables and forces RLS',q("SELECT relrowsecurity::text||'|'||relforcerowsecurity::text FROM pg_class WHERE oid='responder_public.agency_updates'::regclass"),'true|true');
  dbCheck('no private mutation policy',q("SELECT count(*) FROM pg_policies WHERE schemaname='agency_private' AND cmd<>'SELECT'"),'0');
  dbCheck('all private definers have empty search path',q("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='agency_private' AND p.prosecdef AND coalesce(array_to_string(p.proconfig,','),'') NOT IN ('search_path=','search_path=\"\"')"),'0');
  dbCheck('three exposed wrappers are security invoker',q("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='responder_public' AND NOT p.prosecdef"),'3');
  dbCheck('authenticated has no private table mutation grant',q("SELECT count(*) FROM information_schema.role_table_grants WHERE table_schema='agency_private' AND grantee='authenticated' AND privilege_type<>'SELECT'"),'0');
  dbCheck('exact 18-column public projection',q("SELECT count(*) FROM information_schema.columns WHERE table_schema='responder_public' AND table_name='agency_updates'"),'18');
  dbCheck('county authority FK exists',q("SELECT count(*) FROM pg_constraint WHERE conrelid='agency_private.organization_county_authorities'::regclass AND contype='f' AND confrelid='public.gridly_texas_county_boundaries'::regclass"),'1');
  dbCheck('current revision FK is deferred',q("SELECT condeferrable::text||'|'||condeferred::text FROM pg_constraint WHERE conname='agency_updates_current_revision_fk'"),'true|true');
  dbCheck('one event per revision uniqueness',q("SELECT count(*) FROM pg_constraint WHERE conrelid='agency_private.agency_update_events'::regclass AND contype='u'"),'1');
  dbCheck('activation rolling index exists',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='activation_rate_events_rolling_idx'"),'1');
  dbCheck('consumer expiry index exists',q("SELECT count(*) FROM pg_indexes WHERE schemaname='responder_public' AND indexname='responder_public_agency_updates_expiry_idx'"),'1');

  q(`INSERT INTO auth.users(id,email) VALUES ${Object.entries(ids).map(([k,v])=>`('${v}','${k}@example.test')`).join(',')}`);
  q(`INSERT INTO agency_private.principals(user_id,status,disabled_at) VALUES ${Object.entries(ids).map(([k,v])=>
    `('${v}','${k==='disabled'?'disabled':'active'}',${k==='disabled'?'now()':'NULL'})`).join(',')}`);
  q(`INSERT INTO auth.mfa_factors(id,user_id,factor_type,status) VALUES ${Object.keys(ids).map(k=>
    `('${factors[k]}','${ids[k]}','${k==='webauthn'?'webauthn':'totp'}','verified')`).join(',')}`);
  q(`INSERT INTO auth.sessions(id,user_id,factor_id,aal) VALUES ${Object.keys(ids).filter(k=>k!=='aal1jwt').map(k=>
    `('${sessions[k]}','${ids[k]}',${k==='nullfactor'?'NULL':quote(k==='cross'?factors.other:factors[k])},'${k==='liveaal1'?'aal1':'aal2'}')`).join(',')}`);
  q(`INSERT INTO auth.mfa_amr_claims(session_id,authentication_method) VALUES ${Object.keys(ids)
    .filter(k=>!['aal1jwt','noamr'].includes(k)).map(k=>`('${sessions[k]}','totp')`).join(',')}`);
  q(`INSERT INTO agency_private.organizations(id,canonical_name,legal_name,public_name,
    verification_status,operating_status,agency_publishing_enabled,publishing_authorization_id)
    VALUES ('${org.a}','agency-a','Agency A','Agency A','verified','active',false,NULL),
      ('${org.b}','agency-b','Agency B','Agency B','verified','active',false,NULL),
      ('${org.u}','agency-u','Agency U','Agency U','requested','inactive',false,NULL),
      ('${org.rate}','agency-rate','Agency Rate','Agency Rate','verified','active',true,'${randomUUID()}')`);
  const memberships=[['creator',org.a,'RESPONDER','active'],['supervisor',org.a,'SUPERVISOR','active'],
    ['admin',org.a,'AGENCY_ADMIN','active'],['viewer',org.a,'VIEWER','active'],['other',org.b,'AGENCY_ADMIN','active'],
    ['aal1jwt',org.a,'RESPONDER','active'],['liveaal1',org.a,'RESPONDER','active'],
    ['nullfactor',org.a,'RESPONDER','active'],['webauthn',org.a,'RESPONDER','active'],
    ['noamr',org.a,'RESPONDER','active'],['cross',org.a,'RESPONDER','active'],
    ['disabled',org.a,'RESPONDER','active'],['inactive',org.a,'RESPONDER','suspended'],
    ['unverified',org.u,'RESPONDER','active']];
  q(`INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at,suspended_at)
    VALUES ${memberships.map(([k,o,r,s])=>`('${o}','${ids[k]}','${r}','${s}',now(),${s==='suspended'?'now()':'NULL'})`).join(',')}`);
  q(`INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at)
    VALUES ('${org.rate}','${randomUUID()}','AGENCY_ADMIN','active',now())`);
  q(`INSERT INTO agency_private.gridly_admin_grants(user_id,granted_by_user_id) VALUES ('${ids.gridly}','${ids.gridly}')`);
  q(`INSERT INTO agency_private.organization_county_authorities
    (organization_id,county_fips,authority_version,boundary_version,approved_by_user_id,effective_from)
    VALUES ('${org.a}','48001',1,'lp148-owner-built-statewide-runtime-geometry-v1','${ids.gridly}',now()-interval '1 day'),
      ('${org.b}','48002',1,'lp148-owner-built-statewide-runtime-geometry-v1','${ids.gridly}',now()-interval '1 day'),
      ('${org.rate}','48003',1,'lp148-owner-built-statewide-runtime-geometry-v1','${ids.gridly}',now()-interval '1 day')`);

  check(1,'unauthenticated denied',update('creator',envelope('create_draft',org.a,content()),null).status,'forbidden');
  check(2,'aal1 JWT denied',update('aal1jwt',envelope('create_draft',org.a,content()),claims('aal1jwt',{aal:'aal1',amr:[{method:'password'}]})).status,'forbidden');
  check(3,'aal2 JWT missing live session denied',update('aal1jwt',envelope('create_draft',org.a,content())).status,'forbidden');
  check(4,'live session aal1 denied',update('liveaal1',envelope('create_draft',org.a,content())).status,'forbidden');
  check(5,'live aal2 null factor denied',update('nullfactor',envelope('create_draft',org.a,content())).status,'forbidden');
  check(6,'verified non-TOTP denied',update('webauthn',envelope('create_draft',org.a,content())).status,'forbidden');
  check(7,'TOTP factor without live AMR denied',update('noamr',envelope('create_draft',org.a,content())).status,'forbidden');
  check(8,'cross-user factor denied',update('cross',envelope('create_draft',org.a,content())).status,'forbidden');
  check(9,'inactive principal denied',update('disabled',envelope('create_draft',org.a,content())).status,'forbidden');
  check(10,'inactive membership denied',update('inactive',envelope('create_draft',org.a,content())).status,'forbidden');
  check(11,'wrong organization denied',update('creator',envelope('create_draft',org.b,content())).status,'forbidden');
  check(12,'unverified organization denied',update('unverified',envelope('create_draft',org.u,content())).status,'forbidden');

  const gateDraft=update('creator',envelope('create_draft',org.a,content()));
  const gateSubmit=update('creator',envelope('submit_for_review',org.a,{},
    {update_id:gateDraft.update_id,expected_revision:0}));
  check(13,'publishing disabled blocks activation',update('supervisor',envelope('activate_non_closure',org.a,{},
    {update_id:gateDraft.update_id,expected_revision:gateSubmit.revision})).status,'maintenance');
  check(14,'publishing disabled permits draft work',gateDraft.status,'accepted');
  check(15,'unauthorized county point denied',update('creator',envelope('create_draft',org.a,content(-94,30.5))).status,'out_of_scope');
  check(16,'exact county boundary denied',update('creator',envelope('create_draft',org.a,content(-96,30))).status,'out_of_scope');
  const interior=update('creator',envelope('create_draft',org.a,content()));
  check(17,'strict interior accepted',interior.status,'accepted');
  check(18,'VIEWER cannot publish',update('viewer',envelope('create_draft',org.a,content())).status,'forbidden');
  const responderDraft=update('creator',envelope('create_draft',org.a,content()));
  const responderSubmit=update('creator',envelope('submit_for_review',org.a,{},
    {update_id:responderDraft.update_id,expected_revision:0}));
  check(19,'RESPONDER frozen permissions',`${responderSubmit.status}|${update('creator',envelope('activate_non_closure',org.a,{},
    {update_id:responderDraft.update_id,expected_revision:1})).status}`,'pending_review|forbidden');

  const gate=call('authenticated','gridly','agency_governance_command',
    envelope('change_agency_publishing_gate',org.a,{reason:'Owner-approved local test',enabled:true,
      owner_authorization_id:randomUUID()},{expected_revision:0}));
  const supervisorActivation=update('supervisor',envelope('activate_non_closure',org.a,{},
    {update_id:gateDraft.update_id,expected_revision:1}));
  check(20,'SUPERVISOR frozen activation',supervisorActivation.status,'accepted');
  check(21,'AGENCY_ADMIN frozen draft permission',update('admin',envelope('create_draft',org.a,content())).status,'accepted');
  check(22,'GRIDLY_ADMIN remains separate',`${gate.status}|${update('gridly',envelope('create_draft',org.a,content())).status}`,'accepted|forbidden');

  const road=update('creator',envelope('create_draft',org.a,content(-95.5,30.5,'road_closed')));
  const roadSubmit=update('creator',envelope('submit_for_review',org.a,{},
    {update_id:road.update_id,expected_revision:0}));
  check(23,'creator cannot activate road_closed',update('creator',envelope('activate_road_closed',org.a,{},
    {update_id:road.update_id,expected_revision:1})).status,'forbidden');
  const roadActive=update('supervisor',envelope('activate_road_closed',org.a,{},
    {update_id:road.update_id,expected_revision:1}));
  check(24,'distinct authorized human activates road_closed',roadActive.status,'accepted');
  check(25,'duplicate road approval rejected',update('admin',envelope('activate_road_closed',org.a,{},
    {update_id:road.update_id,expected_revision:2})).status,'forbidden');
  const duplicateEvent=psql(database,['-c',`INSERT INTO agency_private.agency_update_events
    (update_id,revision,organization_id,event_type,actor_user_id,actor_session_id,authority_id,
     previous_state,new_state,operation_correlation_id)
    SELECT update_id,revision,organization_id,'update_activated',actor_user_id,actor_session_id,
      authority_id,previous_state,new_state,'${randomUUID()}' FROM agency_private.agency_update_events
    WHERE update_id='${gateDraft.update_id}' AND revision=2`],true);
  check(26,'duplicate activation event rejected',duplicateEvent.status!==0,true);
  const duplicateRevision=psql(database,['-c',`INSERT INTO agency_private.agency_update_revisions
    SELECT * FROM agency_private.agency_update_revisions WHERE update_id='${gateDraft.update_id}' AND revision=2`],true);
  check(27,'duplicate revision rejected',duplicateRevision.status!==0,true);

  // Create a dedicated valid supervisor for the quota organization.
  const rateUser=randomUUID(),rateSession=randomUUID(),rateFactor=randomUUID();
  q(`INSERT INTO auth.users VALUES ('${rateUser}','rate@example.test');
    INSERT INTO agency_private.principals(user_id) VALUES ('${rateUser}');
    INSERT INTO auth.mfa_factors VALUES ('${rateFactor}','${rateUser}','totp','verified');
    INSERT INTO auth.sessions VALUES ('${rateSession}','${rateUser}','${rateFactor}','aal2');
    INSERT INTO auth.mfa_amr_claims VALUES ('${rateSession}','totp');
    INSERT INTO agency_private.organization_memberships(organization_id,user_id,role,status,joined_at)
      VALUES ('${org.rate}','${rateUser}','SUPERVISOR','active',now())`);
  const rateClaims={sub:rateUser,session_id:rateSession,aal:'aal2',iat:2000000000,
    amr:[{method:'password'},{method:'totp'}]};
  const active=[];
  for(let i=0;i<60;i++){
    const d=call('authenticated','creator','agency_update_command',envelope('create_draft',org.rate,
      {...content(),title:`Rate ${i}`}),rateClaims);
    const s=call('authenticated','creator','agency_update_command',envelope('submit_for_review',org.rate,{},
      {update_id:d.update_id,expected_revision:0}),rateClaims);
    const a=call('authenticated','creator','agency_update_command',envelope('activate_non_closure',org.rate,{},
      {update_id:d.update_id,expected_revision:s.revision}),rateClaims);
    assert.equal(a.status,'accepted'); active.push(a);
  }
  check(28,'60 successful activations allowed',q(`SELECT count(*) FROM agency_private.activation_rate_events WHERE organization_id='${org.rate}'`),'60');
  const d61=call('authenticated','creator','agency_update_command',envelope('create_draft',org.rate,
    {...content(),title:'Rate 61'}),rateClaims);
  const s61=call('authenticated','creator','agency_update_command',envelope('submit_for_review',org.rate,{},
    {update_id:d61.update_id,expected_revision:0}),rateClaims);
  check(29,'61st activation rejected',call('authenticated','creator','agency_update_command',
    envelope('activate_non_closure',org.rate,{}, {update_id:d61.update_id,expected_revision:s61.revision}),rateClaims).status,'rate_limited');
  check(30,'resolve allowed at quota',call('authenticated','creator','agency_update_command',
    envelope('resolve_update',org.rate,{reason:'Resolved at quota'},
      {update_id:active[0].update_id,expected_revision:active[0].revision}),rateClaims).status,'accepted');
  check(31,'withdraw allowed at quota',call('authenticated','creator','agency_update_command',
    envelope('withdraw_update',org.rate,{reason:'Withdrawn at quota'},
      {update_id:active[1].update_id,expected_revision:active[1].revision}),rateClaims).status,'accepted');

  const expDraft=update('creator',envelope('create_draft',org.a,{...content(),title:'Expires quickly'}));
  const expSubmit=update('creator',envelope('submit_for_review',org.a,{},
    {update_id:expDraft.update_id,expected_revision:0}));
  const expActive=update('supervisor',envelope('activate_non_closure',org.a,{expiry_hours:0.00000001},
    {update_id:expDraft.update_id,expected_revision:1}));
  const publicCount=asRole('anon',null,`SELECT count(*) FROM responder_public.agency_updates WHERE update_id='${expActive.update_id}'`).stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  check(32,'expired update excluded from consumer projection',publicCount,'0');
  const columns=q("SELECT string_agg(column_name,',' ORDER BY ordinal_position) FROM information_schema.columns WHERE table_schema='responder_public' AND table_name='agency_updates'");
  check(33,'employee identity absent from exact public projection',columns,
    'update_id,organization_public_name,approved_department_name,verified_agency,verified_agency_label,condition_type,impact_level,title,detail,location,road_name,cross_street,crossing_id,source_family,activated_at,updated_at,expires_at,display_lifecycle_state');
  check(34,'caller-supplied actor spoof rejected',update('creator',{...envelope('create_draft',org.a,content()),actor_user_id:ids.gridly}).status,'invalid_request');
  check(35,'caller-supplied org spoof rejected',update('creator',envelope('create_draft',org.b,content())).status,'forbidden');
  check(36,'caller-supplied county spoof rejected',update('creator',envelope('create_draft',org.a,{...content(),county_fips:'48002'})).status,'invalid_request');
  const replayRequest=envelope('create_draft',org.a,{...content(),title:'Replay stable'});
  const replayFirst=update('creator',replayRequest);
  check(37,'exact operation replay is bounded',`${replayFirst.status}|${update('creator',replayRequest).status}`,'accepted|already_processed');
  check(38,'operation token payload mismatch rejected',update('creator',{
    ...replayRequest,payload:{...replayRequest.payload,title:'Replay mismatch'}}).status,'invalid_request');

  const directWrite=asRole('authenticated',claims('creator'),`INSERT INTO agency_private.agency_updates
    (organization_id,created_by_user_id,created_session_id) VALUES ('${org.a}','${ids.creator}','${sessions.creator}')`,true);
  dbCheck('authenticated direct private write denied',directWrite.status!==0,true);
  const wrongOrgRead=asRole('authenticated',claims('creator'),`SELECT count(*) FROM agency_private.organizations WHERE id='${org.b}'`).stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  dbCheck('RLS hides wrong organization',wrongOrgRead,'0');
  const auditMutation=psql(database,['-c',"UPDATE agency_private.governance_events SET reason='tamper'"],true);
  dbCheck('append-only governance mutation denied',auditMutation.status!==0,true);
  const helperPublic=q("SELECT has_function_privilege('public','agency_private._live_auth_context()','EXECUTE')");
  dbCheck('live Auth helper revoked from PUBLIC',helperPublic,'f');
  const staleMembershipRead=asRole('authenticated',claims('aal1jwt'),
    `SELECT count(*) FROM agency_private.organization_memberships WHERE user_id='${ids.aal1jwt}'`).stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  dbCheck('stale session cannot read own membership',staleMembershipRead,'0');
  const viewerAuditRead=asRole('authenticated',claims('viewer'),
    `SELECT count(*) FROM agency_private.agency_update_events`).stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
  dbCheck('VIEWER cannot read private update audit',viewerAuditRead,'0');

  const rollbackDb=`gridly_responder_p17_rb_${randomUUID().replaceAll('-','').slice(0,16)}`;
  psql('postgres',['-c',`CREATE DATABASE ${rollbackDb}`]);
  try {
    psql(rollbackDb,['-f',path.join(root,'db','responder-local','phase17_test_bootstrap.sql')]);
    psql(rollbackDb,['-f',path.join(root,'db','responder-local','phase17_production_migration.sql')]);
    psql(rollbackDb,['-f',path.join(root,'db','responder-local','phase17_production_rollback.sql')]);
    dbCheck('empty pre-activation rollback removes both schemas',psql(rollbackDb,['-c',"SELECT (to_regnamespace('agency_private') IS NULL AND to_regnamespace('responder_public') IS NULL)::text"]).stdout.trim(),'true');
  } finally { psql('postgres',['-c',`DROP DATABASE IF EXISTS ${rollbackDb} WITH (FORCE)`],true); }

  console.log(`PHASE17_SECURITY_VECTORS passed=${passed} failed=${failed} total=${passed+failed}`);
  console.log(`PHASE17_SECURITY_DATABASE_CHECKS passed=${dbPassed} failed=${dbFailed} total=${dbPassed+dbFailed}`);
  if(failed||dbFailed) process.exitCode=1;
}finally{
  if(created) psql('postgres',['-c',`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`],true);
}
