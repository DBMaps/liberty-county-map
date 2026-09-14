// Disposable localhost PostgreSQL/PostGIS only. Never points at Supabase.
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCountyCatalog } from '../tools/responder-local/load-county-authority.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bin=process.env.RESPONDER_LOCAL_PGBIN;
const port=process.env.RESPONDER_LOCAL_PGPORT;
const owner=process.env.RESPONDER_LOCAL_PGUSER;
const data=process.env.RESPONDER_LOCAL_PGDATA;
if (!bin || !/^\d{4,5}$/.test(port||'') || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner||'')
  || !data || !path.basename(data).startsWith('gridly-responder-phase5-')
  || path.relative(os.tmpdir(),path.resolve(data)).startsWith('..')) {
  throw new Error('Explicit disposable Phase 5 localhost PG configuration required');
}
const env={...process.env};
for (const key of Object.keys(env)) if (/^PG/i.test(key) || /SUPABASE|DATABASE_URL/i.test(key)) delete env[key];
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:port,PGCONNECT_TIMEOUT:'3'});
const database=`gridly_responder_p3_${randomUUID().replaceAll('-','').slice(0,20)}`;
const suffix=randomUUID().replaceAll('-','').slice(0,8);
const keys=['responder','second','supervisor','admin','viewer','responderB','supervisorB',
  'aal1','inactive','suspended','revoked','suspendedOrg','governance'];
