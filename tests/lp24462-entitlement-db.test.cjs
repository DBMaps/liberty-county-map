const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
// Opt-in disposable fixture only; never use a production connection string.
const runDatabase=process.env.GRIDLY_LP24462_LOCAL_DB_TEST==='1';
const dbTest=(name,fn)=>test(name,{skip:!runDatabase},fn);
const root=path.resolve(__dirname,'..'),db='gridly_lp24462_'+process.pid;
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
function sql(query,{database=db,fail=false}={}) {const r=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55462','-U','postgres','-d',database],{input:query,encoding:'utf8',env,windowsHide:true,timeout:20000});if(fail){assert.notEqual(r.status,0);return;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260926205345_lp24462_store_entitlement_cache.sql'),'utf8');
let record;
before(()=>{if(!runDatabase)return;sql('create database '+db,{database:'postgres'});sql("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF; END $$;create schema report_retention;create table report_retention.admission_state(reporting_enabled boolean,protocol_version integer);insert into report_retention.admission_state values(false,2);");sql(migration);
 record=JSON.parse(sql("select json_build_object('platform','apple','environment','production','chain_fingerprint',repeat('a',64),'product_id','com.gridlygo.gridly.monthly','base_plan_id',null,'subscription_state','active','entitlement_state','entitled','current_period_end',clock_timestamp()+interval '1 month','last_verified_at',clock_timestamp(),'verification_source','gridly_server_store_api','error_category','none')"));});
after(()=>{if(runDatabase)sql('drop database if exists '+db+' with(force)',{database:'postgres'});});
function apply(value,role='service_role',fail=false){return sql("set role "+role+";select public.gridly_reconcile_store_entitlement('"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb)",{fail});}
dbTest('migration privacy, RLS, exact function grants and no consumer/token tables',()=>{
 assert.equal(sql("select relrowsecurity from pg_class where oid='subscription_ops.store_entitlements'::regclass"),'t');
 for(const role of ['anon','authenticated']){apply(record,role,true);sql('set role '+role+';select * from subscription_ops.store_entitlements',{fail:true});}
 sql('set role service_role;select * from subscription_ops.store_entitlements',{fail:true});
 assert.equal(sql("select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid in ('public.gridly_reconcile_store_entitlement(jsonb)'::regprocedure,'public.gridly_prune_store_entitlement_cache(integer)'::regprocedure) and a.privilege_type='EXECUTE' and a.grantee not in ('postgres'::regrole::oid,'service_role'::regrole::oid)"),'0');
 const columns=sql("select column_name from information_schema.columns where table_schema='subscription_ops'");assert.doesNotMatch(columns,/receipt|token|email|install|account|device/);
});
dbTest('active apply idempotence does not extend TTL; stale/conflict rejected',()=>{
 assert.equal(apply(record),'t');const time=sql('select cache_expires_at from subscription_ops.store_entitlements');assert.equal(apply(record),'t');assert.equal(sql('select cache_expires_at from subscription_ops.store_entitlements'),time);
 assert.equal(sql('select count(*) from subscription_ops.store_entitlements'),'1');
 assert.equal(apply({...record,last_verified_at:new Date(Date.parse(record.last_verified_at)-1000).toISOString(),subscription_state:'inactive',entitlement_state:'not_entitled'}),'f');
 assert.equal(apply({...record,subscription_state:'inactive',entitlement_state:'not_entitled'}),'f');
});
dbTest('product/environment/state bounds and NULL-period entitlement fail atomically',()=>{
 for(const patch of [{product_id:'other'},{environment:'other'},{current_period_end:null},{entitlement_state:'not_entitled'},{email:'private'},{chain_fingerprint:'raw'},{platform:'google'},{platform:'google',product_id:'gridly_monthly',base_plan_id:null}])apply({...record,...patch},'service_role',true);
 assert.equal(sql('select count(*) from subscription_ops.store_entitlements'),'1');
});
dbTest('sandbox separation, expiry/cancellation/unknown and bounded privacy pruning',()=>{
 for(const [i,patch] of [{environment:'sandbox_test'}, {subscription_state:'canceled_pending_expiry'},
 {subscription_state:'expired',entitlement_state:'not_entitled',current_period_end:new Date(Date.parse(record.last_verified_at)-1).toISOString()},
 {subscription_state:'unknown',entitlement_state:'unknown',current_period_end:null,error_category:'verification_unavailable'}].entries())assert.equal(apply({...record,chain_fingerprint:String(i+1).repeat(64),...patch}),'t');
 assert.equal(sql("set role service_role;select public.gridly_prune_store_entitlement_cache(500)"),'0');
 sql("update subscription_ops.store_entitlements set last_verified_at=transaction_timestamp()-interval '25 hours',cache_expires_at=transaction_timestamp()-interval '1 hour',current_period_end=transaction_timestamp()+interval '1 day' where chain_fingerprint=repeat('a',64)");
 assert.equal(sql("set role service_role;select public.gridly_prune_store_entitlement_cache(1)"),'1');
 sql('set role service_role;select public.gridly_prune_store_entitlement_cache(501)',{fail:true});
 assert.equal(sql('select reporting_enabled::text||protocol_version::text from report_retention.admission_state'),'false2');
});
