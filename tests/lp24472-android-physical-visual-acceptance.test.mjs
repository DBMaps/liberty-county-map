import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';

const css = readFileSync('css/styles.css', 'utf8');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const launchOptions = existsSync(edge) ? { executablePath: edge } : existsSync(chromium.executablePath()) ? {} : null;

const fixture = `<!doctype html><html data-gridly-effective-theme="light" style="--gridly-app-font-scale:1.15;--gridly-visual-vh:693px;--gridly-v2-sheet-dock-clearance:134px"><body class="gridly-theme-system gridly-text-large" data-layout-mode="portrait" style="--gridly-elevated:#fbfdff;--gridly-text-primary:#0d1b2a;--gridly-accent-soft:#dceef2">
  <div class="gridly-welcome-overlay"><div class="gridly-v858-first-run-sheet"><div class="gridly-v858-first-run-card"><div data-gridly-visual-quick-tour><div class="gridly-v950-onboarding-pager"><div class="gridly-v950-welcome-page"><div class="gridly-v950-welcome-logo">Logo</div><h2>Welcome to Gridly</h2></div><div class="gridly-v950-page-indicators"></div><div class="gridly-v950-page-actions"><button>Skip</button><button>Next</button></div></div></div></div></div></div>
  <div id="gridlyPortraitV2"><div id="gridlyPortraitBottomRegion"><nav class="gridly-v2-bottom-dock">Report Alerts History Settings</nav></div>
  <section id="gridlyPortraitV2Sheet" class="gridly-v2-sheet" data-active-sheet="settings" style="--gridly-v2-sheet-dock-clearance:134px;position:fixed;left:12px;right:12px;bottom:134px;max-height:calc(100dvh - 146px);overflow:hidden"><header><h3>Settings</h3><button id="gridlyPortraitV2SheetClose">×</button></header>
  <div id="gridlyPortraitV2SheetBody" style="display:block;max-height:calc(100dvh - 204px);overflow-y:auto"><div class="gridly-v2-list gridly-settings-sheet"><p class="gridly-v2-sheet-copy">Manage your Home Area, saved places and preferences.</p><details class="settings-list-section settings-section-awareness" open><summary class="settings-list-summary">Awareness</summary><div class="settings-list-detail"><p class="settings-placeholder-note">Choose the local area Gridly should watch first.</p><div class="settings-place-grid">Home area</div><section class="settings-awareness-area-chooser"><div class="settings-awareness-manual-picker"><h2>Choose your home area</h2><div class="settings-manual-autocomplete"><label>Search your Texas community<input data-gridly-manual-awareness-search type="search"></label><div class="settings-manual-results"><span class="settings-manual-results-label">Search results</span><div class="settings-manual-county-list"><button class="settings-manual-area-result"><span>Austin, TX</span><small>City</small></button><button class="settings-manual-area-result"><span>Austin County</span><small>County</small></button></div></div></div></div></section><div class="settings-select-grid">Preferred Name</div></div></details><details class="settings-list-section settings-section-travel"><summary>Travel</summary><article class="settings-place-card"><span class="settings-place-label">Home</span><strong>Not saved</strong><button class="settings-place-action">Edit Home</button></article></details></div></div></section></div>
  <div id="gridlySearchShell" class="gridly-search-shell"><div class="gridly-search-card"><div class="gridly-search-header"><div class="gridly-search-label">Where are you going?</div></div><div class="gridly-search-results" data-search-publication="active"><button class="gridly-search-result-item"><span class="gridly-search-result-title">Dayton City Hall</span></button></div><div class="gridly-destination-confirmation"><strong class="gridly-destination-confirmation-title">Austin County Courthouse</strong><p class="gridly-destination-confirmation-context">Near Bellville</p></div></div></div>
  <dialog class="gridly-ugc-dialog" open><div class="gridly-ugc-panel"><h2>Privacy Policy</h2><iframe class="gridly-ugc-legal-frame"></iframe><div class="gridly-ugc-actions"><button>Done</button></div></div></dialog>
  </body></html>`;

