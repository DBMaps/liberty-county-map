import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createAppleStoreKit,createAppleVerificationAuthority,APPLE_PRODUCT_ID} from '../js/gridly-apple-storekit.mjs';
import {normalizeApple,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
import {createHandler} from '../supabase/functions/_shared/entitlement/handler.mjs';
import {runtimePolicy} from '../tools/native-web.mjs';
const now=Date.parse('2026-09-27T01:00:00.000Z');
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
test('Swift catch binding cannot shadow error-result helper; observer captures stay explicit',()=>{
 const source=readFileSync('ios/App/App/GridlyStoreKitPlugin.swift','utf8');
 assert.match(source,/func resultError\(_ category: String\)/);
 assert.doesNotMatch(source,/\berror\s*\(/,'Swift catch implicitly binds error: do not name/call the helper error');
 assert.equal((source.match(/catch\s*\{\s*return resultError\(/g)||[]).length,2);
 assert.match(source,/Task \{ @MainActor \[self\] in\s+state\.observe \{ \[weak self\]/);
 assert.match(source,/@escaping @MainActor \(\) -> Void/);
 assert.doesNotMatch(source,/addObserver\(forName:/,'no non-Sendable plugin capture in the Foundation Sendable callback');
 assert.match(source,/selector: #selector\(appDidBecomeActive\(_:\)\)/);
 assert.match(source,/Task \{ @MainActor \[weak self\] in\s+self\?\.notifyListeners\("appForeground"/);
 assert.doesNotMatch(source,/@unchecked Sendable|GridlyStoreKitPlugin[^\n]*Sendable/);
});
function fixture({env='production',status=1,cancel=false,end=now+86400000}={}) {
 const events=[],handlers=new Map();
 const native={result:'verified',productId:APPLE_PRODUCT_ID,environment:env,state:'active',expiresAt:new Date(end).toISOString(),revoked:false,completionHandle:'synthetic-handle',signedTransaction:'synthetic.payload.signature'};
 const record=normalizeApple({bundleId:'com.gridlygo.gridly',productId:APPLE_PRODUCT_ID,type:'Auto-Renewable Subscription',environment:env==='production'?'Production':'Sandbox',originalTransactionId:'synthetic-chain',expiresDate:end},
 {originalTransactionId:'synthetic-chain',productId:APPLE_PRODUCT_ID,environment:env==='production'?'Production':'Sandbox',autoRenewStatus:cancel?0:1},status,{env,originalReference:'synthetic-chain',now});
 const plugin={getProducts:async()=>({result:'available',productId:APPLE_PRODUCT_ID,displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
 purchase:async()=>{events.push('purchase');return native;},getCurrentEntitlement:async()=>{events.push('current');return native;},refreshEntitlement:async()=>{events.push('refresh');return native;},
 restorePurchases:async opts=>{assert.deepEqual(opts,{userInitiated:true});events.push('sync');return native;},finishTransaction:async opts=>{assert.deepEqual(opts,{completionHandle:'synthetic-handle'});events.push('finish');return {finished:true};},
 addListener:async(name,fn)=>{handlers.set(name,fn);return {remove:async()=>handlers.delete(name)};},startObserving:async()=>{events.push('observe');},stopObserving:async()=>{events.push('stop');}};
 const options={capacitor:{isNativePlatform:()=>true,getPlatform:()=> 'ios'},plugin,publicKey:keys.publicKey,crypto:webcrypto,now:()=>now,environment:env,
 authority:{reconcile:async request=>{events.push('server');assert.deepEqual(Object.keys(request).sort(),['environment','evidence','nativeAuthorizationEnvironment','nonce','platform','productId']);assert.equal(request.nativeAuthorizationEnvironment,'production');assert.deepEqual(request.evidence,{signedTransactions:['synthetic.payload.signature']});return signResponse(record,request.nonce,keys.privateKey,webcrypto);}},
 deliverEntitlement:async(_,guard)=>{assert.equal(guard.isCurrent(),true);events.push('deliver');return true;}};
 return {options,plugin,native,events,handlers,session:()=>createAppleStoreKit(options)};
}
test('exact product; bounded StoreKit display metadata, never invented launch price',async()=>{
 assert.equal(APPLE_PRODUCT_ID,'com.gridlygo.gridly.monthly');const f=fixture(),s=f.session();assert.equal((await s.lookupProduct()).displayPrice,'$2.99');
 const original=f.plugin.getProducts;f.plugin.getProducts=async()=>({...await original(),displayPrice:'$3.49',privateData:'not returned'});
 const result=await s.lookupProduct();assert.equal(result.displayPrice,'$3.49');assert.equal(result.privateData,undefined);
 for(const patch of [{productId:'other'},{billingPeriod:'P1Y'},{hasOffer:true},{storefront:'CA'}]){f.plugin.getProducts=async()=>({...await original(),...patch});assert.equal((await s.lookupProduct()).available,false);}
});
test('verified purchase: server proof then delivery then exact finish; no evidence in UI state',async()=>{
 const f=fixture(),s=f.session();assert.equal((await s.purchase()).entitlementState,'entitled');assert.deepEqual(f.events,['purchase','server','deliver','finish']);assert.equal(s.allowed().allowed,true);
 assert.doesNotMatch(JSON.stringify(s.read()),/synthetic|signedTransaction|completionHandle/);
});
test('no delivery composition means no early finish or runtime entitlement',async()=>{
 const f=fixture();delete f.options.deliverEntitlement;const s=f.session();await s.purchase();assert.equal(s.allowed().allowed,false);assert.ok(!f.events.includes('finish'));
});
test('unverified/cancelled/pending/no-evidence states never contact verifier or finish',async()=>{
 for(const [result,errorCategory,expected] of [['error','verification_failed','invalid_authority'],['user_cancelled','user_cancelled','user_canceled'],['purchase_pending','purchase_pending','purchase_pending'],['no_evidence','not_entitled','no_store_evidence']]){
  const f=fixture();f.plugin.purchase=async()=>({result,errorCategory});const s=f.session();assert.equal((await s.purchase()).errorCategory,expected);assert.deepEqual(f.events,[]);assert.equal(s.allowed().allowed,false);
 }
});
test('native active hint cannot override signed expiry or revocation; cancellation lasts through period',async()=>{
 for(const config of [{status:2,end:now-1},{status:5},{cancel:true}]){const f=fixture(config),s=f.session();const value=await s.launch();assert.equal(s.allowed().allowed,!!config.cancel);if(config.cancel){assert.equal(value.subscriptionState,'canceled_pending_expiry');assert.ok(f.events.includes('finish'));}else{assert.equal(value.entitlementState,'not_entitled');assert.ok(!f.events.includes('finish'));}}
});
test('explicit restore uses store sync and same verification; new session needs no old identity',async()=>{
 for(let install=0;install<2;install++){const f=fixture(),s=f.session();assert.equal((await s.restore()).entitlementState,'entitled');assert.deepEqual(f.events,['sync','server','deliver','finish']);}
});
test('launch is silent; resume/update signals coalesce and observers dispose',async()=>{
 const f=fixture(),s=f.session();await s.start();assert.deepEqual(f.events,['observe','current','server','deliver','finish']);await s.start();assert.equal(f.events.filter(x=>x==='current').length,1);
 await Promise.all([s.resume(),s.resume(),s.resume()]);assert.equal(f.events.filter(x=>x==='refresh').length,1);
 f.handlers.get('transactionUpdate')();f.handlers.get('appForeground')();await s.resume();assert.equal(f.events.filter(x=>x==='refresh').length,2);
 await s.stop();assert.equal(f.handlers.size,0);assert.equal(s.allowed().allowed,false);
});
test('sandbox cannot establish production; explicit sandbox proof works only in sandbox session',async()=>{
 const f=fixture({env:'sandbox/test'});assert.equal((await f.session().launch()).environment,'sandbox/test');
 f.options.environment='production';const s=f.session();await s.launch();assert.equal(s.allowed().allowed,false);assert.equal(f.events.filter(x=>x==='server').length,1);
});
test('forged proof, server failure and timeout never finish; errors redacted',async()=>{
 for(const variant of ['forged','failure','timeout']){const f=fixture();f.options.timeoutMs=5;f.options.purchaseTimeoutMs=10;
  f.options.authority.reconcile=async()=>{if(variant==='failure')throw Error('private JWS credential');if(variant==='timeout')await new Promise(r=>setTimeout(r,30));return 'forged.payload.signature';};
  const s=f.session();await s.purchase();await new Promise(r=>setTimeout(r,35));assert.equal(s.allowed().allowed,false);assert.ok(!f.events.includes('finish'));assert.doesNotMatch(JSON.stringify(s.read()),/private|credential|synthetic/);
 }
});
test('web/PWA/Android never invoke StoreKit or verifier',async()=>{
 for(const platform of ['web','android']){const f=fixture();f.options.capacitor.getPlatform=()=>platform;f.options.capacitor.isNativePlatform=()=>platform!=='web';const s=f.session();await s.launch();await s.purchase();await s.restore();assert.equal((await s.lookupProduct()).errorCategory,'platform_unavailable');assert.deepEqual(f.events,[]);assert.equal(s.allowed().allowed,false);}
});
test('fixed LP244.62 invoke contract preserves default 503 and redacts provider errors',async()=>{
 const f=fixture();const disabled=createHandler({platform:'apple'});
 f.options.authority=createAppleVerificationAuthority({invoke:async(name,{body})=>{assert.equal(name,'gridly-verify-apple-subscription');assert.equal(body.productId,APPLE_PRODUCT_ID);const response=await disabled(new Request('https://example.invalid',{method:'POST'}));assert.equal(response.status,503);return {error:Error('private upstream detail'),data:await response.json()};}});
 const s=f.session();await s.launch();assert.equal(s.read().errorCategory,'verification_unavailable');assert.equal(s.allowed().allowed,false);assert.ok(!f.events.includes('finish'));
});
test('native registration, StoreKit branches, private evidence and runtime staging boundary',()=>{
 const source=readFileSync('ios/App/App/GridlyStoreKitPlugin.swift','utf8'),js=readFileSync('js/gridly-apple-storekit.mjs','utf8');
 for(const operation of ['getProducts','purchase','getCurrentEntitlement','restorePurchases','refreshEntitlement','finishTransaction','startObserving','stopObserving'])assert.ok(source.includes('name: "'+operation+'"'));
 for(const api of ['Product.products(for: [Self.productID])','Transaction.currentEntitlements','Transaction.latest(for: Self.productID)','Transaction.updates','AppStore.sync()','result.jwsRepresentation','transaction.finish()','renewal.willAutoRenew','.userCancelled','.pending','.unverified'])assert.ok(source.includes(api),api);
 assert.match(source,/call.getBool\("userInitiated"\) == true/);assert.match(source,/completions.count < 16/);assert.match(source,/transaction.ownershipType == .purchased/);
 assert.doesNotMatch(source+'\n'+js,/console\.|print\(|NSLog|localStorage|UserDefaults|deviceId|installationId|reporting_enabled\s*[:=]\s*true/);
 assert.match(readFileSync('ios/App/App/GridlyBridgeViewController.swift','utf8'),/registerPluginInstance\(GridlyStoreKitPlugin\(\)\)/);
 const project=readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8');for(const file of ['GridlyStoreKitPlugin.swift','GridlyBridgeViewController.swift'])assert.ok(project.includes(file+' in Sources'));
 assert.match(readFileSync('ios/App/App/Base.lproj/Main.storyboard','utf8'),/customClass="GridlyBridgeViewController" customModule="App"/);
 assert.doesNotMatch(readFileSync('index.html','utf8'),/gridly-apple-storekit/);
 for(const file of ['js/gridly-apple-storekit.mjs','js/gridly-entitlement.mjs','js/gridly-store-verification.mjs'])assert.ok(runtimePolicy.files.includes(file));
});
