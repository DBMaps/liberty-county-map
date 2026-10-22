// Controlled read-only browser fixtures. Called by the audit replay after profiling.
const fs = require('node:fs');
const assert = require('node:assert/strict');
module.exports = async function verifyRuntime({ page, c, phase, origin }) {
  page.setDefaultTimeout(120000);
  const dir = process.env.REPAIR_OUTPUT_DIR || '.artifacts/community-loading-integration-v1';
  const evidence = { phase, case: c.name, states: [], checks: {}, errors: [] };
  const activePopup = process.env.REPAIR_ACTIVE_POPUP === '1';
  const write = () => fs.writeFileSync(`${dir}/${phase}-${c.name}-${activePopup ? 'active-popup' : 'functional'}.json`, JSON.stringify(evidence, null, 2));
  let reports = [], weatherActive = true, roadUnavailable = false;
  let weatherAlertFailure = false, weatherForecastFailure = false, weatherCancellation = false, weatherExpiry = null;
  const anchor = await page.evaluate(() => ({ ...gridlyGetCurrentAwarenessContext(), fips: GRIDLY_COUNTY_REGISTRY[gridlyGetActiveCountyId()].countyFips, countyName: gridlyGetActiveCountyConfig().name }));
  anchor.fips = anchor.fips || JSON.parse(fs.readFileSync('data/lp149/runtime-county-registry.json', 'utf8')).identities.find(row => row.countyId === c.county).fips;
  const stamp = new Date().toISOString();
  const crossing = await page.evaluate(activePopup => {
    if (activePopup) {
      const visible = [...crossingMarkers].map(([id]) => crossings.find(c => c.id === id)).find(c => c && isGridlyReportableCrossing(c));
      if (visible) return visible;
    }
    return gridlySelectConsumerVisibleCrossings(getGridlySelectedAwarenessArea()).find(isGridlyReportableCrossing) || null;
  }, activePopup);
  const hazard = { id: 'audit-community-hazard', report_type: 'flooded-roadway', crossing_id: 'hazard-audit-community-hazard', crossing_name: 'Audit flooding', railroad: 'Road hazard', lat: anchor.lat, lng: anchor.lng, county_id: c.county, created_at: stamp, expires_at: new Date(Date.now() + 3600000).toISOString(), severity: 'high', detail: 'Controlled test report', source: 'user', confidence: 'shared live report', device_id: null };
  const rail = crossing ? { ...hazard, id: 'audit-community-rail', report_type: 'blocked', crossing_id: crossing.id, crossing_name: crossing.name, lat: crossing.lat, lng: crossing.lng, railroad: crossing.railroad } : null;
  const roadPayload = { type: 'FeatureCollection', features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [anchor.lng, anchor.lat] }, properties: { id: 'AUDIT-NEARBY-ROAD', OBJECTID: 900001, roadway: 'US 90', description: 'Road closed due to flooding', eventType: 'Closure', county: anchor.countyName.replace(/ County$/, ''), startTime: stamp, endTime: new Date(Date.now() + 3600000).toISOString() } },
    { type: 'Feature', geometry: { type: 'Point', coordinates: [anchor.lng + 0.45, anchor.lat + 0.45] }, properties: { id: 'AUDIT-COUNTY-ROAD', OBJECTID: 900002, roadway: 'FM 1960', description: 'Road closed due to flooding', eventType: 'Closure', county: anchor.countyName.replace(/ County$/, ''), startTime: stamp, endTime: new Date(Date.now() + 3600000).toISOString() } }
  ] };
  await page.route('**/__audit-drive', route => roadUnavailable ? route.fulfill({ status: 503, body: 'Controlled unavailable source' }) : route.fulfill({ contentType: 'application/geo+json', body: JSON.stringify(roadPayload) }));
  await page.route('https://api.weather.gov/gridpoints/**/forecast', route => weatherForecastFailure ? route.fulfill({status:503,body:'Controlled forecast failure'}) : route.fallback());
  await page.route('https://api.weather.gov/alerts/active?point=*', route => weatherAlertFailure ? route.fulfill({status:503,body:'Controlled alert failure'}) : route.fulfill({ contentType: 'application/geo+json', body: JSON.stringify({ type: 'FeatureCollection', features: weatherActive ? [{ type: 'Feature', id: 'AUDIT-NWS-COUNTYWIDE', geometry: { type: 'Polygon', coordinates: [[[-107, 25], [-93, 25], [-93, 37], [-107, 37], [-107, 25]]] }, properties: { id: 'AUDIT-NWS-COUNTYWIDE', event: 'Flash Flood Warning', headline: 'Controlled countywide warning', description: 'Controlled warning includes this community', status: 'Actual', messageType: weatherCancellation ? 'Cancel' : 'Alert', severity: 'Severe', certainty: 'Observed', urgency: 'Immediate', effective: stamp, sent: stamp, onset: stamp, expires: weatherExpiry || new Date(Date.now() + 3600000).toISOString(), areaDesc: anchor.countyName, affectedZones: [`https://api.weather.gov/zones/county/TXC${anchor.fips.slice(2)}`], geocode: { UGC: [`TXC${anchor.fips.slice(2)}`], SAME: [`0${anchor.fips}`] } } }] : [] }) }));
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(reports) }));
  const settle = async ({requireHealthyWeather=false}={}) => {
    await page.evaluate(async requireHealthyWeather => {
      await gridlyAwaitActiveCountyCrossingInventoryLoad('performance-repair-verification');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      // Resolving a changed point can queue its first request after an audit
      // reports no current request. Await that real context-qualified owner.
      // Do not republish an already checked context just to take a snapshot.
      const weather = gridlyWeatherConnectorRuntimeAudit();
      if (weather.governedWeatherPointAvailable && !weather.requestAttempted) await gridlyWeatherConnector.refreshAwarenessView();
      // Compare settled provider authority, not two different points in the
      // normal loading -> fresh transition after an explicit location change.
      // Await the actual context-qualified transaction. The original ten-second
      // harness poll was shorter than even one source's two eight-second retries.
      if (gridlyWeatherConnectorRuntimeAudit().requestInFlight) await gridlyWeatherConnector.refreshAwarenessView();
      if (gridlyWeatherConnectorRuntimeAudit().requestInFlight) throw new Error('Controlled weather authority did not settle');
      const settledWeather = gridlyWeatherConnectorRuntimeAudit();
      // Healthy-state parity is separate from failure injection. A production
      // baseline main-thread stall can abort an otherwise healthy local fixture.
      // After other work settles, permit one real retry; never change timeouts,
      // fabricate success or apply this retry to explicit NWS failure scenarios.
      if (requireHealthyWeather && settledWeather.governedWeatherPointAvailable && !settledWeather.freshEnough) await gridlyWeatherConnector.fetchNow();
      await new Promise(r => requestAnimationFrame(r));
    }, requireHealthyWeather);
  };
  const capture = async label => {
    console.log('functional capture start', phase, c.name, label);
    await settle({requireHealthyWeather:true});
    const state = await page.evaluate(label => {
      const projection = gridlyGetGovernedConsumerProjection(), summary = buildGridlyCommunityAwarenessIntelligenceSummary();
      const alerts = getAlertsSurfaceSnapshot();
      return { label, context: gridlyGetCurrentAwarenessContext(), area: getGridlySelectedAwarenessArea(), inventoryIds: crossings.map(x => x.id), consumerIds: gridlySelectConsumerVisibleCrossings(getGridlySelectedAwarenessArea()).map(x => x.id), surfaces: Object.fromEntries(Object.entries(projection.surfaces).map(([k, rows]) => [k, rows.map(r => ({ id: r.evidenceId, sourceId: r.record.id, county: r.record.countyId || r.record.county_id, lat: r.record.lat, lng: r.record.lng, kind: r.record.sourceKind, status: r.record.status, sourceProviderRecordId: r.record.sourceProviderRecordId }))])), summary: { name: summary.awarenessAreaName, reports: summary.activeReportsInArea.map(r => r.id), hazards: summary.activeHazardsInArea.map(r => r.id), inputRevision: summary.awarenessInputRevision, reusable: isGridlyCachedAwarenessSummaryForCurrentArea(summary) }, authority: gridlyReadAlertsFamilyAuthority(), alertIds: alerts.alerts.map((r, i) => gridlyAlertWriterRecordId(r, i)), driveAll: gridlyDriveTexasConnector.getAllNormalizedRecords().map(r => ({ id: r.id, source: r.sourceProviderRecordId, lat: r.lat, lng: r.lng })), weather: { ids: gridlyWeatherConnector.getNormalizedRecords().map(r => r.id), fresh: gridlyWeatherConnectorRuntimeAudit().freshEnough }, camera: { center: map.getCenter(), zoom: map.getZoom() }, ui: { noOverflow: document.documentElement.scrollWidth <= innerWidth, portrait: document.body.dataset.layoutMode, missingLabel: document.body.innerText.includes('undefinedm'), issues: document.getElementById('mobileAwarenessPanelIssues')?.innerText }, hydration: window.gridlyCrossingHydrationTrace() };
    }, label);
    assert.equal(state.authority.weather.runtimeAuthority.requestInFlight, false, `${label}: captured weather authority is still loading`);
    evidence.states.push(state); write(); console.log('functional capture complete',phase,c.name,label,JSON.stringify(state.weather)); return state;
  };
  try {
    console.log('functional fixture setup', phase, c.name);
    await page.evaluate(origin => { GRIDLY_CONFIG.driveTexas = { ...GRIDLY_CONFIG.driveTexas, apiKey: 'LOCAL-AUDIT-NOT-A-CREDENTIAL', endpointTemplate: origin + '/__audit-drive' }; gridlyDriveTexasConnector.stopPolling(); gridlyWeatherConnector.stopPolling(); }, origin);
    reports = [hazard, ...(rail ? [rail] : [])];
    await page.evaluate(async () => { await Promise.all([gridlyDriveTexasConnector.fetchNow(), loadSharedReports('manual_refresh')]); gridlyRefreshUnifiedAwarenessContext('performance-repair-active-fixtures'); });
    await settle();
    console.log('functional report/road setup settled',phase,c.name);
    await page.evaluate(() => gridlyWeatherConnector.fetchNow());
    const active = await capture('active');
    assert.equal(active.driveAll.length, 2, 'complete provider snapshot retains nearby and more distant county records');
    assert.ok(active.weather.fresh && active.weather.ids.includes('AUDIT-NWS-COUNTYWIDE'), 'fresh countywide warning retained');
    assert.ok(active.summary.hazards.includes(hazard.id), 'community hazard retained at its governed coordinate');
    if (rail) assert.ok(active.summary.reports.includes(rail.id), 'governed crossing report retained');
    assert.ok(active.surfaces.alerts.some(r => /AUDIT-NEARBY-ROAD/.test(r.id)), 'nearby official roadway reaches Alerts');
    assert.ok(active.surfaces.alerts.some(r => /AUDIT-NWS-COUNTYWIDE/.test(r.id)), 'countywide NWS warning reaches Alerts');
    evidence.checks.safetyActive = true;
    await page.screenshot({ path: `${dir}/${phase}-${c.name}-active-portrait.png` });
    if (await page.locator('#gridlyPortraitV2SheetClose').isVisible()) await page.locator('#gridlyPortraitV2SheetClose').click();
    const popup = await page.evaluate(async targetId => {
      const pair = [...crossingMarkers].find(([id, marker]) => (!targetId || id === targetId) && marker.getElement()?.isConnected);
      if (!pair) return { skipped: 'No crossing marker in initial viewport' };
      const [id, marker] = pair, crossing = crossings.find(x => x.id === id);
      const start = performance.now(); marker.fire('click'); const synchronousMs = performance.now() - start;
      const deadline = performance.now() + 5000;
      while (!isGridlyCrossingPopupVisible(marker) && performance.now() < deadline) await new Promise(r => setTimeout(r, 25));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const paintMs = performance.now() - start;
      const content = String(marker.getPopup().getContent()), expected = buildPopup(crossing, getLatestReportForCrossing(id));
      const fields = html => { const d = new DOMParser().parseFromString(html, 'text/html'); return [...d.querySelectorAll('[data-gridly-crossing-popup-field]')].map(n => [n.dataset.gridlyCrossingPopupField, n.textContent]); };
      const result = { id, county: marker.options.gridlyCountyId, synchronousMs, paintMs, fields: fields(content), expected: fields(expected), open: isGridlyCrossingPopupVisible(marker) };
      map.closePopup(); return result;
    }, activePopup ? rail.crossing_id : null);
    evidence.popup = popup;
    if (!popup.skipped) { assert.deepEqual(popup.fields, popup.expected); assert.equal(popup.open, true); assert.equal(popup.county, c.county); }
    if (activePopup) { assert.equal(popup.id, rail.crossing_id); assert.ok(popup.fields.some(([field, text]) => field === 'title' && /blocked/i.test(text))); evidence.checks.activePopup = true; write(); return evidence; }
    reports = [];
    evidence.clearRetrieval = await page.evaluate(async () => {
      await gridlyNetworkAuditState.loadSharedReports.inFlightPromise;
      const before = gridlyReportReadPresentationState.revision;
      // This fixture changed the source. Reusing the preceding manual_refresh
      // reason can correctly dedupe a second read in a fast small county.
      await loadSharedReports('performance_repair_fixture_cleared');
      gridlyOfficialProviderConsumerRefresh({ providerId: 'drivetexas', reason: 'interval_live_refresh' });
      return { before, after: gridlyReportReadPresentationState.revision, state: gridlyCurrentReportReadState(), reportIds: activeReports.map(r => r.id), hazardIds: activeHazards.map(r => r.id) };
    });
    assert.ok(evidence.clearRetrieval.after > evidence.clearRetrieval.before, 'clearing fixture performed a new authoritative report read');
    assert.equal(evidence.clearRetrieval.state, 'succeeded');
    assert.ok(!evidence.clearRetrieval.hazardIds.includes(hazard.id) && (!rail || !evidence.clearRetrieval.reportIds.includes(rail.id)), 'clearing fixture reached the authoritative input collections');
    const cleared = await capture('community-cleared');
    assert.ok(!cleared.summary.hazards.includes(hazard.id) && (!rail || !cleared.summary.reports.includes(rail.id)), 'cleared reports do not return from a shared summary');
    assert.ok(cleared.surfaces.alerts.some(r => /AUDIT-NEARBY-ROAD/.test(r.id)) && cleared.surfaces.alerts.some(r => /AUDIT-NWS-COUNTYWIDE/.test(r.id)), 'clearing community reports retains independent safety sources');
    evidence.checks.clearRetainsOfficialAndWeather = true;
    await page.evaluate(async () => { const results = await gridlySearchAddress('Dayton, Liberty County, TX'); const selected = results.find(r => r.placeGeoid === '4819432'); if (!selected) throw new Error('governed Search result missing'); selectGridlySearchResult(selected); });
    const search = await capture('search'); assert.equal(search.context.type, 'SEARCH'); assert.equal(search.context.placeId, '4819432'); assert.equal(search.context.countyId, 'liberty-tx');
    await page.evaluate(() => gridlyActivateForegroundAwarenessContext({ timestamp: Date.now(), coords: { latitude: 30.0473202, longitude: -94.8873913, accuracy: 10 } }));
    const around = await capture('around-me'); assert.equal(around.context.type, 'AROUND_ME'); assert.equal(around.context.health, 'FRESH');
    await page.evaluate(() => { const context = gridlyGetCurrentAwarenessContext(); gridlyExpireForegroundAwarenessContext(context, context.expiresAt + 1); });
    const expired = await capture('around-me-expired'); assert.equal(expired.context.health, 'STALE');
    await page.locator('#gridlyTemporaryContextReturnHome').click({ timeout: 120000 });
    const home = await capture('return-home'); assert.equal(home.context.type, 'HOME'); assert.equal(home.context.placeId, c.placeGeoid); assert.equal(home.context.countyId, c.county);
    evidence.checks.searchAroundMeReturnHome = true;
    const route = await page.evaluate(() => {
      routeWatchActivated = true; window.__gridlyRouteWatchActive = true;
      const initial = gridlyGetCurrentAwarenessContext();
      const selection = gridlySelectSearchAwarenessContext({ id: 'ignored-selection', lat: 30.04, lng: -94.88 });
      const around = gridlyActivateForegroundAwarenessContext({ timestamp: Date.now(), coords: { latitude: 30.04, longitude: -94.88 } });
      routeWatchActivated = false; window.__gridlyRouteWatchActive = false;
      return { type: initial.type, selectionOwnedByRoute: selection === initial, aroundIgnored: around === null, home: gridlyGetCurrentAwarenessContext().type };
    });
    assert.deepEqual(route, { type: 'ROUTE_WATCH', selectionOwnedByRoute: true, aroundIgnored: true, home: 'HOME' }); evidence.checks.routeWatchContext = true;
    // Multiple selections in one turn ensure old county requests complete late.
    if (c.name === 'Dayton') {
      await page.evaluate(async () => {
        const all = await Promise.all(['Crosby, Harris County, TX', 'Coldspring, San Jacinto County, TX', 'Dayton, Liberty County, TX'].map(q => gridlySearchAddress(q)));
        for (const results of all) selectGridlySearchResult(results.find(r => r.placeGeoid));
      });
      const raced = await capture('fast-county-switch'); assert.equal(raced.context.countyId, 'liberty-tx'); assert.equal(raced.context.placeId, '4819432');
      assert.ok(raced.inventoryIds.length === 115); evidence.checks.fastCountySwitch = true;
      await page.evaluate(() => gridlyClearTemporaryAwarenessContext());
    }
    roadUnavailable = true;
    // This checkpoint compares unavailable roads with explicitly fresh weather;
    // otherwise the slow baseline can age a prior weather check past its TTL
    // while the faster candidate still observes that same check as fresh.
    await page.evaluate(async () => { await gridlyDriveTexasConnector.fetchNow(); await gridlyWeatherConnector.fetchNow(); });
    const unavailable = await capture('road-source-unavailable');
    assert.equal(unavailable.authority.official_roadway.available, false); assert.ok(unavailable.weather.ids.includes('AUDIT-NWS-COUNTYWIDE'));
    evidence.checks.failureIsNotQuiet = true;
    weatherActive = false; roadUnavailable = false;
    await page.evaluate(async () => { await Promise.all([gridlyDriveTexasConnector.fetchNow(), gridlyWeatherConnector.fetchNow()]); });
    const weatherClear = await capture('weather-cleared'); assert.deepEqual(weatherClear.weather.ids, []); assert.ok(weatherClear.surfaces.alerts.some(r => /AUDIT-NEARBY-ROAD/.test(r.id)));
    evidence.checks.weatherClearRetainsRoad = true;
    evidence.checks.portrait = evidence.states.every(s => s.ui.noOverflow && !s.ui.missingLabel);
    if (process.env.REPAIR_NWS_CHECKS === '1' && phase === 'after') evidence.nws = await require('./verify-nws.cjs')({page,caseName:c.name,settle,setAlertFailure:v=>{weatherAlertFailure=v;},setForecastFailure:v=>{weatherForecastFailure=v;},setActive:v=>{weatherActive=v;},setCancellation:v=>{weatherCancellation=v;},setExpiry:v=>{weatherExpiry=v;}});
    assert.ok(evidence.checks.portrait); write(); return evidence;
  } catch (error) { evidence.errors.push(String(error.stack)); write(); throw error; }
};
