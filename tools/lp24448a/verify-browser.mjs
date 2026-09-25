import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = process.cwd();
const output = '.artifacts/lp24448a';
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
await context.route('**/*', async (route) => {
  const request = route.request(), url = request.url();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutationRequests.push({ phase, method: request.method(), url });
  if (url.startsWith(origin)) return route.continue();
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
const homeBytes = () => page.evaluate(() => Object.fromEntries(['gridlyHomePersonalizationV1', 'gridlyHomeTown', 'gridlySettingsV1', 'gridlyUserProfileV1'].map((key) => [key, localStorage.getItem(key)])));
const choose = async (name) => page.evaluate(async (value) => {
  const result = (await gridlySearchAddress(value, { limit: 5 }))[0];
  if (!result) throw Error(`Search did not find ${value}`);
  selectGridlySearchResult(result);
  closeGridlyDestinationSearchSurface();
}, name);
const state = () => page.evaluate(() => ({
  context: gridlyGetCurrentAwarenessContext().type,
  center: map.getCenter(),
  fixtures: gridlyLocalTestReports.list(),
  incidentIds: getUnifiedIncidents().map((item) => item.id),
  activeHazards: activeHazards.filter((item) => item.gridlyLocalTestOnly).map((item) => item.id),
  activeReports: activeReports.filter((item) => item.gridlyLocalTestOnly).map((item) => item.id),
  canonicalHazards: gridlyGetCanonicalActiveCommunityState().activeRoadHazardRecords.filter((item) => item.gridlyLocalTestOnly).map((item) => item.id),
  markerCount: unifiedIncidentLayer?.getLayers?.().length || 0,
  markerIds: unifiedIncidentLayer?.getLayers?.().map((layer) => layer?.options?.incidentId).filter(Boolean) || [],
  alertsActiveCount: getGridlyAlertsSurfaceActiveCommunityReportRows().length,
  kbygCommunityCount: gridlyGetGovernedConsumerProjection()?.surfaces?.kbygCommunity?.length || 0,
  communityPulseActiveCount: gridlyCommunityPulseAuditState?.activeAwareness?.activeAwarenessCount || 0,
  communityPulseSelectedCount: gridlyCommunityPulseAuditState?.selectedCommunityCount || 0,
  locationIssueLine: document.getElementById('mobileAwarenessPanelIssues')?.textContent || '',
  markerAssets: unifiedIncidentLayer?.getLayers?.().map((layer) => String(layer?.options?.icon?.options?.iconUrl || layer?.options?.icon?.options?.html || '').match(/assets\/markers\/approved\/[^"'\s]+\.png/)?.[0]).filter(Boolean) || [],
  alerts: document.getElementById('alertsList')?.innerText || '',
  kbyg: gridlyBriefInteractionBuildModel()?.location || ''
}));
const actOnPopup = (id, action) => page.evaluate(async ({ id, action }) => {
  const incident = getUnifiedIncidents().find((item) => JSON.stringify(item).includes(id));
  if (!incident) throw Error(`No unified incident for ${id}`);
  const container = document.createElement('div');
  container.innerHTML = buildUnifiedIncidentPopup(incident);
  const button = container.querySelector(`[data-unified-action="${action}"]`);
  if (!button) throw Error(`No ${action} action in production popup`);
  await handleUnifiedIncidentAction(button);
  return gridlyLocalTestReports.list().find((item) => item.id === id);
}, { id, action });
const evidence = { scenarios: [], portraits: [], mutationRequests, errors, warnings };
try {
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.gridlyLocalTestReports?.add === 'function' && typeof window.gridlySearchAddress === 'function');
  await page.evaluate(() => {
    window.__lp24448aOperationCalls = 0;
    gridlySubmitCommunityOperation = async () => { window.__lp24448aOperationCalls += 1; throw Error('Local fixture reached production mutation path'); };
  });
  await page.evaluate(() => saveGridlyHomeTownPreference('Cleveland'));
  const originalHome = await homeBytes();
  phase = 'fixture';
  await choose('Dayton');
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().placeName === 'Dayton');
  const first = await page.evaluate(() => gridlyLocalTestReports.addAtMapCenter('flooded-roadway', { ageMinutes: 5 }));
  await page.waitForTimeout(600);
  let snapshot = await state();
  assert.ok(snapshot.activeHazards.includes(first.id), JSON.stringify(snapshot));
  assert.ok(snapshot.canonicalHazards.includes(first.id));
  assert.ok(snapshot.incidentIds.some((id) => id.startsWith('road-')));
  assert.ok(snapshot.markerCount > 0);
  assert.equal(snapshot.markerCount, 1, 'One road condition must own one map marker');
  assert.equal(snapshot.alertsActiveCount, 1);
  assert.equal(snapshot.kbygCommunityCount, 1);
  assert.equal(snapshot.communityPulseActiveCount, 1);
  assert.equal(snapshot.communityPulseSelectedCount, 1);
  assert.match(snapshot.locationIssueLine, /1 roadway issue nearby/);
  assert.ok(snapshot.markerAssets.some((asset) => String(asset).includes('08-flooding-high-water.png')));
  assert.ok(!snapshot.alerts.includes(first.id), 'Synthetic report ID leaked into consumer Alerts');
  const popup = await page.evaluate((id) => {
    const incident = getUnifiedIncidents().find((item) => JSON.stringify(item).includes(id));
    return incident ? { html: buildUnifiedIncidentPopup(incident), marker: GridlyMarkerRegistry.resolve(incident.report_type || incident.type) } : null;
  }, first.id);
  assert.ok(popup?.html.includes('data-gridly-hazard-popup="consumer"'), JSON.stringify(popup));
  assert.ok(popup.marker?.asset);
  evidence.scenarios.push({ name: 'Dayton flooded roadway', first, snapshot, popupAsset: popup.marker.asset });

  const multi = await page.evaluate(() => {
    const center = map.getCenter();
    return [gridlyLocalTestReports.add('debris-in-road', { lat: center.lat + 0.002, lng: center.lng + 0.002 }),
      gridlyLocalTestReports.add('downed-power-line', { lat: center.lat - 0.002, lng: center.lng - 0.002 })];
  });
  snapshot = await state();
  assert.equal(snapshot.activeHazards.length, 3);
  assert.equal(snapshot.markerCount, 3, 'Three distinct road conditions must own three map markers');
  assert.equal(new Set(snapshot.markerIds).size, 3, 'Each map marker needs a distinct incident owner');
  assert.equal(snapshot.alertsActiveCount, 3);
  assert.equal(snapshot.kbygCommunityCount, 3);
  assert.equal(snapshot.communityPulseActiveCount, 3);
  assert.equal(snapshot.communityPulseSelectedCount, 3);
  assert.match(snapshot.locationIssueLine, /3 roadway issues nearby/);
  assert.ok(!snapshot.alerts.includes('gridly-test-lp24448a-'));
  const historicalIsolation = await page.evaluate(() => ({
    sourcesContainFixture: JSON.stringify(gridlyHistoricalProjectionCurrentSources()).includes('gridly-test-lp24448a-'),
    projectionContainsFixture: JSON.stringify(gridlyGenerateHistoricalProjection('lp24448a-browser')).includes('gridly-test-lp24448a-')
  }));
  assert.deepEqual(historicalIsolation, { sourcesContainFixture: false, projectionContainsFixture: false });
  evidence.historicalIsolation = historicalIsolation;
  evidence.scenarios.push({ name: 'Multiple hazards', multi, snapshot });
  for (const width of [320, 360, 390, 440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.screenshot({ path: `${output}/multiple-hazards-${width}.png` });
    const portrait = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
      markers: document.querySelectorAll('.leaflet-marker-icon').length,
      alertsOverflow: (() => { const el = document.getElementById('alertsList'); return el ? el.scrollWidth > el.clientWidth + 2 : false; })() }));
    assert.ok(portrait.scrollWidth <= width + 2, JSON.stringify(portrait));
    evidence.portraits.push(portrait);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await choose('Crosby');
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().placeName === 'Crosby' && gridlyCrossingInventoryCountyId === 'harris-tx');
  assert.equal((await state()).activeHazards.length, 0);
  await choose('Dayton');
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().placeName === 'Dayton' && gridlyCrossingInventoryCountyId === 'liberty-tx');
  await page.waitForFunction(() => activeHazards.filter((item) => item.gridlyLocalTestOnly).length === 3);
  evidence.scenarios.push({ name: 'Active fixtures survive Search county round trip', snapshot: await state() });
  const confirmed = await actOnPopup(first.id, 'confirm');
  assert.equal(confirmed.state, 'confirmed active');
  assert.equal(confirmed.reportCount, 2);
  const cleared = await actOnPopup(first.id, 'cleared');
  assert.equal(cleared.state, 'cleared');
  assert.ok(!(await state()).activeHazards.includes(first.id));
  assert.equal((await state()).markerCount, 2, 'Clearing one condition must remove exactly one marker');
  assert.equal((await state()).alertsActiveCount, 2);
  assert.equal((await state()).communityPulseActiveCount, 2);
  assert.equal((await state()).communityPulseSelectedCount, 2);
  assert.match((await state()).locationIssueLine, /2 roadway issues nearby/);
  evidence.scenarios.push({ name: 'Confirm and clear', confirmed, cleared, snapshot: await state() });

  await page.waitForFunction(() => crossings.length > 0);
  const crossing = await page.evaluate(() => {
    const item = findNearestCrossings(map.getCenter().lat, map.getCenter().lng, 1)[0];
    return { id: item?.id, lat: item?.lat, lng: item?.lng };
  });
  assert.ok(crossing.id);
  const train = await page.evaluate((id) => gridlyLocalTestReports.add('train-blocking-crossing', { crossingId: id }), crossing.id);
  snapshot = await state();
  assert.ok(snapshot.activeReports.includes(train.id), JSON.stringify(snapshot));
  const crossingActive = await page.evaluate((id) => {
    const marker = crossingMarkers.get(id);
    const incident = getUnifiedIncidents().find((item) => item.id === `rail-${id}`);
    const icon = marker?.options?.icon?.options?.html || marker?.options?.icon?.options?.iconUrl || '';
    const popup = incident ? buildUnifiedIncidentPopup(incident) : '';
    return { asset: String(icon).match(/assets\/markers\/approved\/[^"'\s]+\.png/)?.[0] || '', popupIsConsumer: popup.includes('data-gridly-crossing-popup="consumer"'), hasConfirm: popup.includes('data-unified-action="confirm"') };
  }, crossing.id);
  assert.equal(crossingActive.popupIsConsumer, true);
  assert.equal(crossingActive.hasConfirm, true);
  const trainConfirmed = await actOnPopup(train.id, 'confirm');
  assert.equal(trainConfirmed.state, 'confirmed active');
  await page.screenshot({ path: `${output}/crossing-active.png` });
  const trainCleared = await actOnPopup(train.id, 'cleared');
  assert.ok(!(await state()).activeReports.includes(train.id));
  const crossingNeutral = await page.evaluate((id) => {
    const marker = crossingMarkers.get(id);
    const icon = marker?.options?.icon?.options?.html || marker?.options?.icon?.options?.iconUrl || '';
    return { asset: String(icon).match(/assets\/markers\/approved\/[^"'\s]+\.png/)?.[0] || '', latest: getLatestReportForCrossing(id)?.id || null };
  }, crossing.id);
  assert.notEqual(crossingActive.asset, crossingNeutral.asset, 'Crossing marker did not return to neutral state');
  evidence.scenarios.push({ name: 'Governed crossing active and cleared', crossing, train, trainConfirmed, trainCleared, crossingActive, crossingNeutral, snapshot: await state() });
  const delay = await page.evaluate((id) => gridlyLocalTestReports.add('reported-crossing-delay', { crossingId: id }), crossing.id);
  await page.waitForFunction((id) => String(crossingMarkers.get(id)?.options?.icon?.options?.html || '').includes('23-reported-crossing-delay.png'), crossing.id, { timeout: 15000 });
  const delayAsset = await page.evaluate((id) => {
    const icon = crossingMarkers.get(id)?.options?.icon?.options?.html || '';
    return String(icon).match(/assets\/markers\/approved\/[^"'\s]+\.png/)?.[0] || '';
  }, crossing.id);
  assert.ok(delayAsset.endsWith('23-reported-crossing-delay.png'), delayAsset);
  await page.evaluate((id) => gridlyLocalTestReports.clearOne(id), delay.id);
  evidence.scenarios.push({ name: 'Governed crossing delay', delay, delayAsset });

  const beforeClear = await state();
  const clearAll = await page.evaluate(() => gridlyLocalTestReports.clear());
  snapshot = await state();
  assert.equal(snapshot.fixtures.length, 0);
  assert.equal(snapshot.activeHazards.length, 0);
  assert.equal(snapshot.activeReports.length, 0);
  evidence.scenarios.push({ name: 'Clear all', beforeClear, clearAll, after: snapshot });
  const productionShaped = await page.evaluate(() => {
    const center = map.getCenter();
    const id = 'lp24448b-production-shaped-' + Date.now();
    const [record] = normalizeReports([{ id, report_type: 'debris', crossing_id: `hazard-${id}`,
      lat: center.lat, lng: center.lng, county_id: gridlyGetActiveCountyId(), created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 4 * 60 * 60000).toISOString(), severity: 'moderate',
      detail: 'Shared report: debris in road.', source: 'user' }]);
    activeHazards.push(record);
    refreshReportHazardViews('lp24448b-production-shaped');
    const during = { id, markerCount: unifiedIncidentLayer.getLayers().length,
      markerIds: unifiedIncidentLayer.getLayers().map((layer) => layer.options.incidentId),
      groupedCount: getLiveHazardIncidents().filter((item) => item.reports.some((report) => report.id === id)).length };
    activeHazards = activeHazards.filter((item) => item.id !== id);
    refreshReportHazardViews('lp24448b-production-shaped-clear');
    return { ...during, afterClearMarkerCount: unifiedIncidentLayer.getLayers().length };
  });
  assert.equal(productionShaped.groupedCount, 1);
  assert.equal(productionShaped.markerCount, 1);
  assert.equal(productionShaped.afterClearMarkerCount, 0);
  evidence.scenarios.push({ name: 'Production-shaped normalized report parity', productionShaped });
  assert.deepEqual(await homeBytes(), originalHome);
  await choose('Crosby');
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().placeName === 'Crosby' && gridlyCrossingInventoryCountyId === 'harris-tx');
  const searchFixture = await page.evaluate(() => gridlyLocalTestReports.addAtMapCenter('road-blocked'));
  assert.equal((await state()).context, 'SEARCH');
  assert.ok((await state()).activeHazards.includes(searchFixture.id));
  assert.deepEqual(await homeBytes(), originalHome);
  await page.evaluate(() => gridlyLocalTestReports.clear());
  evidence.scenarios.push({ name: 'Search context preserved', searchFixture, context: (await state()).context });

  await context.setGeolocation({ latitude: 29.91154, longitude: -95.06325 });
  await page.locator('#mobileDestinationCommandBtn').click();
  await page.getByRole('button', { name: 'Around Me', exact: true }).click();
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().type === 'AROUND_ME');
  await page.waitForFunction(() => gridlyGetActiveCountyId() === 'harris-tx' &&
    Math.abs(map.getCenter().lat - 29.91154) < 0.01 && Math.abs(map.getCenter().lng + 95.06325) < 0.01);
  const aroundFixture = await page.evaluate(() => gridlyLocalTestReports.addAtMapCenter('disabled-vehicle'));
  assert.equal((await state()).context, 'AROUND_ME');
  assert.ok((await state()).activeHazards.includes(aroundFixture.id));
  assert.deepEqual(await homeBytes(), originalHome);
  await page.evaluate(() => gridlyLocalTestReports.clear());
  await page.locator('#gridlyTemporaryContextReturnHome').click();
  assert.equal((await state()).context, 'HOME');
  evidence.scenarios.push({ name: 'Around Me and Return Home preserved', aroundFixture, context: (await state()).context });

  const routeProof = await page.evaluate(async () => {
    await renderRoutePreviewLine({ lat: 30.0466, lng: -94.8852 }, { lat: 30.055, lng: -94.88 });
    routeWatchActivated = true;
    window.__gridlyRouteWatchActive = true;
    const geometryBefore = JSON.stringify(window.__gridlyRoutePreviewLayer.getLatLngs());
    const sourceBefore = JSON.stringify(routeWatchSourceHazards);
    const fixture = gridlyLocalTestReports.addAtMapCenter('debris-in-road');
    const during = { routeWatchActivated, geometryUnchanged: JSON.stringify(window.__gridlyRoutePreviewLayer.getLatLngs()) === geometryBefore,
      sourceUnchanged: JSON.stringify(routeWatchSourceHazards) === sourceBefore, fixture };
    gridlyLocalTestReports.clear();
    stopGridlyRouteWatch('lp24448a-browser');
    return during;
  });
  assert.equal(routeProof.routeWatchActivated, true);
  assert.equal(routeProof.geometryUnchanged, true);
  assert.equal(routeProof.sourceUnchanged, true);
  evidence.scenarios.push({ name: 'Route Watch geometry and source preserved', routeProof });
  assert.deepEqual(await homeBytes(), originalHome);
  const persistence = await page.evaluate(() => ({
    localStorageContainsFixture: Object.keys(localStorage).some((key) => String(localStorage.getItem(key)).includes('gridly-test-lp24448a-')),
    sessionStorageContainsFixture: Object.keys(sessionStorage).some((key) => String(sessionStorage.getItem(key)).includes('gridly-test-lp24448a-')),
    historicalProjectionContainsFixture: JSON.stringify(gridlyHistoricalProjection || {}).includes('gridly-test-lp24448a-')
  }));
  assert.deepEqual(persistence, { localStorageContainsFixture: false, sessionStorageContainsFixture: false, historicalProjectionContainsFixture: false });
  evidence.persistence = persistence;
  assert.equal(await page.evaluate(() => window.__lp24448aOperationCalls), 0);
  assert.equal(mutationRequests.filter((item) => item.phase === 'fixture').length, 0, JSON.stringify(mutationRequests));
  phase = 'reload';
  await page.reload();
  await page.waitForFunction(() => typeof window.gridlyLocalTestReports?.list === 'function');
  assert.deepEqual(await page.evaluate(() => gridlyLocalTestReports.list()), []);
  const productionMutations = mutationRequests.filter(({ url }) => !url.endsWith('/rpc/get_community_reporting_status'));
  assert.equal(productionMutations.length, 0, JSON.stringify(productionMutations));
  assert.equal(errors.length, 0, errors.join('\n'));
  fs.writeFileSync('reports/lp24448a-browser.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ scenarios: evidence.scenarios.map((item) => item.name), portraits: evidence.portraits, mutationRequests, errors, warnings: warnings.length }));
} finally {
  fs.writeFileSync(`${output}/partial.json`, JSON.stringify(evidence, null, 2));
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
