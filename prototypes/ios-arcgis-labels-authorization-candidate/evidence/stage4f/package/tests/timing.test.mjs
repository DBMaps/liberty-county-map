import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {fixture,resignResponse,resignRequest} from './helpers.mjs';
import {contract as c,digest} from '../contract.mjs';
import {existingAppleProviderFactory} from '../existing-apple.mjs';
import {appleRecord} from '../../../../tests/fixtures.mjs';

test('deadline expires during Apple work, keeps counter consumed and releases no lease',async()=>{
 let release,observed;const keep=setTimeout(()=>{},300);
 const f=await fixture({budget:70,provider:({signal})=>{observed=signal;return new Promise(r=>release=r);}}),p=await f.leaseInput();
 try{const started=performance.now(),r=await f.gateway.issueLease(p);assert.notEqual(r.status,201);assert.ok(performance.now()-started<250);assert.equal(observed.aborted,true);assert.equal(f.counter(),1);assert.equal(f.state.metrics().leases,0);}
 finally{release?.(appleRecord(f.now()));clearTimeout(keep);}
});
test('cancel during Apple work propagates to provider and never rolls back counter',async()=>{
 let enter;const started=new Promise(r=>enter=r),control=new AbortController();let observed;
 const f=await fixture({provider:({signal})=>{observed=signal;enter();return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('cancelled private evidence')),{once:true}));}}),p=await f.leaseInput();
 const work=f.gateway.issueLease(p,control.signal);await started;control.abort();assert.notEqual((await work).status,201);assert.equal(observed.aborted,true);assert.equal(f.counter(),1);assert.equal(f.state.metrics().leases,0);
});
test('uncooperative Apple work occupies only reserved labels slots after timeout',async()=>{
 let release;const keep=setTimeout(()=>{},350);
 const f=await fixture({budget:70,authority:{maxInFlight:1},provider:()=>new Promise(r=>release=r)}),p=await f.leaseInput();
 try{assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(await f.leaseInput(2),null);assert.equal(f.subscribe(2),true);assert.equal(f.counter(),2);release(appleRecord(f.now()));await new Promise(r=>setImmediate(r));assert.ok(await f.leaseInput(3));}
 finally{release?.(appleRecord(f.now()));clearTimeout(keep);}
});
for(const [name,change]of [
 ['decision native key',r=>r.fingerprint=digest('other native key')],
 ['decision paid digest',r=>r.paidDigest=digest('other purchase')],
 ['decision challenge',r=>r.challengeId=randomUUID()],
 ['decision purpose',r=>r.attest.purpose='gridly-subscription-verification-v1'],
 ['decision app identity',r=>r.attest.appId='com.gridlygo.prototype.labeltiles.pilot'],
 ['decision App Attest environment',r=>r.attest.environment='development'],
 ['decision StoreKit environment',r=>r.paid.environment='production'],
 ['decision expired paid period',r=>r.paid.periodEnd=1],
 ['decision revoked eligibility',r=>r.paid.revoked=true],
 ['decision lineage',r=>r.paid.lineage='customer-identity'],
 ['decision client flag',r=>r.paid.paid=true]
]){
 test('authenticated '+name+' mismatch is rejected after a real synthetic assertion',async()=>{
  const f=await fixture({mutateResponse:p=>{if(p.body.operation==='authorize'){change(p.body.result);resignResponse(p);}}}),input=await f.leaseInput();
  assert.notEqual((await f.gateway.issueLease(input)).status,201);assert.equal(f.counter(),1);assert.equal(f.state.metrics().leases,0);
 });
}
test('valid decision delayed beyond request expiry cannot reach gateway lease state',async()=>{
 let calls=0,f;f=await fixture({delayResponse:()=>{if(++calls===2)f.advance(5001);}});
 const p=await f.leaseInput();assert.notEqual((await f.gateway.issueLease(p)).status,201);assert.equal(f.counter(),1);assert.equal(f.state.metrics().leases,0);
});
test('oversized response is rejected before use',async()=>{
 const f=await fixture({mutateResponse:p=>{p.body.oversized='z'.repeat(c.responseBytes);resignResponse(p);}});assert.equal(await f.leaseInput(),null);
});
test('explicit request expiry and unknown operation are enforced',async()=>{
 for(const mutate of [p=>{p.body.issuedAt-=10000;p.body.expiresAt-=10000;},p=>p.body.operation='verify_subscription']){
  const f=await fixture({mutateRequest:p=>{mutate(p);resignRequest(p);}});assert.equal(await f.leaseInput(),null);assert.equal(f.counter(),0);
 }
});
test('labels lease and internal decision cannot authorize unchanged paid reporting',async()=>{
 const {verifyPaidReportProof}=await import('../../../../reference/build18/supabase/functions/_shared/paid-report.mjs');
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const f=await fixture(),p=await f.leaseInput(),decision=await f.client.authorize(p);
 for(const value of [decision,JSON.stringify(decision),JSON.stringify(f.responses.at(-1))]){
  assert.equal(await verifyPaidReportProof(value,{publicKey:keys.publicKey,now:f.now()}),false);
 }
 assert.equal(decision.entitlementProof,undefined);assert.equal(decision.paid.proof,undefined);
});
test('existing Apple Node response MAC/normalization path succeeds through bounded factory',async()=>{
 const {createHmac}=await import('node:crypto'),{canonical}=await import('../contract.mjs');
 const bytes=Buffer.alloc(32,11),hmacKey=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']),now=Date.now(),signal=AbortSignal.timeout(1000);
 const factory=existingAppleProviderFactory({url:'https://synthetic.lambda-url.us-east-1.on.aws',token:'s'.repeat(43),hmacKey,now:()=>now,fetchImpl:async(u,o)=>{
  const input=JSON.parse(o.body),requestDigest=(await import('node:crypto')).createHash('sha256').update(input.environment+'\n'+input.signedTransaction).digest('hex');
  const body={version:1,environment:'sandbox/test',requestDigest,issuedAt:now,originalReference:'synthetic-purchase',
   transaction:{bundleId:c.appId,productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:'Sandbox',originalTransactionId:'synthetic-purchase',expiresDate:now+60000,revocationDate:null},
   renewal:{originalTransactionId:'synthetic-purchase',productId:'com.gridlygo.gridly.monthly',environment:'Sandbox',autoRenewStatus:1},status:1};
  return Response.json({body,mac:createHmac('sha256',bytes).update('gridly-apple-node-v1\n'+canonical(body)).digest('hex')});
 }});
 const r=await factory({signal}).verify('aaa.bbb.ccc',{environment:'sandbox/test'});assert.equal(r.entitlementState,'entitled');assert.equal(r.environment,'sandbox/test');
});

