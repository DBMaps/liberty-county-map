import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createGooglePlayBilling,createGoogleVerificationAuthority,GOOGLE_PRODUCT_ID,GOOGLE_BASE_PLAN_ID} from '../js/gridly-google-play-billing.mjs';
import {normalizeGoogle,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
import {createHandler} from '../supabase/functions/_shared/entitlement/handler.mjs';
import {runtimePolicy} from '../tools/native-web.mjs';
const now=Date.parse('2026-09-27T12:00:00.000Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const hmac=await webcrypto.subtle.generateKey({name:'HMAC',hash:'SHA-256'},false,['sign']);
const data=(patch={})=>({regionCode:'US',startTime:new Date(now-1000).toISOString(),subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_PENDING',lineItems:[{productId:'com.gridlygo.gridly.monthly',offerDetails:{basePlanId:'monthly'},expiryTime:new Date(now+86400000).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}],...patch});
function fixture({env='production',providerData=data()}={}) {
 const events=[],handlers=new Map(),native={result:'purchased',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',purchaseToken:'synthetic-play-token',acknowledgementRequired:true};
 const record=normalizeGoogle(providerData,{env,token:native.purchaseToken,now});
 const plugin={getProducts:async()=>({result:'available',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
 purchase:async()=>{events.push('purchase');return native;},queryCurrentPurchases:async()=>{events.push('query');return native;},refreshEntitlement:async()=>{events.push('refresh');return native;},restorePurchases:async()=>{events.push('restore');return native;},
 addListener:async(name,fn)=>{handlers.set(name,fn);return {remove:async()=>handlers.delete(name)};},startObserving:async()=>{events.push('observe');},stopObserving:async()=>{events.push('stop');}};
 const options={capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'android'},plugin,publicKey:keys.publicKey,crypto:webcrypto,now:()=>now,environment:env,
 authority:{reconcile:async request=>{events.push('server');assert.equal(request.basePlanId,'monthly');assert.deepEqual(request.evidence,{purchaseTokens:['synthetic-play-token']});assert.deepEqual(Object.keys(request).sort(),['basePlanId','environment','evidence','nonce','platform','productId']);return signResponse(record,request.nonce,keys.privateKey,webcrypto);}},
 deliverEntitlement:async(_,guard)=>{assert.ok(guard.isCurrent());events.push('deliver');return true;}};
 return {options,plugin,native,record,events,handlers,session:()=>createGooglePlayBilling(options)};
}
test('canonical product/base plan; localized metadata, no hidden token or invented price',async()=>{
 assert.equal(GOOGLE_PRODUCT_ID,'com.gridlygo.gridly.monthly');assert.equal(GOOGLE_BASE_PLAN_ID,'monthly');const f=fixture(),s=f.session(),original=f.plugin.getProducts;
 assert.equal((await s.lookupProduct()).displayPrice,'$2.99');f.plugin.getProducts=async()=>({...await original(),displayPrice:'$3.49',offerToken:'private'});
 assert.deepEqual(Object.keys(await s.lookupProduct()).sort(),['available','basePlanId','billingPeriod','currency','displayName','displayPrice','productId']);assert.equal((await s.lookupProduct()).displayPrice,'$3.49');
 for(const patch of [{productId:'other'},{basePlanId:'annual'},{billingPeriod:'P1Y'},{hasOffer:true},{storefront:'CA'}]){f.plugin.getProducts=async()=>({...await original(),...patch});assert.equal((await s.lookupProduct()).available,false);}
});
test('successful purchase requires signed authority and delivery; raw evidence never enters read state',async()=>{
 const f=fixture(),s=f.session();await s.purchase();assert.deepEqual(f.events,['purchase','server','deliver']);assert.ok(s.allowed().allowed);assert.doesNotMatch(JSON.stringify(s.read()),/purchaseToken|synthetic-play-token|acknowledgementRequired/);
});
test('missing delivery never activates access',async()=>{const f=fixture();delete f.options.deliverEntitlement;const s=f.session();await s.purchase();assert.equal(s.allowed().allowed,false);});
test('cancel, pending, malformed, unavailable and disconnected purchases fail safely',async()=>{
 for(const [result,errorCategory] of [['error','user_cancelled'],['purchase_pending','purchase_pending'],['error','verification_failed'],['error','billing_unavailable'],['error','billing_disconnected']]){
  const f=fixture();f.plugin.purchase=async()=>({result,errorCategory,debugMessage:'private token'});const s=f.session();await s.purchase();assert.equal(s.allowed().allowed,false);assert.equal(f.events.length,0);assert.doesNotMatch(JSON.stringify(s.read()),/private token/);
 }
});
test('already owned rechecks current purchase without duplicate purchase',async()=>{
 const f=fixture();f.plugin.purchase=async()=>{f.events.push('purchase');return {result:'error',errorCategory:'already_owned'};};await f.session().purchase();assert.deepEqual(f.events,['purchase','query','server','deliver']);
});
test('fresh install restore uses current store token without old install/account identity',async()=>{
 for(let install=0;install<2;install++){const f=fixture(),s=f.session();await s.restore();assert.deepEqual(f.events,['restore','server','deliver']);assert.ok(s.allowed().allowed);}
 const f=fixture();f.plugin.queryCurrentPurchases=async()=>({result:'no_evidence',errorCategory:'not_entitled'});const s=f.session();await s.launch();assert.equal(s.allowed().allowed,false);assert.equal(s.read().entitlementState,'unknown');
 assert.equal(s.read().errorCategory,'no_store_evidence');assert.ok(!f.events.includes('server'));
});
test('genuine BillingClient query failures remain unavailable without invoking authority',async()=>{
 for(const category of ['billing_unavailable','billing_disconnected']){
  const f=fixture();f.plugin.queryCurrentPurchases=async()=>({result:'error',errorCategory:category});
  const s=f.session();await s.launch();assert.equal(s.read().errorCategory,'store_unavailable');
  assert.equal(s.allowed().allowed,false);assert.ok(!f.events.includes('server'));
 }
});
test('signed current expiry/cancellation overrides native PURCHASED hint',async()=>{
 const expired=data({subscriptionState:'SUBSCRIPTION_STATE_EXPIRED',lineItems:[{...data().lineItems[0],expiryTime:new Date(now-1).toISOString()}]});
 const f=fixture({providerData:expired}),s=f.session();await s.launch();assert.equal(s.allowed().allowed,false);assert.equal(s.read().subscriptionState,'expired');assert.ok(!f.events.includes('deliver'));
 const canceled=fixture({providerData:data({subscriptionState:'SUBSCRIPTION_STATE_CANCELED'})}),c=canceled.session();await c.launch();assert.ok(c.allowed().allowed);assert.equal(c.read().subscriptionState,'canceled_pending_expiry');
});
test('launch/resume/update refresh is opt-in, silent, coalesced and disposable',async()=>{
 const f=fixture(),s=f.session();await s.start();await s.start();assert.deepEqual(f.events,['observe','query','server','deliver']);
 await Promise.all([s.resume(),s.resume(),s.resume()]);assert.equal(f.events.filter(x=>x==='refresh').length,1);
 f.handlers.get('purchaseUpdate')();f.handlers.get('appForeground')();await s.resume();assert.equal(f.events.filter(x=>x==='refresh').length,2);await s.stop();assert.equal(f.handlers.size,0);assert.equal(s.allowed().allowed,false);
});
test('server acknowledgment failure denies delivery; recheck retries same purchase without rebuying',async()=>{
 const f=fixture();let attempt=0;
 const handler=createHandler({platform:'google',authorizeNative:async()=>true,provider:{verify:async()=>{f.events.push('provider');return f.record;},acknowledge:async()=>{f.events.push('ack');if(++attempt===1)throw Error('private OAuth token');}},
 ackQueue:{ensure:async({record})=>{f.events.push('ack');if(++attempt===1)throw Error('private OAuth token');return record;}},cache:{apply:async row=>{f.events.push('cache');assert.ok(!JSON.stringify(row).includes('synthetic-play-token'));return true;}},signingKey:keys.privateKey,fingerprintKey:hmac,crypto:webcrypto});
 f.options.authority=createGoogleVerificationAuthority({invoke:async(name,{body})=>{assert.equal(name,'gridly-verify-google-subscription');const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return response.ok?{data:await response.json()}:{error:Error('upstream error')};}});
 const s=f.session();await s.purchase();assert.equal(s.allowed().allowed,false);assert.deepEqual(f.events,['purchase','provider','cache','ack']);await s.restore();assert.ok(s.allowed().allowed);assert.deepEqual(f.events.slice(4),['restore','provider','cache','ack','deliver']);assert.equal(f.events.filter(x=>x==='purchase').length,1);
});
test('default LP244.62 service 503 never delivers or unlocks',async()=>{
 const f=fixture(),handler=createHandler({platform:'google'});f.options.authority=createGoogleVerificationAuthority({invoke:async()=>{const response=await handler(new Request('https://example.invalid',{method:'POST'}));assert.equal(response.status,503);return {error:Error('private detail')};}});
 const s=f.session();await s.launch();assert.equal(s.allowed().allowed,false);assert.ok(!f.events.includes('deliver'));
});
test('sandbox proof cannot unlock production; native never fabricates test classification',async()=>{
 const f=fixture({env:'sandbox/test',providerData:data({testPurchase:{}})});f.options.environment='production';const s=f.session();await s.launch();assert.equal(s.allowed().allowed,false);
});
test('late/forged/private authority failures never deliver',async()=>{
 for(const slow of [false,true]){const f=fixture();f.options.timeoutMs=5;f.options.authority.reconcile=async()=>{if(slow)await new Promise(r=>setTimeout(r,20));return 'forged.payload.signature';};const s=f.session();await s.launch();await new Promise(r=>setTimeout(r,25));assert.equal(s.allowed().allowed,false);assert.ok(!f.events.includes('deliver'));}
});
test('iOS/web/PWA never invoke BillingClient or authority',async()=>{
 for(const platform of ['ios','web']){const f=fixture();f.options.capacitor.getPlatform=()=>platform;const s=f.session();await s.launch();await s.purchase();await s.restore();assert.equal((await s.lookupProduct()).available,false);assert.deepEqual(f.events,[]);}
});
test('native registration, exact dependency, strict offer and privacy contracts',()=>{
 const path='android/app/src/main/java/com/gridlygo/gridly/',native=readFileSync(path+'GridlyPlayBillingPlugin.kt','utf8'),js=readFileSync('js/gridly-google-play-billing.mjs','utf8');
 assert.match(native,/^package com\.gridlygo\.gridly/m);assert.match(readFileSync('android/app/build.gradle','utf8'),/com.android.billingclient:billing:9\.1\.0/);
 assert.match(readFileSync(path+'MainActivity.kt','utf8'),/registerPlugin\(GridlyPlayBillingPlugin::class.java\)/);
 for(const api of ['queryProductDetailsAsync','launchBillingFlow','queryPurchasesAsync','includeSuspendedSubscriptions(true)','getBillingConfigAsync','endConnection','Purchase.PurchaseState.PENDING','offer.offerId != null','INFINITE_RECURRING'])assert.ok(native.includes(api),api);
 assert.doesNotMatch(native+'\n'+js,/Log\.|println\(|console\.|SharedPreferences|localStorage|setObfuscatedAccountId|setObfuscatedProfileId|acknowledgePurchase\(|consumeAsync\(|reporting_enabled\s*[:=]\s*true/);
 assert.ok(runtimePolicy.files.includes('js/gridly-google-play-billing.mjs'));assert.doesNotMatch(readFileSync('index.html','utf8'),/gridly-google-play-billing/);
});
