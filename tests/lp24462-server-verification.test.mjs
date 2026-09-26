import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {normalizeApple,normalizeGoogle,cacheRecord,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
import {appleAdapter,googleAdapter} from '../supabase/functions/_shared/entitlement/providers.mjs';
import {createHandler} from '../supabase/functions/_shared/entitlement/handler.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';
const now=Date.parse('2026-09-26T22:00:00.000Z'),end=now+86400000,nonce='a'.repeat(48);
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
const hmac=await webcrypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const tx=(patch={})=>({bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:'Production',originalTransactionId:'synthetic-chain',expiresDate:end,...patch});
const renewal=(patch={})=>({originalTransactionId:'synthetic-chain',productId:'com.gridlygo.gridly.monthly',environment:'Production',autoRenewStatus:1,...patch});
const google=(patch={})=>({regionCode:'US',subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',lineItems:[{productId:'gridly_monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(end).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...patch});
const appleRecord=(t=tx(),r=renewal(),status=1)=>normalizeApple(t,r,status,{env:'production',originalReference:'synthetic-chain',now});
const googleRecord=data=>normalizeGoogle(data,{env:'production',token:'synthetic-google-token',now});
test('Apple active/canceled/expired/revoked/no-grace normalization',()=>{
 assert.equal(appleRecord().entitlementState,'entitled');assert.equal(appleRecord(tx(),renewal({autoRenewStatus:0})).subscriptionState,'canceled_pending_expiry');
 assert.equal(appleRecord(tx({expiresDate:now-1}),renewal(),2).subscriptionState,'expired');
 assert.equal(appleRecord(tx({revocationDate:now}),renewal(),5).entitlementState,'not_entitled');
 assert.equal(appleRecord(tx(),renewal(),4).entitlementState,'unknown');
});
test('Apple bundle/product/environment/chain/type are enforced',()=>{
 for(const patch of [{bundleId:'other'},{productId:'annual'},{environment:'Sandbox'},{originalTransactionId:'other'},{type:'Consumable'},{expiresDate:'invalid'}])assert.throws(()=>appleRecord(tx(patch)),/invalid_evidence/);
 assert.throws(()=>appleRecord(tx(),renewal({productId:'other'})),/invalid_evidence/);
});
test('Apple adapter requires cryptographic verifier and current API status, never decode-only',async()=>{
 const calls=[];const adapter=appleAdapter({env:'production',now:()=>now,
 signedVerifier:{verifyAndDecodeTransaction:async signed=>{calls.push('signed');if(signed==='forged')throw Error('private receipt');return tx();},verifyAndDecodeRenewalInfo:async()=>renewal()},
 apiClient:{getAllSubscriptionStatuses:async()=>{calls.push('current-api');return {data:[{lastTransactions:[{originalTransactionId:'synthetic-chain',status:1,signedTransactionInfo:'verified-current',signedRenewalInfo:'verified-renewal'}]}]};}}});
 assert.equal((await adapter.verify('synthetic.payload.signature')).entitlementState,'entitled');assert.deepEqual(calls,['signed','current-api','signed']);
 await assert.rejects(()=>adapter.verify('forged'));const noVerifier=appleAdapter({env:'production',apiClient:{}});await assert.rejects(()=>noVerifier.verify('unsigned'));
});
test('Google canonical product/package/base plan/env/offer/replacement enforcement',()=>{
 assert.equal(googleRecord(google()).entitlementState,'entitled');
 const bad=[{packageName:'other'},{regionCode:'CA'},{testPurchase:{}},{linkedPurchaseToken:'old'},{lineItems:[{...google().lineItems[0],productId:'other'}]},
 {lineItems:[{...google().lineItems[0],offerDetails:{basePlanId:'annual'}}]},{lineItems:[{...google().lineItems[0],offerDetails:{basePlanId:'monthly',offerId:'trial'}}]}];
 for(const patch of bad)assert.throws(()=>googleRecord(google(patch)),/invalid_evidence/);
 const testResult=normalizeGoogle(google({testPurchase:{}}),{env:'sandbox/test',token:'synthetic-google-token',now});assert.equal(testResult.environment,'sandbox/test');
});
test('Google expiry, cancellation, paused, pending and grace map without access bypass',()=>{
 assert.equal(googleRecord(google({subscriptionState:'SUBSCRIPTION_STATE_CANCELED'})).subscriptionState,'canceled_pending_expiry');
 assert.equal(googleRecord(google({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{...google().lineItems[0],expiryTime:new Date(now-1).toISOString()}]})).subscriptionState,'expired');
 for(const state of ['SUBSCRIPTION_STATE_PAUSED','SUBSCRIPTION_STATE_ON_HOLD'])assert.equal(googleRecord(google({subscriptionState:state})).entitlementState,'not_entitled');
 for(const state of ['SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_IN_GRACE_PERIOD'])assert.equal(googleRecord(google({subscriptionState:state})).entitlementState,'unknown');
});
test('Google real REST construction uses subscriptionsv2.get and distinct acknowledge path',async()=>{
 const calls=[];const adapter=googleAdapter({env:'production',now:()=>now,accessToken:async()=> 'synthetic-oauth',fetchImpl:async(url,options)=>{
 calls.push({url,options});return options.method==='GET'?Response.json(google({acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING'})):new Response(null,{status:204});}});
 const row=await adapter.verify('synthetic-google-token');assert.equal(row.acknowledgementRequired,true);await adapter.acknowledge('synthetic-google-token');
 assert.ok(calls[0].url.endsWith('/applications/com.gridlygo.gridly/purchases/subscriptionsv2/tokens/synthetic-google-token'));
 assert.ok(calls[1].url.endsWith('/purchases/subscriptions/gridly_monthly/tokens/synthetic-google-token:acknowledge'));assert.equal(calls[1].options.method,'POST');assert.equal(calls[0].options.redirect,'manual');
 assert.equal(calls[0].options.headers.Authorization,'Bearer synthetic-oauth');
});
test('cache keeps only keyed fingerprint/minimal state; shared proof interoperates and rejects copies',async()=>{
 for(const record of [appleRecord(),googleRecord(google())]){const cached=await cacheRecord(record,hmac,webcrypto);assert.match(cached.chain_fingerprint,/^[a-f0-9]{64}$/);
 assert.ok(!JSON.stringify(cached).includes(record.reference));assert.ok(!Object.keys(cached).some(k=>/email|install|account|token|receipt/.test(k)));
 const proof=await signResponse(record,nonce,keys.privateKey,webcrypto);
 const snapshot=await verifyAuthorityProof({proof,publicKey:keys.publicKey,nonce,platform:record.platform,now,crypto:webcrypto});
 assert.equal(accessDecision(snapshot,{platform:record.platform,now}).allowed,true);
 await assert.rejects(()=>cacheRecord({...record},hmac,webcrypto));}
});
const request=(platform='apple',patch={})=>new Request('https://example.invalid/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({platform,environment:'production',nonce,productId:platform==='apple'?'com.gridlygo.gridly.monthly':'gridly_monthly',...(platform==='google'?{basePlanId:'monthly'}:{}),evidence:platform==='apple'?{signedTransactions:['synthetic.payload.signature']}:{purchaseTokens:['synthetic-google-token']},...patch})});
function setup(platform='apple') {const events=[];return {events,platform,crypto:webcrypto,signingKey:keys.privateKey,fingerprintKey:hmac,
 authorizeNative:async()=>{events.push('auth');return true;},provider:{verify:async()=>{events.push('provider');return platform==='apple'?appleRecord():googleRecord(google({acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING'}));},acknowledge:async()=>{events.push('ack');}},
 cache:{apply:async row=>{events.push('cache');assert.ok(!JSON.stringify(row).includes('synthetic'));return true;}}};}
test('default Edge skeleton closed; auth before verification; cache before ack; safe signed response',async()=>{
 assert.equal((await createHandler({platform:'apple'})(request())).status,503);
 for(const platform of ['apple','google']){const ports=setup(platform),res=await createHandler(ports)(request(platform));assert.equal(res.status,200);assert.deepEqual(Object.keys(await res.json()),['proof']);
 assert.deepEqual(ports.events,platform==='apple'?['auth','provider','cache']:['auth','provider','cache','ack']);}
 const ports=setup();ports.authorizeNative=async()=>false;assert.equal((await createHandler(ports)(request())).status,401);assert.deepEqual(ports.events,[]);
});
test('malformed/forged/private errors never grant or expose evidence; no arbitrary writes',async()=>{
 const ports=setup();ports.provider.verify=async()=>{throw Error('private receipt token');};const res=await createHandler(ports)(request());assert.equal(res.status,502);assert.deepEqual(await res.json(),{error:'verification_unavailable'});assert.ok(!ports.events.includes('cache'));
 const raw=request('apple',{evidence:{signedTransactions:['not-jws']}});assert.notEqual((await createHandler(setup())(raw)).status,200);
 assert.equal((await createHandler(setup())(request('apple',{active:true}))).status,400);
 assert.equal((await createHandler(setup())(request('apple',{evidence:{signedTransactions:[]}}))).status,422);
 for(const value of [null,[],true])assert.equal((await createHandler(setup())(new Request('https://example.invalid/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)}))).status,400);
 const failedAck=setup('google');failedAck.provider.acknowledge=async()=>{throw Error('private provider response');};const ackRes=await createHandler(failedAck)(request('google'));assert.equal(ackRes.status,502);assert.deepEqual(await ackRes.json(),{error:'verification_unavailable'});
 const stale=setup();stale.cache.apply=async()=>false;assert.equal((await createHandler(stale)(request())).status,409);
});
test('reinstall proves from store without old identity; environment mismatch refused',async()=>{
 for(const platform of ['apple','google']){for(let install=0;install<2;install++)assert.equal((await createHandler(setup(platform))(request(platform))).status,200);}
 assert.notEqual((await createHandler(setup())(request('apple',{environment:'sandbox/test'}))).status,200);
});
test('source privacy/security boundary, no reporting writes or production bypass',()=>{
 for(const file of ['core.mjs','providers.mjs','handler.mjs']){const source=readFileSync(new URL('../supabase/functions/_shared/entitlement/'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/console\.|localStorage|sessionStorage|purchases\.subscriptions\.get|reporting_enabled\s*[:=]\s*true/);}
 for(const platform of ['apple','google'])assert.match(readFileSync(new URL('../supabase/functions/gridly-verify-'+platform+'-subscription/index.ts',import.meta.url),'utf8'),new RegExp("createHandler\\(\\{platform:'"+platform+"'\\}\\)"));
});
