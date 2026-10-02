import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import vm from 'node:vm';
import {chromium} from '@playwright/test';

const source=await readFile('js/app.js','utf8');
const index=await readFile('index.html','utf8');
const builder=source.slice(source.indexOf('  function buildSettingsSurfaceHtml() {'),source.indexOf('  function buildReportHazardSurfaceHtml() {'));
function settingsHtml(platform) {
  const context={window:{Capacitor:{isNativePlatform:()=>true,getPlatform:()=>platform}},
    getGridlySettingsPerfNow:()=>0,gridlySettingsPerformanceTrace:{},
    normalizeGridlySettings:()=>({notifications:{},display:{}}),
    escapeV2SettingsText:String,buildGridlySettingsDisplayChoiceHtml:()=>'',buildGridlySettingsTextSizeSegmentsHtml:()=>'',
    buildGridlyPwaInstallCardHtml:()=>'',buildGridlyAboutGuidanceHtml:()=>'',buildGridlyFeedbackFlowHtml:()=>'',
    GRIDLY_APP_VERSION_LABEL:'Gridly',GRIDLY_APP_BUILD_LABEL:'Build'};
  return vm.runInNewContext(builder+'\nbuildSettingsSurfaceHtml()',context);
}

for(const [platform,width,height] of [['ios',390,844],['android',412,915]]) {
  test(`${platform} portrait Support placement and existing restore handler`,async()=>{
    const html=settingsHtml(platform);
    const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/styles.css">
      <body data-layout-mode="portrait"><section id="gridlyPaidAccess"><nav></nav><p id="gridlyPaidStatus"></p><div id="gridlyPaidOffer"></div><span id="gridlyPaidPrice"></span><span id="gridlyPaidBilling"></span><button id="gridlyPaidPurchase"></button><button id="gridlyPaidRestore">Restore Purchases</button><button id="gridlyPaidRetry"></button></section>
      <div id="gridlyPortraitV2"><div id="gridlyPortraitV2Sheet" data-active-sheet="settings"><h2>Settings</h2><p>Manage your Home Area, saved places and preferences.</p><div id="gridlyPortraitV2SheetBody">${html}</div></div></div>
      <script>window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> '${platform}'};</script><script type="module">import {bootPaidAccess} from '/js/gridly-paid-ui.mjs';await bootPaidAccess();</script>`;
    const server=createServer(async(req,res)=>{
      if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}
      const path=req.url==='/css/styles.css'?'css/styles.css':req.url==='/js/gridly-paid-ui.mjs'?'js/gridly-paid-ui.mjs':null;
      if(path){res.setHeader('Content-Type',path.endsWith('.css')?'text/css':'text/javascript');res.end(await readFile(path));return;}
      res.statusCode=404;res.end();
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    let browser;
    try {
      browser=await chromium.launch({channel:'msedge',headless:true});
      const page=await browser.newPage({viewport:{width,height},isMobile:true,deviceScaleFactor:1});
      const store=platform==='ios'?'apple':'google';
      await page.route('**/js/gridly-paid-access.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
        const value={state:'entitled',platform:'${store}',product:{available:true,displayPrice:'$2.99'},errorCategory:'none',verificationReady:true,allowed:true};
        export const nativeStore=()=> '${store}';export const createPaidAccess=()=>({read:()=>value,allowed:()=>true,subscribe:fn=>{fn(value);return()=>{};},initializeRuntime:async work=>work(()=>true),start:async()=>{},restore:async()=>{window.restoreCalls=(window.restoreCalls||0)+1;},refresh:async()=>{},purchase:async()=>{throw Error('unexpected purchase');},stop:async()=>{}});`}));
      for(const [module,body] of Object.entries({'gridly-paid-onboarding.mjs':'export const onboardingComplete=()=>true;export const createPaidOnboarding=async()=>({dispose(){}});','gridly-paid-config.mjs':'export const productionPaidComposition=async()=>({});','gridly-paid-startup.mjs':'export const loadPaidRuntime=async()=>{};'}))await page.route('**/js/'+module,route=>route.fulfill({contentType:'text/javascript',body}));
      await page.goto('http://127.0.0.1:'+server.address().port+'/');
      await page.waitForFunction(()=>!document.documentElement.classList.contains('gridly-paid-locked'));
      assert.equal(await page.locator('.gridly-settings-sheet > [data-gridly-settings-restore]').count(),0);
      assert.deepEqual(await page.locator('.gridly-settings-sheet > details > summary .settings-list-title').allTextContents(),['Awareness','Travel','Notifications','Appearance','Support']);
      const support=page.locator('.settings-section-support');
      const restore=support.locator('[data-gridly-settings-restore]');
      assert.equal(await restore.count(),1);
      assert.equal(await restore.isVisible(),false);
      await support.locator('summary').click();
      await restore.click();
      assert.equal(await page.evaluate(()=>window.restoreCalls),1);
      const box=await restore.boundingBox();
      assert.ok(box.width>0&&box.x>=0&&box.x+box.width<=width,JSON.stringify(box));
      assert.ok(box.height>=44);
      assert.equal(await page.locator('#gridlyPaidRestore').count(),1);
      await page.locator('#gridlyPaidRestore').dispatchEvent('click');
      assert.equal(await page.evaluate(()=>window.restoreCalls),2);
    } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
  });
}

test('legacy Settings restore is nested in Support and paywall restore remains',()=>{
  const legacy=index.slice(index.indexOf('id="settingsModal"'),index.indexOf('id="settingsAboutSection"'));
  assert.doesNotMatch(legacy,/data-gridly-settings-restore/);
  assert.match(index,/id="settingsAboutSection"[\s\S]*?id="gridlySettingsRestore"/);
  assert.match(index,/<button id="gridlyPaidRestore"[^>]*>Restore Purchases<\/button>/);
});
