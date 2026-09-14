// Disposable localhost PostgreSQL/PostGIS only. Synthetic identities and fixtures.
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCountyCatalog } from '../tools/responder-local/load-county-authority.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {RESPONDER_LOCAL_PGBIN:bin,RESPONDER_LOCAL_PGPORT:port,
  RESPONDER_LOCAL_PGUSER:owner,RESPONDER_LOCAL_PGDATA:data}=process.env;
if (!bin || !/^\d{4,5}$/.test(port||'') || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner||'')
  || !data || !path.basename(data).startsWith('gridly-responder-phase6-')
  || path.relative(os.tmpdir(),path.resolve(data)).startsWith('..')) {
  throw new Error('Explicit disposable Phase 6 localhost PG configuration required');
}
const env={...process.env};
for(const key of Object.keys(env)) if(/^PG/i.test(key)||/SUPABASE|DATABASE_URL/i.test(key)) delete env[key];
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:port,PGCONNECT_TIMEOUT:'3'});
const database=`gridly_responder_p3_${randomUUID().replaceAll('-','').slice(0,20)}`;
const suffix=randomUUID().replaceAll('-','').slice(0,8);
const keys=['governance','aal1','inactive','admin','responder','supervisor','viewer','recovery'];
const roles=Object.fromEntries(keys.map(k=>[k,`p6_${k}_${suffix}`]));
const ids=Object.fromEntries(keys.map(k=>[k,randomUUID()]));
const org={verify:randomUUID(),reject:randomUUID(),active:randomUUID(),recovery:randomUUID()};
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
const q=(sql,role=owner)=>psql(database,['-c',sql],role).stdout.trim();
function check(label,actual,expected) {
  const ok=String(actual)===String(expected);
  console.log(`${ok?'PASS':'FAIL'} ${label}${ok?'':` expected=${expected} actual=${actual}`}`);
  if(ok) passed++; else failed++;
}
function command(key,organization,action,payload,revision,token=randomUUID()) {
  const request={contract_version:'responder.agency.v1.phase0.1',action,
    operation_token:token,organization_id:organization,expected_revision:revision,payload};
  return JSON.parse(q(`SELECT agency_private.phase6_governance_command(${quote(JSON.stringify(request))}::jsonb)`,roles[key]));
}
function status(label,result,expected) { check(label,result.status,expected); return result; }
function agency(action,payload,updateId,revision) {
  const request={contract_version:'responder.agency.v1.phase0.1',action,
    operation_token:randomUUID(),organization_id:org.active,payload};
  if(updateId!==undefined) request.update_id=updateId;
  if(revision!==undefined) request.expected_revision=revision;
  return JSON.parse(q(`SELECT agency_private.phase5_agency_update_command(${quote(JSON.stringify(request))}::jsonb)`,roles.responder));
}
try {
  check('PostgreSQL 17.10',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  check('disposable data directory',path.resolve(psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim()).toLowerCase(),path.resolve(data).toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]); created=true;
  q('CREATE EXTENSION postgis');
  check('PostGIS 3.6.2',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  for(const f of ['001_agency_private_apply.sql','002_phase2_auth_membership_apply.sql',
    '003_phase3_county_authority_apply.sql','004_phase4_rls_authorization_apply.sql',
    '005_phase5_local_command_apply.sql','006_phase6_local_governance_apply.sql'])
    psql(database,['-f',path.join(root,'db','responder-local',f)]);
  check('governance definer non-login and bypass RLS',q("SELECT NOT rolcanlogin AND NOT rolsuper AND rolbypassrls FROM pg_roles WHERE rolname='responder_governance_fixture'"),'t');
  check('254 canonical counties',loadCountyCatalog({database,bin,port,user:owner}).counties,254);
  check('gate initially false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  for(const k of keys) {
    psql('postgres',['-c',`CREATE ROLE ${roles[k]} LOGIN INHERIT`]);
    psql('postgres',['-c',`GRANT responder_rls_${['governance','aal1','inactive'].includes(k)?'governance':'agency'}_fixture TO ${roles[k]}`]);
  }
  q(`INSERT INTO agency_private.organizations
    (id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state) VALUES
    ('${org.verify}','phase6-verify','Synthetic Verify','Verify','county_agency','requested','inactive'),
    ('${org.reject}','phase6-reject','Synthetic Reject','Reject','county_agency','requested','inactive'),
    ('${org.active}','phase6-active','Synthetic Active','Active','county_agency','verified','active'),
    ('${org.recovery}','phase6-recovery','Synthetic Recovery','Recovery','county_agency','verified','active')`);
  q(`INSERT INTO agency_private.local_auth_identities
    (user_id,normalized_email,identity_kind,assurance,session_active,eligibility) VALUES
    ${keys.map(k=>`('${ids[k]}','phase6-${k}-${suffix}@example.test',
      '${['governance','aal1','inactive'].includes(k)?'GRIDLY_ADMIN':'RESPONDER'}',
      '${k==='aal1'?'aal1':'aal2'}',${k==='inactive'?'false':'true'},'eligible')`).join(',')}`);
  q(`INSERT INTO agency_private.phase4_session_bindings(db_role,user_id,actor_kind) VALUES
    ${keys.map(k=>`('${roles[k]}','${ids[k]}','${['governance','aal1','inactive'].includes(k)?'GRIDLY_ADMIN':'RESPONDER'}')`).join(',')}`);
  q(`INSERT INTO agency_private.organization_memberships
    (organization_id,user_id,role,status,joined_at,suspended_at) VALUES
    ('${org.active}','${ids.admin}','AGENCY_ADMIN','active',now(),NULL),
    ('${org.active}','${ids.responder}','RESPONDER','active',now(),NULL),
    ('${org.active}','${ids.supervisor}','SUPERVISOR','active',now(),NULL),
    ('${org.active}','${ids.viewer}','VIEWER','active',now(),NULL),
    ('${org.recovery}','${ids.recovery}','AGENCY_ADMIN','suspended',now(),now())`);
  const reason={reason:'Synthetic reviewed case'};
  status('cannot verify requested directly',command('governance',org.verify,'verify_organization',
    {...reason,evidence_reference:'case-1',official_callback_confirmed:true,initial_admin_reviewed:true},0),'forbidden');
  status('missing review evidence',command('governance',org.verify,'start_verification_review',reason,0),'invalid_request');
  status('aal1 governance denied',command('aal1',org.verify,'start_verification_review',
    {...reason,evidence_reference:'case-1'},0),'forbidden');
  status('inactive governance denied',command('inactive',org.verify,'start_verification_review',
    {...reason,evidence_reference:'case-1'},0),'forbidden');
  status('review starts',command('governance',org.verify,'start_verification_review',
    {...reason,evidence_reference:'case-1'},0),'accepted');
  status('missing callback denied',command('governance',org.verify,'verify_organization',
    {...reason,evidence_reference:'case-1',initial_admin_reviewed:true},1),'invalid_request');
  status('missing first-admin review denied',command('governance',org.verify,'verify_organization',
    {...reason,evidence_reference:'case-1',official_callback_confirmed:true},1),'invalid_request');
  const verifyPayload={...reason,evidence_reference:'case-1',official_callback_confirmed:true,initial_admin_reviewed:true};
  const verifyToken=randomUUID();
  const verified=status('independently verified',command('governance',org.verify,'verify_organization',
    verifyPayload,1,verifyToken),'accepted');
  status('verification exact replay',command('governance',org.verify,'verify_organization',
    verifyPayload,1,verifyToken),'already_processed');
  check('one verification receipt',q(`SELECT count(*) FROM agency_private.governance_operation_receipts
    WHERE organization_id='${org.verify}' AND action='verify_organization'`),'1');
  check('verified state',q(`SELECT verification_state FROM agency_private.organizations WHERE id='${org.verify}'`),'verified');
  check('verification evidence correlated',q(`SELECT count(*) FROM agency_private.organization_verification_events
    WHERE organization_id='${org.verify}' AND to_state='verified'
      AND method_reference->>'operation_id'='${verified.correlation_id}'`),'1');
  check('verification keeps gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const rejectReview=status('rejection review starts',command('governance',org.reject,'start_verification_review',
    {...reason,evidence_reference:'case-2'},0),'accepted');
  status('verification rejected',command('governance',org.reject,'reject_organization',reason,1),'accepted');
  status('rejected claim terminal',command('governance',org.reject,'start_verification_review',
    {...reason,evidence_reference:'case-2'},2),'forbidden');
  check('rejected state',q(`SELECT verification_state FROM agency_private.organizations WHERE id='${org.reject}'`),'rejected');
  const county=JSON.parse(q("SELECT json_build_object('hash',source_sha256,'schema',source_schema_version) FROM agency_private.county_geometry_catalog WHERE county_fips='48291'"));
  const authority={...reason,county_fips:'48291',source_sha256:county.hash,
    source_schema_version:county.schema,authority_version:1,
    effective_from:new Date(Date.now()-3600000).toISOString(),
    effective_until:new Date(Date.now()+86400000).toISOString()};
  status('unknown county denied',command('governance',org.active,'approve_authority',
    {...authority,county_fips:'48999'},0),'out_of_scope');
  status('mismatched source hash denied',command('governance',org.active,'approve_authority',
    {...authority,source_sha256:'0'.repeat(64)},0),'out_of_scope');
  status('municipal presentation point denied',command('governance',org.active,'approve_authority',
    {...authority,scope_type:'MUNICIPAL',place_point:{longitude:-95,latitude:30}},0),'out_of_scope');
  check('municipal proxy creates no authority',q(`SELECT count(*) FROM agency_private.organization_authorities
    WHERE organization_id='${org.active}'`),'0');
  check('municipal proxy creates no receipt',q(`SELECT count(*) FROM agency_private.governance_operation_receipts
    WHERE organization_id='${org.active}'`),'0');
  check('municipal proxy creates no governance event',q(`SELECT count(*) FROM agency_private.organization_governance_events
    WHERE organization_id='${org.active}'`),'0');
  status('malformed interval denied',command('governance',org.active,'approve_authority',
    {...authority,effective_until:new Date(Date.now()-7200000).toISOString()},0),'invalid_request');
  status('malformed timestamp denied',command('governance',org.active,'approve_authority',
    {...authority,effective_from:'not-a-date'},0),'invalid_request');
  status('infinite timestamp denied',command('governance',org.active,'approve_authority',
    {...authority,effective_from:'infinity'},0),'invalid_request');
  const approvalToken=randomUUID();
  const approved=status('county authority approved',command('governance',org.active,'approve_authority',authority,0,approvalToken),'accepted');
  check('approval receipt claimed',q(`SELECT count(*) FROM agency_private.governance_operation_receipts
    WHERE action='approve_authority' AND organization_id='${org.active}'`),'1');
  status('exact replay bounded',command('governance',org.active,'approve_authority',authority,0,approvalToken),'already_processed');
  status('same token payload conflict denied',command('governance',org.active,'approve_authority',
    {...authority,reason:'Changed'},0,approvalToken),'invalid_request');
  check('no duplicate approval event',q(`SELECT count(*) FROM agency_private.organization_governance_events
    WHERE organization_id='${org.active}' AND action='county_authority_approved'`),'1');
  status('stale governance revision denied',command('governance',org.active,'approve_authority',authority,0),'stale_revision');
  status('duplicate current authority denied',command('governance',org.active,'approve_authority',
    {...authority,authority_version:2},1),'invalid_request');
  check('gate after authority false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const [lon,lat]=q("SELECT public.ST_X(public.ST_PointOnSurface(geometry)) || '|' || public.ST_Y(public.ST_PointOnSurface(geometry)) FROM agency_private.county_geometry_catalog WHERE county_fips='48291'").split('|').map(Number);
  const base={condition_type:'obstruction',impact_level:'moderate',title:'Synthetic obstruction',
    detail:'Local test only',longitude:lon,latitude:lat};
  const draft=status('agency draft for withdrawal fixture',agency('create_draft',base),'accepted');
  status('agency draft submitted',agency('submit_for_review',{},draft.update_id,0),'pending_review');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  const activeRequest={contract_version:'responder.agency.v1.phase0.1',action:'activate_non_closure',
    operation_token:randomUUID(),organization_id:org.active,update_id:draft.update_id,
    expected_revision:1,payload:{}};
  status('disposable active post fixture',JSON.parse(q(`SELECT agency_private.phase5_agency_update_command(${quote(JSON.stringify(activeRequest))}::jsonb)`,roles.supervisor)),'accepted');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  check('gate restored false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  q(`CREATE FUNCTION agency_private.phase6_forced_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='organization_suspended' THEN RAISE EXCEPTION 'synthetic rollback'; END IF;
    RETURN NEW; END $$`);
  q(`CREATE TRIGGER phase6_forced_failure BEFORE INSERT ON agency_private.organization_governance_events
    FOR EACH ROW EXECUTE FUNCTION agency_private.phase6_forced_failure()`);
  status('forced failure bounded',command('governance',org.active,'suspend_organization',reason,1),'retryable_failure');
  check('rollback org active',q(`SELECT operation_state FROM agency_private.organizations WHERE id='${org.active}'`),'active');
  check('rollback update active',q(`SELECT status FROM agency_private.agency_updates WHERE id='${draft.update_id}'`),'active');
  check('rollback no suspension receipt',q(`SELECT count(*) FROM agency_private.governance_operation_receipts WHERE action='suspend_organization'`),'0');
  check('rollback no withdrawal event',q(`SELECT count(*) FROM agency_private.agency_update_events
    WHERE update_id='${draft.update_id}' AND action='update_withdrawn'`),'0');
  q('DROP TRIGGER phase6_forced_failure ON agency_private.organization_governance_events');
  q('DROP FUNCTION agency_private.phase6_forced_failure()');
  status('organization suspended',command('governance',org.active,'suspend_organization',reason,1),'accepted');
  check('suspended state',q(`SELECT operation_state FROM agency_private.organizations WHERE id='${org.active}'`),'suspended');
  check('operation epoch advanced',q(`SELECT operation_epoch FROM agency_private.organizations WHERE id='${org.active}'`),'1');
  check('active post withdrawn',q(`SELECT status FROM agency_private.agency_updates WHERE id='${draft.update_id}'`),'withdrawn');
  check('withdrawal event appended',q(`SELECT count(*) FROM agency_private.agency_update_events
    WHERE update_id='${draft.update_id}' AND action='update_withdrawn'`),'1');
  status('suspended agency command denied',agency('create_draft',base),'suspended');
  check('authority ineffective while suspended',q(`SELECT count(*) FROM agency_private.responder_current_authority WHERE organization_id='${org.active}'`,roles.responder),'0');
  check('suspended membership history retained',q(`SELECT count(*) FROM agency_private.organization_memberships WHERE organization_id='${org.active}'`),'4');
  status('suspended recovery denied',command('governance',org.active,'recover_lost_admin',
    {...reason,target_user_id:ids.recovery,independent_contact_confirmed:true},2),'suspended');
  status('organization reinstated',command('governance',org.active,'reinstate_organization',reason,2),'accepted');
  check('old post stays withdrawn',q(`SELECT status FROM agency_private.agency_updates WHERE id='${draft.update_id}'`),'withdrawn');
  check('gate after reinstatement false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  const nextDraft=status('second authority-bound draft',agency('create_draft',base),'accepted');
  status('second draft submitted',agency('submit_for_review',{},nextDraft.update_id,0),'pending_review');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true');
  const nextActiveRequest={...activeRequest,operation_token:randomUUID(),update_id:nextDraft.update_id};
  status('second disposable active post',JSON.parse(q(`SELECT agency_private.phase5_agency_update_command(${quote(JSON.stringify(nextActiveRequest))}::jsonb)`,roles.supervisor)),'accepted');
  q('UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=false');
  status('valid authority revocation',command('governance',org.active,'revoke_authority',
    {...reason,authority_id:approved.related_id},3),'accepted');
  check('revocation withdraws affected active post',q(`SELECT status FROM agency_private.agency_updates
    WHERE id='${nextDraft.update_id}'`),'withdrawn');
  check('revocation appends affected update event',q(`SELECT count(*) FROM agency_private.agency_update_events
    WHERE update_id='${nextDraft.update_id}' AND action='update_withdrawn'`),'1');
  check('revoked authority preserved',q(`SELECT status FROM agency_private.organization_authorities WHERE id='${approved.related_id}'`),'revoked');
  check('no approved authority remains',q(`SELECT count(*) FROM agency_private.organization_authorities
    WHERE organization_id='${org.active}' AND status='approved'`),'0');
  status('stale authority version denied',command('governance',org.active,'approve_authority',
    authority,4),'invalid_request');
  status('reapproval with advanced version',command('governance',org.active,'approve_authority',
    {...authority,authority_version:2},4),'accepted');
  status('verification revocation',command('governance',org.active,
    'revoke_organization_verification',reason,5),'accepted');
  check('verification revoked and operation suspended',q(`SELECT verification_state||'|'||operation_state
    FROM agency_private.organizations WHERE id='${org.active}'`),'revoked|suspended');
  status('revoked verification cannot reinstate',command('governance',org.active,
    'reinstate_organization',reason,6),'forbidden');
  status('governed admin recovery',command('governance',org.recovery,'recover_lost_admin',
    {...reason,target_user_id:ids.recovery,independent_contact_confirmed:true},0),'accepted');
  check('admin recovered',q(`SELECT status FROM agency_private.organization_memberships
    WHERE organization_id='${org.recovery}' AND user_id='${ids.recovery}'`),'active');
  check('recovery audit from Phase 2',q(`SELECT count(*) FROM agency_private.organization_governance_events
    WHERE organization_id='${org.recovery}' AND action='admin_recovered'`),'1');
  for(const k of ['admin','responder','supervisor','viewer']) {
    check(`${k} cannot execute governance`,psql(database,['-c',
      `SELECT agency_private.phase6_governance_command('{}'::jsonb)`],roles[k],true).status!==0,true);
  }
  check('governance has no agency command grant',psql(database,['-c',
    `SELECT agency_private.phase5_agency_update_command('{}'::jsonb)`],roles.governance,true).status!==0,true);
  for(const table of ['organization_verification_events','organization_governance_events',
    'governance_operation_receipts']) {
    check(`agency cannot read ${table}`,psql(database,['-c',
      `SELECT count(*) FROM agency_private.${table}`],roles.admin,true).status!==0,true);
  }
  check('agency cannot mutate governance receipt',psql(database,['-c',
    `UPDATE agency_private.governance_operation_receipts SET action='tamper'`],roles.admin,true).status!==0,true);
  check('agency cannot directly verify organization',psql(database,['-c',
    `UPDATE agency_private.organizations SET verification_state='verified' WHERE id='${org.reject}'`],roles.admin,true).status!==0,true);
  check('agency cannot directly alter authority',psql(database,['-c',
    `UPDATE agency_private.organization_authorities SET status='revoked' WHERE id='${approved.related_id}'`],roles.admin,true).status!==0,true);
  check('agency cannot change publishing gate',psql(database,['-c',
    `UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true`],roles.admin,true).status!==0,true);
  check('governance identity cannot change publishing gate',psql(database,['-c',
    `UPDATE agency_private.agency_program_controls SET agency_publishing_enabled=true`],roles.governance,true).status!==0,true);
  check('agency cannot read authority provenance',psql(database,['-c',
    `SELECT source_sha256 FROM agency_private.organization_authorities`],roles.admin,true).status!==0,true);
  check('owner cannot rewrite immutable receipt',psql(database,['-c',
    `UPDATE agency_private.governance_operation_receipts SET action='tamper'`],owner,true).status!==0,true);
  check('owner cannot erase verification evidence',psql(database,['-c',
    `DELETE FROM agency_private.organization_verification_events`],owner,true).status!==0,true);
  check('final gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
} catch(e) {
  failed++;
  console.error(`FAIL unhandled: ${e.stack||e.message}`);
} finally {
  if(created) {
    try { psql('postgres',['-c',`DROP DATABASE ${database} WITH (FORCE)`]); created=false; }
    catch(e) { failed++; console.error(`DATABASE CLEANUP FAILED ${e.message}`); }
  }
  psql('postgres',['-c',`DROP ROLE IF EXISTS ${Object.values(roles).join(',')},responder_governance_fixture,
    responder_rls_agency_fixture,responder_rls_governance_fixture,responder_command_fixture,
    responder_app_fixture,responder_owner_fixture`],owner,true);
}
console.log(`TOTAL ${passed} passed ${failed} failed`);
process.exitCode=failed?1:0;
