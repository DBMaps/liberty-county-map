import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';
import {approvedBoardServer} from '../tools/dispatch-ui/approved-board.mjs';
import {markerCategories} from '../dispatch/marker-language.mjs';
import {records} from '../dispatch/demo/fixtures.mjs';
let browser,server,baseline,plain,base,approved,login;
const evidence=new URL('../reports/responder/dispatch-operational-map/',import.meta.url);
const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${s.address().port}`)));
before(async()=>{server=previewServer({demo:true});baseline=approvedBoardServer('4952fcc09586bf2c4a193e40b0dbdc4a57ff94f1');plain=previewServer();base=await listen(server);approved=await listen(baseline);login=await listen(plain);browser=await chromium.launch({headless:true,...(process.env.DISPATCH_BROWSER_CHANNEL?{channel:process.env.DISPATCH_BROWSER_CHANNEL}:{})});await mkdir(evidence,{recursive:true});});
after(async()=>{await browser?.close();server?.close();baseline?.close();plain?.close();});
async function visit(fn,{width=1440,height=900,theme='dark'}={}){const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(theme=>localStorage.setItem('gridlyDispatchTheme',theme),theme);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push({url:page.url(),message:e.message,stack:e.stack}));try{await fn(page);assert.deepEqual(errors,[]);}finally{await context.close();}}
const view=p=>p.getByRole('combobox',{name:'View',exact:true});
const ready=p=>p.locator('[data-marker]').first().waitFor();
const shot=(p,name)=>p.screenshot({path:new URL(name+'.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
const read=path=>readFile(new URL('../'+path,import.meta.url));
test('four categories reuse exact production Gridly PNGs and tip semantics',async()=>{
  assert.deepEqual(records.map(r=>r.mapCategory),['flooding','rail_blockage_delay','signal_outage','debris']);
  for(const {asset,tip}of Object.values(markerCategories)){assert.equal((await read('dispatch/assets/markers/'+asset)).equals(await read('assets/markers/png/'+asset)),true);assert.ok(tip>.7&&tip<.9);}
  const data=JSON.parse(await read('dispatch/demo/dayton-context.geojson'));assert.equal(data.features.length,33);assert.equal(data.features.filter(f=>f.properties.layer==='rail').length,11);assert.equal(data.features.filter(f=>f.properties.layer==='water').length,4);assert.equal(data.features.filter(f=>f.properties.layer==='crossing').length,12);assert.equal(data.features.find(f=>f.properties.layer==='locality').properties.name,'Dayton');assert.doesNotMatch(JSON.stringify(data),/Sample Railroad|"user"|"uid"/);
});
test('street, highway, locality and rail labels orient at normal fit zoom',()=>visit(async p=>{
  await p.goto(base+'/?demo=1&view=split');await ready(p);const labels=await p.locator('[data-context-label]').allTextContents();assert.ok(labels.length>=8);assert.ok(labels.includes('FM 1960'));assert.ok(labels.some(s=>/Main St|Winfree St/.test(s))); // Marker exclusion can suppress the other nearby name.
  assert.ok(await p.locator('.label-rail').count()>0);if(!labels.includes('Dayton'))await p.getByRole('button',{name:'Zoom out',exact:true}).click();assert.ok((await p.locator('[data-context-label]').allTextContents()).includes('Dayton'));
}));
test('category markers, enriched authority/source popup and keyboard drawer path',()=>visit(async p=>{
  await p.goto(base+'/?demo=1&view=map');await ready(p);
  for(const [id,asset]of [['DEMO-001','water-over-road.png'],['DEMO-002','train-front.png']]){const marker=p.locator(`[data-marker="${id}"]`);assert.equal(await marker.locator('img').getAttribute('src'),'./assets/markers/'+asset);assert.doesNotMatch(await marker.innerText(),/^[HML]$/);assert.match(await marker.getAttribute('aria-label'),/Street/);}
  await p.locator('[data-marker="DEMO-002"]').focus();await p.keyboard.press('Enter');const popup=p.locator('.dispatch-popup');await popup.waitFor();const text=await popup.innerText();for(const value of ['Rail Crossing Blocked','Main Street crossing','Moderate','Active','Dayton Police Department','Community report','12 min ago','DEMO-002','Needs review','Publication off','Authority unverified'])assert.ok(text.includes(value),value);
  assert.equal(await p.locator('[data-select="DEMO-002"]').getAttribute('aria-pressed'),'true');await popup.getByRole('button',{name:'View details'}).click();await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');assert.equal(await popup.getByRole('button',{name:'View details'}).evaluate(e=>e===document.activeElement),true);
  await p.getByLabel('ACTING UNIT').selectOption('works');await ready(p);assert.match(await p.locator('[data-marker="DEMO-003"] img').getAttribute('src'),/traffic-signal-issue/);assert.match(await p.locator('[data-marker="DEMO-004"] img').getAttribute('src'),/debris-in-road/);assert.equal(await p.locator('[data-marker="DEMO-004"] .marker-state').innerText(),'✓');assert.equal(await p.locator('[data-marker="DEMO-002"]').count(),0);
}));
test('context failure retains list, retries and leaves Board usable; all additions gated',()=>visit(async p=>{
  await p.route('**/dayton-context.geojson',r=>r.fulfill({status:503,body:''}));await p.goto(base+'/?demo=1&view=map');await p.getByText('Map unavailable',{exact:true}).waitFor();assert.equal(await p.locator('[data-select]').count(),2);await shot(p,'dark-context-error');await view(p).selectOption('board');assert.equal(await p.locator('tbody tr').count(),2);await view(p).selectOption('map');await p.getByText('Map unavailable',{exact:true}).waitFor();await p.unroute('**/dayton-context.geojson');await p.getByRole('button',{name:'Retry map'}).click();await ready(p);
  for(const path of ['basemap.mjs','marker-language.mjs','demo/dayton-context.geojson','demo/dayton-context-provenance.json','assets/markers/train-front.png'])assert.equal((await fetch(login+'/'+path)).status,404);
}));
test('offline reads only, attributed downloadable context, no consumer runtime import',()=>visit(async p=>{
  const requests=[];p.on('request',r=>requests.push([r.url(),r.method()]));await p.goto(base+'/?demo=1&view=split');await ready(p);await p.getByRole('combobox',{name:'Theme',exact:true}).selectOption('light');assert.ok(requests.every(([url,method])=>url.startsWith(base+'/')&&method==='GET'));assert.match(await p.locator('.map-credit').innerText(),/OpenStreetMap contributors.*ODbL context.*Leaflet/s);for(const name of ['basemap.mjs','marker-language.mjs','map-view.mjs'])assert.doesNotMatch((await read('dispatch/'+name)).toString(),/from\s+['"]\.\.\/|window\.Gridly|RouteWatch|supabase|\.insert\(|\.rpc\(/);
}));
test('light/dark context overview and remaining category icons; System changes preserve selection',()=>visit(async p=>{
  await p.goto(base+'/?demo=1&view=map');await ready(p);
  for(const theme of ['dark','light']){await p.getByRole('combobox',{name:'Theme',exact:true}).selectOption(theme);await p.getByRole('button',{name:'Zoom out',exact:true}).click();await p.getByRole('button',{name:'Zoom out',exact:true}).click();await shot(p,theme+'-context-overview');await p.getByLabel('ACTING UNIT').selectOption('works');await ready(p);await shot(p,theme+'-works-categories');await p.getByLabel('ACTING UNIT').selectOption('police');await ready(p);}
  await p.locator('[data-select="DEMO-001"]').click();await p.emulateMedia({colorScheme:'light'});await p.getByRole('combobox',{name:'Theme',exact:true}).selectOption('system');const before=await p.locator('[data-marker="DEMO-001"]').getAttribute('style');await p.emulateMedia({colorScheme:'dark'});await p.locator('html[data-theme=dark]').waitFor();assert.equal(await p.locator('[data-marker="DEMO-001"]').getAttribute('style'),before);assert.equal(await p.locator('[data-select="DEMO-001"]').getAttribute('aria-pressed'),'true');
}));
for(const theme of ['dark','light'])for(const [width,height]of [[1440,900],[1920,1080],[1280,720],[1024,768]])test(`${theme} ${width}x${height}: approved Board exact, Split/Map geometry preserved and operational screenshots`,()=>visit(async p=>{
  await p.goto(approved+'/?demo=1');await p.locator('tbody tr').first().waitFor();const before=await protectedShot(p);const bounds={};
  for(const mode of ['split','map']){await view(p).selectOption(mode);await ready(p);bounds[mode]=await p.locator('.geo-layout,.geo-list-panel,#dispatch-map,.geo-filters,.geo-list-row').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));}
  await p.goto(base+'/?demo=1');await p.locator('tbody tr').first().waitFor();await p.mouse.move(0,0);assert.equal(before.equals(await protectedShot(p)),true,'Entire approved Board including View selector must match');await shot(p,`${theme}-${width}x${height}-board`);
  for(const mode of ['split','map']){await view(p).selectOption(mode);await ready(p);await p.evaluate(()=>scrollTo(0,0));const now=await p.locator('.geo-layout,.geo-list-panel,#dispatch-map,.geo-filters,.geo-list-row').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));assert.deepEqual(now,bounds[mode]);await shot(p,`${theme}-${width}x${height}-${mode}`);const id=mode==='split'?'DEMO-001':'DEMO-002';await p.locator(`[data-select="${id}"]`).click();await shot(p,`${theme}-${width}x${height}-${mode}-selected`);await p.locator('#dispatch-map').screenshot({path:new URL(`${theme}-${width}x${height}-${mode}-closeup.png`,evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});await p.locator('.dispatch-popup').getByRole('button',{name:'View details'}).click();await p.getByRole('dialog').waitFor();await shot(p,`${theme}-${width}x${height}-${mode}-detail`);await p.keyboard.press('Escape');}
},{theme,width,height}));

// Only the additive preview entry is hidden; all historical pixels remain checked.
async function protectedShot(page,options={}){const entry=page.locator('.notice-entry'),previous=await entry.evaluateAll(es=>es.map(e=>e.style.visibility));await entry.evaluateAll(es=>es.forEach(e=>e.style.visibility='hidden'));try{return await page.screenshot(options);}finally{await entry.evaluateAll((es,values)=>es.forEach((e,i)=>e.style.visibility=values[i]||''),previous);}}
