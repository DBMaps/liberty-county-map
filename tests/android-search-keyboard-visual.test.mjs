import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {chromium} from 'playwright';

const css = readFileSync('css/styles.css', 'utf8');
const index = readFileSync('index.html', 'utf8');
const search = index.slice(index.indexOf('  <div id="gridlySearchShell"'), index.indexOf('  <main class="app-shell'))
  .replace(' hidden data-search-ui="dormant"', ' data-search-ui="active"');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const launchOptions = existsSync(edge) ? {executablePath: edge} : {};

async function geometry(page) {
  return page.evaluate(() => {
    const controls = ['gridlyAddressSearchInput', 'gridlyRemoteSearchBtn', 'gridlySearchCloseBtn'];
    return {
      controls: controls.map(id => {
        const e = document.getElementById(id), r = e.getBoundingClientRect();
        const points = [[r.left + 2, r.y + r.height / 2], [r.right - 2, r.y + r.height / 2], [r.x + r.width / 2, r.top + 2], [r.x + r.width / 2, r.bottom - 2]];
        return {id, rect: r.toJSON(), reachable: points.every(([x,y]) => e.contains(document.elementFromPoint(x,y)))};
      }),
      sheet: document.getElementById('gridlySearchShell').getBoundingClientRect().toJSON(),
      dock: getComputedStyle(document.getElementById('gridlyPortraitBottomRegion')).display,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
}

test('Android Search keeps input and actions reachable at both portrait and landscape-shaped keyboard heights', async () => {
  const browser = await chromium.launch({headless: true, ...launchOptions});
  try {
    for (const theme of ['light','dark']) {
      const page = await browser.newPage({viewport: {width: 360, height: 780}});
      await page.setContent(`<!doctype html><html data-gridly-native-platform="android" data-gridly-effective-theme="${theme}" style="--gridly-app-font-scale:1.15;--gridly-visual-vh:780px"><body data-layout-mode="portrait">${search}<div id="gridlyPortraitV2"><div id="gridlyPortraitBottomRegion" class="gridly-v2-bottom-region"><nav class="gridly-v2-bottom-dock"><button>Report</button><button>Alerts</button><button>History</button><button>Settings</button></nav></div></div></body></html>`);
      await page.addStyleTag({content: css});
      // Measure settled geometry, not intermediate Reset-button transitions.
      await page.addStyleTag({content:'*, *::before, *::after { transition: none !important; animation: none !important; }'});
      await page.locator('#gridlyAddressSearchInput').fill('Municipal Emergency Administration');
      await page.locator('#gridlySearchClearBtn').evaluate(e => e.classList.remove('is-clear-hidden'));
      await page.locator('#gridlySearchResults').evaluate(e => {
        e.dataset.searchPublication = 'active';
        e.innerHTML = '<div class="gridly-search-results-list">' + Array.from({length:6}, (_,i) => `<button class="gridly-search-result-item"><span class="gridly-search-result-title">Municipal Community Center and Emergency Preparedness Building ${i+1}</span></button>`).join('') + '</div>';
      });
      const normal = await geometry(page);
      for (const viewport of [{width:360,height:367},{width:320,height:316}]) {
        await page.setViewportSize(viewport);
        await page.evaluate(height => document.documentElement.style.setProperty('--gridly-visual-vh', `${height}px`), viewport.height);
        await page.locator('#gridlyAddressSearchInput').focus();
        const small = await geometry(page);
        assert.equal(small.dock, 'none', `${theme}: dock must clear the keyboard foreground`);
        assert.ok(small.sheet.top >= 33 && small.sheet.bottom <= viewport.height);
        assert.equal(small.overflow, false);
        for (const {id,rect,reachable} of small.controls) {
          assert.ok(reachable, `${theme}/${viewport.width}: ${id} is clipped or covered`);
          assert.ok(rect.height >= 44, `${id} retains a touch target`);
        }
        const last = page.locator('.gridly-search-result-item').last();
        await last.scrollIntoViewIfNeeded();
        assert.equal(await last.evaluate(e => {const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}), true);
        for (const control of (await geometry(page)).controls) assert.ok(control.reachable, `${control.id} remains reachable after scrolling results`);
        await page.locator('.gridly-search-card').evaluate(e => e.scrollTop = 0);
      }
      // Android leaves the field focused after Back dismisses the IME.
      await page.setViewportSize({width:360,height:780});
      await page.evaluate(() => document.documentElement.style.setProperty('--gridly-visual-vh','780px'));
      assert.deepEqual(await geometry(page), normal);
      await page.locator('#gridlySearchShell').evaluate(e => e.hidden = true);
      assert.notEqual(await page.locator('#gridlyPortraitBottomRegion').evaluate(e => getComputedStyle(e).display), 'none');
      await page.close();
    }
  } finally { await browser.close(); }
});

test('short-height Search repair requires the native Android marker', async () => {
  const browser = await chromium.launch({headless: true, ...launchOptions});
  try {
    const page = await browser.newPage({viewport:{width:360,height:367}});
    await page.setContent(`<!doctype html><html style="--gridly-app-font-scale:1.15;--gridly-visual-vh:367px"><body data-layout-mode="portrait">${search}<div id="gridlyPortraitV2"><div id="gridlyPortraitBottomRegion" class="gridly-v2-bottom-region">Dock</div></div></body></html>`);
    await page.addStyleTag({content:css});
    const browserLayout = await geometry(page);
    assert.equal(browserLayout.sheet.top, 146);
    assert.notEqual(browserLayout.dock, 'none');
    await page.evaluate(() => document.documentElement.dataset.gridlyNativePlatform = 'ios');
    assert.deepEqual(await geometry(page), browserLayout);
    await page.evaluate(() => document.documentElement.dataset.gridlyNativePlatform = 'android');
    assert.equal((await geometry(page)).dock, 'none');
    await page.evaluate(() => delete document.documentElement.dataset.gridlyNativePlatform);
    assert.deepEqual(await geometry(page), browserLayout);
  } finally { await browser.close(); }
});
