import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {leaseBinding} from '../gateway/foundation/protocol.mjs';
import {nativeFixture} from './fixtures.mjs';
import {createLabelsAttestAdapter} from '../server/labels-attest-adapter.mjs';
import {createNativeAuthorizer} from '../reference/build18/supabase/functions/_shared/entitlement/native-authorization.mjs';
import {createAppleAppAttestVerifier} from '../reference/build18/supabase/functions/_shared/entitlement/apple-app-attest.mjs';
import {nativeVerificationBinding} from '../reference/build18/js/gridly-native-verification-binding.mjs';
const bin=process.env.GRIDLY_LABELS_DISPOSABLE_BIN,data=process.env.GRIDLY_LABELS_DISPOSABLE_ROOT;
if(!data||!bin||process.env.PGHOST!=='127.0.0.1'||!/[\\/]\.scratch[\\/]pg-[a-f0-9]{32}[\\/]data$/.test(data))throw Error('disposable_only');
const exe=resolve(bin,'psql.exe'),args=['-XqwAt','-v','ON_ERROR_STOP=1'];
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
function sql(text,{fail=false}={}){const r=spawnSync(exe,args,{input:text,encoding:'utf8',windowsHide:true,timeout:6000});
 if(fail){assert.notEqual(r.status,0);return r.stderr;}assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
function asyncSql(text){return new Promise((resolve,reject)=>{const p=spawn(exe,args,{windowsHide:true});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('exit',code=>code===0?resolve(out.trim()):reject(Error(err)));p.stdin.end(text);});}
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');
const sha=b=>createHash('sha256').update(b).digest('base64url'),fingerprint=sha('synthetic tile SPKI'),paidDigest=sha('aaa.bbb.ccc');
let owner=0;
function key({environment='production'}={}){const h=(++owner).toString(16).padStart(64,'0');sql(`insert into subscription_ops.apple_app_attest_keys(key_hash,environment,public_spki) values(${q(h)},${q(environment)},${q(Buffer.alloc(91,7).toString('base64'))})`);return h;}
function issue(h,fp=fingerprint,pd=paidDigest){const id=randomUUID();const result=sql(`set role labels_auth_verifier;select labels_auth.issue_challenge(${q(id)},${q(h)},${q(fp)},${q(pd)})`);return result?JSON.parse(result):null;}
function record(id){const s=sql(`set role labels_auth_verifier;select labels_auth.read_challenge(${q(id)})`);return s?JSON.parse(s):null;}
const counter=h=>Number(sql(`select assertion_counter from subscription_ops.apple_app_attest_keys where key_hash=${q(h)}`));
const consumeSQL=(id,h,b,c)=>`set role labels_auth_verifier;select labels_auth.consume_challenge(${q(id)},${q(h)},${q(b)},${c})`;
const consume=(id,h,b,c)=>sql(consumeSQL(id,h,b,c));
const subHash=()=>sha(randomUUID());
function subIssue(hash){return sql(`set role service_role;select public.gridly_issue_native_challenge(${q(hash)},'apple','gridly-subscription-verification-v1',clock_timestamp()+interval '90 seconds')`);}
const subConsumeSQL=(hash,h,c)=>`set role service_role;select public.gridly_consume_native_challenge(${q(hash)},'apple','gridly-subscription-verification-v1','apple_assertion',${q(h)},null,${c})`;
before(()=>{
 assert.equal(resolve(sql('show data_directory')),resolve(data),'refuse any other cluster');
 sql('create role anon;create role authenticated;create role service_role;create schema report_retention;create table report_retention.admission_state(reporting_enabled boolean,protocol_version integer);insert into report_retention.admission_state values(false,2);');
 sql(read('../reference/build18/supabase/migrations/20260926205345_lp24462_store_entitlement_cache.sql'));
 sql(read('../reference/build18/supabase/migrations/20260928030000_lp24466_native_authorization.sql'));
 sql(read('../sql/labels-auth.sql'));
});
test('unchanged subscription issue, initial registration and assertion consumption advance the one registry',()=>{
 const hash=subHash(),h='f'.repeat(64),spki=Buffer.alloc(91,3).toString('base64');assert.equal(subIssue(hash),'t');
 assert.equal(sql(`set role service_role;select public.gridly_consume_native_challenge(${q(hash)},'apple','gridly-subscription-verification-v1','apple_initial',${q(h)},${q(spki)},0)`),'t');
 const next=subHash();assert.equal(subIssue(next),'t');assert.equal(sql(subConsumeSQL(next,h,1)),'t');assert.equal(counter(h),1);assert.equal(sql(subConsumeSQL(next,h,2)),'f');
});
test('labels issue/read pins context and canonical binding to paid bytes and tile SPKI',()=>{
 const h=key(),issued=issue(h),r=record(issued.challengeId);assert.equal(r.keyHash,h);assert.equal(r.appId,'2XSH6R7K37.com.gridlygo.gridly');
 assert.equal(r.store,'sandbox');assert.equal(r.attest,'production');assert.equal(r.purpose,'gridly-labels-lease-v1');
 assert.equal(r.binding,leaseBinding({appId:'com.gridlygo.gridly',challengeId:r.challengeId,paidEvidence:'aaa.bbb.ccc',fingerprint,store:'sandbox',attest:'production'}));
 assert.ok(r.expiresAt>Date.now()&&r.expiresAt<=Date.now()+120000);
 assert.equal(consume(r.challengeId,h,r.binding,1),'t');assert.equal(counter(h),1);assert.equal(record(r.challengeId),null);
});
test('unknown/unregistered and development keys cannot issue labels challenges',()=>{assert.equal(issue('e'.repeat(64)),null);assert.equal(issue(key({environment:'development'})),null);});
test('cross-purpose and unknown-purpose requests fail without widening old constraints',()=>{
 const h=key(),id=issue(h).challengeId,r=record(id),hash=subHash();assert.equal(subIssue(hash),'t');
 assert.equal(sql(`set role service_role;select public.gridly_issue_native_challenge(${q(subHash())},'apple','gridly-labels-lease-v1',clock_timestamp()+interval '1 minute')`),'f');
 for(const purpose of ['gridly-labels-lease-v1','arbitrary',''])assert.equal(sql(`set role service_role;select public.gridly_consume_native_challenge(${q(hash)},'apple',${q(purpose)},'apple_assertion',${q(h)},null,1)`),'f');
 assert.equal(consume(randomUUID(),h,r.binding,1),'f');
 sql(`insert into subscription_ops.native_challenges(challenge_hash,platform,purpose,expires_at) values(${q(subHash())},'apple','gridly-labels-lease-v1',clock_timestamp()+interval '1 minute')`,{fail:true});assert.equal(counter(h),0);
});
test('owner, evidence/key binding, zero/stale/out-of-range and duplicate consumption reject',()=>{
 const h=key(),id=issue(h).challengeId,r=record(id),other=key();
 for(const [who,b,c] of [[other,r.binding,1],[h,sha('changed tile'),1],[h,sha('changed paid'),1],[h,r.binding,0],[h,r.binding,-1],[h,r.binding,4294967296]])assert.equal(consume(id,who,b,c),'f');
 assert.equal(counter(h),0);assert.equal(consume(id,h,r.binding,2),'t');assert.equal(consume(id,h,r.binding,3),'f');
 const second=issue(h).challengeId,s=record(second);assert.equal(consume(second,h,s.binding,1),'f');assert.equal(counter(h),2);
});
for(const [column,value] of [['purpose','unknown'],['app_id','com.gridlygo.prototype.labeltiles.pilot'],['store_environment','production'],['attest_environment','development']])
 test(`database rejects wrong ${column} without counter change`,()=>{const h=key(),id=issue(h).challengeId;sql(`update labels_auth.challenges set ${column}=${q(value)} where id=${q(id)}`,{fail:true});assert.equal(counter(h),0);});
test('expired challenge fails read and consume',()=>{const h=key(),id=issue(h).challengeId,r=record(id);sql(`update labels_auth.challenges set created_at=clock_timestamp()-interval '90 seconds',expires_at=clock_timestamp()-interval '1 second' where id=${q(id)}`);assert.equal(record(id),null);assert.equal(consume(id,h,r.binding,1),'f');assert.equal(counter(h),0);});
test('independent subscription/labels connections race the SAME counter: exactly one wins',async()=>{
 const h=key(),hash=subHash(),id=issue(h).challengeId,r=record(id);subIssue(hash);
 const results=await Promise.all([asyncSql(subConsumeSQL(hash,h,1)),asyncSql(consumeSQL(id,h,r.binding,1))]);assert.deepEqual(results.sort(),['f','t']);assert.equal(counter(h),1);
});
test('independent duplicate labels submissions cannot both consume',async()=>{const h=key(),id=issue(h).challengeId,r=record(id);assert.deepEqual((await Promise.all([asyncSql(consumeSQL(id,h,r.binding,1)),asyncSql(consumeSQL(id,h,r.binding,1))])).sort(),['f','t']);assert.equal(counter(h),1);});
test('distinct labels challenges cannot reuse a counter across connections',async()=>{const h=key(),a=issue(h).challengeId,b=issue(h).challengeId;const results=await Promise.all([asyncSql(consumeSQL(a,h,record(a).binding,1)),asyncSql(consumeSQL(b,h,record(b).binding,1))]);assert.deepEqual(results.sort(),['f','t']);assert.equal(counter(h),1);});
test('out-of-order higher counter wins; lower rejects; subscription can subsequently advance',()=>{const h=key(),a=issue(h).challengeId,b=issue(h).challengeId;assert.equal(consume(a,h,record(a).binding,5),'t');assert.equal(consume(b,h,record(b).binding,4),'f');const hash=subHash();subIssue(hash);assert.equal(sql(subConsumeSQL(hash,h,6)),'t');assert.equal(counter(h),6);});
test('expiry is rechecked after waiting for the shared key lock',async()=>{
 const h=key(),id=issue(h).challengeId,r=record(id);
 // Owner fixture sets a short expiry. A distinct connection holds the registry row until it expires.
 sql(`update labels_auth.challenges set expires_at=clock_timestamp()+interval '250 milliseconds' where id=${q(id)}`);
 const lock=spawn(exe,args,{windowsHide:true});let marker='';
 const ready=new Promise(resolve=>lock.stdout.on('data',b=>{marker+=b;if(marker.includes('LOCKED'))resolve();}));
 const done=new Promise((resolve,reject)=>lock.on('exit',c=>c===0?resolve():reject(Error('lock fixture failed'))));
 lock.stdin.end(`begin;select 1 from subscription_ops.apple_app_attest_keys where key_hash=${q(h)} for update;select 'LOCKED';select pg_sleep(0.4);commit;`);
 await ready;assert.equal(await asyncSql(consumeSQL(id,h,r.binding,1)),'f');await done;assert.equal(counter(h),0);
});
for(const target of ['subscription_ops.apple_app_attest_keys','labels_auth.challenges'])test(`exception after mutation on ${target} rolls back BOTH writes`,()=>{
 const h=key(),id=issue(h).challengeId,r=record(id);
 sql(`create function public.synthetic_fault() returns trigger language plpgsql as $$begin raise exception 'synthetic_fault';end$$;create trigger synthetic_fault after update on ${target} for each row execute function public.synthetic_fault();`);
 try{assert.match(sql(consumeSQL(id,h,r.binding,7),{fail:true}),/synthetic_fault/);assert.equal(counter(h),0);assert.ok(record(id));}
 finally{sql(`drop trigger synthetic_fault on ${target};drop function public.synthetic_fault();`);}
 assert.equal(consume(id,h,r.binding,7),'t');assert.equal(counter(h),7);
});
test('outer transaction rollback restores both writes; committed counters are never rewound',()=>{const h=key(),id=issue(h).challengeId,r=record(id);sql(`begin;${consumeSQL(id,h,r.binding,8)};select 1/0;commit;`,{fail:true});assert.equal(counter(h),0);assert.ok(record(id));assert.equal(consume(id,h,r.binding,8),'t');assert.equal(counter(h),8);});
test('public/client/service roles have no labels procedure or table access; verifier has no table access',()=>{
 for(const role of ['anon','authenticated','service_role']){sql(`set role ${role};select labels_auth.read_challenge(${q(randomUUID())})`,{fail:true});sql(`set role ${role};select * from labels_auth.challenges`,{fail:true});}
 sql('set role labels_auth_verifier;select * from labels_auth.challenges',{fail:true});sql('set role labels_auth_verifier;select * from subscription_ops.apple_app_attest_keys',{fail:true});
 assert.equal(sql("select relrowsecurity from pg_class where oid='labels_auth.challenges'::regclass"),'t');
 assert.equal(sql("select count(*) from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.pronamespace='labels_auth'::regnamespace and a.grantee=0"),'0');
});
test('bounded lock timeout returns failure and leaves both rows unchanged',async()=>{
 const h=key(),id=issue(h).challengeId,r=record(id);const lock=spawn(exe,args,{windowsHide:true});
 const ready=new Promise(resolve=>lock.stdout.on('data',b=>{if(String(b).includes('LOCKED'))resolve();}));const done=new Promise(resolve=>lock.on('exit',resolve));
 lock.stdin.end(`begin;select 1 from subscription_ops.apple_app_attest_keys where key_hash=${q(h)} for update;select 'LOCKED';select pg_sleep(1.2);commit;`);
 await ready;const started=Date.now();await assert.rejects(asyncSql(consumeSQL(id,h,r.binding,1)),/lock timeout/);assert.ok(Date.now()-started<2000);await done;assert.equal(counter(h),0);assert.ok(record(id));
});
test('bounded orphan cleanup deletes expired rows on issuance',()=>{const h=key(),id=issue(h).challengeId;sql(`update labels_auth.challenges set created_at=clock_timestamp()-interval '90 seconds',expires_at=clock_timestamp()-interval '1 second' where id=${q(id)}`);issue(h);assert.equal(sql(`select count(*) from labels_auth.challenges where id=${q(id)}`),'0');});
test('initial registration retry cannot reset a labels-advanced counter',()=>{const h=key(),id=issue(h).challengeId;consume(id,h,record(id).binding,12);const hash=subHash();subIssue(hash);assert.equal(sql(`set role service_role;select public.gridly_consume_native_challenge(${q(hash)},'apple','gridly-subscription-verification-v1','apple_initial',${q(h)},${q(Buffer.alloc(91,7).toString('base64'))},0)`),'t');assert.equal(counter(h),12);});
test('registry contains exactly one assertion counter column; unavailable procedures fail closed',()=>{assert.equal(sql("select count(*) from information_schema.columns where table_schema in ('subscription_ops','labels_auth') and column_name='assertion_counter'"),'1');sql("set role labels_auth_verifier;select public.gridly_consume_native_challenge(null,null,null,null,null,null,null)",{fail:true});});
test('real shared cryptographic verifier and both authorization adapters use the SAME persisted synthetic key',async()=>{
 const f=nativeFixture();sql(`insert into subscription_ops.apple_app_attest_keys(key_hash,environment,public_spki) values(${q(f.keyHash)},'production',${q(f.publicSpki)})`);
 const issued=issue(f.keyHash,f.fingerprint),r=record(issued.challengeId);
 const registry={read:async({id})=>record(id),consume:async({id,keyHash,binding,counter})=>consume(id,keyHash,binding,counter)==='t'};
 const authorize=createLabelsAttestAdapter({registry});
 const input={evidence:f.assertion(r.binding),binding:r.binding,purpose:'gridly-labels-lease-v1',challengeId:r.challengeId,appId:'com.gridlygo.gridly',environment:'production'};
 assert.equal((await authorize(input))?.verified,true);assert.equal(counter(f.keyHash),1);assert.equal(await authorize(input),null);
 const challenge=subHash(),hash=sha(challenge);subIssue(hash);
 const body={platform:'apple',environment:'production',nonce:'n'.repeat(40),productId:'com.gridlygo.gridly.monthly',evidence:{signedTransactions:['aaa.bbb.ccc']},nativeChallenge:challenge};
 const binding=await nativeVerificationBinding({challenge,request:body});body.nativeAuthorization=JSON.parse(f.assertion(Buffer.from(binding.digest).toString('base64url'),2));
 const old=createNativeAuthorizer({appleVerifier:createAppleAppAttestVerifier(),store:{readAppleKey:async h=>JSON.parse(sql(`set role service_role;select public.gridly_read_app_attest_key(${q(h)})`)),
  consume:async({hash,verdict})=>sql(subConsumeSQL(hash,verdict.keyHash,verdict.counter))==='t'}});
 assert.equal(await old({body:JSON.stringify(body),environment:'production'}),true);assert.equal(counter(f.keyHash),2);
});
test('connection statement deadline aborts long work without touching registry state',()=>{
 assert.equal(sql('show statement_timeout'),'2s');const started=Date.now();assert.match(sql('select pg_sleep(3)',{fail:true}),/statement timeout/);assert.ok(Date.now()-started<4000);
});
