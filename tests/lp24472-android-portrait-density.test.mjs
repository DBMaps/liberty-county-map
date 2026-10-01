import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {chromium} from 'playwright';

const css=readFileSync('css/styles.css','utf8');
const app=readFileSync('js/app.js','utf8');
const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const launchOptions=existsSync(edge)?{executablePath:edge}:existsSync(chromium.executablePath())?{}:null;

const fixture=`<!doctype html><html><body data-layout-mode="portrait">
  <div id="gridlyPortraitV2">
    <div class="gridly-v2-topbar">Gridly</div>
    <div class="gridly-v2-brief-stack">
      <div class="gridly-v2-awareness-brief-card" data-awareness-state="moderate"><strong>Community Pulse</strong><span>Local conditions today</span><small class="gridly-v2-awareness-trust-line">Current</small></div>
      <button class="gridly-brief-foundation-handle">Know Before You Go</button>
      <div class="gridly-v2-segments">${['Nearby','Area','County','Delays','All'].map(x=>`<button>${x}</button>`).join('')}</div>
    </div>
    <div class="gridly-v2-location-awareness-panel">Location Context</div>
    <div id="gridlyPortraitBottomRegion" class="gridly-v2-bottom-region"><nav class="gridly-v2-bottom-dock">${['Report','Alerts','History','Settings'].map(x=>`<button><span class="dock-icon">●</span><em>${x}</em></button>`).join('')}</nav></div>
    <div id="gridlyPortraitV2Sheet" data-active-sheet="settings">
      <header><h2>Settings</h2><button id="gridlyPortraitV2SheetClose">×</button></header>
      <div id="gridlyPortraitV2SheetBody"><div class="gridly-settings-sheet">
        <details class="settings-list-section" open><summary class="settings-list-summary">Community</summary><div class="settings-list-detail">
          <div class="settings-awareness-manual-picker"><h2>Find an area</h2><label>Search<input type="search" placeholder="Austin"></label>
            <div class="settings-manual-results"><span class="settings-manual-results-label">Results</span><div class="settings-manual-county-list">
              ${['Austin','Austin County','Austin area'].map(x=>`<button class="settings-manual-area-result"><span>${x}</span><small>Texas</small></button>`).join('')}
            </div></div></div>
        </div></details>
      </div></div>
    </div>
  </div></body></html>`;

async function metrics(page){
  return page.evaluate(()=>{
    const get=s=>document.querySelector(s);
    const style=s=>getComputedStyle(get(s));
    const rect=s=>get(s).getBoundingClientRect();
    return {
      cardMin:parseFloat(style('.gridly-v2-awareness-brief-card').minHeight),
      cardHeight:rect('.gridly-v2-awareness-brief-card').height,
      filterTop:style('#gridlyPortraitV2').getPropertyValue('--gridly-v2-filter-strip-top').trim(),
      shieldHeight:style('#gridlyPortraitV2').getPropertyValue('--gridly-v2-top-shield-height').trim(),
      filterButton:parseFloat(style('.gridly-v2-segments button').minHeight),
      dockIcon:parseFloat(style('.gridly-v2-bottom-dock .dock-icon').height),
      dockButton:parseFloat(style('.gridly-v2-bottom-dock button').minHeight),
      dockHeight:rect('.gridly-v2-bottom-dock').height,
      bottomRegionHeight:rect('#gridlyPortraitBottomRegion').height,
      settingsSummary:parseFloat(style('.settings-list-summary').minHeight),
      searchInput:parseFloat(style('.settings-awareness-manual-picker input').minHeight),
      resultRow:parseFloat(style('.settings-manual-area-result').minHeight),
      resultRowHeight:rect('.settings-manual-area-result').height,
      resultListMax:parseFloat(style('.settings-manual-county-list').maxHeight),
      sheetRect:rect('#gridlyPortraitV2Sheet').toJSON(),
      closeRect:rect('#gridlyPortraitV2SheetClose').toJSON(),
      inputRect:rect('.settings-awareness-manual-picker input').toJSON(),
      settingsColumns:style('.gridly-settings-sheet').gridTemplateColumns
    };
  });
}

