const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const root = process.cwd();
const output = path.join(root, '.artifacts/lp24449b1/freeze');
fs.mkdirSync(output, { recursive: true });
const evidence = { auditMode: process.env.GRIDLY_H_FLOW_ONLY === '1' ? 'flow-only' : process.env.GRIDLY_H_RAIL_ONLY === '1' ? 'rail-only' : 'combined', consoleErrors: [], profiles: [], refreshes: [], widths: [], location: [], errors: [], warnings: [], blockedRequests: [] };
evidence.sourceHash = crypto.createHash('sha256').update(fs.readFileSync('js/app.js')).digest('hex');
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
  const context = await makeContext(null);
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

  evidence.settings=[];evidence.viewports=[];
  const appearance=async()=>{if(!await page.locator('#gridlyPortraitV2SheetClose').isVisible())await page.locator('#gridlySettingsDockButton').click();const summary=page.locator('#gridlyPortraitV2Sheet summary').filter({hasText:'Appearance'});if(!await summary.evaluate(n=>n.parentElement.open))await summary.click();};
  const state=()=>page.evaluate(()=>({stored:JSON.parse(localStorage.getItem('gridlySettingsV1')).display,mapStored:localStorage.getItem('gridlyMapStyleV1'),settings:getGridlySettingsPreferences().display,activeLayer:activeBaseLayerName,layers:Object.entries(mapBaseLayersByName).filter(([,layer])=>map.hasLayer(layer)).map(([name])=>name),theme:document.documentElement.dataset.gridlyTheme,effective:document.documentElement.dataset.gridlyEffectiveTheme,groups:[...document.querySelectorAll('.settings-display-choice [role=radiogroup]')].map(g=>({name:g.getAttribute('aria-label'),radios:[...g.querySelectorAll('[role=radio]')].map(n=>({label:n.textContent,value:n.dataset.value,checked:n.getAttribute('aria-checked'),tab:n.tabIndex,rect:n.getBoundingClientRect().toJSON(),color:getComputedStyle(n).color,background:getComputedStyle(n).backgroundColor}))})),nativeSelects:document.querySelectorAll('select[data-v2-settings-field="display.mapStyle"],select[data-v2-settings-field="display.theme"]').length}));
  const verify=async(label,expected)=>{await page.waitForFunction(()=>{const radios=[...document.querySelectorAll('.settings-display-choice [role=radio]')];return radios.length===5&&radios.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;});});const s=await state();for(const [k,v]of Object.entries(expected))assert.equal(s.stored[k],v);assert.deepEqual(s.stored,s.settings);assert.equal(s.activeLayer,s.settings.mapStyle==='satellite'?'Satellite':'Standard');assert.deepEqual(s.layers,[s.activeLayer]);assert.equal(s.mapStored,s.activeLayer);assert.equal(s.theme,s.settings.theme);assert.equal(s.nativeSelects,0);for(const g of s.groups){assert.equal(g.radios.filter(r=>r.checked==='true').length,1);assert.equal(g.radios.filter(r=>r.tab===0).length,1);for(const r of g.radios)assert.ok(r.rect.height>=44&&r.rect.width>=44,'Comfortable target '+r.label);}evidence.settings.push({label,...s});return s;};
  await appearance();const defaults=await verify('fresh-defaults',{mapStyle:'standard',theme:'system'});evidence.defaults=defaults.stored;
  const home=await page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlyUserProfileV1','gridlySavedPlacesV1'].map(k=>[k,localStorage.getItem(k)])));
  for(const [group,label,field,value]of [['Map Style','Standard','mapStyle','standard'],['Map Style','Satellite','mapStyle','satellite'],['Map Style','Standard','mapStyle','standard'],['Theme','Device','theme','system'],['Theme','Light','theme','light'],['Theme','Dark','theme','dark'],['Theme','Device','theme','system']]){
    await appearance();await page.getByRole('radiogroup',{name:group,exact:true}).getByRole('radio',{name:label,exact:true}).click();await page.waitForTimeout(400);await verify('saved-'+field+'-'+value,{[field]:value});await page.screenshot({path:path.join(output,'settings-saved-'+field+'-'+value+'.png')});await page.locator('#gridlyPortraitV2SheetClose').click();await appearance();await verify('reopened-'+field+'-'+value,{[field]:value});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof getGridlySettingsPreferences==='function'&&map&&mapBaseLayersByName.Standard&&activeBaseLayerName);await appearance();await verify('reloaded-'+field+'-'+value,{[field]:value});
  }
  const theme=page.getByRole('radiogroup',{name:'Theme',exact:true});await theme.getByRole('radio',{name:'Device',exact:true}).focus();await page.keyboard.press('ArrowRight');await verify('keyboard-right',{theme:'light'});await page.keyboard.press('End');await verify('keyboard-end',{theme:'dark'});await page.keyboard.press('Home');await verify('keyboard-home',{theme:'system'});await page.keyboard.press('ArrowLeft');await verify('keyboard-wrap',{theme:'dark'});await page.keyboard.press('Home');await page.keyboard.press('Space');await verify('keyboard-space',{theme:'system'});
  await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(700);assert.equal((await state()).effective,'dark');await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(700);assert.equal((await state()).effective,'light');
  for(const width of [320,360,390,440])for(const textSize of ['standard','large','compact']){
    await page.setViewportSize({width,height:844});await page.locator('[data-gridly-settings-text-size-option="'+textSize+'"]').click();await page.waitForTimeout(350);await page.locator('.settings-display-choice').first().scrollIntoViewIfNeeded();const s=await verify('viewport-'+width+'-'+textSize,{textSize});for(const g of s.groups){for(const r of g.radios){assert.ok(r.rect.left>=0&&r.rect.right<=width,'No clipped choice');assert.ok(Math.abs(r.rect.width-g.radios[0].rect.width)<1,'Equal choice columns');}if(g.name==='Map Style')assert.ok(g.radios[1].rect.right-g.radios[0].rect.left>width-100,'Map Style uses the full choice row');}await page.screenshot({path:path.join(output,'settings-'+width+'-'+textSize+'.png')});evidence.viewports.push({width,textSize,groups:s.groups});
  }
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlyUserProfileV1','gridlySavedPlacesV1'].map(k=>[k,localStorage.getItem(k)]))),home);assert.equal(evidence.errors.length,0);evidence.passed=true;console.log('H1 Settings persistence, reload, keyboard and 12 viewport/text cases passed.');
})().catch(error=>{evidence.failure=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(output,'settings.json'),JSON.stringify(evidence,null,2));await browser?.close();server.close();});
