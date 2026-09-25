const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448h');
fs.mkdirSync(output, { recursive: true });
const evidence = { auditMode: process.env.GRIDLY_H_FLOW_ONLY === '1' ? 'flow-only' : process.env.GRIDLY_H_RAIL_ONLY === '1' ? 'rail-only' : 'combined', consoleErrors: [], profiles: [], refreshes: [], widths: [], location: [], errors: [], warnings: [], blockedRequests: [] };
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
      if (process.env.GRIDLY_H_LOCAL_REPORT_READS === '1' && request.method() === 'GET' && new URL(url).pathname === '/rest/v1/reports') { evidence.localReportReads = (evidence.localReportReads || 0) + 1; return route.fulfill({ contentType: 'application/json', body: '[]' }); }
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
    page.on('console', message => { if (message.type() === 'warning') evidence.warnings.push(message.text()); if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
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
  const seed = () => page.evaluate(() => [
    gridlyLocalTestReports.add('flooded-roadway', { lat: 30.047253308692213, lng: -94.88737106323242, ageMinutes: 0 }),
    gridlyLocalTestReports.add('debris-in-road', { lat: 30.0505, lng: -94.889, ageMinutes: 5 }),
    gridlyLocalTestReports.add('downed-power-line', { lat: 30.0435, lng: -94.8815, ageMinutes: 12 })
  ]);


  const baseline=process.env.GRIDLY_H_BASELINE==='1';
  const capture=async name=>{await page.waitForTimeout(400);await page.screenshot({path:path.join(output,(baseline?'before-':'')+name+'.png')});};
  const closeSheet=()=>page.locator('#gridlyPortraitV2SheetClose').click();
  const openSettings=async section=>{await page.locator('#gridlySettingsDockButton').click();if(section){const summary=page.locator('#gridlyPortraitV2Sheet summary').filter({hasText:section});if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();}};
  const homeBytes=await page.evaluate(()=>localStorage.getItem('gridlySavedPlacesV1'));
  evidence.opener=[];evidence.rail=[];evidence.glyphs=[];
  if(process.env.GRIDLY_H_RAIL_ONLY!=='1' && process.env.GRIDLY_H_FLOW_ONLY!=='1'){
  evidence.normalZoom=await page.evaluate(()=>map.getZoom());
  for(const width of [320,360,390,440]){await page.setViewportSize({width,height:844});await capture('quiet-home-'+width);}
  await seed();
  for(const width of [320,360,390,440]){
    await page.setViewportSize({width,height:844});
    for(const zoom of [evidence.normalZoom-1,evidence.normalZoom,evidence.normalZoom+1]){
      await page.evaluate(z=>map.setView([30.0466,-94.8852],z,{animate:false}),zoom);await capture('active-'+width+'-zoom-'+zoom);
      const glyphs=await page.evaluate(()=>unifiedIncidentLayer.getLayers().map(m=>{const e=m.getElement(),img=e.querySelector('img'),s=getComputedStyle(img);return{id:m.options.incidentId,size:m.options.icon.options.iconSize,anchor:m.options.icon.options.iconAnchor,asset:img.getAttribute('src'),intrinsic:[img.naturalWidth,img.naturalHeight],rect:img.getBoundingClientRect().toJSON(),filter:s.filter,fit:s.objectFit,clip:s.clipPath};}));
      for(const g of glyphs){assert.deepEqual(g.size,[64,64]);assert.deepEqual(g.anchor,[32,62.72]);}evidence.glyphs.push({width,zoom,glyphs});
    }
    await page.locator('#gridlyBriefFoundationHandle').click();await capture('kbyg-expanded-'+width);await page.locator('#gridlyBriefFoundationHandle').click();
    await page.locator('#gridlyAlertsDockButton').click();await page.waitForFunction(()=>document.querySelectorAll('[data-gridly-lp236-condition-id]').length===3);await capture('alerts-'+width);
    const locations=await page.locator('[data-gridly-lp236-condition-id]').evaluateAll(ns=>ns.map(n=>n.dataset.gridlyAlertLocation).sort());assert.deepEqual(locations,['Cook Street and Church Street','Hope Street and Nancy Street','Winfree Street and Flowers Street']);
    if(width===390){await page.locator('.gridly-lp236-show-me').first().click();await page.waitForTimeout(500);evidence.showMe=await page.evaluate(()=>gridlyGetCurrentAwarenessContext().type);await page.evaluate(()=>closePortraitV2Sheet());}else await closeSheet();
    await page.locator('#mobileDestinationCommandBtn').click();await capture('search-'+width);assert.equal(await page.locator('#gridlySearchAroundMeBtn').isVisible(),true);await page.locator('#gridlySearchCloseBtn').click();
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>map.setView([30.0466,-94.8852],16,{animate:false}));await capture('active-map-close-up-390');
  await page.evaluate(()=>map.setView([30.0466,-94.8852],14,{animate:false}));await page.waitForTimeout(400);
  for(const category of ['flooding','debris','downed_power_line'])await page.locator('.gridly-hazard-marker[data-marker-category="'+category+'"] img').screenshot({path:path.join(output,'marker-'+category+'-normal.png')});
  await page.evaluate(()=>unifiedIncidentLayer.getLayers()[0].openPopup());await capture('hazard-popup-390');await page.locator('.leaflet-popup button').filter({hasText:'Confirm Still Active'}).click();await page.waitForTimeout(500);evidence.confirmed=await page.evaluate(()=>gridlyLocalTestReports.list().find(x=>x.preset==='flooded-roadway').reportCount);assert.equal(evidence.confirmed,2);await page.evaluate(()=>map.closePopup());
  // Editors are exercised through visible Settings actions, never legacy helper bypasses.
  for(const [name,action,title] of [['home','route-edit-home-open','Set Home'],['work','route-edit-work-open','Set Work'],['manage','route-manage-places-open','Manage Places']]){
    await openSettings('Travel');await capture('settings-travel-390');await page.locator('[data-v2-action="'+action+'"]').click();await page.waitForTimeout(300);assert.equal(await page.locator('#routeSetupModal').isVisible(),true);assert.equal(await page.locator('#routeSetupTitle').innerText(),title);assert.equal(await page.locator('#closeRouteSetupModalBtn').getAttribute('aria-label'),'Close saved places editor');await capture(name+'-editor-390');evidence.opener.push({name,title,passed:true});await page.locator('#closeRouteSetupModalBtn').click();
  }
  await openSettings('Awareness');await page.locator('[data-v2-action="settings-change-home-area"]').click();await capture('change-home-area-390');assert.match(await page.locator('#gridlyPortraitV2Sheet').innerText(),/Choose your home area/);await closeSheet();
  await openSettings('Appearance');await capture('settings-appearance-390');evidence.appearance=await page.locator('#gridlyPortraitV2Sheet').innerText();await closeSheet();
  for(const [name,id] of [['report','#gridlyReportDockButton'],['history','#gridlyHistoryDockButton']]){await page.locator(id).click();await capture(name+'-390');evidence.opener.push({name,text:await page.locator('#gridlyPortraitV2Sheet').innerText(),closeName:await page.locator('#gridlyPortraitV2SheetClose').getAttribute('aria-label')});await closeSheet();}
  await page.locator('#gridlyReportDockButton').click();await page.locator('[data-v2-action="report-select-hazard"][data-hazard-type="flooding"]').click();await capture('report-selected-390');evidence.reportSelected=await page.locator('#gridlyPortraitV2Sheet').innerText();await closeSheet();
  // Crossing submissions stop at the unaccepted consent gate; no reporting activation.
  await page.evaluate(()=>{const c=crossings.find(x=>x.id==='FRA-762785P');openCrossingPopupFromMarkerInteraction(crossingMarkers.get(c.id),c,'h-audit');});await capture('neutral-crossing-popup-390');
  for(const label of ['Report Blocked','Report Delay']){await page.locator('.leaflet-popup button').filter({hasText:label}).click();await page.getByRole('button',{name:'Not now',exact:true}).waitFor();await capture(label.replaceAll(' ','-').toLowerCase()+'-consent-390');assert.equal(await page.getByRole('button',{name:'Accept and continue',exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Not now',exact:true}).click();}
  await page.evaluate(()=>map.closePopup());
  }
  const rail=async(label,id,state)=>{
    await page.waitForTimeout(700);
    const r=await page.evaluate(id=>{const m=crossingMarkers.get(id),c=crossings.find(x=>x.id===id);openCrossingPopupFromMarkerInteraction(m,c,'h-audit');return {canonical:activeReports.filter(r=>r.crossingId===id).map(r=>({type:r.type,severity:r.severity,id:r.id})),group:getConsolidatedIncidents().filter(r=>r.crossingId===id).map(r=>({type:r.latestReport.type,count:r.count})),incident:getUnifiedIncidents().filter(r=>r.id==='rail-'+id).map(r=>({type:r.type,title:r.title,description:r.description})),asset:m.getElement().querySelector('img').getAttribute('src')};},id);
    await capture(label+'-popup-390');r.popup=await page.locator('.leaflet-popup').innerText();await page.locator('.leaflet-popup-close-button').click();await page.locator('#gridlyAlertsDockButton').click();await page.waitForTimeout(700);r.alerts=await page.locator('#gridlyPortraitV2Sheet').innerText();await capture(label+'-alerts-390');await closeSheet();await page.locator('#gridlyBriefFoundationHandle').click();await page.waitForTimeout(550);r.kbyg=await page.locator('#gridlyBriefInteractionPanel').innerText();await capture(label+'-kbyg-390');await page.locator('#gridlyBriefFoundationHandle').click();
    evidence.rail.push({label,id,state,...r});
    if(state==='delay'){assert.equal(r.canonical.length,1);assert.equal(r.group.length,1);assert.equal(r.group[0].type,'heavy');assert.equal(r.incident[0].type,'rail_delay');assert.ok(r.canonical.every(x=>x.type==='heavy'));assert.match(r.asset,/23-reported-crossing-delay/);assert.match(r.popup,/Reported Crossing Delay/);if(!baseline){assert.doesNotMatch(r.alerts+' '+r.kbyg+' '+r.incident.map(i=>i.title).join(' '),/block(?:ed|ing)/i);assert.match(r.kbyg,/crossing delay/);assert.doesNotMatch(r.kbyg,/Multiple recent signals/);}}
    if(state==='blocked'){assert.match(r.asset,/24-blocked-crossing/);assert.match(r.popup,/Blocked Crossing/);}
    if(state==='clear'){assert.equal(r.canonical.length,0);assert.equal(r.group.length,0);assert.equal(r.incident.length,0);assert.doesNotMatch(r.popup,/Reported Crossing Delay|Blocked Crossing/);assert.match(r.asset,/25-crossing-location/);assert.doesNotMatch(r.kbyg,/crossing delay|blocked crossing/i);}
    return r;
  };
  await page.evaluate(()=>gridlyLocalTestReports.clear());
  for(let iteration=0;iteration<2;iteration++){
    await page.evaluate(()=>gridlyLocalTestReports.add('train-blocking-crossing',{crossingId:'FRA-762785P'}));await rail('a-blocked-'+iteration,'FRA-762785P','blocked');
    await page.evaluate(()=>{const c=crossings.find(x=>x.id==='FRA-762785P');openCrossingPopupFromMarkerInteraction(crossingMarkers.get(c.id),c,'h-audit');});await page.locator('.leaflet-popup button').filter({hasText:'Mark Cleared'}).click();await page.evaluate(()=>map.closePopup());await rail('a-clear-'+iteration,'FRA-762785P','clear');
    await page.evaluate(()=>gridlyLocalTestReports.add('reported-crossing-delay',{crossingId:'FRA-762785P'}));await rail('a-delay-'+iteration,'FRA-762785P','delay');await page.evaluate(()=>{const c=crossings.find(x=>x.id==='FRA-762785P');openCrossingPopupFromMarkerInteraction(crossingMarkers.get(c.id),c,'h-audit');});await page.locator('.leaflet-popup button').filter({hasText:'Mark Cleared'}).click();await page.evaluate(()=>map.closePopup());await rail('a-delay-cleared-'+iteration,'FRA-762785P','clear');await page.evaluate(()=>gridlyLocalTestReports.clear());
  }
  await page.evaluate(()=>{const c=crossings.find(x=>x.id==='FRA-762786W');map.setView([c.lat,c.lng],14,{animate:false});});await page.waitForTimeout(400);
  await page.evaluate(()=>gridlyLocalTestReports.add('reported-crossing-delay',{crossingId:'FRA-762786W'}));await rail('b-fresh-delay','FRA-762786W','delay');
  if(process.env.GRIDLY_H_RAIL_ONLY==='1'){evidence.passed=true;return;}
  // Search failure, successful local route response, and actual Start/Stop Route Watch.
  await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlyAddressSearchInput').fill('Dayton');await page.locator('#gridlyRemoteSearchBtn').click();await page.locator('#gridlySearchResults button').filter({hasText:'Dayton'}).first().click();await capture('selected-search-390');await page.locator('#gridlyDestinationPreviewBtn').click();await page.waitForTimeout(800);assert.match(await page.locator('#gridlyDestinationConfirmation').innerText(),/unavailable|Try again/i);await capture('route-unavailable-390');
  await context.route('https://router.project-osrm.org/route/v1/driving/**',async route=>{const coordinates=decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()).split(';').map(p=>p.split(',').map(Number));await route.fulfill({contentType:'application/json',body:JSON.stringify({code:'Ok',routes:[{distance:8000,duration:600,geometry:{type:'LineString',coordinates},legs:[{distance:8000,duration:600,steps:[]}]}],waypoints:coordinates.map(location=>({location,distance:0,name:'Local fixture'}))})});});
  await page.locator('#gridlyDestinationPreviewBtn').click();await page.waitForTimeout(900);await page.locator('#mobileDestinationCommandImpact').click();await capture('route-details-390');evidence.routeDetails=await page.locator('#gridlyDestinationImpactPane').innerText();if(!baseline){assert.doesNotMatch(evidence.routeDetails,/blocked crossing|Multiple recent signals|Strong supporting evidence|Multiple nearby conditions/i);assert.match(evidence.routeDetails,/reported crossing delay/i);}await page.locator('#gridlyDestinationImpactManageRouteBtn').click();await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().type),'ROUTE_WATCH');await capture('route-watch-390');await page.locator('#gridlyDestinationImpactStopWatchBtn').click();assert.equal(await page.evaluate(()=>routeWatchActivated),false);
  await page.evaluate(()=>clearGridlyPendingDestination({reason:'h-fixture-reset'}));await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof gridlyLocalTestReports==='object'&&crossings.length>0&&roadwayDatasetLoaded);await page.evaluate(()=>saveGridlyHomeTownPreference('Dayton'));await seed();
  await page.evaluate(()=>{window.__hOldForeground=requestGridlyForegroundPosition;requestGridlyForegroundPosition=(success,failure)=>{window.__hForeground={success,failure};return 'h-fixture';};});await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlySearchAroundMeBtn').click();await capture('around-me-finding-390');await page.evaluate(()=>window.__hForeground.success({timestamp:Date.now(),coords:{latitude:30.04725,longitude:-94.88737,accuracy:10}}));await capture('around-me-390');assert.equal(await page.locator('#gridlyTemporaryContextReturnHome').isVisible(),true);await page.locator('#gridlyTemporaryContextReturnHome').click();await page.evaluate(()=>requestGridlyForegroundPosition=window.__hOldForeground);
  await page.setViewportSize({width:390,height:500});await page.locator('#mobileDestinationCommandBtn').click();await capture('search-reduced-height');await page.locator('#gridlySearchCloseBtn').click();await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'dark'});await page.evaluate(()=>applyGridlySettingsDisplayPreferences({theme:'dark',textSize:'large',mapStyle:'standard'},'h-isolated-audit'));await page.locator('#gridlyAlertsDockButton').click();await capture('alerts-dark-large-390');await closeSheet();await openSettings('Support');await capture('settings-support-dark-390');evidence.support=await page.locator('#gridlyPortraitV2Sheet').innerText();await closeSheet();
  evidence.parity=await page.evaluate(()=>({hazards:activeHazards.length,markers:unifiedIncidentLayer.getLayers().length,pulse:gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount,kbyg:gridlyGetGovernedConsumerProjection().surfaces.kbygCommunity.length,alerts:getGridlyAlertsSurfaceActiveCommunityReportRows().length,location:document.getElementById('mobileAwarenessPanelIssues').textContent,undefinedm:document.body.innerText.includes('undefinedm')}));for(const key of ['hazards','markers','pulse','kbyg','alerts'])assert.equal(evidence.parity[key],3);assert.equal(evidence.parity.undefinedm,false);assert.equal(await page.evaluate(()=>localStorage.getItem('gridlySavedPlacesV1')),homeBytes);assert.deepEqual(markerHashes(),beforeMarkers);assert.equal(evidence.errors.length,0);evidence.passed=true;console.log('H consumer audit and rail presentation checks passed.');
})().catch(error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,process.env.GRIDLY_H_BASELINE?'baseline.json':'browser.json'),JSON.stringify(evidence,null,2));await browser?.close();server.close();});
