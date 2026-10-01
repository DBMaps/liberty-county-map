import test from 'node:test';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import {webcrypto} from 'node:crypto';
import {chromium} from '@playwright/test';
import {build,functionSource} from '../tools/build-paid-onboarding.mjs';
import {normalizeApple,signResponse} from '../supabase/functions/_shared/entitlement/core.mjs';

test('accepted geography remains identical and Android tour changes are gated',async()=>{
 const app=(await readFile('js/app.js','utf8')).replaceAll('\r\n','\n');
 const module=(await readFile('js/gridly-paid-onboarding.mjs','utf8')).replaceAll('\r\n','\n');
 const expected=await build(app),model=JSON.parse(await readFile('assets/onboarding/paid-onboarding-model.json','utf8'));
 assert.equal(model.sourceHash,expected.hash);assert.deepEqual({...model,sourceHash:undefined},{...JSON.parse(JSON.stringify(expected.model)),sourceHash:undefined});
 assert.ok(model.areas.length>2000);assert.equal(Object.keys(model.registry).length,254);
 for(const name of ['bindGridlyV872FirstRunActivation','resolveGridlyAwarenessAreaQuery','resolveGridlyV858FirstRunLocation','resolveGridlyV858NearestAwarenessArea','showGridlyV859FirstRunCompletionMoment'])assert.equal(functionSource(module,name),functionSource(app,name),name);
 assert.match(module,/if\(isAndroid\)overlay\.querySelector\('\[data-gridly-onboarding-page="report"\]'\)\?\.remove\(\)/);
 assert.match(module,/const isLandscape = isAndroid[\s\S]*?physicalWalkthroughLandscape\(window\)[\s\S]*?: \(window\.matchMedia\?\.\("\(orientation: landscape\)"\)\?\.matches \?\? \(window\.innerWidth > window\.innerHeight\)\)/);
 assert.doesNotMatch(module,/createPaidAccess|signedTransactions|purchaseTokens|console\.|initMap\(|initSupabase\(/);
});

test('browser: four owner install cases, setup/skip/restore, public bypass and protected admission',async()=>{
 const keys=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
 const jwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
 const manifest=JSON.parse(await readFile('consumer-script-manifest.json','utf8'));
 const protectedPaths=new Set(manifest.protectedStartupScripts.filter(s=>s.startsWith('js/')).map(s=>'/'+s.split('?')[0]));
 const requests=[];let active=false;
 const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
  if(path==='/js/gridly-paid-config.mjs') {
   res.setHeader('Content-Type','text/javascript');res.end(`const key=await crypto.subtle.importKey('jwk',${JSON.stringify(jwk)},{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   export function productionPaidComposition(capacitor){return {capacitor,plugin:capacitor.Plugins.GridlyStoreKit,publicKey:key,authority:{reconcile:async request=>{const response=await fetch('/__fixture_verify',{method:'POST',body:JSON.stringify(request)});return (await response.json()).proof;}}};}`);return;
  }
  if(path==='/__fixture_verify') {
   let body='';for await(const chunk of req)body+=chunk;
   const request=JSON.parse(body);if(request.evidence.signedTransactions[0]==='purchase.fixture.signature')active=true;
   const now=Date.now(),end=now+(active?86400000:-1000);
   const record=normalizeApple({bundleId:'com.gridlygo.gridly',productId:'com.gridlygo.gridly.monthly',type:'Auto-Renewable Subscription',environment:'Production',originalTransactionId:'fixture-chain',expiresDate:end},
    {originalTransactionId:'fixture-chain',productId:'com.gridlygo.gridly.monthly',environment:'Production',autoRenewStatus:1},active?1:2,{env:'production',originalReference:'fixture-chain',now});
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({proof:await signResponse(record,request.nonce,keys.privateKey,webcrypto)}));return;
  }
  if(protectedPaths.has(path)) {
   res.setHeader('Content-Type','text/javascript');res.end(path==='/js/app.js'?`document.addEventListener('DOMContentLoaded',()=>{window.homeInitialized=true;document.body.classList.add('gridly-v2-presentation-owner-active');window.gridlyReleaseFirstPaintWhenPresentationReady?.();window.gridlyApplyPreAccessSetup?.({complete:(area,options)=>{window.appliedSetup={areaKey:area.key,zipCode:options.zipCode};return true;},setLocation:()=>{}});});`:'');return;
  }
  if(path.startsWith('/https') || path==='/.well-known/appspecific/com.chrome.devtools.json') {res.statusCode=404;res.end();return;}
  try {
   const full=resolve(process.cwd(),'.'+(path==='/'?'/index.html':path));if(!full.startsWith(resolve(process.cwd())+'\\'))throw Error();
   let bytes=await readFile(full);
   // Exact vendor authorities are local fixtures; never contact a live provider.
   if(path==='/'||path==='/index.html')bytes=Buffer.from(bytes.toString().replace('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','/__vendor.js').replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','/__vendor.js'));
   res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(full)]||'application/octet-stream');res.end(bytes);
  }catch{if(path==='/__vendor.js'){res.setHeader('Content-Type','text/javascript');res.end('');}else{res.statusCode=404;res.end();}}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  for(const scenario of [{name:'A new/no entitlement',complete:false,entitled:false,manual:true},{name:'B new/existing store entitlement',complete:false,entitled:true},
    {name:'C returning entitled',complete:true,entitled:true},{name:'D returning not entitled',complete:true,entitled:false}]) {
   active=scenario.entitled;requests.length=0;
   const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true});
   await context.route(/^https:\/\//,route=>route.abort());
   await context.addInitScript(({complete})=>{
    if(complete)localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
    localStorage.setItem('gridlyEntitled','true');window.purchases=0;window.handlers={};
    const result=value=>({result:'verified',productId:'com.gridlygo.gridly.monthly',environment:'production',state:'active',completionHandle:'fixture-handle',signedTransaction:value});
    window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{GridlyStoreKit:{
     getProducts:async()=>({result:'available',productId:'com.gridlygo.gridly.monthly',displayName:'Gridly Monthly',displayPrice:'$3.49',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
     addListener:async(name,fn)=>{window.handlers[name]=fn;return {remove:async()=>delete window.handlers[name]};},startObserving:async()=>{},stopObserving:async()=>{},
     getCurrentEntitlement:async()=>result('query.fixture.signature'),refreshEntitlement:async()=>result('query.fixture.signature'),
     restorePurchases:async()=>result('query.fixture.signature'),purchase:async()=>{window.purchases++;return result('purchase.fixture.signature');},finishTransaction:async()=>({finished:true})}}};
   },{complete:scenario.complete});
   const page=await context.newPage();await page.goto(origin+'/');
   if(!scenario.complete) {
    await page.locator('#gridlyWelcomeOnboarding:not([hidden])').waitFor();
    await page.locator('#gridlyV950NextBtn').waitFor();assert.equal(await page.locator('[data-gridly-onboarding-page]').count(),7,scenario.name);
    assert.equal(await page.locator('#gridlyPaidAccess').isVisible(),false);
    await page.waitForFunction(()=>Object.keys(window.handlers).length===2);
    assert.ok(!requests.some(path=>protectedPaths.has(path)),scenario.name);assert.equal(await page.evaluate(()=>window.homeInitialized),undefined);
    await page.locator('#gridlyPaidLegalAccess summary').click();assert.equal(await page.locator('#gridlyPaidLegalAccess a').count(),5);
    await page.locator('#gridlyPaidLegalAccess summary').click();
    if(scenario.manual) {
     for(let i=0;i<6;i++)await page.locator('#gridlyV950NextBtn').click();
     await page.locator('#gridlyV858LocationInput').fill('77535');await page.locator('#gridlyV858ManualLocationForm button').click();
     await page.getByText('You’re all set.').waitFor();
    } else await page.locator('#gridlyV894CFirstRunSkipBtn').click();
   }
   if(!scenario.entitled) {
    await page.locator('#gridlyPaidStatus').filter({hasText:'Subscribe or restore'}).waitFor();
    assert.equal(await page.locator('#gridlyPaidAccess').isVisible(),true);assert.ok(!requests.some(path=>protectedPaths.has(path)),scenario.name);
    assert.equal(await page.locator('#gridlyPaidPrice').textContent(),'$3.49/month');
    await page.locator('#gridlyPaidRestore').click();await page.locator('#gridlyPaidStatus').filter({hasText:'Subscribe or restore'}).waitFor();
    assert.equal(await page.evaluate(()=>window.purchases),0);
    await page.locator('#gridlyPaidPurchase').click();
   }
   await page.waitForFunction(()=>window.homeInitialized===true);
   assert.equal(await page.locator('#gridlyPaidAccess').isVisible(),false,scenario.name);
   assert.equal(await page.evaluate(()=>window.purchases),scenario.entitled?0:1);
   assert.equal(await page.locator('#gridlyWelcomeOnboarding').getAttribute('hidden'),'');
   assert.equal(await page.locator('#gridlyWelcomeOnboarding').evaluate(node=>node.inert),false);
   if(scenario.manual)assert.deepEqual(await page.evaluate(()=>window.appliedSetup),{areaKey:'dayton',zipCode:'77535'});
   await context.close();
  }
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});

