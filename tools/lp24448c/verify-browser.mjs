import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = process.cwd();
const output = '.artifacts/lp24448c';
fs.mkdirSync(output, { recursive: true });
const mime = { '.js': 'text/javascript', '.json': 'application/json', '.geojson': 'application/json', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
if (process.argv.includes('--serve')) {
  console.log(`Open ${origin} in a browser. Press Ctrl+C to stop the local server.`);
  await new Promise(() => {});
}
const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', geolocation: { latitude: 30.0466, longitude: -94.8852 }, permissions: ['geolocation'] });
await context.addInitScript(() => {
  localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C', 'yes');
  if (!localStorage.getItem('gridlySavedPlacesV1')) localStorage.setItem('gridlySavedPlacesV1', JSON.stringify({ version: 1,
    home: { id: 'home', label: 'Test home', lat: 30.3413, lng: -95.0858, coordinateSource: 'geocode', resolutionStatus: 'success', validationStatus: 'passed' },
    work: { id: 'work', label: 'Test work', lat: 29.91154, lng: -95.06325, coordinateSource: 'geocode', resolutionStatus: 'success', validationStatus: 'passed' }, custom: [], favorites: [] }));
});
const mutationRequests = [], errors = [], warnings = [];
let phase = 'startup';
let backendRows = [];
const backendReads = [];
await context.route('**/*', async (route) => {
  const request = route.request(), url = request.url();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutationRequests.push({ phase, method: request.method(), url });
  if (url.startsWith(origin)) return route.continue();
  if (url.includes('supabase.co/rest/v1/reports') && request.method() === 'GET') {
    const rows = new URL(url).searchParams.get('report_type') === 'eq.hazard_cleared' ? [] : backendRows;
    backendReads.push({ phase, count: rows.length, url });
    await new Promise((resolve) => setTimeout(resolve, 220));
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'content-range': rows.length ? '0-0/1' : '0-0/0' }, body: JSON.stringify(rows) });
  }
  if (url.includes('/route/v1/')) {
    const pairs = decodeURIComponent(new URL(url).pathname).split('/').at(-1).split(';').map((point) => point.split(',').map(Number));
    if (pairs.length < 2 || !pairs.every((point) => point.length === 2 && point.every(Number.isFinite))) return route.abort();
    return route.fulfill({ json: { code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates: pairs }, distance: 1200, duration: 120,
      weight: 120, weight_name: 'routability', legs: [{ steps: [], distance: 1200, duration: 120, summary: 'Local route fixture' }] }],
      waypoints: pairs.map((location) => ({ location, name: 'Fixture', distance: 0 })) } });
  }
  if (url.includes('leaflet@1.9.4/dist/leaflet.js')) return route.fulfill({ path: 'node_modules/leaflet/dist/leaflet.js', contentType: 'text/javascript' });
  if (url.includes('leaflet@1.9.4/dist/leaflet.css')) return route.fulfill({ path: 'node_modules/leaflet/dist/leaflet.css', contentType: 'text/css' });
  if (url.includes('@supabase/supabase-js@2')) return route.fulfill({ path: 'node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType: 'text/javascript' });
  if (request.method() === 'GET' && (/\.tile\.openstreetmap\.org\//.test(url) || url.includes('server.arcgisonline.com/'))) return route.continue();
  if (url.startsWith('https://api.weather.gov/')) {
    const body = url.includes('/points/') ? { properties: { forecast: 'https://api.weather.gov/gridpoints/TEST/1,1/forecast' } }
      : url.includes('/forecast') ? { properties: { periods: [] } } : { type: 'FeatureCollection', features: [] };
    return route.fulfill({ json: body });
  }
  return route.abort();
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.stack));
page.on('console', (message) => { if (message.type() === 'warning') warnings.push(message.text()); });
page.setDefaultTimeout(45000);
const sample = () => page.evaluate(() => {
  const root = document.querySelector('[data-gridly-lp236-alerts]');
  const community = root?.querySelector('[data-gridly-lp236-source="community_report"]');
  const rows = getGridlyAlertsSurfaceActiveCommunityReportRows();
  const cards = [...(root?.querySelectorAll('[data-gridly-lp236-condition-id]') || [])];
  return {
    fixtures: gridlyLocalTestReports.list().length,
    normalizedFixtures: activeHazards.filter(x => x.gridlyLocalTestOnly).length,
    productionHazards: activeHazards.filter(x => !x.gridlyLocalTestOnly).length,
    localRows: rows.filter(x => JSON.stringify(x).includes('gridly-test-lp24448a-')).length,
    allRows: rows.length,
    cards: cards.length,
    cardIds: cards.map(x => x.dataset.gridlyLp236ConditionId),
    communityText: community?.innerText || '',
    communityState: community?.getAttribute('data-gridly-lp236-authority-state') || '',
    header: root?.querySelector('.gridly-lp236-header')?.innerText || '',
    incomplete: root?.innerText?.includes('Coverage incomplete') || false,
    backend: gridlyLastReportRetrievalDiagnostic && { status: gridlyLastReportRetrievalDiagnostic.finalStatus, rowCount: gridlyLastReportRetrievalDiagnostic.rowCount },
    context: { type: gridlyGetCurrentAwarenessContext().type, placeName: gridlyGetCurrentAwarenessContext().placeName },
    home: localStorage.getItem('gridlySavedPlacesV1'),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
  };
});
const timeline = [];
async function capture(stage, expected) {
  const state = await sample();
  timeline.push({ stage, state });
  if (expected !== undefined) {
    assert.equal(state.fixtures, expected, `${stage} fixture count`);
    assert.equal(state.normalizedFixtures, expected, `${stage} normalized fixtures`);
    assert.equal(state.localRows, expected, `${stage} local rows`);
    assert.equal(state.cards, expected, `${stage} cards`);
    assert.equal(new Set(state.cardIds).size, expected, `${stage} unique cards`);
    assert.match(state.communityText, new RegExp(`\\b${expected}\\b`), `${stage} visible community count`);
  }
  assert.equal(state.horizontalOverflow, false, `${stage} horizontal overflow`);
  return state;
}
try {
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.gridlyLocalTestReports?.add === 'function' && typeof window.gridlySearchAddress === 'function');
  await page.evaluate(() => { gridlySubmitCommunityOperation = async () => { throw Error('Production mutation path reached'); }; });
  await page.evaluate(async () => { const result = (await gridlySearchAddress('Dayton', { limit: 5 }))[0]; selectGridlySearchResult(result); closeGridlyDestinationSearchSurface(); });
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().placeName === 'Dayton');
  const initialHome = await page.evaluate(() => localStorage.getItem('gridlySavedPlacesV1'));
  await page.evaluate(() => { const c = map.getCenter(); gridlyLocalTestReports.add('flooded-roadway', { lat: c.lat, lng: c.lng }); gridlyLocalTestReports.add('debris-in-road', { lat: c.lat + 0.003, lng: c.lng + 0.003 }); gridlyLocalTestReports.add('downed-power-line', { lat: c.lat - 0.003, lng: c.lng - 0.003 }); });
  await capture('before_open');
  await page.locator('#gridlyAlertsDockButton').click();
  await capture('immediately_after_open', 3);
  for (const ms of [250, 500, 1000]) { await page.waitForTimeout(ms); await capture(`after_${ms}ms`, 3); }
  await page.waitForFunction(() => (gridlyRefreshAuditState.refreshSourceCounts?.['loadSharedReports:alerts_open_background_refresh'] || 0) >= 1, { timeout: 30000 });
  await capture('after_first_background_refresh', 3);
  phase = 'second_background_refresh';
  await page.evaluate(() => { void loadSharedReports('alerts_open_background_refresh_lp24448c_second'); });
  await page.waitForTimeout(80);
  await capture('during_second_background_refresh', 3);
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED');
  await capture('after_second_background_refresh', 3);
  for (const width of [320, 360, 390, 440]) {
    await page.setViewportSize({ width, height: 844 });
    await capture(`portrait_${width}`, 3);
    await page.screenshot({ path: path.join(output, `alerts-${width}.png`), fullPage: true });
  }
  phase = 'clear';
  await page.evaluate(() => gridlyLocalTestReports.clear());
  await page.waitForFunction(() => document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]').length === 0);
  const cleared = await capture('immediately_after_clear');
  assert.equal(cleared.fixtures, 0);
  assert.equal(cleared.normalizedFixtures, 0);
  assert.equal(cleared.cards, 0);
  await page.evaluate(() => { void loadSharedReports('alerts_open_background_refresh_lp24448c_after_clear'); });
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED');
  const afterClearRefresh = await capture('after_clear_background_refresh');
  assert.equal(afterClearRefresh.fixtures, 0);
  assert.equal(afterClearRefresh.cards, 0);
  assert.equal(afterClearRefresh.home, initialHome);
  assert.deepEqual(afterClearRefresh.context, { type: 'SEARCH', placeName: 'Dayton' });
  assert.equal(backendReads.every(x => x.count === 0), true, 'local fixtures never become backend rows');
  const fixtureReadCount = backendReads.length;
  phase = 'production_row';
  const now = new Date();
  backendRows = [{ id: 'lp24448c-production-row', report_type: 'debris', crossing_id: 'hazard-lp24448c-production-row', lat: 30.0466, lng: -94.8852, county_id: 'liberty-tx', created_at: now.toISOString(), expires_at: new Date(now.getTime() + 14400000).toISOString(), severity: 'moderate', detail: 'Production shaped report', source: 'user' }];
  await page.evaluate(() => { void loadSharedReports('lp24448c_production_row'); });
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED' && gridlyLastReportRetrievalDiagnostic.rowCount === 1);
  const production = await capture('production_row_loaded');
  assert.equal(production.fixtures, 0);
  assert.equal(production.cards, 1);
  assert.equal(production.productionHazards, 1);
  await page.evaluate(() => { void loadSharedReports('lp24448c_production_refresh'); });
  await page.waitForTimeout(120);
  const productionLoading = await capture('production_row_during_refresh');
  assert.equal(productionLoading.cards, 1);
  assert.equal(productionLoading.communityState, 'LOADING');
  assert.equal(productionLoading.incomplete, true);
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED' && gridlyLastReportRetrievalDiagnostic.rowCount === 1);
  assert.equal((await capture('production_row_after_refresh')).cards, 1);
  backendRows = [];
  await page.evaluate(() => { void loadSharedReports('lp24448c_production_remove'); });
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED' && gridlyLastReportRetrievalDiagnostic.rowCount === 0);
  assert.equal((await capture('production_row_removed')).cards, 0);
  assert.equal(backendReads.slice(0, fixtureReadCount).every(x => x.count === 0), true);
  assert.equal(mutationRequests.filter(x => x.url.includes('/rest/v1/reports')).length, 0, 'no backend report writes');
  assert.deepEqual(errors, [], 'no page errors');
  fs.writeFileSync(path.join(output, 'verification.json'), JSON.stringify({ timeline, backendReads, mutationRequests, errors, warnings }, null, 2));
  console.log(JSON.stringify({ pass: true, stages: timeline.map(x => ({ stage: x.stage, fixtures: x.state.fixtures, cards: x.state.cards, state: x.state.communityState, backend: x.state.backend })), backendReads: backendReads.length, mutationRequests, warnings }));
} catch (error) {
  fs.writeFileSync(path.join(output, 'verification-failure.json'), JSON.stringify({ error: String(error.stack || error), timeline, backendReads, mutationRequests, errors, warnings }, null, 2));
  throw error;
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

