import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
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

const page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.stack));
const evidence={widths:[],models:[],errors,remoteWrites:false};
try {
 await page.goto(origin);await page.waitForFunction(()=>typeof window.openPortraitV2Sheet==='function');
 evidence.models=await page.evaluate(()=>GridlyHazardNormalization.winterOptions.map(({type})=>{const row=normalizeReports([{id:'fixture-'+type,crossing_id:'hazard-fixture-'+type,report_type:type,lat:30.3413,lng:-95.0858,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),source:'user'}])[0];return {type,normalized:row.normalizedEvent,title:gridlyBuildCanonicalLiveIncidentPresentation(row).title,popup:buildGridlyHazardPopupConsumerModel(row).title,kbyg:gridlyTravelBriefCommunityLine(row),marker:getGridlyProductionMarkerCategory(row),lifecycle:getIncidentLifecycleState(row),html:buildUnifiedIncidentPopup(row)};}));
 for(const model of evidence.models){assert.equal(model.normalized.markerFamily,'winter');assert.equal(model.lifecycle,'active');assert.match(model.title,/reported/);assert.match(model.popup,/reported/);assert.match(model.kbyg,/reported/);assert.equal(model.marker,model.type);}
 for(const width of [320,360,390,440]) {
  await page.setViewportSize({width,height:844});await page.evaluate(()=>window.openPortraitV2Sheet('report'));
  await page.locator('[data-v2-winter-hazards] summary').click();
  const picker=page.locator('#gridlyPortraitV2SheetBody');
  for (const model of evidence.models) {await picker.locator('[data-v2-winter-hazards] [data-hazard-type="'+model.type+'"]').click();assert.equal(await page.evaluate(()=>reportingState.selectedHazardType),model.type);}
  await picker.locator('[data-v2-winter-hazards] summary').scrollIntoViewIfNeeded();
  const metric=await picker.evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,winterButtons:el.querySelectorAll('[data-v2-winter-hazards] button').length,labels:[...el.querySelectorAll('[data-v2-winter-hazards] button')].map(b=>({text:b.textContent.trim(),width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height,clipped:b.scrollWidth>b.clientWidth+1}))}));
  assert.equal(metric.winterButtons,7);assert.ok(metric.scrollWidth<=metric.clientWidth+1,JSON.stringify(metric));assert.ok(metric.labels.every(b=>!b.clipped&&b.height>=40));
  await page.screenshot({path:'reports/lp24446-picker-'+width+'.png'});
  await page.locator('#gridlyPortraitV2SheetClose').click();
  await page.evaluate(html=>L.popup({maxWidth:260,minWidth:200,autoPan:false}).setLatLng(map.containerPointToLatLng([map.getSize().x/2,map.getSize().y*0.67])).setContent(html).openOn(map),evidence.models.find(m=>m.type==='bridge_overpass_icing').html);
  const card=await page.locator('.leaflet-popup-content').evaluate(el=>({scrollWidth:el.scrollWidth,clientWidth:el.clientWidth,text:el.innerText}));assert.ok(card.scrollWidth<=card.clientWidth+1);assert.match(card.text,/Bridge or overpass icing reported/);
  await page.screenshot({path:'reports/lp24446-card-'+width+'.png'});
  evidence.widths.push({width,picker:metric,card});
  await page.evaluate(()=>map.closePopup());
 }
 evidence.marker=await page.evaluate(async()=>{const asset=getGridlyProductionMarkerAsset('ice');const img=new Image();img.src=asset.assetPath;await img.decode();return {...asset,width:img.naturalWidth,height:img.naturalHeight,aliases:GridlyHazardNormalization.winterOptions.map(o=>getGridlyProductionMarkerAsset(o.type).assetName)};});assert.equal(evidence.marker.assetName,'winter-road.svg');assert.equal(evidence.marker.width,256);assert.equal(new Set(evidence.marker.aliases).size,1);
 const performance=await page.evaluate(()=>{const start=performance.now();for(let i=0;i<10000;i++)GridlyHazardNormalization.community({type:'ice',lat:30,lng:-95});return {normalizations:10000,durationMs:performance.now()-start};});evidence.performance=performance;
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({widths:evidence.widths.map(w=>w.width),models:evidence.models.length,performance,errors}));
} finally {fs.writeFileSync('reports/lp24446-portrait-browser.json',JSON.stringify(evidence,null,2));await browser.close();await new Promise(resolve=>server.close(resolve));}
