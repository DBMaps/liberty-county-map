const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const Module=require('node:module');
const {randomUUID,webcrypto,randomBytes}=require('node:crypto');
const {spawnSync}=require('node:child_process');
const protocol=require('../js/gridly-report-protocol.js');
const h=require('./helpers/lp24422a-prelaunch.cjs');
// Reuse the committed disposable production-sized fixture without registering its tests.
const filename=path.resolve(__dirname,'lp24423a-production-batch.test.cjs');
const fixtureModule=new Module(filename,module);fixtureModule.filename=filename;
fixtureModule.paths=Module._nodeModulePaths(__dirname);
fixtureModule._compile(fs.readFileSync(filename,'utf8').split("test('mode selection")[0]+
  '\nmodule.exports={setupBaseline,dropDatabase,psql,simpleQuery};',filename);
const fixture=fixtureModule.exports;
const db='gridly_lp24423d_'+process.pid;
const sql=q=>fixture.psql(q,db).stdout;
const lit=v=>v==null?'null':"'"+String(v).replaceAll("'","''")+"'";
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};};
const body=()=>({crossing_id:'hazard-'+randomUUID(),crossing_name:'Synthetic crossing',lat:30,lng:-95,report_type:'flooded',severity:'high',detail:'Synthetic standing water'});
let calls=0;
const transport={rpc:async(name,a)=>{
  calls++;
  const args=name==='submit_community_observation'?[a.submission_token,JSON.stringify(a.report),a.reporter_device_id]
    :name==='mutate_community_observation'?[a.operation_id,a.observation_id,a.action,JSON.stringify(a.changes),a.reporter_device_id]
    :name==='cancel_community_operation'?[a.operation_id]:null;
  assert.ok(args,'only the three committed RPCs are callable');
  return {data:JSON.parse(sql('set role anon; select public.'+name+'('+args.map(lit).join(',')+');'))};
}};
const client=storage=>protocol.create({storage:storage||memory(),crypto:webcrypto});
let report;
before(async()=>{
  fixture.setupBaseline(db);
  assert.match(sql('select version()'),/PostgreSQL 17\.10/);
  const r=await fixture.simpleQuery(h.assembleProductionBatch({...h.PRODUCTION_EXPECTED,owner_authorization_id:randomUUID(),mode:'bootstrap-and-transition'}),db);
  assert.equal(r.ok,true,JSON.stringify(r.errors));
  assert.equal(sql('select extensions.postgis_lib_version()'),'3.6.2');
});
after(()=>fixture.dropDatabase(db));

test('disabled create/mutation/clear/cancellation are truthful and never auto-retry',async()=>{
  for(const kind of ['create','edit','confirm','clear','cancel']){
    const c=client(),before=calls;
    const r=await c.submit(kind,kind==='create'?body():{observation_id:randomUUID()},transport,'synthetic-device');
    assert.equal(r.status,'maintenance');assert.equal(protocol.outcome(r.status).success,false);
    assert.ok(c.pending());await new Promise(resolve=>setTimeout(resolve,20));assert.equal(calls,before+1);
  }
  assert.equal(sql('select count(*) from reports'),'0');
  assert.equal(sql('select count(*) from report_retention.replay_evidence'),'0');
});

test('fixture-only enablement accepts exact client; temporary linkage and deadlines remain private',async()=>{
  sql('update report_retention.admission_state set reporting_enabled=true');
  const r=await client().submit('create',body(),transport,'synthetic-device');
  assert.equal(r.status,'accepted');report=r.report;
  assert.ok(report.id);assert.doesNotMatch(JSON.stringify(r),/synthetic-device|device_id|token_digest/);
  assert.equal(sql("select count(*) from report_retention.device_links where device_id='synthetic-device'"),'1');
  assert.equal(sql('select count(*) from report_retention.observation_receipts'),'1');
  assert.equal(sql("select bool_and(device_id is null and cleanup_after-original_submitted_at=interval '3576 hours' and linkage_deadline-original_submitted_at=interval '4320 hours') from reports"),'t');
});

test('lost response, restart and duplicate retry preserve one token and one consumer report',async()=>{
  const storage=memory(),sent=[];
  const lossy={rpc:async(n,a)=>{sent.push(a.submission_token);await transport.rpc(n,a);throw Error('offline after commit');}};
  assert.equal((await client(storage).submit('create',body(),lossy,'synthetic-device')).status,'retryable_failure');
  const count=sql('select count(*) from reports');
  const restarted=client(storage);
  const result=await restarted.retry({rpc:(n,a)=>{sent.push(a.submission_token);return transport.rpc(n,a);}},'synthetic-device');
  assert.equal(result.status,'already_processed');assert.equal(result.report,null);
  assert.equal(sent[0],sent[1]);assert.equal(sql('select count(*) from reports'),count);assert.equal(restarted.pending(),null);
  assert.ok(!storage.getItem(protocol.KEY));
});

