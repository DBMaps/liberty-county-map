import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fixture,syntheticConfig,replay,resignRequest,resignResponse} from './helpers.mjs';
import {contract as c,mac,digest} from '../contract.mjs';
import {createLabelsAuthority} from '../authority.mjs';
import {createAuthorityClient,isVerifiedDecision} from '../client.mjs';
import {existingAppleProviderFactory} from '../existing-apple.mjs';
import {nativeFixture,appleRecord} from '../../../../tests/fixtures.mjs';
import {tileProofBytes} from '../../../../gateway/tile-wire.mjs';

test('valid first-party assertion and paid evidence issue only bounded labels lease',async()=>{
 const f=await fixture(),input=await f.leaseInput();let lineage;const issue=f.state.issue;f.state.issue=(lease,...rest)=>{lineage=lease.lineage;return issue(lease,...rest);};const result=await f.gateway.issueLease(input);
 assert.equal(result.status,201);assert.equal(f.counter(),1);assert.equal(result.scope,'imagery-labels:read');assert.ok(result.expiresAt<=f.now()+300000);
 assert.equal(f.providerCalls(),1);assert.equal(result.entitlementProof,undefined);assert.equal(result.paid,undefined);
 assert.match(f.responses.at(-1).body.result.paid.lineage,/^[a-f0-9]{64}$/);
 assert.equal(lineage,f.responses.at(-1).body.result.paid.lineage);
 assert.equal((await f.gateway.issueLease(input)).status,503);
});
test('gateway consumes only branded response pairs; plain client verdict cannot authorize',async()=>{
 assert.equal(isVerifiedDecision({verified:true}),false);
 const f=await fixture(),p=await f.leaseInput(),v=await f.client.authorize(p);
 assert.equal(isVerifiedDecision(v),true);assert.ok(Object.isFrozen(v.paid));
});
for(const [field,value]of [['issuer','wrong'],['audience','reporting'],['appId','com.gridlygo.prototype.labeltiles.pilot'],['attestAppId','OTHER.com.gridlygo.gridly'],['store','production'],['attest','development'],['purpose','gridly-subscription-verification-v1'],['origin','https://evil.invalid']]){
 test('authenticated wrong response '+field+' is rejected',async()=>{
  const f=await fixture({mutateResponse:p=>{p.body[field]=value;resignResponse(p);}});assert.equal(await f.leaseInput(),null);assert.equal(f.counter(),0);
 });
 test('authenticated wrong request '+field+' is rejected',async()=>{
  const f=await fixture({mutateRequest:p=>{p.body[field]=value;resignRequest(p);}});assert.equal(await f.leaseInput(),null);assert.equal(f.counter(),0);
 });
}
test('invalid request MAC is rejected without registry effects',async()=>{const f=await fixture({mutateRequest:p=>p.mac='0'.repeat(64)});assert.equal(await f.leaseInput(),null);});
test('invalid response MAC is rejected',async()=>{const f=await fixture({mutateResponse:p=>p.mac='0'.repeat(64)});assert.equal(await f.leaseInput(),null);});
test('expired signed response is rejected',async()=>{const f=await fixture({mutateResponse:p=>{p.body.expiresAt=p.body.issuedAt-1;resignResponse(p);}});assert.equal(await f.leaseInput(),null);});
test('wrong request digest or response nonce is rejected',async()=>{for(const field of ['requestDigest','requestId']){const f=await fixture({mutateResponse:p=>{p.body[field]=field==='requestId'?randomUUID():digest('different');resignResponse(p);}});assert.equal(await f.leaseInput(),null);}});
test('repeated response decision ID is rejected by atomic response store',async()=>{
 const seen=replay();const f=await fixture({responseReplay:{claim:async v=>v.namespace==='labels-response'?false:seen.claim(v)}});assert.equal(await f.leaseInput(),null);
});
test('authority rejects request replay before a second challenge or assertion',async()=>{
 const f=await fixture();await f.leaseInput();const p=f.requests[0];
 const r=await f.authority(new Request(syntheticConfig.authorityOrigin+c.path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(p)}));assert.equal(r.status,503);assert.equal(f.rows.size,1);
});
test('missing, mismatched or unavailable authority stays closed without default fetch',async()=>{
 assert.deepEqual(createAuthorityClient(),{});assert.deepEqual(createAuthorityClient({...syntheticConfig,transport:async()=>{},replay:null}),{});
 assert.deepEqual(createAuthorityClient({...syntheticConfig,approvedAuthorities:['https://evil.invalid'],transport:async()=>{},replay:replay()}),{});
 assert.equal((await createLabelsAuthority()(new Request('https://authority.gridly.invalid'))).status,503);
 const f=await fixture({transportFailure:true});assert.equal(await f.leaseInput(),null);assert.equal(f.counter(),0);
});
test('missing registration denies without initial registration',async()=>{const f=await fixture({registered:false});assert.equal(await f.leaseInput(),null);assert.equal(f.counter(),0);assert.equal(f.providerCalls(),0);});
test('registration disappearing before assertion denies',async()=>{const f=await fixture(),p=await f.leaseInput();f.setRegistered(false);assert.equal((await f.gateway.issueLease(p)).status,503);assert.equal(f.providerCalls(),0);});
test('wrong native tile key cannot use the attested binding',async()=>{const f=await fixture(),p=await f.leaseInput();p.spki=nativeFixture().spki;assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),0);});
test('paid bytes are exact-bound and cannot be replaced',async()=>{const f=await fixture(),p=await f.leaseInput();p.paidEvidence='xxx.yyy.zzz';assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),0);});
for(const [name,paid]of [['expired period',{end:0}],['revoked',{revoked:true}],['wrong store',{env:'Production'}],['billing retry',{status:3}]]){
 test(name+' paid eligibility denies after counter commit without rewind',async()=>{const f=await fixture({paid}),p=await f.leaseInput();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),1);assert.equal((await f.gateway.issueLease(p)).status,503);assert.equal(f.counter(),1);});
}
test('unbranded paid=true/integrity=true provider cannot authorize',async()=>{const f=await fixture({provider:async()=>({paid:true,integrity:true,...appleRecord(Date.now())})}),p=await f.leaseInput();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),1);});
test('client flags cannot change strict lease request',async()=>{const f=await fixture(),p=await f.leaseInput();assert.equal((await f.gateway.issueLease({...p,paid:true,integrity:true})).status,401);assert.equal(f.counter(),0);});
test('shared assertion replay and counter reordering fail closed',async()=>{
 const f=await fixture(),p=await f.leaseInput(1);assert.equal(f.subscribe(2),true);assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),2);
 const next=await f.leaseInput(3);assert.equal((await f.gateway.issueLease(next)).status,201);assert.equal(f.subscribe(4),true);assert.equal(f.counter(),4);
});
test('concurrent subscription and labels same-counter contenders have at most one success',async()=>{const f=await fixture(),p=await f.leaseInput(1);const [labels,subscription]=await Promise.all([f.gateway.issueLease(p),Promise.resolve().then(()=>f.subscribe(1))]);assert.ok(Number(labels.status===201)+Number(subscription)<=1);assert.equal(f.counter(),1);});
test('concurrent labels requests do not mix paid decisions or issue twice',async()=>{const f=await fixture(),p=await f.leaseInput(1);const r=await Promise.all([f.gateway.issueLease(p),f.gateway.issueLease(p)]);assert.equal(r.filter(x=>x.status===201).length,1);assert.equal(f.counter(),1);});
test('cancel before verification makes no transport, Apple or counter call',async()=>{const f=await fixture(),p=await f.leaseInput(),calls=f.transportCalls();assert.notEqual((await f.gateway.issueLease(p,AbortSignal.abort())).status,201);assert.equal(f.transportCalls(),calls);assert.equal(f.counter(),0);assert.equal(f.providerCalls(),0);});
test('cancel after counter commit denies without rewind and requires fresh assertion',async()=>{
 const control=new AbortController(),f=await fixture({afterCommit:()=>control.abort()}),p=await f.leaseInput();
 assert.notEqual((await f.gateway.issueLease(p,control.signal)).status,201);assert.equal(f.counter(),1);assert.equal(f.providerCalls(),0);assert.notEqual((await f.gateway.issueLease(p)).status,201);
});
test('ambiguous COMMIT never authorizes and counter stays committed',async()=>{const f=await fixture({ambiguous:true}),p=await f.leaseInput();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),1);assert.equal(f.providerCalls(),0);});
test('Apple verifier failure returns sanitized denial after commit',async()=>{const f=await fixture({provider:async()=>{throw Error('SECRET paid private key');}}),p=await f.leaseInput();const r=await f.gateway.issueLease(p);assert.notEqual(r.status,201);assert.doesNotMatch(JSON.stringify(r),/SECRET|private key|aaa.bbb/);assert.equal(f.counter(),1);});
test('database unavailable denies before paid verification',async()=>{const f=await fixture({databaseUnavailable:true}),p=await f.leaseInput();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),0);assert.equal(f.providerCalls(),0);});
test('subscription expires during Apple verification',async()=>{let f;f=await fixture({provider:async()=>{const t=f.now();f.advance(20);return appleRecord(t,{end:t+10});}});const p=await f.leaseInput();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),1);});
test('gateway timeout after a valid service decision cannot create a lease',async()=>{
 const control=new AbortController();let calls=0;const f=await fixture({delayResponse:()=>{if(++calls===2)control.abort();}}),p=await f.leaseInput();
 assert.notEqual((await f.gateway.issueLease(p,control.signal)).status,201);assert.equal(f.counter(),1);assert.equal(f.state.metrics().leases,0);
});
test('disabled gateway never contacts authority or provider',async()=>{const f=await fixture(),p=await f.leaseInput(),calls=f.transportCalls();f.disable();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.transportCalls(),calls);assert.equal(f.counter(),0);});
test('wrong method/path and encoded or oversized requests stay closed',async()=>{
 const f=await fixture();for(const path of [c.path+'?query=private',c.path+'/', '/other']){assert.equal((await f.authority(new Request(syntheticConfig.authorityOrigin+path,{method:'POST'}))).status,503);}
 const body='x'.repeat(c.requestBytes+1),r=await f.authority(new Request(syntheticConfig.authorityOrigin+c.path,{method:'POST',headers:{'content-type':'application/json'},body}));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/xxxx/);
});
test('extra response records and secret-looking data cannot escape schema checks',async()=>{const f=await fixture({mutateResponse:p=>{p.body.result.publicSpki='PRIVATE REGISTRY RECORD';resignResponse(p);}});assert.equal(await f.leaseInput(),null);});
test('fixed-path proof-of-possession tile requests retain disabled provider default and replay control',async()=>{
 const f=await fixture(),p=await f.leaseInput(),lease=await f.gateway.issueLease(p);assert.equal(lease.status,201);
 const request={method:'POST',target:'/v1/imagery-labels/tile',body:'{"level":1,"row":0,"column":0}',leaseId:lease.leaseId,timestamp:f.now(),requestId:randomUUID()};
 request.signature=sign('sha256',tileProofBytes(request,syntheticConfig.labelOrigin),{key:f.native.tile.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 assert.notEqual((await f.gateway.requestTile(request)).status,200);assert.equal((await f.gateway.requestTile(request)).status,401);
 assert.equal(f.state.metrics().attempts,1);
});
test('existing Apple adapter transport receives combined cancellation; no crypto reimplementation',async()=>{
 const controller=new AbortController();let received;
 const hmacKey=await crypto.subtle.importKey('raw',Buffer.alloc(32,9),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const factory=existingAppleProviderFactory({url:'https://synthetic.lambda-url.us-east-1.on.aws',token:'s'.repeat(43),hmacKey,fetchImpl:async(u,o)=>{received=o.signal;return new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(Error('private')),{once:true}));}});
 const work=factory({signal:controller.signal}).verify('aaa.bbb.ccc',{environment:'sandbox/test'});await new Promise(r=>setImmediate(r));controller.abort();await assert.rejects(work);assert.equal(received.aborted,true);
});
test('no default network or credential lookup exists in the isolated implementation',()=>{
 for(const file of ['authority.mjs','client.mjs','gateway.mjs','existing-apple.mjs']){const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/Deno\.env|process\.env|Deno\.serve|createServer\(|SUPABASE_SERVICE_ROLE_KEY/);}
});

