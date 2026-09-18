import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { issueInvitationToken } from '../tools/responder/phase23/auth-harness.mjs';

const root = resolve(import.meta.dirname, '..');
const pgbin = process.env.DISPATCH_PHASE23_PGBIN;
const port = process.env.DISPATCH_PHASE23_PGPORT;
const owner = process.env.DISPATCH_PHASE23_PGUSER;
const pgdata = process.env.DISPATCH_PHASE23_PGDATA;
assert.ok(pgbin && port && owner && pgdata, 'runner must provide disposable PostgreSQL settings');
assert.match(pgdata.replaceAll('\\','/'), /\/gridly-dispatch-phase23-[a-f0-9]+$/);

const psql = join(pgbin,'psql.exe');
const createdb = join(pgbin,'createdb.exe');
const dropdb = join(pgbin,'dropdb.exe');
const db = `dispatch_phase23_${randomBytes(6).toString('hex')}`;
const suffix = randomBytes(5).toString('hex');
const roleNames = ['owner','owner_aal1','viewer','operator','admin','platform','platform_aal1','platform2','invitee1','invitee2','aal1','expired','mismatch','wrongfactor','org2owner','newuser'];
const roles = Object.fromEntries(roleNames.map((key)=>[key,`p23_${key}_${suffix}`]));
const org1='20000000-0000-4000-8000-000000000001';
const org2='20000000-0000-4000-8000-000000000002';
const scope1='40000000-0000-4000-8000-000000000001';
const newUser='10000000-0000-4000-8000-000000000099';
const newSession='a0000000-0000-4000-8000-000000000099';
const newFactor='b0000000-0000-4000-8000-000000000099';

