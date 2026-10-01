import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {productionPaidComposition} from '../js/gridly-paid-config.mjs';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';
import {storeVerificationRequest} from '../js/gridly-store-verification.mjs';
import {nativeVerificationBinding} from '../js/gridly-native-verification-binding.mjs';
import {productionComposition} from '../supabase/functions/_shared/entitlement/composition.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';

const now=Date.parse('2026-09-28T22:00:00.000Z');
const nonce='n'.repeat(40),productId='com.gridlygo.gridly.monthly';
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const fingerprintKey=await webcrypto.subtle.importKey('raw',new Uint8Array(32).fill(7),{name:'HMAC',hash:'SHA-256'},false,['sign']);

function server() {
 const calls={native:[],provider:[],cache:[]};
 const apple=environment=>({
  signedVerifier:{
   verifyAndDecodeTransaction:async signed=>{
    calls.provider.push(environment);
    if(signed!==`signed-${environment}.payload.signature`&&signed!==`current-${environment}`)throw Error('invalid_evidence');
    return {bundleId:'com.gridlygo.gridly',productId,type:'Auto-Renewable Subscription',environment,
      originalTransactionId:'test-chain',expiresDate:now+86400000};
   },
   verifyAndDecodeRenewalInfo:async signed=>{
    if(signed!==`renewal-${environment}`)throw Error('invalid_evidence');
    return {originalTransactionId:'test-chain',productId,environment,autoRenewStatus:1};
   }
  },
  apiClient:{getAllSubscriptionStatuses:async()=>({data:[{lastTransactions:[{
   originalTransactionId:'test-chain',signedTransactionInfo:`current-${environment}`,
   signedRenewalInfo:`renewal-${environment}`,status:1}]}]})}
 });
 const runtime=productionComposition({authorizeNative:async args=>{calls.native.push(args.environment);return true;},
  cache:{apply:async record=>{calls.cache.push(record);return true;}},signingKey:keys.privateKey,fingerprintKey,
  apple:{production:apple('Production'),sandbox:apple('Sandbox'),now:()=>now},crypto:webcrypto});
 return {runtime,calls};
}
function request(environment,signed=`signed-${environment==='production'?'Production':'Sandbox'}.payload.signature`,nativeAuthorizationEnvironment='production') {
 const body={platform:'apple',environment,nativeAuthorizationEnvironment,nonce,productId,
  evidence:{signedTransactions:[signed]},nativeChallenge:'c'.repeat(43),
  nativeAuthorization:{type:'apple_assertion',keyId:'opaque',object:'opaque'}};
 return new Request('https://fixture.invalid/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}

test('production native authorization and signed sandbox ownership stay independent',async()=>{
 const {runtime,calls}=server();
 const response=await runtime.apple(request('sandbox/test'));
 assert.equal(response.status,200,JSON.stringify(calls));
 const {proof}=await response.json();
 const sandbox=await verifyAuthorityProof({proof,publicKey:keys.publicKey,nonce,platform:'apple',environment:'sandbox/test',now,crypto:webcrypto});
 assert.equal(sandbox.entitlementState,'entitled');
 assert.equal(accessDecision(sandbox,{platform:'apple',environment:'production',now}).allowed,false);
 assert.equal(accessDecision(sandbox,{platform:'apple',environment:'sandbox/test',now}).allowed,true);
 assert.deepEqual(calls.native,['production']);
 assert.deepEqual(calls.provider,['Sandbox','Sandbox']);
 assert.equal(calls.cache[0].environment,'sandbox_test');
});

test('production native authorization and signed production ownership remain valid',async()=>{
 const {runtime,calls}=server();
 const response=await runtime.apple(request('production'));
 assert.equal(response.status,200,JSON.stringify(calls));
 const {proof}=await response.json();
 const production=await verifyAuthorityProof({proof,publicKey:keys.publicKey,nonce,platform:'apple',environment:'production',now,crypto:webcrypto});
 assert.equal(production.entitlementState,'entitled');
 assert.deepEqual(calls.native,['production']);
 assert.equal(calls.cache[0].environment,'production');
});

test('forged environment claims, unsigned evidence and no ownership never mint proof',async()=>{
 for(const [env,signed,nativeEnv] of [
  ['production','signed-Sandbox.payload.signature','production'],
  ['sandbox/test','signed-Production.payload.signature','production'],
  ['sandbox/test','forged.payload.signature','production'],
  ['sandbox/test','signed-Sandbox.payload.signature','sandbox/test']
 ]) {
  const {runtime,calls}=server();
  const response=await runtime.apple(request(env,signed,nativeEnv));
  assert.notEqual(response.status,200);
  assert.equal(calls.cache.length,0);
 }
 const {runtime,calls}=server();
 const body={platform:'apple',environment:'sandbox/test',nativeAuthorizationEnvironment:'production',nonce,productId,
  evidence:{signedTransactions:[]}};
 const response=await runtime.apple(new Request('https://fixture.invalid/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
 assert.notEqual(response.status,200);
 assert.equal(calls.cache.length,0);
 assert.throws(()=>storeVerificationRequest({platform:'apple',environment:'sandbox/test',nonce,evidence:{signedTransactions:['test.payload.signature']}}));
});

test('native challenge digest binds both environments',async()=>{
 const body={platform:'apple',environment:'sandbox/test',nativeAuthorizationEnvironment:'production',nonce,productId,
  evidence:{signedTransactions:['synthetic.payload.signature']}};
 const challenge='c'.repeat(43);
 const original=await nativeVerificationBinding({challenge,request:body,crypto:webcrypto});
 const storeChanged=await nativeVerificationBinding({challenge,request:{...body,environment:'production'},crypto:webcrypto});
 assert.notEqual(original.requestHash,storeChanged.requestHash);
 assert.throws(()=>storeVerificationRequest({...body,nativeAuthorizationEnvironment:'development'}));
});

test('iOS nonowner startup loads StoreKit metadata and stays unpaid without a purchase',async()=>{
 let products=0,current=0,purchases=0,restores=0,serverCalls=0;
 const store={
  addListener:async()=>({remove:async()=>{}}),startObserving:async()=>({observing:true}),stopObserving:async()=>({observing:false}),
  getProducts:async()=>{products++;return {result:'available',productId,displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false};},
  getCurrentEntitlement:async()=>{current++;return {result:'no_evidence',errorCategory:'not_entitled'};},
  refreshEntitlement:async()=>({result:'no_evidence',errorCategory:'not_entitled'}),
  restorePurchases:async()=>{restores++;return {result:'no_evidence',errorCategory:'not_entitled'};},
  purchase:async()=>{purchases++;throw Error('unexpected_purchase');}
 };
 const capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',
  isPluginAvailable:name=>['GridlyStoreKit','GridlyAppAttest','CapacitorHttp'].includes(name),
  registerPlugin:name=>name==='GridlyStoreKit'?store:{authorize:async()=>{serverCalls++;throw Error();}},
  nativePromise:async()=>{serverCalls++;throw Error();}};
 const composition=await productionPaidComposition(capacitor);
 assert.equal(composition.plugin,store);assert.ok(composition.authority);assert.ok(composition.publicKey);
 const coordinator=createPaidAccess({...composition,crypto:webcrypto,now:()=>now,monotonic:()=>0});
 const started=await coordinator.start();
 assert.equal(products,1);assert.equal(current,1);assert.equal(started.product.displayPrice,'$2.99');
 assert.equal(started.product.available,true);assert.equal(started.verificationReady,true);
 assert.equal(started.state,'not_entitled');assert.equal(started.allowed,false);
 assert.equal(purchases,0);assert.equal(serverCalls,0);
 await coordinator.restore();assert.equal(restores,1);assert.equal(coordinator.allowed(),false);
 await coordinator.stop();
});

test('injected iOS bridge without registerPlugin starts observation and product lookup',async()=>{
 let observing=0,products=0,current=0,purchases=0,nativeCalls=0;
 const store={
  addListener:async()=>({remove:async()=>{}}),
  startObserving:async()=>{observing++;return {observing:true};},
  stopObserving:async()=>({observing:false}),
  getProducts:async()=>{products++;return {result:'available',productId,displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false};},
  getCurrentEntitlement:async()=>{current++;return {result:'no_evidence',errorCategory:'not_entitled'};},
  purchase:async()=>{purchases++;throw Error('unexpected_purchase');}
 };
 const capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',
  isPluginAvailable:name=>['GridlyStoreKit','GridlyAppAttest','CapacitorHttp'].includes(name),
  Plugins:{GridlyStoreKit:store,GridlyAppAttest:{authorize:async()=>{nativeCalls++;throw Error();}}},
  nativePromise:async()=>{nativeCalls++;throw Error();}};
 assert.equal(capacitor.registerPlugin,undefined);
 const composition=await productionPaidComposition(capacitor);
 assert.equal(composition.plugin,store);
 assert.ok(composition.authority);
 const coordinator=createPaidAccess({...composition,crypto:webcrypto,now:()=>now,monotonic:()=>0});
 const started=await coordinator.start();
 assert.equal(observing,1);
 assert.equal(products,1);
 assert.equal(current,1);
 assert.equal(started.product?.displayPrice,'$2.99');
 assert.equal(started.state,'not_entitled');
 assert.equal(started.allowed,false);
 assert.equal(purchases,0);
 assert.equal(nativeCalls,0);
 await coordinator.stop();
});

test('UI never presents a fallback price as StoreKit metadata',()=>{
 const ui=readFileSync('js/gridly-paid-ui.mjs','utf8');
 assert.match(ui,/value\.product\?\.available\?value\.product\.displayPrice\+'\/month':value\.platform==='google'&&!value\.productLoading\?'Price unavailable':'Price loading…'/);
 assert.match(ui,/value\.product\?\.available!==true\|\|value\.verificationReady!==true/);
 assert.doesNotMatch(ui,/displayPrice:'\$2\.99'|\?value\.product\.displayPrice:'\$2\.99'/);
});
