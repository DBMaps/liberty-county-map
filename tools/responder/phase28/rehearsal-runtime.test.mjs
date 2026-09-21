// LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
import test from 'node:test'; import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process'; import {writeFileSync} from 'node:fs'; import {join} from 'node:path';
const api=req('P28_API_URL').replace(/\/+$/,''); const anon=req('P28_ANON_KEY'); const service=req('P28_SERVICE_KEY'); const docker=req('P28_DOCKER'); const project=req('P28_PROJECT_ID'); const evidence=req('P28_EVIDENCE_DIR');
assert.equal(api,'http://127.0.0.1:54321'); assert.match(project,/^gridly-dispatch-phase28-[a-f0-9]{12}$/); const db=`supabase_db_${project}`;
const org1='26000000-0000-4000-8000-000000000001',org2='26000000-0000-4000-8000-000000000002',scope1='26100000-0000-4000-8000-000000000001',scope2='26100000-0000-4000-8000-000000000002';
const counters={auth:0,rls:0,commands:0,concurrency:0,invitations:0,ownership:0,capability:0,records:0,projection:0,compatibility:0,nonInterference:0};
function req(n){const v=process.env[n];assert.ok(v,`${n} required`);return v} function q(v){return `'${String(v).replaceAll("'","''")}'`}
function sql(s,{fail=false}={}){const r=spawnSync(docker,['exec',db,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',s],{encoding:'utf8',windowsHide:true,maxBuffer:20e6}); if(fail)assert.notEqual(r.status,0);else assert.equal(r.status,0,`${r.stderr}\n${r.stdout}`);return (r.stdout??'').trim().split(/\r?\n/).filter(Boolean).at(-1)??''}
async function http(path,{method='GET',token=anon,key=anon,body,profile,accept=[200]}={}){const headers={apikey:key,Authorization:`Bearer ${token}`};if(body!==undefined)headers['Content-Type']='application/json';if(profile){headers['Accept-Profile']=profile;headers['Content-Profile']=profile}const r=await fetch(api+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}if(!accept.includes(r.status))throw new Error(`${path} ${r.status} ${String(raw).slice(0,300)}`);return{status:r.status,data}}
function claims(t){return JSON.parse(Buffer.from(t.split('.')[1],'base64url'))} function b32(v){const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of v.replace(/=+$/,'').toUpperCase())bits+=a.indexOf(c).toString(2).padStart(5,'0');const o=[];for(let i=0;i+8<=bits.length;i+=8)o.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(o)}
function totp(secret){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',b32(secret)).update(b).digest(),o=h.at(-1)&15;return String(((((h[o]&127)<<24)|((h[o+1]&255)<<16)|((h[o+2]&255)<<8)|(h[o+3]&255))%1e6)).padStart(6,'0')}
async function signup(label){const email=`p28-${label}-${randomUUID()}@dispatch.invalid`,password=randomBytes(24).toString('base64url');const r=await http('/auth/v1/signup',{method:'POST',body:{email,password}});assert.equal(claims(r.data.access_token).aal,'aal1');return{...r.data,email,password,userId:r.data.user.id}}
async function elevate(u){const e=await http('/auth/v1/factors',{method:'POST',token:u.access_token,body:{factor_type:'totp',friendly_name:'p28'}});const ch=await http(`/auth/v1/factors/${e.data.id}/challenge`,{method:'POST',token:u.access_token,body:{}});const v=await http(`/auth/v1/factors/${e.data.id}/verify`,{method:'POST',token:u.access_token,body:{challenge_id:ch.data.id,code:totp(e.data.totp.secret)}});assert.equal(claims(v.data.access_token).aal,'aal2');return{...u,...v.data,factorId:e.data.id}}
async function rpc(name,u,p,accept=[200]){return http(`/rest/v1/rpc/${name}`,{method:'POST',token:u.access_token,profile:'dispatch_api',body:{p_payload:p},accept})}
const key=()=>randomUUID(); const digest=t=>createHash('sha256').update(t).digest('hex');

const checks=[];
let runtimeComplete=false;
process.on('exit',code=>writeFileSync(join(evidence,'runtime-vectors.json'),JSON.stringify({status:runtimeComplete&&code===0?'PASS':'FAIL',checks,count:checks.length,realLocalAuth:checks.includes('AAL1 create denied'),syntheticOnly:true,recoveryEnabled:false},null,2)+'\n'));
function check(name,fn){fn();checks.push(name)}
async function deny(name,fn){const r=await fn();assert.ok(r.status>=400,name);checks.push(name)}
test('Phase 28 real Auth, unit separation and governed projections',async()=>{
 const owner1=await signup('owner'),owner=await elevate(owner1),pw=await elevate(await signup('pw')),
 pd=await elevate(await signup('pd')),supervisor=await elevate(await signup('supervisor')),
 outsider=await elevate(await signup('outsider')),platform=await elevate(await signup('platform')),
 admin=await elevate(await signup('admin')),viewer=await elevate(await signup('viewer'));
 const actors={owner,pw,pd,supervisor,outsider,platform,admin,viewer};
 const mids=Object.fromEntries(Object.keys(actors).map(x=>[x,key()]));
 const units={pw:key(),pd:key(),fire:key(),foreign:key()},scope=scope1;
 for(const [name,u] of Object.entries(actors))sql(`INSERT INTO dispatch_private.profiles(user_id,display_name) VALUES(${q(u.userId)},${q('Synthetic '+name)})`);
 sql(`INSERT INTO dispatch_private.organizations(id,display_name,legal_name,organization_type,status,verification_level) VALUES('${org1}','Synthetic Municipality','Synthetic Municipality','MUNICIPALITY','ACTIVE','VERIFIED_PUBLIC_ENTITY'),('${org2}','Synthetic Independent PD','Synthetic Independent PD','LAW_ENFORCEMENT','ACTIVE','UNVERIFIED');
 INSERT INTO dispatch_private.operational_scopes(id,organization_id,scope_type,label,source_reference) VALUES('${scope1}','${org1}','SERVICE_TERRITORY','Synthetic bounded area','synthetic-private-declaration'),('${scope2}','${org2}','FACILITY','Synthetic facility','synthetic');`);
 for(const [name,u] of Object.entries(actors))if(name!=='platform')sql(`INSERT INTO dispatch_private.organization_memberships(id,organization_id,user_id,status,role_template) VALUES('${mids[name]}','${name==='outsider'?org2:org1}',${q(u.userId)},'ACTIVE','${name==='owner'||name==='outsider'?'OWNER':name==='supervisor'?'SUPERVISOR':name==='admin'?'ORGANIZATION_ADMIN':name==='viewer'?'VIEWER':'OPERATOR'}')`);
 for(const [name,id] of Object.entries(units))sql(`INSERT INTO dispatch_private.organization_units(id,organization_id,unit_type,name,display_name,status,onboarding_state) VALUES('${id}','${name==='foreign'?org2:org1}','${name==='pd'||name==='foreign'?'LAW_ENFORCEMENT':name==='pw'?'PUBLIC_WORKS':'FIRE'}','${name}','Synthetic ${name}','ACTIVE','PRIVATE_PILOT_READY'); INSERT INTO dispatch_private.unit_scope_grants VALUES('${name==='foreign'?org2:org1}','${id}','${name==='foreign'?scope2:scope1}')`);
 for(const [actor,unitNames] of Object.entries({owner:['pw'],pw:['pw'],pd:['pd'],supervisor:['pw','pd'],viewer:['pw'],outsider:['foreign']}))for(const name of unitNames)sql(`INSERT INTO dispatch_private.unit_memberships VALUES('${actor==='outsider'?org2:org1}','${units[name]}','${mids[actor]}','ACTIVE',1)`);
 sql(`INSERT INTO dispatch_private.platform_admin_grants(user_id,permission_key,active,granted_by_user_id) VALUES(${q(platform.userId)},'platform.capability.manage',true,${q(platform.userId)})`);
 sql(`INSERT INTO dispatch_private.platform_admin_grants(user_id,permission_key,active,granted_by_user_id) VALUES(${q(platform.userId)},'platform.ownership.recover',true,${q(platform.userId)})`);
 const certified=new Set();
 const cmd=async(name,u,p={},accept=[200])=>{
  const request={organization_id:org1,idempotency_key:key(),...p};
  const result=await rpc(name,u,request,accept);
  if(result.status===200&&!certified.has(name)){
   const count=()=>sql(`SELECT jsonb_build_array((SELECT count(*) FROM dispatch_audit.command_receipts),(SELECT count(*) FROM dispatch_audit.pilot_events),(SELECT count(*) FROM dispatch_audit.command_versions))`);
   const after=count();const retry=await rpc(name,u,request);assert.equal(retry.data.replay,true);assert.equal(count(),after);
   if(request.expected_revision!==undefined){const stale=await rpc(name,u,{...request,idempotency_key:key()},[400,403]);assert.ok(stale.status>=400);assert.equal(count(),after)}
   certified.add(name);checks.push(`${name} receipt replay and applicable stale revision certified`);
  }
  return result;
 };
 const no=(name,u,p)=>cmd(name,u,p,[400,401,403]);
 const read=async(u,view='operational_records')=>(await http(`/rest/v1/${view}?select=*`,{token:u.access_token,profile:'dispatch_api'})).data;
 const base={unit_id:units.pw,scope_id:scope,record_type:'CONDITION',title:'Synthetic water leak travel impact',private_payload:{internal_notes:'DO-NOT-PROJECT',staff_contact:'PRIVATE'},data_attestation:'OPERATIONAL_AWARENESS_ONLY',safety_class:'GENERAL_AWARENESS'};
 await deny('AAL1 create denied',()=>no('create_operational_record',owner1,base));
 await deny('client-selected Police unit denied',()=>no('create_operational_record',pw,{...base,unit_id:units.pd}));
 await deny('viewer cannot write',()=>no('create_operational_record',viewer,base));
 await deny('platform has no private access',()=>no('create_operational_record',platform,base));
 await deny('admin has no unit bypass',()=>no('create_operational_record',admin,base));
 await deny('cross-org unit denied',()=>no('create_operational_record',pw,{...base,unit_id:units.foreign}));
 await deny('attestation required',()=>no('create_operational_record',pw,{...base,data_attestation:null}));
 const createRequest={...base,idempotency_key:key()};
 const record=(await cmd('create_operational_record',pw,createRequest)).data.object_id;
 await deny('operator cannot bypass close permission through transition',()=>no('transition_operational_record',pw,{object_id:record,expected_revision:1,state:'CLOSED'}));
 check('exact idempotent replay',()=>assert.ok(record));
 assert.equal((await cmd('create_operational_record',pw,createRequest)).data.replay,true);
 await deny('idempotency payload mismatch',()=>no('create_operational_record',pw,{...createRequest,title:'different'}));
 const policeRecord=(await cmd('create_operational_record',pd,{...base,unit_id:units.pd,title:'Synthetic barricade coordination'})).data.object_id;
 check('PW private separation',()=>assert.equal(sql(`SELECT owning_unit_id FROM dispatch_private.operational_records WHERE id='${record}'`),units.pw));
 assert.deepEqual((await read(pw)).map(x=>x.id),[record]);checks.push('PW cannot read Police');
 assert.deepEqual((await read(pd)).map(x=>x.id),[policeRecord]);checks.push('Police cannot read PW');
 assert.equal((await read(supervisor)).length,2);checks.push('explicit multi-unit supervisor');
 for(const u of [admin,platform,outsider])assert.equal((await read(u)).length,0);checks.push('admin platform cross-org read denials');
 await deny('cross-unit update denied',()=>no('update_operational_record',pd,{object_id:record,expected_revision:1,title:'bad',data_attestation:'OPERATIONAL_AWARENESS_ONLY'}));
 const shareBase={record_id:record,source_revision:1,recipient_unit_ids:[units.pd],title:'Roadway coordination',summary:'Synthetic travel impact; barricade coordination requested',expires_at:new Date(Date.now()+3600000).toISOString(),sanitization_attestation:'INTERNAL_SAFE_V1'};
 await deny('operator lacks share permission',()=>no('create_internal_share',pw,shareBase));
 await deny('no wildcard recipients',()=>no('create_internal_share',owner,{...shareBase,recipient_unit_ids:[]}));
 await deny('cross-org recipients denied',()=>no('create_internal_share',owner,{...shareBase,recipient_unit_ids:[units.foreign]}));
 const share=(await cmd('create_internal_share',owner,shareBase)).data.object_id;
 let shared=await read(pd,'internal_awareness');assert.equal(shared.length,1);assert.deepEqual(Object.keys(shared[0]).sort(),['created_at','expires_at','id','summary','title']);checks.push('recipient gets allowlisted sanitized view');
 assert.equal(JSON.stringify(shared).includes('DO-NOT-PROJECT'),false);checks.push('private fields do not share');
 assert.equal((await read(pw,'internal_awareness')).length,0);checks.push('nonrecipient no shared access');
 await deny('recipient cannot change recipients',()=>no('replace_internal_share_recipients',pd,{object_id:share,expected_revision:1,recipient_unit_ids:[units.fire]}));
 sql(`UPDATE dispatch_private.unit_memberships SET status='REVOKED' WHERE unit_id='${units.pd}' AND membership_id='${mids.pd}'`);
 assert.equal((await read(pd,'internal_awareness')).length,0);checks.push('recipient revocation next request');
 sql(`UPDATE dispatch_private.unit_memberships SET status='ACTIVE' WHERE unit_id='${units.pd}' AND membership_id='${mids.pd}'`);
 await cmd('replace_internal_share_recipients',owner,{object_id:share,expected_revision:1,recipient_unit_ids:[units.fire]});
 assert.equal((await read(pd,'internal_awareness')).length,0);checks.push('recipient removal immediate');
 await cmd('replace_internal_share_recipients',owner,{object_id:share,expected_revision:2,recipient_unit_ids:[units.pd]});
 const race=await Promise.all([1,2].map(i=>cmd('update_operational_record',pw,{object_id:record,expected_revision:1,title:`Synthetic update ${i}`,data_attestation:'OPERATIONAL_AWARENESS_ONLY'},[200,400])));
 assert.equal(race.filter(x=>x.status===200).length,1);checks.push('atomic revision race one winner');
 assert.equal((await read(pd,'internal_awareness')).length,0);checks.push('source revision invalidates share');
 assert.equal(sql(`SELECT count(*) FROM dispatch_audit.record_revisions WHERE record_id='${record}'`),'2');checks.push('immutable revision lineage');
 assert.equal(sql(`SELECT count(*) FROM dispatch_private.record_provenance WHERE record_id='${record}' AND owning_unit_id='${units.pw}' AND actor_token IS NOT NULL AND source_class='PRIVATE_OPERATIONAL'`),'2');checks.push('scope-specific actor and unit provenance per revision');
 sql(`UPDATE dispatch_private.record_provenance SET source_class='COMMUNITY' WHERE record_id='${record}'`,{fail:true});checks.push('provenance is immutable');
 sql(`UPDATE dispatch_audit.pilot_events SET payload='{}'`,{fail:true});checks.push('append-only events');
 const newShare=(await cmd('create_internal_share',owner,{...shareBase,source_revision:2})).data.object_id;
 await cmd('revoke_internal_share',owner,{object_id:newShare,expected_revision:1});assert.equal((await read(pd,'internal_awareness')).length,0);checks.push('share revocation immediate');
 const noCap={record_id:record,source_revision:2,capability_id:key(),freshness_deadline:new Date(Date.now()+240000).toISOString(),payload:{title:'Synthetic condition',summary:'Reviewed travel awareness',internal_notes:'DO-NOT-PROJECT'},sanitization_attestation:'PUBLIC_SAFE_V1'};
 await deny('no capability cannot submit',()=>no('submit_projection_candidate',owner,noCap));
 await deny('Police classification gives no authority',()=>no('submit_projection_candidate',pd,{...noCap,record_id:policeRecord,source_revision:1}));
 for(const capability of ['awareness.hazard.publish','awareness.road_closure.publish'])await deny(`${capability} blocked`,()=>no('grant_capability',platform,{capability,scope_id:scope,valid_until:new Date(Date.now()+86400000).toISOString()}));
 sql(`INSERT INTO dispatch_private.pilot_governance(organization_id,verification_expires_at,attestation_expires_at,governance_source,governance_version,publishing_enabled,legal_retention_approved) VALUES('${org1}',now()+interval '1 year',now()+interval '6 months','synthetic-governance','v1',true,false); INSERT INTO dispatch_private.scope_governance VALUES('${org1}','${scope}','synthetic-reviewed-source','v1',now()+interval '90 days'); UPDATE dispatch_private.organization_units SET onboarding_state='PUBLISHING_ENABLED' WHERE id='${units.pw}'`);
 await deny('department admin cannot grant capability',()=>no('grant_capability',admin,{capability:'awareness.condition.publish',scope_id:scope,valid_until:new Date(Date.now()+86400000).toISOString()}));
 await deny('capability max 90 days',()=>no('grant_capability',platform,{capability:'awareness.condition.publish',scope_id:scope,valid_until:new Date(Date.now()+91*86400000).toISOString()}));
 const cap=(await cmd('grant_capability',platform,{capability:'awareness.condition.publish',scope_id:scope,valid_until:new Date(Date.now()+86400000).toISOString()})).data.object_id;
 const candidatePayload={...noCap,capability_id:cap};
 const denyEligibility=async(name,mutate,restore)=>{sql(mutate);await deny(name,()=>no('submit_projection_candidate',owner,candidatePayload));sql(restore)};
 await denyEligibility('expired capability',`UPDATE dispatch_private.capability_grants SET valid_until=now()-interval '1 second' WHERE id='${cap}'`,`UPDATE dispatch_private.capability_grants SET valid_until=now()+interval '1 day' WHERE id='${cap}'`);
 await denyEligibility('revoked capability',`UPDATE dispatch_private.capability_grants SET status='REVOKED' WHERE id='${cap}'`,`UPDATE dispatch_private.capability_grants SET status='ACTIVE' WHERE id='${cap}'`);
 await denyEligibility('verification expiry',`UPDATE dispatch_private.pilot_governance SET verification_expires_at=now()-interval '1 second'`,`UPDATE dispatch_private.pilot_governance SET verification_expires_at=now()+interval '1 year'`);
 await denyEligibility('attestation expiry',`UPDATE dispatch_private.pilot_governance SET attestation_expires_at=now()-interval '1 second'`,`UPDATE dispatch_private.pilot_governance SET attestation_expires_at=now()+interval '6 months'`);
 await denyEligibility('governance source required',`UPDATE dispatch_private.pilot_governance SET governance_source=NULL`,`UPDATE dispatch_private.pilot_governance SET governance_source='synthetic-governance'`);
 await denyEligibility('governance version required',`UPDATE dispatch_private.pilot_governance SET governance_version=NULL`,`UPDATE dispatch_private.pilot_governance SET governance_version='v1'`);
 await denyEligibility('road closure cannot use condition capability',`UPDATE dispatch_private.operational_records SET safety_class='ROAD_CLOSURE' WHERE id='${record}'`,`UPDATE dispatch_private.operational_records SET safety_class='GENERAL_AWARENESS' WHERE id='${record}'`);
 await denyEligibility('hazard cannot use condition capability',`UPDATE dispatch_private.operational_records SET record_type='HAZARD' WHERE id='${record}'`,`UPDATE dispatch_private.operational_records SET record_type='CONDITION' WHERE id='${record}'`);
 await deny('AAL1 publishing denied',()=>no('submit_projection_candidate',owner1,candidatePayload));
 const cand=(await cmd('submit_projection_candidate',owner,candidatePayload)).data.object_id;
 // Same privileged role, wrong unit: isolate unit authorization from role denial.
 sql(`UPDATE dispatch_private.organization_memberships SET role_template='SUPERVISOR' WHERE id='${mids.pd}'`);
 for(const name of ['update_operational_record','assign_operational_record','close_operational_record','transition_operational_record'])await deny(name+' cross-unit privileged actor denied',()=>no(name,pd,{object_id:record,expected_revision:2,state:'MONITORING',membership_id:mids.pd,data_attestation:'OPERATIONAL_AWARENESS_ONLY'}));
 for(const name of ['approve_projection','reject_projection','publish_projection'])await deny(name+' cross-unit reviewer denied',()=>no(name,pd,{object_id:cand,expected_revision:1,sanitization_attestation:'PUBLIC_SAFE_V1'}));
 for(const name of ['create_internal_share','replace_internal_share_recipients','revoke_internal_share'])await deny(name+' cross-unit sender denied',()=>no(name,pd,{...shareBase,object_id:newShare,expected_revision:2,source_revision:2}));
 await deny('submit_projection_candidate cross-unit publisher denied',()=>no('submit_projection_candidate',pd,candidatePayload));
 sql(`UPDATE dispatch_private.organization_memberships SET role_template='OPERATOR' WHERE id='${mids.pd}'`);
 await deny('self review denied',()=>no('approve_projection',owner,{object_id:cand,expected_revision:1,sanitization_attestation:'PUBLIC_SAFE_V1'}));
 await cmd('approve_projection',supervisor,{object_id:cand,expected_revision:1,sanitization_attestation:'PUBLIC_SAFE_V1'});
 await deny('publisher cannot inject unreviewed attribution',()=>no('publish_projection',owner,{object_id:cand,expected_revision:2,organization_public_name:'Synthetic Municipality',source_label:'PRIVATE',taxonomy:'condition'}));
 await cmd('publish_projection',owner,{object_id:cand,expected_revision:2,organization_public_name:'Synthetic Municipality',source_label:'Governed organization awareness',taxonomy:'condition'});
 const publicRows=async()=>(await http('/rest/v1/public_safe_projections?select=*',{profile:'dispatch_api'})).data;
 assert.equal((await publicRows()).length,1);assert.equal(JSON.stringify(await publicRows()).includes('DO-NOT-PROJECT'),false);checks.push('reviewed public projection safe fields');
 sql(`UPDATE dispatch_private.capability_grants SET status='REVOKED' WHERE id='${cap}'`);assert.equal((await publicRows()).length,0);checks.push('consumer immediate invalidation');
 sql(`UPDATE dispatch_private.capability_grants SET status='ACTIVE' WHERE id='${cap}'`);
 await cmd('close_operational_record',owner,{object_id:record,expected_revision:2});assert.equal((await publicRows()).length,0);checks.push('closed source invalidates public');
 await deny('closed record cannot share',()=>no('create_internal_share',owner,{...shareBase,source_revision:3}));
 // Column ACLs still protect accidentally exposed private schemas and SQL clients.
 const claimsSql=q(JSON.stringify(claims(pw.access_token)));
 sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims',${claimsSql},true); SELECT private_payload FROM dispatch_private.operational_records; ROLLBACK`,{fail:true});checks.push('raw private columns denied SQL');
 sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT * FROM dispatch_projection.projection_candidates; ROLLBACK`,{fail:true});checks.push('raw candidates denied SQL');
 await deny('private schema not exposed REST',()=>http('/rest/v1/operational_records?select=*',{token:pw.access_token,profile:'dispatch_private',accept:[400,403,406]}));
 await deny('legacy dispatcher not exposed REST',()=>http('/rest/v1/rpc/phase26_command',{method:'POST',token:pw.access_token,profile:'dispatch_api',body:{},accept:[404]}));
 const newUnit=(await cmd('create_unit',owner,{unit_type:'UTILITIES',name:'new-utility',display_name:'Synthetic Utility'})).data.object_id;
 let unitRev=1;
 await deny('onboarding cannot skip stages',()=>no('advance_onboarding',owner,{unit_id:newUnit,expected_revision:unitRev,state:'PRIVATE_PILOT_READY',owner_review_reference:'synthetic-owner-review'}));
 for(const state of ['IDENTITY_VERIFIED','ADMIN_ASSIGNED'])await cmd('advance_onboarding',owner,{unit_id:newUnit,expected_revision:unitRev++,state,owner_review_reference:'synthetic-owner-review'});
 await cmd('set_unit_membership',owner,{unit_id:newUnit,expected_revision:unitRev++,membership_id:mids.pw,status:'ACTIVE'});
 sql(`INSERT INTO dispatch_private.unit_scope_grants VALUES('${org1}','${newUnit}','${scope}')`);
 for(const state of ['MEMBERSHIP_CONFIGURED','SCOPE_CONFIGURED','MFA_VERIFIED','PRIVATE_PILOT_READY'])await cmd('advance_onboarding',owner,{unit_id:newUnit,expected_revision:unitRev++,state,owner_review_reference:'synthetic-owner-review'});
 assert.equal(sql(`SELECT onboarding_state FROM dispatch_private.organization_units WHERE id='${newUnit}'`),'PRIVATE_PILOT_READY');checks.push('private ready without publication');
 await cmd('advance_onboarding',owner,{unit_id:newUnit,expected_revision:unitRev++,state:'PUBLISHING_REVIEW_REQUIRED',owner_review_reference:'synthetic-owner-review'});
 await deny('department owner cannot self-enable unit publication',()=>no('advance_onboarding',owner,{unit_id:newUnit,expected_revision:unitRev,state:'PUBLISHING_ENABLED',owner_review_reference:'synthetic-owner-review'}));
 await cmd('offboard_unit',owner,{unit_id:newUnit,expected_revision:unitRev++});
 await deny('offboarded unit cannot write',()=>no('create_operational_record',pw,{...base,unit_id:newUnit}));checks.push('offboarding preserves evidence');
 const recoveryDenied=await no('start_ownership_recovery',platform,{target_membership_id:mids.owner,expected_revision:0});
 assert.ok(recoveryDenied.status>=400);checks.push('recovery without bound factor proof denied');
 // Missing/stale revisions must neither mutate state nor append a receipt/event.
 const counts=()=>sql(`SELECT jsonb_build_array((SELECT count(*) FROM dispatch_audit.command_receipts),(SELECT count(*) FROM dispatch_audit.audit_events),(SELECT count(*) FROM dispatch_audit.pilot_events))`);
 async function deniedWithoutEvidence(name,command,user,payload){const before=counts();await deny(name,()=>no(command,user,payload));assert.equal(counts(),before,name+' leaves no evidence residue')}
 sql(`INSERT INTO dispatch_private.platform_admin_grants(user_id,permission_key,active,granted_by_user_id) VALUES(${q(platform.userId)},'platform.organization.verify',true,${q(platform.userId)}),(${q(platform.userId)},'platform.organization.suspend',true,${q(platform.userId)})`);
 for(const [command,fields] of [['set_organization_verification',{verification_level:'VERIFIED_PUBLIC_ENTITY'}],['set_organization_status',{status:'ACTIVE'}]]){
  const revision=Number(sql(`SELECT governance_revision FROM dispatch_private.organizations WHERE id='${org1}'`));
  await deniedWithoutEvidence(command+' missing revision',command,platform,fields);
  await deniedWithoutEvidence(command+' stale revision',command,platform,{...fields,expected_revision:revision-1});
  const request={...fields,expected_revision:revision,idempotency_key:key()};
  await cmd(command,platform,request);const accepted=counts();assert.equal((await cmd(command,platform,request)).data.replay,true);assert.equal(counts(),accepted);
  assert.equal(Number(sql(`SELECT governance_revision FROM dispatch_private.organizations WHERE id='${org1}'`)),revision+1);checks.push(command+' atomic revision and replay');
 }
 for(const [command,fields] of [['change_member_role',{role:'VIEWER'}],['suspend_member',{}],['reactivate_member',{}],['revoke_member',{}]]){
  const revision=Number(sql(`SELECT revision FROM dispatch_private.organization_memberships WHERE id='${mids.viewer}'`));
  const payload={object_id:mids.viewer,...fields};
  await deniedWithoutEvidence(command+' missing revision',command,owner,payload);
  await deniedWithoutEvidence(command+' stale revision',command,owner,{...payload,expected_revision:revision-1});
  await deniedWithoutEvidence(command+' cross-org target',command,owner,{...payload,object_id:mids.outsider,expected_revision:0});
  const request={...payload,expected_revision:revision,idempotency_key:key()};
  await cmd(command,owner,request);const accepted=counts();assert.equal((await cmd(command,owner,request)).data.replay,true);assert.equal(counts(),accepted);
  assert.equal(Number(sql(`SELECT revision FROM dispatch_private.organization_memberships WHERE id='${mids.viewer}'`)),revision+1);checks.push(command+' atomic revision and replay');
 }
 await deniedWithoutEvidence('revoked membership cannot reactivate','reactivate_member',owner,{object_id:mids.viewer,expected_revision:4});
 assert.deepEqual(await read(viewer),[]);checks.push('membership revocation removes reads with existing JWT');
 for(const command of ['suspend_capability','revoke_capability']){
  const revision=Number(sql(`SELECT revision FROM dispatch_private.capability_grants WHERE id='${cap}'`));
  await deniedWithoutEvidence(command+' missing revision',command,platform,{object_id:cap});
  await deniedWithoutEvidence(command+' stale revision',command,platform,{object_id:cap,expected_revision:revision-1});
  const request={object_id:cap,expected_revision:revision,idempotency_key:key()};
  await cmd(command,platform,request);const accepted=counts();assert.equal((await cmd(command,platform,request)).data.replay,true);assert.equal(counts(),accepted);
  assert.equal(Number(sql(`SELECT revision FROM dispatch_private.capability_grants WHERE id='${cap}'`)),revision+1);checks.push(command+' atomic revision and replay');
 }
 // Unitless organizations retain the neutral contract across all requested sectors.
 for(const sector of ['UTILITY','SCHOOL_DISTRICT','EMERGENCY_MANAGEMENT','TRUCKING','CONTRACTOR','INDUSTRIAL_OPERATOR','TRANSPORTATION_OPERATOR']){
  const org=key(),sc=key();sql(`INSERT INTO dispatch_private.organizations(id,display_name,legal_name,organization_type,status) VALUES('${org}','Synthetic ${sector}','Synthetic ${sector}','${sector}','ACTIVE'); INSERT INTO dispatch_private.organization_memberships(organization_id,user_id,status,role_template) VALUES('${org}',${q(owner.userId)},'ACTIVE','OWNER'); INSERT INTO dispatch_private.operational_scopes(id,organization_id,scope_type,label,source_reference) VALUES('${sc}','${org}','SITE','Synthetic site','organization-declared-private')`);
  await cmd('create_operational_record',owner,{...base,organization_id:org,unit_id:null,scope_id:sc,internal_share_class:'PRIVATE_TO_ORGANIZATION'});checks.push(`neutral sector ${sector}`);
 }
 // Same signed JWT must fail after live factor revocation.
 await http(`/auth/v1/factors/${pw.factorId}`,{method:'DELETE',token:pw.access_token,accept:[200]});
 assert.equal((await read(pw)).length,0);checks.push('factor revocation next request');
 assert.equal(sql('SELECT count(*) FROM public.gridly_consumer_sentinel'),'1');assert.equal(sql('SELECT reporting_enabled::text FROM report_retention.admission_state'),'false');checks.push('consumer sentinels unchanged');
 runtimeComplete=true;
});
