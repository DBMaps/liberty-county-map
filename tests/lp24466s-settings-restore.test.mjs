import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';

test('admitted iOS legacy and portrait Settings Restore use the existing coordinator',async()=>{
  const fixture=`<!doctype html><html><body>
    <section id="gridlyPaidAccess"><nav><a href="#">Help</a></nav><p id="gridlyPaidStatus"></p>
      <div id="gridlyPaidOffer"></div><span id="gridlyPaidPrice"></span><span id="gridlyPaidBilling"></span>
      <button id="gridlyPaidPurchase"></button><button id="gridlyPaidRestore"></button><button id="gridlyPaidRetry"></button>
    </section><button id="gridlySettingsRestore" data-gridly-settings-restore hidden>Restore Purchases</button>
    <script>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'ios'};</script>
    <script type="module">import {bootPaidAccess} from '/js/gridly-paid-ui.mjs';await bootPaidAccess();</script>
  </body></html>`;
  const server=createServer(async(req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
    if(req.url==='/js/gridly-paid-ui.mjs'){
      res.setHeader('Content-Type','text/javascript');res.end(await readFile(resolve('js/gridly-paid-ui.mjs')));return;
    }
    res.statusCode=404;res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/js/gridly-paid-access.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
      export const nativeStore=()=> 'apple';
      export const createPaidAccess=()=>({
        read:()=>({state:'entitled',action:null,platform:'apple',product:{available:true,displayPrice:'$2.99'},errorCategory:'none',verificationReady:true,allowed:true,temporaryAccess:false}),
        allowed:()=>true,subscribe:fn=>{fn({state:'entitled',action:null,platform:'apple',product:{available:true,displayPrice:'$2.99'},errorCategory:'none',verificationReady:true,allowed:true,temporaryAccess:false});return()=>{};},
        initializeRuntime:async work=>work(()=>true),start:async()=>{},restore:async()=>{window.restoreCalls=(window.restoreCalls||0)+1;},
        refresh:async()=>{},purchase:async()=>{throw Error('purchase_not_allowed');},stop:async()=>{}
      });` }));
    await page.route('**/js/gridly-paid-onboarding.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export const onboardingComplete=()=>true;export const createPaidOnboarding=async()=>({dispose(){}});`}));
    await page.route('**/js/gridly-paid-config.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export const productionPaidComposition=async()=>({});`}));
    await page.route('**/js/gridly-paid-startup.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export const loadPaidRuntime=async()=>{};`}));
    await page.goto('http://127.0.0.1:'+server.address().port+'/');
    await page.locator('#gridlySettingsRestore').waitFor({state:'visible'});
    assert.equal(await page.locator('#gridlyPaidAccess').isVisible(),false);
    await page.locator('#gridlySettingsRestore').click();
    assert.equal(await page.evaluate(()=>window.restoreCalls),1);
    await page.evaluate(()=>{
      const sheet=document.createElement('div');sheet.id='gridlyPortraitV2SheetBody';
      sheet.innerHTML='<button type="button" data-gridly-settings-restore>Restore Purchases</button>';
      document.body.append(sheet);
    });
    await page.locator('#gridlyPortraitV2SheetBody [data-gridly-settings-restore]').click();
    assert.equal(await page.evaluate(()=>window.restoreCalls),2);
    const source=await readFile(resolve('js/app.js'),'utf8');
    assert.match(source,/function buildSettingsSurfaceHtml\([\s\S]*?data-gridly-settings-restore/);
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();
    await new Promise(resolve=>server.close(resolve));
  }
});
