import assert from 'node:assert/strict';
import { createHash, createHmac, createPrivateKey, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const root=resolve(import.meta.dirname,'..');
const api=required('P24_API_URL').replace(/\/+$/,'');
const anon=required('P24_ANON_KEY');
const service=required('P24_SERVICE_KEY');
const docker=required('P24_DOCKER');
const projectId=process.env.P24_PROJECT_ID??'gridly-dispatch-phase24-real-auth';
assert.match(projectId,/^gridly-dispatch-phase24-[0-9a-z-]+$/);
const dbContainer=`supabase_db_${projectId}`;
const authContainer=`supabase_auth_${projectId}`;
assert.equal(api,'http://127.0.0.1:54321');
const suffix=randomBytes(6).toString('hex');
const users=[];
const org1='20000000-0000-4000-8000-000000000001';
const org2='20000000-0000-4000-8000-000000000002';
const scope1='40000000-0000-4000-8000-000000000001';
const scope2='40000000-0000-4000-8000-000000000002';
const scope5='40000000-0000-4000-8000-000000000005';
const cap2='50000000-0000-4000-8000-000000000002';

function required(name){const v=process.env[name];assert.ok(v,`${name} required`);return v;}
function q(v){return `'${String(v).replaceAll("'","''")}'`;}
function runDocker(args,{input,expectFailure=false}={}){
  const r=spawnSync(docker,args,{cwd:root,input,encoding:'utf8',windowsHide:true,maxBuffer:20_000_000});
  if(expectFailure) assert.notEqual(r.status,0,`expected failure: ${r.stdout}`);
  else assert.equal(r.status,0,`${r.stderr}\n${r.stdout}`);
  return (r.stdout??'').trim();
}
function ownerSql(sql,{expectFailure=false}={}){
  return runDocker(['exec','-i',dbContainer,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',sql],{expectFailure});
}
function fileSql(path){
  return runDocker(['exec','-i',dbContainer,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:readFileSync(path,'utf8')});
}
function scalar(sql){return ownerSql(sql).split(/\r?\n/).filter(Boolean).at(-1)??'';}
async function http(path,{method='GET',token=anon,key=anon,body,accept=[200]}={}){
  const headers={apikey:key,Authorization:`Bearer ${token}`};
  if(body!==undefined) headers['Content-Type']='application/json';
  const response=await fetch(`${api}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error'});
  const raw=await response.text(); let data=null;
  if(raw){try{data=JSON.parse(raw);}catch{data=null;}}
  if(!accept.includes(response.status)) throw new Error(`local request failed: ${path} HTTP ${response.status}; body suppressed`);
  return {status:response.status,data};
}
async function rpc(name,token,body,accept=[200]){return http(`/rest/v1/rpc/${name}`,{method:'POST',token,body,accept});}
function claims(token){
  const parts=String(token).split('.'); assert.equal(parts.length,3);
  return JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
}
function amrMethods(token){return (claims(token).amr??[]).map(x=>typeof x==='string'?x:x.method).filter(Boolean);}
function base32Bytes(value){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits='';
  for(const ch of value.replace(/=+$/,'').toUpperCase()) {const n=alphabet.indexOf(ch);assert.ok(n>=0);bits+=n.toString(2).padStart(5,'0');}
  const out=[]; for(let i=0;i+8<=bits.length;i+=8) out.push(parseInt(bits.slice(i,i+8),2)); return Buffer.from(out);
}
function totp(secret,offset=0){
  const counter=Math.floor(Date.now()/1000/30)+offset; const b=Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
  const h=createHmac('sha1',base32Bytes(secret)).update(b).digest(); const o=h.at(-1)&15;
  return String((((h[o]&127)<<24)|((h[o+1]&255)<<16)|((h[o+2]&255)<<8)|(h[o+3]&255))%1_000_000).padStart(6,'0');
}
function signedEs256(header,payload){
  const h=Buffer.from(JSON.stringify(header)).toString('base64url'); const p=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const lines=runDocker(['inspect',authContainer,'--format','{{range .Config.Env}}{{println .}}{{end}}']).split(/\r?\n/);
  const encoded=lines.find(line=>line.startsWith('GOTRUE_JWT_KEYS=')); assert.ok(encoded,'local Auth signing key required');
  const keySet=JSON.parse(encoded.slice('GOTRUE_JWT_KEYS='.length));
  const candidates=Array.isArray(keySet)?keySet:(keySet.keys??[keySet]);
  const jwk=candidates.find(key=>key.kid===header.kid)??candidates[0]; assert.ok(jwk?.d,'local private signing key required');
  const signature=sign('sha256',Buffer.from(`${h}.${p}`),{key:createPrivateKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'});
  return `${h}.${p}.${signature.toString('base64url')}`;
}
async function signup(label){
  const email=`phase24-${label}-${suffix}@dispatch.invalid`; const password=randomBytes(24).toString('base64url');
  const r=await http('/auth/v1/signup',{method:'POST',body:{email,password}});
  assert.ok(r.data?.user?.id && r.data?.access_token && r.data?.refresh_token);
  assert.equal(r.data.user.email_confirmed_at!==null,true,'local auto-confirm must be explicit');
  const c=claims(r.data.access_token); assert.equal(c.sub,r.data.user.id); assert.equal(c.aal,'aal1');
  users.push(r.data.user.id); return {email,password,userId:r.data.user.id,...r.data};
}
async function enroll(user,label){
  const r=await http('/auth/v1/factors',{method:'POST',token:user.access_token,body:{factor_type:'totp',friendly_name:`p24-${label}-${suffix}`}});
  assert.ok(r.data?.id && r.data?.totp?.secret); return {id:r.data.id,secret:r.data.totp.secret};
}
async function challenge(token,factorId,accept=[200]){
  return http(`/auth/v1/factors/${factorId}/challenge`,{method:'POST',token,body:{},accept});
}
async function verify(user,factor,code=totp(factor.secret),accept=[200]){
  const ch=await challenge(user.access_token,factor.id);
  return http(`/auth/v1/factors/${factor.id}/verify`,{method:'POST',token:user.access_token,
    body:{challenge_id:ch.data.id,code},accept});
}
async function elevate(user,factor){
  const r=await verify(user,factor); assert.ok(r.data?.access_token && r.data?.refresh_token);
  const c=claims(r.data.access_token); assert.equal(c.sub,user.userId); assert.equal(c.aal,'aal2');
  assert.ok(amrMethods(r.data.access_token).includes('totp')); return {...user,...r.data,factor};
}
function digest(token){return createHash('sha256').update(token).digest('hex');}
function invitationToken(){return randomBytes(32).toString('base64url');}
function addProfile(user,name){ownerSql(`INSERT INTO dispatch_phase21_local.profiles(user_id,display_name,status) VALUES (${q(user.userId)},${q(name)},'ACTIVE')`);}
function addMembership(user,org,role){const id=randomUUID();ownerSql(`INSERT INTO dispatch_phase21_local.organization_memberships(id,organization_id,user_id,status,role_template,activated_at) VALUES (${q(id)},${q(org)},${q(user.userId)},'ACTIVE',${q(role)},now())`);return id;}
async function issueInvite(admin,org,email,role='VIEWER'){
  const token=invitationToken(); const revision=Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id=${q(org)}`));
  const r=await rpc('phase24_invite',admin.access_token,{p_organization_id:org,p_expected_revision:revision,p_email:email,
    p_role:role,p_token_digest_hex:digest(token),p_expires_at:new Date(Date.now()+86_400_000).toISOString(),p_idempotency_key:randomUUID()});
  return {id:r.data,token};
}

test('Phase 24 real local Supabase Auth integration',async(t)=>{
  let admin,wrong,existing,newUser,platform,concurrent,race,disabled;
  await t.test('loads neutral schema and real Auth bridge without production migrations',()=>{
    for(const p of ['tools/responder/phase21/apply.sql','tools/responder/phase21/fixtures.sql','tools/responder/phase22/apply.sql','tools/responder/phase24/bootstrap.sql','tools/responder/phase22/commands.sql','tools/responder/phase22/fixtures.sql','tools/responder/phase24/apply.sql']) fileSql(join(root,...p.split('/')));
    assert.equal(scalar("SELECT count(*) FROM pg_namespace WHERE nspname='dispatch_phase24_local'"),'1');
    assert.equal(scalar("SELECT count(*) FROM auth.users"),'0');
  });

  await t.test('real signup, verified identity, AAL1, enrollment, invalid challenge, same-user binding, and AAL2',async()=>{
    admin=await signup('admin'); wrong=await signup('wrong');
    const adminFactor=await enroll(admin,'admin'); const wrongFactor=await enroll(wrong,'wrong');
    assert.equal((await rpc('phase24_has_platform_permission',admin.access_token,{p_permission:'platform.capability.manage'})).data,false);
    const validCode=totp(adminFactor.secret);
    const invalidCode=String((Number(validCode)+1)%1_000_000).padStart(6,'0');
    const invalid=await verify(admin,adminFactor,invalidCode,[400,422]); assert.ok(invalid.status>=400);
    const cross=await challenge(wrong.access_token,adminFactor.id,[400,403,404]); assert.ok(cross.status>=400);
    admin=await elevate(admin,adminFactor); wrong=await elevate(wrong,wrongFactor);
    const c=claims(admin.access_token);
    assert.match(c.session_id,/^[0-9a-f-]{36}$/i); assert.equal(c.role,'authenticated'); assert.ok(c.exp>c.iat);
    assert.deepEqual(new Set(amrMethods(admin.access_token)),new Set(['password','totp']));
    assert.equal(scalar(`SELECT (s.user_id=${q(admin.userId)}::uuid AND s.aal='aal2' AND f.user_id=s.user_id AND f.status='verified')::text FROM auth.sessions s JOIN auth.mfa_factors f ON f.id=s.factor_id WHERE s.id=${q(c.session_id)}`),'true');
  });

  await t.test('real JWT signature, tampering, wrong-signature, and expiry enforcement',async()=>{
    const body={p_permission:'platform.capability.manage'};
    assert.equal((await rpc('phase24_has_platform_permission',admin.access_token,body)).status,200);
    const parts=admin.access_token.split('.'); const original=claims(admin.access_token);
    const tampered=`${parts[0]}.${Buffer.from(JSON.stringify({...original,sub:randomUUID()})).toString('base64url')}.${parts[2]}`;
    assert.ok((await rpc('phase24_has_platform_permission',tampered,body,[401])).status===401);
    const header=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8')); assert.equal(header.alg,'ES256');
    const wrongSigned=`${parts[0]}.${parts[1]}.${randomBytes(64).toString('base64url')}`;
    assert.equal((await rpc('phase24_has_platform_permission',wrongSigned,body,[401])).status,401);
    const now=Math.floor(Date.now()/1000); const expired=signedEs256(header,{...original,iat:now-120,exp:now-60});
    assert.equal((await rpc('phase24_has_platform_permission',expired,body,[401])).status,401);
  });

  await t.test('existing-user invitation binds real verified identity and replays deterministically',async()=>{
    addProfile(admin,'Real Admin'); addMembership(admin,org1,'ORGANIZATION_ADMIN'); addMembership(admin,org2,'ORGANIZATION_ADMIN');
    addProfile(wrong,'Real Wrong User');
    existing=await signup('existing'); const f=await enroll(existing,'existing'); existing=await elevate(existing,f); addProfile(existing,'Real Existing Invitee');
    const inv=await issueInvite(admin,org1,existing.email); const key=randomUUID();
    assert.ok((await rpc('phase24_accept_invitation',wrong.access_token,{p_organization_id:org1,p_invitation_id:inv.id,p_plaintext_token:inv.token,p_idempotency_key:randomUUID()},[400])).status===400);
    const body={p_organization_id:org1,p_invitation_id:inv.id,p_plaintext_token:inv.token,p_idempotency_key:key};
    const first=await rpc('phase24_accept_invitation',existing.access_token,body); const replay=await rpc('phase24_accept_invitation',existing.access_token,body);
    assert.equal(first.data,replay.data);
    assert.ok((await rpc('phase24_accept_invitation',existing.access_token,{...body,p_idempotency_key:randomUUID()},[400])).status===400);
    assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE target_id=${q(inv.id)} AND event_type='INVITATION_ACCEPTED'`),'1');
    assert.equal(scalar(`SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE event_payload::text LIKE ${q('%'+inv.token+'%')}`),'0');
    const expired=await issueInvite(admin,org1,wrong.email);
    ownerSql(`UPDATE dispatch_phase21_local.organization_invitations SET created_at=now()-interval '2 minutes',expires_at=now()-interval '1 minute' WHERE id=${q(expired.id)}`);
    assert.equal((await rpc('phase24_accept_invitation',wrong.access_token,{p_organization_id:org1,p_invitation_id:expired.id,p_plaintext_token:expired.token,p_idempotency_key:randomUUID()},[400])).status,400);
    await rpc('phase24_revoke_invitation',admin.access_token,{p_organization_id:org1,p_invitation_id:expired.id,p_idempotency_key:randomUUID()});
    const revoked=await issueInvite(admin,org1,wrong.email);
    await rpc('phase24_revoke_invitation',admin.access_token,{p_organization_id:org1,p_invitation_id:revoked.id,p_idempotency_key:randomUUID()});
    assert.equal((await rpc('phase24_accept_invitation',wrong.access_token,{p_organization_id:org1,p_invitation_id:revoked.id,p_plaintext_token:revoked.token,p_idempotency_key:randomUUID()},[400])).status,400);
  });

  await t.test('new-user invitation requires real verified TOTP, then creates independent multi-org roles',async()=>{
    const email=`phase24-new-${suffix}@dispatch.invalid`; const inv1=await issueInvite(admin,org1,email,'VIEWER');
    newUser=await signup('new'); assert.equal(newUser.email,email); addProfile(newUser,'Real New Invitee');
    assert.ok((await rpc('phase24_accept_invitation',newUser.access_token,{p_organization_id:org1,p_invitation_id:inv1.id,p_plaintext_token:inv1.token,p_idempotency_key:randomUUID()},[400])).status===400);
    const f=await enroll(newUser,'new');
    assert.equal((await rpc('phase24_has_permission',newUser.access_token,{p_organization_id:org1,p_permission:'operations.read'})).data,false);
    newUser=await elevate(newUser,f);
    await rpc('phase24_accept_invitation',newUser.access_token,{p_organization_id:org1,p_invitation_id:inv1.id,p_plaintext_token:inv1.token,p_idempotency_key:randomUUID()});
    const inv2=await issueInvite(admin,org2,email,'OPERATOR');
    await rpc('phase24_accept_invitation',newUser.access_token,{p_organization_id:org2,p_invitation_id:inv2.id,p_plaintext_token:inv2.token,p_idempotency_key:randomUUID()});
    assert.equal((await rpc('phase24_has_permission',newUser.access_token,{p_organization_id:org1,p_permission:'operations.create'})).data,false);
    assert.equal((await rpc('phase24_has_permission',newUser.access_token,{p_organization_id:org2,p_permission:'operations.create'})).data,true);
    const created=await rpc('phase24_create_record',newUser.access_token,{p_organization_id:org2,p_title:'real auth actor',p_scope_id:scope2,
      p_location:{user_id:wrong.userId,membership_id:randomUUID()},p_idempotency_key:randomUUID()});
    assert.equal(scalar(`SELECT actor_user_id::text FROM dispatch_phase21_local.dispatch_audit_events WHERE target_id=${q(created.data)} AND event_type='RECORD_CREATED'`),newUser.userId);
    newUser.recordId=created.data;
  });

  await t.test('real Auth invitation concurrency and accept-versus-revoke converge safely',async()=>{
    concurrent=await signup('concurrent'); concurrent=await elevate(concurrent,await enroll(concurrent,'concurrent')); addProfile(concurrent,'Real Concurrent Invitee');
    const inv=await issueInvite(admin,org1,concurrent.email); const key=randomUUID(); const body={p_organization_id:org1,p_invitation_id:inv.id,p_plaintext_token:inv.token,p_idempotency_key:key};
    const both=await Promise.all([rpc('phase24_accept_invitation',concurrent.access_token,body),rpc('phase24_accept_invitation',concurrent.access_token,body)]);
    assert.equal(both[0].data,both[1].data);
    race=await signup('race'); race=await elevate(race,await enroll(race,'race')); addProfile(race,'Real Race Invitee');
    const raceInv=await issueInvite(admin,org1,race.email);
    const outcomes=await Promise.all([
      rpc('phase24_accept_invitation',race.access_token,{p_organization_id:org1,p_invitation_id:raceInv.id,p_plaintext_token:raceInv.token,p_idempotency_key:randomUUID()},[200,400]),
      rpc('phase24_revoke_invitation',admin.access_token,{p_organization_id:org1,p_invitation_id:raceInv.id,p_idempotency_key:randomUUID()},[200,400])
    ]);
    assert.deepEqual(outcomes.map(x=>x.status).sort(),[200,400]);
    assert.ok(['ACCEPTED','REVOKED'].includes(scalar(`SELECT status::text FROM dispatch_phase21_local.organization_invitations WHERE id=${q(raceInv.id)}`)));
  });

  await t.test('live membership, organization, and capability state override a still-valid real JWT',async()=>{
    const membership=scalar(`SELECT id::text FROM dispatch_phase21_local.organization_memberships WHERE user_id=${q(newUser.userId)} AND organization_id=${q(org2)}`);
    ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='SUSPENDED',suspended_at=now() WHERE id=${q(membership)}`);
    assert.ok((await rpc('phase24_create_record',newUser.access_token,{p_organization_id:org2,p_title:'denied member',p_scope_id:scope2,p_location:{},p_idempotency_key:randomUUID()},[400])).status===400);
    ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='REVOKED',revoked_at=now() WHERE id=${q(membership)}`);
    assert.ok((await rpc('phase24_create_record',newUser.access_token,{p_organization_id:org2,p_title:'denied revoked member',p_scope_id:scope2,p_location:{},p_idempotency_key:randomUUID()},[400])).status===400);
    ownerSql(`UPDATE dispatch_phase21_local.organization_memberships SET status='ACTIVE',suspended_at=NULL,revoked_at=NULL WHERE id=${q(membership)}`);
    ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='SUSPENDED' WHERE id=${q(org2)}`);
    assert.ok((await rpc('phase24_create_record',newUser.access_token,{p_organization_id:org2,p_title:'denied org',p_scope_id:scope2,p_location:{},p_idempotency_key:randomUUID()},[400])).status===400);
    ownerSql(`UPDATE dispatch_phase21_local.organizations SET status='ACTIVE' WHERE id=${q(org2)}`);
    ownerSql(`UPDATE dispatch_phase21_local.capability_grants SET status='REVOKED',revoked_at=now() WHERE id=${q(cap2)}`);
    assert.ok((await rpc('phase24_submit_projection',newUser.access_token,{p_organization_id:org2,p_record_id:newUser.recordId,p_capability_id:cap2,p_idempotency_key:randomUUID()},[400])).status===400);
  });

  await t.test('real AAL2 platform admin remains separate from organization authority',async()=>{
    platform=await signup('platform'); platform=await elevate(platform,await enroll(platform,'platform')); addProfile(platform,'Real Platform Admin');
    ownerSql(`INSERT INTO dispatch_phase21_local.platform_admin_grants(user_id,permission_key,active,granted_by_user_id) SELECT ${q(platform.userId)},permission_key,true,${q(platform.userId)} FROM dispatch_phase21_local.permissions WHERE scope_class='PLATFORM'`);
    assert.equal((await rpc('phase24_has_platform_permission',platform.access_token,{p_permission:'platform.capability.manage'})).data,true);
    assert.equal((await rpc('phase24_has_permission',platform.access_token,{p_organization_id:org1,p_permission:'projection.publish'})).data,false);
    assert.ok((await rpc('phase24_create_record',platform.access_token,{p_organization_id:org1,p_title:'platform spoof',p_scope_id:scope1,p_location:{},p_idempotency_key:randomUUID()},[400])).status===400);
    const revision=Number(scalar(`SELECT governance_revision FROM dispatch_phase21_local.organizations WHERE id=${q(org1)}`));
    const granted=await rpc('phase24_grant_capability',platform.access_token,{p_organization_id:org1,p_expected_revision:revision,p_capability_key:'awareness.condition.publish',p_scope_id:scope5,p_idempotency_key:randomUUID()});
    assert.match(granted.data,/^[0-9a-f-]{36}$/i);
  });

  await t.test('real refresh rotation preserves user, session, AAL2, and exercises configured token reuse',async()=>{
    const before=claims(admin.access_token); const original=admin.refresh_token;
    const refreshed=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:original}});
    assert.equal(claims(refreshed.data.access_token).sub,admin.userId); assert.equal(claims(refreshed.data.access_token).session_id,before.session_id);
    assert.equal(claims(refreshed.data.access_token).aal,'aal2');
    assert.ok(amrMethods(refreshed.data.access_token).includes('totp'));
    const reuseInside=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:original},accept:[200,400]});
    assert.ok([200,400].includes(reuseInside.status));
    await new Promise(r=>setTimeout(r,11_000));
    const stale=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:original},accept:[200,400]});
    if(stale.status===200) assert.notEqual(stale.data.refresh_token,original);
    admin={...admin,...refreshed.data};
    const cross=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:wrong.access_token},accept:[400]}); assert.equal(cross.status,400);
  });

  await t.test('real factor removal leaves stale AAL2 JWT but live Dispatch factor check denies',async()=>{
    const staleToken=newUser.access_token; const staleClaims=claims(staleToken); assert.equal(staleClaims.aal,'aal2');
    const removed=await http(`/auth/v1/factors/${newUser.factor.id}`,{method:'DELETE',token:staleToken,accept:[200]}); assert.equal(removed.status,200);
    assert.equal(claims(staleToken).aal,'aal2');
    const authProbe=await http('/auth/v1/user',{token:staleToken,accept:[200,401,403]});
    assert.equal(authProbe.status,200);
    assert.equal((await rpc('phase24_has_permission',staleToken,{p_organization_id:org2,p_permission:'operations.create'})).data,false);
    const refreshed=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:newUser.refresh_token},accept:[200,400,401]});
    if(refreshed.status===200) assert.equal(claims(refreshed.data.access_token).aal,'aal1');
  });

  await t.test('real banned and deleted users fail live Dispatch checks with preexisting tokens',async()=>{
    disabled=await signup('disabled'); disabled=await elevate(disabled,await enroll(disabled,'disabled')); addProfile(disabled,'Real Disabled User'); addMembership(disabled,org1,'VIEWER');
    assert.equal((await rpc('phase24_has_permission',disabled.access_token,{p_organization_id:org1,p_permission:'operations.read'})).data,true);
    await http(`/auth/v1/admin/users/${disabled.userId}`,{method:'PUT',key:service,token:service,body:{ban_duration:'876000h'}});
    assert.equal((await rpc('phase24_has_permission',disabled.access_token,{p_organization_id:org1,p_permission:'operations.read'})).data,false);
    await http(`/auth/v1/admin/users/${disabled.userId}`,{method:'DELETE',key:service,token:service,accept:[200]});
    const probe=await http('/auth/v1/user',{token:disabled.access_token,accept:[401,403]}); assert.ok(probe.status>=400);
    assert.equal((await rpc('phase24_has_permission',disabled.access_token,{p_organization_id:org1,p_permission:'operations.read'},[200,401])).data??false,false);
  });

  await t.test('real logout removes live session while unexpired access token may remain cryptographically valid',async()=>{
    const c=claims(admin.access_token); assert.ok(c.exp>Math.floor(Date.now()/1000));
    await http('/auth/v1/logout?scope=local',{method:'POST',token:admin.access_token,accept:[204]});
    assert.equal(scalar(`SELECT count(*) FROM auth.sessions WHERE id=${q(c.session_id)}`),'0');
    const authProbe=await http('/auth/v1/user',{token:admin.access_token,accept:[200,401,403]}); assert.ok([200,401,403].includes(authProbe.status));
    const dispatchProbe=await rpc('phase24_has_permission',admin.access_token,{p_organization_id:org1,p_permission:'members.invite'},[200,401]);
    if(dispatchProbe.status===200) assert.equal(dispatchProbe.data,false);
    const refresh=await http('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:admin.refresh_token},accept:[400,401]}); assert.ok(refresh.status>=400);
  });

  await t.test('Auth events remain separate from Dispatch audit and no plaintext token is persisted',()=>{
    assert.ok(Number(scalar('SELECT count(*) FROM auth.audit_log_entries'))>0);
    assert.equal(scalar("SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE event_type::text LIKE '%LOGIN%' OR event_type::text LIKE '%FACTOR%' OR event_type::text LIKE '%REFRESH%'"),'0');
    assert.ok(Number(scalar("SELECT count(*) FROM dispatch_phase21_local.dispatch_audit_events WHERE event_type='INVITATION_ACCEPTED' AND actor_user_id IN (SELECT id FROM auth.users)"))>=4);
    assert.equal(scalar("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('dispatch_phase22_local','dispatch_phase24_local') AND p.prosecdef AND NOT ('search_path=\"\"'=ANY(COALESCE(p.proconfig,'{}')))"),'0');
  });
});
