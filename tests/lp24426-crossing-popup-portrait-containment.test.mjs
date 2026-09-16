import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const root = resolve(import.meta.dirname, '..');
const contentTypes = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.geojson': 'application/geo+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

function staticServer() {
  return createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': contentTypes[extname(file).toLowerCase()] || 'application/octet-stream' });
    createReadStream(file).pipe(response);
  });
}

async function snapshot(page, crossingId) {
  return page.evaluate(id => {
    const rect = node => { if (!node) return null; const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const popup = document.querySelector('#map .leaflet-popup.gridly-crossing-popup');
    const marker = document.querySelector(`.gridly-crossing-marker-wrap[data-crossing-id="${id}"]`);
    const title = popup?.querySelector('[data-gridly-crossing-popup-field="title"]');
    const actions = [...(popup?.querySelectorAll('.popup-report-btn') || [])];
    const hit = node => { const r = node?.getBoundingClientRect(); return r && node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); };
    return {
      popup: rect(popup), marker: rect(marker), title: rect(title), actions: actions.map(rect),
      titleVisible: hit(title), actionsVisible: actions.map(hit),
      tail: rect(popup?.querySelector('.leaflet-popup-tip')),
      selected: marker?.getAttribute('data-gridly-selected'),
      dock: rect(document.querySelector('#gridlyPortraitV2 .gridly-v2-bottom-region')),
      topBoundary: typeof getGridlyMobilePortraitUsableMapCenter === 'function' ? getGridlyMobilePortraitUsableMapCenter(map).topBoundary : null,
      pan: typeof gridlyPopupViewportBounds === 'object' ? gridlyPopupViewportBounds?.mobilePortraitSafeZone && { x: gridlyPopupViewportBounds.panX, y: gridlyPopupViewportBounds.panY } : null,
      mapCenter: typeof map !== 'undefined' && map ? [map.getCenter().lat, map.getCenter().lng] : null,
      width: innerWidth
    };
  }, crossingId);
}

async function shellGeometry(page) {
  return page.evaluate(() => Object.fromEntries([
    '#gridlyPortraitV2 .gridly-v2-topbar',
    '#gridlyBriefFoundationHandle',
    '#gridlyPortraitV2 .gridly-v2-segments',
    '#gridlyReportDockButton',
    '#gridlyPortraitV2 .gridly-v2-bottom-region'
  ].map(selector => {
    const r = document.querySelector(selector)?.getBoundingClientRect();
    return [selector, r ? [r.x, r.y, r.width, r.height] : null];
  })));
}

function assertContained(state, width) {
  assert.ok(state.popup && state.marker && state.title, 'crossing popup, title, and selected marker exist');
  assert.ok(state.popup.left >= 0, `popup left ${state.popup.left} at ${width}`);
  assert.ok(state.popup.right <= width, `popup right ${state.popup.right} at ${width}`);
  assert.ok(state.title.left >= 0 && state.title.right <= width && state.titleVisible, 'title is fully visible and unobscured');
  assert.equal(state.actions.length, 2, 'both crossing actions are retained');
  state.actions.forEach((action, index) => {
    assert.ok(action.left >= 0 && action.right <= width && action.top >= 0 && action.bottom <= state.dock.top, `action ${index} is within the usable viewport`);
    assert.equal(state.actionsVisible[index], true, `action ${index} is reachable`);
  });
  assert.ok(state.popup.top > state.topBoundary, 'popup clears the portrait top panels');
  assert.ok(state.popup.bottom < state.dock.top, 'popup clears the dock');
  const tailX = (state.tail.left + state.tail.right) / 2;
  assert.ok(tailX >= state.marker.left && tailX <= state.marker.right, 'popup tail tracks the selected marker');
  assert.ok(Math.abs(state.tail.bottom - state.marker.top) < 12, 'tail remains visually attached to marker');
  assert.equal(state.selected, 'true', 'marker selection remains stable');
  assert.ok(state.pan && Math.abs(state.pan.x) <= 200 && Math.abs(state.pan.y) <= 200, 'pre-open map movement is bounded');
}

test('LP244.26 portrait crossing popup remains visible and interactive across narrow widths', { timeout: 180_000 }, async t => {
  const server = staticServer();
  await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
  const baseURL = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height] of [[360,800],[375,812],[390,844],[411,914]].filter(([width]) => !process.env.LP24426_WIDTH || Number(process.env.LP24426_WIDTH) === width)) {
      await t.test(`${width} x ${height}: left and right edge, close, reopen, pan`, { timeout: 45_000 }, async () => {
        const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, colorScheme: 'dark', permissions: ['geolocation'], geolocation: { latitude: 30.0466, longitude: -94.8852 } });
        try {
          await context.route('**/*', route => {
            const url = route.request().url();
            if (url.startsWith('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js')) return route.fulfill({ path: resolve(root, 'node_modules/leaflet/dist/leaflet.js'), contentType: 'text/javascript' });
            if (url.startsWith('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css')) return route.fulfill({ path: resolve(root, 'node_modules/leaflet/dist/leaflet.css'), contentType: 'text/css' });
            if (url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2')) return route.fulfill({ path: resolve(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js'), contentType: 'text/javascript' });
            if (!url.startsWith(baseURL)) return route.abort();
            return route.continue();
          });
          const page = await context.newPage();
          await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(6000);
          const skip = page.locator('#gridlyV894CFirstRunSkipBtn');
          if (await skip.isVisible().catch(() => false)) await skip.click();
          await page.waitForTimeout(900);
          const id = 'FRA-762789S';
          const marker = page.locator(`.gridly-crossing-marker-wrap[data-crossing-id="${id}"] .gridly-crossing-marker`);
          assert.ok(await marker.isVisible(), 'governed crossing marker is visible');
          const shellBefore = await shellGeometry(page);
          await marker.click();
          await page.waitForTimeout(500);
          const left = await snapshot(page, id);
          assertContained(left, width);
          assert.ok(left.pan.x < 0, 'left-edge marker receives a bounded horizontal correction');
          const shellAfter = await shellGeometry(page);
          assert.deepEqual(shellAfter, shellBefore, 'portrait header, KBYG, report entry, and dock do not shift');

          await page.locator('.leaflet-popup-close-button').click();
          await page.locator('.leaflet-popup.gridly-crossing-popup').waitFor({ state: 'detached' });
          assert.equal(await page.locator('.leaflet-popup.gridly-crossing-popup').count(), 0, 'popup close works');
          assert.deepEqual(await shellGeometry(page), shellBefore, 'portrait shell stays fixed after closing');
          await marker.click();
          await page.waitForTimeout(450);
          assertContained(await snapshot(page, id), width);
          await page.locator('.leaflet-popup-close-button').click();
          await page.locator('.leaflet-popup.gridly-crossing-popup').waitFor({ state: 'detached' });

          await page.evaluate(() => map.panBy([-180, 0], { animate: false }));
          await page.waitForTimeout(500);
          assert.ok(await marker.isVisible(), 'marker remains available after panning');
          await marker.click();
          await page.waitForTimeout(500);
          const right = await snapshot(page, id);
          assertContained(right, width);
          assert.ok(right.pan.x > 0, 'right-edge marker receives a bounded horizontal correction');
          await page.locator('.leaflet-popup-close-button').click();
          await page.locator('.leaflet-popup.gridly-crossing-popup').waitFor({ state: 'detached' });
          assert.equal(await page.locator('.leaflet-popup.gridly-crossing-popup').count(), 0, 'popup clears after pan and reopen');
        } finally {
          await context.close();
        }
      });
    }
  } finally {
    await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
});