test('physical Android portrait density uses the 320px viewport while Apple remains unchanged', { skip: !launchOptions && 'No local Chromium or Edge browser' }, async () => {
  const browser = await chromium.launch({ headless: true, ...launchOptions });
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 693 } });
    await page.setContent(fixture);
    await page.addStyleTag({ content: css });
    await page.addStyleTag({ content: '.gridly-ugc-dialog{max-height:88vh}.gridly-ugc-panel{padding:22px;max-height:84vh;overflow:auto}.gridly-ugc-legal-frame{height:min(68vh,720px)}' });
    await page.waitForTimeout(450);
    const before = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    await page.evaluate(() => document.documentElement.dataset.gridlyNativePlatform = 'android');
    const android = await page.evaluate(() => ({
      font: getComputedStyle(document.documentElement).fontSize,
      cardPadding: getComputedStyle(document.querySelector('.gridly-v858-first-run-card')).paddingBottom,
      pagerPadding: getComputedStyle(document.querySelector('.gridly-v950-onboarding-pager')).paddingBottom,
      sheetMax: parseFloat(getComputedStyle(document.querySelector('#gridlyPortraitV2Sheet')).maxHeight),
      statusBackground: getComputedStyle(document.documentElement, '::before').backgroundColor,
    }));
    assert.equal(android.font, '16.1px');
    assert.equal(android.cardPadding, '8px');
    assert.equal(android.pagerPadding, '4px');
    assert.ok(android.sheetMax <= 517);
    assert.equal(android.statusBackground, 'rgb(11, 29, 43)');

    await page.setViewportSize({ width: 320, height: 316 });
    await page.evaluate(() => document.documentElement.style.setProperty('--gridly-visual-vh', '316px'));
    await page.locator('[data-gridly-manual-awareness-search]').focus();
    const keyboard = await page.evaluate(() => ({
      dockDisplay: getComputedStyle(document.querySelector('#gridlyPortraitBottomRegion')).display,
      introDisplay: getComputedStyle(document.querySelector('.gridly-v2-sheet-copy')).display,
      sheet: document.querySelector('#gridlyPortraitV2Sheet').getBoundingClientRect().toJSON(),
      input: document.querySelector('[data-gridly-manual-awareness-search]').getBoundingClientRect().toJSON(),
      result: document.querySelector('.settings-manual-area-result').getBoundingClientRect().toJSON(),
    }));
    assert.equal(keyboard.dockDisplay, 'none');
    assert.equal(keyboard.introDisplay, 'none');
    assert.ok(keyboard.sheet.top >= 30);
    assert.ok(keyboard.sheet.bottom <= 316);
    assert.ok(keyboard.input.top < 316);
    assert.ok(keyboard.result.top < keyboard.sheet.bottom);

    await page.setViewportSize({ width: 320, height: 693 });
    await page.evaluate(() => document.documentElement.style.setProperty('--gridly-visual-vh', '693px'));
    const restored = await page.evaluate(() => ({
      dockDisplay: getComputedStyle(document.querySelector('#gridlyPortraitBottomRegion')).display,
      sheetMax: parseFloat(getComputedStyle(document.querySelector('#gridlyPortraitV2Sheet')).maxHeight),
    }));
    assert.notEqual(restored.dockDisplay, 'none');
    assert.ok(restored.sheetMax <= 517);

    await page.waitForTimeout(450); // Allow the app's palette transitions to settle.
    const search = await page.evaluate(() => ({
      cardBackground: getComputedStyle(document.querySelector('#gridlySearchShell .gridly-search-card')).backgroundColor,
      titleColor: getComputedStyle(document.querySelector('.gridly-search-result-title')).color,
      confirmationBackground: getComputedStyle(document.querySelector('.gridly-destination-confirmation')).backgroundColor,
      confirmationTitleColor: getComputedStyle(document.querySelector('.gridly-destination-confirmation-title')).color,
    }));
    assert.equal(search.cardBackground, 'rgb(251, 253, 255)');
    assert.equal(search.titleColor, 'rgb(13, 27, 42)');
    assert.equal(search.confirmationBackground, 'rgb(220, 238, 242)');
    assert.equal(search.confirmationTitleColor, 'rgb(13, 27, 42)');

    const secondary = await page.evaluate(() => ({
      placeColor: getComputedStyle(document.querySelector('.settings-place-card strong')).color,
      placeActionColor: getComputedStyle(document.querySelector('.settings-place-action')).color,
      legalPanelMax: parseFloat(getComputedStyle(document.querySelector('.gridly-ugc-panel')).maxHeight),
      legalFrameHeight: parseFloat(getComputedStyle(document.querySelector('.gridly-ugc-legal-frame')).height),
    }));
    assert.equal(secondary.placeColor, 'rgb(18, 38, 58)');
    assert.equal(secondary.placeActionColor, 'rgb(18, 38, 58)');
    assert.ok(secondary.legalPanelMax <= 555);
    assert.ok(secondary.legalFrameHeight <= 389);

    await page.evaluate(() => delete document.documentElement.dataset.gridlyNativePlatform);
    await page.waitForTimeout(450);
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), before);
  } finally {
    await browser.close();
  }
});
