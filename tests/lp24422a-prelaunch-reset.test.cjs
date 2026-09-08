const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const protocol=require('../js/gridly-report-protocol.js');
const {AUTHORIZATION_PATH,BASELINE_EXPECTED,renderAuthorization,renderRelease,migrationSql,supersededMigrationSql}=require('./helpers/lp24422a-prelaunch.cjs');
const reconciliationPlan=JSON.parse(fs.readFileSync(path.join(__dirname,'../supabase/migration-reconciliation/lp24422a-production-plan.json'),'utf8'));

const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const baseEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8');
let database;

function run(query,{db=database,fail=false,args=[]}={}){
  const result=spawnSync(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1',...args,'-h','127.0.0.1','-p','55441','-U','postgres','-d',db],{input:query,encoding:'utf8',env:baseEnv,windowsHide:true,timeout:30000});
  if(fail){assert.notEqual(result.status,0,'operation must fail closed');return result;}
  assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
function authorize(overrides={}){run(renderAuthorization({owner_authorization_id:randomUUID(),...overrides}));}
function migrate(){for(const marker of supersededMigrationSql())run(marker);run(migrationSql());}
function installExposedRlsHook(){
  run(`create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$ begin null; end $$;
    grant execute on function public.rls_auto_enable() to public,anon,authenticated;
    create event trigger gridly_rls_auto_enable on ddl_command_end execute function public.rls_auto_enable();`);
}

beforeEach(()=>{
  database=`gridly_lp24422a_${process.pid}_${randomUUID().replaceAll('-','').slice(0,8)}`;
  run(`create database ${database}`,{db:'postgres'});
  run(fixture);
  installExposedRlsHook();
});
afterEach(()=>run(`drop database if exists ${database} with(force)`,{db:'postgres'}));

test('migration-history reconciliation covers all eleven legacy migrations and fails closed on absent effects',()=>{
  const legacyFiles=fs.readdirSync(path.join(__dirname,'../supabase/migrations'))
    .filter(name=>/^20260/.test(name)&&name<'202609080001_community_report_retention.sql');
  assert.equal(reconciliationPlan.migrations.length,11);
  assert.deepEqual(reconciliationPlan.migrations.map(item=>item.file).sort(),legacyFiles.sort());
  const safe=reconciliationPlan.migrations.filter(item=>item.safeToMarkApplied).map(item=>item.id);
  assert.deepEqual(safe,reconciliationPlan.proposedRepair.markApplied);
  for(const item of reconciliationPlan.migrations){
    assert.ok(item.evidence.length>=2,`${item.id} needs multiple evidence points`);
    if(item.classification==='required-not-applied'){
      assert.equal(item.safeToMarkApplied,false,`${item.id} absent effect must not be marked applied`);
      assert.equal(item.mustExecute,true,`${item.id} absent required effect must execute`);
    }
  }
});

test('exact owner-authorized fingerprint resets only community fixtures and records non-sensitive counts',()=>{
  const missing=spawnSync(psql,['-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',database,'-f',AUTHORIZATION_PATH],{encoding:'utf8',env:baseEnv,windowsHide:true,timeout:30000});
  assert.notEqual(missing.status,0,'psql authorization must require explicit variables');
  authorize();migrate();
  assert.equal(run(`select row(reports,historical_events,writer_events,retention_runs,status,deleted_reports,deleted_historical_events,deleted_writer_events,deleted_retention_runs)::text
    from (select expected_reports reports,expected_historical_events historical_events,expected_writer_events writer_events,expected_retention_runs retention_runs,status,deleted_reports,deleted_historical_events,deleted_writer_events,deleted_retention_runs from gridly_control.prelaunch_reset_authorization) s`),'(7,1,1,1,consumed,7,1,1,1)');
  assert.equal(run(`select (select count(*) from public.reports)+(select count(*) from history_capture.historical_events)+(select count(*) from history_capture.writer_monitoring_events)+(select count(*) from history_capture.retention_runs)+(select count(*) from report_retention.device_links)+(select count(*) from report_retention.replay_evidence)+(select count(*) from report_retention.observation_receipts)+(select count(*) from report_retention.condition_month_counts)`),'0');
  assert.equal(run("select protocol_version||':'||reporting_enabled from report_retention.admission_state"),'2:false');
});

test('exact-count mismatch aborts before deletion or schema transition',()=>{
  authorize({expected_reports:BASELINE_EXPECTED.expected_reports+1});
  const failed=run(migrationSql(),{fail:true});
  assert.match(failed.stderr,/fingerprint mismatch/);
  assert.equal(run("select (select count(*) from reports)||':'||(select count(*) from history_capture.historical_events)||':'||status from gridly_control.prelaunch_reset_authorization"),'7:1:authorized');
  assert.equal(run("select to_regnamespace('report_retention') is null"),'t');
  assert.equal(run("select has_table_privilege('anon','public.reports','INSERT')"),'t');
});

test('forced late failure rolls back reset, security repair, and complete transition',()=>{
  authorize();
  const broken=migrationSql().replace(/\ncommit;\s*$/,"\nselect 1/0;\ncommit;\n");
  const failed=run(broken,{fail:true});
  assert.match(failed.stderr,/division by zero/);
  assert.equal(run("select (select count(*) from reports)||':'||(select count(*) from history_capture.historical_events)||':'||status from gridly_control.prelaunch_reset_authorization"),'7:1:authorized');
  assert.equal(run("select to_regnamespace('report_retention') is null"),'t');
  assert.equal(run("select to_regprocedure('public.rls_auto_enable()') is not null"),'t');
});

test('superseded phases are safe no-op checkpoints and partial application changes no client state',()=>{
  authorize();
  const [first,second]=supersededMigrationSql();
  run(first);
  assert.equal(run("select count(*)||':'||has_table_privilege('anon','public.reports','INSERT') from reports"),'7:true');
  assert.equal(run("select to_regnamespace('report_retention') is null"),'t');
  run(second);
  assert.equal(run("select count(*)||':'||has_table_privilege('anon','public.reports','INSERT') from reports"),'7:true');
  run(migrationSql());
  assert.equal(run("select count(*)||':'||has_table_privilege('anon','public.reports','INSERT') from reports"),'0:false');
});

test('consumed launch guard is irreversible and rejects migration reuse',()=>{
  run(renderAuthorization());migrate();
  assert.match(run(migrationSql(),{fail:true}).stderr,/not explicitly authorized/);
  for(const statement of [
    "update gridly_control.prelaunch_reset_authorization set status='authorized',consumed_at=null",
    'delete from gridly_control.prelaunch_reset_authorization',
    'truncate gridly_control.prelaunch_reset_authorization'
  ]) assert.match(run(statement,{fail:true}).stderr,/permanent|cannot be reused|row violates/);
  assert.equal(run("select status from gridly_control.prelaunch_reset_authorization"),'consumed');
  run(renderRelease());
  assert.equal(run("select a.status||':'||s.reporting_enabled from gridly_control.prelaunch_reset_authorization a cross join report_retention.admission_state s"),'launched:true');
  assert.match(run("update gridly_control.prelaunch_reset_authorization set status='consumed',launched_at=null",{fail:true}).stderr,/cannot be reused/);
  assert.match(run(migrationSql(),{fail:true}).stderr,/not explicitly authorized/);
});

test('exposed RLS hook is removed and ordinary clients cannot invoke an equivalent privileged path',()=>{
  authorize();migrate();
  assert.equal(run("select to_regprocedure('public.rls_auto_enable()') is null"),'t');
  assert.equal(run("select count(*) from pg_event_trigger where evtname='gridly_rls_auto_enable'"),'0');
  assert.match(run('set role anon; select public.rls_auto_enable()',{fail:true}).stderr,/does not exist|permission denied/);
  assert.match(run("set role anon; insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity) values ('DOT','Crossing',30,-95,'blocked','high')",{fail:true}).stderr,/permission denied/);
  assert.equal(JSON.parse(run("set role anon; select public.submit_community_observation('2442200a-0000-4000-8000-000000000002','{\"crossing_id\":\"DOT\",\"crossing_name\":\"Crossing\",\"lat\":30,\"lng\":-95,\"report_type\":\"blocked\",\"severity\":\"high\"}','device')")).status,'maintenance');
  assert.match(run('set role anon; select * from report_retention.admission_state',{fail:true}).stderr,/permission denied/);
});

test('maintenance response preserves the operation and retired clients remain rejected',async()=>{
  const stored=new Map();
  const storage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key)};
  const client={rpc:async()=>({data:{status:'maintenance'}})};
  const reporter=protocol.create({storage,crypto:{randomUUID:()=> '2442200a-0000-4000-8000-000000000003'},now:()=>1});
  assert.equal((await reporter.submit('create',{crossing_id:'DOT'},client,'device')).status,'maintenance');
  assert.equal(reporter.pending().pending,true);
  assert.match(migrationSql(),/revoke insert on public\.reports from public,anon,authenticated,service_role/);
  assert.equal((migrationSql().match(/'status','maintenance'/g)||[]).length,3);
});

test('Cron design uses supported scheduler functions and monitoring fails closed without row data',()=>{
  const activation=fs.readFileSync(path.join(__dirname,'../supabase/retention/activate-community-report-retention.sql'),'utf8');
  const monitor=fs.readFileSync(path.join(__dirname,'../tools/retention/check-report-retention.mjs'),'utf8');
  assert.match(activation,/create extension if not exists pg_cron/);
  assert.match(activation,/cron\.schedule/);
  assert.match(activation,/'\* \* \* \* \*'/);
  assert.doesNotMatch(activation,/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?cron\.job\b/i);
  assert.match(monitor,/overdue_cleanup_count/);
  assert.match(monitor,/breached_deadline_count/);
  assert.match(monitor,/monitor_query_failed/);
  assert.doesNotMatch(monitor,/device_id|select\s+\*\s+from\s+public\.reports/i);
});
