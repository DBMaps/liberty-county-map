import {strict as assert} from 'node:assert';
import {createHash,createHmac} from 'node:crypto';
import {test} from 'node:test';
import {appleNodeAdapter} from '../supabase/functions/_shared/entitlement/apple-node-provider.mjs';
import {createHandler} from '../supabase/functions/_shared/entitlement/handler.mjs';

const url='https://abc.lambda-url.us-east-1.on.aws/';
const token='A'.repeat(43);
const keyBytes=Buffer.alloc(32,9);
const signed='aaa.bbb.ccc';
const now=Date.now();
const reference='public-test-id';
const transaction={bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',
 environment:'Sandbox',originalTransactionId:reference,expiresDate:now+3600000,revocationDate:null};
const renewal={originalTransactionId:reference,productId:transaction.productId,environment:'Sandbox',autoRenewStatus:1};
const canonical=value=>Array.isArray(value)?'['+value.map(canonical).join(',')+']':
 value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}':JSON.stringify(value);
const facts=()=>({version:1,environment:'sandbox/test',requestDigest:createHash('sha256').update('sandbox/test\n'+signed).digest('hex'),
 issuedAt:now,originalReference:reference,transaction,renewal,status:1});
const envelope=body=>({body,mac:createHmac('sha256',keyBytes).update('gridly-apple-node-v1\n'+canonical(body)).digest('hex')});
const config=async fetchImpl=>({url,token,hmacKey:await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['verify']),fetchImpl,now:()=>now});
const response=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});

test('authenticated Lambda facts reconstruct a trusted Apple record',async()=>{
 let request;
 const adapter=appleNodeAdapter(await config(async(_url,options)=>{request=options;return response(envelope(facts()));}));
 const record=await adapter.verify(signed,{environment:'sandbox/test'});
 assert.equal(request.method,'POST');
 assert.equal(request.redirect,'manual');
 assert.equal(request.headers['x-gridly-apple-node-token'],token);
 assert.equal(record.platform,'apple');
 assert.equal(record.entitlementState,'entitled');
 assert.equal(record.subscriptionState,'active');
 assert.equal(record.environment,'sandbox/test');
});

test('HMAC tamper, malformed facts and environment confusion deny',async()=>{
 const wrongMac=envelope(facts());wrongMac.body={...wrongMac.body,status:5};
 const cases=[wrongMac,envelope({...facts(),transaction:{...transaction,productId:'other'}}),
  envelope({...facts(),environment:'production'}),envelope({...facts(),requestDigest:'0'.repeat(64)}),
  envelope({...facts(),issuedAt:now-120000}),envelope({...facts(),extra:true})];
 for(const body of cases){const adapter=appleNodeAdapter(await config(async()=>response(body)));
  await assert.rejects(adapter.verify(signed,{environment:'sandbox/test'}));}
});

test('unavailable Lambda or oversized result cannot produce an Apple record',async()=>{
 for(const fetchImpl of [async()=>new Response('{}',{status:503}),async()=>new Response('x'.repeat(5000),{status:200})]){
  const adapter=appleNodeAdapter(await config(fetchImpl));
  await assert.rejects(adapter.verify(signed,{environment:'sandbox/test'}));
 }
});

test('invalid Lambda URL or weak token disables Apple composition',async()=>{
 const base=await config(async()=>response(envelope(facts())));
 assert.throws(()=>appleNodeAdapter({...base,url:'http://abc.lambda-url.us-east-1.on.aws/'}));
 assert.throws(()=>appleNodeAdapter({...base,url:'https://abc.lambda-url.us-west-2.on.aws/'}));
 assert.throws(()=>appleNodeAdapter({...base,token:'short'}));
});

test('provider failure after native authorization yields no cache write or proof',async()=>{
 let caches=0;
 const signing=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const fingerprintKey=await crypto.subtle.importKey('raw',Buffer.alloc(32,3),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const provider=appleNodeAdapter(await config(async()=>new Response('{}',{status:503})));
 const handler=createHandler({platform:'apple',authorizeNative:async()=>true,provider,
  cache:{apply:async()=>{caches++;return true;}},signingKey:signing.privateKey,fingerprintKey});
 const body={platform:'apple',environment:'sandbox/test',nativeAuthorizationEnvironment:'production',nonce:'n'.repeat(32),
  productId:transaction.productId,evidence:{signedTransactions:[signed]}};
 const result=await handler(new Request('https://example.invalid/',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal(result.status,502);
 assert.equal(caches,0);
 assert.equal((await result.json()).proof,undefined);
});
