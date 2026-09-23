const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448g1');
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
  const seed = () => page.evaluate(() => [
    gridlyLocalTestReports.add('flooded-roadway', { lat: 30.047253308692213, lng: -94.88737106323242, ageMinutes: 0 }),
    gridlyLocalTestReports.add('debris-in-road', { lat: 30.0505, lng: -94.889, ageMinutes: 5 }),
    gridlyLocalTestReports.add('downed-power-line', { lat: 30.0435, lng: -94.8815, ageMinutes: 12 })
  ]);

  const baseline = process.env.GRIDLY_G1_BASELINE === '1';
  const capture=async name=>{await page.screenshot({path:path.join(output,(baseline?'before-':'')+name+'.png')});};
  const rail='.gridly-v2-control-rail', handle='#gridlyBriefFoundationHandle';
  const measure=()=>page.evaluate(()=>{const rail=document.querySelector('#gridlyPortraitV2 .gridly-v2-control-rail'),r=n=>n.getBoundingClientRect().toJSON();return {rail:r(rail),display:getComputedStyle(rail).display,rootState:document.getElementById('gridlyPortraitV2').dataset.gridlyBriefState,map:r(map.getContainer()),center:map.getCenter(),zoom:map.getZoom(),dragging:map.dragging.enabled(),owner:gridlyGetCurrentAwarenessContext().type,filter:document.querySelector('.gridly-v2-segments .is-active')?.dataset.v2Filter,controls:[...rail.querySelectorAll('button')].map(n=>({name:n.getAttribute('aria-label'),control:n.dataset.v2Control,rect:r(n)})),brief:r(document.getElementById('gridlyBriefInteractionPanel')),context:r(document.getElementById('mobileDestinationCommandPanel')),attribution:r(document.querySelector('.leaflet-control-attribution')),markers:unifiedIncidentLayer.getLayers().length};});
  const samePosition=(a,b)=>{for(const k of ['x','y','width','height'])assert.ok(Math.abs(a[k]-b[k])<.1,k+' '+a[k]+' vs '+b[k]);};
  const setExpanded=async expanded=>{if((await page.locator(handle).getAttribute('aria-expanded'))!==String(expanded))await page.locator(handle).click();await page.waitForTimeout(550);};
  const check=async(label,repeats=1)=>{
    await setExpanded(false);await page.evaluate(()=>gridlyPortraitSpatialOwnershipSync());const before=await measure();assert.notEqual(before.display,'none');await capture(label+'-collapsed');
    for(let i=0;i<repeats;i++) {
      await setExpanded(true);const expanded=await measure();assert.equal(expanded.rootState,'expanded');assert.equal(expanded.display,baseline?'flex':'none');
      assert.deepEqual(expanded.center,before.center);assert.equal(expanded.zoom,before.zoom);assert.equal(expanded.owner,before.owner);assert.equal(expanded.filter,before.filter);samePosition(expanded.map,before.map);assert.equal(expanded.dragging,true);
      if(!baseline){assert.equal(expanded.rail.width,0);await page.locator(rail+' button').first().evaluate(n=>n.focus());assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.gridly-v2-control-rail'))),false);for(let tab=0;tab<12;tab++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.gridly-v2-control-rail'))),false);}}
      if(i===0)await capture(label+'-expanded');
      await setExpanded(false);const restored=await measure();samePosition(restored.rail,before.rail);samePosition(restored.map,before.map);assert.deepEqual(restored.center,before.center);assert.equal(restored.owner,before.owner);
      await page.locator(rail+' button').first().focus();assert.equal(await page.evaluate(()=>Boolean(document.activeElement.closest('.gridly-v2-control-rail'))),true);
      evidence.states.push({label,iteration:i,before,expanded,restored});
    }
    await capture(label+'-restored');
  };
  evidence.states=[];
  for(const [width,height] of (baseline?[[390,844]]:[[320,844],[360,844],[390,844],[440,844],[390,500]])) {
    await page.setViewportSize({width,height});await check('quiet-'+width+'x'+height,baseline?1:3);
  }
  await page.setViewportSize({width:390,height:844});await seed();await page.evaluate(()=>map.setView([30.0466,-94.8852],14));await page.waitForTimeout(500);
  for(const [width,height] of (baseline?[[390,844]]:[[320,844],[360,844],[390,844],[440,844],[390,500]])) {await page.setViewportSize({width,height});await check('active-'+width+'x'+height);}
  if(baseline){evidence.passed=true;console.log('Starting-HEAD rail behavior recorded.');return;}
  await page.setViewportSize({width:390,height:844});
  await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlyAddressSearchInput').fill('Dayton');await page.locator('#gridlyRemoteSearchBtn').click();await page.locator('#gridlySearchResults button').filter({hasText:'Dayton'}).first().click();await page.locator('#gridlySearchCloseBtn').click();await check('search-390x844');assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().type),'SEARCH');await page.locator('#gridlyTemporaryContextReturnHome').click();await check('search-return-home-390x844');
  await page.evaluate(()=>{window.__savedForeground=requestGridlyForegroundPosition;requestGridlyForegroundPosition=(success,failure)=>{window.__foreground={success,failure};return 'g1-fixture';};});await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlySearchAroundMeBtn').click();await page.evaluate(()=>window.__foreground.success({timestamp:Date.now(),coords:{latitude:30.04725,longitude:-94.88737,accuracy:10}}));// Intentionally pan geography into the exposed map before testing toggles;
  // hiding the rail itself must never recenter the accepted location.
  await page.mouse.move(285,470);await page.mouse.down();await page.mouse.move(285,610,{steps:8});await page.mouse.up();await page.waitForTimeout(400);await check('around-me-390x844');
  await setExpanded(true);evidence.aroundMe=await page.evaluate(()=>({owner:gridlyGetCurrentAwarenessContext().type,location:document.getElementById('mobileDestinationCommandPanel').innerText,returnHome:document.getElementById('gridlyTemporaryContextReturnHome').getBoundingClientRect().height,marker:userMarker.getElement().getBoundingClientRect().toJSON(),markerShown:map.hasLayer(userMarker),visibleMapTop:document.querySelector('.gridly-v2-segments').getBoundingClientRect().bottom,visibleMapBottom:document.getElementById('mobileDestinationCommandPanel').getBoundingClientRect().top}));assert.equal(evidence.aroundMe.owner,'AROUND_ME');assert.equal(evidence.aroundMe.markerShown,true);assert.ok(evidence.aroundMe.marker.top>=evidence.aroundMe.visibleMapTop&&evidence.aroundMe.marker.bottom<=evidence.aroundMe.visibleMapBottom);assert.ok(evidence.aroundMe.returnHome>0);assert.match(evidence.aroundMe.location,/AROUND ME/);await capture('around-me-expanded-390');await page.locator('#gridlyTemporaryContextReturnHome').click();assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().type),'HOME');assert.equal((await measure()).display,'none');await setExpanded(false);assert.notEqual((await measure()).display,'none');await page.evaluate(()=>requestGridlyForegroundPosition=window.__savedForeground);
  // Actual pointer drag in the exposed map area, with KBYG open.
  await setExpanded(true);const area=await page.evaluate(()=>({top:document.querySelector('.gridly-v2-segments').getBoundingClientRect().bottom,bottom:document.getElementById('mobileDestinationCommandPanel').getBoundingClientRect().top,center:map.getCenter()}));const y=(area.top+area.bottom)/2;await page.mouse.move(270,y);await page.mouse.down();await page.mouse.move(300,y+15,{steps:8});await page.mouse.up();await page.waitForTimeout(400);evidence.pan={before:area.center,after:await page.evaluate(()=>map.getCenter())};assert.notDeepEqual(evidence.pan.before,evidence.pan.after);
  // Bring one report into the exposed map through real pointer panning.
  // The brief may legitimately cover the initial marker coordinates.
  for(let attempt=0;attempt<5;attempt++) {
    const target=await page.evaluate(()=>{const top=document.querySelector('.gridly-v2-segments').getBoundingClientRect().bottom+32,bottom=document.getElementById('mobileDestinationCommandPanel').getBoundingClientRect().top-16,y=(top+bottom)/2;const points=unifiedIncidentLayer.getLayers().map(m=>{const r=m.getElement().getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}).sort((a,b)=>Math.hypot(a.x-195,a.y-y)-Math.hypot(b.x-195,b.y-y));return {point:points[0],goalY:y};});
    const dx=Math.max(-60,Math.min(60,195-target.point.x)),dy=Math.max(-60,Math.min(60,target.goalY-target.point.y));if(Math.abs(dx)<2&&Math.abs(dy)<2)break;
    await page.mouse.move(260-dx/2,target.goalY-dy/2);await page.mouse.down();await page.mouse.move(260+dx/2,target.goalY+dy/2,{steps:8});await page.mouse.up();await page.waitForTimeout(250);
  }
  const markerTap=await page.evaluate(()=>{const top=document.querySelector('.gridly-v2-segments').getBoundingClientRect().bottom,bottom=document.getElementById('mobileDestinationCommandPanel').getBoundingClientRect().top;return unifiedIncidentLayer.getLayers().map(m=>{const e=m.getElement(),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,id:m.options.incidentId,hit:y>top&&y<bottom&&e.contains(document.elementFromPoint(x,y))};}).find(x=>x.hit);});assert.ok(markerTap,'A visible hazard remains tappable');await page.mouse.click(markerTap.x,markerTap.y);await page.waitForFunction(()=>map._popup?.isOpen());evidence.markerTap={expected:markerTap.id,actual:await page.evaluate(()=>map._popup._source.options.incidentId)};assert.equal(evidence.markerTap.actual,markerTap.id);await page.locator('.leaflet-popup-close-button').click();
  await setExpanded(false);evidence.parity=await page.evaluate(()=>({hazards:activeHazards.length,markers:unifiedIncidentLayer.getLayers().length,pulse:gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount,kbyg:gridlyGetGovernedConsumerProjection().surfaces.kbygCommunity.length,alerts:getGridlyAlertsSurfaceActiveCommunityReportRows().length,location:document.getElementById('mobileAwarenessPanelIssues').textContent,undefinedm:document.body.innerText.includes('undefinedm')}));for(const k of ['hazards','markers','pulse','kbyg','alerts'])assert.equal(evidence.parity[k],3);assert.equal(evidence.parity.undefinedm,false);assert.deepEqual(markerHashes(),beforeMarkers);assert.equal(evidence.errors.length,0);evidence.passed=true;console.log('G1 visibility, restore, ownership and pan checks passed.');
})().catch(error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,process.env.GRIDLY_G1_BASELINE?'baseline.json':'browser.json'),JSON.stringify(evidence,null,2));await browser?.close();server.close();});