test('native Android marker is guarded and layout mode stays portrait during viewport resize',()=>{
  assert.match(app,/isNativePlatform\?\.\(\) === true && window\.Capacitor\?\.getPlatform\?\.\(\) === "android"/);
  assert.match(app,/document\.documentElement\.dataset\.gridlyNativePlatform = "android"/);
  assert.match(app,/nextMode: "portrait"/);
  assert.match(app,/const GRIDLY_REPORT_DIAGNOSTICS = false/);
});

test('Android-only portrait density and keyboard geometry preserve Apple values', {skip:!launchOptions&&'No local Chromium or Edge browser'}, async()=>{
  const browser=await chromium.launch({headless:true,...launchOptions});
  try{
    const page=await browser.newPage({viewport:{width:393,height:850}});
    await page.setContent(fixture);
    await page.addStyleTag({content:css});
    const apple=await metrics(page);
    await page.evaluate(()=>document.documentElement.dataset.gridlyNativePlatform='android');
    const android=await metrics(page);
    assert.equal(android.cardMin,84);
    assert.ok(android.cardMin<apple.cardMin);
    assert.equal(android.dockIcon,30);
    assert.ok(android.dockHeight<apple.dockHeight);
    assert.ok(android.bottomRegionHeight<apple.bottomRegionHeight);
    assert.ok(android.dockButton>=44);
    assert.ok(android.filterButton>=44);
    assert.equal(android.settingsSummary,50);
    assert.ok(android.settingsSummary<apple.settingsSummary);
    assert.equal(android.searchInput,44);
    assert.ok(android.searchInput<apple.searchInput);
    assert.equal(android.resultRow,44);
    assert.ok(android.resultRowHeight<apple.resultRowHeight);
    assert.ok(android.filterTop.includes('130px'));
    assert.match(css,/--gridly-v2-filter-strip-top: calc\(var\(--gridly-v2-header-top\) \+ 130px \+ var\(--gridly-brief-interaction-extra, 0px\)\)/);
    await page.locator('#gridlyPortraitV2').evaluate(el=>el.dataset.gridlyBriefState='expanded');
    const expanded=await metrics(page);
    assert.notEqual(expanded.filterTop,android.filterTop);
    assert.notEqual(expanded.shieldHeight,android.shieldHeight);
    await page.locator('#gridlyPortraitV2').evaluate(el=>delete el.dataset.gridlyBriefState);

    await page.setViewportSize({width:393,height:330});
    await page.evaluate(()=>document.documentElement.style.setProperty('--gridly-visual-vh','330px'));
    await page.locator('.settings-awareness-manual-picker input').focus();
    const keyboard=await metrics(page);
    assert.ok(keyboard.sheetRect.height<=314.5);
    assert.ok(keyboard.closeRect.bottom<=330);
    assert.ok(keyboard.inputRect.top>=0&&keyboard.inputRect.top<330);
    assert.ok(keyboard.resultListMax>=88);
    assert.ok(keyboard.sheetRect.width<=393);
    assert.equal(keyboard.settingsColumns.split(' ').length,1);
    assert.equal(await page.locator('.settings-awareness-manual-picker input').evaluate(el=>document.activeElement===el),true);

    await page.locator('.settings-awareness-manual-picker input').evaluate(el=>el.blur());
    await page.setViewportSize({width:393,height:850});
    await page.evaluate(()=>document.documentElement.style.setProperty('--gridly-visual-vh','850px'));
    const restored=await metrics(page);
    assert.ok(restored.sheetRect.height>keyboard.sheetRect.height);
    await page.evaluate(()=>delete document.documentElement.dataset.gridlyNativePlatform);
    const appleAfter=await metrics(page);
    for(const key of ['cardMin','dockIcon','settingsSummary','searchInput','resultRow','filterTop'])assert.equal(appleAfter[key],apple[key]);
    await page.close();
  }finally{await browser.close();}
});
