const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {randomUUID,webcrypto,createHash}=require('node:crypto');
const protocol=require('../js/gridly-report-protocol.js');
const {renderAuthorization,migrationSql,supersededMigrationSql}=require('./helpers/lp24422a-prelaunch.cjs');

const ROOT=path.resolve(__dirname,'..');
const app=fs.readFileSync(path.join(ROOT,'js/app.js'),'utf8');
const markerStart='/* LP244.29A REPORTING AVAILABILITY RUNTIME START */';
const markerEnd='/* LP244.29A REPORTING AVAILABILITY RUNTIME END */';
const runtimeSource=app.slice(app.indexOf(markerStart),app.indexOf(markerEnd)+markerEnd.length);
const runtimeContext={};
vm.createContext(runtimeContext);
vm.runInContext(`${runtimeSource}\nthis.lp24429a={create:gridlyCreateReportingAvailabilityRuntime,states:GRIDLY_REPORTING_AVAILABILITY_STATES,maxAge:GRIDLY_REPORTING_AVAILABILITY_MAX_AGE_MS};`,runtimeContext);
const runtimeApi=runtimeContext.lp24429a;
const changedAt='2026-09-16T12:00:00.000Z';
const statusResponse=enabled=>({data:{protocol_version:2,reporting_enabled:enabled,changed_at:changedAt}});
const payload=kind=>kind==='create'?{crossing_id:'DOT-24429A'}:{observation_id:randomUUID(),changes:{}};
const memory=()=>{
  const values=new Map();let writes=0,removes=0;
  return {getItem:key=>values.get(key)||null,setItem:(key,value)=>{writes++;values.set(key,value);},removeItem:key=>{removes++;values.delete(key);},raw:key=>values.get(key)||null,counts:()=>({writes,removes})};
};

