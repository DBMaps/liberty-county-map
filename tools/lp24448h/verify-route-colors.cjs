const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24448h');
fs.mkdirSync(output, { recursive: true });
const evidence = { auditMode: process.env.GRIDLY_H_ROUTE_ACTIONS_ONLY ? 'route-actions' : 'route-colors', consoleErrors: [], profiles: [], refreshes: [], widths: [], location: [], errors: [], warnings: [], blockedRequests: [] };
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

  await page.evaluate(()=>{gridlyLocalTestReports.clear();gridlyLocalTestReports.add('reported-crossing-delay',{crossingId:'FRA-762786W'});});
    await context.route('https://router.project-osrm.org/route/v1/driving/**',async route=>{const coordinates=decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()).split(';').map(p=>p.split(',').map(Number));await route.fulfill({contentType:'application/json',body:JSON.stringify({code:'Ok',routes:[{distance:8000,duration:600,geometry:{type:'LineString',coordinates},legs:[{distance:8000,duration:600,steps:[]}]}],waypoints:coordinates.map(location=>({location,distance:0,name:'Local fixture'}))})});});

  await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlyAddressSearchInput').fill('Dayton');await page.locator('#gridlyRemoteSearchBtn').click();await page.locator('#gridlySearchResults button').filter({hasText:'Dayton'}).first().click();await page.locator('#gridlyDestinationPreviewBtn').click();await page.waitForTimeout(900);await page.locator('#mobileDestinationCommandImpact').click();
  evidence.routeColors=[];
  for(const [theme,system] of (process.env.GRIDLY_H_ROUTE_ACTIONS_ONLY ? [] : [['system','light'],['system','dark'],['light','dark'],['dark','light']])){
    await page.emulateMedia({colorScheme:system});await page.evaluate(theme=>applyGridlySettingsDisplayPreferences({theme,textSize:'large',mapStyle:'standard'},'h-route-colors'),theme);await page.waitForTimeout(700);
    for(const [width,height] of [[320,844],[360,844],[390,844],[440,844],[390,500]]){
      await page.setViewportSize({width,height});await page.waitForTimeout(250);
      const result=await page.evaluate(()=>{const root=getComputedStyle(document.body),primary=root.getPropertyValue('--gridly-text-primary').trim(),secondary=root.getPropertyValue('--gridly-text-secondary').trim();const resolve=value=>{const probe=document.createElement('span');probe.style.color=value;document.body.append(probe);const c=getComputedStyle(probe).color;probe.remove();return c;};return {primary:resolve(primary),secondary:resolve(secondary),rows:['#gridlyDestinationImpactPaneTitle','#gridlyCurrentRouteLine','#gridlyDestinationImpactPaneSeverity','#gridlyDestinationImpactPaneSubtitle','#gridlyCurrentRouteMeta'].map(selector=>{const n=document.querySelector(selector),s=getComputedStyle(n);return {selector,color:s.color,text:n.textContent,rect:n.getBoundingClientRect().toJSON()};})};});
      result.rows.forEach((r,i)=>assert.equal(r.color,i<3?result.primary:result.secondary,r.selector));
      await page.locator('#gridlyDestinationImpactManageRouteBtn').scrollIntoViewIfNeeded();assert.equal(await page.locator('#gridlyDestinationImpactManageRouteBtn').isVisible(),true);
      await page.locator('.gridly-destination-impact-card').evaluate(n=>n.scrollTop=n.scrollHeight);const lastReason=await page.locator('#gridlyDestinationImpactPaneReasons li').last().boundingBox(),actions=await page.locator('.gridly-destination-impact-actions').boundingBox();assert.ok(lastReason.y+lastReason.height<=actions.y+2,'Last route reason is readable above the sticky actions');await page.locator('.gridly-destination-impact-card').evaluate(n=>n.scrollTop=0);await page.screenshot({path:path.join(output,'route-colors-'+theme+'-'+system+'-'+width+'x'+height+'.png')});evidence.routeColors.push({theme,system,width,height,...result});
    }
  }
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({colorScheme:'light'});await page.evaluate(()=>applyGridlySettingsDisplayPreferences({theme:'light',textSize:'large',mapStyle:'standard'},'h-route-actions'));await page.waitForTimeout(700);await page.locator('#gridlyDestinationImpactManageRouteBtn').click();assert.equal(await page.evaluate(()=>routeWatchActivated),true);await page.screenshot({path:path.join(output,'route-watch-final-390.png')});await page.locator('#gridlyDestinationImpactStopWatchBtn').click();assert.equal(await page.evaluate(()=>routeWatchActivated),false);evidence.startStop=true;
  assert.equal(evidence.errors.length,0);evidence.passed=true;console.log('Route Details accepted: '+evidence.routeColors.length+' theme/viewport cases; Start/Stop passed.');
})().catch(error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,process.env.GRIDLY_H_ROUTE_ACTIONS_ONLY?'route-actions.json':'route-colors.json'),JSON.stringify(evidence,null,2));await browser?.close();server.close();});
