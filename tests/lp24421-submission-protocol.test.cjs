const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync,spawn}=require('node:child_process');
const {randomUUID,webcrypto}=require('node:crypto');
const protocol=require('../js/gridly-report-protocol.js');
const {renderAuthorization,migrationSql,supersededMigrationSql}=require('./helpers/lp24422a-prelaunch.cjs');
const db=`gridly_protocol_test_${process.pid}`;
const psql=process.env.GRIDLY_TEST_PSQL||'C:/Program Files/PostgreSQL/17/bin/psql.exe';
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/^PG/i.test(k)));
const args=(database=db)=>['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p','55441','-U','postgres','-d',database];
function sql(query,{database=db,denied=false}={}) {
 const r=spawnSync(psql,args(database),{input:query,encoding:'utf8',env,windowsHide:true,timeout:30000});
 if(denied){assert.notEqual(r.status,0);assert.match(r.stderr,/permission denied|Replay evidence is append-only/);return;}
 assert.equal(r.status,0,r.error?.message||r.stderr);return r.stdout.trim();
}
const lit=v=>v===null?'null':"'"+String(v).replaceAll("'","''")+"'";
const body=(extra={})=>({crossing_id:'DOT-123',crossing_name:'Crossing',lat:30,lng:-95,report_type:'blocked',severity:'high',...extra});
const createSQL=(token,b=body(),device='test-device')=>`select public.submit_community_observation(${lit(token)},${lit(JSON.stringify(b))}::jsonb,${lit(device)})`;
const submit=(token,b,device)=>JSON.parse(sql(`set role anon; ${createSQL(token,b,device)}`));
const mutate=(op,id,action,changes={},device='test-device')=>JSON.parse(sql(`set role anon; select public.mutate_community_observation(${lit(op)},${lit(id)}::uuid,${lit(action)},${lit(JSON.stringify(changes))}::jsonb,${lit(device)})`));
before(()=>{
 sql(`create database ${db}`,{database:'postgres'});
 sql(fs.readFileSync(path.join(__dirname,'fixtures/lp24421-baseline.sql'),'utf8'));
 sql(renderAuthorization());
 for(const marker of supersededMigrationSql())sql(marker);
 sql(migrationSql());
 sql("update report_retention.admission_state set reporting_enabled=true,changed_at=clock_timestamp() where singleton");
});
after(()=>sql(`drop database if exists ${db} with(force)`,{database:'postgres'}));