test('isolated accepted geography resolver handles region aliases, towns and unknown inputs',async()=>{
 const result=await build(await readFile('js/app.js','utf8')),model=result.model;
 const context=vm.createContext({model});
 vm.runInContext(`const GRIDLY_DEFAULT_COUNTY_ID='liberty-tx';const GRIDLY_COUNTY_REGISTRY=model.registry,GRIDLY_COUNTY_BOUNDARY_OVERLAY_GEOID_BY_ID=model.geoids,GRIDLY_AWARENESS_AREA_DEFINITIONS=model.areas;const GRIDLY_AWARENESS_AREA_BY_KEY=Object.fromEntries(model.areas.map(a=>[a.key,a]));const GRIDLY_LP051_ZIP_AWARENESS_INDEX=model.zip,GRIDLY_V858_FIRST_RUN_ZIP_TO_AREA=model.zipFallback,GRIDLY_LP035_HOUSTON_REGION_MODEL=model.houston,GRIDLY_LP035_HOUSTON_REGION_LABEL_ALIASES=model.houstonAliases;const GRIDLY_V872_FIRST_RUN_NEAREST_AREA_MAX_DISTANCE=0.85;`+result.functions,context);
 for(const region of model.houston)for(const input of [region.id,...(model.houstonAliases[region.id]||[])]) {
  context.input=input;assert.equal(vm.runInContext('resolveGridlyAwarenessArea(input)?.key',context),region.id,input);
 }
 for(const input of ['Dayton','Dallas','77535','never-a-real-town']) {context.input=input;assert.doesNotThrow(()=>vm.runInContext('resolveGridlyV858FirstRunLocation(input)',context));}
});
