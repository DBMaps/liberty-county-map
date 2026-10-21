import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from '@playwright/test';
import {productionAndroidSource,PRODUCTION_SPECIALIZED_MODULES} from '../tools/android-production-sources.mjs';
import {loadAndroidOnboardingModel} from '../js/gridly-paid-onboarding.mjs';
import {STORE_VERIFIERS} from '../js/gridly-store-verification.mjs';

test('Android onboarding bounds both headers and body decoding',async()=>{
  const original=globalThis.fetch;
  try {
    for(const phase of ['headers','body']) {
      let signal;
      globalThis.fetch=async(_url,options)=>{signal=options.signal;
        return phase==='headers'?new Promise(()=>{}):{ok:true,json:()=>new Promise(()=>{})};};
      await assert.rejects(loadAndroidOnboardingModel({timeoutMs:15}),/onboarding_unavailable/);
      assert.equal(signal.aborted,true);
    }
    globalThis.fetch=async()=>({ok:true,json:async()=>({areas:[]})});
    assert.deepEqual(await loadAndroidOnboardingModel(),{areas:[]});
  }finally{globalThis.fetch=original;}
});

test('Google product matches the confirmed live catalog; Apple product is unchanged',async()=>{
  assert.equal(STORE_VERIFIERS.google.productId,'com.gridlygo.gridly.monthly');
  assert.equal(STORE_VERIFIERS.google.basePlanId,'monthly');
  assert.equal(STORE_VERIFIERS.apple.productId,'com.gridlygo.gridly.monthly');
  const native=await readFile('android/app/src/main/java/com/gridlygo/gridly/GridlyPlayBillingPlugin.kt','utf8');
  assert.match(native,/const val PRODUCT = "com\.gridlygo\.gridly\.monthly"/);
});