const roles=Object.fromEntries(keys.map(key=>[key,`p5_${key.toLowerCase()}_${suffix}`]));
const ids=Object.fromEntries(keys.map(key=>[key,randomUUID()]));
const org={a:randomUUID(),b:randomUUID(),c:randomUUID()};
let created=false,passed=0,failed=0;
const passedLabels=new Set();
function psql(db,args,role=owner,allowFailure=false) {
  const r=spawnSync(path.join(bin,'psql.exe'),
    ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,...args],
    {cwd:root,env:{...env,PGUSER:role},encoding:'utf8',timeout:180000,windowsHide:true});
  if (r.error) throw r.error;
  if (!allowFailure && r.status!==0) throw new Error(r.stderr||r.stdout);
  return r;
}
const q=(sql,role=owner)=>psql(database,['-c',sql],role).stdout.trim();
const sqlString=value=>`'${String(value).replaceAll("'","''")}'`;
function check(label,actual,expected) {
  const okay=String(actual)===String(expected);
  console.log(`${okay?'PASS':'FAIL'} ${label}${okay?'':` expected=${expected} actual=${actual}`}`);
  if(okay) { passed++; passedLabels.add(label); } else failed++;
}
function command(key,action,payload={},updateId,revision,token=randomUUID(),organization=org.a) {
  const request={contract_version:'responder.agency.v1.phase0.1',action,
    operation_token:token,organization_id:organization,payload};
  if (updateId!==undefined) request.update_id=updateId;
  if (revision!==undefined) request.expected_revision=revision;
  return JSON.parse(q(`SELECT agency_private.phase5_agency_update_command(${sqlString(JSON.stringify(request))}::jsonb)`,roles[key]));
}
function concurrentCommand(key,request) {
  return new Promise((resolve,reject)=>{
    const sql=`SELECT agency_private.phase5_agency_update_command(${sqlString(JSON.stringify(request))}::jsonb)`;
    const child=spawn(path.join(bin,'psql.exe'),
      ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',database,'-c',sql],
      {cwd:root,env:{...env,PGUSER:roles[key]},windowsHide:true});
    let out='',err=''; child.stdout.on('data',x=>out+=x); child.stderr.on('data',x=>err+=x);
    child.on('error',reject); child.on('close',code=>code===0?resolve(JSON.parse(out.trim())):reject(new Error(err)));
  });
}
function status(label,actual,expected) { check(label,actual.status,expected); return actual; }
const createdUpdates=[];
function cleanup() {
  if (created) {
    try { psql('postgres',['-c',`DROP DATABASE ${database} WITH (FORCE)`]); created=false; }
    catch(e) { failed++; console.error(`DATABASE CLEANUP FAILED ${e.message}`); }
  }
  try { psql('postgres',['-c',`DROP ROLE IF EXISTS ${Object.values(roles).join(',')},responder_rls_agency_fixture,responder_rls_governance_fixture,responder_command_fixture,responder_app_fixture,responder_owner_fixture`],owner,true); }
  catch(e) { failed++; console.error(`ROLE CLEANUP FAILED ${e.message}`); }
}
try {
  check('PostgreSQL 17.10',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  check('actual disposable data directory',path.resolve(psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim()).toLowerCase(),path.resolve(data).toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]); created=true;
  q('CREATE EXTENSION postgis');
  check('PostGIS 3.6.2',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  for (const f of ['001_agency_private_apply.sql','002_phase2_auth_membership_apply.sql',
    '003_phase3_county_authority_apply.sql','004_phase4_rls_authorization_apply.sql',
    '005_phase5_local_command_apply.sql'])
    psql(database,['-f',path.join(root,'db','responder-local',f)]);
  check('definer is non-login non-superuser',q("SELECT NOT rolcanlogin AND NOT rolsuper AND rolbypassrls FROM pg_roles WHERE rolname='responder_command_fixture'"),'t');
  check('254 certified counties',loadCountyCatalog({database,bin,port,user:owner}).counties,254);
  check('gate starts false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  for (const [key,role] of Object.entries(roles)) {
    psql('postgres',['-c',`CREATE ROLE ${role} LOGIN INHERIT`]);
    psql('postgres',['-c',`GRANT responder_rls_${key==='governance'?'governance':'agency'}_fixture TO ${role}`]);
  }
  q(`INSERT INTO agency_private.organizations
    (id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state)
    VALUES ('${org.a}','phase5-a','Synthetic Agency A','Agency A','county_agency','verified','active'),
    ('${org.b}','phase5-b','Synthetic Agency B','Agency B','county_agency','verified','active'),
    ('${org.c}','phase5-c','Synthetic Agency C','Agency C','county_agency','verified','suspended')`);
  q(`INSERT INTO agency_private.local_auth_identities
    (user_id,normalized_email,identity_kind,assurance,session_active,eligibility) VALUES
    ${keys.map(key=>`('${ids[key]}','phase5-${key.toLowerCase()}-${suffix}@example.test',
      '${key==='governance'?'GRIDLY_ADMIN':'RESPONDER'}',
      '${key==='aal1'?'aal1':'aal2'}',${key==='inactive'?'false':'true'},'eligible')`).join(',')}`);
  q(`INSERT INTO agency_private.phase4_session_bindings(db_role,user_id,actor_kind) VALUES
    ${keys.map(key=>`('${roles[key]}','${ids[key]}','${key==='governance'?'GRIDLY_ADMIN':'RESPONDER'}')`).join(',')}`);
  q(`INSERT INTO agency_private.organization_memberships
    (organization_id,user_id,role,status,joined_at,suspended_at,revoked_at) VALUES
    ${keys.filter(key=>key!=='governance').map(key=>{
      const organization=key.endsWith('B')?org.b:key==='suspendedOrg'?org.c:org.a;
      const role=key==='viewer'?'VIEWER':key.startsWith('supervisor')?'SUPERVISOR':key==='admin'?'AGENCY_ADMIN':'RESPONDER';
      const state=key==='suspended'?'suspended':key==='revoked'?'revoked':'active';
      return `('${organization}','${ids[key]}','${role}','${state}',now(),
        ${state==='suspended'?'now()':'NULL'},${state==='revoked'?'now()':'NULL'})`;
    }).join(',')}`);
  const authorityA=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}','${org.a}','48291',1,now()-interval '1 day',now()+interval '2 days')`);
  const authorityB=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}','${org.b}','48071',1,now()-interval '1 day',now()+interval '2 days')`);
  const authorityC=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}','${org.c}','48291',1,now()-interval '1 day',now()+interval '2 days')`);
  const [lon,lat]=q("SELECT public.ST_X(public.ST_PointOnSurface(geometry)) || '|' || public.ST_Y(public.ST_PointOnSurface(geometry)) FROM agency_private.county_geometry_catalog WHERE county_fips='48291'").split('|').map(Number);
  const [outsideLon,outsideLat]=q("SELECT public.ST_X(public.ST_PointOnSurface(geometry)) || '|' || public.ST_Y(public.ST_PointOnSurface(geometry)) FROM agency_private.county_geometry_catalog WHERE county_fips='48071'").split('|').map(Number);
  const [boundaryLon,boundaryLat]=q("SELECT public.ST_X(public.ST_PointN(public.ST_ExteriorRing(geometry),1)) || '|' || public.ST_Y(public.ST_PointN(public.ST_ExteriorRing(geometry),1)) FROM agency_private.county_geometry_catalog WHERE county_fips='48291'").split('|').map(Number);
  const base={condition_type:'obstruction',impact_level:'moderate',title:'Synthetic obstruction',
    detail:'Local test only',longitude:lon,latitude:lat};
  const draft=(key='responder',condition='obstruction',organization=org.a)=>{
    const result=command(key,'create_draft',{...base,condition_type:condition},undefined,undefined,randomUUID(),organization);
    if (result.update_id) createdUpdates.push(result.update_id);
    return result;
  };
  const first=status('create valid draft',draft(),'accepted');
  check('draft source fixed',q(`SELECT source_family FROM agency_private.agency_updates WHERE id='${first.update_id}'`),'AGENCY_OFFICIAL');
  check('draft hidden from viewer',q(`SELECT count(*) FROM agency_private.responder_update_queue WHERE id='${first.update_id}'`,roles.viewer),'0');
  status('viewer cannot create',draft('viewer'),'forbidden');
  status('aal1 cannot create',draft('aal1'),'forbidden');
  status('inactive session cannot create',draft('inactive'),'forbidden');
  status('suspended member cannot create',draft('suspended'),'suspended');
  status('revoked member cannot create',draft('revoked'),'forbidden');
  status('suspended org cannot create',draft('suspendedOrg','obstruction',org.c),'suspended');
  status('cross-org create denied',draft('responder','obstruction',org.b),'forbidden');
  check('Gridly admin has no agency command grant',
    psql(database,['-c',"SELECT agency_private.phase5_agency_update_command('{}'::jsonb)"],roles.governance,true).status!==0,true);
  status('invalid condition denied',command('responder','create_draft',{...base,condition_type:'flood'}),'invalid_request');
  status('unknown payload field denied',command('responder','create_draft',{...base,source_family:'AGENCY_OFFICIAL'}),'invalid_request');
  status('missing title denied',command('responder','create_draft',{...base,title:undefined}),'invalid_request');
  status('oversized title denied',command('responder','create_draft',{...base,title:'x'.repeat(121)}),'invalid_request');
  status('HTML denied',command('responder','create_draft',{...base,title:'<script>'}),'invalid_request');
  status('outside county denied',command('responder','create_draft',{...base,longitude:outsideLon,latitude:outsideLat}),'out_of_scope');
  status('boundary denied',command('responder','create_draft',{...base,longitude:boundaryLon,latitude:boundaryLat}),'out_of_scope');
  status('spoofed FIPS denied',command('responder','create_draft',{...base,county_fips:'48071'}),'out_of_scope');
  status('unknown FIPS denied',command('responder','create_draft',{...base,county_fips:'48999'}),'out_of_scope');
  status('spoofed authority denied',command('responder','create_draft',{...base,authority_id:authorityB}),'out_of_scope');
  status('stale authority version denied',command('responder','create_draft',{...base,authority_version:2}),'out_of_scope');
  status('valid county point with current authority',command('responder','create_draft',
    {...base,county_fips:'48291',authority_id:authorityA,authority_version:1}),'accepted');
  status('community family spoof denied',command('responder','create_draft',{...base,source_family:'COMMUNITY',verified_agency:true}),'invalid_request');
  status('official family spoof denied',command('responder','create_draft',{...base,source_family:'NWS'}),'invalid_request');
  const changed=status('edit own draft',command('responder','edit_own_draft',{...base,title:'Edited'},first.update_id,0),'accepted');
  check('edit revision increment',changed.revision,1);
  status('stale edit denied',command('responder','edit_own_draft',{...base,title:'Stale'},first.update_id,0),'stale_revision');
  status('cross-org edit denied',command('responderB','edit_own_draft',base,first.update_id,1,randomUUID(),org.b),'forbidden');
  status('responder cannot edit another',command('second','edit_own_draft',base,first.update_id,1),'forbidden');
  status('supervisor edits another draft',command('supervisor','edit_another_draft',base,first.update_id,1),'accepted');
  status('stale submit denied',command('responder','submit_for_review',{},first.update_id,1),'stale_revision');
  const submitToken=randomUUID();
  const submitted=status('submit for review',command('responder','submit_for_review',{},first.update_id,2,submitToken),'pending_review');
  status('exact submit replay',command('responder','submit_for_review',{},first.update_id,2,submitToken),'already_processed');
  status('submit replay conflict',command('responder','submit_for_review',{county_fips:'48291'},first.update_id,2,submitToken),'invalid_request');
  check('submit one event',q(`SELECT count(*) FROM agency_private.agency_update_events WHERE update_id='${first.update_id}' AND revision=3`),'1');
  status('responder cannot return',command('responder','return_for_changes',{reason:'Correct details'},first.update_id,3),'forbidden');
  status('return stale revision',command('supervisor','return_for_changes',{reason:'Correct details'},first.update_id,2),'stale_revision');
  const returned=status('supervisor returns draft',command('supervisor','return_for_changes',{reason:'Correct details'},first.update_id,3),'accepted');
  check('returned revision',returned.revision,4);
  status('resubmit',command('responder','submit_for_review',{},first.update_id,4),'pending_review');
  for (const [action,payload] of [
    ['edit_own_draft',base],['submit_for_review',{}],['return_for_changes',{reason:'No'}],
    ['activate_non_closure',{}],['withdraw_update',{reason:'No'}]])
    status(`viewer cannot ${action}`,command('viewer',action,payload,first.update_id,5),'forbidden');
  status('responder cannot activate',command('responder','activate_non_closure',{},first.update_id,5),'forbidden');
  status('cross-org nonclosure activation denied',command('supervisorB','activate_non_closure',{},first.update_id,5,randomUUID(),org.b),'forbidden');
  status('gate false blocks activation',command('supervisor','activate_non_closure',{},first.update_id,5),'maintenance');
  status('stale activation denied',command('supervisor','activate_non_closure',{},first.update_id,4),'stale_revision');
  check('gate remains false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  // Dedicated synthetic database only; restore immediately after the positive path.
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  const active=status('non-closure activation',command('supervisor','activate_non_closure',{},first.update_id,5),'accepted');
  check('active expiry near twelve hours',q(`SELECT abs(extract(epoch FROM (expires_at-activated_at))-43200)<2 FROM agency_private.agency_updates WHERE id='${first.update_id}'`),'t');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  check('gate restored false after nonclosure',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  status('stale resolve denied',command('supervisor','resolve_update',{reason:'Done'},first.update_id,5),'stale_revision');
  status('responder cannot resolve',command('responder','resolve_update',{reason:'Done'},first.update_id,6),'forbidden');
  status('resolve with gate false',command('supervisor','resolve_update',{reason:'Done'},first.update_id,6),'accepted');
  status('terminal edit denied',command('supervisor','edit_active_update',base,first.update_id,7),'forbidden');
  status('terminal reactivation denied',command('supervisor','activate_non_closure',{},first.update_id,7),'invalid_request');
  const road=status('road closure draft',draft('responder','road_closed'),'accepted');
  status('road closure submitted',command('responder','submit_for_review',{},road.update_id,0),'pending_review');
  status('road gate false',command('supervisor','activate_road_closed',{},road.update_id,1),'maintenance');
  status('road author self-activation denied',command('responder','activate_road_closed',{},road.update_id,1),'forbidden');
  status('road cross-org denied',command('supervisorB','activate_road_closed',{},road.update_id,1,randomUUID(),org.b),'forbidden');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  const roadActive=status('road second actor activation',command('supervisor','activate_road_closed',{},road.update_id,1),'accepted');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  check('gate restored false after road',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  check('road activation event',q(`SELECT action FROM agency_private.agency_update_events WHERE update_id='${road.update_id}' AND revision=2`),'road_closure_activated');
  const linked=status('unresolved-crossing draft',command('responder','create_draft',{...base,crossing_id:'not-governed'}),'accepted');
  status('unresolved-crossing submitted',command('responder','submit_for_review',{},linked.update_id,0),'pending_review');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  status('unresolved crossing cannot activate',command('supervisor','activate_non_closure',{},linked.update_id,1),'invalid_request');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  const supervisorRoad=status('supervisor-authored road draft',draft('supervisor','road_closed'),'accepted');
  status('supervisor-authored road submitted',command('supervisor','submit_for_review',{},supervisorRoad.update_id,0),'pending_review');
  q(`UPDATE agency_private.organization_memberships SET status='suspended',suspended_at=now() WHERE user_id='${ids.admin}' AND organization_id='${org.a}'`);
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  status('qualified author cannot self-activate road',command('supervisor','activate_road_closed',{},supervisorRoad.update_id,1),'forbidden');
  check('no second approver leaves road pending',q(`SELECT status FROM agency_private.agency_updates WHERE id='${supervisorRoad.update_id}'`),'pending_review');
  q(`UPDATE agency_private.organization_memberships SET status='active',suspended_at=NULL WHERE user_id='${ids.admin}' AND organization_id='${org.a}'`);
  status('different admin activates supervisor-authored road',command('admin','activate_road_closed',{},supervisorRoad.update_id,1),'accepted');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  check('gate restored after supervisor-authored road',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const supervisorNonroad=status('supervisor-authored nonroad draft',draft('supervisor'),'accepted');
  status('supervisor-authored nonroad submitted',command('supervisor','submit_for_review',{},supervisorNonroad.update_id,0),'pending_review');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  status('supervisor may activate own nonroad under frozen matrix',command('supervisor','activate_non_closure',{},supervisorNonroad.update_id,1),'accepted');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  const adminRoad=status('admin-authored road draft',draft('admin','road_closed'),'accepted');
  status('admin-authored road submitted',command('admin','submit_for_review',{},adminRoad.update_id,0),'pending_review');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  status('admin cannot self-activate road',command('admin','activate_road_closed',{},adminRoad.update_id,1),'forbidden');
  status('supervisor activates admin-authored road',command('supervisor','activate_road_closed',{},adminRoad.update_id,1),'accepted');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  status('admin cannot create outside authority',command('admin','create_draft',
    {...base,longitude:outsideLon,latitude:outsideLat}),'out_of_scope');
  const live=status('active-edit draft',draft(),'accepted');
  status('active-edit submitted',command('responder','submit_for_review',{},live.update_id,0),'pending_review');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  status('active-edit activated',command('admin','activate_non_closure',{},live.update_id,1),'accepted');
  status('responder cannot active-edit',command('responder','edit_active_update',base,live.update_id,2),'forbidden');
  status('responder cannot renew',command('responder','renew_update',{},live.update_id,2),'forbidden');
  status('active edit cannot turn non-road into road closure',command('supervisor','edit_active_update',{...base,condition_type:'road_closed'},live.update_id,2),'invalid_request');
  const edited=status('active update edit',command('supervisor','edit_active_update',{...base,title:'Current active detail'},live.update_id,2),'accepted');
  check('active edit event',q(`SELECT action FROM agency_private.agency_update_events WHERE update_id='${live.update_id}' AND revision=3`),'update_edited');
  status('stale active edit',command('supervisor','edit_active_update',base,live.update_id,2),'stale_revision');
  status('expiry above 24h rejected',command('supervisor','renew_update',{expiry_hours:24.01},live.update_id,3),'invalid_request');
  const renewed=status('renew update to 24h from command',command('supervisor','renew_update',{expiry_hours:24},live.update_id,3),'accepted');
  check('renew event',q(`SELECT action FROM agency_private.agency_update_events WHERE update_id='${live.update_id}' AND revision=4`),'update_renewed');
  check('renew server window <=24h',q(`SELECT expires_at<=updated_at+interval '24 hours' FROM agency_private.agency_updates WHERE id='${live.update_id}'`),'t');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  status('gate false blocks active edit',command('supervisor','edit_active_update',base,live.update_id,4),'maintenance');
  status('gate false blocks renewal',command('supervisor','renew_update',{},live.update_id,4),'maintenance');
  check('gate false after active tests',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  check('effective active before expiry',q("SELECT agency_private.phase5_effective_status('active','2026-01-01 12:00Z','2026-01-01 11:59:59Z')"),'active');
  check('effective expired at expiry',q("SELECT agency_private.phase5_effective_status('active','2026-01-01 12:00Z','2026-01-01 12:00Z')"),'expired');
  check('effective expired after expiry',q("SELECT agency_private.phase5_effective_status('active','2026-01-01 12:00Z','2026-01-01 12:00:01Z')"),'expired');
  const expiredId=q(`INSERT INTO agency_private.agency_updates
    (organization_id,author_user_id,created_authority_id,current_authority_id,
      condition_type,impact_level,title,point,status,activated_at,expires_at)
    SELECT '${org.a}','${ids.responder}','${authorityA}','${authorityA}',
      'obstruction','moderate','Expired synthetic',public.ST_PointOnSurface(geometry),
      'active',now()-interval '25 hours',now()-interval '1 hour'
    FROM agency_private.county_geometry_catalog WHERE county_fips='48291' RETURNING id`);
  check('Phase 4 view derives expired state',q(`SELECT display_status FROM agency_private.responder_update_queue WHERE id='${expiredId}'`,roles.admin),'expired');
  status('expired active cannot resolve',command('supervisor','resolve_update',{reason:'Too late'},expiredId,0),'expired');
  status('expired active cannot renew',command('supervisor','renew_update',{},expiredId,0),'expired');
  const concurrent=status('concurrent-edit draft',draft(),'accepted');
  const makeConcurrent=(title)=>({contract_version:'responder.agency.v1.phase0.1',
    action:'edit_own_draft',operation_token:randomUUID(),organization_id:org.a,
    update_id:concurrent.update_id,expected_revision:0,payload:{...base,title}});
  const outcomes=await Promise.all([concurrentCommand('responder',makeConcurrent('Concurrent A')),
    concurrentCommand('responder',makeConcurrent('Concurrent B'))]);
  check('concurrent edit one accepted',outcomes.filter(x=>x.status==='accepted').length,1);
  check('concurrent edit one stale',outcomes.filter(x=>x.status==='stale_revision').length,1);
  check('concurrent edit one revision event',q(`SELECT count(*) FROM agency_private.agency_update_events WHERE update_id='${concurrent.update_id}' AND revision=1`),'1');
  const withdrawal=status('draft for withdrawal',draft(),'accepted');
  status('withdraw own unpublished',command('responder','withdraw_update',{reason:'Cancelled'},withdrawal.update_id,0),'accepted');
  status('stale withdraw denied',command('responder','withdraw_update',{reason:'Cancelled'},withdrawal.update_id,0),'stale_revision');
  status('withdraw terminal denied',command('admin','withdraw_update',{reason:'Cancelled'},withdrawal.update_id,1),'forbidden');
  const replayToken=randomUUID();
  const replay=status('create for replay',command('responder','create_draft',base,undefined,undefined,replayToken),'accepted');
  status('create exact replay',command('responder','create_draft',base,undefined,undefined,replayToken),'already_processed');
  status('create changed payload conflict',command('responder','create_draft',{...base,title:'Other'},undefined,undefined,replayToken),'invalid_request');
  status('same token different actor denied',command('second','create_draft',base,undefined,undefined,replayToken),'invalid_request');
  check('create replay one receipt',q(`SELECT count(*) FROM agency_private.agency_operation_receipts WHERE update_id='${replay.update_id}'`),'1');
  check('create replay one event',q(`SELECT count(*) FROM agency_private.agency_update_events WHERE update_id='${replay.update_id}'`),'1');
  check('no raw token persisted',q(`SELECT count(*) FROM agency_private.agency_operation_receipts WHERE encode(token_digest,'hex') LIKE '%${replayToken.replaceAll('-','')}%'`),'0');
  const receiptDenied=psql(database,['-c',`UPDATE agency_private.agency_operation_receipts SET action='forged' WHERE update_id='${replay.update_id}'`],owner,true);
  check('receipt append only',receiptDenied.status!==0,true);
  check('receipt delete denied',psql(database,['-c',`DELETE FROM agency_private.agency_operation_receipts WHERE update_id='${replay.update_id}'`],owner,true).status!==0,true);
  const directDenied=psql(database,['-c',`UPDATE agency_private.agency_updates SET title='forged' WHERE id='${replay.update_id}'`],roles.responder,true);
  check('ordinary direct update denied',directDenied.status!==0,true);
  check('all mutation events match revisions',q('SELECT count(*) FROM agency_private.agency_update_events e JOIN agency_private.agency_updates u ON u.id=e.update_id WHERE e.revision>u.revision'),'0');
  q(`UPDATE agency_private.organizations SET operation_state='active',suspended_at=NULL WHERE id='${org.c}'`);
  const orgCBase={...base};
  const orgCDraft=status('suspended-org fixture draft',command('suspendedOrg','create_draft',orgCBase,undefined,undefined,randomUUID(),org.c),'accepted');
  status('suspended-org fixture submitted',command('suspendedOrg','submit_for_review',{},orgCDraft.update_id,0,randomUUID(),org.c),'pending_review');
  q(`UPDATE agency_private.organizations SET operation_state='suspended',suspended_at=now() WHERE id='${org.c}'`);
  status('suspended org blocks activation',command('suspendedOrg','activate_non_closure',{},orgCDraft.update_id,1,randomUUID(),org.c),'suspended');
  q(`UPDATE agency_private.organizations SET verification_state='revoked',revoked_at=now() WHERE id='${org.c}'`);
  status('revoked org blocks activation',command('suspendedOrg','activate_non_closure',{},orgCDraft.update_id,1,randomUUID(),org.c),'suspended');
  const baseB={...base,longitude:outsideLon,latitude:outsideLat};
  status('other org in-county draft',command('responderB','create_draft',baseB,undefined,undefined,randomUUID(),org.b),'accepted');
  q(`UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=now() WHERE id='${authorityB}'`);
  status('revoked authority blocks new draft',command('responderB','create_draft',baseB,undefined,undefined,randomUUID(),org.b),'out_of_scope');
  q(`UPDATE agency_private.organizations SET operation_state='inactive',verification_state='pending_review' WHERE id='${org.b}'`);
  status('unverified org blocks draft',command('responderB','create_draft',baseB,undefined,undefined,randomUUID(),org.b),'forbidden');
  const authorityDraft=status('authority-rollover draft',draft(),'accepted');
  status('authority-rollover submitted',command('responder','submit_for_review',{},authorityDraft.update_id,0),'pending_review');
  q(`UPDATE agency_private.organization_authorities SET status='revoked',revoked_at=now() WHERE id='${authorityA}'`);
  const authorityA2=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}','${org.a}','48291',2,now()-interval '1 minute',now()+interval '2 days')`);
  check('new authority version created',q(`SELECT authority_version FROM agency_private.organization_authorities WHERE id='${authorityA2}'`),'2');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  status('stale authority blocks activation',command('supervisor','activate_non_closure',{authority_version:1},authorityDraft.update_id,1),'out_of_scope');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  check('final gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const vectorEvidence={
    'N01-viewer-draft':'viewer cannot create',
    'N02-responder-activate':'responder cannot activate',
    'N03-responder-wrong-org':'cross-org create denied',
    'N04-supervisor-wrong-org':'cross-org nonclosure activation denied',
    'N08-aal1-mutation':'aal1 cannot create',
    'N09-suspended-member':'suspended member cannot create',
    'N10-revoked-member':'revoked member cannot create',
    'N11-suspended-org':'suspended org blocks activation',
    'N12-revoked-org':'revoked org blocks activation',
    'N13-unverified-org':'unverified org blocks draft',
    'N14-unknown-fips':'unknown FIPS denied',
    'N15-outside-point':'outside county denied',
    'N16-boundary-point':'boundary denied',
    'N17-stale-authority':'stale authority blocks activation',
    'N18-spoofed-authority-id':'spoofed authority denied',
    'N19-replay-same':'create exact replay',
    'N20-replay-different':'create changed payload conflict',
    'N21-stale-revision':'stale active edit',
    'N22-closure-self-approval':'qualified author cannot self-activate road',
    'N23-closure-no-second-approver':'no second approver leaves road pending',
    'N25-terminal-reactivation':'terminal reactivation denied',
    'N28-community-badge-spoof':'community family spoof denied',
    'N29-official-family-spoof':'official family spoof denied',
    'P02-responder-create':'create valid draft',
    'P03-responder-edit-own':'edit own draft',
    'P04-responder-submit':'submit for review',
    'P05-supervisor-return':'supervisor returns draft',
    'P06-supervisor-nonclosure':'non-closure activation',
    'P07-second-actor-closure':'road second actor activation',
    'P08-supervisor-edit-active':'active update edit',
    'P09-supervisor-renew':'renew update to 24h from command',
    'P10-supervisor-resolve':'resolve with gate false',
    'P16-valid-county-point':'valid county point with current authority'
  };
  const vectorMap=JSON.parse(fs.readFileSync(path.join(root,'reports','responder','responder-phase5-vector-map.json'),'utf8'));
  check('33 new vector scenarios mapped to executed checks',Object.keys(vectorEvidence).length,33);
  check('new vector IDs agree with map',Object.keys(vectorEvidence).sort().join(','),vectorMap.newlyPassedVectorIds.slice().sort().join(','));
  for(const [id,label] of Object.entries(vectorEvidence))
    if(!passedLabels.has(label)) { failed++; console.error(`VECTOR_NOT_EXECUTED ${id} missing=${label}`); }
  if(!failed) console.log('PHASE5_NEW_FULL_VECTORS=33');
} catch(error) { failed++; console.error(`ERROR ${error.stack||error}`); }
finally { cleanup(); console.log(`PHASE5_PASS=${passed} PHASE5_FAIL=${failed}`); }
if (failed) process.exitCode=1;
