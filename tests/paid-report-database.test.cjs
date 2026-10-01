const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {renderAuthorization,migrationSql,supersededMigrationSql,renderRelease,BASELINE_EXPECTED}=require('./helpers/lp24422a-prelaunch.cjs');
const db=`gridly_paid_report_${process.pid}`;
const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const port=process.env.GRIDLY_TEST_PGPORT||'55441';
const env=Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^PG/i.test(name)));
const args=(database=db)=>['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',database];
function sql(query,{database=db,denied=false}={}){
  const result=spawnSync(psql,args(database),{input:query,encoding:'utf8',env,windowsHide:true,timeout:30000});
  if(denied){assert.notEqual(result.status,0);assert.match(result.stderr,/permission denied/);return;}
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
function script(file,vars={}){
  const options=args();for(const [key,value] of Object.entries(vars))options.push('-v',`${key}=${value}`);
  options.push('-f',path.join(__dirname,'..',file));
  const result=spawnSync(psql,options,{encoding:'utf8',env,windowsHide:true,timeout:30000});
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
const report=JSON.stringify({crossing_id:'DOT-123',crossing_name:'Crossing',lat:30,lng:-95,report_type:'blocked',severity:'high',detail:'Fixture'}).replaceAll("'","''");
const submit=token=>`select public.submit_community_observation('${token}','${report}'::jsonb,'fixture-device')`;
before(()=>{
  sql(`create database ${db}`,{database:'postgres'});
  sql(fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8'));
  sql(renderAuthorization());
  for(const marker of supersededMigrationSql())sql(marker);
  sql(migrationSql());
  sql(fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261001132412_paid_reporting_authorization.sql'),'utf8'));
});
after(()=>sql(`drop database if exists ${db} with(force)`,{database:'postgres'}));

test('reporting OFF rejects valid internal writer while raw anonymous calls are denied',()=>{
  const token=randomUUID();
  assert.equal(JSON.parse(sql(`set role service_role; ${submit(token)}`)).status,'maintenance');
  sql(`set role anon; ${submit(token)}`,{denied:true});
  sql(`set role anon; select public.cancel_community_operation('${token}')`,{denied:true});
  assert.equal(sql("select has_function_privilege('anon','public.mutate_community_observation(text,uuid,text,jsonb,text)','EXECUTE')"),'f');
});
test('service-role atomic writer still preserves replay and retention lineage',()=>{
  sql(renderRelease());
  assert.equal(sql("select count(*) from report_retention.admission_events where action='activate'"),'1');
  const token=randomUUID();
  const first=JSON.parse(sql(`set role service_role; ${submit(token)}`));assert.equal(first.status,'accepted');
  assert.equal(JSON.parse(sql(`set role service_role; ${submit(token)}`)).status,'already_processed');
  assert.equal(sql(`select count(*) from report_retention.observation_receipts where report_id='${first.report.id}'`),'1');
  assert.equal(sql(`select count(*) from report_retention.replay_evidence where token_digest=extensions.digest(uuid_send('${token}'::uuid),'sha256')`),'1');
  sql("set role anon; insert into public.reports(crossing_id,crossing_name,lat,lng,report_type,severity) values ('DOT','Crossing',30,-95,'blocked','high')",{denied:true});
});
test('owner suspension is repeatable and preserves accepted reports and lineage',()=>{
  const count=sql('select count(*) from public.reports');
  const receipts=sql('select count(*) from report_retention.observation_receipts');
  const incident=randomUUID();
  script('supabase/retention/suspend-community-reporting.sql',{incident_id:incident});
  script('supabase/retention/suspend-community-reporting.sql',{incident_id:incident});
  assert.equal(sql('select reporting_enabled from report_retention.admission_state where singleton'),'f');
  assert.equal(sql('select count(*) from public.reports'),count);
  assert.equal(sql('select count(*) from report_retention.observation_receipts'),receipts);
  assert.equal(sql(`select count(*) from report_retention.admission_events where event_id='${incident}'`),'1');
});
test('owner resume after suspension preserves lineage and records a distinct audit event',()=>{
  const id=randomUUID();
  script('supabase/retention/resume-community-reporting.sql',{
    resumption_id:id,project_ref:BASELINE_EXPECTED.project_ref,owner_authorization_id:BASELINE_EXPECTED.owner_authorization_id
  });
  assert.equal(sql('select reporting_enabled from report_retention.admission_state where singleton'),'t');
  assert.equal(sql(`select action from report_retention.admission_events where event_id='${id}'`),'resume');
  assert.equal(sql('select count(*) from report_retention.observation_receipts'),'1');
});
