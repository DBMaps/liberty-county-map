import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from '@playwright/test';
import {paidStartupFixtureModule} from './helpers/paid-startup-fixture.mjs';

test('Android branded admission and explicit subscription; Apple admission remains unchanged',async t=>{
  const root=process.cwd(),requests=[];
  const server=createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname;requests.push(path);
    try {
      if(path==='/js/gridly-paid-config.mjs'){
        res.setHeader('Content-Type','text/javascript');res.end(paidStartupFixtureModule());return;
      }
      const file=resolve(root,'.'+(path==='/'?'/index.html':path));
      if(!file.startsWith(root+sep))throw Error();
      let bytes=await readFile(file);
      if(path==='/') {
        // Keep production admission markup. Replace the expensive protected
        // stack with a sentinel, still executed by the real proof-gated loader.
        bytes=bytes.toString().replace(/<script\s+type="application\/gridly-protected"[\s\S]*?<\/script>/g,'')
          .replace('</body>','<script type="application/gridly-protected">window.__protectedStarted=true;</script></body>');
      }
      res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(bytes);
    }catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  async function launch(options={},platform='android') {
    const page=await browser.newPage({viewport:{width:360,height:780},isMobile:true});
    page.setDefaultTimeout(10000);
    await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
    await page.addInitScript(({options,platform})=>{
      localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
      localStorage.setItem('gridlyEntitled','true'); // Untrusted legacy flag must never admit.
      window.__paidStartupOptions=options;
      window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>platform};
      window.__subscriptionFlashes=0;
      new MutationObserver(()=>{const e=document.getElementById('gridlyPaidAccess');if(e&&!document.documentElement.classList.contains('gridly-prepaint-lock')&&!e.hidden&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden')window.__subscriptionFlashes++;})
        .observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden']});
    },{options,platform});
    await page.goto(origin+'/?entitled=true',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__paidStartupFixture);
    return page;
  }
  const entry=p=>p.locator('#gridlyPaidPending');
  const waitSettled=p=>p.locator('#gridlyPaidEntryActions:not([hidden])').waitFor();
  async function locked(p) {
    assert.equal(await entry(p).isVisible(),true);
    assert.equal(await p.locator('#gridlyPaidAccess').isVisible(),false);
    assert.equal(await p.evaluate(()=>!!window.__protectedStarted),false);
    assert.equal(await p.evaluate(()=>typeof window.L),'undefined');
    assert.equal(await p.evaluate(()=>document.documentElement.classList.contains('gridly-paid-locked')),true);
    await assert.rejects(p.evaluate(()=>window.gridlyPaidReporting.getProof()));
  }
  try {
    await t.test('checking, unpaid and explicit subscription timing; no cold-open flash',async()=>{
      const p=await launch({hold:true});
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('query'));
      assert.equal(await entry(p).isVisible(),true);
      assert.equal(await p.locator('#gridlyPaidEntryStatus').textContent(),'Checking your subscription…');
      assert.equal(await p.locator('#gridlyPaidEntryActions').isVisible(),false);
      assert.equal(await p.evaluate(()=>!!window.__protectedStarted),false);
      await p.evaluate(()=>window.__paidStartupFixture.release());await waitSettled(p);await locked(p);
      assert.match(await p.locator('#gridlyPaidEntryStatus').textContent(),/Subscribe or restore/);
      assert.equal(await p.evaluate(()=>window.__subscriptionFlashes),0);
      await p.locator('#gridlyPaidEntrySubscribe').click();
      assert.equal(await p.locator('#gridlyPaidAccess').isVisible(),true);
      assert.equal(await p.locator('#gridlyPaidPrice').textContent(),'$2.99/month');
      assert.equal(await p.locator('#gridlyPaidPurchase').isEnabled(),true);
      assert.equal(await p.locator('#gridlyPaidRestore').textContent(),'Check Purchase / Restore');
      assert.equal(await p.evaluate(()=>!!window.__protectedStarted),false);
      await p.locator('#gridlyPaidEntryBack').click();assert.equal(await entry(p).isVisible(),true);
      assert.equal(await p.evaluate(()=>document.activeElement.id),'gridlyPaidEntrySubscribe');
      await p.setViewportSize({width:320,height:568});
      await p.locator('#gridlyPaidEntryRetry').scrollIntoViewIfNeeded();assert.equal(await p.locator('#gridlyPaidEntryRetry').isVisible(),true);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await p.close();
    });
    await t.test('signed entitlement admits silently and retains current proof on temporary resume failure',async()=>{
      const p=await launch({mode:'paid',hold:true});
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('query'));
      assert.equal(await p.evaluate(()=>!!window.__protectedStarted),false);
      await p.evaluate(()=>window.__paidStartupFixture.release());
      await p.waitForFunction(()=>window.__protectedStarted&&!document.documentElement.classList.contains('gridly-paid-locked'));
      assert.equal(await p.evaluate(()=>window.__subscriptionFlashes),0);
      assert.equal((await p.evaluate(()=>window.gridlyPaidReporting.getProof())).split('.').length,3);
      await p.evaluate(()=>{window.__paidStartupFixture.mode='verification-failure';window.__paidStartupFixture.handlers.appForeground();});
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('refresh'));
      await p.waitForTimeout(50);
      assert.equal(await p.locator('#gridlyPaidAccess').isVisible(),false);
      assert.equal(await p.evaluate(()=>document.documentElement.classList.contains('gridly-paid-locked')),false);
      await p.reload();await p.waitForFunction(()=>window.__paidStartupFixture?.events.includes('query'));
      await p.evaluate(()=>window.__paidStartupFixture.release());await p.waitForFunction(()=>window.__protectedStarted);
      assert.equal(await p.evaluate(()=>window.__paidStartupFixture.events.filter(x=>x==='authority').length),1);
      assert.equal(await p.evaluate(()=>window.__subscriptionFlashes),0);await p.close();
    });
    for(const options of [{mode:'verification-failure'},{mode:'store-failure'},{mode:'invalid-proof'},{mode:'expired'},{product:'unavailable'}]) {
      await t.test('failure remains branded and locked: '+JSON.stringify(options),async()=>{
        const p=await launch(options);await waitSettled(p);await locked(p);
        assert.equal(await p.evaluate(()=>window.__subscriptionFlashes),0);
        if(options.mode!=='expired'&&!options.product)assert.doesNotMatch(await p.locator('#gridlyPaidEntryStatus').textContent(),/^Subscribe or restore/);
        await p.locator('#gridlyPaidEntrySubscribe').click();
        if(options.product) {
          assert.equal(await p.locator('#gridlyPaidPrice').textContent(),'Price unavailable');
          assert.equal(await p.locator('#gridlyPaidPurchase').isDisabled(),true);
        }
        assert.equal(await p.locator('#gridlyPaidRestore').isEnabled(),true);
        assert.equal(await p.locator('#gridlyPaidRetry').isEnabled(),true);await p.close();
      });
    }
    await t.test('product unavailable does not revoke independently verified existing entitlement',async()=>{
      const p=await launch({mode:'paid',product:'unavailable'});
      await p.waitForFunction(()=>window.__protectedStarted);
      assert.equal(await p.evaluate(()=>window.__subscriptionFlashes),0);await p.close();
    });
    await t.test('fixture ITEM_UNAVAILABLE cannot grant access; restore/retry/resume/restart stay provider-backed',async()=>{
      const p=await launch();await waitSettled(p);
      await p.locator('#gridlyPaidEntrySubscribe').click();
      await p.locator('#gridlyPaidPurchase').click(); // Offline plugin only, never a live checkout.
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('purchase')&&!document.getElementById('gridlyPaidRestore').disabled);
      assert.equal(await p.evaluate(()=>!!window.__protectedStarted),false);
      assert.equal(await p.locator('#gridlyPaidPrice').textContent(),'$2.99/month');
      await p.locator('#gridlyPaidEntryBack').click();
      await p.locator('#gridlyPaidEntryRestore').click();
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('restore')&&!document.getElementById('gridlyPaidEntryRestore').disabled);
      await p.locator('#gridlyPaidEntryRetry').click();
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('refresh')&&!document.getElementById('gridlyPaidEntryRetry').disabled);
      await p.evaluate(()=>window.__paidStartupFixture.handlers.appForeground());
      await p.waitForFunction(()=>window.__paidStartupFixture.events.filter(x=>x==='refresh').length>=2);
      await p.reload();await waitSettled(p);await locked(p);
      assert.equal(await p.evaluate(()=>window.__subscriptionFlashes),0);
      await p.evaluate(()=>{window.__paidStartupFixture.mode='paid';});
      await p.locator('#gridlyPaidEntryRestore').click();await p.waitForFunction(()=>window.__protectedStarted);
      assert.ok(await p.evaluate(()=>window.__paidStartupFixture.events.includes('authority')));await p.close();
    });
    await t.test('Apple still checks branded, opens gate when unpaid, admits signed paid after finish',async()=>{
      const p=await launch({hold:true},'ios');
      await p.waitForFunction(()=>window.__paidStartupFixture.events.includes('current'));
      assert.equal(await entry(p).isVisible(),true);assert.equal(await p.locator('#gridlyPaidAccess').isVisible(),false);
      assert.equal(await p.locator('#gridlyPaidEntryActions').count(),0);
      await p.evaluate(()=>window.__paidStartupFixture.release());await p.locator('#gridlyPaidAccess').waitFor();
      assert.equal(await p.locator('#gridlyPaidRestore').textContent(),'Restore Purchases');
      assert.equal(await p.evaluate(()=>!!window.__protectedStarted),false);await p.close();
      const paid=await launch({mode:'paid'},'ios');await paid.waitForFunction(()=>window.__protectedStarted);
      assert.equal(await paid.evaluate(()=>window.__subscriptionFlashes),0);
      assert.equal(await paid.evaluate(()=>window.__paidStartupFixture.events.at(-1)),'finish');await paid.close();
      const failure=await launch({mode:'verification-failure'},'ios');
      await failure.locator('#gridlyPaidStatus').filter({hasText:'temporarily unavailable'}).waitFor();
      assert.equal(await failure.locator('#gridlyPaidAccess').isVisible(),true);
      assert.equal(await failure.locator('#gridlyPaidEntryActions').count(),0);await failure.close();
    });
    assert.ok(!requests.some(p=>p==='/js/app.js'||p.includes('gridlyPackageRegistry')));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
});
