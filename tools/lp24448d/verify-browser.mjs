import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const root = process.cwd();
const output = '.artifacts/lp24448d';
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
const coords = [
  { kind: 'flooded-roadway', lat: 30.047253308692213, lng: -94.88737106323242, location: 'Cook Street and Church Street' },
  { kind: 'debris-in-road', lat: 30.0505, lng: -94.889, location: 'Winfree Street and Flowers Street' },
  { kind: 'downed-power-line', lat: 30.0435, lng: -94.8815, location: 'Hope Street and Nancy Street' }
];
const records = [];
const capture = () => page.evaluate(() => {
  const hazards = activeHazards.filter(x => x.gridlyLocalTestOnly);
  const alerts = getAlertsSurfaceSnapshot().alerts.filter(x => x.gridlyLocalTestOnly || x.raw?.gridlyLocalTestOnly);
  const cards = [...document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]')]
    .map(x => ({ id: x.dataset.gridlyLp236ConditionId, lat: Number(x.dataset.gridlyAlertLat), lng: Number(x.dataset.gridlyAlertLng), location: x.dataset.gridlyAlertLocation, text: x.textContent }));
  return {
    fixtures: gridlyLocalTestReports.list().length,
    hazards: hazards.map(x => ({ id:x.id,lat:x.lat,lng:x.lng,rawRoad:x.raw?.road,
      popup:buildGridlyHazardPopupConsumerModel(x).locationLine })),
    alerts: alerts.map(x => ({id:x.id,lat:x.lat,lng:x.lng,roadName:x.roadName,crossStreet:x.crossStreet,
      resolvedLocation:x.resolvedLocation,authority:x.selectedLocationAuthority,
      consumer:buildGridlyAlertCardConsumerModel(x).locationLine })),
    cards,
    grouped: getLiveHazardIncidents().filter(x=>x.latestReport?.gridlyLocalTestOnly).map(x=>x.key),
    markers: unifiedIncidentLayer?.getLayers?.().map(x=>x?.options?.incidentId).filter(Boolean) || [],
    kbygCommunityCount: gridlyGetGovernedConsumerProjection()?.surfaces?.kbygCommunity?.length || 0,
    communityPulseActiveCount: gridlyCommunityPulseAuditState?.activeAwareness?.activeAwarenessCount || 0,
    locationIssueLine: document.getElementById('mobileAwarenessPanelIssues')?.textContent || '',
    context: {type:gridlyGetCurrentAwarenessContext().type,placeName:gridlyGetCurrentAwarenessContext().placeName},
    header:document.querySelector('[data-gridly-lp236-alerts] .gridly-lp236-header')?.innerText || '',
    home:localStorage.getItem('gridlySavedPlacesV1'),
    overflow:document.documentElement.scrollWidth > innerWidth + 1,
    backend:gridlyLastReportRetrievalDiagnostic && {status:gridlyLastReportRetrievalDiagnostic.finalStatus,rowCount:gridlyLastReportRetrievalDiagnostic.rowCount}
  };
});
const find = (rows, expected) => rows.find(x => Math.abs(x.lat-expected.lat)<0.00000001 && Math.abs(x.lng-expected.lng)<0.00000001);
async function verify(stage, expectedCoords = coords) {
  const state = await capture();
  records.push({stage,state});
  assert.equal(state.fixtures, expectedCoords.length, `${stage}: fixture count`);
  assert.equal(state.hazards.length, expectedCoords.length, `${stage}: normalized reports`);
  assert.equal(state.alerts.length, expectedCoords.length, `${stage}: Alerts rows`);
  assert.equal(state.cards.length, expectedCoords.length, `${stage}: cards`);
  assert.equal(new Set(state.cards.map(x=>x.id)).size, expectedCoords.length, `${stage}: unique cards`);
  assert.equal(new Set(state.grouped).size, expectedCoords.length, `${stage}: unique grouped incidents`);
  assert.equal(state.markers.length, expectedCoords.length, `${stage}: logical markers`);
  assert.equal(new Set(state.markers).size, expectedCoords.length, `${stage}: unique marker owners`);
  assert.equal(state.kbygCommunityCount, expectedCoords.length, `${stage}: KBYG count`);
  assert.equal(state.communityPulseActiveCount, expectedCoords.length, `${stage}: Community Pulse count`);
  assert.match(state.locationIssueLine, /3 roadway issues nearby/, `${stage}: Location Context count`);
  assert.equal(state.overflow, false, `${stage}: overflow`);
  assert.match(state.header, /3 current conditions|3 active conditions/, `${stage}: visible count`);
  for (const expected of expectedCoords) {
    const hazard = find(state.hazards,expected), alert = find(state.alerts,expected), card = find(state.cards,expected);
    assert.ok(hazard && alert && card, `${stage}: ${expected.kind} identity`);
    assert.equal(hazard.rawRoad ?? null, null, `${stage}: no fixture road supplied`);
    assert.equal(hazard.popup, expected.location, `${stage}: popup road`);
    assert.equal(alert.resolvedLocation, expected.location, `${stage}: projected road`);
    assert.equal(alert.authority, 'canonicalRoadContext', `${stage}: incident authority`);
    assert.equal(card.location, expected.location, `${stage}: card location`);
    assert.ok(card.text.includes(expected.location), `${stage}: visible card text`);
  }
  return state;
}
const searchDayton = () => page.evaluate(async () => { const r=(await gridlySearchAddress('Dayton',{limit:5}))[0]; selectGridlySearchResult(r); closeGridlyDestinationSearchSurface(); });
const add = values => page.evaluate(values => {for(const x of values) gridlyLocalTestReports.add(x.kind,{lat:x.lat,lng:x.lng});},values);
try {
  await page.goto(origin);
  await page.waitForFunction(() => typeof window.gridlyLocalTestReports?.add === 'function' && typeof window.gridlySearchAddress === 'function');
  await page.evaluate(() => { gridlySubmitCommunityOperation=async()=>{throw Error('Production mutation path reached')}; });
  await searchDayton();
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().placeName === 'Dayton');
  const home = await page.evaluate(() => localStorage.getItem('gridlySavedPlacesV1'));
  await add(coords);
  await page.locator('#gridlyAlertsDockButton').click();
  await page.waitForFunction(() => document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]').length === 3);
  await verify('initial_dayton');
  await page.waitForFunction(() => (gridlyRefreshAuditState.refreshSourceCounts?.['loadSharedReports:alerts_open_background_refresh']||0)>=1);
  await verify('first_background_refresh');
  await page.evaluate(() => {void loadSharedReports('alerts_open_background_refresh_lp24448d_second');});
  await page.waitForTimeout(80);
  await verify('second_background_refresh_loading');
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED');
  await verify('second_background_refresh_complete');
  for(const width of [320,360,390,440]) {
    await page.setViewportSize({width,height:844});
    await verify(`portrait_${width}`);
    await page.screenshot({path:path.join(output,`alerts-${width}.png`),fullPage:true});
  }
  await page.evaluate(() => gridlyLocalTestReports.clear());
  await page.waitForFunction(() => document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]').length === 0);
  await add([...coords].reverse());
  await page.waitForFunction(() => document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]').length === 3);
  await verify('reversed_insertion');
  await page.evaluate(() => {void loadSharedReports('alerts_open_background_refresh_lp24448d_reordered');});
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED');
  await verify('reordered_after_refresh');
  await page.evaluate(() => gridlyActivateForegroundAwarenessContext({timestamp:Date.now(),coords:{latitude:30.0466,longitude:-94.8852,accuracy:20}}));
  await page.waitForFunction(() => gridlyGetCurrentAwarenessContext().type === 'AROUND_ME');
  await page.evaluate(() => gridlySynchronizeOpenAlertsPortrait('lp24448d-around-me'));
  await page.waitForFunction(() => document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]').length === 3);
  await verify('around_me');
  assert.equal((await capture()).home,home,'Home persisted');
  await page.evaluate(() => gridlyLocalTestReports.clear());
  await page.waitForFunction(() => document.querySelectorAll('[data-gridly-lp236-alerts] [data-gridly-lp236-condition-id]').length === 0);
  await searchDayton();
  backendRows=[{id:'lp24448d-production-row',report_type:'flooding',crossing_id:'hazard-lp24448d-production-row',lat:coords[0].lat,lng:coords[0].lng,county_id:'liberty-tx',created_at:new Date().toISOString(),expires_at:new Date(Date.now()+14400000).toISOString(),severity:'moderate',detail:'Production shaped flooded roadway',source:'user'}];
  await page.evaluate(() => {void loadSharedReports('lp24448d_production_row');});
  await page.waitForFunction(() => gridlyLastReportRetrievalDiagnostic?.finalStatus === 'SUCCEEDED' && gridlyLastReportRetrievalDiagnostic.rowCount === 1);
  const production=await page.evaluate(() => {const row=activeHazards.find(x=>x.id==='lp24448d-production-row');const alert=getAlertsSurfaceSnapshot().alerts.find(x=>x.id==='lp24448d-production-row');const card=[...document.querySelectorAll('[data-gridly-lp236-condition-id]')].find(x=>Math.abs(Number(x.dataset.gridlyAlertLat)-30.047253308692213)<0.00000001);return {row:row&&{id:row.id,local:row.gridlyLocalTestOnly,popup:buildGridlyHazardPopupConsumerModel(row).locationLine},alert:alert&&{id:alert.id,location:alert.resolvedLocation},card:card&&{location:card.dataset.gridlyAlertLocation,text:card.textContent}}});
  assert.equal(production.row?.local,undefined);
  assert.equal(production.row?.popup,coords[0].location);
  assert.equal(production.alert?.location,coords[0].location);
  assert.equal(production.card?.location,coords[0].location);
  assert.equal(mutationRequests.filter(x=>x.url.includes('/rest/v1/reports')).length,0);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify({records,production,backendReads,mutationRequests,errors,warnings},null,2));
  console.log(JSON.stringify({pass:true,stages:records.map(x=>x.stage),production,backendReads:backendReads.length,mutationRequests,warnings}));
} catch(error) {
  fs.writeFileSync(path.join(output,'verification-failure.json'),JSON.stringify({error:String(error.stack||error),records,backendReads,mutationRequests,errors,warnings},null,2));
  throw error;
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}

