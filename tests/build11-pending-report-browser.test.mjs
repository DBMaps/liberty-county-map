import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {existsSync,statSync,createReadStream,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

// Paid admission/provider responses are isolated fixtures. Every external
// request is intercepted: this test cannot submit a production report.
test('Build 11 placement and persisted recovery in browser and native-shaped portrait', {timeout:180000},async t=>{
 const root=process.cwd(),evidence=resolve('.artifacts/build11-pending');mkdirSync(evidence,{recursive:true});
 const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
 const server=createServer((req,res)=>{const p=resolve(root,decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html');if(!p.startsWith(root+sep)||!existsSync(p)||!statSync(p).isFile())return res.writeHead(404).end();res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream'});createReadStream(p).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {for(const [native,width,height] of [[false,390,844],[true,360,800],[true,375,812],[true,390,844],[true,411,914],['android',390,844]].filter(([,width])=>!process.env.GRIDLY_PENDING_TEST_WIDTH||width===Number(process.env.GRIDLY_PENDING_TEST_WIDTH))){
  await t.test(`${native?(native==='android'?'android-shaped':'ios-shaped'):'browser'} ${width}x${height}`,{timeout:55000},async()=>{
   const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
   let mode='offline',requests=[];
   await context.route('**/*',route=>{const url=route.request().url();
    if(url.startsWith(base+'js/gridly-paid-bootstrap.js'))return route.fulfill({contentType:'text/javascript',body:`(async()=>{${native?`window.Capacitor={isNativePlatform:()=>true,getPlatform:()=> '${native==='android'?'android':'ios'}',Plugins:{}};`:""}const {loadPaidRuntime}=await import('/js/gridly-paid-startup.mjs');document.documentElement.classList.remove('gridly-prepaint-lock','gridly-paid-pending','gridly-paid-locked');document.getElementById('gridlyPaidPending').hidden=true;document.getElementById('gridlyPaidAccess').hidden=true;await loadPaidRuntime({document,window,allowed:()=>true});window.gridlyPaidReporting={getProof:async()=> 'fixture-only'};window.__fixtureAdmitted=true;})()`});
    if(url.startsWith('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'))return route.fulfill({path:resolve('node_modules/leaflet/dist/leaflet.js'),contentType:'text/javascript'});
    if(url.startsWith('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'))return route.fulfill({path:resolve('node_modules/leaflet/dist/leaflet.css'),contentType:'text/css'});
    if(url.startsWith('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'))return route.fulfill({path:resolve('node_modules/@supabase/supabase-js/dist/umd/supabase.js'),contentType:'text/javascript'});
    if(url.includes('/rest/v1/rpc/get_community_reporting_status'))return route.fulfill({contentType:'application/json',body:JSON.stringify({protocol_version:2,reporting_enabled:true,changed_at:new Date().toISOString()})});
    if(url.includes('/functions/v1/gridly-paid-report')){
     const body=route.request().postDataJSON();requests.push(body);
     if(mode==='offline')return route.abort();
     if(mode==='denied')return route.fulfill({status:403,contentType:'application/json',body:'{"status":"forbidden"}'});
     return route.fulfill({contentType:'application/json',body:JSON.stringify({status:body.operation==='cancel_community_operation'?'cancelled':'accepted',report:body.args.report&&{...body.args.report,id:'12345678-1234-4234-8234-123456789abc',created_at:new Date().toISOString()}})});
    }
    if(url.includes('/rest/v1/reports'))return route.fulfill({contentType:'application/json',body:'[]'});
    if(!url.startsWith(base))return route.abort();return route.continue();
   });
   const page=await context.newPage();
   const activate=locator=>native?locator.tap():locator.click();
   const load=async()=>{await page.waitForFunction(()=>window.__fixtureAdmitted&&typeof map!=='undefined'&&map);const skip=page.locator('#gridlyV894CFirstRunSkipBtn');if(await skip.isVisible().catch(()=>false))await skip.click();};
   const pending=()=>page.evaluate(()=>localStorage.getItem('gridlyPendingCommunityOperationV1'));
   const arm=async()=>{await activate(page.locator('[data-v2-sheet="report"]').first());await activate(page.locator('[data-v2-action="report-select-hazard"][data-hazard-type="flooding"]'));await activate(page.locator('[data-v2-action="report-tap-map"]'));await page.waitForFunction(()=>reportingState.placementModeActive);};
   try {
    await page.goto(base);await load();await arm();
    assert.equal(await pending(),null);assert.equal(requests.length,0);
    assert.ok(await page.locator('#gridlyV2ParticipationAcknowledgement').isVisible(),'placement instructions visible');
    await page.screenshot({path:resolve(evidence,`placement-${native}-${width}.png`)});
    await page.reload();await load();assert.equal(await pending(),null);assert.equal(await page.locator('#gridlyRetryPendingReport').count(),0,'restart of placement cannot resurrect a submission');
    await arm();
    let chosen=await page.evaluate(()=>{
     snapHazardToRoad=async(lat,lng)=>({lat:lat+.001,lng:lng+.001,invalid:false,selectedRoadName:'US 90'});
     window.gridlyUgcCompliance={ensureAccepted:async()=>true};
     const bounds=map.getContainer().getBoundingClientRect();
     const top=document.querySelector('#gridlyPortraitV2 .gridly-v2-segments').getBoundingClientRect().bottom;
     const bottom=document.querySelector('#gridlyPortraitV2 .gridly-v2-bottom-region').getBoundingClientRect().top;
     // Native touch injection uses integer screen pixels; derive the expected
     // selected coordinate from that actual pixel rather than a fractional one.
     const x=Math.round(innerWidth/2),y=Math.round((top+bottom)/2);
     const coordinate=map.containerPointToLatLng([x-bounds.left,y-bounds.top]);
     return {x,y,lat:coordinate.lat,lng:coordinate.lng};
    });
    if(native===true && width===390){
     await page.evaluate(()=>{snapHazardToRoad=()=>new Promise(resolve=>{window.__releaseRoadLookup=resolve;});});
     await page.touchscreen.tap(chosen.x,chosen.y);
     await page.waitForFunction(()=>reportingState.locationLookupInProgress);
     await page.waitForFunction(()=>reportingState.placementModeActive && !reportingState.locationLookupInProgress,{},{timeout:15000});
     assert.equal(await pending(),null);assert.equal(requests.length,0);
     assert.match(await page.locator('#gridlyV2ParticipationAcknowledgement').innerText(),/road location could not be checked/);
     await page.evaluate(()=>window.__releaseRoadLookup({lat:30,lng:-95,invalid:false,selectedRoadName:'Late road'}));
     await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
     assert.equal(await page.locator('[data-v2-report-review]').count(),0,'late road response cannot advance a timed-out placement');
     await page.evaluate(()=>{snapHazardToRoad=async(lat,lng)=>({lat:lat+.001,lng:lng+.001,invalid:false,selectedRoadName:'US 90'});});
     // Toast/layout timers can resize the map during the bounded wait. The
     // second touch must be checked against its current viewport coordinate.
     chosen=await page.evaluate(point=>{const bounds=map.getContainer().getBoundingClientRect();const coordinate=map.containerPointToLatLng([point.x-bounds.left,point.y-bounds.top]);return {...point,lat:coordinate.lat,lng:coordinate.lng};},chosen);
    }
    if(native)await page.touchscreen.tap(chosen.x,chosen.y);else await page.mouse.click(chosen.x,chosen.y);
    await page.locator('[data-v2-report-review]').waitFor({state:'visible'});
    assert.equal(await pending(),null);assert.equal(requests.length,0,'coordinate/review cannot submit');
    const reviewed=await page.locator('[data-v2-review-location]').innerText();
    assert.ok(reviewed.includes(`${chosen.lat.toFixed(6)}, ${chosen.lng.toFixed(6)}`),`road resolver cannot replace chosen coordinate: expected ${chosen.lat},${chosen.lng}; reviewed ${reviewed}`);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:resolve(evidence,`review-${native}-${width}.png`)});
    await page.locator('[data-v2-action="report-confirm-governed-draft"]').click();
    await page.locator('#gridlyRetryPendingReport').waitFor({state:'visible'});await page.waitForFunction(()=>!reportingState.submissionInProgress);
    const original=JSON.parse(await pending());assert.equal(original.kind,'create');assert.ok(Math.abs(original.payload.lat-chosen.lat)<1e-7);assert.ok(Math.abs(original.payload.lng-chosen.lng)<1e-7);assert.equal(requests.length,1);
    assert.ok(await page.locator('#gridlyV2ParticipationAcknowledgement').isVisible(),'network failure feedback visible');
    await page.reload();await load();
    mode='denied';await page.locator('#gridlyRetryPendingReport').click();await page.waitForFunction(()=>document.getElementById('gridlyV2ParticipationAcknowledgement')?.textContent.includes('access could not be verified'));
    assert.ok(await page.locator('#gridlyV2ParticipationAcknowledgement').isVisible());assert.equal(JSON.parse(await pending()).id,original.id);
    await page.screenshot({path:resolve(evidence,`retry-denied-${native}-${width}.png`)});
    mode='accepted';await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
    await page.locator('#gridlyRetryPendingReport').click();await page.waitForFunction(()=>localStorage.getItem('gridlyPendingCommunityOperationV1')===null);
    assert.equal(requests.length,3);for(const req of requests)assert.equal(req.args.submission_token,original.id);
    await page.locator('#gridlyRetryPendingReport').waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.gridlyGovernedRoadHazardReportDraft),null,'resolved Retry cannot leave a second Submit draft');
    // A malformed older draft retains only its known UUID for cancellation.
    await page.evaluate(()=>{localStorage.setItem('gridlyPendingCommunityOperationV1',JSON.stringify({id:'12345678-1234-4234-8234-123456789abc',startedAt:Date.now()-1000,kind:'create',payload:{report_type:'flooding'}}));gridlyRefreshPendingOperationButton();});
    assert.match(await page.locator('#gridlyRetryPendingReport').innerText(),/cancelling incomplete/);await page.locator('#gridlyRetryPendingReport').click();await page.waitForFunction(()=>localStorage.getItem('gridlyPendingCommunityOperationV1')===null);
    assert.equal(requests.at(-1).operation,'cancel_community_operation');assert.deepEqual(Object.keys(requests.at(-1).args),['operation_id']);
    await page.evaluate(()=>{localStorage.setItem('unrelated-owner-state','preserve');localStorage.setItem('gridlyPendingCommunityOperationV1','{broken');gridlyRefreshPendingOperationButton();});
    await page.locator('#gridlyRetryPendingReport').click();await page.locator('[data-v2-report-hazard-picker]').waitFor({state:'visible'});
    assert.equal(await pending(),null);assert.equal(await page.evaluate(()=>localStorage.getItem('unrelated-owner-state')),'preserve');assert.equal(requests.length,4,'corrupt queue recovery makes no network write');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   } finally {await context.close();}
  });
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
});
