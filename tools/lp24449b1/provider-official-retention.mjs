import {createRequire} from 'node:module';
import {root,out,artifacts,write} from './inventory.mjs';
const require=createRequire(import.meta.url),states=[];
let fixture={road:'empty',weather:'empty',alerts:'empty'},releaseLoading;
const session=await require('./session.cjs')({fixtureReports:true,providerFixture:async({route,url,evidence})=>{
 if(!url.includes('/lp24449b1-road')&&!url.startsWith('https://api.weather.gov/'))return false;
 evidence.providerRequests.push({url,fixture:{...fixture},method:route.request().method()});
 if(url.includes('/lp24449b1-road')){
  if(fixture.road==='loading')await new Promise(r=>{releaseLoading=r;});
  if(fixture.road==='unavailable'){await route.fulfill({status:503,body:'Controlled unavailable'});return true;}
  const features=fixture.road==='active'?[{type:'Feature',geometry:{type:'Point',coordinates:[-94.88737,30.04725]},properties:{id:'LP24449B-ROAD',OBJECTID:900001,roadway:'US 90',description:'Road closed due to flooding',eventType:'Closure',county:'Liberty',startTime:new Date().toISOString(),endTime:new Date(Date.now()+3600000).toISOString()}}]:[];
  await route.fulfill({contentType:'application/json',body:JSON.stringify({type:'FeatureCollection',features})});return true;
 }
 if(fixture.weather==='unavailable'||(fixture.alerts==='unavailable'&&url.includes('/alerts/'))){await route.fulfill({status:503,body:'Controlled unavailable'});return true;}
 const body=url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/TEST/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[{number:1,name:'Controlled test',isDaytime:true,temperature:75,temperatureUnit:'F',windSpeed:'5 mph',windDirection:'S',shortForecast:'Partly Cloudy',detailedForecast:'Controlled certification fixture.'}]}}:{type:'FeatureCollection',features:[]};
 await route.fulfill({contentType:'application/geo+json',body:JSON.stringify(body)});return true;
}});
try{
 const s=await session.newPage(),p=s.page;
  await p.addScriptTag({path:`${root}/tools/lp24449b1/runtime-probe.js`});await p.evaluate(()=>lp24449b1.settle());
 await p.evaluate(async()=>{const g=getGridlyManualAwarenessAreaOptions().find(g=>g.countyId==='liberty-tx'),o=g.communities.find(o=>o.label==='Dayton');if(!gridlySaveCanonicalMultiCountyPlaceHome(o.canonicalResolution,'lp24449b1-source-matrix',g.countyId))throw Error('Home fixture failed');await lp24449b1.settle();});
 await p.evaluate(origin=>{GRIDLY_CONFIG.driveTexas={...GRIDLY_CONFIG.driveTexas,apiKey:'LOCAL-CERTIFICATION-NOT-A-CREDENTIAL',endpointTemplate:origin+'/lp24449b1-road'};gridlyDriveTexasConnector.stopPolling();gridlyWeatherConnector.stopPolling();},session.origin);
 async function refresh(){await p.evaluate(async()=>{await Promise.all([gridlyDriveTexasConnector.fetchNow(),gridlyWeatherConnector.fetchNow()]);await gridlyRunAlertsBackgroundRefreshAfterOpen('lp24449b1-controlled-report-read');gridlyRefreshUnifiedAwarenessContext('lp24449b1-source-matrix');await lp24449b1.settle();});}
 async function capture(name){
  await p.locator('#gridlyAlertsDockButton').evaluate(n=>n.click());await p.waitForTimeout(150);
  const value=await p.evaluate(()=>({snapshot:lp24449b1.snapshot(),coverage:gridlyGetLocalSourceCoverage(),weather:gridlyWeatherConnectorRuntimeAudit(),road:gridlyDriveTexasConnectorRuntimeAudit(),pulse:{headline:document.getElementById('gridlyCommunityPulseHeadline')?.innerText,subline:document.getElementById('gridlyCommunityPulseSubline')?.innerText},top:document.querySelector('.gridly-v2-status-pill')?.innerText,story:buildGridlyAwarenessStory(),confidence:gridlyTravelBriefConfidenceLine(buildGridlyAwarenessStory())}));
  states.push({name,fixture:{...fixture},...value});write(`${out}/provider-official-retention.json`,{states,network:s.evidence});console.log(JSON.stringify({name,complete:value.coverage.complete,authority:Object.fromEntries(Object.entries(value.coverage.authority).map(([k,v])=>[k,v.state])),location:value.snapshot.location.issues,pulse:value.pulse,confidence:value.confidence}));
  await p.screenshot({path:`${artifacts}/provider-${name}.png`});await p.locator('#gridlyPortraitV2SheetClose').evaluate(n=>n.click());
  if(await p.locator('#gridlyBriefFoundationHandle').getAttribute('aria-expanded')!=='true')await p.locator('#gridlyBriefFoundationHandle').evaluate(n=>n.click());await p.waitForTimeout(250);
  states.at(-1).kbygVisible=await p.locator('#gridlyBriefInteractionPanel').isVisible();
  states.at(-1).kbygExpanded=await p.locator('#gridlyBriefFoundationHandle').getAttribute('aria-expanded')==='true';
  states.at(-1).visibleKbyg=await p.locator('#gridlyBriefInteractionPanel').innerText();
  await p.screenshot({path:`${artifacts}/provider-${name}-kbyg.png`});await p.locator('#gridlyBriefFoundationHandle').evaluate(n=>n.click());
  write(`${out}/provider-official-retention.json`,{states,network:s.evidence});
 }
 fixture={road:'active',weather:'empty',alerts:'empty'};await refresh();
 const officialRetention=await p.evaluate(async()=>{
  const capture=()=>{const projection=gridlyGetGovernedConsumerProjection(),fresh=buildGridlyCommunityPulseModel();return {published:gridlyCommunityPulseAuditState.activeAwareness.activeAwarenessCount,fresh:fresh.activeAwareness.activeAwarenessCount,official:projection.surfaces.kbygOfficialRoadways.map(r=>r.evidenceId),community:projection.surfaces.kbygCommunity.map(r=>r.evidenceId),alerts:projection.surfaces.alerts.map(r=>r.evidenceId)};};
  const before=capture(),fixture=gridlyLocalTestReports.add('debris-in-road',{lat:30.05725,lng:-94.87737,ageMinutes:0});await lp24449b1.settle();gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',reason:'interval_live_refresh'});await lp24449b1.settle();const active=capture();gridlyLocalTestReports.clearOne(fixture.id);await lp24449b1.settle();const cleared=capture();gridlyOfficialProviderConsumerRefresh({providerId:'drivetexas',reason:'interval_live_refresh'});await lp24449b1.settle();const refreshed=capture();
  return {before,active,cleared,refreshed,fixture,pass:before.official.length===1&&before.official.every(id=>typeof id==="string"&&id.length>0)&&before.published===1&&active.published===2&&active.fresh===2&&[cleared,refreshed].every(r=>r.published===1&&r.fresh===1&&r.community.length===0&&r.official.length===1&&JSON.stringify(r.official)===JSON.stringify(before.official))};
 });
 write(`${out}/provider-official-retention.json`,{states,officialRetention,network:s.evidence,passed:officialRetention.pass&&s.evidence.errors.length===0});
 if(!officialRetention.pass)process.exitCode=1;
 if(states.some(s=>!s.pass))process.exitCode=1;
}finally{await session.close();}
