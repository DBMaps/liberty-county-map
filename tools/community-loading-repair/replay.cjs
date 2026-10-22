const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
let chromium;
try { ({chromium}=require('@playwright/test')); }
catch { ({chromium}=require(process.env.GRIDLY_PLAYWRIGHT_MODULE || path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'))); }
const root=process.cwd(),out=path.resolve(process.env.REPAIR_OUTPUT_DIR||'.artifacts/community-loading-integration-v1'),fixtures=path.join(root,'.artifacts/community-loading-audit');
const baselineRef=process.env.REPAIR_BASELINE_REF||'faac47368da3137b50d53813b7f0299a2f4b1830';
const roadReplay=process.env.AUDIT_ROAD_REPLAY==='1';
const phase=process.env.REPAIR_PHASE||'after';const prefix=phase+(process.env.REPAIR_CHECKS==='1'?'-functional':'')+'-';
fs.mkdirSync(out,{recursive:true});
const baselineSources=new Map();
if(phase==='before')for(const file of ['js/app.js','js/gridlyWeatherLiveConnector.js','js/gridlyWeatherAuthoritySourceIntegration.js','js/gridlyAlertsWeatherAuthorityHandoff.js'])baselineSources.set('/'+file,require('node:child_process').execFileSync('git',['show',baselineRef+':'+file],{maxBuffer:16*1024*1024}));
const write=(name,data)=>fs.writeFileSync(path.join(out,prefix+name),JSON.stringify(data,null,2));
const projection=JSON.parse(fs.readFileSync('data/generated/gridly-statewide-consumer-community-projection-v1.json'));
const names=['Crosby','Dayton','Dallas','Coldspring'];
const counties=['harris-tx','liberty-tx','dallas-tx','san-jacinto-tx'];
const requested=process.env.AUDIT_MATRIX_FILE?JSON.parse(fs.readFileSync(process.env.AUDIT_MATRIX_FILE,'utf8')):names.map((name,i)=>({name,county:counties[i]}));
const cases=requested.map(row=>{const matches=projection.communities.filter(p=>p.displayName===row.name);if(matches.length!==1)throw new Error('Ambiguous/missing governed PLACE: '+row.name);return {...matches[0],...row};}).filter(c=>!process.env.AUDIT_CASES||process.env.AUDIT_CASES.split(',').includes(c.name));
const statewideMetrics=process.env.STATEWIDE_METRICS==='1';
const replayFixtures=process.env.STATEWIDE_FIXTURE_INDEX?JSON.parse(fs.readFileSync(process.env.STATEWIDE_FIXTURE_INDEX,'utf8')):null;
for(const row of replayFixtures?.rows||[]){const bytes=fs.readFileSync(path.resolve(path.dirname(process.env.STATEWIDE_FIXTURE_INDEX),'fixtures',row.file));if(crypto.createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw new Error('Replay fixture hash mismatch '+row.file);if(row.localPath&&crypto.createHash('sha256').update(fs.readFileSync(row.localPath)).digest('hex')!==row.sha256)throw new Error('Local served fixture hash mismatch '+row.localPath);}
const mime={'.js':'text/javascript','.mjs':'text/javascript','.html':'text/html','.json':'application/json','.geojson':'application/json','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
 const p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(root,'.'+(p==='/'?'/index.html':p));
 if(baselineSources.has(p))return res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'public,max-age=3600'}).end(baselineSources.get(p));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile())return res.writeHead(404).end();
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'public,max-age=3600'});
 if(p==='/')return res.end(fs.readFileSync(file,'utf8').replace('<script src="js/gridly-paid-bootstrap.js"></script>',''));
 fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://'+(process.env.AUDIT_HOST||'127.0.0.1')+':'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'msedge',args:process.env.AUDIT_HOST?['--host-resolver-rules=MAP '+process.env.AUDIT_HOST+' 127.0.0.1','--unsafely-treat-insecure-origin-as-secure='+origin,'--no-proxy-server']:[]});const runs=[];
 try{for(const c of cases){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const external=[],errors=[];
 await context.routeWebSocket('**/*',s=>s.close());
 await context.route('**/*',async route=>{
  const req=route.request(),url=req.url();
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))return route.abort();
  const replay=replayFixtures?.rows.find(row=>!row.verificationOnly&&new URL(row.url,origin).href===url);
  if(replay)return route.fulfill({path:path.resolve(path.dirname(process.env.STATEWIDE_FIXTURE_INDEX),'fixtures',replay.file),contentType:replay.contentType||'application/json'});
  if(url.startsWith(origin))return route.continue();
  if(roadReplay&&url.includes('/storage/v1/object/public/gridly-roadways/')){
   const name=url.endsWith('/manifest.json')?'harris-manifest.json':url.endsWith('/candidate-roadway-manifest.json')?'dallas-manifest.json':path.basename(new URL(url).pathname);
   if(fs.existsSync(path.join(fixtures,name)))return route.fulfill({path:path.join(fixtures,name),contentType:'application/json'});
  }
  for(const [needle,file,type] of [['leaflet@1.9.4/dist/leaflet.js','leaflet.js','text/javascript'],['leaflet@1.9.4/dist/leaflet.css','leaflet.css','text/css'],['@supabase/supabase-js@2','supabase.js','text/javascript']])if(url.includes(needle))return route.fulfill({path:path.join(fixtures,file),contentType:type});
  external.push({url:url.replace(/([?&]key=)[^&]+/,'$1[redacted]'),method:req.method()});
  if(url.startsWith('https://api.weather.gov/'))return route.fulfill({contentType:'application/geo+json',body:JSON.stringify(url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/TEST/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[{number:1,name:'Audit fixture',temperature:75,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'S',shortForecast:'Clear',detailedForecast:'Audit fixture'}]}}:{type:'FeatureCollection',features:[]})});
  if(url.includes('/rest/v1/'))return route.fulfill({contentType:'application/json',body:'[]'});
  return route.abort();
 });
 await context.addInitScript(c=>{
  if(!localStorage.getItem('auditSeeded')){
   localStorage.clear();localStorage.setItem('auditSeeded','1');
   localStorage.setItem('gridlyBetaFirstRunWalkthroughCompleteV894C','yes');
   localStorage.setItem('gridlyHomePersonalizationV1',JSON.stringify({zip:'',countyId:c.county,countyMemberships:c.countyMemberships,communityKey:c.placeGeoid,communityLabel:c.name,awarenessAreaKey:'place-'+c.placeGeoid,consumerLabel:c.name,identityType:'PLACE_GEOID',resolutionStatus:'manual_confirmed',resolutionMethod:'profile-fixture',sourceVersion:'LP217',confirmedAt:'2026-10-22T00:00:00Z',schemaVersion:'LP051.7.home-personalization.v1'}));
  }
  window.__auditLong=[];new PerformanceObserver(list=>window.__auditLong.push(...list.getEntries().map(x=>({start:x.startTime,ms:x.duration})))).observe({entryTypes:['longtask']});
  window.__auditFetch=[];const f=window.fetch;window.fetch=async function(...args){const start=performance.now();const row={url:String(args[0]).replace(/([?&]key=)[^&]+/,'$1[redacted]'),cache:args[1]?.cache,start};window.__auditFetch.push(row);try{const r=await f.apply(this,args);row.headersMs=performance.now()-start;row.status=r.status;return r;}catch(e){row.error=String(e);throw e;}};
 },c);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e.stack)));
 if(statewideMetrics)await page.addInitScript(()=>{window.__statewideOperationCount=3;});
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
 for(let i=0;i<Number(process.env.AUDIT_RUNS||3);i++){
  if(i===0)await cdp.send('Network.clearBrowserCache');
  const requests=[],cacheIds=new Set(),completed=[];
  const request=e=>requests.push({id:e.requestId,url:e.request.url.replace(origin,'').replace(/([?&]key=)[^&]+/,'$1[redacted]'),time:e.timestamp});
  const cache=e=>cacheIds.add(e.requestId);const finish=e=>completed.push({id:e.requestId,bytes:e.encodedDataLength,time:e.timestamp});
  cdp.on('Network.requestWillBeSent',request);cdp.on('Network.requestServedFromCache',cache);cdp.on('Network.loadingFinished',finish);
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  const boot=await page.evaluate(async()=>{window.__auditAdmissionAt=performance.now();document.documentElement.classList.remove('gridly-paid-locked','gridly-paid-pending');document.getElementById('gridlyPaidAccess').hidden=true;const {loadPaidRuntime}=await import('/js/gridly-paid-startup.mjs');await loadPaidRuntime({document,window,allowed:()=>true});return performance.now();});
  console.log('loader complete',c.name,boot,JSON.stringify(errors));
 try{await page.waitForFunction(()=>window.gridlyStartupDiagnostics?.state?.startupCompleted,null,{timeout:statewideMetrics?300000:120000});}
  catch(e){write('startup-failure.json',await page.evaluate(()=>({diag:window.gridlyStartupDiagnostics?.state,body:document.body.innerText.slice(0,1500),fetch:window.__auditFetch})));console.log('errors',JSON.stringify(errors));throw e;}
  let usability=null;
  if(process.env.REPAIR_CHECKS!=='1'){
   const clickStart=performance.now();await page.locator('#gridlyAlertsDockButton').click({timeout:statewideMetrics?300000:120000});
   usability=await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve({paintAt:performance.now(),sheetVisible:!document.getElementById('gridlyPortraitV2Sheet')?.hidden,county:gridlyGetActiveCountyId(),place:getGridlySelectedAwarenessArea()?.placeGeoid,markers:crossingMarkers.size}))));usability.hostClickAndPaintMs=performance.now()-clickStart;
  }
  await page.waitForTimeout(1800);
  const {profile}=await cdp.send('Profiler.stop');write(`${c.name}-${i}.cpuprofile`,profile);
  const snapshot=await page.evaluate(()=>{
   const call=(n)=>{try{return typeof window[n]==='function'?window[n]():null}catch(e){return {error:String(e)}}};
   return {bootAdmission:window.__auditAdmissionAt,now:performance.now(),diag:window.gridlyStartupDiagnostics?.state,context:gridlyGetCurrentAwarenessContext(),area:getGridlySelectedAwarenessArea(),crossings:crossings.length,markers:crossingMarkers.size,roads:roadwaySegmentFeatures.length,roadLoaded:roadwayDatasetLoaded,fetch:window.__auditFetch,longTasks:window.__auditLong,resources:performance.getEntriesByType('resource').map(r=>({url:r.name.replace(location.origin,''),start:r.startTime,ms:r.duration,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize})),audits:Object.fromEntries(['gridlyCrossingRenderAudit','gridlyRoadwayRuntimeAudit','gridlyActiveCountyRuntimeAudit','gridlyLp028DriveTexasAreaLifecycleAudit','gridlyDriveTexasConnectorRuntimeAudit','gridlyWeatherConnectorRuntimeAudit','gridlyAwarenessLookupNormalizationCacheAudit','gridlyRoadwayReportStartupDependencyAudit'].map(n=>[n,call(n)])),dom:{inventoryIds:crossings.map(x=>x.id),consumerIds:gridlySelectConsumerVisibleCrossings(getGridlySelectedAwarenessArea()).map(x=>x.id),renderIds:[...crossingMarkers.keys()],camera:{center:map.getCenter(),zoom:map.getZoom()},map:!!document.querySelector('.leaflet-map-pane'),rect:document.getElementById('map')?.getBoundingClientRect().toJSON(),lock:document.documentElement.className,location:document.getElementById('mobileAwarenessPanelKicker')?.textContent}};
  });
  // Measured consumer operation after startup, with production entry points unchanged.
  const operations=process.env.REPAIR_CHECKS==='1'?{}:await page.evaluate(()=>{
   const result={};for(const [name,fn,count] of [['selected',()=>getGridlySelectedAwarenessArea(),1000],['awareness',()=>buildGridlyCommunityAwarenessIntelligenceSummary(),Number(window.__statewideOperationCount||10)],['alerts',()=>getAlertsSurfaceSnapshot(),Number(window.__statewideOperationCount||10)]]){const start=performance.now();for(let k=0;k<count;k++)fn();result[name]={count,ms:performance.now()-start};}return result;
  });
  let statewide=null;
  if(statewideMetrics)write('probe-input.json',{case:c.name,county:c.county,place:c.placeGeoid,boot,usability,snapshot,operations});
  if(statewideMetrics)statewide=await require('./statewide-probes.cjs')({page,cdp,c});
  if(process.env.REPAIR_CHECKS==='1')await require('./verify-runtime.cjs')({page,c,phase,origin});
  const run={case:c.name,county:c.county,place:c.placeGeoid,mode:i?'reload-'+i:'cold',boot,usability,snapshot,operations,statewide,network:requests.map(r=>({...r,...completed.find(f=>f.id===r.id),cached:cacheIds.has(r.id)})),external:[...external],errors:[...errors]};
  runs.push(run);write('baseline.json',runs);
  console.log(JSON.stringify({case:c.name,mode:run.mode,usable:snapshot.diag.uiUsableAtMs,completed:snapshot.diag.startupCompletedAtMs,crossings:snapshot.crossings,markers:snapshot.markers,roads:snapshot.roads,county:snapshot.context.countyId,stages:snapshot.diag.stages.map(s=>({name:s.name,ms:s.durationMs})),operations,errors}));
  cdp.off('Network.requestWillBeSent',request);cdp.off('Network.requestServedFromCache',cache);cdp.off('Network.loadingFinished',finish);
 }
 await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r));}
 write('metadata.json',{head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineRef,servedSources:Object.fromEntries(['js/app.js','js/gridlyWeatherLiveConnector.js','js/gridlyWeatherAuthoritySourceIntegration.js','js/gridlyAlertsWeatherAuthorityHandoff.js'].map(f=>[f,crypto.createHash('sha256').update(baselineSources.get('/'+f)||fs.readFileSync(f)).digest('hex')])),date:new Date().toISOString(),browser:'Installed Edge',viewport:'390x844',host:process.env.AUDIT_HOST||'127.0.0.1',roadReplay,fixtures:'NWS healthy empty alerts and one forecast, reports empty; public roadway payloads replayed locally when roadReplay true; remaining remote network blocked; real admitted loader with local allowed test callback, no store verification timing',appSha256:crypto.createHash('sha256').update(baselineSources.get('/js/app.js')||fs.readFileSync('js/app.js')).digest('hex')});
 if(statewideMetrics){
  // Optional scheduling boundary: browser and server are already closed and
  // every measured observation has been written. Never run tests alongside a
  // live timing window. Removing the explicit local flag resumes the matrix.
  const gateRoot=path.resolve(process.env.STATEWIDE_OUTPUT_DIR||'.artifacts/community-loading-statewide'),flag=path.join(gateRoot,'pause-after-observation.flag'),paused=path.join(gateRoot,'paused.json');
  let pause=fs.existsSync(flag);
  if(pause){let condition={};try{condition=JSON.parse(fs.readFileSync(flag,'utf8'));}catch(_){}pause=(!condition.case||condition.case===runs.at(-1)?.case)&&(!condition.phase||condition.phase===phase)&&(condition.repetition===undefined||String(condition.repetition)===path.basename(path.dirname(out)));}
  if(pause){fs.writeFileSync(paused,JSON.stringify({pid:process.pid,date:new Date().toISOString(),phase,output:out,browserClosed:true,observationComplete:true}));console.log('STATEWIDE IDLE GATE: browser closed; local tests may run');while(fs.existsSync(flag))await new Promise(resolve=>setTimeout(resolve,1000));fs.unlinkSync(paused);}
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
