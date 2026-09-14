// Disposable localhost PostgreSQL/PostGIS only; no remote database or real identities.
import {randomUUID} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCountyCatalog} from '../tools/responder-local/load-county-authority.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {RESPONDER_LOCAL_PGBIN:bin,RESPONDER_LOCAL_PGPORT:port,
  RESPONDER_LOCAL_PGUSER:owner,RESPONDER_LOCAL_PGDATA:data}=process.env;
if(!bin || !/^\d{4,5}$/.test(port||'') || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(owner||'')
  || !data || !path.basename(data).startsWith('gridly-responder-phase7-')
  || path.relative(os.tmpdir(),path.resolve(data)).startsWith('..'))
  throw new Error('Explicit disposable Phase 7 localhost PostgreSQL configuration required');
const env={...process.env};
for(const k of Object.keys(env)) if(/^PG/i.test(k)||/SUPABASE|DATABASE_URL/i.test(k)) delete env[k];
Object.assign(env,{PGHOST:'127.0.0.1',PGPORT:port,PGCONNECT_TIMEOUT:'3'});
const database=`gridly_responder_p3_${randomUUID().replaceAll('-','').slice(0,20)}`;
const suffix=randomUUID().replaceAll('-','').slice(0,8);
const keys=['governance','author','approver','admin','authorB','approverB','adminB','public'];
const roles=Object.fromEntries(keys.map(k=>[k,`p7_${k.toLowerCase()}_${suffix}`]));
const ids=Object.fromEntries(keys.filter(k=>k!=='public').map(k=>[k,randomUUID()]));
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
const q=(sql,role=owner)=>psql(database,['-c',sql],role).stdout.trim();
function check(label,actual,expected) {
  const ok=String(actual)===String(expected);
  console.log(`${ok?'PASS':'FAIL'} ${label}${ok?'':` expected=${expected} actual=${actual}`}`);
  if(ok) passed++; else failed++;
}
function status(label,result,expected) {check(label,result.status,expected);return result;}
function request(organization,action,payload={},updateId,revision,token=randomUUID()) {
  const r={contract_version:'responder.agency.v1.phase0.1',action,
    operation_token:token,organization_id:organization,payload};
  if(updateId!==undefined) r.update_id=updateId;
  if(revision!==undefined) r.expected_revision=revision;
  return r;
}
function command(key,r) {
  return JSON.parse(q(`SELECT agency_private.phase7_agency_update_command(${quote(JSON.stringify(r))}::jsonb)`,roles[key]));
}
function governance(organization,action,revision,reason='Synthetic governance case') {
  const r={contract_version:'responder.agency.v1.phase0.1',action,
    operation_token:randomUUID(),organization_id:organization,expected_revision:revision,
    payload:{reason}};
  return JSON.parse(q(`SELECT agency_private.phase6_governance_command(${quote(JSON.stringify(r))}::jsonb)`,roles.governance));
}
function concurrent(key,r) {
  return new Promise((resolve,reject)=>{
    const child=spawn(path.join(bin,'psql.exe'),
      ['-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',database,
        '-c',`SELECT agency_private.phase7_agency_update_command(${quote(JSON.stringify(r))}::jsonb)`],
      {cwd:root,env:{...env,PGUSER:roles[key]},windowsHide:true});
    let out='',err=''; child.stdout.on('data',x=>out+=x); child.stderr.on('data',x=>err+=x);
    child.on('error',reject); child.on('close',code=>code===0?resolve(JSON.parse(out.trim())):reject(new Error(err)));
  });
}
function doc(updateId,role='public') {
  const raw=q(`SELECT document FROM responder_public.agency_updates
    WHERE document->>'update_id'='${updateId}'`,roles[role]);
  return raw?JSON.parse(raw):null;
}
const parseDocAt=(updateId,time)=>{
  const raw=q(`SELECT document FROM agency_private.phase7_consumer_projection_at(${quote(time)}::timestamptz)
    WHERE document->>'update_id'='${updateId}'`);
  return raw?JSON.parse(raw):null;
};
const gate=enabled=>q(`UPDATE agency_private.agency_program_controls
  SET agency_publishing_enabled=${enabled?'true':'false'}`);