const baseEnv={...process.env,PGHOST:'127.0.0.1',PGPORT:port,PGUSER:owner};
for(const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_DB_URL','PGPASSWORD','PGSERVICE']) delete baseEnv[key];
function run(binary,args,{env=baseEnv,expectFailure=false}={}){
  const r=spawnSync(binary,args,{cwd:root,env,encoding:'utf8',windowsHide:true});
  if(expectFailure) assert.notEqual(r.status,0,`expected failure: ${r.stdout}`);
  else assert.equal(r.status,0,`${r.stderr}\n${r.stdout}`);
  return (r.stdout??'').trim();
}
function ownerSql(sql,options={}){return run(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',sql],options);}
function fileSql(path){return run(psql,['-X','-q','-v','ON_ERROR_STOP=1','-d',db,'-f',path]);}
function scalar(sql){return ownerSql(sql).split(/\r?\n/).at(-1);}
function actorSql(role,org,sql,options={}){
  const context=org?`SELECT set_config('dispatch_phase21.requested_organization','${org}',true);`:'';
  const out=run(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',`BEGIN; SET LOCAL statement_timeout='10s'; ${context} ${sql}; COMMIT;`],{...options,env:{...baseEnv,PGUSER:role}});
  return out.split(/\r?\n/).at(-1);
}
function actorSqlAsync(role,org,sql){
  const context=org?`SELECT set_config('dispatch_phase21.requested_organization','${org}',true);`:'';
  const args=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',`BEGIN; SET LOCAL statement_timeout='10s'; ${context} ${sql}; COMMIT;`];
  return new Promise(resolvePromise=>{const child=spawn(psql,args,{cwd:root,env:{...baseEnv,PGUSER:role},windowsHide:true});let stdout='',stderr='';child.stdout.on('data',c=>stdout+=c);child.stderr.on('data',c=>stderr+=c);child.on('close',status=>resolvePromise({status,stdout:stdout.trim(),stderr:stderr.trim()}));});
}
function bind(role,subject,session,aal='aal2',amr='[{"method":"password"},{"method":"totp"}]'){
  ownerSql(`INSERT INTO dispatch_phase23_auth.trusted_claim_bindings(session_role,subject,session_id,aal,amr,email_normalized,email_verified,token_issued_at,token_expires_at) SELECT '${role}','${subject}','${session}','${aal}','${amr}'::jsonb,email_normalized,true,now()-interval '1 minute',now()+interval '30 minutes' FROM dispatch_phase23_auth.auth_users WHERE id='${subject}'`);
}
function invite(role,org,target,roleTemplate='VIEWER'){
  const token=issueInvitationToken();
  const revision=scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org}'`);
  const id=actorSql(role,org,`SELECT dispatch_phase23_auth.invite_member('${org}',${revision},'${target}','${roleTemplate}',decode('${token.digestHex}','hex'),now()+interval '1 day','${randomUUID()}')`);
  return {...token,id};
}

test('Phase 23 local Auth and invitation integration',async(t)=>{
  run(createdb,['-h','127.0.0.1','-p',port,'-U',owner,db]);
  try {
    await t.test('loads Phase 21/22 then supersedes synthetic auth with private Phase 23 state',()=>{
      for(const path of ['tools/responder/phase21/apply.sql','tools/responder/phase21/fixtures.sql','tools/responder/phase22/apply.sql','tools/responder/phase22/commands.sql','tools/responder/phase22/fixtures.sql','tools/responder/phase23/apply.sql','tools/responder/phase23/fixtures.sql']) fileSql(join(root,...path.split('/')));
      assert.equal(scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dispatch_phase23_auth' AND c.relkind='r'"),'7');
      assert.equal(scalar("SELECT has_function_privilege('dispatch_phase21_app','dispatch_phase22_local.accept_invitation(uuid,uuid,bytea,uuid)','EXECUTE')"),'f');
      assert.equal(scalar("SELECT has_function_privilege('dispatch_phase21_app','dispatch_phase23_auth.accept_invitation(uuid,uuid,text,uuid)','EXECUTE')"),'t');
    });

    await t.test('binds only signature-verified claim-shaped server context',()=>{
      for(const role of Object.values(roles)) ownerSql(`CREATE ROLE ${role} LOGIN INHERIT; GRANT dispatch_phase21_app TO ${role}`);
      bind(roles.owner,'10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001');
      bind(roles.owner_aal1,'10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','aal1','[{"method":"password"}]');
      bind(roles.viewer,'10000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002');
      bind(roles.operator,'10000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003');
      bind(roles.admin,'10000000-0000-4000-8000-000000000010','a0000000-0000-4000-8000-000000000004');
      bind(roles.platform,'10000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000007');
      bind(roles.platform_aal1,'10000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-000000000007','aal1','[{"method":"password"}]');
      bind(roles.platform2,'10000000-0000-4000-8000-000000000011','a0000000-0000-4000-8000-000000000008');
      bind(roles.invitee1,'10000000-0000-4000-8000-000000000012','a0000000-0000-4000-8000-000000000010');
      bind(roles.invitee2,'10000000-0000-4000-8000-000000000014','a0000000-0000-4000-8000-000000000011');
      bind(roles.aal1,'10000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000012','aal1','[{"method":"password"}]');
      bind(roles.expired,'10000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000013');
      bind(roles.mismatch,'10000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000014');
      bind(roles.wrongfactor,'10000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000014');
      bind(roles.org2owner,'10000000-0000-4000-8000-000000000004','a0000000-0000-4000-8000-000000000017');
      const otherFactor=scalar("SELECT id FROM dispatch_phase23_auth.auth_factors WHERE user_id='10000000-0000-4000-8000-000000000002' LIMIT 1");
      ownerSql(`UPDATE dispatch_phase23_auth.auth_session_amr SET factor_id='${otherFactor}' WHERE session_id='a0000000-0000-4000-8000-000000000014' AND method='totp'`);
    });

    await t.test('enforces canonical user, live session, signed AAL2, AMR, and same-user verified factor',()=>{
      assert.equal(actorSql(roles.operator,org1,'SELECT dispatch_phase22_local.session_has_live_aal2()'),'t');
      for(const role of [roles.aal1,roles.expired,roles.mismatch,roles.wrongfactor]) assert.equal(actorSql(role,org1,'SELECT dispatch_phase22_local.session_has_live_aal2()'),'f');
      const record=actorSql(roles.operator,org1,`SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','trusted actor','payload user ignored','${scope1}','{"user_id":"10000000-0000-4000-8000-000000000002"}','${randomUUID()}')`);
      assert.equal(scalar(`SELECT actor_user_id::text FROM dispatch_phase21_local.dispatch_audit_events WHERE target_id='${record}' AND event_type='RECORD_CREATED'`),'10000000-0000-4000-8000-000000000003');
      assert.equal(actorSql(roles.operator,org1,"SELECT set_config('dispatch_phase23.session_id','a0000000-0000-4000-8000-000000000002',true); SELECT set_config('dispatch_phase23.factor_id','00000000-0000-0000-0000-000000000000',true); SELECT dispatch_phase22_local.session_has_live_aal2()"),'t');
    });

    await t.test('existing-user invitation is digest-only, identity-bound, replay-safe, and atomic',async()=>{
      const target=scalar("SELECT 'email:'||email_normalized FROM dispatch_phase23_auth.auth_users WHERE id='10000000-0000-4000-8000-000000000012'");
      const inv=invite(roles.admin,org1,target);
      const before=scalar("SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE command_name='accept_invitation_v2'");
      actorSql(roles.viewer,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${inv.id}','${inv.token}','${randomUUID()}')`,{expectFailure:true});
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE command_name='accept_invitation_v2'"),before);
      const key=randomUUID(); const sql=`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${inv.id}','${inv.token}','${key}')`;
      const membership=actorSql(roles.invitee1,org1,sql);
      assert.equal(actorSql(roles.invitee1,org1,sql),membership);
      actorSql(roles.invitee1,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${inv.id}','${inv.token}','${randomUUID()}')`,{expectFailure:true});
      assert.equal(scalar(`SELECT status::text FROM dispatch_phase21_local.organization_invitations WHERE id='${inv.id}'`),'ACCEPTED');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE target_id='${inv.id}' AND event_type='INVITATION_ACCEPTED'`),'1');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.organization_invitations WHERE encode(token_digest,'hex')='${inv.digestHex}'`),'1');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE event_payload::text LIKE '%${inv.token}%'`),'0');
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.command_receipts WHERE result_payload::text LIKE '%${inv.token}%'`),'0');
      for(const [status,expiry,revoked] of [['PENDING',"now()-interval '1 minute'",'NULL'],['REVOKED',"now()+interval '1 day'",'now()']]){
        const probe=issueInvitationToken(); const probeId=randomUUID();
        ownerSql(`INSERT INTO dispatch_phase21_local.organization_invitations(id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id,created_at,revoked_at) VALUES ('${probeId}','${org1}','user:10000000-0000-4000-8000-000000000012','VIEWER',decode('${probe.digestHex}','hex'),'${status}',${expiry},'30000000-0000-4000-8000-000000000010',now()-interval '2 days',${revoked})`);
        actorSql(roles.invitee1,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${probeId}','${probe.token}','${randomUUID()}')`,{expectFailure:true});
      }
      const duplicate=issueInvitationToken(); const duplicateId=randomUUID();
      ownerSql(`INSERT INTO dispatch_phase21_local.organization_invitations(id,organization_id,email_or_identity_target,role_template,token_digest,status,expires_at,created_by_membership_id) VALUES ('${duplicateId}','${org1}','${target}','VIEWER',decode('${duplicate.digestHex}','hex'),'PENDING',now()+interval '1 day','30000000-0000-4000-8000-000000000010')`);
      actorSql(roles.invitee1,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${duplicateId}','${duplicate.token}','${randomUUID()}')`,{expectFailure:true});
    });

    await t.test('new-user contract requires verified identity then enrolled, verified TOTP and AAL2',()=>{
      const first=invite(roles.admin,org1,'email:new.dispatch@example.invalid','VIEWER');
      ownerSql(`INSERT INTO dispatch_phase21_local.profiles(user_id,display_name,status) VALUES ('${newUser}','New Invitee','ACTIVE'); INSERT INTO dispatch_phase23_auth.auth_users(id,email_normalized,email_verified_at) VALUES ('${newUser}','new.dispatch@example.invalid',now()); INSERT INTO dispatch_phase23_auth.auth_identities(id,user_id,provider,provider_subject,email_normalized,email_verified_at) VALUES (gen_random_uuid(),'${newUser}','google','google-new-user','new.dispatch@example.invalid',now()); INSERT INTO dispatch_phase23_auth.auth_sessions(id,user_id,issued_at,refreshed_at,expires_at) VALUES ('${newSession}','${newUser}',now()-interval '1 minute',now()-interval '1 minute',now()+interval '1 hour'); INSERT INTO dispatch_phase23_auth.auth_session_amr(session_id,method,authenticated_at) VALUES ('${newSession}','oauth',now()-interval '1 minute')`);
      bind(roles.newuser,newUser,newSession,'aal1','[{"method":"oauth"}]');
      actorSql(roles.newuser,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${first.id}','${first.token}','${randomUUID()}')`,{expectFailure:true});
      ownerSql(`INSERT INTO dispatch_phase23_auth.auth_factors(id,user_id,factor_type,status,secret_reference,enrolled_at) VALUES ('${newFactor}','${newUser}','totp','UNVERIFIED','local-opaque:new-user',now())`);
      actorSql(roles.newuser,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${first.id}','${first.token}','${randomUUID()}')`,{expectFailure:true});
      ownerSql(`UPDATE dispatch_phase23_auth.auth_factors SET status='VERIFIED',verified_at=now() WHERE id='${newFactor}'; INSERT INTO dispatch_phase23_auth.auth_session_amr(session_id,method,factor_id,authenticated_at) VALUES ('${newSession}','totp','${newFactor}',now()); UPDATE dispatch_phase23_auth.trusted_claim_bindings SET aal='aal2',amr='[{"method":"oauth"},{"method":"totp"}]' WHERE session_role='${roles.newuser}'`);
      actorSql(roles.newuser,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${first.id}','${first.token}','${randomUUID()}')`);
      assert.equal(scalar(`SELECT status::text||':'||role_template::text FROM dispatch_phase21_local.organization_memberships WHERE organization_id='${org1}' AND user_id='${newUser}'`),'ACTIVE:VIEWER');
    });

    await t.test('multi-organization invitation preserves independent roles',()=>{
      const second=invite(roles.org2owner,org2,'email:new.dispatch@example.invalid','OPERATOR');
      actorSql(roles.newuser,org2,`SELECT dispatch_phase23_auth.accept_invitation('${org2}','${second.id}','${second.token}','${randomUUID()}')`);
      assert.equal(scalar(`SELECT string_agg(organization_id::text||':'||role_template::text,',' ORDER BY organization_id) FROM dispatch_phase21_local.organization_memberships WHERE user_id='${newUser}' AND status='ACTIVE'`),`${org1}:VIEWER,${org2}:OPERATOR`);
      assert.equal(actorSql(roles.newuser,org1,`SELECT dispatch_phase21_local.has_permission('${org1}','operations.create')`),'f');
      assert.equal(actorSql(roles.newuser,org2,`SELECT dispatch_phase21_local.has_permission('${org2}','operations.create')`),'t');
    });

    await t.test('concurrent acceptance and accept-versus-revoke have one safe state',async()=>{
      const target=scalar("SELECT 'email:'||email_normalized FROM dispatch_phase23_auth.auth_users WHERE id='10000000-0000-4000-8000-000000000014'");
      const inv=invite(roles.admin,org1,target); const key=randomUUID();
      const sql=`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${inv.id}','${inv.token}','${key}')`;
      const same=await Promise.all([actorSqlAsync(roles.invitee2,org1,sql),actorSqlAsync(roles.invitee2,org1,sql)]);
      assert.deepEqual(same.map(r=>r.status),[0,0]);
      assert.equal(same[0].stdout.split(/\r?\n/).at(-1),same[1].stdout.split(/\r?\n/).at(-1));
      const raceUser='10000000-0000-4000-8000-000000000098'; const raceSession='a0000000-0000-4000-8000-000000000098'; const raceFactor='b0000000-0000-4000-8000-000000000098'; const raceRole=`p23_race_${suffix}`;
      ownerSql(`INSERT INTO dispatch_phase21_local.profiles VALUES ('${raceUser}','Race User','ACTIVE'); INSERT INTO dispatch_phase23_auth.auth_users(id,email_normalized,email_verified_at) VALUES ('${raceUser}','race@example.invalid',now()); INSERT INTO dispatch_phase23_auth.auth_identities(id,user_id,provider,provider_subject,email_normalized,email_verified_at) VALUES (gen_random_uuid(),'${raceUser}','email','${raceUser}','race@example.invalid',now()); INSERT INTO dispatch_phase23_auth.auth_sessions(id,user_id,issued_at,refreshed_at,expires_at) VALUES ('${raceSession}','${raceUser}',now()-interval '1 minute',now()-interval '1 minute',now()+interval '1 hour'); INSERT INTO dispatch_phase23_auth.auth_factors VALUES ('${raceFactor}','${raceUser}','totp','VERIFIED','local-opaque:race',now()-interval '2 minutes',now()-interval '1 minute',NULL,NULL); INSERT INTO dispatch_phase23_auth.auth_session_amr VALUES ('${raceSession}','totp','${raceFactor}',now()-interval '1 minute'); CREATE ROLE ${raceRole} LOGIN INHERIT; GRANT dispatch_phase21_app TO ${raceRole}`);
      bind(raceRole,raceUser,raceSession);
      const race=invite(roles.admin,org1,'email:race@example.invalid');
      const accepted=actorSqlAsync(raceRole,org1,`SELECT dispatch_phase23_auth.accept_invitation('${org1}','${race.id}','${race.token}','${randomUUID()}')`);
      const revoked=new Promise(resolvePromise=>{const child=spawn(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',`BEGIN; SET LOCAL statement_timeout='10s'; UPDATE dispatch_phase21_local.organization_invitations SET status='REVOKED',revoked_at=now() WHERE id='${race.id}'; COMMIT;`],{cwd:root,env:baseEnv,windowsHide:true});let o='',e='';child.stdout.on('data',c=>o+=c);child.stderr.on('data',c=>e+=c);child.on('close',status=>resolvePromise({status,stdout:o,stderr:e}));});
      const outcomes=await Promise.all([accepted,revoked]);
      assert.deepEqual(outcomes.map(r=>r.status).sort(),[0,1],JSON.stringify(outcomes));
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.organization_memberships WHERE organization_id='${org1}' AND user_id='${raceUser}'`),scalar(`SELECT CASE WHEN status='ACCEPTED' THEN 1 ELSE 0 END FROM dispatch_phase21_local.organization_invitations WHERE id='${race.id}'`));
      ownerSql(`REVOKE dispatch_phase21_app FROM ${raceRole}; DROP ROLE ${raceRole}`);
    });

    await t.test('ownership transfer and two-person recovery remain AAL2-gated',()=>{
      const revision=scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`);
      actorSql(roles.owner_aal1,org1,`SELECT dispatch_phase22_local.initiate_ownership_transfer('${org1}',${revision},'30000000-0000-4000-8000-000000000010','aal1 denied',now()+interval '1 day','${randomUUID()}')`,{expectFailure:true});
      const transfer=actorSql(roles.owner,org1,`SELECT dispatch_phase22_local.initiate_ownership_transfer('${org1}',${revision},'30000000-0000-4000-8000-000000000010','phase23 aal2 proof',now()+interval '1 day','${randomUUID()}')`);
      actorSql(roles.admin,org1,`SELECT dispatch_phase22_local.accept_ownership_transfer('${org1}','${transfer}',${Number(revision)+1},'${randomUUID()}')`);
      const recoveryRevision=scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id='${org1}'`);
      actorSql(roles.platform_aal1,org1,`SELECT dispatch_phase22_local.start_ownership_recovery('${org1}','30000000-0000-4000-8000-000000000013',${recoveryRevision},'aal1-denied','must fail','${randomUUID()}')`,{expectFailure:true});
      const recovery=actorSql(roles.platform,org1,`SELECT dispatch_phase22_local.start_ownership_recovery('${org1}','30000000-0000-4000-8000-000000000013',${recoveryRevision},'phase23-local','two-person proof','${randomUUID()}')`);
      actorSql(roles.platform2,org1,`SELECT dispatch_phase22_local.approve_ownership_recovery('${org1}','${recovery}','${randomUUID()}')`);
      assert.equal(scalar(`SELECT count(*) FROM dispatch_phase22_local.recovery_approvals WHERE recovery_case_id='${recovery}'`),'2');
    });

    await t.test('revocation, membership, organization, profile, and platform boundaries fail on next request',()=>{
      assert.equal(actorSql(roles.viewer,org1,'SELECT count(*) FROM dispatch_phase21_local.operational_records'),'2');
      ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='SUSPENDED',suspended_at=now() WHERE organization_id='${org1}' AND user_id='10000000-0000-4000-8000-000000000002'`);
      assert.equal(actorSql(roles.viewer,org1,'SELECT count(*) FROM dispatch_phase21_local.operational_records'),'0');
      ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='ACTIVE',suspended_at=NULL WHERE organization_id='${org1}' AND user_id='10000000-0000-4000-8000-000000000002'`);
      ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='SUSPENDED' WHERE id='${org1}'`);
      assert.equal(actorSql(roles.viewer,org1,'SELECT count(*) FROM dispatch_phase21_local.operational_records'),'0');
      ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='ACTIVE' WHERE id='${org1}'`);
      ownerSql("UPDATE dispatch_phase23_auth.auth_users SET status='DISABLED' WHERE id='10000000-0000-4000-8000-000000000002'");
      assert.equal(actorSql(roles.viewer,org1,'SELECT count(*) FROM dispatch_phase21_local.operational_records'),'0');
      ownerSql("UPDATE dispatch_phase23_auth.auth_users SET status='ACTIVE' WHERE id='10000000-0000-4000-8000-000000000002'");
      ownerSql("UPDATE dispatch_phase21_local.profiles SET status='DISABLED' WHERE user_id='10000000-0000-4000-8000-000000000002'");
      assert.equal(actorSql(roles.viewer,org1,'SELECT count(*) FROM dispatch_phase21_local.operational_records'),'0');
      ownerSql("UPDATE dispatch_phase21_local.profiles SET status='ACTIVE' WHERE user_id='10000000-0000-4000-8000-000000000002'");
      const viewerFactor=scalar("SELECT factor_id FROM dispatch_phase23_auth.auth_session_amr WHERE session_id='a0000000-0000-4000-8000-000000000002' AND method='totp'");
      ownerSql(`UPDATE dispatch_phase23_auth.auth_factors SET status='DELETED',verified_at=NULL,deleted_at=now() WHERE id='${viewerFactor}'`);
      assert.equal(actorSql(roles.viewer,org1,'SELECT count(*) FROM dispatch_phase21_local.operational_records'),'0');
      const factor=scalar("SELECT factor_id FROM dispatch_phase23_auth.auth_session_amr WHERE session_id='a0000000-0000-4000-8000-000000000003' AND method='totp'");
      ownerSql(`UPDATE dispatch_phase23_auth.auth_factors SET status='REVOKED',revoked_at=now(),verified_at=NULL WHERE id='${factor}'`);
      actorSql(roles.operator,org1,`SELECT dispatch_phase22_local.create_operational_record('${org1}','CONDITION','OPEN','NORMAL','denied','x','${scope1}','{}','${randomUUID()}')`,{expectFailure:true});
      assert.equal(actorSql(roles.platform,org1,`SELECT dispatch_phase21_local.has_permission('${org1}','projection.publish')`),'f');
      assert.equal(actorSql(roles.platform,null,"SELECT dispatch_phase21_local.has_platform_permission('platform.capability.manage')"),'t');
      ownerSql("UPDATE dispatch_phase23_auth.auth_sessions SET revoked_at=now() WHERE id='a0000000-0000-4000-8000-000000000007'");
      assert.equal(actorSql(roles.platform,null,"SELECT dispatch_phase21_local.has_platform_permission('platform.capability.manage')"),'f');
      ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='REVOKED',revoked_at=now() WHERE organization_id='${org2}' AND user_id='${newUser}'`);
      assert.equal(actorSql(roles.newuser,org2,`SELECT dispatch_phase21_local.has_permission('${org2}','operations.create')`),'f');
      ownerSql(`INSERT INTO dispatch_phase23_auth.auth_security_events(user_id,event_type) VALUES ('${newUser}','PASSWORD_RECOVERY_REQUESTED')`);
      assert.equal(actorSql(roles.newuser,org2,`SELECT dispatch_phase21_local.has_permission('${org2}','operations.create')`),'f');
    });

    await t.test('security-definer surface, audit separation, teardown, and no remote settings are proven',()=>{
      assert.equal(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_phase23_auth' AND p.prosecdef AND NOT ('search_path=\"\"'=ANY(COALESCE(p.proconfig,'{}')))"),'0');
      assert.equal(scalar("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='dispatch_phase23_auth' AND c.relkind='r' AND has_table_privilege('dispatch_phase21_app',c.oid,'INSERT,UPDATE,DELETE')"),'0');
      assert.ok(Number(scalar("SELECT count(*) FROM dispatch_phase23_auth.auth_security_events WHERE event_type IN ('LOGIN','FACTOR_VERIFIED','PASSWORD_RECOVERY_REQUESTED')"))>0);
      assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE event_type::text LIKE '%LOGIN%' OR event_type::text LIKE '%FACTOR%'"),'0');
      ownerSql('UPDATE dispatch_phase23_auth.auth_security_events SET metadata=metadata',{expectFailure:true});
      ownerSql('DELETE FROM dispatch_phase23_auth.trusted_claim_bindings');
      for(const role of Object.values(roles)){ownerSql(`REVOKE dispatch_phase21_app FROM ${role}; DROP ROLE ${role}`);}
      fileSql(join(root,'tools','responder','phase23','rollback.sql'));
      ownerSql('DELETE FROM dispatch_phase22_local.session_bindings');
      fileSql(join(root,'tools','responder','phase22','rollback.sql'));
      fileSql(join(root,'tools','responder','phase21','rollback.sql'));
      assert.equal(scalar("SELECT count(*) FROM pg_namespace WHERE nspname LIKE 'dispatch_phase%_local' OR nspname='dispatch_phase23_auth'"),'0');
    });
  } finally { run(dropdb,['-h','127.0.0.1','-p',port,'-U',owner,'--if-exists','--force',db]); }
});
