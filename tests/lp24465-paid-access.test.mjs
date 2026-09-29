import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {createPaidAccess,nativeStore} from '../js/gridly-paid-access.mjs';
import {verifyAuthorityProof,accessDecision} from '../js/gridly-entitlement.mjs';
import {productionPaidComposition} from '../js/gridly-paid-config.mjs';
import {normalizeApple,normalizeGoogle,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';
import {readConsumerScriptManifest,runtimePolicy,communitySubmissionContract} from '../tools/native-web.mjs';
const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
const initial=Date.parse('2026-09-27T18:00:00.000Z');
function fixture(platform='apple') {
  let now=initial,expired=false,env='production',reject=false;
  const events=[],handlers=new Map(),timers=new Map();let timerId=0;
  const native=platform==='apple'?{result:'verified',productId:'com.gridlygo.gridly.monthly',environment:'production',state:'active',completionHandle:'test-handle',signedTransaction:'test.payload.signature'}
    :{result:'purchased',productId:'gridly_monthly',basePlanId:'monthly',purchaseToken:'test-private-token'};
  const plugin={getProducts:async()=>({result:'available',productId:native.productId,...(platform==='google'?{basePlanId:'monthly'}:{}),
    displayName:'Gridly Monthly',displayPrice:'$3.49',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
    addListener:async(name,fn)=>{events.push('listen:'+name);handlers.set(name,fn);return {remove:async()=>handlers.delete(name)};},
    startObserving:async()=>events.push('observe'),stopObserving:async()=>events.push('stop'),
    purchase:async()=>{events.push('purchase');return native;},getCurrentEntitlement:async()=>{events.push('current');return native;},
    queryCurrentPurchases:async()=>{events.push('query');return native;},refreshEntitlement:async()=>{events.push('refresh');return native;},
    restorePurchases:async()=>{events.push('restore');return native;},finishTransaction:async()=>{events.push('finish');return {finished:true};}};
  const options={capacitor:{isNativePlatform:()=>true,getPlatform:()=>platform==='apple'?'ios':'android'},plugin,publicKey:keys.publicKey,crypto:webcrypto,now:()=>now,monotonic:()=>now,
    schedule:(fn,delay)=>{timers.set(++timerId,{fn,delay});return timerId;},cancel:id=>timers.delete(id),
    authority:{reconcile:async request=>{
      events.push('server');if(reject)throw Error('private-provider-message');
      const end=now+(expired?-1:86400000);
      const record=platform==='apple'?normalizeApple({bundleId:'com.gridlygo.gridly',productId:native.productId,type:'Auto-Renewable Subscription',environment:env==='production'?'Production':'Sandbox',originalTransactionId:'test-chain',expiresDate:end},
        {originalTransactionId:'test-chain',productId:native.productId,environment:env==='production'?'Production':'Sandbox',autoRenewStatus:1},expired?2:1,{env,originalReference:'test-chain',now})
        :normalizeGoogle({regionCode:'US',subscriptionState:expired?'SUBSCRIPTION_STATE_EXPIRED':'SUBSCRIPTION_STATE_ACTIVE',acknowledgementState:'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED',...(env==='production'?{}:{testPurchase:{}}),
          lineItems:[{productId:native.productId,offerDetails:{basePlanId:'monthly'},expiryTime:new Date(end).toISOString(),autoRenewingPlan:{autoRenewEnabled:true}}]}, {env,token:native.purchaseToken,now});
      return signResponse(record,request.nonce,keys.privateKey,webcrypto);
    }}
  };
  return {options,native,plugin,events,handlers,timers,expired:()=>{expired=true;},sandbox:()=>{env='sandbox/test';},reject:()=>{reject=true;},advance:ms=>{now+=ms;},create:()=>createPaidAccess(options)};
}
test('strict native selection: desktop, PWA and native hints alone are not authority',async()=>{
  for(const cap of [undefined,{isNativePlatform:()=>false,getPlatform:()=> 'ios'},{isNativePlatform:()=>true,getPlatform:()=> 'web'}]) {
    assert.equal(nativeStore(cap),null);const c=createPaidAccess({capacitor:cap});assert.equal((await c.start()).state,'unsupported_platform');assert.equal((await c.purchase()).allowed,false);await c.stop();
  }
  const f=fixture(),c=createPaidAccess({...f.options,...await productionPaidComposition(f.options.capacitor)});
  assert.equal((await c.start()).allowed,false);assert.equal(c.read().state,'temporarily_unavailable');await c.stop();
});
for(const platform of ['apple','google']) {
  test(platform+': silent startup, localized price, finish sequencing, redacted UI and reinstall recovery',async()=>{
    const f=fixture(platform),c=f.create(),states=[];c.subscribe(value=>{states.push(value);if(value.allowed)f.events.push('UI admitted');});
    assert.equal((await c.start()).state,'entitled');assert.equal(c.read().product.displayPrice,'$3.49');assert.ok(!f.events.includes('purchase'));
    if(platform==='apple')assert.ok(f.events.indexOf('finish')<f.events.indexOf('UI admitted'));
    assert.doesNotMatch(JSON.stringify(states),/test-private-token|test\.payload|test-handle|nonce|signedTransaction|purchaseToken/);
    assert.equal((await c.restore()).allowed,true);assert.ok(f.events.includes('restore'));
    await c.stop();assert.equal(f.handlers.size,0);assert.equal(c.allowed(),false);
    const fresh=f.create();assert.equal((await fresh.restore()).allowed,true);await fresh.stop();
  });
  test(platform+': signed expired denial, pending, canceled, transient and sandbox never admit',async()=>{
    for(const kind of ['expired','pending','canceled','transient','sandbox','finish']) {
      if(platform==='google'&&kind==='finish')continue;
      const f=fixture(platform);
      if(kind==='expired')f.expired();if(kind==='transient')f.reject();if(kind==='sandbox')f.sandbox();
      if(kind==='pending')f.plugin.purchase=async()=>({result:'purchase_pending'});
      if(kind==='canceled')f.plugin.purchase=async()=>({result:'user_cancelled',errorCategory:'user_cancelled'});
      if(kind==='finish')f.plugin.finishTransaction=async()=>({finished:false});
      const c=f.create();const value=await c.purchase();assert.equal(value.allowed,false,kind);
      if(kind==='expired')assert.equal(value.state,'not_entitled');
      if(kind==='pending')assert.equal(value.state,'pending');
      if(kind==='canceled')assert.equal(value.errorCategory,'user_canceled');
      assert.doesNotMatch(JSON.stringify(value),/private-provider-message|test-private-token/);await c.stop();
    }
  });
  test(platform+': one observer owner, coalesced resume/update, five-minute expiry is recheck not expiration',async()=>{
    const f=fixture(platform),c=f.create();await Promise.all([c.start(),c.start()]);assert.equal(f.events.filter(x=>x==='observe').length,1);
    f.handlers.get(platform==='apple'?'transactionUpdate':'purchaseUpdate')();f.handlers.get('appForeground')();await c.resume();
    assert.equal(f.events.filter(x=>x==='refresh').length,1);
    assert.equal([...f.timers.values()][0].delay,300000);
    f.advance(300000);assert.equal(c.allowed(),false);
    f.reject();[...f.timers.values()][0].fn();await c.refresh();
    assert.equal(c.read().state,'temporarily_unavailable');assert.equal(c.allowed(),false);await c.stop();assert.equal(f.timers.size,0);
  });
}
test('all protected scripts and inline startup stay inert; governed order preserved; public legal bypass',async()=>{
  const m=await readConsumerScriptManifest(),html=readFileSync('index.html','utf8');
  assert.deepEqual(m.startupScripts,['js/gridly-paid-bootstrap.js']);assert.equal(m.protectedStartupScripts.length,80);
  assert.deepEqual([...html.matchAll(/<script\b([^>]*)>/g)].filter(([,attrs])=>!attrs.includes('application/gridly-protected')).map(([,attrs])=>attrs.trim()),
    ['id="gridly-early-theme"','src="js/gridly-paid-bootstrap.js"']);
  for(const url of ['legal/privacy.html','legal/terms.html','legal/community-guidelines.html','https://gridlygo.com/support','https://gridlygo.com/delete-data'])assert.ok(html.includes('href="'+url+'"'));
  assert.ok(!readFileSync('public-site/index.html','utf8').includes('gridly-paid-bootstrap'));
  for(const file of ['js/gridly-paid-access.mjs','js/gridly-paid-ui.mjs','js/gridly-paid-startup.mjs','js/gridly-paid-config.mjs','js/gridly-entitlement-public-key.mjs','css/gridly-paid-access.css'])assert.ok(runtimePolicy.files.includes(file));
  const contract=await communitySubmissionContract(process.cwd());assert.equal(contract.protocol_version,2);assert.equal(contract.scripts.length,2);
});
test('accepted seven-page source and completion preferences preserved; no store checks in app',()=>{
  const app=readFileSync('js/app.js','utf8');const section=app.slice(app.indexOf('function renderGridlyV858FirstRunExperience('));
  assert.deepEqual([...section.slice(0,section.indexOf('const pageTrack')).matchAll(/data-gridly-onboarding-page="([^"]+)"/g)].map(m=>m[1]),['welcome','awareness','map','alerts','report','settings','setup']);
  assert.match(app,/gridlyWelcomeSeenV1/);assert.doesNotMatch(app,/createPaidAccess|createAppleStoreKit|createGooglePlayBilling/);
});
test('observer startup is bounded and a late listener after stop is removed without observing',async()=>{
  const f=fixture();let release;
  f.plugin.addListener=()=>new Promise(resolve=>{release=()=>resolve({remove:async()=>f.events.push('removed late')});});
  f.options.timeoutMs=5;const c=f.create();const starting=c.start();
  await new Promise(resolve=>setTimeout(resolve,15));assert.equal(c.read().state,'temporarily_unavailable');
  await c.stop();release();await starting;await new Promise(resolve=>setTimeout(resolve,5));
  assert.ok(f.events.includes('removed late'));assert.ok(!f.events.includes('observe'));assert.equal(c.allowed(),false);
});
test('protected initialization requires current proof and serializes lifecycle rechecks',async()=>{
  const f=fixture(),c=f.create();let started=false;
  await assert.rejects(c.initializeRuntime(()=>{started=true;}));assert.equal(started,false);
  await c.start();let release;const initialization=c.initializeRuntime(async allowed=>{
    assert.equal(allowed(),true);await new Promise(resolve=>{release=resolve;});assert.ok(!f.events.includes('refresh'));
  });
  await new Promise(resolve=>setTimeout(resolve,0));const refresh=c.resume();release();await initialization;await refresh;
  assert.equal(f.events.filter(x=>x==='refresh').length,1);await c.stop();
});
test('a still-valid signed proof stays admitted during background refresh, then explicit denial revokes it',async()=>{
  const f=fixture(),c=f.create(),states=[];c.subscribe(value=>states.push({state:value.state,allowed:value.allowed}));
  assert.equal((await c.start()).allowed,true);
  let entered,release;
  const queried=new Promise(resolve=>{entered=resolve;});
  f.plugin.refreshEntitlement=async()=>{entered();return new Promise(resolve=>{release=()=>resolve(f.native);});};
  const check=c.refresh();await queried;
  assert.equal(c.read().allowed,true);
  assert.equal(states.at(-1).state,'entitled');
  release();assert.equal((await check).allowed,true);
  f.plugin.refreshEntitlement=async()=>f.native;
  f.reject();assert.equal((await c.refresh()).allowed,true); // transient server failure within the signed proof lifetime
  f.plugin.refreshEntitlement=async()=>({result:'no_evidence'});
  const denied=await c.refresh();assert.equal(denied.allowed,false);assert.equal(denied.state,'not_entitled');
  await c.stop();
});
test('signed not-entitled startup and invalid authority expose no protected initialization',async()=>{
  for(const invalid of [false,true]) {
    const f=fixture();if(invalid)f.options.authority.reconcile=async()=> 'forged.payload.signature';else f.expired();
    const c=f.create();assert.equal((await c.start()).state,invalid?'unknown':'not_entitled');
    let called=false;await assert.rejects(c.initializeRuntime(()=>{called=true;}));assert.equal(called,false);await c.stop();
  }
});
test('Apple volatile delivery cannot grant access while transaction finish is still outstanding',async()=>{
  const f=fixture();let finish;
  f.plugin.finishTransaction=()=>new Promise(resolve=>{finish=()=>resolve({finished:true});});
  const c=f.create(),purchase=c.purchase();
  while(!finish)await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(c.allowed(),false);assert.equal(c.read().allowed,false);finish();
  assert.equal((await purchase).allowed,true);await c.stop();
});
test('release composition has no debug, storage, sandbox, evidence logs, free offer or reporting activation',()=>{
  const files=['js/gridly-paid-access.mjs','js/gridly-paid-ui.mjs','js/gridly-paid-startup.mjs','js/gridly-paid-config.mjs','js/gridly-paid-bootstrap.js'];
  const source=files.map(file=>readFileSync(file,'utf8')).join('\n');
  assert.doesNotMatch(source,/localStorage|sessionStorage|URLSearchParams|console\.|sandbox\/test|reporting_enabled\s*[:=]\s*true|service_role|sb_secret_|eyJ[A-Za-z0-9_-]{30}/);
  assert.match(source,/environment:platform==='apple'\?'auto':'production'/);assert.match(source,/importProductionEntitlementKey/);assert.match(source,/createNativeAttestedInvoke/);
  const gate=readFileSync('index.html','utf8').split('<section id="gridlyPaidAccess"')[1].split('</section>')[0];
  assert.doesNotMatch(gate,/free tier|free trial|annual plan|refund guarantee|direct billing/i);
  assert.match(gate,/Cancel anytime through store settings/);assert.match(gate,/Automatically renews/);
});

// No replacement continuity window is selected by these tests.
test('proof freshness is independent of provider period end; signed revocation overrides future period',async()=>{
 const nonce='n'.repeat(40),end=initial+86400000;
 const transaction={bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:'Production',originalTransactionId:'fixture-chain',expiresDate:end};
 const renewal={originalTransactionId:'fixture-chain',productId:transaction.productId,environment:'Production',autoRenewStatus:1};
 const verify=async record=>verifyAuthorityProof({proof:await signResponse(record,nonce,keys.privateKey,webcrypto),publicKey:keys.publicKey,nonce,platform:'apple',now:initial,crypto:webcrypto});
 const current=await verify(normalizeApple(transaction,renewal,1,{env:'production',originalReference:'fixture-chain',now:initial}));
 assert.equal(current.subscriptionState,'active');assert.equal(Date.parse(current.currentPeriodEnd),end);
 assert.equal(accessDecision(current,{platform:'apple',now:initial+300000}).reason,'verification_required');
 assert.equal(current.subscriptionState,'active'); // proof staleness did not change the subscription
 const revoked=await verify(normalizeApple({...transaction,revocationDate:initial},renewal,5,{env:'production',originalReference:'fixture-chain',now:initial}));
 assert.equal(Date.parse(revoked.currentPeriodEnd),end);assert.equal(revoked.entitlementState,'not_entitled');
 assert.equal(accessDecision(revoked,{platform:'apple',now:initial}).allowed,false);
});
test('transient verification failure retains only an unexpired signed proof, never claims subscription expiry',async()=>{
 for(const platform of ['apple','google']) {
  const f=fixture(platform),c=f.create();await c.start();f.reject();const result=await c.refresh();
  assert.equal(result.state,'entitled');assert.equal(result.allowed,true);
  f.advance(300000);const stale=await c.refresh();
  assert.equal(stale.state,'temporarily_unavailable');assert.equal(stale.allowed,false);assert.notEqual(stale.state,'not_entitled');await c.stop();
 }
});
