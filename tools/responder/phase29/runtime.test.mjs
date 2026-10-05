// LOCAL DISPOSABLE REHEARSAL ONLY - NOT AUTHORIZED FOR PRODUCTION EXECUTION
import test from 'node:test'; import assert from 'node:assert/strict';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process'; import {readFileSync,writeFileSync} from 'node:fs'; import {join} from 'node:path';
const api=req('P29_API_URL').replace(/\/+$/,''); const anon=req('P29_ANON_KEY'); const service=req('P29_SERVICE_KEY'); const docker=req('P29_DOCKER'); const project=req('P29_PROJECT_ID'); const evidence=req('P29_EVIDENCE_DIR');
assert.equal(api,'http://127.0.0.1:54321'); assert.match(project,/^gridly-dispatch-phase29-[a-f0-9]{12}$/); const db=`supabase_db_${project}`;
const org1='26000000-0000-4000-8000-000000000001',org2='26000000-0000-4000-8000-000000000002',scope1='26100000-0000-4000-8000-000000000001',scope2='26100000-0000-4000-8000-000000000002';
const counters={auth:0,rls:0,commands:0,concurrency:0,invitations:0,ownership:0,capability:0,records:0,projection:0,compatibility:0,nonInterference:0};
function req(n){const v=process.env[n];assert.ok(v,`${n} required`);return v} function q(v){return `'${String(v).replaceAll("'","''")}'`}
function sql(s,{fail=false}={}){const r=spawnSync(docker,['exec',db,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres','-c',s],{encoding:'utf8',windowsHide:true,maxBuffer:20e6}); if(fail)assert.notEqual(r.status,0);else assert.equal(r.status,0,`${r.stderr}\n${r.stdout}`);return (r.stdout??'').trim().split(/\r?\n/).filter(Boolean).at(-1)??''}
async function http(path,{method='GET',token=anon,key=anon,body,profile,accept=[200]}={}){const headers={apikey:key,Authorization:`Bearer ${token}`};if(body!==undefined)headers['Content-Type']='application/json';if(profile){headers['Accept-Profile']=profile;headers['Content-Profile']=profile}const r=await fetch(api+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}if(!accept.includes(r.status))throw new Error(`${path} ${r.status} ${String(raw).slice(0,300)}`);return{status:r.status,data}}
function claims(t){return JSON.parse(Buffer.from(t.split('.')[1],'base64url'))} function b32(v){const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of v.replace(/=+$/,'').toUpperCase())bits+=a.indexOf(c).toString(2).padStart(5,'0');const o=[];for(let i=0;i+8<=bits.length;i+=8)o.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(o)}
function totp(secret){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const h=createHmac('sha1',b32(secret)).update(b).digest(),o=h.at(-1)&15;return String(((((h[o]&127)<<24)|((h[o+1]&255)<<16)|((h[o+2]&255)<<8)|(h[o+3]&255))%1e6)).padStart(6,'0')}
async function signup(label){const email=`p29-${label}-${randomUUID()}@dispatch.invalid`,password=randomBytes(24).toString('base64url');const r=await http('/auth/v1/signup',{method:'POST',body:{email,password}});assert.equal(claims(r.data.access_token).aal,'aal1');return{...r.data,email,password,userId:r.data.user.id}}
async function elevate(u){const e=await http('/auth/v1/factors',{method:'POST',token:u.access_token,body:{factor_type:'totp',friendly_name:'p28'}});const ch=await http(`/auth/v1/factors/${e.data.id}/challenge`,{method:'POST',token:u.access_token,body:{}});const v=await http(`/auth/v1/factors/${e.data.id}/verify`,{method:'POST',token:u.access_token,body:{challenge_id:ch.data.id,code:totp(e.data.totp.secret)}});assert.equal(claims(v.data.access_token).aal,'aal2');return{...u,...v.data,factorId:e.data.id}}
async function rpc(name,u,p,accept=[200]){return http(`/rest/v1/rpc/${name}`,{method:'POST',token:u.access_token,profile:'dispatch_api',body:{p_payload:p},accept})}
const key=()=>randomUUID(); const digest=t=>createHash('sha256').update(t).digest('hex');

const checks=[];
const registry=JSON.parse(readFileSync(new URL('./taxonomy-v1.json',import.meta.url),'utf8'));
const inventory=JSON.parse(readFileSync(new URL('./object-inventory.json',import.meta.url),'utf8'));
const units=Object.fromEntries(['POLICE','FIRE','EMS','PUBLIC_WORKS','FOREIGN'].map(x=>[x,key()]));
const actors={}; const memberships={}; const records={};
const future=(minutes=10)=>new Date(Date.now()+minutes*60000).toISOString();
const past=()=>new Date(Date.now()-60000).toISOString();
const reportBase=(dep,sub)=>({organization_id:org1,idempotency_key:key(),unit_id:units[dep],scope_id:scope1,subtype:sub,timing:'UNPLANNED',title:'Synthetic operational travel awareness',warning_acknowledged:true,...(sub==='OFFICIAL_PUBLIC_NOTICE'?{subject:'Synthetic communication',body:'Operational awareness bulletin',notice_effective_at:past(),notice_expires_at:future()}:{} )});
async function command(name,user,p={}){return (await rpc(name,user,{organization_id:org1,idempotency_key:key(),...p})).data}
async function denied(label,name,user,p={}){const r=await rpc(name,user,{organization_id:org1,idempotency_key:key(),...p},[400,401,403]);assert.ok(r.status>=400,label);checks.push(label)}
function checked(label,fn){fn();checks.push(label)}
const dRev=id=>Number(sql(`SELECT revision FROM dispatch_private.report_details WHERE record_id=${q(id)}`));
const rRev=id=>Number(sql(`SELECT current_revision FROM dispatch_private.operational_records WHERE id=${q(id)}`));
function ownerSQL(query){return sql(`BEGIN; GRANT dispatch_function_owner TO postgres; SET LOCAL ROLE dispatch_function_owner; ${query}; ROLLBACK;`)}
function roleSQL(user,query,fail=false){return sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims',${q(JSON.stringify(claims(user.access_token)))},true); ${query}; ROLLBACK;`,{fail})}
async function safeRead(u,view){return (await http('/rest/v1/'+view+'?select=*',{token:u.access_token,profile:'dispatch_api'})).data}
async function approve(id){return command('approve_report_content',actors.reviewer,{record_id:id,expected_revision:dRev(id)})}
const impactBase=(extra={})=>({direction_affected:'NORTHBOUND',lane_extent:'ONE',lanes_affected_count:1,total_lanes_count:2,closure_extent:'PARTIAL',traffic_operation:'NARROWED',public_passable:'YES',emergency_vehicles_passable:'UNKNOWN',impact_status:'ACTIVE',valid_until:future(),...extra});
let segment; const certFixtures={};
let success=false;
process.on('exit',code=>writeFileSync(join(evidence,'runtime-results.json'),JSON.stringify({status:success&&code===0?'PASS':'FAIL',contractHash:registry.contractHash,checks,assertionGroups:checks.length,syntheticOnly:true,productionConnections:false,productionChanges:false},null,2)+'\n'));
test('Phase 29 real local Auth and forced-RLS catalog',async()=>{
 const labels=['POLICE','FIRE','EMS','PUBLIC_WORKS','reviewer','foreign','platform','viewer'];
 for(const label of labels){actors[label]=await elevate(await signup(label)); memberships[label]=key();sql(`INSERT INTO dispatch_private.profiles(user_id,display_name) VALUES(${q(actors[label].userId)},'Synthetic actor')`)}
 actors.aal1=await signup('aal1');
 sql(`INSERT INTO dispatch_private.organizations(id,display_name,legal_name,organization_type,status,verification_level) VALUES('${org1}','Synthetic municipality','Synthetic municipality','MUNICIPALITY','ACTIVE','VERIFIED_PUBLIC_ENTITY'),('${org2}','Synthetic independent fire','Synthetic independent fire','FIRE','ACTIVE','VERIFIED_PUBLIC_ENTITY');
 INSERT INTO dispatch_private.operational_scopes(id,organization_id,scope_type,label,source_reference) VALUES('${scope1}','${org1}','SERVICE_TERRITORY','Synthetic road scope','local-evidence'),('${scope2}','${org2}','SERVICE_TERRITORY','Synthetic recipient scope','local-evidence');
 INSERT INTO dispatch_private.scope_governance VALUES('${org1}','${scope1}','local synthetic only','v1',now()+interval '1 hour'),('${org2}','${scope2}','local synthetic only','v1',now()+interval '1 hour');
 INSERT INTO dispatch_private.pilot_governance(organization_id,verification_expires_at,attestation_expires_at,governance_source,governance_version) VALUES('${org1}',now()+interval '1 hour',now()+interval '1 hour','local synthetic only','v1'),('${org2}',now()+interval '1 hour',now()+interval '1 hour','local synthetic only','v1');`);
 for(const label of labels)if(label!=='platform')sql(`INSERT INTO dispatch_private.organization_memberships(id,organization_id,user_id,status,role_template) VALUES('${memberships[label]}','${label==='foreign'?org2:org1}',${q(actors[label].userId)},'ACTIVE','${label==='POLICE'||label==='foreign'?'OWNER':label==='reviewer'?'SUPERVISOR':label==='viewer'?'VIEWER':'OPERATOR'}')`);
 for(const [dep,id] of Object.entries(units)){const org=dep==='FOREIGN'?org2:org1;sql(`INSERT INTO dispatch_private.organization_units(id,organization_id,unit_type,name,display_name,status,onboarding_state) VALUES('${id}','${org}','${dep==='POLICE'?'LAW_ENFORCEMENT':dep==='FOREIGN'?'FIRE':dep}','${dep}','Synthetic ${dep}','ACTIVE','PRIVATE_PILOT_READY'); INSERT INTO dispatch_private.unit_scope_grants VALUES('${org}','${id}','${org===org1?scope1:scope2}')`)}
 for(const dep of ['POLICE','FIRE','EMS','PUBLIC_WORKS']){sql(`INSERT INTO dispatch_private.unit_memberships VALUES('${org1}','${units[dep]}','${memberships[dep]}','ACTIVE',1),('${org1}','${units[dep]}','${memberships.reviewer}','ACTIVE',1)`)}
 sql(`INSERT INTO dispatch_private.unit_memberships VALUES('${org2}','${units.FOREIGN}','${memberships.foreign}','ACTIVE',1),('${org1}','${units.POLICE}','${memberships.viewer}','ACTIVE',1); INSERT INTO dispatch_private.platform_admin_grants(user_id,permission_key,active,granted_by_user_id) VALUES(${q(actors.platform.userId)},'platform.capability.manage',true,${q(actors.platform.userId)})`);
 segment=key();sql(`INSERT INTO dispatch_private.report_scope_segments VALUES('${segment}','${org1}','${scope1}',1,'synthetic-road-segment',29,31,-96,-94,'synthetic road reporting evidence',now()+interval '1 hour')`);
 for(const table of inventory.tables)checked('forced RLS '+table,()=>assert.equal(sql(`SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid=${q(table)}::regclass`),'t'));
 checked('Phase 27 owner role unchanged',()=>assert.equal(sql(`SELECT NOT rolcanlogin AND rolbypassrls AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolinherit FROM pg_roles WHERE rolname='dispatch_function_owner'`),'t'));
 checked('sole bounded postgres Auth bridge',()=>assert.equal(sql(`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='dispatch_private' AND p.prosecdef AND p.proowner='postgres'::regrole`),'1'));
 await denied('AAL1 create refused','create_report',actors.aal1,reportBase('POLICE','TRAFFIC_COLLISION'));
 await denied('viewer create refused','create_report',actors.viewer,reportBase('POLICE','TRAFFIC_COLLISION'));
 await denied('platform cannot write private report','create_report',actors.platform,reportBase('POLICE','TRAFFIC_COLLISION'));
 await denied('cross-unit creation refused','create_report',actors.FIRE,reportBase('EMS','TRAFFIC_COLLISION'));
 checked('raw report private denied',()=>roleSQL(actors.POLICE,'SELECT body FROM dispatch_private.report_details',true));
 checked('old dispatcher direct execution denied',()=>roleSQL(actors.POLICE,"SELECT dispatch_private.execute_command('create_operational_record','{}')",true));
});
test('all four department taxonomy allow/deny matrices',async()=>{
 const publicCodes=Object.values(registry.publicSubtypes).flat();
 for(const dep of ['POLICE','FIRE','EMS','PUBLIC_WORKS'])for(const subtype of publicCodes){const allowed=registry.departmentPublic[dep].includes(subtype);if(allowed){const r=await command('create_report',actors[dep],reportBase(dep,subtype));assert.ok(r.object_id);records[dep+':'+subtype]=r.object_id;checks.push(`${dep} allows ${subtype}`)}else await denied(`${dep} denies ${subtype}`,'create_report',actors[dep],reportBase(dep,subtype))}
 for(const dep of ['POLICE','FIRE','EMS','PUBLIC_WORKS'])for(const subtype of registry.internalSubtypes){if(registry.departmentInternal[dep].includes(subtype)){const r=await command('create_report',actors[dep],reportBase(dep,subtype));await approve(r.object_id);await denied(`${dep} internal subtype never public ${subtype}`,'submit_report_publication',actors[dep],{record_id:r.object_id,expected_revision:dRev(r.object_id),title:'Synthetic notice',summary:'Synthetic awareness',grant_ids:[],valid_until:future()})}else await denied(`${dep} denies internal ${subtype}`,'create_report',actors[dep],reportBase(dep,subtype))}
 await denied('Police activity absent','create_report',actors.POLICE,reportBase('POLICE','POLICE_ACTIVITY'));
 checked('18 public + 7 internal + legacy registry',()=>assert.equal(sql('SELECT count(*) FROM dispatch_private.report_subtypes'),'26'));
 checked('104 department rows',()=>assert.equal(sql('SELECT count(*) FROM dispatch_private.department_report_policies'),'104'));
});
test('structured impact validation, independent lanes and lifecycle',async()=>{
 const id=records['POLICE:TRAFFIC_COLLISION'];
 for(const [label,extra] of [['invalid full closure',{closure_extent:'FULL'}],['ONE count mismatch',{lanes_affected_count:2}],['MULTIPLE count mismatch',{lane_extent:'MULTIPLE',lanes_affected_count:1}],['affected exceeds total',{lanes_affected_count:3}],['alternating requires partial',{traffic_operation:'ALTERNATING',closure_extent:'NONE'}],['planned schedule missing',{timing:'PLANNED'}],['estimated duration missing',{duration_state:'ESTIMATED'}],['outside governed geometry',{segment_id:segment,start_lat:50,start_lon:-95}],['future confirmation supplied',{last_confirmed_at:future()}],['invalid caution',{passable_with_caution:true,public_passable:'NO'}]]){
  await denied(label,'set_road_impact',actors.POLICE,{record_id:id,expected_revision:dRev(id),impact:impactBase(extra)});
 }
 for(const direction of ['NORTHBOUND','SOUTHBOUND','EASTBOUND','WESTBOUND','BOTH_DIRECTIONS','ALL_DIRECTIONS','NOT_APPLICABLE','UNKNOWN']){await command('set_road_impact',actors.POLICE,{record_id:id,expected_revision:dRev(id),impact:impactBase({direction_affected:direction,segment_id:segment})});checks.push('direction '+direction)}
 const full=await command('set_road_impact',actors.POLICE,{record_id:id,expected_revision:dRev(id),impact:impactBase({segment_id:segment,lane_extent:'ALL',lanes_affected_count:2,closure_extent:'FULL',traffic_operation:'STOPPED',public_passable:'NO',emergency_vehicles_passable:'YES'})});
 checked('emergency passability independent',()=>assert.equal(sql(`SELECT emergency_vehicles_passable FROM dispatch_private.road_impacts WHERE id=${q(full.object_id)}`),'YES'));
 await command('set_road_impact',actors.POLICE,{record_id:id,object_id:full.object_id,impact_revision:1,expected_revision:dRev(id),impact:impactBase({segment_id:segment,lane_extent:'ALL',lanes_affected_count:2,closure_extent:'FULL',traffic_operation:'STOPPED',public_passable:'NO',impact_status:'CLEARED'})});
 checked('impact clearance keeps operational workflow independent',()=>assert.equal(sql(`SELECT status FROM dispatch_private.operational_records WHERE id=${q(id)}`),'OPEN'));
 await denied('cleared impact cannot reopen','set_road_impact',actors.POLICE,{record_id:id,object_id:full.object_id,impact_revision:2,expected_revision:dRev(id),impact:impactBase({segment_id:segment})});
 const other=records['PUBLIC_WORKS:PLANNED_WORK'];await command('revise_report',actors.PUBLIC_WORKS,{...reportBase('PUBLIC_WORKS','PLANNED_WORK'),object_id:other,expected_revision:rRev(other),timing:'PLANNED'});
 await command('set_road_impact',actors.PUBLIC_WORKS,{record_id:other,expected_revision:dRev(other),impact:impactBase({segment_id:segment,scheduled_start_at:future(),impact_status:'SCHEDULED'})});checks.push('planned impact schedule');
});
test('Fire/EMS prohibited data and Police restricted-content defenses',async()=>{
 for(const dep of ['FIRE','EMS'])for(const keyName of ['patient_name','patient_identifier','diagnosis','treatment','medical_record_number','patient_destination'])await denied(`${dep} rejects field ${keyName}`,'create_report',actors[dep],{...reportBase(dep,'TRAFFIC_COLLISION'),[keyName]:'SYNTHETIC_REJECTED_MARKER'});
 for(const dep of ['FIRE','EMS','POLICE','PUBLIC_WORKS']){const marker=dep==='FIRE'||dep==='EMS'?'patient clinical treatment':'CJIS investigative tactical';const r=await command('create_report',actors[dep],{...reportBase(dep,'OFFICIAL_PUBLIC_NOTICE'),body:marker});assert.equal(r.state,'QUARANTINED');checked(dep+' quarantined before normal intake',()=>assert.equal(sql(`SELECT count(*) FROM dispatch_private.report_details WHERE body=${q(marker)}`),'0'));checked(dep+' minimized quarantine',()=>assert.equal(sql(`SELECT count(*) FROM dispatch_private.content_quarantine WHERE id=${q(r.object_id)}`),'1'))}
 const id=records['FIRE:TRAFFIC_COLLISION'];await denied('content author cannot approve','approve_report_content',actors.FIRE,{record_id:id,expected_revision:dRev(id)});await approve(id);
 await denied('notice hazard without structured link','create_report',actors.POLICE,{...reportBase('POLICE','OFFICIAL_PUBLIC_NOTICE'),body:'Road closure and crash awareness'});
});
test('capability gates, independent publication review, public refusal default',async()=>{
 const id=records['FIRE:TRAFFIC_COLLISION'];
 await command('set_road_impact',actors.FIRE,{record_id:id,expected_revision:dRev(id),impact:impactBase({segment_id:segment,lane_extent:'ALL',lanes_affected_count:2,closure_extent:'FULL',traffic_operation:'STOPPED',public_passable:'NO'})});await approve(id);
 const makeGrant=async(capability,unitsArg=[units.FIRE])=>(await command('grant_report_capability',actors.platform,{capability_key:capability,subtype:'TRAFFIC_COLLISION',scope_id:scope1,scope_version:1,unit_ids:unitsArg,closure_envelope:['NONE','PARTIAL','FULL'],lane_envelope:['NONE','ONE','MULTIPLE','ALL'],allowed_timing:['PLANNED','UNPLANNED'],authority_evidence:'local synthetic reporting authority',evidence_class:'R',valid_until:future(60)})).object_id;
 const exact=await makeGrant('awareness.report.traffic_collision.publish'),hazard=await makeGrant('awareness.hazard.publish'),closure=await makeGrant('awareness.road_closure.publish');
 for(const [label,g] of [['no subtype key',[hazard,closure]],['hazard gate missing',[exact,closure]],['closure gate missing',[exact,hazard]]])await denied(label,'submit_report_publication',actors.FIRE,{record_id:id,expected_revision:dRev(id),title:'Synthetic collision',summary:'Synthetic roadway restriction',grant_ids:g,valid_until:future(5)});
 certFixtures.grants=[exact,hazard,closure];certFixtures.collision=id;
 const review=(await command('submit_report_publication',actors.FIRE,{record_id:id,expected_revision:dRev(id),title:'Synthetic collision',summary:'Synthetic roadway restriction',grant_ids:[exact,hazard,closure],valid_until:future(5)})).object_id;
 await denied('no self approval','review_report_publication',actors.FIRE,{object_id:review,expected_revision:dRev(id),decision:'APPROVED'});
 await command('review_report_publication',actors.reviewer,{object_id:review,expected_revision:dRev(id),decision:'APPROVED'});
 await denied('publication remains disabled','publish_report',actors.reviewer,{object_id:review,expected_revision:dRev(id)});
 checked('EMS cannot inherit Fire units grant',()=>assert.equal(ownerSQL(`SELECT dispatch_private.report_grants_valid(${q(records['EMS:TRAFFIC_COLLISION'])},ARRAY[${[exact,hazard,closure].map(q).join(',')}]::uuid[])`),'f'));
 checked('positive triple-gate review prerequisites without publishing activation',()=>assert.equal(ownerSQL(`SELECT dispatch_private.report_review_prerequisites(${q(review)})`),'t'));
 sql(`UPDATE dispatch_private.capability_grants SET status='REVOKED' WHERE id=${q(hazard)}`);checked('live hazard revocation invalidates approval',()=>assert.equal(ownerSQL(`SELECT dispatch_private.report_review_prerequisites(${q(review)})`),'f'));sql(`UPDATE dispatch_private.capability_grants SET status='ACTIVE' WHERE id=${q(hazard)}`);
 checked('public impact omits responder passability',()=>assert.equal(ownerSQL(`SELECT dispatch_private.report_safe_impacts(${q(id)})::text LIKE '%emergency_vehicles_passable%'`),'f'));
 checked('no source automatically public',()=>assert.equal(sql('SELECT count(*) FROM dispatch_projection.report_public_projections'),'0'));
});
test('same-org and bilateral sharing, expiry/revocation, source isolation',async()=>{
 const id=records['POLICE:HIGH_WATER'];await approve(id);
 const reviewerToken=sql(`SELECT token FROM dispatch_private.actor_tokens WHERE organization_id='${org1}' AND user_id=${q(actors.reviewer.userId)}`);
 const shareRequest={record_id:id,expected_revision:dRev(id),title:'Synthetic road awareness',summary:'Synthetic high water coordination',recipient_unit_ids:[units.FIRE],reviewer_token:reviewerToken,valid_until:future()};
 const same=await command('share_report',actors.POLICE,shareRequest);assert.ok((await safeRead(actors.FIRE,'durable_shared_awareness')).some(x=>x.id===same.object_id));checks.push('same-org explicit recipient view');
 checked('recipient source access denied',()=>roleSQL(actors.FIRE,`SELECT body FROM dispatch_private.report_details WHERE record_id=${q(id)}`,true));
 await denied('cross-org share without bilateral agreement','share_report',actors.POLICE,{...shareRequest,recipient_unit_ids:[units.FOREIGN]});
 await denied('wildcard recipients denied','share_report',actors.POLICE,{...shareRequest,recipient_unit_ids:[]});
 const agreement=(await command('create_sharing_agreement',actors.POLICE,{recipient_organization_id:org2,scope_id:scope1,scope_version:1,purpose:'Synthetic travel awareness coordination',allowed_subtypes:['HIGH_WATER'],allowed_fields:['title','summary'],recipient_unit_ids:[units.FOREIGN],valid_until:future(60)})).object_id;
 await command('approve_sharing_agreement',actors.POLICE,{object_id:agreement,expected_revision:1});
 await denied('unilateral agreement denied','share_report',actors.POLICE,{...shareRequest,agreement_id:agreement,recipient_unit_ids:[units.FOREIGN]});
 await command('approve_sharing_agreement',actors.foreign,{organization_id:org2,object_id:agreement,expected_revision:1});
 const cross=await command('share_report',actors.POLICE,{...shareRequest,agreement_id:agreement,recipient_unit_ids:[units.FOREIGN]});assert.ok((await safeRead(actors.foreign,'durable_shared_awareness')).some(x=>x.id===cross.object_id));checks.push('bilateral recipient access');
 await denied('no onward sharing/source access','share_report',actors.foreign,{organization_id:org2,...shareRequest});
 await command('revoke_sharing_agreement',actors.foreign,{organization_id:org2,object_id:agreement,expected_revision:1});assert.ok(!(await safeRead(actors.foreign,'durable_shared_awareness')).some(x=>x.id===cross.object_id));checks.push('bilateral revocation immediate');
 sql(`UPDATE dispatch_private.shared_awareness_representations SET valid_until=now()-interval '1 second' WHERE id=${q(same.object_id)}`);assert.ok(!(await safeRead(actors.FIRE,'durable_shared_awareness')).some(x=>x.id===same.object_id));checks.push('sharing expiry immediate');
});
test('redaction preserves identities and minimized immutable lineage',async()=>{
 const id=records['POLICE:DEBRIS_OBSTRUCTION'];await approve(id);
 const r=await command('redact_report',actors.reviewer,{record_id:id,expected_revision:dRev(id),policy_reference:'synthetic-approved-remediation-policy-v1'});
 checked('redaction stable source identity',()=>assert.equal(sql(`SELECT screening_state FROM dispatch_private.report_details WHERE record_id=${q(id)}`),'REDACTED'));
 checked('historical text removed',()=>assert.equal(sql(`SELECT bool_and(snapshot->>'redacted'='true') FROM dispatch_audit.record_revisions WHERE record_id=${q(id)}`),'t'));
 checked('redaction evidence preserved',()=>assert.equal(sql(`SELECT count(*) FROM dispatch_audit.content_remediation_events WHERE quarantine_id=${q(r.object_id)}`),'1'));
 checked('ordinary revision mutation still refused',()=>sql(`UPDATE dispatch_audit.record_revisions SET snapshot='{}' WHERE record_id=${q(id)}`,{fail:true}));
});
test('Official Public Notice linked authority, expiry, correction and withdrawal',async()=>{
 const noticeGrant=(await command('grant_report_capability',actors.platform,{capability_key:'awareness.report.official_public_notice.publish',subtype:'OFFICIAL_PUBLIC_NOTICE',scope_id:scope1,scope_version:1,unit_ids:[units.FIRE],closure_envelope:['NONE','PARTIAL','FULL'],lane_envelope:['NONE','ONE','MULTIPLE','ALL'],allowed_timing:['PLANNED','UNPLANNED'],authority_evidence:'local synthetic communication evidence',evidence_class:'N',valid_until:future(60)})).object_id;
 const notice=(await command('create_report',actors.FIRE,{...reportBase('FIRE','OFFICIAL_PUBLIC_NOTICE'),linked_record_id:certFixtures.collision,body:'Synthetic collision road closure bulletin'})).object_id;await approve(notice);
 const req={record_id:notice,expected_revision:dRev(notice),title:'Synthetic official notice',summary:'Synthetic collision road closure bulletin',valid_until:future(5)};
 await denied('notice cannot bypass linked cause capability','submit_report_publication',actors.FIRE,{...req,grant_ids:[noticeGrant]});
 const grants=[noticeGrant,...certFixtures.grants];const review=(await command('submit_report_publication',actors.FIRE,{...req,grant_ids:grants})).object_id;
 await command('review_report_publication',actors.reviewer,{object_id:review,expected_revision:dRev(notice),decision:'APPROVED'});
 checked('notice positive prerequisites while publication disabled',()=>assert.equal(ownerSQL(`SELECT dispatch_private.report_review_prerequisites(${q(review)})`),'t'));
 await denied('notice expiry exceeds confirmation deadline','submit_report_publication',actors.FIRE,{...req,grant_ids:grants,valid_until:future(20)});
 const correction=(await command('create_report',actors.FIRE,{...reportBase('FIRE','OFFICIAL_PUBLIC_NOTICE'),correction_of:notice,linked_record_id:certFixtures.collision,body:'Synthetic corrected collision bulletin'})).object_id;
 checked('correction invalidates earlier active review',()=>assert.equal(ownerSQL(`SELECT dispatch_private.report_review_prerequisites(${q(review)})`),'f'));
 await approve(correction);await command('withdraw_report',actors.FIRE,{record_id:correction,expected_revision:dRev(correction),reason_code:'WITHDRAWN'});
 checked('notice withdrawal recorded immediately',()=>assert.equal(sql(`SELECT withdrawn_at IS NOT NULL FROM dispatch_private.report_details WHERE record_id=${q(correction)}`),'t'));
});
test('idempotency, atomic stale refusal and concurrent report revision',async()=>{
 const p=reportBase('EMS','HIGH_WATER');const [a,b]=await Promise.all([rpc('create_report',actors.EMS,p),rpc('create_report',actors.EMS,p)]);assert.equal(a.data.object_id,b.data.object_id);assert.equal([a.data.replay,b.data.replay].filter(Boolean).length,1);checks.push('concurrent create one identity and replay');
 const id=a.data.object_id;await denied('same token changed content refused','create_report',actors.EMS,{...p,title:'Changed synthetic title'});
 const revision=rRev(id);const one={...reportBase('EMS','HIGH_WATER'),object_id:id,expected_revision:revision};const two={...one,idempotency_key:key(),title:'Alternate synthetic revision'};
 const results=await Promise.all([rpc('revise_report',actors.EMS,one,[200,400,403]),rpc('revise_report',actors.EMS,two,[200,400,403])]);assert.equal(results.filter(r=>r.status===200).length,1);checks.push('concurrent revision one winner');
 const count=sql('SELECT count(*) FROM dispatch_audit.command_receipts');await denied('stale revision is atomic','revise_report',actors.EMS,{...one,idempotency_key:key()});assert.equal(sql('SELECT count(*) FROM dispatch_audit.command_receipts'),count);checks.push('stale command leaves no receipt');
});
test('legacy compatibility, populated refusal and protected consumer baseline',async()=>{
 checked('historical broad grants cannot authorize subtype',()=>assert.equal(ownerSQL(`SELECT dispatch_private.pilot_candidate_eligible(${q(records['POLICE:HIGH_WATER'])},${q(key())})`),'f'));
 await denied('legacy Fire arbitrary payload refused','create_operational_record',actors.FIRE,{unit_id:units.FIRE,scope_id:scope1,record_type:'CONDITION',title:'Synthetic record',private_payload:{patient_name:'SYNTHETIC'},data_attestation:'OPERATIONAL_AWARENESS_ONLY',safety_class:'GENERAL_AWARENESS'});
 const legacy=await command('create_operational_record',actors.POLICE,{unit_id:units.POLICE,scope_id:scope1,record_type:'CONDITION',title:'Synthetic legacy awareness',private_payload:{},data_attestation:'OPERATIONAL_AWARENESS_ONLY',safety_class:'GENERAL_AWARENESS'});checked('legacy private identity preserved without inferred subtype',()=>assert.equal(sql(`SELECT count(*) FROM dispatch_private.report_details WHERE record_id=${q(legacy.object_id)}`),'0'));
 const source=readFileSync(new URL('./package.local.sql',import.meta.url),'utf8');const install=spawnSync(docker,['exec','-i',db,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:source,encoding:'utf8',windowsHide:true});assert.notEqual(install.status,0);assert.match(install.stderr,/PHASE29_REFUSED populated/);checks.push('populated schema apply refused');
 const rollback=readFileSync(new URL('../phase28/rollback.sql',import.meta.url),'utf8');const rr=spawnSync(docker,['exec','-i',db,'psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','postgres'],{input:rollback,encoding:'utf8',windowsHide:true});assert.notEqual(rr.status,0);assert.match(rr.stderr,/ROLLBACK_REFUSED/);checks.push('evidence-bearing rollback refused');
 checked('consumer sentinel unchanged',()=>assert.equal(sql('SELECT payload FROM public.gridly_consumer_sentinel WHERE id=1'),'consumer-baseline'));
 checked('consumer reporting stays disabled',()=>assert.equal(sql('SELECT reporting_enabled FROM report_retention.admission_state WHERE singleton'),'f'));
 const catalog=JSON.parse(sql(`SELECT jsonb_build_object('owner',(SELECT jsonb_build_object('login',rolcanlogin,'bypassRls',rolbypassrls,'superuser',rolsuper,'createDb',rolcreatedb,'createRole',rolcreaterole,'inherit',rolinherit) FROM pg_roles WHERE rolname='dispatch_function_owner'),'functions',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||p.proname,'identityArguments',pg_get_function_identity_arguments(p.oid),'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl,'definition',pg_get_functiondef(p.oid)) ORDER BY n.nspname,p.proname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'dispatch_%' AND p.prokind='f'),'tables',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity,'acl',c.relacl) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'dispatch_%' AND c.relkind='r'),'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname,tablename,policyname) FROM pg_policies p WHERE schemaname LIKE 'dispatch_%'))`));writeFileSync(join(evidence,'security-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
 success=true;
});