const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const port=process.env.GRIDLY_TEST_PGPORT||'55441';
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/^PG/i.test(key)));
const database=`gridly_lp24429a_${process.pid}`;
const fixture=fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8');
const availabilityMigration=fs.readFileSync(path.join(ROOT,'supabase/migrations/202609160001_lp24429a_reporting_availability_contract.sql'),'utf8');
function sql(query,{db=database,fail=false}={}) {
  const result=spawnSync(psql,['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db],
    {input:query,encoding:'utf8',env,windowsHide:true,timeout:30000});
  if(fail){assert.notEqual(result.status,0,'statement must fail closed');return result.stderr;}
  assert.equal(result.status,0,result.error?.message||result.stderr);return result.stdout.trim();
}

before(()=>{
  sql(`create database ${database}`,{db:'postgres'});
  sql(fixture);
  sql(renderAuthorization());
  for(const marker of supersededMigrationSql())sql(marker);
  sql(migrationSql());
  sql(availabilityMigration);
  sql(availabilityMigration);
});
after(()=>sql(`drop database if exists ${database} with(force)`,{db:'postgres'}));

test('status RPC is bounded, accurate and callable only by ordinary read clients',()=>{
  for(const role of ['anon','authenticated']){
    const value=JSON.parse(sql(`set role ${role}; select public.get_community_reporting_status()`));
    assert.deepEqual(Object.keys(value).sort(),['changed_at','protocol_version','reporting_enabled']);
    assert.equal(value.protocol_version,2);assert.equal(value.reporting_enabled,false);
    assert.ok(Number.isFinite(Date.parse(value.changed_at)));
  }
  sql('update report_retention.admission_state set reporting_enabled=true,changed_at=clock_timestamp() where singleton');
  assert.equal(JSON.parse(sql('set role anon; select public.get_community_reporting_status()')).reporting_enabled,true);
  sql('update report_retention.admission_state set reporting_enabled=false,changed_at=clock_timestamp() where singleton');
  assert.equal(JSON.parse(sql('set role authenticated; select public.get_community_reporting_status()')).reporting_enabled,false);
});

test('status RPC preserves private-table denial and introduces no write privilege or leaked fields',()=>{
  for(const role of ['anon','authenticated','service_role']){
    assert.equal(sql(`select has_table_privilege('${role}','report_retention.admission_state','SELECT')`),'f');
    assert.equal(sql(`select has_table_privilege('${role}','report_retention.admission_state','INSERT') or has_table_privilege('${role}','report_retention.admission_state','UPDATE') or has_table_privilege('${role}','report_retention.admission_state','DELETE')`),'f');
    sql(`set role ${role}; select * from report_retention.admission_state`,{fail:true});
  }
  sql("set role anon; update report_retention.admission_state set reporting_enabled=true",{fail:true});
  assert.equal(sql("select has_function_privilege('anon','public.get_community_reporting_status()','EXECUTE')||':'||has_function_privilege('authenticated','public.get_community_reporting_status()','EXECUTE')||':'||has_function_privilege('service_role','public.get_community_reporting_status()','EXECUTE')"),'true:true:false');
  assert.equal(sql("select prosecdef::text||':'||provolatile::text||':'||array_to_string(proconfig,',') from pg_proc where oid='public.get_community_reporting_status()'::regprocedure"),'true:s:search_path=pg_catalog');
  assert.doesNotMatch(sql('set role anon; select public.get_community_reporting_status()'),/device_id|reporter|retention|role|secret|crossing_id|detail/i);
});

test('availability state starts UNKNOWN and maps true, false and failure explicitly',async()=>{
  const enabled=runtimeApi.create();
  assert.equal(enabled.snapshot().state,'UNKNOWN');
  assert.equal((await enabled.refresh({rpc:async()=>statusResponse(true)})).state,'ENABLED');
  assert.equal(enabled.snapshot().changedAt,changedAt);
  const disabled=runtimeApi.create();
  assert.equal((await disabled.refresh({rpc:async()=>statusResponse(false)})).state,'DISABLED');
  const unavailable=runtimeApi.create();
  assert.equal((await unavailable.refresh({rpc:async()=>({error:{code:'PGRST202'}})})).state,'UNKNOWN');
  assert.equal((await unavailable.refresh({rpc:async()=>{throw Error('offline');}})).state,'UNKNOWN');
});

test('availability refresh is de-duplicated, bounded to 60 seconds and cannot remain authoritative indefinitely',async()=>{
  let now=1000,calls=0,release;
  const runtime=runtimeApi.create({now:()=>now,maxAgeMs:60000});
  const client={rpc:()=>{calls++;return new Promise(resolve=>{release=resolve;});}};
  const first=runtime.refresh(client),second=runtime.refresh(client);
  assert.equal(calls,1);release(statusResponse(true));
  assert.equal((await first).state,'ENABLED');assert.equal((await second).state,'ENABLED');
  await runtime.refresh({rpc:async()=>{calls++;return statusResponse(true);}});assert.equal(calls,1);
  now=60999;assert.equal(runtime.snapshot().state,'ENABLED');
  now=61000;assert.equal(runtime.snapshot().state,'UNKNOWN');assert.equal(runtime.snapshot().stale,true);
  await runtime.refresh({rpc:async()=>{calls++;return statusResponse(false);}});
  assert.equal(calls,2);assert.equal(runtime.snapshot().state,'DISABLED');
});

test('known disabled blocks create, confirm, edit and clear before protocol begin or writer transport',async()=>{
  let statusCalls=0,writerCalls=0;
  const runtime=runtimeApi.create();
  const storage=memory();
  const client=protocol.create({storage,crypto:webcrypto});
  const transport={rpc:async name=>{
    if(name==='get_community_reporting_status'){statusCalls++;return statusResponse(false);}
    writerCalls++;return {data:{status:'accepted'}};
  }};
  for(const kind of ['create','confirm','edit','clear']){
    const result=await runtime.submit(kind,payload(kind),client,transport,'device');
    assert.deepEqual({...result},{status:'maintenance',blockedBeforeBegin:true});
  }
  assert.equal(statusCalls,1);assert.equal(writerCalls,0);assert.deepEqual(storage.counts(),{writes:0,removes:0});
  let cancelSubmits=0;
  assert.equal((await runtime.submit('cancel',{}, {submit:async()=>{cancelSubmits++;return {status:'accepted'};}},transport,'device')).status,'accepted');
  assert.equal(cancelSubmits,1,'cancellation is not blocked by the new-operation guard');
});

test('UNKNOWN preserves existing behavior for every guarded operation kind',async()=>{
  for(const kind of ['create','confirm','edit','clear']){
    let submits=0;
    const runtime=runtimeApi.create();
    const result=await runtime.submit(kind,payload(kind),{submit:async()=>{submits++;return {status:'accepted'};}},{rpc:async()=>({error:{code:'offline'}})},'device');
    assert.equal(result.status,'accepted');assert.equal(submits,1);
  }
});

test('ENABLED uses protocol v2 unchanged and accepted results still clear pending storage',async()=>{
  for(const kind of ['create','confirm','edit','clear']){
    const storage=memory();let writerCalls=0;
    const client=protocol.create({storage,crypto:webcrypto});
    const transport={rpc:async(name)=>name==='get_community_reporting_status'?statusResponse(true):(writerCalls++,{data:{status:'accepted'}})};
    const result=await runtimeApi.create().submit(kind,payload(kind),client,transport,'device');
    assert.equal(result.status,'accepted');assert.equal(writerCalls,1);assert.equal(storage.raw(protocol.KEY),null);
    assert.deepEqual(storage.counts(),{writes:1,removes:1});
  }
});

test('enabled snapshot followed by server maintenance preserves one UUID and downgrades availability',async()=>{
  const storage=memory();let writerCalls=0;
  const client=protocol.create({storage,crypto:webcrypto});
  const transport={rpc:async(name)=>name==='get_community_reporting_status'?statusResponse(true):(writerCalls++,{data:{status:'maintenance'}})};
  const runtime=runtimeApi.create();
  assert.equal((await runtime.refresh(transport)).state,'ENABLED');
  assert.equal((await runtime.submit('create',payload('create'),client,transport,'device')).status,'maintenance');
  const retained=JSON.parse(storage.raw(protocol.KEY));
  assert.match(retained.id,/^[0-9a-f-]{36}$/);assert.equal(runtime.snapshot().state,'DISABLED');
  const blocked=await runtime.submit('create',payload('create'),client,transport,'device');
  assert.equal(blocked.blockedBeforeBegin,true);assert.equal(JSON.parse(storage.raw(protocol.KEY)).id,retained.id);assert.equal(writerCalls,1);
});

test('disabled startup preserves existing pending identity; retry and cancellation remain callable',async()=>{
  const storage=memory(),client=protocol.create({storage,crypto:webcrypto});
  const maintenance={rpc:async()=>({data:{status:'maintenance'}})};
  assert.equal((await client.submit('create',payload('create'),maintenance,'device')).status,'maintenance');
  const id=JSON.parse(storage.raw(protocol.KEY)).id;
  const runtime=runtimeApi.create();
  assert.equal((await runtime.refresh({rpc:async()=>statusResponse(false)})).state,'DISABLED');
  assert.equal(JSON.parse(storage.raw(protocol.KEY)).id,id);
  assert.equal((await client.retry(maintenance,'device')).status,'maintenance');
  assert.equal(JSON.parse(storage.raw(protocol.KEY)).id,id);
  let cancelledId=null;
  const cancelled=await client.cancel({rpc:async(name,args)=>{assert.equal(name,'cancel_community_operation');cancelledId=args.operation_id;return {data:{status:'cancelled'}};}},'device');
  assert.equal(cancelled.status,'cancelled');assert.equal(cancelledId,id);assert.equal(storage.raw(protocol.KEY),null);
});

test('startup/resume refresh, UX copy and all consumer entry paths use the shared boundary',()=>{
  const mutationAdapter=app.slice(app.indexOf('async function gridlySubmitCommunityMutation('),app.indexOf('async function gridlyInsertWithCountyMetadataFallback('));
  assert.match(app,/gridlyRefreshReportingAvailability\(\{ force: true \}\)\.then\(gridlyRefreshPendingOperationButton\)/);
  assert.match(app,/document\.addEventListener\("visibilitychange"/);
  assert.match(app,/new Set\(\["create", "confirm", "edit", "clear"\]\)/);
  assert.doesNotMatch(app,/gridlyGetCommunityProtocolClient\(\)\.submit\(/);
  assert.match(app,/gridlyGetCommunityProtocolClient\(\)\.retry\(supabaseClient, deviceId\)/);
  assert.match(app,/async function gridlySubmitCommunityMutation[\s\S]*gridlySubmitCommunityOperation\(action,/);
  assert.equal([...mutationAdapter.matchAll(/gridlyReportingResultMessage\(result\)/g)].length,2);
  assert.doesNotMatch(mutationAdapter,/gridlyReportProtocol\.outcome/);
  assert.match(app,/async function gridlyInsertWithCountyMetadataFallback[\s\S]*gridlySubmitCommunityOperation\(isClear \? "clear" : "create"/);
  assert.match(app,/async function createSharedHazardReport[\s\S]*gridlyInsertWithCountyMetadataFallback\(supabaseClient, "reports", row/);
  assert.match(app,/async function createSharedReport[\s\S]*gridlyInsertWithCountyMetadataFallback\(supabaseClient, "reports", row\)/);
  for(const kind of ['blocked','delay','flooded','flooding','debris','crash','other','confirm','cleared','hazard_cleared'])assert.ok(app.includes(kind),`entry-point category ${kind} remains present`);
  assert.ok(app.includes('Community reporting is temporarily unavailable. Please try again later.'));
  assert.match(app,/gridlyReportingSubmissionErrorMessage\(error, "Your report could not be submitted\. Check your connection and try again\."\)/);
});

test('staged Android and browser authorities carry byte-identical availability logic',()=>{
  for(const file of ['js/app.js','js/gridly-report-protocol.js','service-worker.js']){
    const browser=fs.readFileSync(path.join(ROOT,file));
    const android=fs.readFileSync(path.join(ROOT,'android/app/src/main/assets/public',file));
    assert.equal(createHash('sha256').update(android).digest('hex'),createHash('sha256').update(browser).digest('hex'),file);
  }
  const contract=JSON.parse(fs.readFileSync(path.join(ROOT,'android/app/src/main/assets/public/community-submission-contract.json'),'utf8'));
  assert.ok(contract.schema['202609160001_lp24429a_reporting_availability_contract.sql']);
  assert.equal(contract.version,'lp244.33-google-play-compliance');
  assert.ok(contract.schema['20260916183911_google_play_compliance_closure.sql']);
});
