const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448f1');
fs.mkdirSync(output, { recursive: true });
const evidence = { profiles: [], refreshes: [], widths: [], location: [], errors: [], warnings: [], blockedRequests: [] };
const markerHashes = () => Object.fromEntries(fs.readdirSync('assets/markers/approved', { recursive: true })
  .filter(name => name.endsWith('.png')).map(name => [name, crypto.createHash('sha256')
    .update(fs.readFileSync(path.join('assets/markers/approved', name))).digest('hex')]));
const beforeMarkers = markerHashes();
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const home = { id: 'home', label: 'Test home', lat: 30.3413, lng: -95.0858, coordinateSource: 'geocode', resolutionStatus: 'success', validationStatus: 'passed' };
const work = { ...home, id: 'work', label: 'Test work', lat: 29.91154, lng: -95.06325 };
const full = { version: 1, home, work, custom: [], favorites: [] };
let browser;

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const edge = process.env.GRIDLY_BROWSER_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  const makeContext = async profile => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await context.routeWebSocket('**/*', socket => socket.close());
    await context.route('**/*', async route => {
      const request = route.request(), url = request.url();
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        evidence.blockedRequests.push({ method: request.method(), url });
        return route.abort();
      }
      if (url.startsWith(origin)) return route.continue();
      if (url.includes('leaflet@1.9.4/dist/leaflet.js')) return route.fulfill({ path: 'node_modules/leaflet/dist/leaflet.js', contentType: 'text/javascript' });
      if (url.includes('leaflet@1.9.4/dist/leaflet.css')) return route.fulfill({ path: 'node_modules/leaflet/dist/leaflet.css', contentType: 'text/css' });
      if (url.includes('@supabase/supabase-js@2')) return route.fulfill({ path: 'node_modules/@supabase/supabase-js/dist/umd/supabase.js', contentType: 'text/javascript' });
      // No live backend, geocoder, routing or tile access in this deterministic run.
      return route.abort();
    });
    await context.addInitScript(profile => {
      localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C', 'yes');
      if (profile) localStorage.setItem('gridlySavedPlacesV1', JSON.stringify(profile));
    }, profile);
    return context;
  };
  const openPage = async context => {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => evidence.errors.push(error.stack));
    page.on('console', message => { if (message.type() === 'warning') evidence.warnings.push(message.text()); });
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof gridlyLocalTestReports === 'object' && gridlyCrossingInventoryCountyId === 'liberty-tx' && crossings.length > 0 && roadwayDatasetLoaded);
    return page;
  };
  for (const [name, profile] of Object.entries({ empty: null, home: { ...full, work: null }, work: { ...full, home: null }, full,
    partial: { ...full, home: { id: 'home', label: 'Legacy partial', coordinateSource: 'geocode', address: 'Dayton, TX', lat: null, lng: null }, work: null } })) {
    const context = await makeContext(profile), page = await openPage(context);
    const state = await page.evaluate(() => ({ saved: getSavedPlacesState(), bytes: localStorage.getItem('gridlySavedPlacesV1'), locality: document.getElementById('mobileAwarenessPanelIssues').parentElement.innerText }));
    for (const slot of ['home', 'work']) if (profile?.[slot]?.validationStatus === 'passed') {
      for (const [key, value] of Object.entries(profile[slot])) assert.deepEqual(state.saved[slot][key], value, `${name}/${slot}/${key}`);
    }
    await page.locator('#mobileDestinationCommandBtn').click();
    assert.equal(await page.locator('#gridlyAddressSearchInput').isVisible(), true);
    await page.locator('#gridlySearchCloseBtn').click();
    await page.locator('#gridlySettingsDockButton').click();
    await page.getByText('Travel', { exact: true }).click();
    const management = await page.locator('#gridlyPortraitV2Sheet').innerText();
    assert.match(management, /HOME/); assert.match(management, /WORK/);
    evidence.profiles.push({ name, ...state, search: true, management: true });
    await context.close();
  }
  console.log('Profile acceptance passed (5 cases).');
  const context = await makeContext(full), page = await openPage(context);
  await page.evaluate(() => saveGridlyHomeTownPreference('Dayton'));
  const homeBytes = () => page.evaluate(() => Object.fromEntries(['gridlyHomePersonalizationV1', 'gridlyHomeTown', 'gridlySettingsV1', 'gridlyUserProfileV1', 'gridlySavedPlacesV1'].map(key => [key, localStorage.getItem(key)])));
  const originalHome = await homeBytes();
  await page.evaluate(() => [
    gridlyLocalTestReports.add('flooded-roadway', { lat: 30.047253308692213, lng: -94.88737106323242, ageMinutes: 0 }),
    gridlyLocalTestReports.add('debris-in-road', { lat: 30.0505, lng: -94.889, ageMinutes: 5 }),
    gridlyLocalTestReports.add('downed-power-line', { lat: 30.0435, lng: -94.8815, ageMinutes: 12 })
  ]);
  const parity = async () => {
    const state = await page.evaluate(() => ({ hazards: activeHazards.length, markers: unifiedIncidentLayer.getLayers().length,
      ids: unifiedIncidentLayer.getLayers().map(marker => marker.options.incidentId), location: document.getElementById('mobileAwarenessPanelIssues').textContent,
      pulse: gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount, kbyg: gridlyGetGovernedConsumerProjection().surfaces.kbygCommunity.length,
      alerts: getGridlyAlertsSurfaceActiveCommunityReportRows().length,
      rows: [...document.querySelectorAll('#gridlyPortraitV2Sheet [data-gridly-lp236-condition-id]')].map(row => ({ id: row.dataset.gridlyLp236ConditionId, location: row.dataset.gridlyAlertLocation, time: row.querySelector('.gridly-lp236-condition-time')?.textContent })),
      snapshotAges: getAlertsSurfaceSnapshot().alerts.map(row => ({ id: row.id, type: row.type, submittedAt: row.submittedAt, label: row.minutesText,
        popup: formatGridlyHazardPopupFreshnessLine(row) })), undefinedm: document.body.innerText.includes('undefinedm') }));
    for (const key of ['hazards', 'markers', 'pulse', 'kbyg', 'alerts']) assert.equal(state[key], 3, key);
    assert.equal(new Set(state.ids).size, 3); assert.match(state.location, /3 roadway issues nearby/); assert.equal(state.undefinedm, false);
    if (state.rows.length) assert.deepEqual(state.rows.map(row => row.location).sort(), ['Cook Street and Church Street', 'Winfree Street and Flowers Street', 'Hope Street and Nancy Street'].sort());
    for (const row of state.snapshotAges) {
      const age = text => Number(text.match(/(\d+) minute/)?.[1] || 0);
      const rendered = state.rows.find(card => card.id === row.id || card.id.endsWith(`:${row.id}`) || card.id.endsWith(`hazard-${row.id}`));
      if (state.rows.length) {
        assert.ok(rendered, `Missing card for ${row.id}`);
        assert.ok(Math.abs(age(rendered.time) - age(row.popup)) <= 1, JSON.stringify({ rendered, row }));
      }
    }
    return state;
  };
  await page.locator('#gridlyAlertsDockButton').click();
  await page.waitForFunction(() => document.querySelectorAll('#gridlyPortraitV2Sheet [data-gridly-lp236-condition-id]').length === 3);
  evidence.baseline = await parity();
  assert.match(evidence.baseline.snapshotAges[0].label, /just now|1 minute/);
  assert.match(evidence.baseline.snapshotAges[1].label, /[56] minutes/);
  assert.match(evidence.baseline.snapshotAges[2].label, /1[23] minutes/);
  const community = page.locator('details[data-gridly-disclosure-key="community_report"]');
  if (!await community.evaluate(e => e.open)) await community.locator(':scope > summary').click();
  for (const summary of await community.locator('.gridly-lp236-group > summary').all()) {
    if (!await summary.evaluate(e => e.parentElement.open)) await summary.click();
  }
  await page.locator('#gridlyPortraitV2SheetBody').evaluate(e => { e.scrollTop = 120; });
  for (let cycle = 1; cycle <= 3; cycle++) {
    const previous = await page.evaluate(() => gridlyAlertsOpenRefreshFixAudit().lastAlertsOpen?.backgroundRefreshCompletedAt || 0);
    await page.evaluate(() => gridlyRunAlertsBackgroundRefreshAfterOpen('alerts_open_background_refresh'));
    await page.waitForFunction(previous => (gridlyAlertsOpenRefreshFixAudit().lastAlertsOpen?.backgroundRefreshCompletedAt || 0) > previous, previous);
    // Also span ordinary scheduled updates, rather than testing markup alone.
    await page.waitForTimeout(16000);
    assert.equal(await community.evaluate(e => e.open), true);
    assert.equal(await page.locator('#gridlyPortraitV2SheetBody').evaluate(e => e.scrollTop), 120);
    evidence.refreshes.push({ cycle, ...await parity(), scrollTop: await page.locator('#gridlyPortraitV2SheetBody').evaluate(e => e.scrollTop) });
    console.log(`Background refresh cycle ${cycle} passed.`);
  }
  await community.locator(':scope > summary').click();
  await page.evaluate(async () => { await loadSharedReports('alerts_open_background_refresh'); await openAlertsSurfaceFromDock(); });
  assert.equal(await community.evaluate(e => e.open), false);
  evidence.manualClosePreserved = true;
  await community.locator(':scope > summary').click();
  const firstGroup = community.locator('.gridly-lp236-group').first();
  if (!await firstGroup.evaluate(e => e.open)) await firstGroup.locator(':scope > summary').click();
  await firstGroup.locator('[data-gridly-show-on-map]').first().click();
  await page.waitForFunction(() => window.__gridlyLp019AlertFocusDebug?.mapMovementDispatched === true);
  evidence.showMe = await page.evaluate(() => ({ focused: window.__gridlyLp019AlertFocusDebug.mapMovementDispatched, sheet: document.getElementById('gridlyPortraitV2Sheet').dataset.sheetState }));
  await page.evaluate(() => closePortraitV2Sheet());
  const choose = async name => {
    await page.locator('#mobileDestinationCommandBtn').click();
    await page.locator('#gridlyAddressSearchInput').fill(name);
    await page.locator('#gridlyRemoteSearchBtn').click();
    await page.locator('#gridlySearchResults button').filter({ hasText: name }).first().click();
    await page.locator('#gridlySearchCloseBtn').click();
  };
  await choose('Dayton');
  assert.equal(await page.evaluate(() => gridlyGetCurrentAwarenessContext().type), 'SEARCH');
  await page.locator('#gridlyTemporaryContextReturnHome').click();
  assert.equal(await page.evaluate(() => gridlyGetCurrentAwarenessContext().type), 'HOME');
  evidence.searchReturnHome = true;
  // Injectable browser bridge; real request owner, guards and callbacks are unchanged.
  await page.evaluate(() => { window.__originalForeground = requestGridlyForegroundPosition;
    requestGridlyForegroundPosition = (success, failure) => { window.__foreground = { success, failure }; return 'browser-fixture'; }; });
  const status = () => page.locator('#gridlyV2ParticipationAcknowledgement').evaluate(e => ({ text: e.textContent, hidden: e.hidden,
    display: getComputedStyle(e).display, live: e.getAttribute('aria-live'), count: document.querySelectorAll('#gridlyV2ParticipationAcknowledgement').length,
    width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }));
  const startLocation = async () => { await page.locator('#mobileDestinationCommandBtn').click(); await page.locator('#gridlySearchAroundMeBtn').click(); };
  for (const width of [320, 360, 390, 440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const result of ['denied', 'stale', 'timeout', 'error', 'success']) {
      await startLocation();
      assert.match((await status()).text, /Finding your location/);
      await page.evaluate(result => {
        if (result === 'success' || result === 'stale') window.__foreground.success({ timestamp: Date.now() - (result === 'stale' ? 121000 : 0), coords: { latitude: 30.04725, longitude: -94.88737, accuracy: 10 } });
        else window.__foreground.failure({ code: result === 'denied' ? 1 : result === 'timeout' ? 3 : 2 });
      }, result);
      const visible = await status();
      assert.equal(visible.hidden, false); assert.notEqual(visible.display, 'none'); assert.equal(visible.count, 1); assert.equal(visible.live, 'polite');
      assert.ok(visible.width <= width && visible.height > 0);
      assert.match(visible.text, result === 'success' ? /two minutes.*Home is unchanged/ : result === 'denied' ? /permission was denied/ : result === 'timeout' ? /timed out/ : /fresh location is unavailable/);
      evidence.location.push({ viewportWidth: width, result, ...visible });
      if (result === 'success') {
        assert.equal(await page.evaluate(() => gridlyGetCurrentAwarenessContext().type), 'AROUND_ME');
        await page.screenshot({ path: path.join(output, `around-me-${width}.png`) });
        await page.evaluate(() => { const context = gridlyGetCurrentAwarenessContext(); gridlyExpireForegroundAwarenessContext(context, context.expiresAt + 1); });
        assert.match((await status()).text, /expired/);
        await page.locator('#gridlyTemporaryContextReturnHome').click();
      }
      assert.equal(await page.evaluate(() => gridlyGetCurrentAwarenessContext().type), 'HOME');
      assert.deepEqual(await homeBytes(), originalHome);
    }
    evidence.widths.push({ width, ...await parity() });
  }
  await page.evaluate(() => requestGridlyForegroundPosition = window.__originalForeground);
  evidence.homePersistence = true;
  evidence.routeProtection = await page.evaluate(async () => {
    routeWatchActivated = true; window.__gridlyRouteWatchActive = true;
    const before = JSON.stringify(gridlyGetAwarenessContextStore().temporary);
    const requestRejected = requestGridlyUserLocationFromControl() === false;
    const fixRejected = gridlyActivateForegroundAwarenessContext({ timestamp: Date.now(), coords: { latitude: 30.04, longitude: -94.88 } }) === null;
    const result = (await gridlySearchAddress('Dayton', { limit: 5 }))[0];
    selectGridlySearchResult(result);
    const temporaryUnchanged = JSON.stringify(gridlyGetAwarenessContextStore().temporary) === before;
    routeWatchActivated = false; window.__gridlyRouteWatchActive = false;
    return { requestRejected, fixRejected, temporaryUnchanged };
  });
  assert.deepEqual(evidence.routeProtection, { requestRejected: true, fixRejected: true, temporaryUnchanged: true });
  assert.deepEqual(await homeBytes(), originalHome);
  evidence.productionShaped = await page.evaluate(() => {
    const id = 'lp24448f1-production-shaped';
    const [record] = normalizeReports([{ id, report_type: 'debris', crossing_id: `hazard-${id}`, county_id: 'liberty-tx', lat: 30.048, lng: -94.885,
      created_at: new Date(Date.now() - 7 * 60000).toISOString(), expires_at: new Date(Date.now() + 3600000).toISOString(), source: 'user', detail: 'Shared report: debris in road.' }]);
    activeHazards.push(record); refreshReportHazardViews('lp24448f1-production-shaped');
    const row = getAlertsSurfaceSnapshot().alerts.find(row => row.id === id);
    const result = { label: row?.minutesText, popup: formatGridlyHazardPopupFreshnessLine(record) };
    activeHazards = activeHazards.filter(row => row.id !== id); refreshReportHazardViews('lp24448f1-remove-production-shaped');
    return result;
  });
  assert.match(evidence.productionShaped.label, /7 minutes/);
  assert.equal(evidence.productionShaped.label, evidence.productionShaped.popup);
  evidence.finalParity = await parity();
  evidence.trust = await page.evaluate(() => gridlyTravelBriefConfidenceLine(buildGridlyAwarenessStory()));
  assert.equal(evidence.trust, 'Multiple recent signals.');
  await page.evaluate(() => gridlyLocalTestReports.clear());
  assert.deepEqual(markerHashes(), beforeMarkers); assert.equal(Object.keys(beforeMarkers).length, 31);
  evidence.markerIntegrity = { count: 31, unchanged: true };
  assert.equal(evidence.errors.length, 0, evidence.errors.join('\n'));
  assert.ok(evidence.blockedRequests.every(row => /\/(?:rpc\/get_community_reporting_status|functions\/v1\/gridly-geocode)$/.test(row.url)), 'Unexpected attempted mutation');
  evidence.passed = true;
  console.log('F1 browser acceptance passed.');
})().catch(error => { evidence.failure = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
  fs.writeFileSync(path.join(output, 'browser.json'), JSON.stringify(evidence, null, 2));
  await browser?.close(); await new Promise(resolve => server.close(resolve));
});