test('mutation, confirmation and clear update the original row without resetting retention',async()=>{
  const before=sql('select row(original_submitted_at,cleanup_after,linkage_deadline)::text from reports where id='+lit(report.id));
  for(const [kind,changes] of [['edit',{detail:'Synthetic corrected detail'}],['confirm',{}],['clear',{}]]){
    const r=await client().submit(kind,{observation_id:report.id,changes},transport,'synthetic-device');
    assert.equal(r.status,'accepted');assert.equal(r.report.id,report.id);
  }
  assert.equal(sql('select report_type from reports where id='+lit(report.id)),'hazard_cleared');
  assert.equal(sql('select row(original_submitted_at,cleanup_after,linkage_deadline)::text from reports where id='+lit(report.id)),before);
});

test('offline/reconnect is manual; cancellation tombstones the same pending identity',async()=>{
  const storage=memory(),c=client(storage);
  await c.submit('create',body(),{rpc:async()=>{throw Error('offline');}},'synthetic-device');
  const p=JSON.parse(storage.getItem(protocol.KEY));
  assert.equal((await c.cancel(transport,'synthetic-device')).status,'cancelled');
  assert.equal(c.pending(),null);
  assert.equal((await transport.rpc('submit_community_observation',{submission_token:p.id,report:p.payload,reporter_device_id:'synthetic-device'})).data.status,'already_processed');
  const reconnect=client();await reconnect.submit('create',body(),{rpc:async()=>{throw Error('offline');}},'synthetic-device');
  assert.equal((await reconnect.retry(transport,'synthetic-device')).status,'accepted');
});

test('stale clients, missing/forged token shapes and legacy direct writes fail closed',async()=>{
  const before=calls;
  assert.equal((await protocol.create({storage:memory(),crypto:webcrypto,protocol_version:1}).submit('create',body(),transport,'synthetic-device')).status,'stale_client');
  assert.equal(calls,before);
  assert.equal((await client().submit('create',body(),{rpc:async()=>({error:{code:'PGRST202'}})},'synthetic-device')).status,'stale_client');
  for(const token of [null,'forged-not-a-uuid'])assert.equal((await transport.rpc('submit_community_observation',{submission_token:token,report:body(),reporter_device_id:'synthetic-device'})).data.status,'invalid_request');
  assert.equal((await transport.rpc('submit_community_observation',{submission_token:randomUUID(),report:{...body(),protocol_version:1},reporter_device_id:'synthetic-device'})).data.status,'invalid_request');
  for(const q of ["insert into reports(crossing_id) values ('synthetic')","insert into history_capture.historical_events(event_type,envelope) values ('report_created','{}')","insert into report_retention.replay_evidence(token_digest) values (null)"])
    assert.match(fixture.psql('set role anon; '+q,db,{fail:true}).stderr,/permission denied/);
});

test('consumer transport strips private fields and device values; stale/maintenance outcomes never claim success',async()=>{
  const r=await client().submit('create',body(),{rpc:async()=>({data:{status:'accepted',report:{id:randomUUID(),device_id:'synthetic-device',detail:'synthetic-device',token_digest:'secret'}}})},'synthetic-device');
  assert.doesNotMatch(JSON.stringify(r),/synthetic-device|device_id|token_digest|secret/);
  for(const status of ['maintenance','stale_client','retryable_failure','gone','forbidden','invalid_request'])assert.equal(protocol.outcome(status).success,false);
});

