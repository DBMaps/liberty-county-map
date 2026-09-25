const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448h1');
fs.mkdirSync(output, { recursive: true });
const evidence = { auditMode: 'h1-state-and-combined', consoleErrors: [], profiles: [], refreshes: [], widths: [], location: [], errors: [], warnings: [], blockedRequests: [] };
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

  evidence.matrix=[]; evidence.combined=[];
  const width=Number(process.env.GRIDLY_H1_WIDTH||390);
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>{window.__h1RenderRevision=0;new MutationObserver(()=>window.__h1RenderRevision++).observe(document.getElementById('gridlyPortraitV2SheetBody'),{childList:true});});
  const shot=label=>page.screenshot({path:path.join(output,label+'-'+width+'.png')});
  const close=async()=>{if(await page.locator('#gridlyPortraitV2SheetClose').isVisible())await page.locator('#gridlyPortraitV2SheetClose').click();};
  const open=async()=>{if(!await page.locator('#gridlyPortraitV2SheetClose').isVisible())await page.locator('#gridlyAlertsDockButton').click();};
  const read=()=>page.evaluate(()=>{
    const gov=gridlyGetGovernedConsumerProjection(),snapshot=getAlertsSurfaceSnapshot(),dom=[...document.querySelectorAll('[data-gridly-lp236-condition-id]')];
    return {open:!document.getElementById('gridlyPortraitV2Sheet').hidden,sheet:document.getElementById('gridlyPortraitV2Sheet').dataset.activeSheet,disclosures:[...document.querySelectorAll('#gridlyPortraitV2Sheet details')].map(n=>({key:n.dataset.gridlyDisclosureKey,open:n.open})),
      dom:dom.map(n=>({id:n.dataset.gridlyLp236ConditionId,location:n.dataset.gridlyAlertLocation,text:n.innerText})),model:snapshot.alerts.map((r,i)=>({id:gridlyAlertWriterRecordId(r,i),rawId:r.id,type:r.type,time:r.freshnessLabel||r.minutesText})),
      governed:Object.fromEntries(Object.entries(gov.surfaces).map(([k,v])=>[k,v.map(r=>({id:r.evidenceId,type:r.subtype,reportId:r.record.id}))])),canonical:activeReports.map(r=>({id:r.id,type:r.type,crossingId:r.crossingId})),
      incidents:getUnifiedIncidents().filter(r=>r.status==='active').map(r=>({id:r.id,type:r.type})),grouped:getConsolidatedIncidents().map(r=>({crossing:r.crossingId,type:r.latestReport.type,count:r.count})),
      location:document.getElementById('mobileAwarenessPanelIssues').textContent,pulseCount:gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount,pulse:document.querySelector('.gridly-v2-status-pill').innerText,
      railMarkers:[...crossingMarkers].filter(([id,m])=>m.__gridlyCrossingReport&&getIncidentLifecycleState(m.__gridlyCrossingReport)==='active').map(([id,m])=>({id,type:m.__gridlyCrossingReport.type,asset:m.getElement()?.querySelector('img')?.getAttribute('src')})),hazardMarkers:unifiedIncidentLayer.getLayers().map(m=>m.options.incidentId),
      coverage:gridlyReadAlertsFamilyAuthority().community_report,read:gridlyReportReadPresentationState,renderRevision:window.__h1RenderRevision,modelGeneration:snapshot.generation??snapshot.revision??null,owner:gridlyGetCurrentAwarenessContext().type,undefinedm:document.body.innerText.includes('undefinedm')};
  });
  const settled=async(expected)=>{await page.waitForFunction(expected=>document.querySelectorAll('[data-gridly-lp236-condition-id]').length===expected,expected);await page.waitForTimeout(300);};
  const record=async(label,expected,bucket=evidence.combined)=>{
    const s=await read();s.label=label;s.expected=expected;bucket.push(s);
    for(const surface of ['locationContext','communityPulse','alerts','kbygCommunity'])assert.equal(s.governed[surface].length,expected,label+' '+surface);
    assert.equal(s.pulseCount,expected,label+' pulse');assert.equal(s.undefinedm,false);
    if(expected)assert.match(s.location,new RegExp('^'+expected+' roadway issue'));else assert.match(s.location,/No active issues/);
    if(s.open&&s.sheet==='alerts'){
      assert.equal(s.dom.length,expected,label+' DOM');assert.equal(s.model.length,expected,label+' model');assert.equal(new Set(s.dom.map(r=>r.id)).size,expected,label+' unique DOM');
      for(const m of s.model)assert.ok(s.dom.some(d=>d.id===m.id||d.id.endsWith(':'+m.id)),label+' missing '+m.id);
    }
    await shot(label);return s;
  };
  const reset=async()=>{await close();await page.evaluate(()=>{map.closePopup();gridlyLocalTestReports.clear();map.setView([30.0466,-94.8852],14,{animate:false});});};
  const addRail=(type,id='FRA-762785P')=>page.evaluate(({type,id})=>gridlyLocalTestReports.add(type,{crossingId:id}),{type,id});
  const flood=()=>page.evaluate(()=>gridlyLocalTestReports.add('flooded-roadway',{lat:30.047253308692213,lng:-94.88737106323242,ageMinutes:0}));
  const clearRail=async(id='FRA-762785P')=>{await close();await page.evaluate(id=>{const c=crossings.find(c=>c.id===id);openCrossingPopupFromMarkerInteraction(crossingMarkers.get(id),c,'h1-ui-clear');},id);await page.locator('.leaflet-popup button').filter({hasText:'Mark Cleared'}).click();await page.evaluate(()=>map.closePopup());await page.waitForTimeout(500);};
  const matrix=async(label,expected,types={})=>{
    await open();await settled(expected);const s=await record(label,expected,evidence.matrix);await close();
    await page.locator('#gridlyBriefFoundationHandle').click();await page.waitForTimeout(400);s.kbyg=await page.locator('#gridlyBriefInteractionPanel').innerText();await shot(label+'-kbyg');await page.locator('#gridlyBriefFoundationHandle').click();
    if(Object.values(types).includes('heavy'))assert.doesNotMatch(s.kbyg,/blocked|blocking/i);
    s.popups=[];
    for(const [id,type] of Object.entries(types)){
      await page.evaluate(id=>{const c=crossings.find(c=>c.id===id);map.setView([c.lat,c.lng],14,{animate:false});},id);await page.waitForTimeout(1100);
      await page.evaluate(id=>{const c=crossings.find(c=>c.id===id);openCrossingPopupFromMarkerInteraction(crossingMarkers.get(id),c,'h1-state');},id);await page.waitForTimeout(350);
      const text=await page.locator('.leaflet-popup').innerText();assert.match(text,type==='heavy'?/Reported Crossing Delay/:/Blocked Crossing/);if(type==='heavy')assert.doesNotMatch(text,/confirmed|blocked|blocking/i);
      s.popups.push({id,type,text});await shot(label+'-'+id+'-popup');await page.locator('.leaflet-popup-close-button').click();
    }
  };
  await reset();await matrix('A-quiet',0);
  await addRail('train-blocking-crossing');await matrix('B-blocked',1,{'FRA-762785P':'blocked'});
  await clearRail();await matrix('F-blocked-cleared',0);
  await addRail('reported-crossing-delay');await matrix('C-delay',1,{'FRA-762785P':'heavy'});
  await clearRail();await matrix('G-delay-cleared',0);
  await reset();await addRail('train-blocking-crossing');await flood();await matrix('D-blocked-hazard',2,{'FRA-762785P':'blocked'});
  await reset();await addRail('reported-crossing-delay');await flood();await matrix('E-delay-hazard',2,{'FRA-762785P':'heavy'});
  await reset();await addRail('train-blocking-crossing');await matrix('H1-blocked',1,{'FRA-762785P':'blocked'});await clearRail();await matrix('H2-cleared',0);await addRail('reported-crossing-delay');await matrix('H3-delay',1,{'FRA-762785P':'heavy'});await clearRail();await matrix('I-delay-clear',0);
  await reset();await addRail('reported-crossing-delay');await addRail('reported-crossing-delay','FRA-762786W');await matrix('J-two-delays',2,{'FRA-762785P':'heavy','FRA-762786W':'heavy'});
  // The local harness rejects a second active fixture at one crossing. The unit
  // integration test supplies raw duplicate/mixed records directly to the existing
  // canonical selector and verifies one latest condition without mutating storage.
  evidence.duplicateFixtureRejected = await page.evaluate(()=>{try {gridlyLocalTestReports.add('train-blocking-crossing',{crossingId:'FRA-762785P'});return false;}catch(error){return /already has a local test report/.test(error.message);}});assert.equal(evidence.duplicateFixtureRejected,true);
  console.log('H1 delay matrix passed at '+width+'.');
  await reset();await open();await settled(0);await record('combined-quiet',0);await close();await seed();await open();await settled(3);await record('combined-three-hazards',3);
  const community=page.locator('[data-gridly-disclosure-key="community_report"]');if(!await community.evaluate(n=>n.open))await community.locator(':scope > summary').click();
  await page.evaluate(()=>gridlyRunAlertsBackgroundRefreshAfterOpen('alerts_open_background_refresh'));await settled(3);await record('combined-first-refresh',3);assert.equal(await community.evaluate(n=>n.open),true);
  await close();await addRail('train-blocking-crossing');await record('combined-blocked-closed',4);assert.equal(await page.locator('#gridlyPortraitV2Sheet').isVisible(),false);
  await page.waitForTimeout(500);await clearRail();await record('combined-cleared-closed',3);await addRail('reported-crossing-delay');await open();await settled(4);await record('combined-delay-open',4);assert.doesNotMatch(await page.locator('#gridlyPortraitV2Sheet').innerText(),/blocked|blocking/i);await close();
  await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlyAddressSearchInput').fill('Dayton');await page.locator('#gridlyRemoteSearchBtn').click();await page.locator('#gridlySearchResults button').filter({hasText:'Dayton'}).first().click();await page.locator('#gridlySearchCloseBtn').click();await record('combined-search',4);await page.locator('#gridlyTemporaryContextReturnHome').click();await record('combined-search-return',4);
  await page.evaluate(()=>{window.__h1ForegroundOriginal=requestGridlyForegroundPosition;requestGridlyForegroundPosition=(success,failure)=>{window.__h1Foreground={success,failure};return 'h1-local';};});await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlySearchAroundMeBtn').click();await page.evaluate(()=>window.__h1Foreground.success({timestamp:Date.now(),coords:{latitude:30.04725,longitude:-94.88737,accuracy:10}}));await record('combined-around',4);await page.locator('#gridlyTemporaryContextReturnHome').click();await page.evaluate(()=>requestGridlyForegroundPosition=window.__h1ForegroundOriginal);await record('combined-around-return',4);
  await open();await settled(4);await record('combined-final-reopen',4);await page.evaluate(()=>gridlyRunAlertsBackgroundRefreshAfterOpen('alerts_open_background_refresh'));await settled(4);await record('combined-final-refresh',4);assert.equal(await community.evaluate(n=>n.open),true);
  await community.locator(':scope > summary').click();await page.evaluate(()=>gridlyRunAlertsBackgroundRefreshAfterOpen('alerts_open_background_refresh'));await settled(4);assert.equal(await community.evaluate(n=>n.open),false);await close();await page.waitForTimeout(1200);assert.equal(await page.locator('#gridlyPortraitV2Sheet').isVisible(),false);await open();await settled(4);assert.equal(await community.evaluate(n=>n.open),false);await community.locator(':scope > summary').click();
  evidence.showMe=[];
  for(let i=0;i<5;i++){
    await page.locator('.gridly-lp236-show-me').first().click();
    try { await page.waitForFunction(()=>document.getElementById('gridlyPortraitV2Sheet').dataset.sheetState==='minimized',null,{timeout:3000}); }
    catch(error) { evidence.showMeFailure=await page.evaluate(()=>({state:document.getElementById('gridlyPortraitV2Sheet').dataset.sheetState,focus:window.__gridlyLp019AlertFocusDebug,audit:window.gridlyLP236AlertsInformationArchitectureAudit?.()}));throw error; }
    await page.waitForFunction(()=>window.__gridlyLp019AlertFocusDebug?.movementSettlementCompleted===true);
    evidence.showMe.push(await page.evaluate(()=>({state:document.getElementById('gridlyPortraitV2Sheet').dataset.sheetState,focus:window.__gridlyLp019AlertFocusDebug})));
    await page.evaluate(()=>{map.closePopup();closePortraitV2Sheet();});await open();await settled(4);
  }
  await record('combined-five-show-me-reopens',4);evidence.passed=true;assert.equal(evidence.errors.length,0);console.log('H1 combined Alerts passed at '+width+'.');
})().catch(error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,'browser-'+(process.env.GRIDLY_H1_WIDTH||390)+'.json'),JSON.stringify(evidence,null,2));await browser?.close();server.close();});