// Real production modules, production key and the actual Capacitor Android
// bridge. Only the native service boundary is simulated. No fixture signer or
// injected composition can grant entitlement in this suite.
test('production Android bridge: first install, safe failures and rejected authority',{timeout:110000},async t=>{
  const exactPackage=!!process.env.GRIDLY_ANDROID_CERTIFIED_WEB_ROOT;
  const root=resolve(process.env.GRIDLY_ANDROID_CERTIFIED_WEB_ROOT||'.'),output=resolve('.artifacts/android-production-recovery/certification');
  await mkdir(output,{recursive:true});
  const bridge=await readFile(process.env.GRIDLY_ANDROID_CERTIFIED_NATIVE_BRIDGE||'node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js','utf8');
  const server=createServer(async(req,res)=>{
    try {
      const path=new URL(req.url,'http://localhost').pathname;
      const rel=path==='/'?'index.html':decodeURIComponent(path.slice(1)),file=resolve(root,rel);
      if(!file.startsWith(root+sep))throw Error();
      let bytes=await readFile(file);
      if(!exactPackage&&PRODUCTION_SPECIALIZED_MODULES.includes(rel))bytes=productionAndroidSource(rel,bytes.toString());
      res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(file)]||'application/octet-stream');
      res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    async function launch(mode,{completed=false}={}) {
      const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      page.setDefaultTimeout(22000);
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      let blockedAsset=false;
      await page.route('**/*',route=>{
        const url=route.request().url();
        if(!url.startsWith(origin))return route.abort();
        if(mode==='onboarding-hung'&&url.includes('paid-onboarding-model.json')&&!blockedAsset){blockedAsset=true;return new Promise(()=>{});}
        return route.continue();
      });
      await page.addInitScript(({mode,completed})=>{
        window.__nativeCalls=[];
        if(completed)localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
        window.androidBridge={postMessage:raw=>{
          const m=JSON.parse(raw);window.__nativeCalls.push(m.pluginId+'.'+m.methodName);
          if(['addListener','removeListener'].includes(m.methodName))return;
          if(mode==='products-hung'&&m.methodName==='getProducts'||mode==='observation-hung'&&m.methodName==='startObserving')return;
          let data={};
          if(m.methodName==='getProducts')data={result:'available',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',displayPrice:'$2.99',displayName:'Gridly Monthly',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false};
          if(['queryCurrentPurchases','restorePurchases','refreshEntitlement'].includes(m.methodName))data={result:'no_evidence',errorCategory:'not_entitled'};
          if(m.methodName==='purchase')data={result:'purchased',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',purchaseToken:'offline.invalid-token'};
          if(mode==='restore-invalid'&&m.methodName==='restorePurchases')data={result:'purchased',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',purchaseToken:'offline.invalid-token'};
          if(m.methodName==='prepare')data={prepared:true};
          if(m.methodName==='authorize')data={type:'google_standard',token:'offline.invalid-integrity'};
          if(m.pluginId==='CapacitorHttp') {
            const challenge=m.options.url==='https://gridlygo.com/subscription-challenge';
            window.__nativeCalls.push(challenge?'challenge':'google-verifier');
            data=challenge?{status:200,data:JSON.stringify({challenge:'a'.repeat(43),expiresAt:new Date(Date.now()+120000).toISOString(),protocolVersion:'gridly-subscription-verification-v1'})}
              :{status:200,data:JSON.stringify({proof:'invalid.fixture.proof'})};
          }
          queueMicrotask(()=>window.Capacitor.fromNative({callbackId:m.callbackId,pluginId:m.pluginId,methodName:m.methodName,success:true,data}));
        }};
      },{mode,completed});
      await page.addInitScript({content:bridge});
      await page.addInitScript(()=>{
        const cap=window.Capacitor;cap.Plugins=cap.Plugins||{};
        for(const [name,methods] of Object.entries({GridlyPlayBilling:['startObserving','stopObserving','getProducts','queryCurrentPurchases','restorePurchases','refreshEntitlement','purchase'],GridlyPlayIntegrity:['prepare','authorize'],CapacitorHttp:['request']})) {
          const plugin=cap.Plugins[name]={};plugin.addListener=(event,callback)=>cap.addListener(name,event,callback);
          for(const method of methods)plugin[method]=options=>cap.nativePromise(name,method,options);
        }
      });
      await page.goto(origin,{waitUntil:'load'});
      return {page,errors};
    }
    const locked=async page=>assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('gridly-paid-locked')&&typeof window.L==='undefined'),true);
    await t.test('fresh customer can actually click through the tour and reach a purchasable paywall',async()=>{
      const {page,errors}=await launch('new');
      try {
        const skip=page.getByRole('button',{name:'Skip walkthrough'});
        await skip.click(); // Playwright hit-testing detects the original covering overlay.
        await page.locator('#gridlyPaidEntrySubscribe').click();
        await page.locator('#gridlyPaidPurchase:not([disabled])').waitFor();
        assert.equal(await page.locator('#gridlyPaidPrice').textContent(),'$2.99/month');
        await locked(page);
        const calls=await page.evaluate(()=>window.__nativeCalls);
        assert.ok(calls.includes('GridlyPlayBilling.queryCurrentPurchases'));
        assert.ok(!calls.includes('challenge'));
        await page.screenshot({path:resolve(output,'repaired-paywall.png')});
        // Actual production attested transport is exercised, but unsigned proof
        // is rejected with the pinned production key. It cannot unlock runtime.
        await page.locator('#gridlyPaidPurchase').click();
        await page.locator('#gridlyPaidStatus').filter({hasText:/could not be verified|temporarily unavailable/}).waitFor();
        await locked(page);
        const after=await page.evaluate(()=>window.__nativeCalls);
        for(const stage of ['challenge','GridlyPlayIntegrity.prepare','GridlyPlayIntegrity.authorize','google-verifier'])assert.ok(after.includes(stage),stage);
        assert.deepEqual(errors,[]);
      } finally {await page.close();}
    });
    await t.test('hung onboarding headers terminate before billing; Retry startup reloads successfully',async()=>{
      const {page,errors}=await launch('onboarding-hung');
      try {
        await page.getByRole('button',{name:'Retry startup'}).waitFor();
        assert.equal(await page.locator('#gridlyPaidPurchase').isDisabled(),true);
        await locked(page);
        assert.deepEqual(await page.evaluate(()=>window.__nativeCalls),[]);
        await page.screenshot({path:resolve(output,'repaired-onboarding-timeout.png')});
        await page.getByRole('button',{name:'Retry startup'}).click();
        await page.getByRole('button',{name:'Skip walkthrough'}).click();
        await page.locator('#gridlyPaidEntrySubscribe').click();
        await page.locator('#gridlyPaidPurchase:not([disabled])').waitFor();
        await locked(page);assert.deepEqual(errors,[]);
      }finally{await page.close();}
    });
    for(const mode of ['restore-unpaid','restore-invalid'])await t.test(mode+' checks store ownership and never bypasses signed authority',async()=>{
      const {page,errors}=await launch(mode,{completed:true});
      try {
        await page.locator('#gridlyPaidEntryRestore:not([disabled])').waitFor();
        await page.locator('#gridlyPaidEntryRestore').click();
        await page.waitForFunction(()=>window.__nativeCalls.includes('GridlyPlayBilling.restorePurchases')&&!document.getElementById('gridlyPaidEntryRestore').disabled);
        await locked(page);
        const calls=await page.evaluate(()=>window.__nativeCalls);
        assert.equal(calls.includes('google-verifier'),mode==='restore-invalid');
        assert.match(await page.locator('#gridlyPaidEntryStatus').textContent(),mode==='restore-invalid'?/could not be verified|temporarily unavailable/:/Subscribe or restore/);
        assert.deepEqual(errors,[]);
      }finally{await page.close();}
    });
    for(const mode of ['products-hung','observation-hung'])await t.test(mode+' reaches an actionable locked failure',async()=>{
      const {page,errors}=await launch(mode,{completed:true});
      try {
        await page.locator('#gridlyPaidEntryRetry:not([disabled])').waitFor();
        assert.equal(await page.locator('#gridlyPaidEntryActions').isVisible(),true);
        await page.locator('#gridlyPaidEntrySubscribe').click();
        assert.equal(await page.locator('#gridlyPaidPurchase').isDisabled(),true);
        await locked(page);assert.deepEqual(errors,[]);
      }finally{await page.close();}
    });
  }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
});
