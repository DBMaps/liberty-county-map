const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto,randomUUID}=require('node:crypto');
const fs=require('node:fs');
const vm=require('node:vm');
const protocol=require('../js/gridly-report-protocol.js');
const report=()=>({crossing_id:'hazard-'+randomUUID(),lat:30.0466,lng:-94.885198,report_type:'flooding',severity:'high'});
function memory(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
const app=fs.readFileSync(require('node:path').join(__dirname,'../js/app.js'),'utf8');
const section=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

test('incomplete creates cannot persist an operation or reach a writer',()=>{
 for(const payload of [{},{crossing_id:'hazard'},{...report(),lat:null},{...report(),lng:181},{...report(),report_type:''}]){
  const storage=memory(),client=protocol.create({storage,crypto:webcrypto});let calls=0;
  assert.throws(()=>client.submit('create',payload,{rpc:async()=>{calls++;}},'device'),/Invalid pending/);
  assert.equal(storage.getItem(protocol.KEY),null);assert.equal(calls,0);
 }
});
test('incomplete saved payload becomes cancellation with its original identity; restart never submits it',async()=>{
 for(const kind of ['create','confirm','edit','clear','unknown'])for(const payload of [{},null,undefined]){
  const storage=memory(),id=randomUUID();storage.setItem(protocol.KEY,JSON.stringify({id,startedAt:1,kind,payload}));
  const client=protocol.create({storage,crypto:webcrypto,now:()=>100});assert.equal(client.pending().kind,'cancel');
  assert.equal(client.pending().recovery,'incomplete');assert.equal(JSON.parse(storage.getItem(protocol.KEY)).id,id);
  assert.equal(storage.getItem(protocol.KEY).includes('payload'),false);
  assert.equal(client.discardUnrecoverable(),false,'a known operation identity cannot be locally discarded');
  let sent;
  const restarted=protocol.create({storage,crypto:webcrypto,now:()=>100});
  assert.equal((await restarted.retry({rpc:async(name,args)=>{sent={name,args};return {data:{status:'cancelled'}};}},'device')).status,'cancelled');
  assert.equal(sent.name,'cancel_community_operation');assert.deepEqual(sent.args,{operation_id:id});assert.equal(restarted.pending(),null);
 }
});
test('corrupt storage requires explicit scoped recovery and leaves unrelated persistence intact',async()=>{
 for(const raw of ['{not-json','null',JSON.stringify({id:'invalid',startedAt:1,kind:'create'})]){
  const storage=memory();storage.setItem(protocol.KEY,raw);storage.setItem('gridlyHome','preserve');
  const client=protocol.create({storage,crypto:webcrypto});assert.equal(client.pending().kind,'unrecoverable');
  let calls=0;assert.equal((await client.retry({rpc:async()=>{calls++;}},'device')).status,'storage_recovery_required');
  assert.equal(calls,0);assert.equal(storage.getItem(protocol.KEY),raw);
  assert.equal(client.discardUnrecoverable(),true);assert.equal(storage.getItem(protocol.KEY),null);assert.equal(storage.getItem('gridlyHome'),'preserve');
 }
});
test('complete failed submission survives restart with the same token and resolves replay without duplication',async()=>{
 const storage=memory(),ids=[],writer=new Set();const payload=report();
 const ambiguous={rpc:async(name,args)=>{ids.push(args.submission_token);writer.add(args.submission_token);throw Error('response lost');}};
 await protocol.create({storage,crypto:webcrypto}).submit('create',payload,ambiguous,'device');
 const saved=storage.getItem(protocol.KEY);assert.ok(saved);assert.equal(saved.includes('device'),false);
 const restarted=protocol.create({storage,crypto:webcrypto});assert.equal(restarted.discardUnrecoverable(),false);
 const result=await restarted.retry({rpc:async(name,args)=>{ids.push(args.submission_token);assert.deepEqual(args.report,payload);return {data:{status:writer.has(args.submission_token)?'already_processed':'accepted'}};}},'device');
 assert.equal(result.status,'already_processed');assert.equal(ids[0],ids[1]);assert.equal(writer.size,1);assert.equal(restarted.pending(),null);
});
test('authorization denial is visible and remains unconfirmed without dropping a valid token',async()=>{
 for(const error of [{code:'REPORT_AUTH_REQUIRED'},{context:{status:403}},{context:{status:401}}]){
  const storage=memory(),client=protocol.create({storage,crypto:webcrypto});
  const result=await client.submit('create',report(),{rpc:async()=>({error})},'device');
  assert.equal(result.status,'authorization_required');assert.match(protocol.outcome(result.status).message,/access.*unconfirmed/i);
  assert.ok(storage.getItem(protocol.KEY));assert.equal(client.pending().kind,'create');
 }
});
test('false-to-true admission does not create a token while disabled and retains existing UUID across maintenance',async()=>{
 const context={};vm.createContext(context);
 vm.runInContext(section('/* LP244.29A REPORTING AVAILABILITY RUNTIME START */','/* LP244.29A REPORTING AVAILABILITY RUNTIME END */')+';this.runtime=gridlyCreateReportingAvailabilityRuntime();',context);
 const storage=memory(),client=protocol.create({storage,crypto:webcrypto});let enabled=false,calls=0;
 const transport={rpc:async name=>name==='get_community_reporting_status'?{data:{protocol_version:2,reporting_enabled:enabled,changed_at:new Date().toISOString()}}:(calls++,{data:{status:enabled?'accepted':'maintenance'}})};
 const blocked=await context.runtime.submit('create',report(),client,transport,'device');assert.equal(blocked.blockedBeforeBegin,true);assert.equal(storage.getItem(protocol.KEY),null);
 enabled=true;await context.runtime.refresh(transport,{force:true});assert.equal((await context.runtime.submit('create',report(),client,transport,'device')).status,'accepted');assert.equal(calls,1);
 enabled=false;await client.submit('create',report(),transport,'device');const id=JSON.parse(storage.getItem(protocol.KEY)).id;
 enabled=true;let retried;await client.retry({rpc:async(name,args)=>{retried=args.submission_token;return {data:{status:'accepted'}};}},'device');assert.equal(retried,id);assert.equal(client.pending(),null);
});
test('24-hour expiry still strips payload and consumes the original UUID, never extending its age',async()=>{
 const storage=memory();let now=1;const client=protocol.create({storage,crypto:webcrypto,now:()=>now});
 await client.submit('create',report(),{rpc:async()=>({error:{}})},'device');const original=JSON.parse(storage.getItem(protocol.KEY));
 now+=protocol.MAX_AGE;assert.equal(client.pending().kind,'cancel');const expired=JSON.parse(storage.getItem(protocol.KEY));assert.equal(expired.id,original.id);assert.equal(expired.startedAt,original.startedAt);assert.equal(expired.payload,undefined);
});
test('storage failure still blocks network and scoped recovery never discards a complete operation',()=>{
 let calls=0;const client=protocol.create({crypto:webcrypto,storage:{getItem:()=>null,setItem(){throw Error('storage');}}});
 assert.throws(()=>client.submit('create',report(),{rpc:()=>{calls++;}},'device'),/storage/);assert.equal(calls,0);
});
test('wall-clock rollback preserves a complete pending operation and cancellation never stores a private payload',async()=>{
 const storage=memory();let now=2000;const client=protocol.create({storage,crypto:webcrypto,now:()=>now});
 await client.submit('create',report(),{rpc:async()=>({error:{}})},'device');const saved=storage.getItem(protocol.KEY);
 now=1000;assert.equal(client.pending().kind,'create');assert.equal(storage.getItem(protocol.KEY),saved);
 const fresh=protocol.create({storage:memory(),crypto:webcrypto});
 assert.throws(()=>fresh.submit('cancel',{device_id:'private'},{rpc:async()=>assert.fail('private cancellation sent')},'device'),/Invalid pending/);
});
test('Retry completion stays confirmed even when the subsequent awareness refresh fails',async()=>{
 const nodes=new Map(),messages=[];let saved={kind:'create',pending:true};
 const context={Object,window:{gridlyReportProtocol:protocol},governedRoadHazardReportDraft:{reviewState:'ready'},supabaseClient:{},deviceId:'fixture-device',
  gridlyGetCommunityProtocolClient:()=>({pending:()=>saved,retry:async()=>{saved=null;return {status:'accepted'};}}),
  gridlyAuthorizedReportTransport:()=>({}),gridlyReportingAvailabilityRuntime:{observeResult(){},snapshot:()=>({state:'ENABLED'})},
  GRIDLY_REPORTING_AVAILABILITY_STATES:{DISABLED:'DISABLED'},closeVisiblePortraitV2ReportSurfaceAfterSubmit(){},
  setConfirmation:(...args)=>messages.push(args),loadSharedReports:async()=>{throw Error('read unavailable');},
  document:{getElementById:id=>nodes.get(id),createElement:()=>({style:{},remove(){nodes.delete(this.id);},removeAttribute(){}}),body:{appendChild:node=>nodes.set(node.id,node)}}};
 vm.createContext(context);vm.runInContext(section('function gridlyRefreshPendingOperationButton()','async function gridlySubmitCommunityMutation('),context);
 context.gridlyRefreshPendingOperationButton();await nodes.get('gridlyRetryPendingReport').onclick();
 assert.equal(saved,null);assert.equal(nodes.size,0);assert.equal(context.governedRoadHazardReportDraft,null);
 assert.match(messages.at(-1)[0],/confirmed.*could not be refreshed/);assert.equal(messages.at(-1)[1],'info');
});
test('timed-out Retry preserves the UUID and a late response cannot remove a newer operation',async()=>{
 const storage=memory(),client=protocol.create({storage,crypto:webcrypto,timeoutMs:5});let release;
 const first=client.submit('create',report(),{rpc:()=>new Promise(resolve=>{release=resolve;})},'device');
 assert.equal((await first).status,'retryable_failure');const original=JSON.parse(storage.getItem(protocol.KEY)).id;
 let retried;await client.retry({rpc:async(name,args)=>{retried=args.submission_token;return {data:{status:'already_processed'}};}},'device');assert.equal(retried,original);
 await client.submit('create',report(),{rpc:async()=>({error:{}})},'device');const newer=storage.getItem(protocol.KEY);
 release({data:{status:'accepted'}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(storage.getItem(protocol.KEY),newer);assert.notEqual(JSON.parse(newer).id,original);
});
