import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const root = process.cwd();
const mime = { '.js':'text/javascript', '.json':'application/json', '.geojson':'application/json', '.css':'text/css', '.html':'text/html', '.svg':'image/svg+xml', '.png':'image/png' };
const server = http.createServer((req,res) => {
  const name = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if (!file.startsWith(root+path.sep)) { res.writeHead(403).end(); return; }
  if (!fs.existsSync(file)||!fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,channel:'msedge'});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',geolocation:{latitude:29.91154,longitude:-95.06325},permissions:['geolocation']});
await context.addInitScript(()=>{
  localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
  if(!localStorage.getItem('gridlySavedPlacesV1')) localStorage.setItem('gridlySavedPlacesV1',JSON.stringify({version:1,
    home:{id:'home',label:'Test home',lat:30.3413,lng:-95.0858,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},
    work:{id:'work',label:'Test work',lat:29.91154,lng:-95.06325,coordinateSource:'geocode',resolutionStatus:'success',validationStatus:'passed'},custom:[],favorites:[]}));
});
const requests=[],errors=[],searchActionProof=[];
await context.route('**/*',async route=>{
  const url=route.request().url();
  if(url.startsWith(origin)) return route.continue();
  // Deterministic routing response for lifecycle assertions; no live service dependency.
  if(url.includes('/route/v1/')) {
    const pairs=decodeURIComponent(new URL(url).pathname).split('/').at(-1).split(';').map(p=>p.split(',').map(Number));
    if(pairs.length<2||!pairs.every(p=>p.length===2&&p.every(Number.isFinite)))return route.abort();
    return route.fulfill({json:{code:'Ok',routes:[{geometry:{type:'LineString',coordinates:pairs},distance:1200,duration:120,weight:120,weight_name:'routability',legs:[{steps:[],distance:1200,duration:120,summary:'Local lifecycle fixture'}]}],waypoints:pairs.map(location=>({location,name:'Fixture',distance:0}))}});
  }
  if(route.request().method()==='GET' && (/\.tile\.openstreetmap\.org\//.test(url)||url.includes('server.arcgisonline.com/')||url.includes('/route/v1/')))return route.continue();
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
const prefix='.artifacts/lp24448/';fs.mkdirSync(prefix,{recursive:true});
const bytes=()=>page.evaluate(()=>Object.fromEntries(['gridlyHomePersonalizationV1','gridlyHomeTown','gridlySettingsV1','gridlyUserProfileV1'].map(k=>[k,localStorage.getItem(k)])));
async function inspect(){return page.evaluate(()=>{
 const card=document.getElementById('mobileDestinationCommandPanel');const r=card.getBoundingClientRect();const dock=document.querySelector('#gridlyPortraitV2 .gridly-v2-bottom-dock')?.getBoundingClientRect();
 return {context:gridlyGetCurrentAwarenessContext().type,place:gridlyGetCurrentAwarenessContext().placeName,visible:!card.hidden&&r.width>0&&r.height>0&&getComputedStyle(card).display!=='none',identity:document.getElementById('mobileAwarenessPanelKicker').textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},dockTop:dock?.top,viewport:innerWidth,ownership:getGridlyMobileCommandCardVisibilityState(),weather:gridlyResolveGovernedWeatherPoint(),nearby:gridlyGetCurrentGovernedLocationContext()?.label,community:buildGridlyCommunityAwarenessIntelligenceSummary().awarenessAreaName,roads:window.gridlyDriveTexasConnector.areaLifecycleAudit().activeCommunity,location:getGridlyCanonicalAwarenessPresentationContext().label,mapCenter:map.getCenter(),kbyg:gridlyBriefInteractionBuildModel().location,crossingHome:gridlyCrossingOwnedByAwarenessArea({lat:30.3413,lng:-95.0858}),crossingCrosby:gridlyCrossingOwnedByAwarenessArea({lat:29.91154,lng:-95.06325})};
 });}
async function aroundMeFromSearch(){
 await page.locator('#mobileDestinationCommandBtn').click();
 const button=page.getByRole('button',{name:'Around Me',exact:true});
 assert.equal(await button.count(),1);assert.equal(await button.isVisible(),true);assert.equal(await button.isEnabled(),true);
 const proof=await button.evaluate(el=>{const r=el.getBoundingClientRect(),shell=el.closest('#gridlySearchShell');return {width:innerWidth,text:el.textContent,name:el.getAttribute('aria-label')||el.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom},viewportHeight:innerHeight,nearby:!!shell.querySelector('#gridlyPoiSearch'),searchFields:shell.querySelectorAll('#gridlyAddressSearchInput').length};});
 assert.ok(proof.rect.x>=0&&proof.rect.x+proof.rect.width<=proof.width+1&&proof.rect.y>=0&&proof.rect.bottom<=proof.viewportHeight);assert.ok(proof.rect.height>=44,JSON.stringify(proof));assert.equal(proof.nearby,true);assert.equal(proof.searchFields,1);
 searchActionProof.push(proof);await page.screenshot({path:prefix+'search-around-me-'+proof.width+'.png'});
 await button.click();await page.waitForFunction(()=>document.getElementById('gridlySearchShell').hidden);
}
async function choose(name){
 if(process.argv.includes('--quick')){await page.evaluate(async n=>{selectGridlySearchResult((await gridlySearchAddress(n,{limit:5}))[0]);closeGridlyDestinationSearchSurface();},name);return;}
 await page.locator('#mobileDestinationCommandBtn').click();
 await page.locator('#gridlyAddressSearchInput').fill(name);
 await page.locator('#gridlyRemoteSearchBtn').click();
 await page.locator('.gridly-search-result-item').filter({has:page.locator('.gridly-search-result-title',{hasText:new RegExp('^'+name+'$')})}).first().click();
 await page.locator('#gridlySearchCloseBtn').click();
 await page.waitForFunction(n=>gridlyGetCurrentAwarenessContext().placeName===n,name);
}

const evidence={rows:[],errors,widths:[],homeUnchanged:true,searchActionProof};
const filterProof=[];evidence.filterProof=filterProof;
async function filterCheck(key,name,point){
 await page.locator('#gridlyPortraitV2 .gridly-v2-segments [data-geo-filter="'+key+'"]').click();
 await page.waitForTimeout(1200);
 const r=await page.evaluate(()=>({filter:activeGeoFilter,county:gridlyGetActiveCountyId(),place:gridlyGetCurrentAwarenessContext().placeName,type:gridlyGetCurrentAwarenessContext().type,center:map.getCenter(),zoom:map.getZoom(),home:getGridlySelectedAwarenessArea({homeOnly:true})?.label,presentation:gridlyActiveGeographicPresentation,areaTarget:gridlyGetTemporaryAreaFilterTarget(),inventoryOwner:gridlyCrossingInventoryCountyId,markers:[...crossingMarkers.values()].map(m=>m.getLatLng()),layerCount:crossingLayer?.getLayers().length,attached:map.hasLayer(crossingLayer)}));
 assert.equal(r.filter,key);assert.equal(r.place,name);assert.equal(r.home,'Cleveland');
 if(key==='county'){assert.equal(r.county,'liberty-tx');assert.ok(r.zoom<=11);}
 else {assert.ok(Math.abs(r.center.lat-point.lat)<.12&&Math.abs(r.center.lng-point.lng)<.12,JSON.stringify(r));}
 if(key==='town'&&name==='Dayton'){assert.equal(r.county,'liberty-tx');assert.equal(r.inventoryOwner,'liberty-tx');assert.ok(r.attached);assert.ok(r.markers.length>0);assert.ok(r.markers.some(p=>Math.abs(p.lat-point.lat)<.1&&Math.abs(p.lng-point.lng)<.1));assert.ok(Math.abs(r.areaTarget.lat-point.lat)<.01);}
 filterProof.push({width:await page.evaluate(()=>innerWidth),...r});return r;
}

async function snap(label){console.log('Snapshot',label);const result=await inspect();const extra=await page.evaluate(()=>({health:gridlyGetCurrentAwarenessContext().health,returnHome:!document.getElementById('gridlyTemporaryContextReturnHome').hidden,home:getGridlySelectedAwarenessArea({homeOnly:true})?.label,homeCounty:getGridlySelectedAwarenessArea({homeOnly:true})?.countyId,settingsHome:getGridlyLp0517SettingsHomeDisplay(),marker:[...document.querySelectorAll('.gridly-navigation-marker-img')].map(i=>({url:i.src,loaded:i.complete&&i.naturalWidth>0})),context:gridlyGetCurrentAwarenessContext()}));evidence.rows.push({label,...result,...extra});await page.screenshot({path:prefix+label+'.png'});return {...result,...extra};}
try{
 await page.goto(origin);await page.waitForFunction(()=>typeof window.gridlySearchAddress==='function');await page.evaluate(()=>saveGridlyHomeTownPreference('Cleveland'));const saved=await bytes();console.log('Home ready');
 await snap('01-home');
 await choose('Crosby');await snap('02-search');await choose('Dayton');await snap('03-repeated-search');
 await page.locator('#gridlyTemporaryContextReturnHome').click();assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().type),'HOME');await snap('04-home-restored');
 for(const width of [390,320,360,440]){
 await page.setViewportSize({width,height:844});await context.setGeolocation({latitude:29.91154,longitude:-95.06325});await aroundMeFromSearch();await page.waitForFunction(()=>gridlyGetCurrentAwarenessContext().type==='AROUND_ME');await page.waitForTimeout(800);
 await filterCheck('town','Around Me',{lat:29.91154,lng:-95.06325});const r=await snap('around-'+width);assert.equal(r.context.health,'FRESH');assert.equal(r.context.placeName,'Around Me');assert.equal(r.returnHome,true);assert.equal(r.visible,true);assert.ok(r.rect.x>=-1&&r.rect.x+r.rect.width<=width+1);assert.ok(r.rect.bottom<=r.dockTop+2);assert.ok(Math.abs(r.mapCenter.lat-29.91154)<.003);assert.ok(r.marker.some(i=>i.url.endsWith('/navigation/current-location.png')&&i.loaded));assert.equal(r.weather.identityClass,'DIRECT_COORDINATE');assert.equal(r.roads,'Around Me');for(const key of ['nearby','community','location'])assert.equal(r[key],'Around Me');assert.match(r.kbyg,/Around Me/);assert.match(r.settingsHome.label,/Cleveland/);
 await choose('Dayton');
 await page.waitForFunction(()=>gridlyCrossingInventoryCountyId==='liberty-tx'&&crossings.length>0);
 for(const filter of ['nearby','town','county','all','nearby','town'])await filterCheck(filter,'Dayton',{lat:30.0466,lng:-94.8852});
 await choose('Crosby');await page.waitForFunction(()=>gridlyCrossingInventoryCountyId==='harris-tx'&&crossings.length>0);await filterCheck('town','Crosby',{lat:29.91154,lng:-95.06325});
 await choose('Dayton');const search=await inspect();assert.equal(search.context,'SEARCH');assert.equal(search.place,'Dayton');assert.equal(search.visible,true);
 // Approximate keyboard-reduced visible area without changing the product layout.
 await page.locator('#mobileDestinationCommandBtn').click();await page.locator('#gridlyAddressSearchInput').focus();await page.setViewportSize({width,height:520});assert.equal(await page.locator('#gridlySearchCloseBtn').isVisible(),true);await page.locator('#gridlySearchCloseBtn').click();await page.setViewportSize({width,height:844});
 await context.setGeolocation({latitude:29.91154,longitude:-95.06325});await aroundMeFromSearch();await page.waitForFunction(()=>gridlyGetCurrentAwarenessContext().type==='AROUND_ME');await snap('search-around-'+width);
 await page.locator('#gridlyTemporaryContextReturnHome').click();assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().placeName),'Cleveland');assert.deepEqual(await bytes(),saved);await filterCheck('town','Cleveland',{lat:30.3413,lng:-95.0858});evidence.widths.push(width);
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{window.lp48Provider=requestGridlyForegroundPosition;requestGridlyForegroundPosition=(ok,fail)=>{fail({code:1});return 'denied-fixture';};});await context.setGeolocation({latitude:29.91154,longitude:-95.06325});await aroundMeFromSearch();assert.equal(await page.evaluate(()=>gridlyGetCurrentAwarenessContext().type),'HOME');await snap('denied');await page.evaluate(()=>{requestGridlyForegroundPosition=window.lp48Provider;});
 await context.setGeolocation({latitude:29.91154,longitude:-95.06325});await aroundMeFromSearch();await page.waitForFunction(()=>gridlyGetCurrentAwarenessContext().type==='AROUND_ME');await page.evaluate(()=>{const c=gridlyGetCurrentAwarenessContext();gridlyExpireForegroundAwarenessContext(c,c.expiresAt+1);});const stale=await snap('stale');assert.equal(stale.health,'STALE');assert.equal(stale.marker.some(i=>i.url.endsWith('/current-location.png')),false);assert.equal(stale.weather,null);
 await context.setGeolocation({latitude:29.91154,longitude:-95.06325});await aroundMeFromSearch();await page.waitForFunction(()=>gridlyGetCurrentAwarenessContext().health==='FRESH');
 // County-qualified temporary PLACE identities and Home restoration use existing search authority.
 for(const [name,county]of [['Austin','hays-tx'],['Austin','travis-tx'],['Abilene','jones-tx'],['Abilene','taylor-tx']]){await page.evaluate(async({name,county})=>{const result=(await gridlySearchAddress(name,{limit:8})).find(r=>r.placeGeoid);selectGridlySearchResult({...result,requestedOperationalCountyId:county});closeGridlyDestinationSearchSurface();},{name,county});const c=await page.evaluate(()=>gridlyGetCurrentAwarenessContext());assert.equal(c.countyId,county);assert.equal(c.type,'SEARCH');assert.ok(c.memberships.length>1);}
 await page.locator('#gridlyTemporaryContextReturnHome').click();assert.deepEqual(await bytes(),saved);
 const route=await page.evaluate(async()=>{await renderRoutePreviewLine({lat:30.0466,lng:-94.8852},{lat:30.055,lng:-94.88});routeWatchActivated=true;window.__gridlyRouteWatchActive=true;const geometry=window.__gridlyRoutePreviewLayer.getLatLngs();const endpoints=routePreviewCorridorLayer.getLayers().filter(m=>m.options.icon).map(m=>({html:m.options.icon.options.html,anchor:m.options.icon.options.iconAnchor}));const kind=gridlyGetCurrentAwarenessContext().type;const locationBlocked=requestGridlyUserLocationFromSearch();const result=selectGridlySearchResult({id:'test',title:'Other',lat:29.9,lng:-95});const unchanged=JSON.stringify(window.__gridlyRoutePreviewLayer.getLatLngs())===JSON.stringify(geometry);stopGridlyRouteWatch('lp24448-test');return {kind,locationBlocked,result,unchanged,endpoints,after:gridlyGetCurrentAwarenessContext().type};});assert.equal(route.kind,'ROUTE_WATCH');assert.equal(route.locationBlocked,false);assert.equal(route.result,null);assert.equal(route.unchanged,true);assert.equal(route.after,'HOME');assert.ok(route.endpoints[0].html.includes('trip-start.png'));assert.ok(route.endpoints[1].html.includes('trip-destination.png'));evidence.route=route;await snap('route-regression');
 evidence.filterProof=filterProof;assert.deepEqual(await bytes(),saved);assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync('reports/lp24448-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify({rows:evidence.rows.length,widths:evidence.widths,errors,route}));
}finally{fs.writeFileSync(prefix+'partial.json',JSON.stringify(evidence,null,2));await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
