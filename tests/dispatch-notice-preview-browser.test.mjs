import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';
let browser,server,plain,base,login;
const evidence=new URL('../reports/responder/dispatch-visual/',import.meta.url);
const data=JSON.parse(await readFile(new URL('../dispatch/demo/dayton-roads.geojson',import.meta.url)));
const key='gridlyDispatchNoticePreview.v1.DEMO-DAYTON.police';
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r('http://127.0.0.1:'+s.address().port)));
before(async()=>{server=previewServer({demo:true});plain=previewServer();base=await listen(server);login=await listen(plain);browser=await chromium.launch({headless:true,channel:process.env.DISPATCH_BROWSER_CHANNEL||'msedge'});await mkdir(evidence,{recursive:true});});
after(async()=>{await browser?.close();server?.close();plain?.close();});
async function visit(fn,{theme='light',width=1440,height=900}={}){
 const c=await browser.newContext({viewport:{width,height}});await c.addInitScript(t=>localStorage.setItem('gridlyDispatchTheme',t),theme);
 const p=await c.newPage(),errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>requests.push([r.url(),r.method()]));
 await c.route('**/*',route=>route.request().url().startsWith(base+'/')||route.request().url().startsWith(login+'/')?route.continue():route.abort());
 try{await fn(p,requests);assert.deepEqual(errors,[]);assert.ok((await p.evaluate(()=>Object.keys(sessionStorage))).every(k=>/^gridlyDispatchNoticePreview\.v1\.DEMO-DAYTON\.(police|works)$/.test(k)));assert.ok(requests.every(([u,m])=>(u.startsWith(base+'/')||u.startsWith(login+'/'))&&m==='GET'));}
 finally{await c.close();}
}
async function open(p,map=true){await p.getByRole('button',{name:'Draft Notice Preview',exact:true}).click();await p.locator('#notice-search').waitFor();if(map)await p.locator('#notice-map.leaflet-container').waitFor();}
async function select(p,q='Main'){await p.locator('#notice-search').fill(q);const b=p.locator('[data-add]').first();await b.focus();await p.keyboard.press('Enter');return b.getAttribute('data-add');}
async function details(p){await p.locator('#notice-next').click();await p.locator('#notice-subject').waitFor();}
async function fill(p,choice='continuous'){await p.locator('#notice-subject').fill('Synthetic maintenance notice');await p.locator('#notice-body').fill('Demonstration work along selected source lines. Traffic restriction scheduling does not establish roadway status.');await p.locator('#notice-reference').fill('Demo reference only — no URL fetched.');if(choice)await p.locator('#restriction-choice').selectOption(choice);}
async function exceptions(p){await p.locator('#notice-exceptions > summary').click();}
async function back(p){await p.locator('#notice-back').click();}
const shot=(p,n)=>p.screenshot({path:fileURLToPath(new URL('notice-ux-'+n+'.png',evidence))});
const stored=p=>p.evaluate(k=>JSON.parse(sessionStorage.getItem(k)),key);
async function noOverflow(p,originalWidth){
 assert.equal(await p.locator('.notice-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 assert.equal(await p.locator('.notice-step-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),originalWidth,'Preview must not increase existing dashboard width');
 const visible=await p.locator('.notice-footer').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});assert.ok(visible,'Navigation remains within viewport');
}
for(const theme of ['light','dark'])for(const [width,height]of [[1440,900],[1920,1080],[1280,720],[1024,768],[390,844]])test(theme+' '+width+' three-step geometry/review/recovery and keyboard workflow',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await p.locator('tbody tr').first().waitFor();
 const originalWidth=await p.evaluate(()=>document.documentElement.scrollWidth);await shot(p,theme+'-'+width+'-dashboard');
 const entry=p.getByRole('button',{name:'Draft Notice Preview',exact:true});await open(p);
 assert.equal(await p.locator('#notice-next').isDisabled(),true);assert.equal(await p.locator('#notice-subject').count(),0);
 const id=await select(p);assert.equal(await p.locator('[data-remove]').count(),1);
 const selected=await p.locator('#notice-map').evaluate(e=>e._previewGeometry.features[0]);
 assert.deepEqual(selected.geometry,data.features.find(f=>id.endsWith(':'+f.properties.osmId)).geometry);
 await p.locator('#notice-search').fill('US 90');await p.locator('[data-add]').first().click();await p.locator('[data-add]').first().click();
 assert.equal(await p.locator('[data-remove]').count(),2);await noOverflow(p,originalWidth);
 await p.locator('#notice-map').scrollIntoViewIfNeeded();await shot(p,theme+'-'+width+'-step1');
 await details(p);assert.equal(await p.locator('#notice-map').count(),0);
 assert.equal(await p.locator('#restriction-choice').inputValue(),'');
 assert.equal(await p.locator('#notice-exceptions').getAttribute('open'),null);
 await fill(p,null);await p.locator('#notice-check').click();
 assert.match(await p.locator('.notice-message').innerText(),/Choose when/);assert.equal(await p.locator('#notice-review').count(),0);
 await p.locator('#restriction-choice').selectOption('continuous');
 assert.deepEqual(await p.locator('[data-day="work"]').evaluateAll(es=>es.map(e=>Number(e.value))),[1,2,3,4,5,6,0]);
 await noOverflow(p,originalWidth);await shot(p,theme+'-'+width+'-step2');
 await p.locator('#restriction-choice').scrollIntoViewIfNeeded();await shot(p,theme+'-'+width+'-schedules');
 await exceptions(p);await p.locator('#work-date').fill('2026-10-12');await p.locator('[data-exception="work"]').click();
 await p.locator('#notice-exceptions').scrollIntoViewIfNeeded();await shot(p,theme+'-'+width+'-exceptions');await noOverflow(p,originalWidth);
 await back(p);assert.equal(await p.locator('[data-remove]').count(),2);await details(p);
 assert.equal(await p.locator('#notice-subject').inputValue(),'Synthetic maintenance notice');
 await p.locator('#notice-check').click();assert.equal(await p.locator('#notice-subject').count(),0);
 const review=await p.locator('#notice-review').innerText();
 assert.match(review,/4 exact occurrences/);assert.match(review,/7 exact occurrences/);assert.match(review,/2026-10-12/);
 assert.match(review,/Work scheduled/);assert.match(review,/Traffic restrictions scheduled/);assert.match(review,/Central Time \(America\/Chicago\)/);
 await noOverflow(p,originalWidth);await shot(p,theme+'-'+width+'-step3');
 await p.locator('.notice-days').scrollIntoViewIfNeeded();await shot(p,theme+'-'+width+'-review-days');
 await p.locator('#notice-save').click();assert.match(await p.locator('.notice-top').innerText(),/Revision 1/);
 const saved=(await stored(p)).notices[0];assert.equal(saved.selected.length,2);assert.equal(saved.workOccurrences.length,4);assert.equal(saved.restrictionOccurrences.length,7);
 await p.keyboard.press('Escape');assert.equal(await entry.evaluate(e=>e===document.activeElement),true);
 await p.getByLabel('Search reports').fill('rail');await p.getByRole('combobox',{name:'View',exact:true}).selectOption('split');await p.reload();await open(p);
 await p.locator('#notice-saved-list > summary').click();await p.locator('[data-open]').click();await details(p);
 assert.equal(await p.locator('#notice-subject').inputValue(),'Synthetic maintenance notice');
 await exceptions(p);assert.match(await p.locator('#work-exceptions').innerText(),/2026-10-12.*Skipped/);
 await p.locator('#notice-subject').fill('Recovered unsaved edit');await p.reload();await open(p);await details(p);
 assert.equal(await p.locator('#notice-subject').inputValue(),'Recovered unsaved edit');
 assert.equal((await stored(p)).working.id,saved.id);await p.keyboard.press('Escape');
 await p.getByLabel('ACTING UNIT').selectOption('works');await open(p);
 assert.equal(await p.locator('[data-open]').count(),0);await select(p);await details(p);assert.equal(await p.locator('#notice-subject').inputValue(),'');
},{theme,width,height}));
test('map picks explicit candidates; remove and re-add preserve exact highlighted coordinates',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await open(p);await select(p,'Main');await p.locator('#notice-fit').click();
 const map=p.locator('#notice-map'),box=await map.boundingBox();await map.click({position:{x:box.width/2,y:box.height/2}});
 assert.match(await p.locator('#notice-candidates').innerText(),/Map pick/);assert.ok(await p.locator('[data-add]').count()>0);
 const id=await p.locator('[data-add]').first().getAttribute('data-add');await p.locator('[data-add]').first().click();
 assert.deepEqual((await map.evaluate(e=>e._previewGeometry)).features.find(f=>id.endsWith(':'+f.properties.osmId)).geometry,data.features.find(f=>id.endsWith(':'+f.properties.osmId)).geometry);
 for(const b of await p.locator('[data-remove]').all())await b.click();
 assert.equal(await p.locator('#notice-next').isDisabled(),true);assert.equal((await map.evaluate(e=>e._previewGeometry.features)).length,0);
}));
test('matching work includes exceptions; parent edits invalidate review; stable revisions and closure',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await open(p);await select(p);await details(p);await fill(p,'work');await exceptions(p);
 await p.locator('#work-date').fill('2026-10-12');await p.locator('[data-exception="work"]').click();
 await p.locator('#work-date').fill('2026-10-13');await p.locator('#work-exception-kind').selectOption('modify');
 await p.locator('#work-modified-start').fill('08:00');await p.locator('#work-modified-end').fill('12:00');await p.locator('[data-exception="work"]').click();
 assert.equal(await p.locator('#restriction-exception-editor').isVisible(),false);
 await p.locator('#notice-check').click();assert.match(await p.locator('#notice-review').innerText(),/4 exact occurrences/);
 await p.locator('#notice-save').click();let n=(await stored(p)).notices[0];const id=n.id;assert.deepEqual(n.workOccurrences,n.restrictionOccurrences);
 await back(p);await p.locator('#work-start').fill('07:00');assert.equal(await p.locator('#notice-review').count(),0);assert.equal(await p.locator('#notice-save').count(),0);
 await p.locator('#notice-check').click();assert.match(await p.locator('#notice-review').innerText(),/Affected dates: 2026-10-09, 2026-10-14, 2026-10-15/);
 await p.locator('#notice-save').click();await p.locator('#notice-check-close').click();assert.match(await p.locator('#notice-review').innerText(),/Review closure/);
 await p.locator('#notice-confirm-close').click();assert.match(await p.locator('.notice-top').innerText(),/Revision 3.*CLOSED/);
 n=(await stored(p)).notices[0];assert.equal(n.id,id);assert.equal(n.history.length,3);assert.equal((await stored(p)).notices.length,1);assert.deepEqual(n.workOccurrences,n.restrictionOccurrences);
 await back(p);assert.equal(await p.locator('#notice-subject').isDisabled(),true);
}));
test('custom restrictions remain independent and survive toggles and refresh with date edits',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await open(p);await select(p);await details(p);await fill(p,'custom');
 await p.locator('#restriction-mode').selectOption('weekdays');await p.locator('#restriction-start').fill('17:00');await p.locator('#restriction-end').fill('19:00');
 await exceptions(p);await p.locator('#restriction-date').fill('2026-10-14');await p.locator('[data-exception="restriction"]').click();
 await p.locator('#restriction-choice').selectOption('work');await p.locator('#restriction-choice').selectOption('custom');
 assert.equal(await p.locator('#restriction-start').inputValue(),'17:00');assert.match(await p.locator('#restriction-exceptions').innerText(),/2026-10-14.*Skipped/);
 await p.reload();await open(p);await details(p);assert.equal(await p.locator('#restriction-choice').inputValue(),'custom');await p.locator('#notice-check').click();await p.locator('#notice-save').click();
 const n=(await stored(p)).notices[0];assert.equal(n.restrictionOccurrences.length,4);assert.equal(n.workOccurrences.length,5);assert.notDeepEqual(n.restrictionOccurrences,n.workOccurrences);
}));
test('malformed storage refuses composer; sign-in and modules gated; POST refused',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await p.evaluate(k=>sessionStorage.setItem(k,'bad'),key);
 await p.getByRole('button',{name:'Draft Notice Preview',exact:true}).click();await p.getByRole('button',{name:'Reset this unit’s synthetic preview storage'}).waitFor();assert.equal(await p.locator('#notice-subject').count(),0);
 for(const name of ['notice-preview.mjs','notice-preview-view.mjs','notice-schedule.mjs','road-selection.mjs'])assert.equal((await p.request.get(login+'/'+name)).status(),404);
 assert.equal((await p.request.post(base+'/')).status(),405);await p.keyboard.press('Escape');await p.goto(login+'/?demo=1');
 assert.equal(await p.getByRole('button',{name:'Draft Notice Preview',exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:/Sign In/}).count(),1);
}));
test('theme changes, map retry and canceled replacement keep unsaved edits; keyboard focus trapped',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await open(p);await select(p);const before=await p.locator('#notice-map').evaluate(e=>e._previewGeometry);
 await p.evaluate(()=>window.gridlyDispatchTheme.setPreference('dark'));assert.deepEqual(await p.locator('#notice-map').evaluate(e=>e._previewGeometry),before);
 await p.locator('#notice-retry').click();await p.locator('#notice-map.leaflet-container').waitFor();assert.deepEqual(await p.locator('#notice-map').evaluate(e=>e._previewGeometry),before);
 await details(p);await fill(p);p.once('dialog',d=>d.dismiss());await p.locator('#notice-new').click();assert.equal(await p.locator('#notice-subject').inputValue(),'Synthetic maintenance notice');
 await p.locator('#notice-check').focus();await p.keyboard.press('Tab');assert.equal(await p.locator('[data-exit]').evaluate(e=>e===document.activeElement),true,await p.evaluate(()=>document.activeElement.outerHTML));
 await p.keyboard.press('Shift+Tab');assert.equal(await p.locator('#notice-check').evaluate(e=>e===document.activeElement),true);
 assert.notEqual(await p.locator('#notice-check').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
}));
test('concurrent revision refusal keeps editor state without overwriting current save',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await open(p);await select(p);await details(p);await fill(p);await p.locator('#notice-check').click();await p.locator('#notice-save').click();
 await back(p);await p.locator('#notice-subject').fill('My unsaved revision');
 await p.evaluate(async()=>{
  const {loadWorkspace,saveNotice}=await import('./notice-preview.mjs'),{registryFromBytes}=await import('./road-selection.mjs');
  const r=await registryFromBytes(await(await fetch('./demo/dayton-roads.geojson')).arrayBuffer(),await(await fetch('./demo/dayton-roads-provenance.json')).json());
  const n=loadWorkspace(sessionStorage,'police',r).notices[0];n.subject='Concurrent saved revision';saveNotice(sessionStorage,'police',r,n,1);
 });
 await p.locator('#notice-check').click();await p.locator('#notice-save').click();assert.match(await p.locator('.notice-message').innerText(),/Stale revision/);
 await back(p);assert.equal(await p.locator('#notice-subject').inputValue(),'My unsaved revision');
 const n=(await stored(p)).notices[0];assert.equal(n.subject,'Concurrent saved revision');assert.equal(n.revision,2);
}));
test('map failure retains keyboard road selection; retry after step navigation restores geometry',()=>visit(async p=>{
 const block=route=>route.abort();await p.route('**/demo/dayton-context.geojson',block);await p.goto(base+'/?demo=1');await open(p,false);
 await p.getByText('Map unavailable. Search and selected lines remain available.',{exact:true}).waitFor();await select(p);
 await details(p);await fill(p);await back(p);await p.getByText('Map unavailable. Search and selected lines remain available.',{exact:true}).waitFor();
 await p.unroute('**/demo/dayton-context.geojson',block);await p.locator('#notice-retry').click();await p.locator('#notice-map.leaflet-container').waitFor();
 assert.equal((await p.locator('#notice-map').evaluate(e=>e._previewGeometry.features)).length,1);
 await details(p);assert.equal(await p.locator('#notice-subject').inputValue(),'Synthetic maintenance notice');await p.locator('#notice-check').click();assert.equal(await p.locator('#notice-save').isDisabled(),false);
}));
test('schedule validation blocks overnight and DST gap without losing input; one-time Sunday mapping works',()=>visit(async p=>{
 await p.goto(base+'/?demo=1');await open(p);await select(p);await details(p);await fill(p,'work');
 await p.locator('#work-start').fill('22:00');await p.locator('#work-end').fill('06:00');await p.locator('#notice-check').click();assert.match(await p.locator('.notice-message').innerText(),/Overnight|end.*start/i);
 await p.locator('#project-start').fill('2026-03-08');await p.locator('#project-end').fill('2026-03-08');
 await p.locator('#notice-effective').fill('2026-03-08T00:00');await p.locator('#notice-expiry').fill('2026-03-09T00:00');
 await p.locator('#work-mode').selectOption('once');await p.locator('#work-start').fill('02:30');await p.locator('#work-end').fill('04:00');await p.locator('#notice-check').click();assert.match(await p.locator('.notice-message').innerText(),/nonexistent|DST/i);
 assert.equal(await p.locator('#work-start').inputValue(),'02:30');await p.locator('#work-start').fill('06:00');await p.locator('#work-end').fill('16:00');
 await p.locator('#work-mode').selectOption('weekdays');for(const e of await p.locator('[data-day="work"]').all())await e.setChecked((await e.getAttribute('value'))==='0');
 await p.locator('#notice-check').click();assert.match(await p.locator('#notice-review').innerText(),/1 exact occurrences/);await p.locator('#notice-save').click();assert.equal((await stored(p)).notices[0].workOccurrences[0].date,'2026-03-08');
}));