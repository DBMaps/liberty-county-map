import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';

let browser, server, base;
const evidence = new URL('../reports/responder/dispatch-theme/', import.meta.url);
before(async () => {
  server = previewServer({demo:true});
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({headless:true,...(process.env.DISPATCH_BROWSER_CHANNEL?{channel:process.env.DISPATCH_BROWSER_CHANNEL}:{})});
  await mkdir(evidence,{recursive:true});
});
after(async () => { await browser?.close(); server?.close(); });
async function visit(fn,{colorScheme='light',stored,viewport={width:1440,height:900},blocked=false}={}) {
  const context = await browser.newContext({colorScheme,viewport});
  if (stored!==undefined) await context.addInitScript(value=>localStorage.setItem('gridlyDispatchTheme',value),stored);
  if (blocked) await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Unavailable','SecurityError');}});});
  const page=await context.newPage(); const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {await fn(page,context);assert.deepEqual(errors,[]);}finally{await context.close();}
}
const resolved=page=>page.locator('html').getAttribute('data-theme');
const preference=page=>page.getByRole('combobox',{name:'Theme',exact:true});
async function open(page,path='/') {await page.goto(base+path);await preference(page).waitFor();}

for(const colorScheme of ['light','dark']) test(`default SYSTEM applies ${colorScheme} before body render`,()=>visit(async page=>{
  await page.addInitScript(()=>{
    new MutationObserver((_,observer)=>{if(document.body){window.themeAtBody=document.documentElement.dataset.theme;observer.disconnect();}}).observe(document.documentElement||document,{childList:true,subtree:true});
  });
  await open(page);assert.equal(await preference(page).inputValue(),'system');assert.equal(await resolved(page),colorScheme);
  assert.equal(await page.evaluate(()=>window.themeAtBody),colorScheme);
  assert.equal(await page.evaluate(()=>localStorage.getItem('gridlyDispatchTheme')),null);
},{colorScheme}));
for(const mode of ['light','dark'])test(`explicit ${mode} overrides OS and ignores runtime OS changes`,()=>visit(async page=>{
  await open(page);await preference(page).selectOption(mode);assert.equal(await resolved(page),mode);
  for(const os of ['dark','light']){await page.emulateMedia({colorScheme:os});assert.equal(await resolved(page),mode);}
  await page.reload();await preference(page).waitFor();assert.equal(await preference(page).inputValue(),mode);assert.equal(await resolved(page),mode);
  assert.equal(await page.evaluate(()=>localStorage.getItem('gridlyDispatchTheme')),mode);
},{colorScheme:mode==='dark'?'light':'dark'}));
test('SYSTEM responds dynamically and restores OS preference after explicit choice',()=>visit(async page=>{
  await open(page);await page.emulateMedia({colorScheme:'dark'});await page.locator('html[data-theme=dark]').waitFor();
  await preference(page).selectOption('light');await preference(page).selectOption('system');assert.equal(await resolved(page),'dark');
  await page.emulateMedia({colorScheme:'light'});await page.locator('html[data-theme=light]').waitFor();
  assert.equal(await preference(page).inputValue(),'system');
}));
for(const stored of ['invalid','DARK','{"theme":"dark"}',''])test(`corrupt stored value ${JSON.stringify(stored)} falls back to SYSTEM`,()=>visit(async page=>{
  await open(page);assert.equal(await preference(page).inputValue(),'system');assert.equal(await resolved(page),'dark');
},{stored,colorScheme:'dark'}));
test('storage refusal still permits immediate in-memory selection',()=>visit(async page=>{
  await open(page);assert.equal(await resolved(page),'dark');await preference(page).selectOption('light');assert.equal(await resolved(page),'light');
},{blocked:true,colorScheme:'dark'}));
test('accessible keyboard selector and selected option on login and shell',()=>visit(async page=>{
  await open(page);assert.deepEqual(await preference(page).locator('option').allTextContents(),['System','Light','Dark']);
  await preference(page).focus();await page.keyboard.press('End');await page.keyboard.press('Enter');assert.equal(await preference(page).inputValue(),'dark');
  assert.equal(await preference(page).evaluate(node=>node.options[node.selectedIndex].text),'Dark');
  assert.notEqual(await preference(page).evaluate(node=>getComputedStyle(node).outlineStyle),'none');
  await page.getByRole('link',{name:/Open local visual demo/}).click();await preference(page).waitFor();assert.equal(await preference(page).inputValue(),'dark');
  await page.getByRole('button',{name:'Reports',exact:true}).click();assert.equal(await preference(page).inputValue(),'dark');
}));
test('appearance changes preserve unit, filters, records, errors, drawer, route and request count',()=>visit(async page=>{
  await open(page,'/?demo=1');await page.getByLabel('ACTING UNIT').selectOption('works');await page.getByLabel('Search reports').fill('signal');
  const html=await page.locator('#view').innerHTML();const url=page.url();const requests=[];page.on('request',request=>requests.push(request.url()));
  const bounds=await page.locator('.records-panel').boundingBox();
  for(const mode of ['dark','light','system']){await preference(page).selectOption(mode);assert.equal(await page.locator('#view').innerHTML(),html);assert.equal(await page.getByLabel('ACTING UNIT').inputValue(),'works');assert.equal(page.url(),url);assert.deepEqual(await page.locator('.records-panel').boundingBox(),bounds);}
  await page.getByRole('button',{name:'Signal Outage',exact:true}).click();const detail=await page.getByRole('dialog').innerHTML();
  await page.evaluate(()=>window.gridlyDispatchTheme.setPreference('dark'));assert.equal(await page.getByRole('dialog').innerHTML(),detail);await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('button',{name:'Signal Outage',exact:true}).evaluate(node=>node===document.activeElement),true);
  await page.getByLabel('Preview state').selectOption('denied');const denied=await page.locator('#view').innerHTML();await preference(page).selectOption('light');assert.equal(await page.locator('#view').innerHTML(),denied);
  assert.deepEqual(requests,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),['gridlyDispatchTheme']);
}));
test('cross-tab preference changes synchronize appearance',()=>visit(async (page,context)=>{
  await open(page);const other=await context.newPage();await open(other,'/?demo=1');await preference(page).selectOption('dark');
  await other.locator('html[data-theme=dark]').waitFor();assert.equal(await preference(other).inputValue(),'dark');
}));
test('theme is isolated, CSP-safe, reduced-motion aware and uses semantic colors',async()=>{
  const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
  const theme=await read('dispatch/theme.js');assert.doesNotMatch(theme,/fetch\(|XMLHttpRequest|supabase|resend|\.rpc\(|\.insert\(|location\.|cookie|sessionStorage/i);
  assert.deepEqual([...theme.matchAll(/(?:getItem|setItem)\(([^,)]+)/g)].map(match=>match[1]),['key','key']);
  const html=await read('dispatch/index.html');assert.ok(html.indexOf('theme.js')<html.indexOf('styles.css'));assert.doesNotMatch(html,/<script(?![^>]*src=)[^>]*>[^<]+/);
  const styles=await read('dispatch/styles.css');assert.doesNotMatch(styles,/#[0-9a-f]{3,8}\b/i);assert.match(styles,/prefers-reduced-motion/);
  const response=await fetch(base);assert.ok(!response.headers.get('content-security-policy').includes('unsafe-inline'));
});

// Contrast checks use computed palette values, not screenshots or color labels.
function contrast(a,b){const luminance=color=>{const parts=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return parts[0]*.2126+parts[1]*.7152+parts[2]*.0722;};const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);}
for(const mode of ['light','dark'])test(`${mode} text/status/placeholder and focus contrast`,()=>visit(async page=>{
  await open(page,'/?demo=1');await preference(page).selectOption(mode);
  const pairs=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement);
    const value=token=>{const probe=document.createElement('span');probe.style.color=css.getPropertyValue('--'+token);document.body.append(probe);const result=getComputedStyle(probe).color;probe.remove();return result;};
    const pairs=[['text-primary','bg-panel'],['text-secondary','bg-panel'],['text-muted','bg-app'],['text-placeholder','bg-input'],['text-accent','bg-panel'],['text-demo','bg-demo'],['text-inverse','bg-brand'],['text-nav','bg-sidebar'],['text-nav-secondary','bg-sidebar'],['text-warning','bg-panel']];
    for(const status of ['critical','high','moderate','low','resolved','active','review'])pairs.push([`status-${status}-text`,`status-${status}-bg`]);
    return pairs.map(([fg,bg])=>[fg,bg,value(fg),value(bg)]).concat(['bg-panel','bg-input','bg-app','bg-sidebar'].map(bg=>['focus-ring',bg,value('focus-ring'),value(bg)]));
  });
  for(const [fg,bg,a,b] of pairs)assert.ok(contrast(a,b)>=(fg==='focus-ring'?3:4.5),`${mode} ${fg}/${bg}: ${contrast(a,b).toFixed(2)}`);
}));
for(const mode of ['light','dark'])for(const [width,height] of [[1440,900],[1920,1080],[1280,720],[1024,768]])test(`${mode} screenshots ${width}x${height}`,()=>visit(async page=>{
  const capture=async name=>{await page.screenshot({path:new URL(`${mode}-${width}x${height}-${name}.png`,evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);};
  await open(page);await capture('login');assert.equal(await page.getByRole('button',{name:/sign up|create account|register/i}).count(),0);
  await open(page,'/?demo=1');await capture('board');assert.equal(await page.locator('.table-wrap').evaluate(node=>node.scrollWidth<=node.clientWidth),true);
  const trigger=page.getByRole('button',{name:'Flooded Roadway',exact:true});await trigger.click();await capture('detail');await page.getByRole('heading',{name:'Publication',exact:true}).scrollIntoViewIfNeeded();await capture('detail-authority');await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
  await page.getByLabel('Preview state').selectOption('empty');await capture('empty');
  if(width===1440){for(const state of ['loading','error','denied']){await page.getByLabel('Preview state').selectOption(state);await capture(state);}await open(page);await page.getByLabel('Email',{exact:true}).fill('preview@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic');await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.getByLabel('Email',{exact:true}).focus();await capture('login-error-focus');}
},{stored:mode,viewport:{width,height}}));
test('SYSTEM screenshot proof follows emulated dark OS',()=>visit(async page=>{
  await open(page,'/?demo=1');assert.equal(await preference(page).inputValue(),'system');assert.equal(await resolved(page),'dark');
  await page.screenshot({path:new URL('system-dark-1440x900-board.png',evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});
},{colorScheme:'dark'}));
