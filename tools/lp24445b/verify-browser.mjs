import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const baseline=process.argv.includes('--baseline');
const baselineFiles=new Map(baseline?['js/app.js','index.html','css/styles.css'].map(p=>[p,execFileSync('git',['show','a3218de7fd0b1a4de40768df7e631ead473ec60e:'+p],{maxBuffer:30e6})]):[]);
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

page.setDefaultTimeout(45000);
const prefix='reports/lp24445b-'+(baseline?'baseline-':process.argv.includes('--quick')?'quick-':'');
const bytes=()=>page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1'].map(k=>[k,localStorage.getItem(k)])));
async function inspect(){return page.evaluate(()=>{
 const card=document.getElementById('mobileDestinationCommandPanel');const r=card.getBoundingClientRect();const dock=document.querySelector('#gridlyPortraitV2 .gridly-v2-bottom-dock')?.getBoundingClientRect();
 return {context:gridlyGetCurrentAwarenessContext().type,place:gridlyGetCurrentAwarenessContext().placeName,visible:!card.hidden&&r.width>0&&r.height>0&&getComputedStyle(card).display!=='none',identity:document.getElementById('mobileAwarenessPanelKicker').textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},dockTop:dock?.top,viewport:innerWidth,ownership:getGridlyMobileCommandCardVisibilityState(),weather:gridlyResolveGovernedWeatherPoint(),nearby:gridlyGetCurrentGovernedLocationContext()?.label,community:buildGridlyCommunityAwarenessIntelligenceSummary().awarenessAreaName,roads:window.gridlyDriveTexasConnector.areaLifecycleAudit().activeCommunity,location:getGridlyCanonicalAwarenessPresentationContext().label,mapCenter:map.getCenter(),kbyg:gridlyBriefInteractionBuildModel().location,crossingHome:gridlyCrossingOwnedByAwarenessArea({lat:30.3413,lng:-95.0858}),crossingCrosby:gridlyCrossingOwnedByAwarenessArea({lat:29.91154,lng:-95.06325})};
 });}
async function choose(name){
 if(process.argv.includes('--quick')){await page.evaluate(async n=>{selectGridlySearchResult((await gridlySearchAddress(n,{limit:5}))[0]);closeGridlyDestinationSearchSurface();},name);return;}
 await page.locator('#mobileDestinationCommandBtn').click();
 await page.locator('#gridlyAddressSearchInput').fill(name);
 await page.locator('#gridlyRemoteSearchBtn').click();
 await page.locator('.gridly-search-result-item').filter({has:page.locator('.gridly-search-result-title',{hasText:new RegExp('^'+name+'$')})}).first().click();
 await page.locator('#gridlySearchCloseBtn').click();
 await page.waitForFunction(n=>gridlyGetCurrentAwarenessContext().placeName===n,name);
}

async function observe(label){const state=await inspect();const extra=await page.evaluate(()=>{const c=gridlyGetCurrentAwarenessContext();return {expected:resolveGridlyCanonicalPlacePresentationFocus(c.placeId),camera:gridlyCommittedSemanticCamera,visibility:gridlyDestinationVisibilityAudit(),focusCalls:window.__lp24445bFocusCalls.slice()};});Object.assign(state,extra,{label});state.agrees=Math.abs(state.mapCenter.lat-state.expected.lat)<0.002&&Math.abs(state.mapCenter.lng-state.expected.lng)<0.002;return state;}
try{
 await page.goto(origin);await page.waitForFunction(()=>typeof window.gridlySearchAddress==='function');
 await page.evaluate(()=>{saveGridlyHomeTownPreference('Cleveland');window.__lp24445bFocusCalls=[];const dispatch=gridlyDispatchSemanticCamera;gridlyDispatchSemanticCamera=function(area,county,options){const result=dispatch(area,county,options);window.__lp24445bFocusCalls.push({place:area?.label,source:options?.source,generation:gridlyGetCurrentAwarenessContext().generation,result});return result;};});
 const saved=await bytes(),rows=[];
 await choose('Crosby');rows.push(await observe('A: Home to Crosby'));
 await page.locator('#gridlyTemporaryContextReturnHome').click();rows.push(await observe('B: Return Cleveland'));
 await choose('Dayton');rows.push(await observe('C/F: Home restored then Dayton'));
 if(!baseline){await choose('Crosby');rows.push(await observe('E: Dayton to Crosby'));
 await choose('Dayton');rows.push(await observe('D: Crosby to Dayton'));}
 await page.screenshot({path:prefix+'dayton.png'});
 fs.writeFileSync(prefix+'browser.json',JSON.stringify({baseline,rows,errors,status:'CHECKING'},null,2));
 if(baseline){assert.ok(rows.some(r=>!r.agrees));}
 else{
  for(const row of rows){assert.equal(row.agrees,true,row.label+': map/context mismatch');assert.equal(row.visible,true);assert.match(row.identity,new RegExp(row.place,'i'));for(const key of ['nearby','community','roads','location'])assert.equal(row[key],row.place,row.label+': '+key);assert.match(row.kbyg,new RegExp(row.place,'i'));assert.equal(row.weather.placeGeoid,row.expected.placeGeoid);assert.equal(row.crossingHome,row.place==='Cleveland');assert.equal(row.crossingCrosby,row.place==='Crosby');}
  const calls=rows.at(-1).focusCalls;assert.equal(calls.filter(c=>c.source==='temporary-search-selected').length,4);assert.equal(calls.filter(c=>c.source==='temporary-context-cleared').length,process.argv.includes('--quick')?1:3);assert.equal(new Set(calls.map(c=>c.generation)).size,calls.length);assert.ok(calls.every(c=>c.result===true));
  const stale=await page.evaluate(async()=>{const c=(await gridlySearchAddress('Crosby',{limit:5}))[0],d=(await gridlySearchAddress('Dayton',{limit:5}))[0];selectGridlySearchResult(c);const old=gridlyGetCurrentAwarenessContext();selectGridlySearchResult(d);const before=map.getCenter();const rejected=gridlyFocusSearchAwarenessContext(old,c);const directRejected=gridlyDispatchSemanticCamera(old.area,old.countyId,{temporaryContext:old,source:'test-late-crosby'});return{before,after:map.getCenter(),rejected,directRejected,place:gridlyGetCurrentAwarenessContext().placeName};});assert.equal(stale.place,'Dayton');assert.equal(stale.rejected,false);assert.equal(stale.directRejected,false);assert.deepEqual(stale.after,stale.before);
  assert.deepEqual(await bytes(),saved);await page.locator('#gridlyTemporaryContextReturnHome').click();assert.equal(await page.locator('#gridlyTemporaryContextReturnHome').isVisible(),false);const restored=await observe('final Home');assert.equal(restored.agrees,true);assert.equal(restored.place,'Cleveland');assert.deepEqual(await bytes(),saved);
  rows.push({stale},restored);
 }
 assert.equal(errors.length,0);fs.writeFileSync(prefix+'browser.json',JSON.stringify({baseline,rows,errors,homeStorageUnchanged:JSON.stringify(await bytes())===JSON.stringify(saved),productionRequests:false},null,2));console.log(JSON.stringify({baseline,rows:rows.length,agreements:rows.filter(r=>r.agrees===true).length,errors}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
