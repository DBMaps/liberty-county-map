import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';
import {approvedBoardServer} from '../tools/dispatch-ui/approved-board.mjs';
let browser,server,baseline,plain,base,approved,loginOnly;
const evidence=new URL('../reports/responder/dispatch-map/',import.meta.url);
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
before(async()=>{server=previewServer({demo:true});baseline=approvedBoardServer();plain=previewServer();base=await listen(server);approved=await listen(baseline);loginOnly=await listen(plain);browser=await chromium.launch({headless:true,...(process.env.DISPATCH_BROWSER_CHANNEL?{channel:process.env.DISPATCH_BROWSER_CHANNEL}:{})});await mkdir(evidence,{recursive:true});});
after(async()=>{await browser?.close();server?.close();baseline?.close();plain?.close();});
async function visit(fn,{width=1440,height=900,theme='dark',stored}={}){
  const context=await browser.newContext({viewport:{width,height}});
  await context.addInitScript(({theme,stored})=>{localStorage.setItem('gridlyDispatchTheme',theme);if(stored!==undefined)localStorage.setItem('gridlyDispatchView',stored);},{theme,stored});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{await fn(page);assert.deepEqual(errors,[]);}finally{await context.close();}
}
const view=page=>page.getByRole('combobox',{name:'View',exact:true});
const open=async(page,path='/?demo=1')=>{await page.goto(base+path);await view(page).waitFor();};
const ready=page=>page.locator('.dispatch-marker').first().waitFor();
const capture=(page,name)=>page.screenshot({path:new URL(name+'.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});

test('Board default, explicit preference persistence and all mode transitions',()=>visit(async page=>{
  await open(page);assert.equal(await view(page).inputValue(),'board');assert.equal(await page.evaluate(()=>localStorage.getItem('gridlyDispatchView')),null);
  for(const mode of ['split','map','board']){await view(page).selectOption(mode);assert.equal(await view(page).inputValue(),mode);if(mode!=='board')await ready(page);else assert.equal(await page.locator('tbody tr').count(),2);}
  await view(page).selectOption('split');await page.reload();await ready(page);assert.equal(await view(page).inputValue(),'split');
}));
for(const stored of ['bad','MAP',''])test(`invalid view ${JSON.stringify(stored)} falls back to Board`,()=>visit(async page=>{await open(page);assert.equal(await view(page).inputValue(),'board');},{stored}));
test('storage unavailable keeps working and deep links are local/demo only',()=>visit(async page=>{
  await page.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('unavailable');}}));await open(page);await view(page).selectOption('split');await ready(page);
  await page.goto(loginOnly+'/?demo=1&view=map');await page.getByRole('heading',{name:'Welcome to Dispatch'}).waitFor();assert.equal(await view(page).count(),0);
}));
test('filters/search/theme/active unit persist across modes with consistent visible incident eligibility',()=>visit(async page=>{
  await open(page);await page.getByLabel('ACTING UNIT').selectOption('works');await page.getByLabel('Search reports').fill('Signal');
  for(const [key,value]of [['severity','Moderate'],['status','Monitoring'],['source','Agency-created'],['review','Reviewed']])await page.locator(`[data-filter="${key}"]`).selectOption(value);
  for(const mode of ['split','map','board']){await view(page).selectOption(mode);assert.equal(await page.getByLabel('Search reports').inputValue(),'Signal');assert.equal(await page.getByLabel('ACTING UNIT').inputValue(),'works');assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');for(const [key,value]of [['severity','Moderate'],['status','Monitoring'],['source','Agency-created'],['review','Reviewed']])assert.equal(await page.locator(`[data-filter="${key}"]`).inputValue(),value);if(mode!=='board'){await ready(page);assert.equal(await page.locator('[data-marker]').count(),1);assert.equal(await page.locator('[data-marker]').getAttribute('data-marker'),'DEMO-003');}else assert.equal(await page.locator('tbody tr').count(),1);}
}));
test('list and marker selection synchronize; same drawer preserves selection, theme, view and focus',()=>visit(async page=>{
  await open(page,'/?demo=1&view=split');await ready(page);await page.locator('[data-select="DEMO-001"]').click();assert.equal(await page.locator('[data-marker="DEMO-001"]').getAttribute('aria-pressed'),'true');
  await page.locator('.leaflet-popup-close-button').click();await page.locator('[data-marker="DEMO-002"]').click();assert.equal(await page.locator('[data-select="DEMO-002"]').getAttribute('aria-pressed'),'true');
  const details=page.locator('.dispatch-popup').getByRole('button',{name:'View details'});await details.click();await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await details.evaluate(node=>node===document.activeElement),true);assert.equal(await view(page).inputValue(),'split');assert.equal(await page.locator('[data-marker="DEMO-002"]').getAttribute('aria-pressed'),'true');
  await view(page).selectOption('map');await ready(page);assert.equal(await page.locator('[data-select="DEMO-002"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-detail="DEMO-001"]').click();await page.getByRole('heading',{name:'Flooded Roadway',exact:true}).waitFor();await page.getByRole('button',{name:'Close report detail'}).click();assert.equal(await view(page).inputValue(),'map');assert.equal(await page.locator('[data-select="DEMO-001"]').getAttribute('aria-pressed'),'true');
}));
test('keyboard view selector and equivalent non-map incident actions',()=>visit(async page=>{
  await open(page);await view(page).focus();await page.keyboard.press('End');await page.keyboard.press('Enter');await ready(page);assert.equal(await view(page).inputValue(),'map');
  const row=page.locator('[data-select="DEMO-001"]');await row.focus();await page.keyboard.press('Enter');assert.equal(await row.getAttribute('aria-pressed'),'true');
  const marker=page.locator('[data-marker="DEMO-002"]');await marker.focus();await page.keyboard.press('Space');assert.equal(await marker.getAttribute('aria-pressed'),'true');assert.match(await marker.getAttribute('aria-label'),/Moderate.*Active.*Main Street/);
  await page.locator('[data-detail="DEMO-002"]').focus();await page.keyboard.press('Enter');await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('[data-detail="DEMO-002"]').evaluate(node=>node===document.activeElement),true);
}));
test('empty-filter map remains visible, unit changes remove previous markers',()=>visit(async page=>{
  await open(page,'/?demo=1&view=map');await ready(page);await page.getByLabel('Search reports').fill('not-a-report');await page.getByText('No incidents match the current filters.',{exact:true}).last().waitFor();assert.equal(await page.locator('[data-marker]').count(),0);assert.equal(await page.locator('.leaflet-container').count(),1);
  await page.getByRole('button',{name:'Reset',exact:true}).click();await ready(page);await page.getByLabel('ACTING UNIT').selectOption('works');await ready(page);assert.equal(await page.locator('[data-marker="DEMO-001"]').count(),0);assert.equal(await page.locator('[data-marker="DEMO-004"]').count(),1);
}));
test('data failure permits retry and Board recovery without losing records',()=>visit(async page=>{
  await page.route('**/dayton-roads.geojson',route=>route.fulfill({status:503,body:''}));await open(page,'/?demo=1&view=map');await page.getByText('Map unavailable',{exact:true}).waitFor();assert.equal(await page.locator('[data-select]').count(),2);await capture(page,'dark-1440x900-map-error');await page.getByRole('combobox',{name:'Theme',exact:true}).selectOption('light');await capture(page,'light-1440x900-map-error');
  await view(page).selectOption('board');assert.equal(await page.locator('tbody tr').count(),2);await view(page).selectOption('map');await page.getByText('Map unavailable',{exact:true}).waitFor();await page.unroute('**/dayton-roads.geojson');await page.getByRole('button',{name:'Retry map',exact:true}).click();await ready(page);
}));
test('library failure cannot break Board',()=>visit(async page=>{
  await page.route('**/vendor/leaflet/leaflet.js',route=>route.abort());await open(page,'/?demo=1&view=split');await page.getByText('Map unavailable',{exact:true}).waitFor();await view(page).selectOption('board');assert.equal(await page.locator('tbody tr').count(),2);
}));
test('System theme updates map roads and preserves camera, selection and records',()=>visit(async page=>{
  await page.emulateMedia({colorScheme:'light'});await open(page,'/?demo=1&view=map&theme=system');await ready(page);await page.locator('[data-select="DEMO-001"]').click();
  const position=await page.locator('[data-marker="DEMO-001"]').getAttribute('style');const land=await page.locator('#dispatch-map').evaluate(node=>getComputedStyle(node).backgroundColor);
  await page.emulateMedia({colorScheme:'dark'});await page.locator('html[data-theme=dark]').waitFor();assert.notEqual(await page.locator('#dispatch-map').evaluate(node=>getComputedStyle(node).backgroundColor),land);assert.equal(await page.locator('[data-marker="DEMO-001"]').getAttribute('style'),position);assert.equal(await page.locator('[data-select="DEMO-001"]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-marker]').count(),2);
}));
test('only local reads; fixtures/vendor gated; offline data/licensing/vendor isolation',()=>visit(async page=>{
  const requests=[];page.on('request',request=>requests.push({url:request.url(),method:request.method()}));await open(page,'/?demo=1&view=map');await ready(page);await page.getByRole('combobox',{name:'Theme',exact:true}).selectOption('light');assert.ok(requests.every(request=>request.url.startsWith(base+'/')&&request.method==='GET'));
  for(const path of ['demo/dayton-roads.geojson','demo/dayton-roads-provenance.json','map-view.mjs','vendor/leaflet/leaflet.js'])assert.equal((await fetch(loginOnly+'/'+path)).status,404);
  const read=path=>readFile(new URL('../'+path,import.meta.url));
  const roads=JSON.parse(await read('dispatch/demo/dayton-roads.geojson'));assert.equal(roads.features.length,331);assert.ok(roads.features.every(feature=>feature.geometry.coordinates.every(([x,y])=>x>=-94.95&&x<=-94.85&&y>=30.015&&y<=30.085)));assert.match(roads.license,/odbl/);
  const hash=async path=>createHash('sha256').update(await read(path)).digest('hex');assert.equal(await hash('dispatch/vendor/leaflet/leaflet.js'),await hash('node_modules/leaflet/dist/leaflet.js'));
  assert.doesNotMatch((await read('dispatch/map-view.mjs')).toString(),/from ['"]\.\.\/(?:js|lib)|supabase|resend|\.rpc\(|\.insert\(/i);
  assert.match(await page.locator('.map-credit').innerText(),/OpenStreetMap contributors/);
}));
for(const theme of ['light','dark'])for(const [width,height]of [[1440,900],[1920,1080],[1280,720],[1024,768]])test(`${theme} ${width}x${height}: exact protected Board and additive map screenshots`,()=>visit(async page=>{
  await page.goto(approved+'/?demo=1');await page.locator('tbody tr').first().waitFor();const before=await page.screenshot();
  await open(page);await page.locator('tbody tr').first().waitFor();await view(page).evaluate(node=>node.parentElement.style.visibility='hidden');const after=await page.screenshot();assert.equal(before.equals(after),true,'Approved Board pixels must match exactly outside the view selector');await page.locator('#dispatch-view').evaluate(node=>node.parentElement.style.visibility='');await capture(page,`${theme}-${width}x${height}-board`);
  for(const mode of ['split','map']){await view(page).selectOption(mode);await ready(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await capture(page,`${theme}-${width}x${height}-${mode}`);await page.locator('[data-select="DEMO-001"]').click();await capture(page,`${theme}-${width}x${height}-${mode}-selected`);await page.locator('.dispatch-popup').getByRole('button',{name:'View details'}).click();await page.getByRole('dialog').waitFor();await capture(page,`${theme}-${width}x${height}-${mode}-detail`);await page.keyboard.press('Escape');}
  await page.getByLabel('Search reports').fill('no-match');await capture(page,`${theme}-${width}x${height}-map-empty`);
  await page.getByRole('button',{name:'Reset',exact:true}).click();await view(page).selectOption('board');await page.locator('#dispatch-view').evaluate(node=>{node.blur();node.parentElement.style.visibility='hidden';});await page.mouse.move(0,0);await page.evaluate(()=>window.scrollTo(0,0));assert.equal(before.equals(await page.screenshot()),true,'Board must remain identical after map library/styles have loaded');
},{theme,width,height}));
