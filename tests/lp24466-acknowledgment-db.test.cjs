const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');const {spawnSync}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
// Opt-in disposable fixture only; never use a production connection string.
const runDatabase=process.env.GRIDLY_LP24466_LOCAL_DB_TEST==='1';
const dbTest=(name,fn)=>test(name,{skip:!runDatabase},fn);
const root=path.resolve(__dirname,'..'),db='gridly_lp24466_'+process.pid;
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
function sql(query,{database=db,fail=false}={}) {const r=spawnSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55462','-U','postgres','-d',database],{input:query,encoding:'utf8',env,windowsHide:true,timeout:20000});if(fail){assert.notEqual(r.status,0);return;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260926205345_lp24462_store_entitlement_cache.sql'),'utf8');

const ackMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260927204849_lp24466_google_acknowledgment_queue.sql'),'utf8');
const extra='lp24466_extra_'+process.pid;
before(()=>{if(!runDatabase)return;sql('create database '+db,{database:'postgres'});sql('create role '+extra,{database:'postgres'});sql("create schema report_retention;create table report_retention.admission_state(reporting_enabled boolean,protocol_version integer);insert into report_retention.admission_state values(false,2);");sql(migration);sql('alter default privileges grant execute on functions to '+extra);sql(ackMigration);});
after(()=>{if(runDatabase){sql('drop database if exists '+db+' with(force)',{database:'postgres'});sql('drop role '+extra,{database:'postgres'});}});
const envName='production',fp='a'.repeat(64),sealed={environment:envName,chain_fingerprint:fp,iv:'A'.repeat(16),ciphertext:'B'.repeat(40),key_version:'test-v1',source_started_at:new Date(Date.now()-1000).toISOString(),provider_deadline_at:new Date(Date.now()+3600000).toISOString()};
const literal=value=>"'"+JSON.stringify(value).replaceAll("'","''")+"'::jsonb";
function cache(fingerprint=fp,period="transaction_timestamp()+interval '1 hour'") {sql("set role service_role;select public.gridly_reconcile_store_entitlement(jsonb_build_object('platform','google','environment','production','chain_fingerprint','"+fingerprint+"','product_id','gridly_monthly','base_plan_id','monthly','subscription_state','active','entitlement_state','entitled','current_period_end',"+period+",'last_verified_at',transaction_timestamp(),'verification_source','gridly_server_store_api','error_category','none'))");}
const enqueue=value=>sql('set role service_role;select public.gridly_enqueue_google_ack('+literal(value)+')');
const claim=(limit=10)=>JSON.parse(sql("set role service_role;select coalesce(json_agg(r),'[]'::json) from public.gridly_claim_google_ack('production',"+limit+",null) r"));
const resolve=(row,outcome='success',category='none')=>sql("set role service_role;select public.gridly_resolve_google_ack('production','"+row.chain_fingerprint+"','"+row.lease+"','"+outcome+"','"+category+"')");
dbTest('exact function ACL removes unexpected default EXECUTE only on new RPCs; private RLS/grants',()=>{
 assert.equal(sql("select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.proname in ('gridly_enqueue_google_ack','gridly_claim_google_ack','gridly_resolve_google_ack','gridly_google_ack_health') and a.grantee not in ('postgres'::regrole::oid,'service_role'::regrole::oid)"),'0');
 for(const role of ['anon','authenticated',extra])sql('set role '+role+';select public.gridly_google_ack_health()',{fail:true});
 for(const role of ['anon','authenticated','service_role',extra])sql('set role '+role+';select * from subscription_ops.google_ack_work',{fail:true});
 assert.equal(sql("select bool_and(relrowsecurity) from pg_class where oid in ('subscription_ops.google_ack_work'::regclass,'subscription_ops.google_ack_health'::regclass)"),'t');
 assert.equal(sql("select count(*) from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a where a.grantee='"+extra+"'::regrole::oid"),'1'); // Unrelated defaults untouched.
});
dbTest('enqueue needs fresh reconciled entitlement; TTL capped by period; duplicate cannot extend',()=>{
 assert.equal(enqueue(sealed),'f');cache();assert.equal(enqueue(sealed),'t');const expiry=sql('select expires_at from subscription_ops.google_ack_work');assert.equal(enqueue({...sealed,ciphertext:'C'.repeat(40)}),'t');assert.equal(sql('select expires_at from subscription_ops.google_ack_work'),expiry);
 assert.equal(sql("select expires_at<=(select current_period_end from subscription_ops.store_entitlements where chain_fingerprint=repeat('a',64)) from subscription_ops.google_ack_work"),'t');
 assert.equal(sql("select ciphertext from subscription_ops.google_ack_work"),'B'.repeat(40));
 for(const patch of [{raw_token:'synthetic'},{iv:'bad'},{ciphertext:'bad'},{environment:'bad'}]){if(patch.environment)assert.equal(enqueue({...sealed,...patch}),'f');else sql('set role service_role;select public.gridly_enqueue_google_ack('+literal({...sealed,...patch})+')',{fail:true});}
});
dbTest('claim lease excludes duplicates; retry survives connection restart; stale completion rejected',()=>{
 let rows=claim();assert.equal(rows.length,1);assert.equal(claim().length,0);assert.equal(resolve({...rows[0],lease:'00000000-0000-0000-0000-000000000000'}),'f');
 assert.equal(resolve(rows[0],'retry','provider_unavailable'),'t');assert.equal(claim().length,0);sql("update subscription_ops.google_ack_work set next_attempt_at=transaction_timestamp()-interval '1 second'");
 const retry=claim()[0];assert.notEqual(retry.lease,rows[0].lease);assert.equal(resolve(rows[0]),'f');assert.equal(resolve(retry),'t');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
 assert.equal(sql("select completed_count from subscription_ops.google_ack_health where environment='production'"),'1');
});
dbTest('process crash reclaims expired lease; denied outcome erases ciphertext',()=>{
 cache();enqueue(sealed);const first=claim()[0];sql("update subscription_ops.google_ack_work set lease_until=transaction_timestamp()-interval '1 second'");const second=claim()[0];assert.notEqual(first.lease,second.lease);assert.equal(resolve(first),'f');assert.equal(resolve(second,'terminal','provider_denial'),'t');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
});
dbTest('bounded privacy health, expiry purge and limits; reporting remains false',()=>{
 cache();enqueue(sealed);sql("update subscription_ops.google_ack_work set source_started_at=transaction_timestamp()-interval '2 hours',created_at=transaction_timestamp()-interval '2 hours',expires_at=transaction_timestamp()-interval '1 hour'");
 const health=JSON.parse(sql('set role service_role;select json_agg(h) from public.gridly_google_ack_health() h'));assert.equal(health.length,2);assert.equal(health[0].overdue_count,1);assert.ok(!JSON.stringify(health).includes(fp));assert.ok(!Object.keys(health[0]).some(k=>/cipher|fingerprint|lease|token|iv/.test(k)));
 assert.equal(claim().length,0);assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');assert.equal(sql("select expired_count from subscription_ops.google_ack_health where environment='production'"),'1');
 for(const bound of [0,11])sql("select public.gridly_claim_google_ack('production',"+bound+",null)",{fail:true});
 assert.equal(sql('select reporting_enabled::text||protocol_version::text from report_retention.admission_state'),'false2');
});
dbTest('real encrypted retry survives fresh queue instance against PostgreSQL RPCs',async()=>{
 const {webcrypto:crypto}=await import('node:crypto'),{normalizeGoogle,cacheRecord}=await import('../supabase/functions/_shared/entitlement/core.mjs'),{tokenCipher,acknowledgmentQueue}=await import('../supabase/functions/_shared/entitlement/acknowledgment.mjs');
 const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']),hmac=await crypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);let failure=true,acknowledged=false;
 const token='synthetic-durable-token',provider={verify:async()=>normalizeGoogle({regionCode:'US',startTime:new Date(Date.now()-1000).toISOString(),subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:acknowledged?'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED':'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:'gridly_monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(Date.now()+3600000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]},{env:'production',token,now:Date.now()}),acknowledge:async()=>{if(failure)throw Error('private');acknowledged=true;}};
 const store={enqueue:async value=>enqueue(value)==='t',claim:async()=>claim(),resolve:async value=>resolve({chain_fingerprint:value.chain_fingerprint,lease:value.lease},value.outcome,value.error_category)==='t'},cachePort={apply:async value=>sql('set role service_role;select public.gridly_reconcile_store_entitlement('+literal(value)+')')==='t'},ports={environment:'production',store,cache:cachePort,cipher:tokenCipher({current:{version:'test-v1',key},crypto}),provider,fingerprintKey:hmac,crypto};
 const record=await provider.verify(),cached=await cacheRecord(record,hmac,crypto);await cachePort.apply(cached);await assert.rejects(()=>acknowledgmentQueue(ports).ensure({token,record,cached}));assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'1');assert.ok(!sql('select row_to_json(w) from subscription_ops.google_ack_work w').includes(token));
 sql("update subscription_ops.google_ack_work set next_attempt_at=transaction_timestamp()-interval '1 second'");failure=false;assert.equal((await acknowledgmentQueue(ports).drain())[0].outcome,'success');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
});

