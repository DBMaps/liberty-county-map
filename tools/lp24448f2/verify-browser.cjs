const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448f2');
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
  await page.evaluate(() => [
    gridlyLocalTestReports.add('flooded-roadway', { lat: 30.047253308692213, lng: -94.88737106323242, ageMinutes: 0 }),
    gridlyLocalTestReports.add('debris-in-road', { lat: 30.0505, lng: -94.889, ageMinutes: 5 }),
    gridlyLocalTestReports.add('downed-power-line', { lat: 30.0435, lng: -94.8815, ageMinutes: 12 })
  ]);
  const capture = name => page.screenshot({ path: path.join(output, name + '.png') });
  evidence.surfaces = []; evidence.popups = [];
  const colors = selectors => page.evaluate(selectors => selectors.map(selector => {
    const n = document.querySelector(selector); if (!n) return { selector, missing: true };
    const s = getComputedStyle(n);
    return { selector, text: n.textContent.trim().slice(0,100), color: s.color, background: s.backgroundColor, image: s.backgroundImage, opacity: s.opacity, outline: s.outlineStyle };
  }), selectors);
  for (const [theme, system] of (process.env.GRIDLY_F2_POPUPS_ONLY ? [] : [['system','light'], ['system','dark'], ['light','dark'], ['dark','light']])) {
    await page.emulateMedia({ colorScheme: system });
    await page.evaluate(theme => applyGridlySettingsDisplayPreferences({ theme, textSize: 'large', mapStyle: 'standard' }, 'f2-isolated-audit'), theme);
    const key = `${theme}-${system}`;
    await page.locator('#gridlyAlertsDockButton').click();
    await page.waitForFunction(() => document.querySelectorAll('#gridlyPortraitV2Sheet [data-gridly-lp236-condition-id]').length === 3);
    await page.evaluate(() => document.querySelectorAll('#gridlyPortraitV2Sheet details').forEach(n => n.open = true));
    await page.waitForTimeout(400);
    await capture(`after-alerts-${key}-390`);
    evidence.surfaces.push({ theme, system, surface:'alerts', colors: await colors(['.gridly-lp236-header','.gridly-lp236-condition-item','.gridly-lp236-condition-roadway','.gridly-lp236-condition-summary','.gridly-lp236-condition-time','.gridly-lp236-show-me','.gridly-lp236-source-status small']) });
    await page.keyboard.press('Tab');
    await page.locator('.gridly-lp236-show-me').first().focus();
    assert.equal(await page.locator('.gridly-lp236-show-me').first().evaluate(n => getComputedStyle(n).outlineStyle), 'solid');
    await page.evaluate(() => closePortraitV2Sheet());
    await page.locator('#gridlyBriefFoundationHandle').click(); await page.waitForTimeout(400);
    await capture(`after-kbyg-${key}-390`);
    evidence.surfaces.push({ theme, system, surface:'kbyg', colors:await colors(['#gridlyBriefInteractionPanel','#gridlyBriefInteractionPanel [data-gridly-travel-brief-section="community"] p','#gridlyBriefInteractionPanel .gridly-travel-brief-source']) });
    await page.locator('#gridlyBriefFoundationHandle').click();
    await page.locator('#gridlyHistoryDockButton').click(); await page.waitForTimeout(400);
    await capture(`after-history-${key}-390`);
    evidence.surfaces.push({ theme, system, surface:'history', colors:await colors(['.gridly-historical-intelligence-empty','.gridly-historical-intelligence-empty strong','.gridly-historical-intelligence-empty p']) });
    await page.evaluate(() => closePortraitV2Sheet());
    await page.locator('#mobileDestinationCommandBtn').click();
    await capture(`after-search-${key}-390`);
    evidence.surfaces.push({ theme, system, surface:'search', colors:await colors(['#gridlyAddressSearchInput','#gridlySearchCloseBtn','#gridlySearchClearBtn','#gridlySearchAroundMeBtn','.gridly-search-result-title','#gridlyPoiCategoryButton']) });
    await page.locator('#gridlySearchCloseBtn').click();
    // Existing legacy opener throws after mounting. Record that unchanged defect;
    // inspect its mounted presentation without altering route architecture.
    const routeError = await page.evaluate(() => { try { openMobileRouteQuickPanel(); return null; } catch (e) { return e.message; } });
    evidence.routeOpenerBaseline = routeError;
    await capture(`after-route-${key}-390`);
    evidence.surfaces.push({ theme, system, surface:'route', colors:await colors(['#gridlyMobileRouteQuickPanel','.route-quick-head','#mobileRouteQuickStart','#mobileRouteQuickDestination','#mobileRouteQuickMeta','.route-quick-manage-link']) });
    await page.evaluate(() => closeMobileRouteQuickPanel());
    // Inspect the existing editor independently of the saved-Home opener's
    // recursive activation path; this fixture is presentation evidence only.
    await page.evaluate(() => { configureRouteSetupModal({mode:'home',prefillType:'home'}); openModal(els.routeSetupModal); });
    await capture(`after-editor-${key}-390`);
    evidence.surfaces.push({theme, system, surface:'editor', colors:await colors(['#routeSetupModal .route-setup-modal-card','#routeSetupModal h2','#routeSetupModal label','#routeSetupModal input','#routeSetupModal button'])});
    await page.evaluate(() => closeRouteSetupModal());
    console.log(`Surface theme ${key} captured.`);
  }
  await page.evaluate(() => applyGridlySettingsDisplayPreferences({ theme:'light',textSize:'large',mapStyle:'standard' },'f2-isolated-audit'));
  for (const [width,height] of (process.env.GRIDLY_F2_SURFACES_ONLY ? [] : [[320,844],[360,844],[390,844],[440,844],[390,500]])) {
    await page.setViewportSize({ width,height });
    for (const kind of ['flooding','debris','other_hazard','neutral','blocked','delay']) {
      await page.evaluate(kind => {
        map.closePopup();
        for (const r of gridlyLocalTestReports.list().filter(r => r.crossingId)) gridlyLocalTestReports.clearOne(r.id);
        if (kind === 'blocked' || kind === 'delay') gridlyLocalTestReports.add(kind === 'blocked' ? 'train-blocking-crossing' : 'reported-crossing-delay', { crossingId:'FRA-762785P' });
        map.setView([30.0466,-94.8852],14);
        renderCrossings();
      }, kind);
      await page.waitForFunction(() => crossingMarkers.has('FRA-762785P'));
      await page.evaluate(kind => {
        if (['neutral','blocked','delay'].includes(kind)) {
          const c = crossings.find(c => c.id === 'FRA-762785P');
          openCrossingPopupFromMarkerInteraction(crossingMarkers.get(c.id), c, 'f2-fixture');
        } else {
          const incident = getUnifiedIncidents().find(i => i.category !== 'rail' && (i.raw?.type === kind || i.type === kind));
          const marker = unifiedIncidentLayer.getLayers().find(m => m.options.incidentId === incident?.id);
          if (!marker) throw Error('Missing hazard marker '+kind);
          marker.openPopup();
        }
      }, kind);
      await page.waitForTimeout(1400);
      const measure = await page.evaluate(() => {
        const p = map._popup, e = p?.getElement(), content=p?._contentNode;
        const rect = n => n?.getBoundingClientRect().toJSON();
        const hit = selector => { const n=e?.querySelector(selector),r=n?.getBoundingClientRect();return Boolean(r&&n.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))); };
        return { bounds:GridlyMapVisibility.bounds(map), popup:rect(e), title:rect(e?.querySelector('.gridly-popup strong')), location:rect(e?.querySelector('.gridly-popup-location')), close:rect(e?.querySelector('.leaflet-popup-close-button')), content:rect(content), titleVisible:hit('.gridly-popup strong'),closeVisible:hit('.leaflet-popup-close-button'),owner:p?._source?.options?.incidentId || p?._source?.options?.crossingId, center:map.getCenter(), text:e?.innerText };
      });
      evidence.popups.push({width,height,kind,...measure});
      for (const part of ['popup','title','location','close']) {
        const r = measure[part], b = measure.bounds; assert.ok(r, `${kind} ${part} exists`);
        assert.ok(r.left >= b.left-2 && r.right <= b.right+2 && r.top >= b.top-2 && r.bottom <= b.bottom+2, `${width}x${height} ${kind}/${part}: ${JSON.stringify({r,b})}`);
      }
      assert.ok(measure.location.bottom <= measure.content.bottom+1, 'Location must not be clipped inside scrolling content');
      assert.equal(measure.titleVisible,true,'Title must be unobscured');
      assert.equal(measure.closeVisible,true,'Close must be unobscured');
      const center = measure.center;
      await page.waitForTimeout(500);
      assert.deepEqual(await page.evaluate(() => map.getCenter()), center, 'No repeated pan loop');
      await capture(`popup-${kind}-${width}x${height}`);
      await page.locator('.leaflet-popup-close-button').click();
      await page.waitForFunction(() => !map._popup?.isOpen());
      await page.waitForTimeout(250);
    }
    if (height === 844) {
      await page.locator('#gridlyAlertsDockButton').click(); await page.waitForTimeout(500);
      await capture(`alerts-fit-${width}`); await page.evaluate(() => closePortraitV2Sheet());
      await page.locator('#mobileDestinationCommandBtn').click(); await capture(`search-fit-${width}`); await page.locator('#gridlySearchCloseBtn').click();
    }
    console.log(`Popup viewport ${width}x${height} passed.`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => { map.closePopup(); for(const r of gridlyLocalTestReports.list().filter(r=>r.crossingId))gridlyLocalTestReports.clearOne(r.id); map.setView([30.0466,-94.8852],14); });
  await page.waitForTimeout(500);
  assert.equal(await page.locator('#gridlyMapBackgroundStatus').isVisible(),true);
  await capture('map-unavailable-390');
  tilesRecover = true;
  await page.evaluate(() => mapBaseLayersByName.Standard.redraw());
  await page.waitForFunction(() => document.getElementById('gridlyMapBackgroundStatus').hidden && document.querySelector('#map img.leaflet-tile-loaded')?.naturalWidth > 0);
  await capture('map-recovered-local-fixture-390');
  evidence.recovery = { passed:true, syntheticTiles:true };
  evidence.finalParity = await page.evaluate(() => ({hazards:activeHazards.length,markers:unifiedIncidentLayer.getLayers().length,pulse:gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount,kbyg:gridlyGetGovernedConsumerProjection().surfaces.kbygCommunity.length,alerts:getGridlyAlertsSurfaceActiveCommunityReportRows().length,undefinedm:document.body.innerText.includes('undefinedm')}));
  assert.deepEqual(evidence.finalParity,{hazards:3,markers:3,pulse:3,kbyg:3,alerts:3,undefinedm:false});
  assert.deepEqual(markerHashes(),beforeMarkers);
  assert.equal(evidence.errors.length,0,evidence.errors.join('\n'));
  await page.evaluate(() => gridlyLocalTestReports.clear());
  evidence.passed = true;
  console.log('F2 browser acceptance passed.');
})().catch(error => { evidence.failure=error.stack; console.error(error); process.exitCode=1; }).finally(async () => {
  fs.writeFileSync(path.join(output,process.env.GRIDLY_F2_SURFACES_ONLY ? 'surfaces.json' : 'browser.json'),JSON.stringify(evidence,null,2));
  await browser?.close(); await new Promise(resolve=>server.close(resolve));
});
