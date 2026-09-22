import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const baseline=process.argv.includes('--baseline');
const baselineFiles=new Map(baseline?['js/app.js','js/gridlyPoiBrowserProvider.js','js/gridlyWeatherLiveConnector.js'].map(p=>[p,execFileSync('git',['show','44f2778caf9cc9e10edde4fdb629d60d4dc0fd91:'+p],{maxBuffer:30e6})]):[]);
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
try {
  await page.goto(origin);
  await page.waitForFunction(()=>typeof window.gridlySearchAddress==='function');
  const skip=page.getByRole('button',{name:'Skip',exact:true});
  if(await skip.isVisible()) await skip.click();
  const home=await page.evaluate(()=>{saveGridlyHomeTownPreference('Cleveland');return window.gridlyGetCurrentAwarenessContext?.() || getGridlySelectedAwarenessArea();});
  const homeBytes=await page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1'].map(k=>[k,localStorage.getItem(k)])));
  await page.screenshot({path:`reports/lp24445-portrait-${baseline?'baseline-':''}home.png`});
  const layout=await page.evaluate(()=>Object.fromEntries(['map','gridlyAddressSearchInput','gridlyV2TopStatusPrimary'].map(id=>{const r=document.getElementById(id)?.getBoundingClientRect();return[id,r?{x:r.x,y:r.y,width:r.width,height:r.height}:null];})));
  const selection=await page.evaluate(async()=>{
    const results=await window.gridlySearchAddress('Crosby',{limit:5});
    selectGridlySearchResult(results[0]);
    return {result:results[0],context:window.gridlyGetCurrentAwarenessContext?.() || getGridlySelectedAwarenessArea(),point:gridlyResolveGovernedWeatherPoint(),nearby:gridlyGetCurrentGovernedLocationContext(),summary:buildGridlyCommunityAwarenessIntelligenceSummary().awarenessAreaName};
  });
  await page.waitForFunction(()=>window.gridlyWeatherConnectorRuntimeAudit?.().requestSucceeded===true);
  await page.screenshot({path:`reports/lp24445-portrait-${baseline?'baseline-':''}search.png`,fullPage:false});
  await page.locator('#gridlyBriefFoundationHandle').click();
  const briefLocation=await page.locator('#gridlyBriefLocation').textContent();
  const visibleBriefHeading=await page.locator('#gridlyBriefInteractionPanel .gridly-brief-section-label').textContent();
  await page.screenshot({path:`reports/lp24445-portrait-${baseline?'baseline-':''}brief.png`});
  await page.locator('#gridlyBriefFoundationHandle').click();
  const primaryWeatherRequests=[...requests];
  const settingsHome=await page.evaluate(()=>getGridlySettingsAwarenessAreaDisplay());
  await page.evaluate(()=>openGridlyDestinationSearchSurface());
  await page.locator('#gridlyAddressSearchInput').waitFor({state:'visible'});
  await page.screenshot({path:`reports/lp24445-portrait-${baseline?'baseline-':''}search-open.png`});
  await page.locator('#gridlySearchCloseBtn').click();
  await page.evaluate(()=>document.getElementById('mobileHeaderSettingsBtn').click());
  await page.locator('.settings-section-awareness > summary').click();
  await page.locator('[data-gridly-settings-home-area]').waitFor({state:'visible'});
  const visibleSettingsHome=await page.locator('[data-gridly-settings-home-area]').textContent();
  await page.screenshot({path:`reports/lp24445-portrait-${baseline?'baseline-':''}settings.png`});
  await page.evaluate(()=>window.closePortraitV2Sheet());
  const outcomes=[];
  if(!baseline) {
    assert.equal(settingsHome.label,'Cleveland');assert.equal(visibleSettingsHome,'Cleveland');
    assert.equal(home.placeName,'Cleveland');assert.equal(selection.context.type,'SEARCH');assert.equal(selection.context.placeName,'Crosby');
    assert.equal(selection.point.placeGeoid,'4817756');assert.equal(selection.nearby.label,'Crosby');assert.equal(selection.summary,'Crosby');
    assert.deepEqual(selection.context.memberships,['48201']);
    assert.match(briefLocation,/Crosby/);
    assert.match(visibleBriefHeading,/Crosby/);
    const consumers=await page.evaluate(()=>{
      const area=getGridlySelectedAwarenessArea();
      return{roads:window.gridlyDriveTexasConnector.areaLifecycleAudit(),
        location:getGridlyCanonicalAwarenessPresentationContext().label,
        nearby:window.GridlyPoiBrowserProvider.requestForCurrentContext(5),
        communityCrosby:isGridlyRecordInAwarenessArea({lat:29.91154,lng:-95.06325},area),
        communityCleveland:isGridlyRecordInAwarenessArea({lat:30.3413,lng:-95.0858},area),
        crossingCrosby:gridlyCrossingOwnedByAwarenessArea({lat:29.91154,lng:-95.06325},area),
        crossingCleveland:gridlyCrossingOwnedByAwarenessArea({lat:30.3413,lng:-95.0858},area)};
    });
    assert.equal(consumers.roads.activeCommunity,'Crosby');assert.equal(consumers.location,'Crosby');assert.equal(consumers.nearby.name,'Crosby');
    assert.equal(consumers.communityCrosby,true);assert.equal(consumers.communityCleveland,false);
    assert.equal(consumers.crossingCrosby,true);assert.equal(consumers.crossingCleveland,false);
    outcomes.push({consumerIntegration:consumers,briefLocation});
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1'].map(k=>[k,localStorage.getItem(k)]))),homeBytes);
    outcomes.push('Cleveland Home / Crosby Search preserves all four Home storage keys and agrees across weather, Nearby and KBYG');
    for(const [name,county] of [['Dayton','liberty-tx'],['Austin','hays-tx'],['Austin','travis-tx'],['Abilene','jones-tx'],['Abilene','taylor-tx'],['Dallas','dallas-tx']]) {
      const actual=await page.evaluate(async({name,county})=>{
        const result=(await window.gridlySearchAddress(name,{limit:5}))[0];
        selectGridlySearchResult({...result,requestedOperationalCountyId:county});
        const c=gridlyGetCurrentAwarenessContext();
        return {name:c.placeName,county:c.countyId,activeCounty:gridlyGetActiveCountyId(),weather:gridlyResolveGovernedWeatherPoint()?.countyId,nearby:gridlyGetCurrentGovernedLocationContext()?.countyContextId,summary:buildGridlyCommunityAwarenessIntelligenceSummary().awarenessAreaName,memberships:c.memberships};
      },{name,county});
      assert.equal(actual.name,name);for(const key of ['county','activeCounty','weather','nearby'])assert.equal(actual[key],county,key+': '+name);
      assert.equal(actual.summary,name);outcomes.push(actual);
    }
    const poi=await page.evaluate(()=>{const input={id:'test-crosby-poi',provider:'test-fixture',title:'Destination with punctuation: A & B',type:'point_of_interest',lat:29.91154,lng:-95.06325,address:{city:'Crosby',state:'Texas'},countyId:'harris-tx'};selectGridlySearchResult(input);return{destination:ensureGridlySearchState().selectedDestination,awareness:gridlyGetCurrentAwarenessContext()};});
    assert.equal(poi.destination.title,'Destination with punctuation: A & B');assert.equal(poi.awareness.placeName,'Crosby');outcomes.push('POI destination title/point retained independently of Crosby awareness');
    const degraded=await page.evaluate(async()=>{const r=(await gridlySearchAddress('Austin',{limit:5}))[0];selectGridlySearchResult({...r,requestedOperationalCountyId:'harris-tx'});return{context:gridlyGetCurrentAwarenessContext(),presentation:getGridlyCanonicalAwarenessPresentationContext(),summary:buildGridlyCommunityAwarenessIntelligenceSummary(),brief:gridlyBuildTravelBriefModel(),weather:gridlyResolveGovernedWeatherPoint(),nearby:gridlyGetCurrentGovernedLocationContext()};});
    assert.equal(degraded.brief.sections[0].familyState,'UNAVAILABLE');assert.doesNotMatch(JSON.stringify(degraded.brief),/all clear|quiet/i);assert.equal(degraded.context.health,'UNAVAILABLE');assert.equal(degraded.presentation.countyId,null);assert.equal(degraded.weather,null);assert.equal(degraded.nearby,null);assert.match(degraded.summary.awarenessStatus,/unavailable|being confirmed/i);assert.doesNotMatch(degraded.summary.awarenessStatus,/all clear|quiet/i);outcomes.push('Invalid temporary membership fails unavailable without Home or stale-county substitution');
    const cleared=await page.evaluate(()=>{clearGridlyPendingDestination({reason:'lp24445-test'});return{context:gridlyGetCurrentAwarenessContext(),point:gridlyResolveGovernedWeatherPoint(),summary:buildGridlyCommunityAwarenessIntelligenceSummary().awarenessAreaName,nearby:gridlyGetCurrentGovernedLocationContext()};});
    assert.equal(cleared.context.type,'HOME');assert.equal(cleared.context.placeName,'Cleveland');assert.equal(cleared.summary,'Cleveland');assert.equal(cleared.nearby.label,'Cleveland');outcomes.push('Existing clear action restores Cleveland without reload');
    assert.deepEqual(await page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1'].map(k=>[k,localStorage.getItem(k)]))),homeBytes);
    await page.evaluate(async()=>selectGridlySearchResult((await gridlySearchAddress('Crosby',{limit:5}))[0]));
    await page.reload();await page.waitForFunction(()=>typeof window.gridlyGetCurrentAwarenessContext==='function');
    assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().placeName),'Cleveland');outcomes.push('Restart rehydrates Home, never Search');
  }
  const evidence={baseline,home,selection,outcomes,briefLocation,visibleBriefHeading,settingsHome,visibleSettingsHome,primaryWeatherRequests,layout,errors,weatherRequests:requests,remoteRequestsBlocked:true};
  fs.writeFileSync(`reports/lp24445-${baseline?'baseline-browser':'browser'}-observation.json`,JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify({baseline,checks:outcomes.length,errors,layout}));
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
