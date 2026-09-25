const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448g');
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
    await page.waitForFunction(() => typeof gridlyLocalTestReports === 'object' && gridlyCrossingInventoryCountyId === 'liberty-tx' && crossings.length > 0 && roadwayDatasetLoaded && gridlyGetActiveCountyId() === 'liberty-tx');
    return page;
  };
  const context = await makeContext(full);
  let tilesRecover = false;
  await context.route('https://*.tile.openstreetmap.org/**', route => tilesRecover
    ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dae4e8"/><path d="M0 128H256M128 0V256" stroke="#a7bac3" stroke-width="12"/><text x="8" y="22" fill="#405766" font-size="12">LOCAL RECOVERY FIXTURE</text></svg>' })
    : route.abort());
  const page = await openPage(context);
  await page.evaluate(() => saveGridlyHomeTownPreference('Dayton'));
  await page.screenshot({path:path.join(output,'quiet-home-390.png')});
  await page.evaluate(() => [
    gridlyLocalTestReports.add('flooded-roadway', { lat: 30.047253308692213, lng: -94.88737106323242, ageMinutes: 0 }),
    gridlyLocalTestReports.add('debris-in-road', { lat: 30.0505, lng: -94.889, ageMinutes: 5 }),
    gridlyLocalTestReports.add('downed-power-line', { lat: 30.0435, lng: -94.8815, ageMinutes: 12 })
  ]);

  const capture=async(name)=>{await page.waitForTimeout(400);await page.screenshot({path:path.join(output,name+'.png')});};
  const parity=()=>page.evaluate(()=>({hazards:activeHazards.length,markers:unifiedIncidentLayer.getLayers().length,pulse:gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount,kbyg:gridlyGetGovernedConsumerProjection().surfaces.kbygCommunity.length,alerts:getGridlyAlertsSurfaceActiveCommunityReportRows().length,location:document.getElementById('mobileAwarenessPanelIssues').textContent}));
  evidence.baseline=await parity();for(const k of ['hazards','markers','pulse','kbyg','alerts'])assert.equal(evidence.baseline[k],3);
  evidence.views=[];
  for(const width of [320,360,390,440]) {
    await page.setViewportSize({width,height:844});await page.evaluate(()=>map.setView([30.0466,-94.8852],14));
    await capture('active-home-'+width);
    const markers=await page.evaluate(()=>({hazards:unifiedIncidentLayer.getLayers().map(m=>({size:m.options.icon.options.iconSize,anchor:m.options.icon.options.iconAnchor,pane:m.options.pane,img:getComputedStyle(m.getElement().querySelector('img')).filter})),neutral:[...document.querySelectorAll('.gridly-crossing-marker[data-marker-category="crossing_infrastructure"] img')].slice(0,3).map(n=>({rect:n.getBoundingClientRect().toJSON(),opacity:getComputedStyle(n).opacity})),filter:document.querySelector('.gridly-v2-segments').getBoundingClientRect().toJSON(),filterButtons:[...document.querySelectorAll('.gridly-v2-segments button')].map(n=>n.getBoundingClientRect().height)}));
    markers.hazards.forEach(m=>{assert.deepEqual(m.size,[64,64]);assert.deepEqual(m.anchor,[32,62.72]);});assert.ok(markers.neutral.every(m=>Math.abs(m.rect.width-49.92)<1 && m.opacity==='0.58'));assert.ok(markers.filter.height<=48);assert.ok(markers.filterButtons.every(h=>h>=40));
    await page.locator('#mobileDestinationCommandBtn').click();await capture('search-'+width);
    const rows=await page.locator('.gridly-search-result-item[data-saved-place-role]').evaluateAll(ns=>ns.map(n=>({text:n.innerText,rect:n.getBoundingClientRect().toJSON(),role:n.dataset.savedPlaceRole})));
    assert.equal(rows.length,2);assert.ok(rows.every(r=>r.rect.height>=44 && r.rect.left>=0 && r.rect.right<=width && !/Saved place|^Place$/m.test(r.text)));assert.deepEqual(rows.map(r=>r.role),['home','work']);
    await page.keyboard.press('Tab');await page.locator('.gridly-search-result-item').first().focus();assert.notEqual(await page.locator('.gridly-search-result-item').first().evaluate(n=>getComputedStyle(n).outlineStyle),'none');
    await page.locator('#gridlySearchCloseBtn').click();
    await page.locator('#gridlyBriefFoundationHandle').click();await capture('kbyg-'+width);
    const brief=await page.locator('#gridlyBriefInteractionPanel').evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),text:n.innerText,scroll:n.scrollHeight,client:n.clientHeight,overflow:getComputedStyle(n).overflowY}));assert.ok(brief.rect.height<=251);assert.match(brief.text,/3 community reports/);assert.match(brief.text,/Multiple recent signals/);assert.match(brief.text,/temporarily unavailable/);assert.equal(brief.overflow,'auto');
    await page.locator('#gridlyBriefInteractionPanel [data-gridly-travel-brief-section="weather"]').scrollIntoViewIfNeeded();await capture('kbyg-provider-details-'+width);const weatherVisible=await page.locator('#gridlyBriefInteractionPanel').evaluate(n=>{const a=n.getBoundingClientRect(),b=n.querySelector('[data-gridly-travel-brief-section="weather"] p').getBoundingClientRect();return b.top>=a.top&&b.bottom<=a.bottom;});assert.ok(weatherVisible,'Provider uncertainty must be reachable inside the brief');await page.locator('#gridlyBriefFoundationHandle').click();
    await page.locator('#gridlyAlertsDockButton').click();await page.waitForFunction(()=>document.querySelectorAll('#gridlyPortraitV2Sheet [data-gridly-lp236-condition-id]').length===3);await capture('alerts-'+width);
    const alerts=await page.locator('#gridlyPortraitV2Sheet').evaluate(n=>({text:n.innerText,single:n.querySelectorAll('.gridly-lp24448g-single-condition').length,first:n.querySelector('.gridly-lp236-sections > :first-child')?.dataset.gridlyLp236Source,locations:[...n.querySelectorAll('[data-gridly-lp236-condition-id]')].map(r=>r.dataset.gridlyAlertLocation),show:[...n.querySelectorAll('.gridly-lp236-show-me')].map(b=>({rect:b.getBoundingClientRect().toJSON(),color:getComputedStyle(b).color,background:getComputedStyle(b).backgroundColor}))}));
    assert.equal(alerts.single,3);assert.equal(alerts.first,'community_report');assert.match(alerts.text,/Downed Power Line/);assert.doesNotMatch(alerts.text,/Other Hazard/);assert.deepEqual(alerts.locations.sort(),['Cook Street and Church Street','Hope Street and Nancy Street','Winfree Street and Flowers Street']);assert.ok(alerts.show.every(b=>b.rect.height>=44));
    await page.evaluate(()=>closePortraitV2Sheet());evidence.views.push({width,markers,rows,brief,alerts});console.log('G viewport '+width+' passed');
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>map.setView([30.0473,-94.8874],16));await capture('active-map-close-up-390');
  for(const [surface,id] of [['settings','#gridlySettingsDockButton'],['history','#gridlyHistoryDockButton'],['report','#gridlyReportDockButton']]) {await page.locator(id).click();await capture(surface+'-390');evidence[surface]=await page.locator('#gridlyPortraitV2Sheet').innerText();await page.evaluate(()=>closePortraitV2Sheet());}
  await page.evaluate(()=>{configureRouteSetupModal({mode:'home',prefillType:'home'});openModal(els.routeSetupModal);});await capture('home-editor-390');assert.equal(await page.locator('#closeRouteSetupModalBtn').getAttribute('aria-label'),'Close saved places editor');await page.evaluate(()=>closeRouteSetupModal());
  evidence.routeOpener=await page.evaluate(()=>{try{openMobileRouteQuickPanel();return null;}catch(e){return e.message;}});await capture('route-watch-390');await page.evaluate(()=>closeMobileRouteQuickPanel());
  await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlyAddressSearchInput').fill('Dayton');await page.locator('#gridlyRemoteSearchBtn').click();await page.locator('#gridlySearchResults button').filter({hasText:'Dayton'}).first().click();await capture('selected-search-390');await page.locator('#gridlySearchCloseBtn').click();await page.locator('#gridlyTemporaryContextReturnHome').click();
  await page.evaluate(()=>{window.__oldForeground=requestGridlyForegroundPosition;requestGridlyForegroundPosition=(success,failure)=>{window.__fixtureLocation={success,failure};return 'g-fixture';};});
  await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlySearchAroundMeBtn').click();await page.evaluate(()=>window.__fixtureLocation.success({timestamp:Date.now(),coords:{latitude:30.04725,longitude:-94.88737,accuracy:10}}));await capture('around-me-390');
  evidence.currentLocation=await page.evaluate(()=>({size:userMarker.options.icon.options.iconSize,anchor:userMarker.options.icon.options.iconAnchor,z:userMarker.options.zIndexOffset,interactive:userMarker.options.interactive,html:userMarker.getElement().outerHTML}));assert.equal(evidence.currentLocation.z,80);assert.deepEqual(evidence.currentLocation.size,[48,48]);assert.deepEqual(evidence.currentLocation.anchor,[24,24]);assert.equal(evidence.currentLocation.interactive,false);
  await page.locator('#gridlyTemporaryContextReturnHome').click();await page.evaluate(()=>requestGridlyForegroundPosition=window.__oldForeground);
  await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>applyGridlySettingsDisplayPreferences({theme:'dark',textSize:'large',mapStyle:'standard'},'g-isolated-audit'));await page.locator('#gridlyAlertsDockButton').click();await capture('alerts-dark-390');await page.evaluate(()=>closePortraitV2Sheet());await page.locator('#mobileDestinationCommandBtn').click();await capture('search-dark-390');await page.locator('#gridlySearchCloseBtn').click();
  evidence.final=await parity();for(const k of ['hazards','markers','pulse','kbyg','alerts'])assert.equal(evidence.final[k],3);assert.deepEqual(markerHashes(),beforeMarkers);assert.equal(evidence.errors.length,0);evidence.passed=true;console.log('G presentation acceptance passed.');
})().catch(error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,'browser.json'),JSON.stringify(evidence,null,2));await browser?.close();server.close();});
