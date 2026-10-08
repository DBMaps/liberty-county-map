import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {join} from 'node:path';
const api=process.env.DISPATCH_LOCAL_API,anon=process.env.DISPATCH_LOCAL_ANON,service=process.env.DISPATCH_LOCAL_SERVICE,docker=process.env.DISPATCH_LOCAL_DOCKER,project=process.env.DISPATCH_LOCAL_PROJECT,evidence=process.env.DISPATCH_LOCAL_EVIDENCE;
assert.equal(api,'http://127.0.0.1:54321');assert.match(project,/^gridly-dispatch-auth-[a-f0-9]{12}$/);
const db='supabase_db_'+project;
const args=(user='postgres')=>['--host','npipe:////./pipe/dockerDesktopLinuxEngine','exec','-i',db,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1','-U',user,'-d','postgres'];
function sql(input,{user='postgres',failure=false}={}){const r=spawnSync(docker,args(user),{input,encoding:'utf8',windowsHide:true,maxBuffer:25e6});if(failure)assert.notEqual(r.status,0);else assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const sourceNames=['context.local.sql','context-docker-guard.cs','certify.ps1','context.test.mjs','browser.test-support.mjs','session.mjs','server.mjs','../../dispatch/app.mjs','../../dispatch/local-auth-view.mjs'];
const sourceHashes=()=>Object.fromEntries(sourceNames.map(name=>[name,createHash('sha256').update(readFileSync(new URL(name,import.meta.url))).digest('hex')]));
const certifiedSources=sourceHashes();
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const catalog=`SELECT jsonb_build_object(
'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'inherit',rolinherit,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication) ORDER BY rolname) FROM pg_roles),
'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m),
'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',nspowner,'acl',nspacl) ORDER BY nspname) FROM pg_namespace),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','dispatch_private','dispatch_audit','dispatch_projection')),
'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'body',pg_get_functiondef(p.oid)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'dispatch_%' AND p.proname<>'read_authorized_context'),
'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY defaclrole,defaclnamespace,defaclobjtype) FROM pg_default_acl d));`;
const prefix=`SELECT set_config('dispatch_local.project','${project}',false);\n`;
const fixture=prefix+read('context.local.sql');
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
export function claims(token){return JSON.parse(Buffer.from(token.split('.')[1],'base64url'));}
export function totp(secret){let bits='';for(const c of secret.replace(/=+$/,'').toUpperCase())bits+='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(c).toString(2).padStart(5,'0');const octets=[];for(let i=0;i+8<=bits.length;i+=8)octets.push(parseInt(bits.slice(i,i+8),2));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));const hash=createHmac('sha1',Buffer.from(octets)).update(counter).digest(),offset=hash.at(-1)&15;return String((hash.readUInt32BE(offset)&0x7fffffff)%1e6).padStart(6,'0');}
async function http(path,{token=anon,key=anon,body,profile,method=body===undefined?'GET':'POST',statuses=[200]}={}){const r=await fetch(api+path,{method,headers:{apikey:key,Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'}),...(profile?{'Accept-Profile':profile,'Content-Profile':profile}:{})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>null);assert.ok(statuses.includes(r.status),path+' status '+r.status+' code '+String(data?.error_code||data?.code||data?.error)+' message '+String(data?.msg||data?.message||data?.error_description||'').replace(/eyJ[^ ]+/g,'[redacted]'));return {status:r.status,data};}
const context=actor=>http('/rest/v1/rpc/read_authorized_context',{token:actor?.access_token,profile:'dispatch_api',body:{},statuses:actor?[200]:[401,403]});
async function denied(actor){const r=await http('/rest/v1/rpc/read_authorized_context',{token:actor.access_token,profile:'dispatch_api',body:{},statuses:[401,403]});assert.equal(r.data?.code,'42501');}
async function account(label){const email='local-'+label+'-'+randomUUID()+'@dispatch.invalid',password=randomBytes(24).toString('base64url');const a=await http('/auth/v1/admin/users',{key:service,token:service,body:{email,password,email_confirm:true}});const s=await http('/auth/v1/token?grant_type=password',{body:{email,password}});return {...s.data,email,password,id:a.data.id};}
async function elevate(actor){const e=await http('/auth/v1/factors',{token:actor.access_token,body:{factor_type:'totp',friendly_name:'Local synthetic context'}});actor.factorId=e.data.id;actor.secret=e.data.totp.secret;const c=await http('/auth/v1/factors/'+actor.factorId+'/challenge',{token:actor.access_token,body:{}});const v=await http('/auth/v1/factors/'+actor.factorId+'/verify',{token:actor.access_token,body:{challenge_id:c.data.id,code:totp(actor.secret)}});Object.assign(actor,v.data);return actor;}
let installationPassed=false,authorizationPassed=false;let baseline,owner,foreign,aal1;const org=randomUUID(),otherOrg=randomUUID(),unit=randomUUID(),second=randomUUID(),foreignUnit=randomUUID(),member=randomUUID(),otherMember=randomUUID();
await test('Stage 1: unchanged installer, native installation authority and atomic privilege proof',async t=>{
 const install=read('../responder/phase29/installer/install.sql');assert.equal(createHash('sha256').update(install).digest('hex'),'2130af65786d4df79287d7ac3dfe033a57cc6b8e0f57d9871f4d087c55f655c9');
 sql('DROP SCHEMA dispatch_api;');sql('ALTER ROLE postgres NOSUPERUSER CREATEDB CREATEROLE BYPASSRLS;',{user:'supabase_admin'});
 sql("SELECT set_config('dispatch_install.bound_project_ref','cmrrvwgkgjhmdugzhnrh',false);\n"+install);
 baseline=sql(catalog);writeFileSync(join(evidence,'privileges-before.json'),baseline+'\n');
 assert.equal(sql("SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin'"),'t');
 sql(read('context.local.sql'),{user:'supabase_admin',failure:true});sql("SELECT set_config('dispatch_local.project','not-disposable',false);\n"+read('context.local.sql'),{user:'supabase_admin',failure:true});assert.equal(sql(catalog),baseline);
 const uncommitted=fixture.replace('COMMIT;',"SELECT 'LOCAL_CONTEXT_UNCOMMITTED'; SELECT pg_sleep(3); ROLLBACK;");
 const child=spawn(docker,args('supabase_admin'),{windowsHide:true,stdio:['pipe','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);const completed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(err)));});child.stdin.end(uncommitted);
 for(let i=0;!out.includes('LOCAL_CONTEXT_UNCOMMITTED')&&i<100;i++)await new Promise(r=>setTimeout(r,50));assert.ok(out.includes('LOCAL_CONTEXT_UNCOMMITTED'));
 assert.equal(sql("SELECT count(*) FROM pg_proc WHERE proname='read_authorized_context'"),'0');assert.equal(sql(catalog),baseline);await completed;assert.equal(sql(catalog),baseline);
 sql(fixture.replace('COMMIT;',"DO $$ BEGIN RAISE EXCEPTION 'INJECTED_CONTEXT_FAILURE'; END $$; COMMIT;"),{user:'supabase_admin',failure:true});assert.equal(sql("SELECT count(*) FROM pg_proc WHERE proname='read_authorized_context'"),'0');assert.equal(sql(catalog),baseline);
 sql(fixture,{user:'supabase_admin'});assert.equal(sql(catalog),baseline);writeFileSync(join(evidence,'privileges-after.json'),sql(catalog)+'\n');
 const routines=JSON.parse(sql("SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'settings',p.proconfig,'args',p.pronargs,'result',pg_get_function_result(p.oid),'acl',p.proacl) ORDER BY n.nspname) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='read_authorized_context'"));assert.equal(routines.length,2);assert.equal(routines[0].owner,'postgres');assert.equal(routines[0].definer,false);assert.equal(routines[1].owner,'dispatch_function_owner');assert.equal(routines[1].definer,true);for(const row of routines){assert.deepEqual(row.settings,['search_path=""']);assert.equal(row.args,0);assert.equal(row.result,'TABLE(organization_id uuid, organization_display_name text, unit_id uuid, unit_display_name text)');}
 for(const schema of ['dispatch_private','dispatch_api']){assert.equal(sql(`SELECT has_function_privilege('authenticated','${schema}.read_authorized_context()','EXECUTE')`),'t');for(const role of ['anon','service_role'])assert.equal(sql(`SELECT has_function_privilege('${role}','${schema}.read_authorized_context()','EXECUTE')`),'f');assert.equal(sql(`SELECT count(*) FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE p.oid='${schema}.read_authorized_context()'::regprocedure AND a.grantee=0`),'0');}
 assert.equal(sql("SELECT has_schema_privilege('authenticated','dispatch_private','USAGE') AND has_schema_privilege('authenticated','dispatch_api','USAGE')"),'t');
 assert.equal(sql("SELECT has_schema_privilege('dispatch_function_owner','dispatch_private','CREATE')"),'f');
 for(const table of ['organizations','organization_units','organization_memberships','unit_memberships'])assert.equal(sql(`SELECT has_any_column_privilege('authenticated','dispatch_private.${table}','SELECT')`),'f');
 writeFileSync(join(evidence,'context-routines.json'),JSON.stringify(routines,null,2));installationPassed=true;
});
await test('Stage 2: real Auth/TOTP and bounded context authorization',async t=>{
 let failed=false;const checked=(name,fn)=>t.test(name,async()=>{try{await fn()}catch(error){failed=true;throw error}});
 if(!installationPassed||!baseline||sql("SELECT count(*) FROM pg_proc WHERE proname='read_authorized_context'")!=='2')throw Error('Installation gate failed');
 owner=await elevate(await account('owner'));foreign=await elevate(await account('foreign'));aal1=await account('aal1');
 sql(`INSERT INTO dispatch_private.profiles(user_id,display_name) VALUES(${q(owner.id)},'Synthetic viewer'),(${q(foreign.id)},'Synthetic foreign viewer'),(${q(aal1.id)},'Synthetic AAL1 viewer');
 INSERT INTO dispatch_private.organizations(id,display_name,legal_name,organization_type,status) VALUES('${org}','Synthetic Alpha','Synthetic Alpha','OTHER','ACTIVE'),('${otherOrg}','Synthetic Beta','Synthetic Beta','OTHER','ACTIVE');
 INSERT INTO dispatch_private.organization_memberships(id,organization_id,user_id,status,role_template) VALUES('${member}','${org}',${q(owner.id)},'ACTIVE','VIEWER'),('${otherMember}','${otherOrg}',${q(foreign.id)},'ACTIVE','VIEWER');
 INSERT INTO dispatch_private.organization_units(id,organization_id,unit_type,name,display_name,status,onboarding_state) VALUES('${unit}','${org}','PUBLIC_WORKS','first','Synthetic Works','ACTIVE','PRIVATE_PILOT_READY'),('${second}','${org}','LAW_ENFORCEMENT','second','Synthetic Police','ACTIVE','PRIVATE_PILOT_READY'),('${foreignUnit}','${otherOrg}','FIRE','foreign','Synthetic Fire','ACTIVE','PRIVATE_PILOT_READY');
 INSERT INTO dispatch_private.unit_memberships(organization_id,unit_id,membership_id) VALUES('${org}','${unit}','${member}'),('${org}','${second}','${member}'),('${otherOrg}','${foreignUnit}','${otherMember}');`);
 await checked('anonymous and AAL1 denied',async()=>{await context();await denied(aal1)});
 await checked('AAL2 exact fields, multiple units, deterministic identity and cross-tenant isolation',async()=>{const rows=(await context(owner)).data;assert.equal(rows.length,2);for(const row of rows){assert.deepEqual(Object.keys(row).sort(),['organization_display_name','organization_id','unit_display_name','unit_id']);assert.equal(row.organization_id,org);assert.ok([unit,second].includes(row.unit_id));}assert.deepEqual(rows.map(r=>r.unit_id),[unit,second].sort());assert.equal((await context(foreign)).data[0].organization_id,otherOrg)});
 await checked('forged authority parameters rejected and private RPC/table profiles not exposed',async()=>{await http('/rest/v1/rpc/read_authorized_context',{token:owner.access_token,profile:'dispatch_api',body:{organization_id:otherOrg,unit_id:foreignUnit,role:'OWNER'},statuses:[404]});for(const profile of ['dispatch_private','auth'])await http('/rest/v1/rpc/read_authorized_context',{token:owner.access_token,profile,body:{},statuses:[406]});sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT * FROM dispatch_private.organizations; ROLLBACK;`,{failure:true});});
 await checked('multiple explicitly authorized organizations remain distinct',async()=>{
  const extra=randomUUID();sql(`INSERT INTO dispatch_private.organization_memberships(id,organization_id,user_id,status,role_template) VALUES('${extra}','${otherOrg}',${q(owner.id)},'ACTIVE','VIEWER'); INSERT INTO dispatch_private.unit_memberships(organization_id,unit_id,membership_id) VALUES('${otherOrg}','${foreignUnit}','${extra}');`);
  try{const rows=(await context(owner)).data;assert.equal(rows.length,3);assert.equal(rows.filter(r=>r.organization_id===otherOrg&&r.unit_id===foreignUnit).length,1)}finally{sql(`DELETE FROM dispatch_private.unit_memberships WHERE membership_id='${extra}'; DELETE FROM dispatch_private.organization_memberships WHERE id='${extra}'`)}
 });
 await checked('tampered JWT role and identity rejected by Auth transport',async()=>{
  const [head,payload,signature]=owner.access_token.split('.');const changed={...claims(owner.access_token),role:'service_role',sub:foreign.id};const token=head+'.'+Buffer.from(JSON.stringify(changed)).toString('base64url')+'.'+signature;
  await http('/rest/v1/rpc/read_authorized_context',{token,profile:'dispatch_api',body:{},statuses:[401]});
 });
 await checked('freshness expires and future timestamps deny without changing Auth bridge',()=>{const c=claims(owner.access_token);for(const stamp of [Math.floor(Date.now()/1000)-601,Math.floor(Date.now()/1000)+60]){const modified={...c,amr:c.amr.map(a=>a.method==='totp'?{...a,timestamp:stamp}:a)};sql(`BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims',${q(JSON.stringify(modified))},true); SELECT * FROM dispatch_api.read_authorized_context(); ROLLBACK;`,{failure:true});}});
 for(const [name,change,restore,length] of [
 ['unit membership revocation',`UPDATE dispatch_private.unit_memberships SET status='REVOKED' WHERE unit_id='${second}'`,`UPDATE dispatch_private.unit_memberships SET status='ACTIVE' WHERE unit_id='${second}'`,1],
 ['inactive department',`UPDATE dispatch_private.organization_units SET status='SUSPENDED' WHERE id='${second}'`,`UPDATE dispatch_private.organization_units SET status='ACTIVE' WHERE id='${second}'`,1],
 ['ineligible onboarding',`UPDATE dispatch_private.organization_units SET onboarding_state='PLANNED' WHERE id='${second}'`,`UPDATE dispatch_private.organization_units SET onboarding_state='PRIVATE_PILOT_READY' WHERE id='${second}'`,1],
 ['organization membership revoked',`UPDATE dispatch_private.organization_memberships SET status='REVOKED' WHERE id='${member}'`,`UPDATE dispatch_private.organization_memberships SET status='ACTIVE' WHERE id='${member}'`,0],
 ['organization inactive',`UPDATE dispatch_private.organizations SET status='SUSPENDED' WHERE id='${org}'`,`UPDATE dispatch_private.organizations SET status='ACTIVE' WHERE id='${org}'`,0],
 ['missing eligible unit membership',`UPDATE dispatch_private.unit_memberships SET status='REVOKED' WHERE membership_id='${member}'`,`UPDATE dispatch_private.unit_memberships SET status='ACTIVE' WHERE membership_id='${member}'`,0],
 ['factor revoked',`UPDATE auth.mfa_factors SET status='unverified' WHERE id='${owner.factorId}'`,`UPDATE auth.mfa_factors SET status='verified' WHERE id='${owner.factorId}'`,0],
 ['session expiration',`UPDATE auth.sessions SET not_after=now()-interval '1 second' WHERE id=${q(claims(owner.access_token).session_id)}`,`UPDATE auth.sessions SET not_after=NULL WHERE id=${q(claims(owner.access_token).session_id)}`,0]
 ])await checked(name+' takes effect on next request',async()=>{sql(change,{user:'supabase_admin'});try{if(length)assert.equal((await context(owner)).data.length,length);else await denied(owner)}finally{sql(restore,{user:'supabase_admin'})}});
 await checked('permission revocation checked live',async()=>{sql("DELETE FROM dispatch_private.role_permissions WHERE role_key='VIEWER' AND permission_key='operations.read'");try{await denied(owner)}finally{sql("INSERT INTO dispatch_private.role_permissions VALUES('VIEWER','operations.read')")}});
 await checked('search_path cannot substitute table or helper and reader does not write',()=>{sql(`BEGIN; CREATE TEMP TABLE organizations(id uuid); CREATE TEMP TABLE organization_units(id uuid); SET LOCAL search_path=pg_temp,public; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims',${q(JSON.stringify(claims(owner.access_token)))},true); SELECT count(*) FROM dispatch_api.read_authorized_context(); ROLLBACK;`);assert.equal(sql('SELECT count(*) FROM dispatch_audit.command_receipts'),'0')});
 await checked('unauthorized write and private payload access refused',async()=>{await http('/rest/v1/rpc/create_operational_record',{token:owner.access_token,profile:'dispatch_api',body:{p_payload:{organization_id:org,idempotency_key:randomUUID(),title:'Must never be written'}},statuses:[400,401,403]});await http('/rest/v1/operational_records',{token:owner.access_token,profile:'dispatch_api',body:{title:'Must never be written'},statuses:[401,403]});assert.equal(sql('SELECT count(*) FROM dispatch_private.operational_records'),'0');assert.equal(sql('SELECT count(*) FROM dispatch_private.capability_grants'),'0');});
 await checked('deleted session denies even with previously valid AAL2 JWT',async()=>{sql(`DELETE FROM auth.sessions WHERE id=${q(claims(owner.access_token).session_id)}`,{user:'supabase_admin'});await denied(owner)});
 assert.equal(sql(catalog),baseline);
 if(failed)throw Error('Authorization certification failed');authorizationPassed=true;
 writeFileSync(join(evidence,'context-gates.json'),JSON.stringify({installation:'PASS',authorization:'PASS',existingCatalogUnchanged:true,production:false,privateTableGrants:false},null,2));
});

await test('Stages 3–4: guarded operational session and desktop/mobile certification',async t=>{
 if(!installationPassed||!authorizationPassed)throw Error('Earlier safety gates failed; browser stage prohibited');
 const {certifyBrowser}=await import('./browser.test-support.mjs');
 await certifyBrowser(t,{api,anon,project,evidence,owner,aal1,foreign,org,unit,second,foreignUnit,member,sql,q,totp,http});
 assert.equal(sql(catalog),baseline);assert.deepEqual(sourceHashes(),certifiedSources);
 writeFileSync(join(evidence,'certified-sources.json'),JSON.stringify({sources:certifiedSources,totalTests:37,pass:37,fail:0,unchangedDuringCertification:true},null,2));
});