import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const baseline=process.argv.includes('--baseline');
const baselineFiles=new Map(baseline?['js/app.js','index.html','css/styles.css'].map(p=>[p,execFileSync('git',['show','0305bd35fb43e62e21190af2a89b82eb14341be9:'+p],{maxBuffer:30e6})]):[]);
const mime = { '.js':'text/javascript', '.json':'application/json', '.geojson':'application/json', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.png':'image/png' };
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if (!file.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file)||!fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  if(baselineFiles.has(name.slice(1))) {res.end(baselineFiles.get(name.slice(1)));return;}
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
await context.addInitScript(()=>{
  localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
  if(!localStorage.getItem('gridlySavedPlacesV1')) localStorage.setItem('gridlySavedPlacesV1',JSON.stringify({version:1,
    home:{id:'home',label:'Test home',lat:30.3413,lng:-95.0858,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},
    work:{id:'work',label:'Test work',lat:29.91154,lng:-95.06325,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},custom:[],favorites:[]}));
});
const requests=[],errors=[];
await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith(origin)) return route.continue();
  if(url.includes('leaflet@1.9.4/dist/leaflet.js')) return route.fulfill({path:'node_modules/leaflet/dist/leaflet.js',contentType:'text/javascript'});
  if(url.includes('leaflet@1.9.4/dist/leaflet.css')) return route.fulfill({path:'node_modules/leaflet/dist/leaflet.css',contentType:'text/css'});
  if(url.includes('@supabase/supabase-js@2')) return route.fulfill({path:'node_modules/@supabase/supabase-js/dist/umd/supabase.js',contentType:'text/javascript'});
  if(url.startsWith('https://api.weather.gov/')) {
    requests.push(url);
    const body=url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/TEST/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[]}}:{type:'FeatureCollection',features:[]};
    return route.fulfill({json:body});
  }
  // No remote reporting/backend writes or production requests in this harness.
  return route.abort();
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.stack));

page.setDefaultTimeout(15000);
const prefix='reports/lp24445a-'+(baseline?'baseline-':'');
const bytes=()=>page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1'].map(k=>[k,localStorage.getItem(k)])));
async function inspect(){return page.evaluate(()=>{
 const card=document.getElementById('mobileDestinationCommandPanel');const r=card.getBoundingClientRect();const dock=document.querySelector('#gridlyPortraitV2 .gridly-v2-bottom-dock')?.getBoundingClientRect();
 return {context:gridlyGetCurrentAwarenessContext().type,place:gridlyGetCurrentAwarenessContext().placeName,visible:!card.hidden&&r.width>0&&r.height>0&&getComputedStyle(card).display!=='none',identity:document.getElementById('mobileAwarenessPanelKicker').textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},dockTop:dock?.top,viewport:innerWidth,ownership:getGridlyMobileCommandCardVisibilityState(),weather:gridlyResolveGovernedWeatherPoint(),nearby:gridlyGetCurrentGovernedLocationContext()?.label,community:buildGridlyCommunityAwarenessIntelligenceSummary().awarenessAreaName,roads:window.gridlyDriveTexasConnector.areaLifecycleAudit().activeCommunity,location:getGridlyCanonicalAwarenessPresentationContext().label,mapCenter:map.getCenter(),kbyg:gridlyBriefInteractionBuildModel().location,crossingHome:gridlyCrossingOwnedByAwarenessArea({lat:30.3413,lng:-95.0858}),crossingCrosby:gridlyCrossingOwnedByAwarenessArea({lat:29.91154,lng:-95.06325})};
 });}
async function choose(name){
 await page.locator('#mobileDestinationCommandBtn').click();
 await page.locator('#gridlyAddressSearchInput').fill(name);
 await page.locator('#gridlyRemoteSearchBtn').click();
 await page.locator('.gridly-search-result-item').filter({has:page.locator('.gridly-search-result-title',{hasText:new RegExp('^'+name+'$')})}).first().click();
 await page.locator('#gridlySearchCloseBtn').click();
 await page.waitForFunction(n=>gridlyGetCurrentAwarenessContext().placeName===n,name);
}
try{
 await page.goto(origin);await page.waitForFunction(()=>typeof window.gridlySearchAddress==='function');
 await page.evaluate(()=>saveGridlyHomeTownPreference('Cleveland'));
 const saved=await bytes();await choose('Crosby');
 const crosby=await inspect();await page.screenshot({path:prefix+'crosby-closed.png'});
 if(baseline){assert.equal(crosby.visible,false);fs.writeFileSync(prefix+'browser.json',JSON.stringify({crosby,errors},null,2));}
 else {
  assert.equal(crosby.context,'SEARCH');assert.equal(crosby.visible,true);assert.match(crosby.identity,/Crosby/i);
  assert.equal(await page.locator('#mobileDestinationCommandBtn').isVisible(),true);
  assert.equal(await page.locator('#gridlyTemporaryContextReturnHome').isVisible(),true);
  assert.deepEqual(await bytes(),saved);
  await choose('Dayton');const dayton=await inspect();assert.equal(dayton.place,'Dayton');assert.equal(dayton.visible,true);assert.match(dayton.identity,/Dayton/i);
  await page.locator('#gridlyTemporaryContextReturnHome').click();
  await page.waitForFunction(()=>gridlyGetCurrentAwarenessContext().type==='HOME');
  const home=await inspect();assert.equal(home.place,'Cleveland');assert.equal(home.visible,true);assert.match(home.identity,/Cleveland/i);
  for(const key of ['nearby','community','roads','location'])assert.equal(home[key],'Cleveland',key);
  assert.equal(home.weather.placeGeoid,'4815436');
  assert.equal(await page.locator('#gridlyTemporaryContextReturnHome').isVisible(),false);
  assert.match(home.kbyg,/Cleveland/i);assert.equal(home.crossingHome,true);assert.equal(home.crossingCrosby,false);
  assert.ok(Math.abs(home.mapCenter.lat-home.weather.lat)<0.02 && Math.abs(home.mapCenter.lng-home.weather.lng)<0.02);
  assert.deepEqual(await bytes(),saved);
  await page.screenshot({path:prefix+'home-restored.png'});
  const narrow=[];
  for(const width of [360,320]){await page.setViewportSize({width,height:844});await choose('Crosby');const state=await inspect();assert.equal(state.visible,true);assert.ok(state.rect.x>=0&&state.rect.x+state.rect.width<=width+1);assert.ok(state.rect.bottom<=state.dockTop+1);await page.screenshot({path:prefix+'crosby-'+width+'.png'});narrow.push(state);await page.locator('#gridlyTemporaryContextReturnHome').click();}
  assert.equal(errors.length,0);fs.writeFileSync(prefix+'browser.json',JSON.stringify({crosby,dayton,home,narrow,errors,homeStorageUnchanged:true,productionRequests:false},null,2));
 }
 console.log(JSON.stringify({baseline,crosbyVisible:crosby.visible,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
