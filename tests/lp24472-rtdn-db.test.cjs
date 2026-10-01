const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const run=process.env.GRIDLY_LP24472_LOCAL_DB_TEST==='1';
const dbTest=(name,fn)=>test(name,{skip:!run},fn);
const root=path.resolve(__dirname,'..'),db='gridly_lp24472_'+process.pid;
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
function sql(query,{database=db,fail=false}={}){
 const result=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',
  ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55462','-U','postgres','-d',database],
  {input:query,encoding:'utf8',env,windowsHide:true,timeout:20000});
 if(fail){assert.notEqual(result.status,0);return;}
 assert.equal(result.status,0,result.stderr);return result.stdout.trim();
}
const migration=name=>fs.readFileSync(path.join(root,'supabase/migrations',name),'utf8');
before(()=>{if(!run)return;
 sql('create database '+db,{database:'postgres'});
 sql("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;create schema report_retention;create table report_retention.admission_state(reporting_enabled boolean,protocol_version integer);insert into report_retention.admission_state values(false,2);");
 for(const file of ['20260926205345_lp24462_store_entitlement_cache.sql','20260927204849_lp24466_google_acknowledgment_queue.sql',
  '20260930210000_lp24471_google_subscription_contract.sql','20260930220000_lp24472_google_rtdn.sql'])sql(migration(file));
});
after(()=>{if(run)sql('drop database if exists '+db+' with(force)',{database:'postgres'});});
const claim=id=>JSON.parse(sql("set role service_role;select public.gridly_claim_google_rtdn('"+id+"')"));
const finish=(id,lease,outcome,category)=>sql("set role service_role;select public.gridly_finish_google_rtdn('"+id+"','"+lease+"','"+outcome+"','"+category+"')");
dbTest('RTDN migration privacy, RLS, exact grants, and no raw token storage',()=>{
 for(const table of ['google_rtdn_receipts','google_rtdn_health']){
  assert.equal(sql("select relrowsecurity from pg_class where oid='subscription_ops."+table+"'::regclass"),'t');
  sql('set role anon;select * from subscription_ops.'+table,{fail:true});
  sql('set role authenticated;select * from subscription_ops.'+table,{fail:true});
  sql('set role service_role;select * from subscription_ops.'+table,{fail:true});
 }
 const columns=sql("select column_name from information_schema.columns where table_schema='subscription_ops' and table_name='google_rtdn_receipts'");
 assert.doesNotMatch(columns,/token|payload|body|order|account|email/);
 for(const name of ['gridly_claim_google_rtdn(text)','gridly_finish_google_rtdn(text,uuid,text,text)',
  'gridly_prune_google_rtdn_receipts(integer)','gridly_google_rtdn_health()']){
  assert.equal(sql("select has_function_privilege('service_role','public."+name+"','EXECUTE')"),'t');
  assert.equal(sql("select has_function_privilege('anon','public."+name+"','EXECUTE')"),'f');
  assert.equal(sql("select has_function_privilege('authenticated','public."+name+"','EXECUTE')"),'f');
 }
});
dbTest('durable claim, duplicate, busy, retry, stale lease and terminal semantics',()=>{
 const first=claim('1001');assert.equal(first.status,'claimed');assert.match(first.lease,/^[a-f0-9-]{36}$/);
 assert.equal(claim('1001').status,'busy');
 assert.equal(finish('1001','00000000-0000-0000-0000-000000000000','done','none'),'f');
 assert.equal(finish('1001',first.lease,'retry','provider_unavailable'),'t');
 const second=claim('1001');assert.equal(second.status,'claimed');assert.notEqual(second.lease,first.lease);
 assert.equal(finish('1001',first.lease,'done','none'),'f');
 assert.equal(finish('1001',second.lease,'done','none'),'t');
 assert.equal(claim('1001').status,'done');
 const invalid=claim('1002');assert.equal(finish('1002',invalid.lease,'terminal','invalid_evidence'),'t');
 assert.equal(claim('1002').status,'terminal');
 assert.equal(sql("select attempts||':'||state from subscription_ops.google_rtdn_receipts where message_id='1001'"),'2:done');
 const health=JSON.parse(sql('set role service_role;select public.gridly_google_rtdn_health()'));
 assert.equal(health.retry_count,1);assert.equal(health.completed_count,1);assert.equal(health.terminal_count,1);
 assert.equal(health.duplicate_count,2);assert.equal(health.busy_count,1);
});
dbTest('RTDN health counters roll at 24 hours without altering completed receipts',()=>{
 sql("update subscription_ops.google_rtdn_health set window_started_at=transaction_timestamp()-interval '25 hours'");
 assert.equal(claim('1001').status,'done');
 const health=JSON.parse(sql('set role service_role;select public.gridly_google_rtdn_health()'));
 assert.equal(health.completed_count,0);assert.equal(health.retry_count,0);
 assert.equal(health.duplicate_count,1);assert.equal(health.busy_count,0);
});
dbTest('receipt bounds, expiry prune and existing housekeeping compatibility',()=>{
 sql("set role service_role;select public.gridly_claim_google_rtdn('not an id')",{fail:true});
 sql("set role service_role;select public.gridly_prune_google_rtdn_receipts(501)",{fail:true});
 assert.equal(sql("select count(*) from subscription_ops.google_rtdn_receipts where expires_at<>first_received_at+interval '31 days'"),'0');
 sql("update subscription_ops.google_rtdn_receipts set first_received_at=transaction_timestamp()-interval '32 days',expires_at=transaction_timestamp()-interval '1 day' where message_id='1001'");
 assert.equal(sql('set role service_role;select public.gridly_prune_google_rtdn_receipts(1)'),'1');
 assert.equal(sql("select count(*) from subscription_ops.google_rtdn_receipts where message_id='1001'"),'0');
 assert.match(sql('set role service_role;select * from public.gridly_subscription_housekeeping()'),/^\d+\|\d+$/);
 assert.equal(sql('select reporting_enabled::text from report_retention.admission_state'),'false');
});
