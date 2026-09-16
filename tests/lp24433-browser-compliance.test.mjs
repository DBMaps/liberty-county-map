import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BROWSER='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

test('browser requires affirmative acceptance before resolving a new UGC gate',async()=>{
  const browser=await chromium.launch({headless:true,executablePath:BROWSER});
  try{
    const page=await browser.newPage();
    await page.setContent('<main>Gridly compliance fixture</main>');
    await page.evaluate(()=>{
      const values=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{
        getItem:key=>values.has(key)?values.get(key):null,
        setItem:(key,value)=>values.set(key,String(value)),
        removeItem:key=>values.delete(key)
      }});
    });
    await page.addScriptTag({path:path.join(ROOT,'js/gridly-ugc-compliance.js')});
    await page.evaluate(()=>{ window.__gateResult='pending'; window.gridlyUgcCompliance.ensureAccepted().then(value=>window.__gateResult=value); });
    assert.equal(await page.locator('[data-gridly-ugc-consent-accept]').isDisabled(),true);
    assert.equal(await page.locator('[data-gridly-ugc-legal]').count(),3);
    await page.locator('[data-gridly-ugc-consent-cancel]').click();
    await page.waitForFunction(()=>window.__gateResult!=="pending");
    assert.equal(await page.evaluate(()=>window.__gateResult),false);
    assert.equal(await page.evaluate(()=>window.gridlyUgcCompliance.acceptance()),null);

    await page.evaluate(()=>{ window.__gateResult='pending'; window.gridlyUgcCompliance.ensureAccepted().then(value=>window.__gateResult=value); });
    await page.locator('[data-gridly-ugc-consent-check]').check();
    assert.equal(await page.locator('[data-gridly-ugc-consent-accept]').isEnabled(),true);
    await page.locator('[data-gridly-ugc-consent-accept]').click();
    await page.waitForFunction(()=>window.__gateResult===true);
    const accepted=await page.evaluate(()=>window.gridlyUgcCompliance.acceptance());
    assert.equal(accepted.version,'gridly-ugc-2026-09-16-v1');
    assert.ok(Number.isFinite(Date.parse(accepted.acceptedAt)));
  } finally { await browser.close(); }
});

test('browser report, hide and deletion controls call only their bounded bridges',async()=>{
  const browser=await chromium.launch({headless:true,executablePath:BROWSER});
  try{
    const page=await browser.newPage();
    await page.setContent('<main id="fixture"></main>');
    await page.evaluate(()=>{
      const values=new Map();
      Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}});
      window.__calls=[];
      window.gridlyUgcComplianceBridge={
        submitModeration:async value=>(window.__calls.push(['report',value]),{status:'accepted'}),
        requestDeletion:async value=>(window.__calls.push(['delete',value]),{status:'accepted'}),
        onHide:id=>window.__calls.push(['hide',id]),notify:()=>{}
      };
    });
    await page.addScriptTag({path:path.join(ROOT,'js/gridly-ugc-compliance.js')});
    const id='123e4567-e89b-42d3-a456-426614174000';
    await page.evaluate(id=>document.querySelector('#fixture').innerHTML=window.gridlyUgcCompliance.controlsHtml(id),id);
    await page.locator('[data-gridly-ugc-action="report"]').click();
    await page.locator('[data-gridly-ugc-reason]').selectOption('spam');
    await page.locator('[data-gridly-ugc-submit-report]').click();
    await page.locator('[data-gridly-ugc-action="delete"]').click();
    await page.locator('[data-gridly-ugc-action="hide"]').click();
    await page.waitForFunction(()=>window.__calls.length===3);
    const calls=await page.evaluate(()=>window.__calls);
    assert.deepEqual(calls.map(row=>row[0]),['report','delete','hide']);
    assert.equal(calls[0][1].reason,'spam');
    assert.equal(calls[0][1].reportId,id);
    assert.equal(calls[1][1].reportId,id);
    assert.equal(await page.evaluate(id=>window.gridlyUgcCompliance.isHidden(id),id),true);
  } finally { await browser.close(); }
});
