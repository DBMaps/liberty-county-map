const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {renderAuthorization,migrationSql,supersededMigrationSql,renderRelease}=require('./helpers/lp24422a-prelaunch.cjs');
const db=`gridly_review_${process.pid}`,id='grr_'+'a'.repeat(32),digest='a'.repeat(64),revision='b'.repeat(32);
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261007132857_google_review_access_additive.sql'),'utf8');
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^PG/i.test(name)));
function sql(query,{database=db,denied=false,fails=false}={}) {
  const result=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',database],{input:query,encoding:'utf8',env,windowsHide:true,timeout:30000});
  if(denied||fails){assert.notEqual(result.status,0);if(denied)assert.match(result.stderr,/permission denied/);return result.stderr;}
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
const q=value=>"'"+String(value).replaceAll("'","''")+"'";
const invoke=(action,hash=null,rev=revision,credential=id)=>{
  const value=sql(`set role service_role; select public.gridly_google_review_authorize(${q(action)},${q(credential)},${hash===null?'null':q(hash)},${rev===null?'null':q(rev)})`);
  return value?JSON.parse(value):null;
};
const normalSnapshot=()=>sql("select jsonb_build_object('reports',(select jsonb_agg(to_jsonb(r) order by id) from public.reports r),'admission',(select jsonb_agg(to_jsonb(a)) from report_retention.admission_state a),'replay',(select count(*) from report_retention.replay_evidence))");
before(()=>{
  sql(`create database ${db}`,{database:'postgres'});
  sql(fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8'));sql(renderAuthorization());
  for(const marker of supersededMigrationSql())sql(marker);sql(migrationSql());
  sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261001132412_paid_reporting_authorization.sql'),'utf8'));sql(renderRelease());
});
// Cleanup is confined to this disposable loopback test database.
after(()=>sql(`drop database if exists ${db} with(force)`,{database:'postgres'}));
test('replacement contains only additive objects and four primary-key-bounded updates',()=>{
  const executable=migration.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(executable,/\b(?:delete|drop|truncate|insert)\b/i);
  assert.equal((executable.match(/update google_review\.credentials/gi)||[]).length,4);
  for(const statement of executable.match(/update google_review\.credentials[\s\S]*?;/gi))assert.match(statement,/where id=p_credential\s*;/i);
  assert.doesNotMatch(executable,/cron\.|google_review\.(?:reports|operations|rate_buckets|purge)/i);
});
test('initial migration and rerun preserve all normal data, credential row and function identity',()=>{
  const before=normalSnapshot();sql(migration);assert.equal(normalSnapshot(),before);
  sql(`insert into google_review.credentials(id,credential_hash,revision,enabled) values('${id}','${digest}','${revision}',true)`);
  const row=sql('select to_jsonb(c) from google_review.credentials c'),oid=sql("select 'public.gridly_google_review_authorize(text,text,text,text)'::regprocedure::oid");
  sql(migration);assert.equal(normalSnapshot(),before);assert.equal(sql('select to_jsonb(c) from google_review.credentials c'),row);
  assert.equal(sql("select 'public.gridly_google_review_authorize(text,text,text,text)'::regprocedure::oid"),oid);
  assert.equal(sql("select string_agg(relname,',') from pg_class where relnamespace='google_review'::regnamespace and relkind='r'"),'credentials');
  assert.equal(sql("select to_regprocedure('google_review.purge()') is null"),'t');
});
test('RLS enabled; every client and service-role direct table access denied; RPC service-only',()=>{
  for(const role of ['anon','authenticated','service_role'])sql(`set role ${role}; select * from google_review.credentials`,{denied:true});
  for(const role of ['anon','authenticated'])sql(`set role ${role}; select public.gridly_google_review_authorize('login','${id}','${digest}',null)`,{denied:true});
  assert.equal(sql("select relrowsecurity from pg_class where oid='google_review.credentials'::regclass"),'t');
  assert.equal(sql("select proconfig::text from pg_proc where oid='public.gridly_google_review_authorize(text,text,text,text)'::regprocedure"),'{search_path=pg_catalog}');
});
test('one row rate-limits 60 requests; bad credentials/disabled/rotation fail; metadata-only audit',()=>{
  const before=normalSnapshot();
  assert.equal(invoke('login','c'.repeat(64),null),null);
  assert.deepEqual(invoke('login',digest,null),{credentialId:id,credentialRevision:revision});
  assert.deepEqual(invoke('verified'),{credentialId:id,credentialRevision:revision});
  assert.deepEqual(invoke('report'),{credentialId:id,credentialRevision:revision});
  for(let i=3;i<60;i++)assert.ok(invoke('login',digest,null));
  assert.equal(invoke('login',digest,null),null);assert.equal(invoke('report'),null);
  assert.equal(sql('select count(*) from google_review.credentials'),'1');assert.equal(sql('select attempts from google_review.credentials'),'61');
  sql(`update google_review.credentials set window_started_at=clock_timestamp()-interval '2 minutes' where id='${id}'`);
  assert.ok(invoke('login',digest,null));assert.equal(sql('select attempts from google_review.credentials'),'1');
  sql(`update google_review.credentials set enabled=false where id='${id}'`);assert.equal(invoke('report'),null);
  sql(`update google_review.credentials set enabled=true,revision='${'c'.repeat(32)}' where id='${id}'`);assert.equal(invoke('report'),null);
  assert.ok(invoke('report',null,'c'.repeat(32)));assert.equal(invoke('report',null,'c'.repeat(32),'grr_'+'d'.repeat(32)),null);
  assert.equal(normalSnapshot(),before);assert.equal(sql('select successful_verifications from google_review.credentials'),'1');
});
test('production subscriber writer and its existing replay evidence remain functional',()=>{
  const report={crossing_id:'DOT-fixture',crossing_name:'Production fixture',lat:30,lng:-95,report_type:'blocked',severity:'high'},token=randomUUID();
  const query=`set role service_role; select public.submit_community_observation('${token}',${q(JSON.stringify(report))}::jsonb,'normal-device')`;
  const first=JSON.parse(sql(query));assert.equal(first.status,'accepted');assert.equal(JSON.parse(sql(query)).status,'already_processed');
  const before=normalSnapshot();sql(migration);assert.equal(normalSnapshot(),before);
  assert.equal(sql(`select report_type from public.reports where id='${first.report.id}'`),'blocked');
});
test('rerun aborts when an existing function differs instead of replacing it',()=>{
  sql("alter function public.gridly_google_review_authorize(text,text,text,text) set search_path=public");
  const before=normalSnapshot();assert.match(sql(migration,{fails:true}),/Existing reviewer authority differs/);assert.equal(normalSnapshot(),before);
  assert.equal(sql("select proconfig::text from pg_proc where oid='public.gridly_google_review_authorize(text,text,text,text)'::regprocedure"),'{search_path=public}');
});
