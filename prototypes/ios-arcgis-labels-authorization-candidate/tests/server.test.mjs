import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createLabelsAttestAdapter} from '../server/labels-attest-adapter.mjs';
import {createLabelsPaidAdapter} from '../server/labels-paid-adapter.mjs';
import {createLabelsChallengeIssuer} from '../server/labels-challenge-adapter.mjs';
import {createLabelsRpcPorts} from '../server/labels-rpc-ports.mjs';
import {createConsumerRuntime} from '../gateway/consumer-runtime.mjs';
import {createMemoryState} from '../gateway/foundation/state.mjs';
import {leaseBinding} from '../gateway/foundation/protocol.mjs';
import {tileProofBytes} from '../gateway/tile-wire.mjs';
import {policy} from '../server/policy.mjs';
import {nativeFixture,appleRecord,fingerprintKey,sha} from './fixtures.mjs';
const now=Date.now();
function fixture(){
 const native=nativeFixture(),id=randomUUID(),paid='aaa.bbb.ccc';let stored=0,consumed=false;
 const binding=leaseBinding({appId:policy.appId,challengeId:id,paidEvidence:paid,fingerprint:native.fingerprint,...policy});
 const record={challengeId:id,keyHash:native.keyHash,appId:policy.attestAppId,purpose:policy.purpose,store:policy.store,attest:policy.attest,
 gatewayId:policy.gatewayId,environment:'production',binding,expiresAt:now+100000,publicSpki:native.publicSpki,counter:0};
 const registry={read:async()=>consumed?null:{...record,counter:stored},consume:async({counter,keyHash,binding:b})=>{
 if(consumed||counter<=stored||keyHash!==native.keyHash||b!==binding)return false;stored=counter;consumed=true;return true;}};
 const input={evidence:native.assertion(binding),binding,purpose:policy.purpose,challengeId:id,appId:policy.appId,environment:'production'};
 return {native,id,paid,binding,record,registry,input,counter:()=>stored};
}
test('unchanged real App Attest verifier accepts a synthetic registered-key signature bound to labels; replay rejects',async()=>{
 const f=fixture(),verify=createLabelsAttestAdapter({registry:f.registry,now:()=>now});
 assert.equal((await verify(f.input))?.installation,f.native.keyHash);assert.equal(f.counter(),1);assert.equal(await verify(f.input),null);
});
test('every purpose, app, environment, key, context and signature mutation denies before counter write',async()=>{
 const patches=[{purpose:'gridly-subscription-verification-v1'},{purpose:'unknown'},{appId:'com.gridlygo.prototype.labeltiles.pilot'},
 {environment:'development'},{binding:sha('other')},{evidence:JSON.stringify({paid:true,integrity:true})}];
 for(const patch of patches){const f=fixture();assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>now})({...f.input,...patch}),null);assert.equal(f.counter(),0);}
 for(const field of ['appId','store','attest','gatewayId','keyHash','purpose','binding','environment']){
  const f=fixture();f.record[field]='wrong';assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>now})(f.input),null);assert.equal(f.counter(),0);
 }
 const f=fixture();f.input.evidence=f.native.assertion(f.binding,1,'OTHER.com.gridlygo.gridly');assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>now})(f.input),null);
});
test('initial attestation, stale challenge, missing dependency, unavailable registry and cancellation fail closed',async()=>{
 for(const type of ['apple_initial','paid_admission']){const f=fixture(),a=JSON.parse(f.input.evidence);a.type=type;assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>now})({...f.input,evidence:JSON.stringify(a)}),null);}
 const f=fixture();f.record.expiresAt=now;assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>now})(f.input),null);
 assert.equal(await createLabelsAttestAdapter()(f.input),null);
 assert.equal(await createLabelsAttestAdapter({registry:{read:async()=>{throw Error('private');},consume:async()=>true}})(f.input),null);
 assert.equal(await createLabelsAttestAdapter({registry:fixture().registry})({...f.input,signal:AbortSignal.abort()}),null);
});
test('paid adapter accepts only branded existing verifier results, future verified period and independent environment',async()=>{
 const key=await fingerprintKey();
 for(const cancel of [false,true]){const v=await createLabelsPaidAdapter({provider:{verify:async(s,o)=>{assert.equal(s,'aaa.bbb.ccc');assert.equal(o.environment,'sandbox/test');return appleRecord(now,{cancel});}},fingerprintKey:key,now:()=>now})({evidence:'aaa.bbb.ccc',environment:'sandbox'});
 assert.equal(v?.verified,true);assert.match(v.lineage,/^[a-f0-9]{64}$/);assert.equal(v.periodEnd,now+3600000);}
 for(const record of [appleRecord(now,{end:now}),appleRecord(now,{revoked:true}),appleRecord(now,{status:3}),appleRecord(now,{env:'Production'}),{...appleRecord(now)}]){
  assert.equal(await createLabelsPaidAdapter({provider:{verify:async()=>record},fingerprintKey:key,now:()=>now})({evidence:'aaa.bbb.ccc',environment:'sandbox'}),null);
 }
 assert.equal(await createLabelsPaidAdapter()({evidence:'aaa.bbb.ccc',environment:'sandbox'}),null);
 assert.equal(await createLabelsPaidAdapter({provider:{verify:async()=>appleRecord(now)},fingerprintKey:key,now:()=>now})({evidence:'aaa.bbb.ccc',environment:'production'}),null);
});
test('paid freshness, in-flight expiry, verifier failures and continuity/client verdicts cannot authorize',async()=>{
 const key=await fingerprintKey();
 for(const evidence of ['{"paid":true}','continuity-grant',JSON.stringify({verified:true})])assert.equal(await createLabelsPaidAdapter({provider:{verify:async()=>appleRecord(now)},fingerprintKey:key})({evidence,environment:'sandbox'}),null);
 assert.equal(await createLabelsPaidAdapter({provider:{verify:async()=>appleRecord(now-300000)},fingerprintKey:key,now:()=>now})({evidence:'aaa.bbb.ccc',environment:'sandbox'}),null);
 let t=now;const adapter=createLabelsPaidAdapter({provider:{verify:async()=>{t=now+10;return appleRecord(now,{end:now+5});}},fingerprintKey:key,now:()=>t});assert.equal(await adapter({evidence:'aaa.bbb.ccc',environment:'sandbox'}),null);
 assert.equal(await createLabelsPaidAdapter({provider:{verify:async()=>{throw Error('private');}},fingerprintKey:key})({evidence:'aaa.bbb.ccc',environment:'sandbox'}),null);
});
test('challenge request rejects flags/identity/environment and passes normalized key and exact hashes',async()=>{
 const f=fixture();let calls=0;const registry={issue:async v=>{calls++;assert.equal(v.keyHash,f.native.keyHash);assert.equal(v.fingerprint,f.native.fingerprint);return {challengeId:v.id,purpose:policy.purpose,expiresAt:now+10000};}};
 const issue=createLabelsChallengeIssuer({registry,now:()=>now}),input={keyId:f.native.keyId,spki:f.native.spki,paidEvidenceHash:sha(f.paid)};
 assert.equal((await issue({id:f.id,input}))?.challengeId,f.id);
 for(const extra of ['paid','integrity','purpose','environment','appId'])assert.equal(await issue({id:f.id,input:{...input,[extra]:true}}),null);
 assert.equal(calls,1);
});
test('RPC adapter sets transaction-local deadlines/role, parameterizes inputs, commits then destroys',async()=>{
 const queries=[];let destroyed=0;const rpc=createLabelsRpcPorts({connect:async()=>({query:async(sql,args)=>{queries.push({sql,args});return {rows:[{result:true}]};},destroy:()=>destroyed++})});
 assert.equal(await rpc.consume({id:'id',keyHash:'hash',binding:'binding',counter:1}),true);
 assert.equal(queries[0].sql,'BEGIN');assert.match(queries[1].sql,/statement_timeout='2000ms'/);assert.match(queries[1].sql,/lock_timeout='750ms'/);
 assert.match(queries[1].sql,/ROLE labels_auth_verifier/);assert.deepEqual(queries[2].args,['id','hash','binding',1]);assert.equal(queries[3].sql,'COMMIT');assert.ok(destroyed>=1);
});
test('RPC failure/abort never returns success and destroys uncertain connection; absent port closed',async()=>{
 await assert.rejects(createLabelsRpcPorts().read({id:randomUUID()}),/unavailable/);
 let destroyed=0;const rpc=createLabelsRpcPorts({connect:async()=>({query:async sql=>{if(sql.startsWith('select'))throw Error('private');return {};},destroy:()=>destroyed++})});
 await assert.rejects(rpc.read({id:randomUUID()}),e=>e.message==='labels_registry_unavailable');assert.ok(destroyed>=1);
 await assert.rejects(rpc.read({id:randomUUID(),signal:AbortSignal.abort()}));
});

