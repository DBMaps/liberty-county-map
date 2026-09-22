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


const out='C:/GitHub/liberty-county-map/.artifacts/lp24446b-winter-marker-preview';
const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.stack));
try {
 await page.goto(origin);await page.waitForFunction(()=>typeof renderUnifiedIncidents==='function'&&typeof map!=='undefined');
 await page.evaluate(async()=>{saveGridlyHomeTownPreference('Dayton');map.setView([30.0466,-94.8852],14,{animate:false});});
 await page.waitForFunction(()=>[...document.querySelectorAll('img.leaflet-tile')].some(img=>img.complete&&img.naturalWidth===256));
 await page.waitForTimeout(1500);
 const result=await page.evaluate(()=>{
  const types=[...GridlyHazardNormalization.winterOptions.map(o=>o.type),'flooding','construction','other_hazard','road_closed'];
  const rows=types.map((type,i)=>({id:'winter-preview-'+(i+1),crossing_id:'hazard-preview-'+(i+1),report_type:type,lat:30.064-(Math.floor(i/3)*.01),lng:-94.905+(i%3)*.02,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),severity:'unknown',source:'user',confidence:'community',detail:'Synthetic local-only owner preview'}));
  activeHazards=normalizeReports(rows);activeReports=[];recentlyClearedRoadHazards=[];
  gridlyV734RefreshReuseState.renderUnifiedSignature=null;
  renderUnifiedIncidents('local-only-winter-owner-preview');
  const closure=unifiedIncidentLayer.getLayers().filter(m=>m.options.incident?.report_type==='road_closed'||m.options.incidentId==='winter-preview-11');
  closure.forEach(m=>m.setIcon(gridlyBuildOfficialRoadwayProductionMarkerIcon({category:'Road Closure',type:'road_closed',routeName:'US 90'})));
  return {markers:unifiedIncidentLayer.getLayers().map(m=>({id:m.options.incidentId,type:m.options.incident?.type,html:m.options.icon?.options?.html,size:m.options.icon?.options?.iconSize})),center:map.getCenter(),errors:[]};
 });
 fs.writeFileSync(out+'/initial-render.json',JSON.stringify({result,errors},null,2));

 const names=['Ice / Icy Road','Possible Black Ice','Bridge / Overpass Icing','Snow-Covered Road','Sleet / Freezing Rain','Reduced Visibility','Other Winter Road Hazard','Flooding / High Water','Construction','Generic road hazard','Closure asset (comparison only)'];
 async function labelPreview(title,indices){
  await page.evaluate(({title,names,indices})=>{
   document.querySelectorAll('[data-owner-preview]').forEach(el=>el.remove());
   const panel=document.createElement('aside');panel.dataset.ownerPreview='legend';panel.style.cssText='position:fixed;left:18px;top:24px;width:290px;padding:20px;box-sizing:border-box;background:#fff;border:1px solid #cbd8e2;border-radius:18px;z-index:20000;color:#163345;font:15px/1.45 system-ui;box-shadow:0 5px 25px #1232';
   panel.innerHTML='<div style="font-size:11px;letter-spacing:1.6px;color:#087e86;font-weight:800">GRIDLY · LP244.46B</div><h1 style="font-size:25px;line-height:1.15">'+title+'</h1><p>Synthetic markers on the real Dayton map. Local preview only.</p>'+indices.map(i=>'<div style="display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #e3ebef"><b style="background:#163345;color:white;border-radius:50%;min-width:26px;height:26px;text-align:center;line-height:26px">'+(i+1)+'</b><span>'+names[i]+'</span></div>').join('')+'<p style="font-size:12px;color:#496170">1–7 each use a distinct winter SVG.<br>8 water · 9 construction<br>10 generic hazard · 11 closure</p><p style="font-size:12px;color:#496170">Production pin size, borders and shadows are preserved; the ice/water scale alias is removed. Labels are preview-only.</p>';
   document.body.appendChild(panel);
   const note=document.createElement('aside');note.dataset.ownerPreview='note';note.style.cssText='position:fixed;right:18px;top:24px;width:285px;padding:20px;box-sizing:border-box;background:#fff;border:1px solid #cbd8e2;border-radius:18px;z-index:20000;color:#163345;font:14px/1.5 system-ui';note.innerHTML='<b>Actual implementation</b><p>Seven navy pins with distinct high-contrast condition symbols.</p><p>Flooding: dark pin with road and water symbol.</p><p>Generic hazard: dark pin with yellow caution symbol.</p><hr style="border:0;border-top:1px solid #ddd"><p>Production icon box: 64 × 64 px.<br>All winter artwork uses the same 64 px scale. The old ice/water size alias is removed.</p><p>No report submission. No backend writes. No production edits.</p>';document.body.appendChild(note);
   indices.forEach(i=>{const marker=unifiedIncidentLayer.getLayers().find(m=>m.options.incidentId==='winter-preview-'+(i+1));if(!marker)return;const bounds=marker.getElement().querySelector('.gridly-production-marker-img').getBoundingClientRect();const badge=document.createElement('div');badge.dataset.ownerPreview='number';badge.style.cssText='position:fixed;left:'+(bounds.right+6)+'px;top:'+(bounds.top+8)+'px;width:25px;height:25px;background:#163345;color:white;border:2px solid white;border-radius:50%;text-align:center;font:700 14px/25px system-ui;z-index:19000;box-shadow:0 2px 6px #0006';badge.textContent=i+1;document.body.appendChild(badge);});
  },{title,names,indices});
 }
 await page.waitForFunction(()=>[...document.querySelectorAll('.gridly-production-marker-img')].every(i=>i.complete&&i.naturalWidth>0));
 await labelPreview('Distinct winter hazards',[0,1,2,3,4,5,6,7,8,9,10]);
 await page.screenshot({path:out+'/winter-marker-family-distinct.png'});
 const dimensions=await page.evaluate(()=>unifiedIncidentLayer.getLayers().filter(m=>m.options.incidentId?.startsWith('winter-preview-')).map(m=>{const el=m.getElement(),img=el.querySelector('img'),r=img.getBoundingClientRect();return {id:m.options.incidentId,asset:img.getAttribute('src'),iconSize:m.options.icon.options.iconSize,renderedImage:{width:r.width,height:r.height},className:el.className};}));

 await labelPreview('Winter vs. other hazards',[0,1,2,3,4,5,6,7,8,9,10]);
 await page.screenshot({path:out+'/winter-marker-comparison.png'});
 const mobile=[];
 for(const width of [320,360,390,440]) {
  await page.setViewportSize({width,height:844});
  await page.evaluate(()=>{document.querySelectorAll('[data-owner-preview]').forEach(el=>el.remove());map.invalidateSize({pan:false});map.setView([30.0466,-94.8852],14,{animate:false});});
  await page.waitForTimeout(600);
  const check=await page.evaluate(()=>{
   const types=GridlyHazardNormalization.winterOptions.map(o=>o.type);
   // Keep seven fixtures close enough to inspect together at mobile scale. Render with the unchanged marker constructor/CSS.
   const xs=[.18,.45,.72],ys=[.40,.54,.67];
   activeHazards=types.map((type,i)=>{const point=map.containerPointToLatLng([map.getSize().x*xs[i%3],map.getSize().y*ys[Math.floor(i/3)]]);return normalizeReports([{id:'mobile-winter-'+i,crossing_id:'hazard-mobile-winter-'+i,report_type:type,lat:point.lat,lng:point.lng,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),severity:'unknown',source:'user',confidence:'community'}])[0];});
   gridlyV734RefreshReuseState.renderUnifiedSignature=null;renderUnifiedIncidents('winter-mobile-owner-preview');
   return activeHazards.map(row=>({type:row.type,title:buildGridlyHazardPopupConsumerModel(row).title,asset:getGridlyProductionMarkerAsset(getGridlyProductionMarkerCategory(row)).assetName}));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.gridly-production-marker-img')].every(img=>img.complete&&img.naturalWidth>0));
  const render=await page.evaluate(()=>unifiedIncidentLayer.getLayers().filter(m=>m.options.incidentId?.startsWith('mobile-winter-')).map(m=>{const img=m.getElement().querySelector('img'),r=img.getBoundingClientRect();return {asset:img.getAttribute('src'),width:r.width,height:r.height,x:r.x,y:r.y,iconSize:m.options.icon.options.iconSize};}));
  assert.equal(render.length,7);assert.equal(new Set(render.map(r=>r.asset)).size,7);assert.ok(render.every(r=>Math.abs(r.width-64)<.2&&r.x>=0&&r.x+r.width<=width));
  await page.screenshot({path:out+'/winter-mobile-'+width+'.png'});
  if(width===390)await page.screenshot({path:out+'/winter-marker-mobile-scale.png'});
  // Actual picker options stay unchanged and select the corresponding marker type.
  await page.evaluate(()=>openPortraitV2Sheet('report'));await page.locator('[data-v2-winter-hazards] summary').click();
  for(const row of check){await page.locator('[data-v2-winter-hazards] [data-hazard-type="'+row.type+'"]').click();assert.equal(await page.evaluate(()=>reportingState.selectedHazardType),row.type);}
  await page.locator('#gridlyPortraitV2SheetClose').click();
  mobile.push({width,check,render});
 }
 fs.writeFileSync(out+'/preview-evidence.json',JSON.stringify({startingCommit:'78241632',phase:'LP244.46B',renderer:'renderUnifiedIncidents',synthetic:true,previewWritesRuntimeFiles:false,backendWrites:false,reportingEnabled:false,tileAccess:'Read-only OpenStreetMap / Esri GET requests; other remote requests blocked or locally stubbed.',names,dimensions,mobile,layerEntries:result.markers.length,note:'Synthetic input renders grouped and raw fallback layers at identical coordinates. Clustering/deduplication logic is unchanged; the fixture preserves these entries.',errors},null,2));
 console.log(JSON.stringify({screenshots:7,widths:mobile.map(m=>m.width),distinctAssets:new Set(mobile[0].render.map(m=>m.asset)).size,errors}));

}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