test('UUIDv4 crossing and hazard originals succeed; different tokens allow recurring observations',()=>{
 for(const b of [body(),body({crossing_id:'hazard-'+randomUUID(),report_type:'flooding'})]) {
   const a=submit(randomUUID(),b),c=submit(randomUUID(),b);
   assert.equal(a.status,'accepted');assert.equal(c.status,'accepted');assert.notEqual(a.report.id,c.report.id);
 }
});
test('same token, including uppercase spelling, remains idempotent before and after row/link removal',()=>{
 const token=randomUUID(),original=submit(token),id=original.report.id;
 const clock=sql(`select original_submitted_at||'/'||linkage_deadline from reports where id=${lit(id)}`);
 assert.equal(submit(token.toUpperCase()).status,'already_processed');
 assert.equal(sql(`select original_submitted_at||'/'||linkage_deadline from reports where id=${lit(id)}`),clock);
 sql(`delete from report_retention.device_links where report_id=${lit(id)}`);
 assert.equal(submit(token).status,'already_processed');
 assert.equal(sql(`select count(*) from report_retention.device_links where report_id=${lit(id)}`),'0');
 sql(`delete from reports where id=${lit(id)}`);
 assert.equal(submit(token).status,'already_processed');
 assert.equal(sql(`select count(*) from reports where id=${lit(id)}`),'0');
});
test('concurrent identical RPC requests commit one original and one device link',async()=>{
 const token=randomUUID();
 function run(query){return new Promise((resolve,reject)=>{
   const child=spawn(psql,args(),{env,windowsHide:true});let out='',err='';
   child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);
   child.on('error',reject);child.on('exit',code=>code?reject(Error(err)):resolve(out.trim()));child.stdin.end(query);
 });}
 const query=`begin; set role anon; ${createSQL(token)}; select pg_sleep(0.3); commit;`;
 const results=await Promise.all([run(query),run(query)]);
 assert.deepEqual(results.map(s=>JSON.parse(s.split('\n')[0]).status).sort(),['accepted','already_processed']);
 assert.equal(sql(`select count(*) from report_retention.replay_evidence where token_digest=extensions.digest(uuid_send(${lit(token)}::uuid),'sha256')`),'1');
});
test('legacy/malformed tokens, device-derived hazard IDs and raw-token payloads cannot enter persistent rows',()=>{
 for(const token of [null,'','not-uuid','00000000-0000-1000-8000-000000000000']) assert.equal(submit(token).status,'invalid_request');
 assert.equal(submit(randomUUID(),body({crossing_id:'hazard-test-device-1788888888888'})).status,'retryable_failure');
 const token=randomUUID(); assert.equal(submit(token,body({detail:token})).status,'invalid_request');
 sql(`set role anon; insert into reports(crossing_id,crossing_name,lat,lng,report_type,severity) values ('DOT','Crossing',30,-95,'blocked','high')`,{denied:true});
 assert.equal(sql("select count(*) from reports where crossing_id like 'hazard-test-device-%'"),'0');
});
test('ledger is minimal, private and append-only, including against accidental owner rollback operations',()=>{
 assert.equal(sql("select string_agg(column_name,',' order by ordinal_position) from information_schema.columns where table_schema='report_retention' and table_name='replay_evidence'"),'token_digest,first_accepted_at');
 for(const role of ['anon','authenticated','service_role'])for(const command of ['select * from','delete from','truncate','update']){
   const query=command==='update'?"update report_retention.replay_evidence set first_accepted_at=now()":`${command} report_retention.replay_evidence`;
   sql(`set role ${role}; ${query}`,{denied:true});
 }
 sql("set role anon; insert into report_retention.replay_evidence(token_digest) values (decode(repeat('00',32),'hex'))",{denied:true});
 sql('delete from report_retention.replay_evidence',{denied:true});sql('truncate report_retention.replay_evidence cascade',{denied:true});
 assert.doesNotMatch(sql('select row_to_json(r) from report_retention.replay_evidence r'),/test-device|device_id|crossing_id|detail|submission_token/);
});
test('confirm/edit/clear are separate idempotent operations and never replace the original or its clock',()=>{
 const id=submit(randomUUID()).report.id;
 const clock=sql(`select original_submitted_at||'/'||cleanup_after||'/'||linkage_deadline from reports where id=${lit(id)}`);
 for(const [action,changes]of [['confirm',{}],['edit',{detail:'Updated condition'}],['clear',{}]]){
   const op=randomUUID();assert.equal(mutate(op,id,action,changes).status,'accepted');
   assert.equal(mutate(op,id,action,changes).status,'already_processed');
   assert.equal(sql(`select original_submitted_at||'/'||cleanup_after||'/'||linkage_deadline from reports where id=${lit(id)}`),clock);
 }
 assert.equal(sql(`select count(*) from reports where id=${lit(id)}`),'1');
 assert.equal(mutate(randomUUID(),id,'edit',{},'wrong-device').status,'forbidden');
 sql(`delete from reports where id=${lit(id)}`);
 for(const action of ['confirm','edit','clear']){
   const op=randomUUID();assert.equal(mutate(op,id,action).status,'gone');assert.equal(mutate(op,id,action).status,'already_processed');
 }
 assert.equal(sql(`select count(*) from reports where id=${lit(id)}`),'0');
});
test('day-149 cleanup preserves receipts, rejects later retries and remains idempotent across UTC/DST zones',()=>{
 const token=randomUUID(),id=submit(token).report.id;
 for(const zone of ['UTC','America/Chicago']) assert.equal(sql(`set time zone ${lit(zone)}; select extract(epoch from (linkage_deadline-original_submitted_at))::bigint||'/'||extract(epoch from (cleanup_after-original_submitted_at))::bigint from reports where id=${lit(id)}`),'15552000/12873600');
 const receipts=sql('select count(*) from report_retention.replay_evidence');
 sql(`alter table reports disable trigger report_retention_origin; update reports set original_submitted_at=now()-interval '3576 hours',cleanup_after=now(),linkage_deadline=now()+interval '744 hours' where id=${lit(id)}; alter table reports enable trigger report_retention_origin;`);
 assert.equal(sql('select report_retention.run_cleanup()'),'1');assert.equal(sql('select report_retention.run_cleanup()'),'0');
 assert.equal(sql('select count(*) from report_retention.replay_evidence'),receipts);
 assert.equal(submit(token).status,'already_processed');
 assert.equal(sql(`select count(*) from report_retention.device_links where report_id=${lit(id)}`),'0');
});
test('plaintext tokens never persist in public rows/private links/ledger; cancellation permanently consumes identity',()=>{
 const token=randomUUID();assert.equal(submit(token).status,'accepted');
 for(const table of ['reports','report_retention.device_links','report_retention.replay_evidence'])assert.ok(!sql(`select row_to_json(r) from ${table} r`).includes(token));
 const cancelled=randomUUID();assert.equal(JSON.parse(sql(`set role anon;select public.cancel_community_operation(${lit(cancelled)})`)).status,'cancelled');
 assert.equal(submit(cancelled).status,'already_processed');
});
test('failed transactions do not consume an unaccepted identity; accepted identities survive device-link erasure',()=>{
 const token=randomUUID();assert.equal(submit(token,body({lat:null})).status,'retryable_failure');
 assert.equal(submit(token).status,'accepted');assert.equal(submit(token).status,'already_processed');
});