const pending=(organization,author,base)=>{
  const d=status('create synthetic draft',command(author,request(organization,'create_draft',base)),'accepted');
  status('submit synthetic draft',command(author,request(organization,'submit_for_review',{},d.update_id,0)),'pending_review');
  return d.update_id;
};
try {
  check('PostgreSQL 17.10',psql('postgres',['-c',"SELECT current_setting('server_version')"]).stdout.trim(),'17.10');
  check('disposable cluster path',path.resolve(psql('postgres',['-c',"SELECT current_setting('data_directory')"]).stdout.trim()).toLowerCase(),path.resolve(data).toLowerCase());
  psql('postgres',['-c',`CREATE DATABASE ${database}`]); created=true;
  q('CREATE EXTENSION postgis');
  check('PostGIS 3.6.2',q("SELECT extversion FROM pg_extension WHERE extname='postgis'"),'3.6.2');
  for(const f of ['001_agency_private_apply.sql','002_phase2_auth_membership_apply.sql',
    '003_phase3_county_authority_apply.sql','004_phase4_rls_authorization_apply.sql',
    '005_phase5_local_command_apply.sql','006_phase6_local_governance_apply.sql',
    '007_phase7_local_rate_consumer_apply.sql'])
    psql(database,['-f',path.join(root,'db','responder-local',f)]);
  check('254 certified counties',loadCountyCatalog({database,bin,port,user:owner}).counties,254);
  check('gate starts false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  for(const k of keys) {
    psql('postgres',['-c',`CREATE ROLE ${roles[k]} LOGIN INHERIT`]);
    const group=k==='public'?'responder_public_reader_fixture'
      :k==='governance'?'responder_rls_governance_fixture':'responder_rls_agency_fixture';
    psql('postgres',['-c',`GRANT ${group} TO ${roles[k]}`]);
  }
  q(`INSERT INTO agency_private.organizations
    (id,canonical_key,legal_name,public_name,organization_type,verification_state,operation_state)
    VALUES ('${org.a}','phase7-a','Synthetic Agency A','Agency A','county_agency','verified','active'),
      ('${org.b}','phase7-b','Synthetic Agency B','Agency B','county_agency','verified','active')`);
  q(`INSERT INTO agency_private.local_auth_identities
    (user_id,normalized_email,identity_kind,assurance,session_active,eligibility) VALUES
    ${keys.filter(k=>k!=='public').map(k=>`('${ids[k]}','phase7-${k.toLowerCase()}-${suffix}@example.test',
      '${k==='governance'?'GRIDLY_ADMIN':'RESPONDER'}','aal2',true,'eligible')`).join(',')}`);
  q(`INSERT INTO agency_private.phase4_session_bindings(db_role,user_id,actor_kind) VALUES
    ${keys.filter(k=>k!=='public').map(k=>`('${roles[k]}','${ids[k]}',
      '${k==='governance'?'GRIDLY_ADMIN':'RESPONDER'}')`).join(',')}`);
  q(`INSERT INTO agency_private.organization_memberships
    (organization_id,user_id,role,status,joined_at) VALUES
    ('${org.a}','${ids.author}','RESPONDER','active',now()),
    ('${org.a}','${ids.approver}','SUPERVISOR','active',now()),
    ('${org.a}','${ids.admin}','AGENCY_ADMIN','active',now()),
    ('${org.b}','${ids.authorB}','RESPONDER','active',now()),
    ('${org.b}','${ids.approverB}','SUPERVISOR','active',now()),
    ('${org.b}','${ids.adminB}','AGENCY_ADMIN','active',now())`);
  const authorityA=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}',
    '${org.a}','48291',1,now()-interval '1 day',now()+interval '2 days')`);
  const authorityB=q(`SELECT agency_private.phase3_create_county_authority('${ids.governance}',
    '${org.b}','48071',1,now()-interval '1 day',now()+interval '2 days')`);
  const point=fips=>q(`SELECT round(public.ST_X(public.ST_PointOnSurface(geometry))::numeric,10)||'|'
    ||round(public.ST_Y(public.ST_PointOnSurface(geometry))::numeric,10)
    FROM agency_private.county_geometry_catalog WHERE county_fips='${fips}'`).split('|').map(Number);
  const [lon,lat]=point('48291'),[lonB,latB]=point('48071');
  const base={condition_type:'obstruction',impact_level:'moderate',title:'Synthetic obstruction',
    detail:'Local fixture only',longitude:lon,latitude:lat};
  const baseB={...base,longitude:lonB,latitude:latB,title:'Other synthetic agency'};
  const first=pending(org.a,'author',base);
  check('draft hidden',doc(first),null);
  check('public cannot execute Phase 5 bypass',psql(database,['-c',
    `SELECT agency_private.phase5_agency_update_command('{}'::jsonb)`],roles.approver,true).status!==0,true);
  check('public cannot execute Phase 7 command',psql(database,['-c',
    `SELECT agency_private.phase7_agency_update_command('{}'::jsonb)`],roles.public,true).status!==0,true);
  check('false gate hides pending and active',q('SELECT count(*) FROM responder_public.agency_updates',roles.public),'0');
  gate(true);
  const firstActive=status('activation number one',command('approver',request(org.a,
    'activate_non_closure',{},first,1)),'accepted');
  const initial=doc(first);
  check('activation revision visible',initial?.display_lifecycle_state,'active');
  check('verified agency label',initial?.verified_agency_label,'Verified Agency');
  check('organization label',initial?.organization_public_name,'Agency A');
  check('agency source family',initial?.source_family,'AGENCY_OFFICIAL');
  check('approved department absent as null',initial?.approved_department_name,null);
  check('location keys',Object.keys(initial?.location||{}).sort().join(','),'latitude,longitude');
  const frozenFields=JSON.parse(fs.readFileSync(path.join(root,'docs/RESPONDER/RESPONDER-V1-CONSUMER-PROJECTION.md'),'utf8')
    .match(/\{"publicFields":\[[^\n]+\]\}/)[0]).publicFields;
  check('exact 18-key public allowlist',Object.keys(initial||{}).sort().join(','),frozenFields.sort().join(','));
  check('no employee or reviewer identity',!('employee_email' in initial)&&!('reviewer_user_id' in initial),true);
  check('no private organization ID',!('organization_internal_id' in initial),true);
  check('no audit or receipt fields',!('operation_id' in initial)&&!('audit_snapshots' in initial),true);
  check('activation epoch captured',q(`SELECT activation_operation_epoch FROM agency_private.agency_updates WHERE id='${first}'`),'0');
  const edit=status('active edit remains accepted',command('approver',request(org.a,
    'edit_active_update',{...base,title:'Edited official notice'},first,2)),'accepted');
  check('edited row remains visible',doc(first)?.title,'Edited official notice');
  check('current edit evidence',q(`SELECT action FROM agency_private.agency_update_events
    WHERE update_id='${first}' AND revision=3`),'update_edited');
  const renewal=status('renewal remains accepted',command('approver',request(org.a,
    'renew_update',{expiry_hours:12},first,3)),'accepted');
  check('renewed row remains visible',doc(first)?.display_lifecycle_state,'active');
  check('current renewal evidence',q(`SELECT action FROM agency_private.agency_update_events
    WHERE update_id='${first}' AND revision=4`),'update_renewed');
  check('historical activation retained once',q(`SELECT count(*) FROM agency_private.agency_update_events
    WHERE update_id='${first}' AND action='update_activated'`),'1');
  check('one event per revision enforced',psql(database,['-c',`INSERT INTO agency_private.agency_update_events
    (update_id,organization_id,actor_user_id,authority_id,action,revision)
    VALUES ('${first}','${org.a}','${ids.approver}','${authorityA}','update_activated',4)`],owner,true).status!==0,true);
  const expiry=q(`SELECT expires_at FROM agency_private.agency_updates WHERE id='${first}'`);
  const beforeExpiry=q(`SELECT document FROM agency_private.phase7_consumer_projection_at(
    (SELECT expires_at FROM agency_private.agency_updates WHERE id='${first}')-interval '1 microsecond')
    WHERE document->>'update_id'='${first}'`);
  check('one microsecond before expiry visible',beforeExpiry.length>0,true);
  check('exact expiry hidden',parseDocAt(first,expiry),null);
  check('after expiry hidden',parseDocAt(first,new Date(Date.parse(expiry)+1000).toISOString()),null);
  check('public cannot read private updates',psql(database,['-c',
    'SELECT count(*) FROM agency_private.agency_updates'],roles.public,true).status!==0,true);
  check('public cannot read audit',psql(database,['-c',
    'SELECT count(*) FROM agency_private.agency_update_events'],roles.public,true).status!==0,true);
  check('public cannot read governance',psql(database,['-c',
    'SELECT count(*) FROM agency_private.organization_governance_events'],roles.public,true).status!==0,true);
  check('public cannot call time-override function',psql(database,['-c',
    'SELECT * FROM agency_private.phase7_consumer_projection_at(now())'],roles.public,true).status!==0,true);
  const noEvent=randomUUID(),badEvent=randomUUID();
  for(const id of [noEvent,badEvent]) {
    q(`INSERT INTO agency_private.agency_updates
      (id,organization_id,author_user_id,created_authority_id,current_authority_id,
        condition_type,impact_level,title,point,status,revision,activated_at,updated_at,
        expires_at,activation_operation_epoch)
      VALUES ('${id}','${org.a}','${ids.author}','${authorityA}','${authorityA}',
        'obstruction','moderate','Synthetic bad lineage',
        public.ST_SetSRID(public.ST_MakePoint(${lon},${lat}),4326),'active',3,
        now()-interval '61 minutes',now(),now()+interval '12 hours',0)`);
    q(`INSERT INTO agency_private.agency_update_events
      (update_id,organization_id,actor_user_id,authority_id,action,previous_snapshot,
        new_snapshot,revision)
      VALUES ('${id}','${org.a}','${ids.approver}','${authorityA}',
        'update_activated','{"status":"pending_review"}'::jsonb,
        '{"status":"active","revision":2}'::jsonb,2)`);
  }
  q(`INSERT INTO agency_private.agency_update_events
    (update_id,organization_id,actor_user_id,authority_id,action,previous_snapshot,
      new_snapshot,revision)
    VALUES ('${badEvent}','${org.a}','${ids.approver}','${authorityA}',
      'update_submitted','{"status":"active"}'::jsonb,
      '{"status":"active","revision":3}'::jsonb,3)`);
  check('missing current revision event hidden',doc(noEvent),null);
  check('mismatched current revision event hidden',doc(badEvent),null);
  gate(false);
  check('false gate hides formerly visible active post',doc(first),null);
  gate(true);
  const initialB=pending(org.b,'authorB',baseB);
  status('second organization activation independent',command('approverB',request(org.b,
    'activate_non_closure',{},initialB,1)),'accepted');
  check('second organization visible',doc(initialB)?.organization_public_name,'Agency B');
  const roadB=pending(org.b,'authorB',{...baseB,condition_type:'road_closed',title:'Synthetic road closure B'});
  status('two-person road closure activates below quota',command('approverB',request(org.b,
    'activate_road_closed',{},roadB,1)),'accepted');
  check('road closure public with distinct approver',doc(roadB)?.condition_type,'road_closed');
  // Seed pending rows with their draft/submit evidence; every actual activation
  // below is executed through the Phase 7 command boundary.
  q(`WITH seeded AS (
    INSERT INTO agency_private.agency_updates
      (organization_id,author_user_id,created_authority_id,condition_type,
        impact_level,title,point,status,revision,submitted_at)
    SELECT '${org.a}','${ids.author}','${authorityA}','obstruction','moderate',
      'Rate fixture '||n,public.ST_SetSRID(public.ST_MakePoint(${lon},${lat}),4326),
      'pending_review',1,now() FROM generate_series(1,61) n RETURNING id,organization_id
  ) INSERT INTO agency_private.agency_update_events
      (update_id,organization_id,actor_user_id,authority_id,action,
        previous_snapshot,new_snapshot,revision)
    SELECT s.id,s.organization_id,'${ids.author}','${authorityA}',
      CASE WHEN v.revision=0 THEN 'update_draft_created' ELSE 'update_submitted' END,
      CASE WHEN v.revision=0 THEN '{}'::jsonb ELSE '{"status":"draft"}'::jsonb END,
      jsonb_build_object('status',CASE WHEN v.revision=0 THEN 'draft' ELSE 'pending_review' END,
        'revision',v.revision),v.revision
    FROM seeded s CROSS JOIN (VALUES (0),(1)) v(revision)`);
  const rateIds=q(`SELECT string_agg(id::text,',' ORDER BY title)
    FROM agency_private.agency_updates WHERE organization_id='${org.a}' AND title LIKE 'Rate fixture %'`).split(',');
  check('61 pending rate candidates',rateIds.length,61);
  for(let i=0;i<58;i++) {
    const result=command('approver',request(org.a,'activate_non_closure',{},rateIds[i],1));
    if(result.status!=='accepted') throw new Error(`rate activation ${i+2}: ${JSON.stringify(result)}`);
  }
  check('59 successful org A activations',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'59');
  const concurrentRequests=rateIds.slice(58,60).map(id=>request(org.a,'activate_non_closure',{},id,1));
  const concurrentResults=await Promise.all(concurrentRequests.map(r=>concurrent('approver',r)));
  check('concurrent threshold one accepted',concurrentResults.filter(r=>r.status==='accepted').length,1);
  check('concurrent threshold one rate limited',concurrentResults.filter(r=>r.status==='rate_limited').length,1);
  check('exactly 60 successful activations',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'60');
  const acceptedConcurrentRequest=concurrentRequests[concurrentResults.findIndex(r=>r.status==='accepted')];
  status('accepted activation replay at limit',command('approver',acceptedConcurrentRequest),'already_processed');
  check('accepted replay does not consume capacity',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'60');
  const deniedIndex=concurrentResults.findIndex(r=>r.status==='rate_limited');
  const deniedId=concurrentRequests[deniedIndex].update_id;
  check('denied concurrent row stays pending',q(`SELECT status FROM agency_private.agency_updates WHERE id='${deniedId}'`),'pending_review');
  check('denied concurrent row revision unchanged',q(`SELECT revision FROM agency_private.agency_updates WHERE id='${deniedId}'`),'1');
  check('denied concurrent no activation event',q(`SELECT count(*) FROM agency_private.agency_update_events WHERE update_id='${deniedId}' AND revision=2`),'0');
  check('denied concurrent no receipt',q(`SELECT count(*) FROM agency_private.agency_operation_receipts WHERE update_id='${deniedId}' AND action='activate_non_closure'`),'0');
  const sixtyFirst=request(org.a,'activate_non_closure',{},rateIds[60],1);
  status('sequential 61st rate limited',command('approver',sixtyFirst),'rate_limited');
  status('same token while full remains rate limited',command('approver',sixtyFirst),'rate_limited');
  status('different admin cannot bypass organization quota',command('admin',request(org.a,
    'activate_non_closure',{},rateIds[60],1)),'rate_limited');
  check('61st pending state intact',q(`SELECT status||'|'||revision FROM agency_private.agency_updates WHERE id='${rateIds[60]}'`),'pending_review|1');
  check('61st no activation event',q(`SELECT count(*) FROM agency_private.agency_update_events WHERE update_id='${rateIds[60]}' AND revision=2`),'0');
  check('61st no accepted receipt',q(`SELECT count(*) FROM agency_private.agency_operation_receipts WHERE update_id='${rateIds[60]}' AND action='activate_non_closure'`),'0');
  const roadAtLimit=pending(org.a,'author',{...base,condition_type:'road_closed',title:'Synthetic road closure'});
  status('road closure activation also rate limited',command('approver',request(org.a,
    'activate_road_closed',{},roadAtLimit,1)),'rate_limited');
  check('road closure remains pending at limit',q(`SELECT status FROM agency_private.agency_updates WHERE id='${roadAtLimit}'`),'pending_review');
  check('road closure has no activation event at limit',q(`SELECT count(*) FROM agency_private.agency_update_events
    WHERE update_id='${roadAtLimit}' AND revision=2`),'0');
  status('active edit exempt at limit',command('approver',request(org.a,
    'edit_active_update',{...base,title:'At-quota safe edit'},first,4)),'accepted');
  check('active edit does not consume capacity',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'60');
  gate(false);
  status('false publishing gate remains independent at quota',command('approver',request(org.a,
    'activate_road_closed',{},roadAtLimit,1)),'maintenance');
  check('false gate does not consume pending road closure',q(`SELECT status FROM agency_private.agency_updates
    WHERE id='${roadAtLimit}'`),'pending_review');
  status('resolve exempt at limit and gate off',command('approver',request(org.a,
    'resolve_update',{reason:'Synthetic resolution'},first,5)),'accepted');
  const acceptedConcurrentId=concurrentRequests[concurrentResults.findIndex(r=>r.status==='accepted')].update_id;
  status('withdraw exempt at limit and gate off',command('approver',request(org.a,
    'withdraw_update',{reason:'Synthetic withdrawal'},acceptedConcurrentId,2)),'accepted');
  check('resolve disappears',doc(first),null);
  check('withdraw disappears',doc(acceptedConcurrentId),null);
  check('terminal actions do not restore quota',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'60');
  gate(true);
  const fixed=q('SELECT clock_timestamp()');
  const edges=[3599,3600,3660].map((seconds,i)=>({id:randomUUID(),seconds,i}));
  for(const edge of edges) {
    q(`INSERT INTO agency_private.agency_updates
      (id,organization_id,author_user_id,created_authority_id,current_authority_id,
        condition_type,impact_level,title,point,status,revision,activated_at,updated_at,
        expires_at,activation_operation_epoch)
      VALUES ('${edge.id}','${org.b}','${ids.authorB}','${authorityB}','${authorityB}',
        'obstruction','moderate','Window edge ${edge.i}',
        public.ST_SetSRID(public.ST_MakePoint(${lonB},${latB}),4326),'active',2,
        ${quote(fixed)}::timestamptz-interval '${edge.seconds} seconds',
        ${quote(fixed)}::timestamptz,${quote(fixed)}::timestamptz+interval '12 hours',0)`);
    q(`INSERT INTO agency_private.agency_update_events
      (update_id,organization_id,actor_user_id,authority_id,action,previous_snapshot,new_snapshot,revision)
      VALUES ('${edge.id}','${org.b}','${ids.approverB}','${authorityB}','update_activated',
        '{"status":"pending_review"}'::jsonb,'{"status":"active","revision":2}'::jsonb,2)`);
  }
  check('rolling edge counts only 59m59s candidate',q(`SELECT agency_private.phase7_recent_activation_count('${org.b}',${quote(fixed)}::timestamptz)`),'3');
  check('exact 60m edge excluded',q(`SELECT activated_at>${quote(fixed)}::timestamptz-interval '60 minutes'
    FROM agency_private.agency_updates WHERE id='${edges[1].id}'`),'f');
  check('older than 60m excluded',q(`SELECT activated_at>${quote(fixed)}::timestamptz-interval '60 minutes'
    FROM agency_private.agency_updates WHERE id='${edges[2].id}'`),'f');
  check('other org does not consume A quota',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'60');
  const ageId=rateIds[0];
  const ageRevision=Number(q(`UPDATE agency_private.agency_updates SET
    activated_at=clock_timestamp()-interval '61 minutes',updated_at=clock_timestamp(),
    revision=revision+1 WHERE id='${ageId}' RETURNING revision`));
  q(`INSERT INTO agency_private.agency_update_events
    (update_id,organization_id,actor_user_id,authority_id,action,
      previous_snapshot,new_snapshot,revision)
    VALUES ('${ageId}','${org.a}','${ids.approver}','${authorityA}','update_edited',
      '{"status":"active"}'::jsonb,jsonb_build_object('status','active','revision',${ageRevision}),
      ${ageRevision})`);
  check('capacity returns after oldest activation ages out',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'59');
  status('formerly limited token accepted after recovery',command('approver',sixtyFirst),'accepted');
  check('rate count returns to 60',q(`SELECT agency_private.phase7_recent_activation_count('${org.a}',clock_timestamp())`),'60');
  q('CREATE TABLE public.phase7_unrelated_source_marker (id integer PRIMARY KEY, label text NOT NULL)');
  q("INSERT INTO public.phase7_unrelated_source_marker VALUES (1,'COMMUNITY fixture unchanged')");
  check('org B post visible before suspension',doc(initialB)?.source_family,'AGENCY_OFFICIAL');
  status('org B suspended transactionally',governance(org.b,'suspend_organization',0),'accepted');
  check('org B post hidden after suspension',doc(initialB),null);
  check('org B private post withdrawn',q(`SELECT status FROM agency_private.agency_updates WHERE id='${initialB}'`),'withdrawn');
  check('org B withdrawal event retained',q(`SELECT count(*) FROM agency_private.agency_update_events WHERE update_id='${initialB}' AND action='update_withdrawn'`),'1');
  check('unrelated source fixture unchanged',q('SELECT label FROM public.phase7_unrelated_source_marker WHERE id=1'),'COMMUNITY fixture unchanged');
  check('agency row cannot spoof COMMUNITY source',psql(database,['-c',`INSERT INTO agency_private.agency_updates
    (organization_id,author_user_id,created_authority_id,condition_type,
      impact_level,title,point,source_family)
    VALUES ('${org.a}','${ids.author}','${authorityA}','obstruction','moderate',
      'Spoof',public.ST_SetSRID(public.ST_MakePoint(${lon},${lat}),4326),'COMMUNITY')`],owner,true).status!==0,true);
  status('org B reinstated',governance(org.b,'reinstate_organization',1),'accepted');
  check('reinstatement does not republish withdrawn post',doc(initialB),null);
  const revoke={contract_version:'responder.agency.v1.phase0.1',action:'revoke_authority',
    operation_token:randomUUID(),organization_id:org.b,expected_revision:2,
    payload:{reason:'Synthetic authority revocation',authority_id:authorityB}};
  status('authority revocation after reinstatement',JSON.parse(q(`SELECT agency_private.phase6_governance_command(
    ${quote(JSON.stringify(revoke))}::jsonb)`,roles.governance)),'accepted');
  check('revoked authority stays revoked',q(`SELECT status FROM agency_private.organization_authorities
    WHERE id='${authorityB}'`),'revoked');
  check('revocation does not restore old public post',doc(initialB),null);
  gate(false);
  check('final publishing gate false',q('SELECT agency_publishing_enabled FROM agency_private.agency_program_controls'),'f');
  check('final public view empty',q('SELECT count(*) FROM responder_public.agency_updates',roles.public),'0');
  check('rate index present',q("SELECT count(*) FROM pg_indexes WHERE schemaname='agency_private' AND indexname='phase7_activation_rate_idx'"),'1');
  check('existing org/status/expiry and authority indexes retained',q(`SELECT count(*) FROM pg_indexes
    WHERE schemaname='agency_private' AND indexname IN
      ('updates_org_status_expiry_idx','authorities_org_status_dates_idx','authorities_geometry_gist_idx')`),'3');
  const plan=JSON.parse(q('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT count(*) FROM responder_public.agency_updates',roles.public));
  check('bounded projection plan executes',plan[0].Plan['Actual Rows']>=1,true);
  check('bounded fixture projection under five seconds',plan[0]['Execution Time']<5000,true);
} catch(e) {
  failed++; console.error(`FAIL unhandled: ${e.stack||e.message}`);
} finally {
  if(created) {
    try { psql('postgres',['-c',`DROP DATABASE ${database} WITH (FORCE)`]); created=false; }
    catch(e) {failed++;console.error(`DATABASE CLEANUP FAILED ${e.message}`);}
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
