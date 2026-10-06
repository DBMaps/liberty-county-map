import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {get} from 'node:http';
import {chromium} from '@playwright/test';
import {previewServer} from '../tools/dispatch-ui/serve.mjs';
import {unitRecords,memberships} from '../dispatch/demo/fixtures.mjs';

let browser,server,plain,base,plainBase;
const evidence=new URL('../reports/responder/dispatch-visual/',import.meta.url);
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
before(async()=>{server=previewServer({demo:true});plain=previewServer();base=await listen(server);plainBase=await listen(plain);browser=await chromium.launch({headless:true,...(process.env.DISPATCH_BROWSER_CHANNEL?{channel:process.env.DISPATCH_BROWSER_CHANNEL}:{})});await mkdir(evidence,{recursive:true});});
after(async()=>{await browser?.close();server?.close();plain?.close();});
async function withPage(fn,viewport={width:1440,height:900}) {
  const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {await fn(page);assert.deepEqual(errors,[],'No browser runtime errors');}finally{await context.close();}
}
async function board(page,query='') {await page.goto(base+'/?demo=1'+query);await page.getByRole('heading',{name:'Dispatch Board',exact:true}).waitFor();}
test('login has labels, authorized-access messaging and no signup; credentials never leave browser',()=>withPage(async page=>{
  const writes=[];page.on('request',request=>{if(request.method()!=='GET')writes.push(request.url());});
  await page.goto(base);await page.getByRole('heading',{name:'Welcome to Dispatch'}).waitFor();
  assert.equal(await page.getByLabel('Email',{exact:true}).count(),1);assert.equal(await page.getByLabel('Password',{exact:true}).count(),1);
  assert.match(await page.locator('.secure-note').innerText(),/Authorized agency access only\./);
  assert.equal(await page.getByRole('button',{name:/create account|sign up|register|google|apple/i}).count(),0);
  await page.getByLabel('Email',{exact:true}).fill('visual@example.invalid');await page.getByLabel('Password',{exact:true}).fill('synthetic-only');await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await page.getByText(/Sign in is not connected/).waitFor();assert.equal(await page.getByLabel('Password',{exact:true}).inputValue(),'');assert.deepEqual(writes,[]);
  await page.getByRole('button',{name:'Forgot password?'}).click();await page.getByText(/No recovery email has been sent/).waitFor();
  assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
}));
test('verification state never pretends to grant AAL2',()=>withPage(async page=>{await page.goto(base+'/?auth=verification');await page.getByText(/cannot verify a code or establish an AAL2 session/).waitFor();}));
test('shell, organization, unit, metrics, review queue and status semantics',()=>withPage(async page=>{
  await board(page);assert.equal(await page.locator('#active-unit').inputValue(),'police');await page.getByText('LOCAL VISUAL DEMO',{exact:true}).waitFor();
  assert.match(await page.locator('.topbar').innerText(),/City of Dayton/);assert.equal(await page.locator('tbody tr').count(),2);
  assert.match(await page.locator('tbody').innerText(),/High/);assert.match(await page.locator('tbody').innerText(),/Needs review/);assert.match(await page.locator('tbody').innerText(),/Internal only/);
  assert.equal(await page.locator('.queue-item').count(),1);assert.equal(await page.getByRole('button',{name:/approve|publish/i}).count(),0);
  await page.getByRole('button',{name:'Reports',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),2);
  await page.getByRole('button',{name:'Review Queue',exact:true}).click();assert.equal(await page.locator('.queue-item').count(),1);
  await page.getByRole('button',{name:'Activity',exact:true}).click();await page.getByRole('heading',{name:'Unit activity'}).waitFor();
}));
test('unit switch isolates rows and clears filters; municipality grants no access',()=>withPage(async page=>{
  await board(page);await page.getByLabel('Search reports').fill('flooded');await page.getByLabel('ACTING UNIT').selectOption('works');
  assert.equal(await page.getByLabel('Search reports').inputValue(),'');assert.match(await page.locator('tbody').innerText(),/Signal Outage/);assert.doesNotMatch(await page.locator('tbody').innerText(),/Flooded Roadway|Police/);
  assert.equal(await page.locator('#active-unit option').count(),2);await page.getByRole('button',{name:'Organization',exact:true}).click();
  assert.match(await page.locator('.unit-list').innerText(),/Dayton Fire Department/);assert.equal(await page.getByText('No demo membership · access unavailable',{exact:true}).count(),2);
  assert.deepEqual(memberships,['police','works']);assert.deepEqual(unitRecords('fire'),[]);assert.deepEqual(unitRecords('ems'),[]);
}));
test('local filters, no matches and reset',()=>withPage(async page=>{
  await board(page);await page.getByLabel('Search reports').fill('main street');assert.equal(await page.locator('tbody tr').count(),1);
  await page.locator('[data-filter="severity"]').selectOption('High');await page.getByRole('heading',{name:'No matching reports'}).waitFor();
  await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),2);
  for(const [key,value] of [['source','Community report'],['review','Needs review'],['status','Active']])await page.locator(`[data-filter="${key}"]`).selectOption(value);
  assert.equal(await page.locator('tbody tr').count(),1);
}));
test('keyboard opens detail, modal traps focus, Escape restores trigger; close button works',()=>withPage(async page=>{
  await board(page);const trigger=page.getByRole('button',{name:'Flooded Roadway',exact:true});await trigger.focus();await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor();assert.equal(await page.getByRole('dialog').getByRole('heading',{name:'Flooded Roadway'}).count(),1);
  assert.match(await page.getByRole('dialog').innerText(),/Revision 3/);assert.match(await page.getByRole('dialog').innerText(),/Stale revisions are rejected/);assert.match(await page.getByRole('dialog').innerText(),/Authors cannot approve/);
  await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)),true);
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
  await trigger.click();await page.getByRole('button',{name:'Close report detail'}).click();assert.equal(await page.getByRole('dialog').count(),0);
}));
test('empty, loading, network error and authorization refusal are distinct',()=>withPage(async page=>{
  await board(page,'&state=empty');await page.getByRole('heading',{name:'No active incidents'}).waitFor();await page.getByRole('heading',{name:'Nothing waiting for review'}).waitFor();
  await page.getByLabel('Preview state').selectOption('loading');assert.equal(await page.getByRole('status',{name:'Loading Dispatch Board'}).count(),1);
  await page.getByLabel('Preview state').selectOption('error');await page.getByRole('heading',{name:'We couldn’t load the Dispatch Board.'}).waitFor();await page.getByRole('button',{name:'Retry',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),2);
  await page.getByLabel('Preview state').selectOption('denied');await page.getByRole('heading',{name:'Access could not be verified'}).waitFor();assert.equal(await page.locator('tbody tr').count(),0);await page.getByRole('button',{name:'Return to sign in'}).click();await page.getByRole('heading',{name:'Welcome to Dispatch'}).waitFor();
}));
test('fixtures require explicit local server mode, no writes or production requests; asset bytes unchanged',()=>withPage(async page=>{
  await page.goto(plainBase+'/?demo=1');await page.getByRole('heading',{name:'Welcome to Dispatch'}).waitFor();assert.equal(await page.getByRole('link',{name:/Open local visual demo/}).count(),0);
  assert.equal((await fetch(plainBase+'/demo/fixtures.mjs')).status,404);assert.equal((await fetch(base+'/../package.json')).status,404);assert.equal((await fetch(base+'/',{method:'POST',body:'synthetic'})).status,405);
  const hostStatus=await new Promise((resolve,reject)=>get(base+'/',{headers:{host:'dispatch.gridlygo.com'}},response=>{response.resume();resolve(response.statusCode);}).on('error',reject));
  assert.equal(hostStatus,403);
  const requests=[];page.on('request',request=>requests.push([request.url(),request.method()]));await board(page);await page.getByRole('button',{name:'Flooded Roadway',exact:true}).click();
  assert.ok(requests.every(([url,method])=>url.startsWith(base+'/')&&method==='GET'));
  const sourceFiles=(await readdir(new URL('../dispatch/',import.meta.url))).filter(file=>/\.mjs$/.test(file));
  for(const file of sourceFiles){const source=await readFile(new URL('../dispatch/'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/from\s+['"]\.\.\/(?:js|lib|tools)|\.insert\(|\.rpc\(|sendBeacon|localStorage|sessionStorage|indexedDB/);}
  const hash=async path=>createHash('sha256').update(await readFile(new URL(path,import.meta.url))).digest('hex');assert.equal(await hash('../dispatch/assets/gridly-logo.png'),await hash('../assets/store/branding/Logos/gridly-logo-horizontal.png'));
}));
test('remote origin query cannot activate fixtures even if preview files were copied',()=>withPage(async page=>{
  const requested=[];
  await page.route('https://dispatch-preview.invalid/**',async route=>{
    const path=new URL(route.request().url()).pathname;requested.push(path);
    const name=path==='/'?'index.html':path.slice(1);
    if(['index.html','app.mjs','auth.mjs','components.mjs','theme.js','themes.css','styles.css'].includes(name))await route.fulfill({body:await readFile(new URL('../dispatch/'+name,import.meta.url)),contentType:/\.(?:mjs|js)$/.test(name)?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});
    else await route.fulfill({status:404,body:''});
  });
  await page.goto('https://dispatch-preview.invalid/?demo=1');await page.getByRole('heading',{name:'Welcome to Dispatch'}).waitFor();
  assert.ok(!requested.includes('/__preview'));assert.ok(!requested.some(path=>path.includes('fixtures')));
}));
for(const [width,height] of [[1440,900],[1920,1080],[1280,720],[1024,768]])test(`visual certification ${width}x${height}`,()=>withPage(async page=>{
  async function capture(name){await page.screenshot({path:new URL(`${width}x${height}-${name}.png`,evidence).pathname.replace(/^\/([A-Z]:)/,'$1')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'No horizontal document overflow');}
  await page.goto(base);await page.getByRole('heading',{name:'Welcome to Dispatch'}).waitFor();await capture('login');
  await board(page);await capture('board');assert.equal(await page.locator('.table-wrap').evaluate(node=>node.scrollWidth<=node.clientWidth),true,'Desktop/tablet table needs no horizontal scrolling');await page.getByRole('button',{name:'Flooded Roadway',exact:true}).click();await capture('detail');await page.getByRole('dialog').getByRole('heading',{name:'Publication',exact:true}).scrollIntoViewIfNeeded();await capture('detail-authority');await page.keyboard.press('Escape');
  await page.getByLabel('Preview state').selectOption('empty');await capture('empty');
},{width,height}));
