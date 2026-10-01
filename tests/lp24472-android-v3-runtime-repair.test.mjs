import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';
import {physicalWalkthroughLandscape} from '../js/gridly-paid-onboarding.mjs';
import {productionPaidComposition} from '../js/gridly-paid-config.mjs';
import {createPaidAccess} from '../js/gridly-paid-access.mjs';

const product={result:'available',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',
  displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false};
function androidCapacitor(getProducts=async()=>product) {
  const billing={addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
    getProducts,queryCurrentPurchases:async()=>({result:'no_evidence',errorCategory:'not_entitled'}),
    refreshEntitlement:async()=>({result:'no_evidence',errorCategory:'not_entitled'})};
  const integrity={prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic'})};
  return {isNativePlatform:()=>true,getPlatform:()=> 'android',
    isPluginAvailable:name=>['GridlyPlayBilling','GridlyPlayIntegrity','CapacitorHttp'].includes(name),
    Plugins:{GridlyPlayBilling:billing,GridlyPlayIntegrity:integrity},
    nativePromise:async()=>{throw Error('No purchase evidence should reach a verifier in this fixture');}};
}

test('Android physical orientation is independent of keyboard-sized viewport',()=>{
  assert.equal(physicalWalkthroughLandscape({screen:{orientation:{type:'portrait-primary'}},innerWidth:390,innerHeight:300}),false);
  assert.equal(physicalWalkthroughLandscape({screen:{orientation:{type:'landscape-primary'}},innerWidth:390,innerHeight:844}),true);
  assert.equal(physicalWalkthroughLandscape({screen:{},orientation:0,innerWidth:390,innerHeight:300}),false);
  assert.equal(physicalWalkthroughLandscape({screen:{},orientation:90,innerWidth:390,innerHeight:844}),true);
});

test('production Android composition reaches native product lookup and stays unentitled without purchase',async()=>{
  let productCalls=0;
  const capacitor=androidCapacitor(async()=>{productCalls++;return product;});
  const composition=await productionPaidComposition(capacitor);
  assert.equal(composition.plugin,capacitor.Plugins.GridlyPlayBilling);
  assert.ok(composition.authority);
  assert.ok(composition.publicKey);
  const access=createPaidAccess(composition);
  const seen=[];access.subscribe(value=>seen.push(value));
  const value=await access.start();
  assert.equal(productCalls,1);
  assert.equal(value.product?.productId,'com.gridlygo.gridly.monthly');
  assert.equal(value.product?.basePlanId,'monthly');
  assert.equal(value.product?.displayPrice,'$2.99');
  assert.equal(value.verificationReady,true);
  assert.equal(value.allowed,false);
  assert.equal(seen.some(row=>row.productLoading),true);
  assert.equal(value.productLoading,false);
  await access.stop();
});

test('unavailable Google offer settles the product state without granting access',async()=>{
  const composition=await productionPaidComposition(androidCapacitor(async()=>({...product,basePlanId:'wrong'})));
  const access=createPaidAccess(composition);
  const value=await access.start();
  assert.deepEqual(value.product,{available:false,errorCategory:'product_unavailable'});
  assert.equal(value.productLoading,false);
  assert.equal(value.allowed,false);
  await access.stop();
});

test('Android retry can requery a failed offer, but missing attestation stays closed',async()=>{
  let calls=0;
  const capacitor=androidCapacitor(async()=>++calls===1?{result:'error',errorCategory:'product_unavailable'}:product);
  const composition=await productionPaidComposition(capacitor);
  const access=createPaidAccess(composition);
  assert.equal((await access.start()).product?.available,false);
  const retried=await access.refresh();
  assert.equal(calls,2);
  assert.equal(retried.product?.available,true);
  assert.equal(retried.allowed,false);
  await access.stop();

  delete capacitor.nativePromise;
  const unverified=await productionPaidComposition(capacitor);
  assert.equal(unverified.authority,null);
  const closed=createPaidAccess(unverified);
  const value=await closed.start();
  assert.equal(value.product?.available,true);
  assert.equal(value.verificationReady,false);
  assert.equal(value.allowed,false);
  await closed.stop();
});

test('Android paid onboarding fits below legal control and keeps Home Area focus during keyboard resize',async()=>{
  const root=process.cwd();
  const server=createServer(async(req,res)=>{
    try{
      const pathname=new URL(req.url,'http://localhost').pathname;
      const full=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!full.startsWith(root+'\\'))throw Error('outside fixture');
      const bytes=await readFile(full);
      res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.json':'application/json'})[extname(full)]||'application/octet-stream');
      res.end(bytes);
    }catch{res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:740},isMobile:true});
    await page.addInitScript(()=>{
      Object.defineProperty(window.screen,'orientation',{configurable:true,value:{type:'portrait-primary',addEventListener(){},removeEventListener(){}}});
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',
        isPluginAvailable:name=>['GridlyPlayBilling','GridlyPlayIntegrity','CapacitorHttp'].includes(name),
        Plugins:{GridlyPlayBilling:{addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
          getProducts:async()=>({result:'available',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
          queryCurrentPurchases:async()=>({result:'no_evidence',errorCategory:'not_entitled'})},
          GridlyPlayIntegrity:{prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic'})}},
        nativePromise:async()=>{throw Error('unexpected network');}};
    });
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.locator('#gridlyWelcomeOnboarding:not([hidden])').waitFor();
    assert.equal(await page.locator('[data-gridly-onboarding-page="report"]').count(),0);
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('gridly-android-paid-onboarding')),true);
    assert.equal(await page.locator('#gridlyPaidLegalAccess').isVisible(),true);
    for(const pageName of ['awareness','map','alerts','settings']){
      await page.locator('#gridlyV950NextBtn').click();
      const geometry=await page.evaluate(name=>{
        const legal=document.getElementById('gridlyPaidLegalAccess').getBoundingClientRect();
        const card=document.querySelector(`[data-gridly-onboarding-page="${name}"]`);
        const heading=card.querySelector('h3').getBoundingClientRect();
        const art=card.querySelector('.gridly-v896-shot-frame').getBoundingClientRect();
        const pager=document.querySelector('.gridly-v950-onboarding-pager').getBoundingClientRect();
        return {legalBottom:legal.bottom,headingTop:heading.top,headingBottom:heading.bottom,artBottom:art.bottom,pagerBottom:pager.bottom,viewport:innerHeight};
      },pageName);
      assert.ok(geometry.headingTop>=geometry.legalBottom,`${pageName} heading overlaps Help & legal: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.artBottom<=geometry.pagerBottom+1,`${pageName} artwork exceeds pager: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.pagerBottom<=geometry.viewport+1,`${pageName} pager exceeds viewport: ${JSON.stringify(geometry)}`);
    }
    await page.setViewportSize({width:320,height:568});
    for(const [index,pageName] of ['awareness','map','alerts','settings'].entries()){
      await page.locator(`[data-gridly-page-dot="${index+1}"]`).click();
      const geometry=await page.evaluate(name=>{
        const legal=document.getElementById('gridlyPaidLegalAccess').getBoundingClientRect();
        const card=document.querySelector(`[data-gridly-onboarding-page="${name}"]`);
        const heading=card.querySelector('h3').getBoundingClientRect();
        const art=card.querySelector('.gridly-v896-shot-frame').getBoundingClientRect();
        const pager=document.querySelector('.gridly-v950-onboarding-pager').getBoundingClientRect();
        return {legalBottom:legal.bottom,headingTop:heading.top,artBottom:art.bottom,pagerBottom:pager.bottom,viewport:innerHeight};
      },pageName);
      assert.ok(geometry.headingTop>=geometry.legalBottom,`${pageName} compact heading overlaps legal control: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.artBottom<=geometry.pagerBottom+1,`${pageName} compact artwork exceeds pager: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.pagerBottom<=geometry.viewport+1,`${pageName} compact pager exceeds viewport: ${JSON.stringify(geometry)}`);
    }
    await page.locator('#gridlyV950NextBtn').click();
    const input=page.locator('#gridlyV858LocationInput');
    await input.focus();
    assert.equal(await input.evaluate(element=>document.activeElement===element),true);
    await page.setViewportSize({width:390,height:300});
    await page.waitForTimeout(120);
    assert.equal(await page.evaluate(()=>matchMedia('(orientation: landscape)').matches),true);
    assert.equal(await page.locator('[data-gridly-walkthrough-orientation-gate]').isVisible(),false);
    assert.equal(await input.evaluate(element=>document.activeElement===element),true);
    assert.equal(await page.locator('#gridlyV858LocationInput').count(),1);
    assert.equal(await page.locator('#gridlyPaidPrice').textContent(),'$2.99/month');
    const failed=await browser.newPage({viewport:{width:390,height:740},isMobile:true});
    await failed.addInitScript(()=>{
      localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',
        isPluginAvailable:name=>['GridlyPlayBilling','GridlyPlayIntegrity','CapacitorHttp'].includes(name),
        Plugins:{GridlyPlayBilling:{addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
          getProducts:async()=>({result:'error',errorCategory:'product_unavailable'}),
          queryCurrentPurchases:async()=>({result:'no_evidence',errorCategory:'not_entitled'})},
          GridlyPlayIntegrity:{prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic'})}},
        nativePromise:async()=>{throw Error('unexpected network');}};
    });
    await failed.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await failed.locator('#gridlyPaidStatus').filter({hasText:'Subscription product is unavailable from Google Play'}).waitFor();
    assert.equal(await failed.locator('#gridlyPaidPrice').textContent(),'Price unavailable');
    assert.equal(await failed.locator('#gridlyPaidPurchase').isDisabled(),true);

    for(const authorityReady of [true,false]){
      const fresh=await browser.newPage({viewport:{width:390,height:740},isMobile:true});
      await fresh.addInitScript(ready=>{
        localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
        window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android',
          isPluginAvailable:name=>['GridlyPlayBilling','GridlyPlayIntegrity'].includes(name)||(ready&&name==='CapacitorHttp'),
          Plugins:{GridlyPlayBilling:{addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
            getProducts:async()=>({result:'available',productId:'com.gridlygo.gridly.monthly',basePlanId:'monthly',displayName:'Gridly Monthly',displayPrice:'$2.99',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false}),
            queryCurrentPurchases:async()=>({result:'no_evidence',errorCategory:'not_entitled'})},
            GridlyPlayIntegrity:{prepare:async()=>({prepared:true}),authorize:async()=>({type:'google_standard',token:'synthetic'})}},
          nativePromise:async()=>{throw Error('No purchase evidence should invoke verifier');}};
      },authorityReady);
      await fresh.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
      await fresh.locator('#gridlyPaidPrice').filter({hasText:'$2.99/month'}).waitFor();
      if(authorityReady){
        await fresh.locator('#gridlyPaidStatus').filter({hasText:'Subscribe or restore your store purchase'}).waitFor();
        assert.equal(await fresh.locator('#gridlyPaidPurchase').isDisabled(),false);
      }else{
        await fresh.locator('#gridlyPaidStatus').filter({hasText:'Verification is temporarily unavailable'}).waitFor();
        assert.equal(await fresh.locator('#gridlyPaidPurchase').isDisabled(),true);
      }
      await fresh.close();
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
