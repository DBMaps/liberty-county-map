// Local owner fixture: the same frozen installation and explicit synthetic memberships used by certification.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
export function localFixture({api,anon,service,docker,project}){
 assert.equal(api,'http://127.0.0.1:54321');assert.match(project,/^gridly-dispatch-auth-[a-f0-9]{12}$/);
 const q=s=>"'"+String(s).replaceAll("'","''")+"'";
 const sql=(input,user='postgres')=>{const r=spawnSync(docker,['--host','npipe:////./pipe/dockerDesktopLinuxEngine','exec','-i','supabase_db_'+project,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1','-U',user,'-d','postgres'],{input,encoding:'utf8',windowsHide:true,maxBuffer:25e6});if(r.status!==0)throw Error('Disposable SQL refused');return r.stdout.trim()};
 const read=name=>readFileSync(new URL(name,import.meta.url),'utf8').replaceAll('\r\n','\n');
const catalog=`SELECT jsonb_build_object(
'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'login',rolcanlogin,'super',rolsuper,'inherit',rolinherit,'bypass',rolbypassrls,'createdb',rolcreatedb,'createrole',rolcreaterole,'replication',rolreplication) ORDER BY rolname) FROM pg_roles),
'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m),
'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'owner',nspowner,'acl',nspacl) ORDER BY nspname) FROM pg_namespace),
'tables',(SELECT jsonb_agg(jsonb_build_object('name',n.nspname||'.'||c.relname,'owner',c.relowner,'acl',c.relacl,'rls',c.relrowsecurity,'forced',c.relforcerowsecurity) ORDER BY n.nspname,c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','dispatch_private','dispatch_audit','dispatch_projection')),
'functions',(SELECT jsonb_agg(jsonb_build_object('name',p.oid::regprocedure::text,'owner',p.proowner,'acl',p.proacl,'body',pg_get_functiondef(p.oid)) ORDER BY p.oid::regprocedure::text) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname LIKE 'dispatch_%' AND p.proname<>'read_authorized_context'),
'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY defaclrole,defaclnamespace,defaclobjtype) FROM pg_default_acl d));`;

 function install(){
  const source=read('../responder/phase29/installer/install.sql');assert.equal(createHash('sha256').update(source).digest('hex'),'2130af65786d4df79287d7ac3dfe033a57cc6b8e0f57d9871f4d087c55f655c9');
  sql('DROP SCHEMA dispatch_api;');sql('ALTER ROLE postgres NOSUPERUSER CREATEDB CREATEROLE BYPASSRLS;','supabase_admin');
  sql("SELECT set_config('dispatch_install.bound_project_ref','cmrrvwgkgjhmdugzhnrh',false);\n"+source);
  const before=sql(catalog);assert.equal(sql("SELECT rolsuper FROM pg_roles WHERE rolname='supabase_admin'"),'t');
  sql(`SELECT set_config('dispatch_local.project',${q(project)},false);\n`+read('context.local.sql'),'supabase_admin');assert.equal(sql(catalog),before);
  for(const name of ['dispatch_private','dispatch_api']){assert.equal(sql(`SELECT has_function_privilege('authenticated','${name}.read_authorized_context()','EXECUTE')`),'t');for(const role of ['anon','service_role'])assert.equal(sql(`SELECT has_function_privilege('${role}','${name}.read_authorized_context()','EXECUTE')`),'f')}
  assert.equal(sql("SELECT has_schema_privilege('dispatch_function_owner','dispatch_private','CREATE')"),'f');
  return {catalogUnchanged:true};
 }
 async function provision(){
  const email='local-owner-'+randomUUID()+'@dispatch.invalid',password=randomBytes(32).toString('base64url');
  const response=await fetch(api+'/auth/v1/admin/users',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({email,password,email_confirm:true})});if(!response.ok)throw Error('Synthetic provisioning refused');const user=await response.json();assert.match(user.id,/^[a-f0-9-]{36}$/);
  const organization=randomUUID(),membership=randomUUID(),units=[randomUUID(),randomUUID()];
  sql(`BEGIN;
   INSERT INTO dispatch_private.profiles(user_id,display_name) VALUES(${q(user.id)},'Synthetic acceptance viewer');
   INSERT INTO dispatch_private.organizations(id,display_name,legal_name,organization_type,status) VALUES('${organization}','Synthetic Acceptance Agency','Synthetic Acceptance Agency','OTHER','ACTIVE');
   INSERT INTO dispatch_private.organization_memberships(id,organization_id,user_id,status,role_template) VALUES('${membership}','${organization}',${q(user.id)},'ACTIVE','VIEWER');
   INSERT INTO dispatch_private.organization_units(id,organization_id,unit_type,name,display_name,status,onboarding_state) VALUES('${units[0]}','${organization}','PUBLIC_WORKS','synthetic-works','Synthetic Public Works','ACTIVE','PRIVATE_PILOT_READY'),('${units[1]}','${organization}','LAW_ENFORCEMENT','synthetic-police','Synthetic Police','ACTIVE','PRIVATE_PILOT_READY');
   INSERT INTO dispatch_private.unit_memberships(organization_id,unit_id,membership_id) VALUES('${organization}','${units[0]}','${membership}'),('${organization}','${units[1]}','${membership}');COMMIT;`);
  assert.equal(sql('SELECT count(*) FROM dispatch_private.capability_grants'),'0');assert.equal(sql('SELECT count(*) FROM dispatch_private.operational_records'),'0');
  return {email,password,userId:user.id,organization,units};
 }
 return {install,provision};
}