function memory(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};}
test('secure fallback creates UUIDv4 without Math.random or a device/content input',()=>{
 for(let i=0;i<20;i++)assert.match(protocol.uuid({getRandomValues:a=>webcrypto.getRandomValues(a)}),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
 assert.throws(()=>protocol.uuid({}),/Secure/);
 assert.doesNotMatch(fs.readFileSync(path.join(__dirname,'../js/gridly-report-protocol.js'),'utf8'),/Math\.random/);
});
test('ambiguous response/restart retries reuse one persisted token; terminal response removes payload',async()=>{
 const storage=memory(),sent=[];
 const client={rpc:async(name,args)=>{sent.push(args);if(sent.length===1)throw Error('ambiguous');return {data:{status:'already_processed'}};}};
 const first=protocol.create({storage,crypto:webcrypto});
 assert.equal((await first.submit('create',body(),client,'test-device')).status,'retryable_failure');
 const saved=storage.getItem(protocol.KEY);assert.ok(saved);assert.ok(!saved.includes('test-device'));
 const restarted=protocol.create({storage,crypto:webcrypto});
 assert.equal((await restarted.retry(client,'test-device')).status,'already_processed');
 assert.equal(sent[0].submission_token,sent[1].submission_token);assert.equal(storage.getItem(protocol.KEY),null);
});
test('double tap shares one operation; new observation is explicit after terminal result',async()=>{
 const storage=memory(),sent=[];let release;
 const client={rpc:async(name,args)=>{sent.push(args);return new Promise(r=>release=r);}};
 const instance=protocol.create({storage,crypto:webcrypto});
 const first=instance.submit('create',body(),client,'device'),second=instance.submit('create',body(),client,'device');
 assert.equal(first,second);assert.equal(sent.length,1);release({data:{status:'accepted'}});await first;
 const third=instance.submit('create',body(),client,'device');assert.notEqual(sent[0].submission_token,sent[1].submission_token);release({data:{status:'accepted'}});await third;
});
test('pending mutations reuse operation_id; pending payload expires to token-only cancellation; storage failure blocks send',async()=>{
 const storage=memory();let now=0;const sent=[];
 const client={rpc:async(name,args)=>{sent.push({name,args});return {error:{}};}};
 const instance=protocol.create({storage,crypto:webcrypto,now:()=>now});
 await instance.submit('confirm',{observation_id:randomUUID()},client,'device');await instance.retry(client,'device');
 assert.equal(sent[0].args.operation_id,sent[1].args.operation_id);
 assert.throws(()=>instance.submit('create',body(),client,'device'),/pending/);
 now=protocol.MAX_AGE;await instance.retry(client,'device');
 assert.equal(sent[2].name,'cancel_community_operation');assert.equal(sent[2].args.operation_id,sent[0].args.operation_id);
 assert.ok(!storage.getItem(protocol.KEY).includes('observation_id'));
 const broken=protocol.create({storage:{getItem:()=>null,setItem(){throw Error('storage');}},crypto:webcrypto});
 assert.throws(()=>broken.submit('create',body(),client,'device'),/storage/);
});
