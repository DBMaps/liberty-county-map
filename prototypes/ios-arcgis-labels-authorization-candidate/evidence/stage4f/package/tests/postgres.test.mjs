import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {nativeFixture,appleRecord,fingerprintKey} from '../../../../tests/fixtures.mjs';
import {createLabelsAuthority} from '../authority.mjs';
import {createAuthorityClient} from '../client.mjs';
import {createFirstPartyGateway} from '../gateway.mjs';
import {syntheticConfig,replay} from './helpers.mjs';
import {createMemoryState} from '../../../../gateway/foundation/state.mjs';
import {leaseBinding} from '../../../../gateway/foundation/protocol.mjs';
import {createNativeAuthorizer} from '../../../../reference/build18/supabase/functions/_shared/entitlement/native-authorization.mjs';
import {createAppleAppAttestVerifier} from '../../../../reference/build18/supabase/functions/_shared/entitlement/apple-app-attest.mjs';
import {nativeVerificationBinding} from '../../../../reference/build18/js/gridly-native-verification-binding.mjs';
import {contract as c,digest} from '../contract.mjs';
const data=process.env.GRIDLY_LABELS_DISPOSABLE_ROOT,bin=process.env.GRIDLY_LABELS_DISPOSABLE_BIN;
if(!data||!bin||process.env.PGHOST!=='127.0.0.1'||!/[\\/]\.scratch[\\/]pg-[a-f0-9]{32}[\\/]data$/.test(data))throw Error('disposable_only');
const q=v=>"'"+String(v).replaceAll("'","''")+"'";
const sql=(text,signal)=>new Promise((resolve,reject)=>{const p=spawn(resolvePath(),['-XqwAt','-v','ON_ERROR_STOP=1'],{windowsHide:true});let out='',err='';const stop=()=>p.kill();signal?.addEventListener('abort',stop,{once:true});p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.on('error',reject);p.on('exit',code=>{signal?.removeEventListener('abort',stop);code===0?resolve(out.trim()):reject(Error('disposable_query_failed'));});p.stdin.end(text);});
function resolvePath(){return resolve(bin,'psql.exe');}
const native=nativeFixture();let ambiguous=false,gateway,state,registry;
const keyCounter=async()=>Number(await sql('select assertion_counter from subscription_ops.apple_app_attest_keys where key_hash='+q(native.keyHash)));
before(async()=>{
 assert.equal(resolve(await sql('show data_directory')),resolve(data));
 await sql('create role anon;create role authenticated;create role service_role;create schema report_retention;create table report_retention.admission_state(reporting_enabled boolean,protocol_version integer);insert into report_retention.admission_state values(false,2);');
 for(const path of ['reference/build18/supabase/migrations/20260926205345_lp24462_store_entitlement_cache.sql','reference/build18/supabase/migrations/20260928030000_lp24466_native_authorization.sql','sql/labels-auth.sql'])await sql(readFileSync(new URL('../../../../'+path,import.meta.url),'utf8'));
 await sql('insert into subscription_ops.apple_app_attest_keys(key_hash,environment,public_spki) values('+q(native.keyHash)+",'production',"+q(native.publicSpki)+')');
 registry={
  issue:async({id,keyHash,fingerprint,paidDigest,signal})=>JSON.parse(await sql('set role labels_auth_verifier;select labels_auth.issue_challenge('+[id,keyHash,fingerprint,paidDigest].map(q).join(',')+')',signal)),
  read:async({id,signal})=>{const out=await sql('set role labels_auth_verifier;select labels_auth.read_challenge('+q(id)+')',signal);return out?JSON.parse(out):null;},
  consume:async({id,keyHash,binding,counter,signal})=>{const out=await sql('set role labels_auth_verifier;select labels_auth.consume_challenge('+[id,keyHash,binding].map(q).join(',')+','+counter+')',signal);if(ambiguous)throw Error('unknown COMMIT after persisted result');return out==='t';}
 };
 const authority=createLabelsAuthority({...syntheticConfig,registry,replay:replay(),fingerprintKey:await fingerprintKey(),createProvider:()=>({verify:async()=>appleRecord(Date.now())}),isEnabled:()=>true});
 const client=createAuthorityClient({...syntheticConfig,replay:replay(),transport:(url,init)=>authority(new Request(url,init))});
 const memory=createMemoryState();memory.setEnabled(true);const pending=new Map();
 state={...memory,challenge:async id=>{const expiry=Date.now()+90000;pending.set(id,expiry);return expiry;},pending:async id=>pending.has(id),reserveOAuth:async()=>true};
 gateway=createFirstPartyGateway({state,client,config:{origin:syntheticConfig.labelOrigin,enabled:true}});
});
async function input(counter){const challenge=await gateway.issueChallenge({keyId:native.keyId,spki:native.spki,paidEvidenceHash:digest('aaa.bbb.ccc')});assert.ok(challenge);const binding=leaseBinding({appId:c.appId,challengeId:challenge.challengeId,paidEvidence:'aaa.bbb.ccc',fingerprint:native.fingerprint,store:c.store,attest:c.attest});return {challengeId:challenge.challengeId,spki:native.spki,paidEvidence:'aaa.bbb.ccc',attestEvidence:native.assertion(binding,counter)};}
async function subscription(counter){
 const challenge=digest(randomUUID()),hash=digest(challenge);
 assert.equal(await sql('set role service_role;select public.gridly_issue_native_challenge('+q(hash)+",'apple','gridly-subscription-verification-v1',clock_timestamp()+interval '90 seconds')"),'t');
 const body={platform:'apple',environment:'production',nonce:'n'.repeat(40),productId:'com.gridlygo.gridly.monthly',evidence:{signedTransactions:['aaa.bbb.ccc']},nativeChallenge:challenge};
 const binding=await nativeVerificationBinding({challenge,request:body});body.nativeAuthorization=JSON.parse(native.assertion(Buffer.from(binding.digest).toString('base64url'),counter));
 const authorize=createNativeAuthorizer({appleVerifier:createAppleAppAttestVerifier(),store:{readAppleKey:async h=>JSON.parse(await sql('set role service_role;select public.gridly_read_app_attest_key('+q(h)+')')),
 consume:async({hash,verdict})=>(await sql('set role service_role;select public.gridly_consume_native_challenge('+q(hash)+",'apple','gridly-subscription-verification-v1','apple_assertion',"+q(verdict.keyHash)+',null,'+verdict.counter+')'))==='t'}});
 return authorize({body:JSON.stringify(body),environment:'production'});
}
test('HTTP first-party flow and unchanged subscription authorizer advance the same persisted key',async()=>{
 assert.equal((await gateway.issueLease(await input(1))).status,201);assert.equal(await keyCounter(),1);
 assert.equal(await subscription(2),true);assert.equal(await keyCounter(),2);
});
test('independent SQL connections race subscription and HTTP labels assertions on one counter',async()=>{
 const p=await input(3),[a,b]=await Promise.all([gateway.issueLease(p),subscription(3)]);
 assert.ok(Number(a.status===201)+Number(b)<=1);assert.equal(await keyCounter(),3);
 assert.equal((await gateway.issueLease(await input(4))).status,201);assert.equal(await keyCounter(),4);
});
test('HTTP interface with unknown committed SQL result never issues a lease or rewinds',async()=>{
 const before=state.metrics().leases,p=await input(5);ambiguous=true;
 assert.notEqual((await gateway.issueLease(p)).status,201);assert.equal(await keyCounter(),5);assert.equal(state.metrics().leases,before);
 assert.notEqual((await gateway.issueLease(p)).status,201);assert.equal(await keyCounter(),5);
});

