import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';
import {approvedBoardServer,sameMapPixels} from '../tools/dispatch-ui/approved-board.mjs';
const evidence=new URL('../reports/responder/dispatch-selection/',import.meta.url);
let browser,server,baseline,base,approved;
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(`http://127.0.0.1:${s.address().port}`)));
before(async()=>{server=previewServer({demo:true});baseline=approvedBoardServer('85e982d78aaf1c01f419a6ada07f8a8d361b496f');base=await listen(server);approved=await listen(baseline);browser=await chromium.launch({headless:true,channel:process.env.DISPATCH_BROWSER_CHANNEL||'msedge'});await mkdir(evidence,{recursive:true});});
after(async()=>{await browser?.close();server?.close();baseline?.close();});
const view=p=>p.getByRole('combobox',{name:'View',exact:true});
const ready=p=>p.locator('[data-marker]').first().waitFor();
const shot=(p,name)=>p.screenshot({path:new URL(name+'.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
async function stableScreenshot(p,options={}){let previous=await protectedShot(p,options);for(let i=0;i<5;i++){await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const current=await protectedShot(p,options);if(previous.equals(current))return current;previous=current;}throw new Error('Screenshot did not settle');}
const bounds=p=>p.locator('.geo-layout,.geo-list-panel,.geo-list-row,#dispatch-map,.map-caption,.map-credit,.geo-filters,.topbar,.sidebar,.shell-footer').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
const camera=p=>p.locator('.leaflet-map-pane,[data-marker]').evaluateAll(es=>es.map(e=>[e.style.transform,e.style.marginLeft,e.style.marginTop,e.style.width,e.style.height]));
async function visit(fn,{theme='dark',width=1440,height=900}={}){const c=await browser.newContext({viewport:{width,height}});await c.addInitScript(t=>localStorage.setItem('gridlyDispatchTheme',t),theme);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));try{await fn(p);assert.deepEqual(errors,[]);}finally{await c.close();}}
for(const theme of ['dark','light'])test(`${theme}: selected marker/row, bidirectional sync, resolved, legend and drawer invariants`,()=>visit(async p=>{
  const requests=[];p.on('request',r=>requests.push([r.url(),r.method()]));
  await p.goto(base+'/?demo=1&view=split');await ready(p);assert.equal(await p.locator('.is-selected').count(),0);await shot(p,theme+'-police-split-none');
  const key=p.locator('.map-state-key');assert.equal((await key.innerText()).replace(/\s/g,''),'Selected✓Resolved');assert.equal(await key.locator('[aria-hidden=true]').count(),2);assert.doesNotMatch(await key.innerText(),/category|flood|rail|signal|debris|Ring:/i);
  for(const mode of ['split','map']){await view(p).selectOption(mode);await ready(p);const geometry=await bounds(p);
    for(const id of ['DEMO-001','DEMO-002']){const marker=p.locator(`[data-marker="${id}"]`),row=p.locator(`[data-geo-row="${id}"]`),button=p.locator(`[data-select="${id}"]`);
      if(id==='DEMO-001')await button.click();else{await marker.focus();await p.keyboard.press('Enter');}
      assert.equal(await marker.getAttribute('aria-pressed'),'true');assert.equal(await button.getAttribute('aria-pressed'),'true');assert.match(await row.getAttribute('class'),/is-selected/);
      const style=await marker.evaluate(e=>{const c=getComputedStyle(e,'::before'),r=getComputedStyle(document.querySelector('.geo-list-row.is-selected'));return {ring:c.outlineWidth,offset:c.outlineOffset,color:c.outlineColor,shadow:r.boxShadow,width:e.getBoundingClientRect().width,animation:c.animationName};});assert.equal(style.ring,'3px');assert.equal(style.offset,'2px');assert.equal(style.width,80);assert.equal(style.animation,'none');assert.ok(style.shadow.includes(style.color));assert.match(style.shadow,/inset/);
      assert.deepEqual(await bounds(p),geometry);await shot(p,`${theme}-police-${mode}-${id}`);
      const position=await camera(p),state=await p.locator('.geo-filters').innerText();await p.locator('.dispatch-popup').getByRole('button',{name:'View details'}).click();await p.getByRole('dialog').waitFor();assert.equal(await marker.getAttribute('aria-pressed'),'true');await p.keyboard.press('Escape');assert.deepEqual(await camera(p),position);assert.equal(await view(p).inputValue(),mode);assert.equal(await p.getByLabel('ACTING UNIT').inputValue(),'police');assert.equal(await p.getByRole('combobox',{name:'Theme',exact:true}).inputValue(),theme);assert.equal(await p.locator('.geo-filters').innerText(),state);
      await p.locator('.leaflet-popup-close-button').click();
    }
  }
  // Pointer marker selection also synchronizes the row; semantics are independent of severity/review.
  await p.locator('[data-marker="DEMO-001"]').click();assert.equal(await p.locator('[data-select="DEMO-001"]').getAttribute('aria-pressed'),'true');assert.equal(await p.locator('[data-marker="DEMO-002"]').getAttribute('aria-pressed'),'false');
  await p.locator('[data-marker="DEMO-002"]').focus();assert.equal(await p.locator('[data-marker="DEMO-002"]').getAttribute('aria-pressed'),'false');assert.equal(await p.locator('[data-marker="DEMO-002"]').evaluate(e=>getComputedStyle(e).outlineWidth),'3px');assert.equal(await p.locator('[data-marker="DEMO-002"]').evaluate(e=>getComputedStyle(e,'::before').outlineStyle),'none');
  await p.getByLabel('ACTING UNIT').selectOption('works');await view(p).selectOption('split');await ready(p);await p.locator('[data-select="DEMO-003"]').click();await shot(p,theme+'-works-split-signal');await view(p).selectOption('map');await ready(p);const debris=p.locator('[data-marker="DEMO-004"]');assert.equal(await debris.evaluate(e=>getComputedStyle(e).opacity),'0.7');await p.locator('[data-select="DEMO-004"]').click();assert.equal(await debris.evaluate(e=>getComputedStyle(e).opacity),'1');assert.equal(await debris.locator('.marker-state').innerText(),'✓');assert.equal(await debris.getAttribute('aria-pressed'),'true');await shot(p,theme+'-works-map-resolved-selected');await p.locator('.leaflet-popup-close-button').click();
  for(const [name,loc]of [['legend',key],['row',p.locator('[data-geo-row="DEMO-004"]')],['marker',debris]])await loc.screenshot({path:new URL(`${theme}-${name}-close.png`,evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
  await p.emulateMedia({colorScheme:theme});await p.getByRole('combobox',{name:'Theme',exact:true}).selectOption('system');const position=await camera(p);await p.emulateMedia({colorScheme:theme==='dark'?'light':'dark'});await p.locator(`html[data-theme="${theme==='dark'?'light':'dark'}"]`).waitFor();assert.equal(await debris.getAttribute('aria-pressed'),'true');assert.deepEqual(await camera(p),position);assert.equal(await debris.evaluate(e=>getComputedStyle(e,'::before').outlineOffset),'2px');
  assert.ok(requests.every(([u,m])=>u.startsWith(base+'/')&&m==='GET'));
},{theme}));
for(const theme of ['dark','light'])for(const [width,height]of [[1440,900],[1920,1080],[1280,720],[1024,768]])test(`${theme} ${width}x${height}: approved Board exact and geographic views unchanged outside selection/key`,()=>visit(async p=>{
  const compare={};for(const origin of [approved,base]){await p.goto(origin+'/?demo=1&view=board');await p.locator('tbody tr').first().waitFor();await p.mouse.move(0,0);const board=await protectedShot(p);if(origin===approved)compare.board=board;else{assert.ok(compare.board.equals(board),'Exact Board');await shot(p,`${theme}-${width}-board`);}
    for(const mode of ['split','map']){await view(p).selectOption(mode);await ready(p);await p.mouse.move(0,0);const geometry=await bounds(p);assert.equal(await p.locator('.map-caption > span:first-child').innerText(),'Offline OSM context · Approximate demo positions');const png=await stableScreenshot(p,{mask:[p.locator('.map-caption'),p.locator('[data-marker]')]});if(origin===approved)compare[mode]={geometry,png};else{assert.deepEqual(geometry,compare[mode].geometry);assert.ok(sameMapPixels(png,compare[mode].png),'Only compact key and normalized category artwork differ in unselected view');}}
  }
},{theme,width,height}));
test('only isolated map styling and caption change; no consumer imports or writes',async()=>{const s=await readFile(new URL('../dispatch/map-view.mjs',import.meta.url),'utf8');assert.doesNotMatch(s,/from\s+['"]\.\.\/|supabase|\.insert\(|\.rpc\(/);});

test('selection camera, scroll, filtered state and popup match approved behavior',()=>visit(async p=>{
  const recorded=new Map();
  for(const origin of [approved,base])for(const mode of ['split','map']){
    await p.goto(origin+`/?demo=1&view=${mode}`);await ready(p);
    const search=p.getByPlaceholder('Search incident or location');await search.fill('Street');
    for(const id of ['DEMO-001','DEMO-002']){
      if(id==='DEMO-001')await p.locator(`[data-select="${id}"]`).click();else await p.locator(`[data-marker="${id}"]`).click();
      const state={camera:await camera(p),bounds:await bounds(p),scroll:await p.evaluate(()=>[scrollX,scrollY]),popup:await p.locator('.dispatch-popup').innerText()};
      if(origin===approved)recorded.set(mode+id,state);else assert.deepEqual(state,recorded.get(mode+id));
      await p.locator('.dispatch-popup').getByRole('button',{name:'View details'}).click();await p.getByRole('dialog').waitFor();await p.keyboard.press('Escape');assert.equal(await search.inputValue(),'Street');assert.deepEqual(await camera(p),state.camera);await p.locator('.leaflet-popup-close-button').click();
    }
  }
}));

// Only additive controls are transparent during historical comparisons.
// visibility preserves layout and reveals the original toolbar beneath Expand Map.
async function protectedShot(page,options={}){const entry=page.locator(options.mask?'.notice-entry, #expand-map':'.notice-entry'),previous=await entry.evaluateAll(es=>es.map(e=>e.style.visibility));await entry.evaluateAll(es=>es.forEach(e=>e.style.visibility='hidden'));try{return await page.screenshot(options);}finally{await entry.evaluateAll((es,values)=>es.forEach((e,i)=>e.style.visibility=values[i]||''),previous);}}
