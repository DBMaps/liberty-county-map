import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from '@playwright/test';

// Installed Edge only; no browser/dependency installation and no live providers.
test('real browser: unsupported/native-unconfigured gate, portrait/legal access, admitted legacy ordering',async()=>{
  const requests=[];
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
    if(path==='/_loader.html') {
      res.setHeader('Content-Type','text/html');res.end(`<script>window.order=[];document.addEventListener('DOMContentLoaded',()=>window.oldEventCount=(window.oldEventCount||0)+1)</script>
      <script type="application/gridly-protected" data-gridly-source="/_one.js"></script>
      <script type="application/gridly-protected">window.order.push('inline');document.addEventListener('DOMContentLoaded',()=>window.order.push('inline-ready'));</script>
      <script type="application/gridly-protected" data-gridly-source="/_two.js"></script>`);return;
    }
    if(path==='/_one.js'||path==='/_two.js') {
      res.setHeader('Content-Type','text/javascript');res.end(path==='/_one.js'?`window.order.push('one');document.addEventListener('DOMContentLoaded',()=>window.order.push('one-ready'));const canceled=()=>window.order.push('removed');document.addEventListener('DOMContentLoaded',canceled);document.removeEventListener('DOMContentLoaded',canceled);`
        :`window.order.push('two');window.addEventListener('DOMContentLoaded',()=>window.order.push('two-ready'));`);return;
    }
    try {
      const full=resolve(process.cwd(),'.'+(path==='/'?'/index.html':path));
      if(!full.startsWith(resolve(process.cwd())+'\\')) throw Error();
      const bytes=await readFile(full);
      res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.css':'text/css','.png':'image/png','.json':'application/json'})[extname(full)]||'application/octet-stream');
      res.end(bytes);
    } catch {res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
    await page.goto(origin+'/?entitled=true&debug=true');
    await page.locator('#gridlyPaidStatus').filter({hasText:'supported Apple'}).waitFor();
    assert.equal(await page.locator('#gridlyPaidAccess').isVisible(),true);
    assert.equal(await page.locator('#gridlyPaidPurchase').isVisible(),false);
    assert.equal(await page.locator('#gridlyPaidAccess a').count(),5);
    assert.equal(await page.evaluate(()=>typeof window.L),'undefined');
    assert.ok(!requests.some(path=>path==='/js/app.js'||path.includes('gridlyPackageRegistry')));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:process.env.GRIDLY_LP24465_SCREENSHOT||undefined});
    await page.locator('#gridlyPaidAccess a').filter({hasText:'Privacy Policy'}).click();
    await page.waitForURL('**/legal/privacy.html');assert.equal(await page.locator('body').isVisible(),true);
    // These two external route responses are navigation fixtures, not a live-publication claim.
    await page.route('https://gridlygo.com/support',route=>route.fulfill({contentType:'text/html',body:'<h1>Support route fixture</h1>'}));
    await page.route('https://gridlygo.com/delete-data',route=>route.fulfill({contentType:'text/html',body:'<h1>Delete Data route fixture</h1>'}));
    for(const label of ['Privacy Policy','Terms','Community Guidelines','Support','Delete Data']) {
      await page.goto(origin+'/');await page.locator('#gridlyPaidAccess').waitFor();
      assert.equal(await page.evaluate(()=>typeof window.L),'undefined');
      await page.locator('#gridlyPaidAccess a').filter({hasText:label}).click();
      await page.waitForURL(label==='Support'?'https://gridlygo.com/support':label==='Delete Data'?'https://gridlygo.com/delete-data':'**/legal/*.html');
      assert.equal(await page.locator('body').isVisible(),true);
      assert.ok(!requests.some(path=>path==='/js/app.js'||path.includes('gridlyPackageRegistry')));
    }
    await page.addInitScript(()=>{
      localStorage.setItem('gridlyEntitled','true');
      localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios',Plugins:{GridlyStoreKit:{
        addListener:async()=>({remove:async()=>{}}),startObserving:async()=>{},stopObserving:async()=>{},
        getProducts:async()=>({result:'available',productId:'com.gridlygo.gridly.monthly',displayPrice:'$3.49',displayName:'Gridly Monthly',currency:'USD',billingPeriod:'P1M',storefront:'US',hasOffer:false})}}};
    });
    await page.goto(origin+'/?entitled=true');
    await page.locator('#gridlyPaidStatus').filter({hasText:'temporarily unavailable'}).waitFor();
    assert.equal(await page.locator('#gridlyPaidPrice').textContent(),'$3.49/month');
    await page.setViewportSize({width:320,height:568});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#gridlyPaidAccess a').filter({hasText:'Delete Data'}).scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#gridlyPaidAccess a').filter({hasText:'Delete Data'}).isVisible(),true);
    await page.locator('#gridlyPaidRestore').click();
    await page.locator('#gridlyPaidStatus').filter({hasText:'temporarily unavailable'}).waitFor();
    assert.equal(await page.locator('#gridlyPaidAccess').isVisible(),true);
    assert.equal(await page.evaluate(()=>typeof window.L),'undefined');
    // Fixtures exercise the generic admitted loader only, not a release unlock.
    await page.goto(origin+'/_loader.html');
    const result=await page.evaluate(async()=>{
      const {loadPaidRuntime}=await import('/js/gridly-paid-startup.mjs');
      await loadPaidRuntime({document,window,allowed:()=>true});
      return {order:window.order,oldEventCount:window.oldEventCount};
    });
    assert.deepEqual(result,{order:['one','inline','two','one-ready','inline-ready','two-ready'],oldEventCount:1});
    await page.goto(origin+'/_loader.html');
    const denied=await page.evaluate(async()=>{
      const {loadPaidRuntime}=await import('/js/gridly-paid-startup.mjs');
      try {await loadPaidRuntime({document,window,allowed:()=>false});}catch {return window.order;}
    });assert.deepEqual(denied,[]);
    await page.goto(origin+'/_loader.html');
    const revoked=await page.evaluate(async()=>{
      const {loadPaidRuntime}=await import('/js/gridly-paid-startup.mjs');
      try {await loadPaidRuntime({document,window,allowed:()=>window.order.length===0});}catch {return window.order;}
    });assert.deepEqual(revoked,['one']);
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
