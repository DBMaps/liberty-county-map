import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
const {chromium}=createRequire('C:/GitHub/liberty-county-map/package.json')('playwright');
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const baseline=false;
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
const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
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
  if(route.request().method()==='GET' && /^https:\/\/(?:[abc]\.tile\.openstreetmap\.org|server\.arcgisonline\.com)\//.test(url)) return route.continue();
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


const out='C:/GitHub/liberty-county-map/.artifacts/lp24447-approved-png-review';
const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.stack));
try {
 fs.mkdirSync(out,{recursive:true});
 await page.goto(origin);await page.waitForFunction(()=>typeof renderUnifiedIncidents==='function'&&typeof map!=='undefined');
 await page.evaluate(()=>{saveGridlyHomeTownPreference('Dayton');map.setView([30.0466,-94.8852],14,{animate:false});});
 await page.waitForFunction(()=>[...document.querySelectorAll('img.leaflet-tile')].some(img=>img.complete&&img.naturalWidth===256));
 await page.waitForTimeout(1200);
 const entries=await page.evaluate(()=>Object.values(GridlyMarkerRegistry.entries));
 const inventory=await page.evaluate(()=>({picker:{road:ROAD_HAZARD_TYPE_OPTIONS,other:OTHER_HAZARD_SUBTYPE_OPTIONS}}));
 const evidence={phase:'LP244.47 approved PNG',startingCommit:'f8c98922',synthetic:true,backendWrites:false,reportingActivated:false,tileAccess:'Only GET public map tiles; all backend requests blocked/stubbed',maps:[],mobile:[],assets:entries,errors};
 const boardPage=await context.newPage();
 await boardPage.goto(origin+'/.artifacts/lp24447-approved-png-review/index.html');
 await boardPage.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 await boardPage.screenshot({path:out+'/review-board.png',fullPage:true});await boardPage.close();
 if (!process.argv.includes("--boards-only")) {
 async function renderTypes(types,center,width=1440){
  await page.setViewportSize({width,height:width<700?844:1000});
  await page.evaluate(({types,center})=>{
   document.querySelectorAll('[data-owner-preview]').forEach(el=>el.remove());
   if(window.lp47PreviewLayer)map.removeLayer(window.lp47PreviewLayer);
   window.lp47PreviewLayer=L.layerGroup().addTo(map);
   map.invalidateSize({pan:false});map.setView(center,14,{animate:false});
   const size=map.getSize();
   const rows=types.map((type,i)=>{const pos=map.containerPointToLatLng([size.x*[.22,.5,.78][i%3],size.y*[.38,.54,.70][Math.floor(i/3)]]);return{id:'lp47-'+i,crossing_id:'hazard-lp47-'+i,report_type:OTHER_HAZARD_SUBTYPE_OPTIONS.some(o=>o.value===type)?'other_hazard':type,subtype:OTHER_HAZARD_SUBTYPE_OPTIONS.some(o=>o.value===type)?type:undefined,lat:pos.lat,lng:pos.lng,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),severity:'unknown',source:'user',confidence:'community'};});
   activeHazards=normalizeReports(rows);activeReports=[];recentlyClearedRoadHazards=[];gridlyV734RefreshReuseState.renderUnifiedSignature=null;renderUnifiedIncidents('lp24447-local-preview');
   for(let i=0;i<types.length;i++){
    const type=types[i];
    if(type==='road_closed'||type.startsWith('txdot_')){
     const official=gridlyBuildOfficialRoadwayProductionMarkerIcon({category:type,normalizedEvent:GridlyHazardNormalization.road({type})});
     unifiedIncidentLayer.getLayers().filter(m=>m.options.incident?.report_type===type||m.options.incidentId==='lp47-'+i).forEach(m=>m.setIcon(official));
    }
   }
  },{types,center});
  await page.waitForTimeout(400);
  await page.waitForFunction(()=>[...document.querySelectorAll('.gridly-production-marker-img')].every(img=>img.complete&&img.naturalWidth>0));
  const rendered=await page.evaluate(()=>unifiedIncidentLayer.getLayers().filter(m=>m.options.incidentId?.startsWith('lp47-')).map(m=>{const img=m.getElement().querySelector('img'),b=img.getBoundingClientRect();return{id:m.options.incidentId,asset:img.getAttribute('src'),width:b.width,height:b.height,x:b.x,y:b.y,title:buildGridlyHazardPopupConsumerModel(m.options.incident||{}).title};}));
  assert.equal(rendered.length,types.length);
  rendered.forEach((e,i)=>{assert.ok(Math.abs(e.width-64)<.2&&Math.abs(e.height-64)<.2,JSON.stringify(e));assert.ok(e.x>=0&&e.x+e.width<=width,JSON.stringify(e));assert.equal(e.asset,'assets/markers/approved/'+entries.find(x=>x.condition===types[Number(e.id.split('-')[1])]).asset);});
  const selections=await page.evaluate(()=>unifiedIncidentLayer.getLayers().filter(m=>m.options.incidentId?.startsWith('lp47-')).map(m=>{const el=m.getElement();el.classList.add('gridly-alert-focused-marker');const width=el.querySelector('img').getBoundingClientRect().width;el.classList.remove('gridly-alert-focused-marker');return {id:m.options.incidentId,width};}));
  assert.ok(selections.every(x=>Math.abs(x.width-70.4)<.3),JSON.stringify(selections));
  rendered.forEach(row=>row.selectedWidth=selections.find(x=>x.id===row.id).width);
  return rendered;
 }
 const density=['black_ice_suspected','snow_covered_road','flooding','crash','disabled_vehicle','road_blocked','debris','construction','traffic_backup'];
 for(const [name,center]of [['urban',[30.0466,-94.8852]],['rural',[30.115,-94.894]],['water',[30.019,-94.822]]]){
  const rendered=await renderTypes(density,center);
  await page.waitForTimeout(1600);
  await page.evaluate(({name,types})=>{const el=document.createElement('aside');el.dataset.ownerPreview='legend';el.style.cssText='position:fixed;left:12px;top:20px;width:270px;background:white;color:#173346;padding:20px;border-radius:16px;z-index:99999;font:15px/1.6 system-ui';el.innerHTML='<b>GRIDLY · '+name.toUpperCase()+'</b><h2>64 px map density</h2><p>Nine actual rendered conditions. Read left to right, top to bottom.</p>'+types.map((t,i)=>'<div>'+(i+1)+'. '+GridlyMarkerRegistry.resolve(t).label+'</div>').join('')+'<p>Local synthetic preview<br>No reporting or backend writes</p>';document.body.appendChild(el);},{name,types:density});
  await page.screenshot({path:out+'/complete-marker-map-'+name+'.png'});
  if(name==='urban')await page.screenshot({path:out+'/complete-marker-map-density-final.png'});
  evidence.maps.push({name,center,rendered,loadedTiles:await page.locator('img.leaflet-tile-loaded').count()});
 }
 const infrastructure=['debris','downed_power_line','utility_work','txdot_damage','txdot_bridge_restriction'];
 const infrastructureRendered=await renderTypes(infrastructure,[30.0466,-94.8852]);
 await page.evaluate(types=>{const el=document.createElement('aside');el.dataset.ownerPreview='legend';el.style.cssText='position:fixed;left:12px;top:20px;width:270px;padding:20px;background:white;color:#173346;border-radius:16px;z-index:99999;font:15px/1.6 system-ui';el.innerHTML='<b>INFRASTRUCTURE · 64 PX</b><p>Read left to right, top to bottom.</p>'+types.map((t,i)=>'<div>'+(i+1)+'. '+GridlyMarkerRegistry.resolve(t).label+'</div>').join('')+'<p>Actual map renderer · local synthetic fixtures</p>';document.body.appendChild(el);},infrastructure);
 await page.screenshot({path:out+'/infrastructure-marker-final.png'});evidence.infrastructure=infrastructureRendered;
 for(const width of [320,360,390,440]){
  for(let start=0;start<entries.length;start+=9){const types=entries.slice(start,start+9).map(x=>x.condition);const rendered=await renderTypes(types,[30.0466,-94.8852],width);await page.screenshot({path:out+'/map-mobile-'+width+'-'+start+'.png'});evidence.mobile.push({width,types,rendered});}
 }
 // The genuine report picker selects all primary and winter hazards; subtype coverage is also tested through its data options.
 await page.evaluate(()=>openPortraitV2Sheet('report'));
 await page.locator('[data-v2-winter-hazards] summary').click();
 for(const item of inventory.picker.road){const option=page.locator('[data-hazard-type="'+item.value+'"]').filter({visible:true});assert.ok(await option.count(),item.value);await option.first().click();assert.equal(await page.evaluate(()=>reportingState.selectedHazardType),item.value);}
 for(const item of inventory.picker.other){const button=page.locator('#gridlyPortraitV2SheetBody [data-other-hazard-subtype="'+item.value+'"]');await button.click();assert.equal(await page.evaluate(()=>selectedOtherHazardSubtype),item.value);}
 evidence.pickerSelections={primary:inventory.picker.road.length,subtypes:inventory.picker.other.length};
 await page.locator('#gridlyPortraitV2SheetClose').click();
 evidence.selected=await page.evaluate(()=>{const m=unifiedIncidentLayer.getLayers().find(m=>m.options.incidentId==='lp47-0');m.getElement().classList.add('gridly-alert-focused-marker');return m.getElement().querySelector('img').getBoundingClientRect().width;});
 assert.ok(Math.abs(evidence.selected-70.4)<.3);
 evidence.navigation=await page.evaluate(()=>{
 userLocation={lat:30.0466,lng:-94.8852};renderUserLocationDot();
 const start=gridlyCreateRouteEndpointMarker([30.049,-94.883],'origin').addTo(map);
 const end=gridlyCreateRouteEndpointMarker([30.045,-94.888],'destination').addTo(map);
 return [userMarker,start,end].map(m=>({html:m.options.icon.options.html,size:m.options.icon.options.iconSize,className:m.options.icon.options.className}));
 });
 for(const [i,file] of ['current-location.png','trip-start.png','trip-destination.png'].entries()){
 assert.ok(evidence.navigation[i].html.includes(file));assert.deepEqual(evidence.navigation[i].size,[48,48]);assert.equal(evidence.navigation[i].className,'gridly-navigation-marker-icon');
 }
 await page.screenshot({path:out+'/navigation-map.png'});
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(out+'/preview-evidence.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({assets:entries.length,maps:evidence.maps.length,mobileBatches:evidence.mobile.length,selectedWidth:evidence.selected,errors}));
}
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
