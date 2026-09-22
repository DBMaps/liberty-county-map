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


const out='C:/GitHub/liberty-county-map/.artifacts/lp24447a-approved-marker-review';
const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.stack));
try {
 fs.mkdirSync(out,{recursive:true});
 await page.goto(origin);await page.waitForFunction(()=>typeof renderUnifiedIncidents==='function'&&typeof map!=='undefined');
 await page.evaluate(()=>{saveGridlyHomeTownPreference('Dayton');map.setView([30.0466,-94.8852],14,{animate:false});});
 await page.waitForFunction(()=>[...document.querySelectorAll('img.leaflet-tile')].some(img=>img.complete&&img.naturalWidth===256));
 await page.waitForTimeout(1200);
 const entries=await page.evaluate(()=>Object.values(GridlyMarkerRegistry.entries));
 const inventory=JSON.parse(fs.readFileSync('reports/lp24447-marker-inventory.json','utf8'));
 const evidence={phase:'LP244.47A',startingCommit:'a3d5d1ff',synthetic:true,backendWrites:false,reportingActivated:false,tileAccess:'Only GET public map tiles; all backend requests blocked/stubbed',maps:[],mobile:[],assets:entries,errors};
 async function board(name,title,items,width=1440,before=false,official=false){
  await page.setViewportSize({width,height:1000});
  await page.evaluate(({title,items,before,official,inventory})=>{
   document.querySelectorAll('[data-owner-preview]').forEach(el=>el.remove());
   const el=document.createElement('section');el.dataset.ownerPreview='board';el.style.cssText='position:absolute;left:0;top:0;width:100%;z-index:999999;padding:28px;box-sizing:border-box;background:#edf2f5;color:#173346;font:14px/1.4 system-ui;';
   const cards=items.map((e,i)=>{
    const old=inventory.rows.find(x=>x.category===e.condition)?.currentAsset;
    const img='<img style="width:64px;height:64px;filter:drop-shadow(0 2px 3px #0a192352)" src="'+GridlyMarkerRegistry.basePath+e.asset+'" alt="'+e.label+'">';
    let icon=img;
    if(official&&e.condition==='road_closed'){
      const marker=L.marker(map.getCenter(),{icon:gridlyBuildOfficialRoadwayProductionMarkerIcon({category:'Road Closure'})}).addTo(map);
      const source=marker.getElement().firstElementChild,clone=source.cloneNode(true);
      const sources=[source,...source.querySelectorAll('*')],targets=[clone,...clone.querySelectorAll('*')];
      sources.forEach((node,index)=>{const style=getComputedStyle(node);targets[index].style.cssText=Array.from(style).map(k=>k+':'+style.getPropertyValue(k)+';').join('');});
      icon='<div style="width:64px;height:64px;position:relative">'+clone.outerHTML+'</div>';marker.remove();
    }
    return '<article style="min-width:0;background:white;border:1px solid #d0dde5;border-radius:14px;padding:16px;display:flex;flex-direction:column;align-items:center;text-align:center"><div style="display:flex;gap:24px;align-items:center;min-height:72px">'+(before&&old?'<div><img style="width:64px;height:64px" src="'+old+'"><div>Before</div></div>':'')+'<div>'+icon+(before?'<div>After</div>':'')+'</div></div><b style="margin-top:12px;font-size:14px">'+(i+1)+'. '+e.label+'</b><code style="font-size:10px;overflow-wrap:anywhere;margin-top:6px">'+e.condition+'</code><span style="font-size:10px;overflow-wrap:anywhere">'+e.asset+'</span>'+(official?'<span style="margin-top:6px;font-size:11px">'+(e.condition==='road_closed'?'Official • DriveTexas':'Community observation')+'</span>':'')+'</article>';
   }).join('');
   const utility=items.length===30?'<div style="margin-top:22px;padding:18px;background:#102b40;color:white;border-radius:14px"><b>Non-hazard map objects — existing semantics and dimensions preserved</b><div style="display:flex;flex-wrap:wrap;gap:25px;margin-top:16px;align-items:center"><div><span class="gridly-user-location-awareness-dot" style="position:relative;display:block;width:30px;height:30px"><span class="gridly-user-location-awareness-dot__ring"></span><span class="gridly-user-location-awareness-dot__core"></span></span>31. User location · 30 px</div><div><div class="gridly-destination-signature-marker" style="width:32px;height:32px"><span class="gridly-destination-ring"></span><span class="gridly-destination-core"></span></div>32. Destination · 32 px</div><div><span class="gridly-route-endpoint gridly-route-endpoint-origin" style="display:block;width:12px;height:12px"></span>33. Route origin · 12 px</div><div><span class="gridly-route-endpoint gridly-route-endpoint-destination" style="display:block;width:18px;height:18px"></span>34. Route destination · 18 px</div><div><span style="display:block;width:8px;height:8px;border:1px solid #8fb6ff;border-radius:50%;background:#8fb6ff4d"></span>35. Placement preview · radius 4</div><div>Suppressed: awareness map label<br>Area panel owns identity</div></div></div>':'';
   el.innerHTML='<div style="color:#12616b;font-size:12px;letter-spacing:2px;font-weight:800">GRIDLY · LP244.47A · OWNER REVIEW</div><h1 style="font-size:30px;line-height:1.15;margin:10px 0">'+title+'</h1><p>Actual implemented SVG assets at 64 × 64 CSS pixels. Symbols identify conditions; source attribution stays separate.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px">'+cards+'</div>'+utility+'<p style="margin-bottom:0;font-size:12px">Synthetic local preview • no submissions or backend writes • visual approval pending</p>';
   document.body.appendChild(el);
   // Copy actual computed runtime styling for context objects whose CSS requires #map.
   for (const sample of el.querySelectorAll('.gridly-route-endpoint')) {
     const probe=sample.cloneNode(true);document.getElementById('map').appendChild(probe);
     const cs=getComputedStyle(probe);for(const prop of ['border','background','border-radius','box-shadow','filter'])sample.style.setProperty(prop,cs.getPropertyValue(prop));probe.remove();
   }
  },{title,items,before,official,inventory});
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-owner-preview] img')].every(i=>i.complete&&i.naturalWidth>0));
  const bounds=await page.locator('[data-owner-preview="board"]').boundingBox();
  await page.setViewportSize({width,height:Math.ceil(bounds.height)});
  await page.locator('[data-owner-preview="board"]').screenshot({path:out+'/'+name+'.png'});
 }
 await board('complete-marker-library-final','Owner-approved Gridly marker library',entries);
 await board('complete-marker-library-dark','Symbols on Gridly navy',entries);
 await page.evaluate(()=>{document.querySelectorAll('[data-owner-preview=board] article').forEach(el=>{el.style.background='#102b40';el.style.color='white';});});
 await page.locator('[data-owner-preview=board]').screenshot({path:out+'/complete-marker-library-dark.png'});
 await board('complete-marker-library-64px','64 px mobile library',entries,390);
 await board('winter-marker-final','Seven distinct winter conditions',entries.filter(e=>e.family==='winter'));
 await board('community-road-state-comparison-final','Observation and official road status',entries.filter(e=>['road_blocked','road_impassable','road_closed'].includes(e.condition)),1050,false,true);
 await board('marker-before-after','One coherent marker language',entries.filter(e=>['ice','black_ice_suspected','snow_covered_road','flooding','crash','disabled_vehicle','debris','construction','traffic_backup','road_blocked','road_impassable','rail_blockage_delay'].includes(e.condition)),1440,true);
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
  rendered.forEach((e,i)=>{assert.ok(Math.abs(e.width-64)<.2&&Math.abs(e.height-64)<.2,JSON.stringify(e));assert.ok(e.x>=0&&e.x+e.width<=width,JSON.stringify(e));assert.equal(e.asset,'assets/markers/unified/'+entries.find(x=>x.condition===types[Number(e.id.split('-')[1])]).asset);});
  const selections=await page.evaluate(()=>unifiedIncidentLayer.getLayers().filter(m=>m.options.incidentId?.startsWith('lp47-')).map(m=>{const el=m.getElement();el.classList.add('gridly-alert-focused-marker');const width=el.querySelector('img').getBoundingClientRect().width;el.classList.remove('gridly-alert-focused-marker');return {id:m.options.incidentId,width};}));
  assert.ok(selections.every(x=>Math.abs(x.width-70.4)<.3),JSON.stringify(selections));
  rendered.forEach(row=>row.selectedWidth=selections.find(x=>x.id===row.id).width);
  return rendered;
 }
 const density=['black_ice_suspected','snow_covered_road','flooding','crash','disabled_vehicle','road_blocked','road_impassable','construction','traffic_backup'];
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
 assert.equal(errors.length,0,errors.join('\n'));
 fs.writeFileSync(out+'/preview-evidence.json',JSON.stringify(evidence,null,2));
 console.log(JSON.stringify({assets:entries.length,maps:evidence.maps.length,mobileBatches:evidence.mobile.length,selectedWidth:evidence.selected,errors}));
}
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