test('exact UI adapter rejects maintenance and replay without fabricating a marker or using direct writes',async()=>{
  const app=fs.readFileSync(path.resolve(__dirname,'../js/app.js'),'utf8');
  const start=app.indexOf('async function gridlyInsertWithCountyMetadataFallback(');
  const rest=app.slice(start);const end=rest.slice(1).search(/\n(?:async )?function /)+1;
  assert.ok(end>1);
  let result={status:'maintenance'},writes=0,refreshes=0;
  const context={window:{gridlyReportProtocol:protocol},deviceId:'synthetic-device',GRIDLY_DIRECT_FEEDBACK_TABLE:'gridly_feedback',GRIDLY_REPORTS_BASE_INSERT_KEYS:[],
    gridlyPickRowKeys:r=>({...r}),gridlyGetCommunityProtocolClient:()=>({submit:async()=>result}),gridlyRefreshPendingOperationButton:()=>{},loadSharedReports:async()=>refreshes++};
  vm.createContext(context);vm.runInContext(rest.slice(0,end),context);
  const direct={from(){writes++;throw Error('direct write forbidden');}};
  for(const status of ['maintenance','stale_client','retryable_failure','already_processed']){
    result={status};const r=await context.gridlyInsertWithCountyMetadataFallback(direct,'reports',body());
    assert.ok(r.error);assert.equal(r.insertedRow,undefined);
  }
  assert.equal(writes,0);assert.equal(refreshes,1);
  assert.ok((await context.gridlyInsertWithCountyMetadataFallback(direct,'report_retention.device_links',{})).error);
  assert.match(app,/normalizeReports\(\[\{ \.\.\.localRow, \.\.\.insertResult\.insertedRow \}\]\)/);
  assert.match(app,/normalizeReports\(\[\{ \.\.\.row, \.\.\.insertResult\.insertedRow \}\]\)/);
  assert.doesNotMatch(app,/\.from\(["']reports["']\)\s*\.(insert|upsert|update|delete)\(/);
  assert.doesNotMatch(app,/markSubmitStage\([^\n]*\{ duplicateGuardLockKey/,'diagnostics must not expose the device-bearing local lock key');
});

test('legacy history writer cannot be enabled by client options or supplied storage',async()=>{
  let calls=0;
  const root={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/history-capture/historyCaptureWriter.js'),'utf8'),{window:root});
  const r=await root.gridlyPassiveHistoryCaptureWriter.writePhase1AEnvelope({},
    {writesEnabled:true,enabled:true,storageClient:{schema(){calls++;throw Error('legacy history write');}}});
  assert.equal(r.noop,true);assert.equal(r.writesEnabled,false);assert.equal(calls,0);
});

test('exact mutation UI does not call a consumed-token replay a confirmed update',async()=>{
  const app=fs.readFileSync(path.resolve(__dirname,'../js/app.js'),'utf8');
  const source=app.slice(app.indexOf('async function gridlySubmitCommunityMutation('),app.indexOf('async function gridlyInsertWithCountyMetadataFallback('));
  let status='already_processed',message='';
  const ctx={window:{gridlyReportProtocol:protocol},deviceId:'synthetic-device',supabaseClient:transport,
    gridlyGetCommunityProtocolClient:()=>({submit:async()=>({status})}),loadSharedReports:async()=>{},gridlyRefreshPendingOperationButton:()=>{},setConfirmation:m=>message=m};
  vm.createContext(ctx);vm.runInContext(source,ctx);
  for(status of ['already_processed','maintenance','stale_client','forbidden']){
    assert.equal(await ctx.gridlySubmitCommunityMutation('edit',report.id,{}),false);assert.ok(message);
  }
});

test('Level 1 and encrypted Level 2 export only this disposable post-transition fixture',async()=>{
  const exp=await import('../tools/retention/owner-export.mjs'),archive=await import('../tools/retention/owner-archive.mjs');
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'gridly-lp24423d-export-'));
  const from=new Date().toISOString().slice(0,10),to=new Date(Date.now()+86400000).toISOString().slice(0,10);
  try{
    const setup="$p='"+tmp.replaceAll("'","''")+"'; $s=[Security.Principal.WindowsIdentity]::GetCurrent().User; $a=New-Object Security.AccessControl.DirectorySecurity; $a.SetOwner($s); $a.SetAccessRuleProtection($true,$false); $a.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))); [IO.Directory]::SetAccessControl($p,$a)";
    const acl=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',setup],{encoding:'utf8',windowsHide:true});
    assert.equal(acl.status,0,acl.stderr);assert.equal(archive.verifyStorage(tmp).ownerOnly,true);
    const l1=await exp.writeExport(sql(exp.exportSql(from,to)).split('\n'),path.join(tmp,'level1'),{from,to});
    assert.ok(l1.datasets);
    const key=randomBytes(32),dir=path.join(tmp,'level2');
    // Level 2 accepts the UUID-bearing hazard identity only because it retains
    // public.reports.crossing_id provenance. UUIDs in all other content remain
    // subject to failure-closed secret review.
    const l2=await archive.writeArchive(sql(archive.archiveSql(from,to)).split('\n'),dir,{from,to,key});
    assert.equal(l2.level,2);assert.deepEqual(archive.readArchiveManifest(dir,key),l2);
    const plaintext=archive.decryptArchiveBytes(fs.readFileSync(path.join(dir,'reports.jsonl.enc')),key).toString();
    assert.doesNotMatch(plaintext,/synthetic-device|token_digest|owner_authorization_id/);
    assert.ok(l2.datasets.reports.rows>0);
    assert.equal(sql('select (select count(*) from gridly_feedback)||\':\'||(select count(*) from gridly_geocode_cache)||\':\'||(select count(*) from gridly_geocode_provider_state)'),'7:480:2');
  }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