test('consumer gateway: bound challenge → real synthetic assertion → paid verifier → fixed POST PNG; replay/failed paid denies',async()=>{
 const native=nativeFixture(),rows=new Map();let counter=0,eligible=true,providerCalls=0;
 const registry={issue:async({id,keyHash,fingerprint,paidDigest})=>{const r={challengeId:id,keyHash,appId:policy.attestAppId,purpose:policy.purpose,store:policy.store,attest:policy.attest,gatewayId:policy.gatewayId,environment:'production',
  fingerprint,paidDigest,expiresAt:now+90000,publicSpki:native.publicSpki,counter,
  binding:leaseBinding({appId:policy.appId,challengeId:id,paidEvidence:'aaa.bbb.ccc',fingerprint,...policy})};rows.set(id,r);return {challengeId:id,purpose:policy.purpose,expiresAt:r.expiresAt};},
 read:async({id})=>{const r=rows.get(id);return r&&!r.used?{...r,counter}:null;},consume:async({id,keyHash,binding,counter:c})=>{const r=rows.get(id);if(!r||r.used||r.keyHash!==keyHash||r.binding!==binding||c<=counter)return false;r.used=true;counter=c;return true;}};
 const memory=createMemoryState();memory.setEnabled(true);const pending=new Map();
 const state={...memory,ingress:async()=>'ok',challenge:async id=>{pending.set(id,now+90000);return now+90000;},pending:async id=>pending.has(id),reserveOAuth:async()=>true,
  issue:async(...args)=>{if(!pending.delete(args[1]))return 'denied';return memory.issue(...args);}};
 const png=readFileSync(new URL('../reference/prototypes/ios-arcgis-labels-integration/Tests/TileCoreTests/Fixtures/valid.png',import.meta.url));
 const config={enabled:true,origin:'https://labels.example.invalid',ingressKey:'a'.repeat(64),timeout:6000,tokenTimeout:2000,tileTimeout:3000,maxInFlight:32,maxBytes:524288,
  provider:{GRIDLY_LABELS_ESRI_ENABLED:'true',GRIDLY_LABELS_ESRI_CLIENT_ID:'synthetic',GRIDLY_LABELS_ESRI_CLIENT_SECRET:'synthetic'}};
 const handler=createConsumerRuntime({config,state,registry,provider:{verify:async()=>appleRecord(now,{revoked:!eligible})},fingerprintKey:await fingerprintKey(),now:()=>now,
 transport:async(url,options)=>{providerCalls++;return options.method==='POST'?Response.json({access_token:'synthetic-token',expires_in:3600}):new Response(png,{headers:{'content-type':'image/png'}});}});
 const request=(path,body,headers={})=>new Request('https://platform.invalid/functions/v1/gridly-labels'+path,{method:'POST',headers:{'content-type':'application/json','x-gridly-pilot-ingress':config.ingressKey,...headers},body:typeof body==='string'?body:JSON.stringify(body)});
 async function lease(count){const challenge=await handler(request('/v1/labels/challenge',{keyId:native.keyId,spki:native.spki,paidEvidenceHash:sha('aaa.bbb.ccc')}));assert.equal(challenge.status,201);const {challengeId}=await challenge.json();
 const b={paidEvidence:'aaa.bbb.ccc',attestEvidence:native.assertion(rows.get(challengeId).binding,count),challengeId,spki:native.spki};return {response:await handler(request('/v1/labels/lease',b)),body:b};}
 const first=await lease(1);assert.equal(first.response.status,201);const receipt=await first.response.json();assert.equal(receipt.expiresAt,now+300000);assert.equal(receipt.proof,undefined);
 assert.equal((await handler(request('/v1/labels/lease',first.body))).status,401);
 const tile={body:'{"level":2,"row":1,"column":1}',leaseId:receipt.leaseId,timestamp:now,requestId:randomUUID()};
 const signature=sign('sha256',tileProofBytes(tile,config.origin),{key:native.tile.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const headers={'x-gridly-labels-lease':tile.leaseId,'x-gridly-labels-timestamp':String(now),'x-gridly-labels-request':tile.requestId,'x-gridly-labels-signature':signature};
 const response=await handler(request('/v1/imagery-labels/tile',tile.body,headers));assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
 assert.equal((await handler(request('/v1/imagery-labels/tile',tile.body,headers))).status,401);const traffic=providerCalls;
 eligible=false;assert.equal((await lease(2)).response.status,401);assert.equal(providerCalls,traffic);assert.equal(counter,2,'failed paid verification may burn counter; never rewind');
 memory.setEnabled(false);assert.equal((await handler(request('/v1/imagery-labels/tile',tile.body,headers))).status,503);
});
test('candidate runtime remains closed without dependencies even if switches are enabled',async()=>{
 const handler=createConsumerRuntime();assert.equal((await handler(new Request('https://local.invalid'))).status,503);
});
test('cancellation or expiry after counter consumption returns no assertion authorization and never rewinds',async()=>{
 for(const reason of ['cancel','expire']){
  const f=fixture(),controller=new AbortController();let t=now;const consume=f.registry.consume;
  f.registry.consume=async args=>{const accepted=await consume(args);if(reason==='cancel')controller.abort();else t=now+100001;return accepted;};
  assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>t})({...f.input,signal:controller.signal}),null);
  assert.equal(f.counter(),1);assert.equal(await createLabelsAttestAdapter({registry:f.registry,now:()=>now})(f.input),null);
 }
});
test('paid period can expire while deriving lineage; no paid admission is returned',async()=>{
 let t=now;const key=await fingerprintKey(),record=appleRecord(now,{end:now+1});
 const adapter=createLabelsPaidAdapter({provider:{verify:async()=>record},fingerprintKey:key,now:()=>{const old=t;t=now+2;return old;}});
 assert.equal(await adapter({evidence:'aaa.bbb.ccc',environment:'sandbox'}),null);
});