dbTest('LP66B cache is ten minutes/period-capped; fresh denial overrides active cache',()=>{
 cache('d'.repeat(64),"transaction_timestamp()+interval '2 minutes'");
 assert.equal(sql("select cache_expires_at=current_period_end and cache_expires_at<=last_verified_at+interval '10 minutes' from subscription_ops.store_entitlements where chain_fingerprint=repeat('d',64)"),'t');
 sql("set role service_role;select public.gridly_reconcile_store_entitlement(jsonb_build_object('platform','google','environment','production','chain_fingerprint',repeat('d',64),'product_id','gridly_monthly','base_plan_id','monthly','subscription_state','inactive','entitlement_state','not_entitled','current_period_end',transaction_timestamp()+interval '1 hour','last_verified_at',transaction_timestamp(),'verification_source','gridly_server_store_api','error_category','none'))");
 assert.equal(sql("select entitlement_state from subscription_ops.store_entitlements where chain_fingerprint=repeat('d',64)"),'not_entitled');
});
dbTest('LP66B fixed original deadline, one-minute eligibility and key version survive retries',()=>{
 cache();assert.equal(enqueue(sealed),'t');const before=sql('select expires_at from subscription_ops.google_ack_work');
 const row=claim()[0];assert.equal(row.key_version,'test-v1');assert.equal(resolve(row,'retry','credential_unavailable'),'t');
 assert.equal(sql('select expires_at from subscription_ops.google_ack_work'),before);
 assert.equal(sql("select queue_state='retry' and next_attempt_at>transaction_timestamp()+interval '55 seconds' and expires_at<=created_at+interval '1 hour' from subscription_ops.google_ack_work"),'t');
 assert.equal(claim().length,0);sql("update subscription_ops.google_ack_work set next_attempt_at=transaction_timestamp()-interval '1 second'");assert.equal(resolve(claim()[0],'terminal','cipher_invalid'),'t');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
});
dbTest('LP66B independent SQL purge works without cipher/provider; reenqueue cannot reset expired grant deadline',()=>{
 cache();const original=new Date(Date.now()-3660000).toISOString();
 enqueue(sealed);sql("update subscription_ops.google_ack_work set source_started_at=transaction_timestamp()-interval '61 minutes',created_at=transaction_timestamp()-interval '2 minutes',expires_at=transaction_timestamp()-interval '1 minute'");
 const tick=sql("select coalesce(last_completed_at::text,'none') from subscription_ops.google_ack_health where environment='production'");
 assert.equal(sql("set role service_role;select public.gridly_prune_google_ack_work('production',500)"),'1');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
 assert.equal(sql("select coalesce(last_completed_at::text,'none') from subscription_ops.google_ack_health where environment='production'"),tick);
 assert.equal(enqueue({...sealed,source_started_at:original,provider_deadline_at:new Date(Date.now()+3600000).toISOString()}),'f');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
 for(const bound of [0,501])sql("set role service_role;select public.gridly_prune_google_ack_work('production',"+bound+")",{fail:true});
});
dbTest('LP66B terminal outcomes immediately erase token; fixed health has no keys or linkage',()=>{
 for(const category of ['invalid_purchase','subscription_expired','purchase_canceled','provider_denial','cipher_invalid','key_version_unavailable','retry_deadline']){
  cache();enqueue(sealed);assert.equal(resolve(claim()[0],'terminal',category),'t');assert.equal(sql('select count(*) from subscription_ops.google_ack_work'),'0');
 }
 const health=JSON.parse(sql('set role service_role;select json_agg(h) from public.gridly_google_ack_health() h'));assert.equal(health.length,2);assert.ok(health.every(h=>!Object.keys(h).some(k=>/cipher|fingerprint|lease|key_version|token|iv/.test(k))));assert.ok(health.find(h=>h.environment==='production').terminal_count>0);
});
dbTest('LP66B full function/table effective client denial and owner-only private helper',()=>{
 const funcs=["gridly_prune_google_ack_work('production',1)","gridly_complete_google_ack_run('production','none')","gridly_subscription_housekeeping()","gridly_google_ack_health()"];
 for(const role of ['anon','authenticated',extra])for(const f of funcs)sql('set role '+role+';select public.'+f,{fail:true});
 for(const role of ['anon','authenticated','service_role',extra]){
  for(const table of ['google_ack_work','google_ack_health'])for(const verb of ['select * from','delete from','update'])sql('set role '+role+';'+(verb==='update'?'update subscription_ops.'+table+" set environment='production'":verb+' subscription_ops.'+table),{fail:true});
 }
 sql("set role service_role;select subscription_ops.roll_ack_health('production')",{fail:true});
 assert.equal(sql("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a where ((n.nspname='public' and p.proname like 'gridly_%google_ack%') or p.proname in('roll_ack_health','gridly_subscription_housekeeping')) and a.grantee not in('postgres'::regrole::oid,'service_role'::regrole::oid)"),'0');
});
dbTest('LP66B housekeeping atomic failure does not claim success; health evidence rolls after24h',()=>{
 const prior=sql("select last_purge_at from subscription_ops.google_ack_health where environment='production'");
 sql("begin;create or replace function public.gridly_prune_store_entitlement_cache(integer) returns integer language plpgsql security definer set search_path='' as $$ begin raise exception 'synthetic_housekeeping_failure';end $$;select public.gridly_subscription_housekeeping();commit;",{fail:true});
 assert.equal(sql("select last_purge_at from subscription_ops.google_ack_health where environment='production'"),prior);
 sql("update subscription_ops.google_ack_health set window_started_at=transaction_timestamp()-interval '25 hours'");
 assert.equal(sql("set role service_role;select public.gridly_complete_google_ack_run('production','none')"),'t');
 const result=JSON.parse(sql('set role service_role;select row_to_json(h) from public.gridly_subscription_housekeeping() h'));assert.ok(result.queue_purged<=1000&&result.cache_purged<=500);
 assert.equal(sql("select terminal_count::text||expired_count::text from subscription_ops.google_ack_health where environment='production'"),'00');assert.equal(sql('select reporting_enabled::text||protocol_version::text from report_retention.admission_state'),'false2');
});

dbTest('LP66B due, expiry and oldest lookups have matching indexes under once-minute monitor shape',()=>{
 const checks=[
  ["select created_at from subscription_ops.google_ack_work where environment='production' order by created_at limit 1",'google_ack_created'],
  ["select environment,chain_fingerprint from subscription_ops.google_ack_work where environment='production' and expires_at<=transaction_timestamp() order by expires_at limit 500",'google_ack_expiry'],
  ["select environment,chain_fingerprint from subscription_ops.google_ack_work where environment='production' and next_attempt_at<=transaction_timestamp() order by next_attempt_at limit 10",'google_ack_due'],
  ["select platform,environment,chain_fingerprint from subscription_ops.store_entitlements where cache_expires_at<=transaction_timestamp() order by cache_expires_at limit 500",'store_entitlements_cache_expiry']
 ];
 for(const [query,index] of checks){const plan=sql('set enable_seqscan=off;explain '+query);assert.ok(plan.includes(index),index+' missing from '+plan);}
});
