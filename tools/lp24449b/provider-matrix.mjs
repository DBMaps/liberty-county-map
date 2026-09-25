import {createRequire} from 'node:module';
import {root,out,artifacts,write} from './inventory.mjs';
const require=createRequire(import.meta.url),states=[];
let fixture={road:'empty',weather:'empty',alerts:'empty'},releaseLoading;
const session=await require('./session.cjs')({fixtureReports:true,providerFixture:async({route,url,evidence})=>{
 if(!url.includes('/lp24449b-road')&&!url.startsWith('https://api.weather.gov/'))return false;
 evidence.providerRequests.push({url,fixture:{...fixture},method:route.request().method()});
 if(url.includes('/lp24449b-road')){
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
  await p.addScriptTag({path:`${root}/tools/lp24449b/runtime-probe.js`});await p.evaluate(()=>lp24449b.settle());
 await p.evaluate(async()=>{const g=getGridlyManualAwarenessAreaOptions().find(g=>g.countyId==='liberty-tx'),o=g.communities.find(o=>o.label==='Dayton');if(!gridlySaveCanonicalMultiCountyPlaceHome(o.canonicalResolution,'lp24449b-source-matrix',g.countyId))throw Error('Home fixture failed');await lp24449b.settle();});
 await p.evaluate(origin=>{GRIDLY_CONFIG.driveTexas={...GRIDLY_CONFIG.driveTexas,apiKey:'LOCAL-CERTIFICATION-NOT-A-CREDENTIAL',endpointTemplate:origin+'/lp24449b-road'};gridlyDriveTexasConnector.stopPolling();gridlyWeatherConnector.stopPolling();},session.origin);
 async function refresh(){await p.evaluate(async()=>{await Promise.all([gridlyDriveTexasConnector.fetchNow(),gridlyWeatherConnector.fetchNow()]);await gridlyRunAlertsBackgroundRefreshAfterOpen('lp24449b-controlled-report-read');gridlyRefreshUnifiedAwarenessContext('lp24449b-source-matrix');await lp24449b.settle();});}
 async function capture(name){
  await p.locator('#gridlyAlertsDockButton').evaluate(n=>n.click());await p.waitForTimeout(150);
  const value=await p.evaluate(()=>({snapshot:lp24449b.snapshot(),coverage:gridlyGetLocalSourceCoverage(),weather:gridlyWeatherConnectorRuntimeAudit(),road:gridlyDriveTexasConnectorRuntimeAudit(),pulse:{headline:document.getElementById('gridlyCommunityPulseHeadline')?.innerText,subline:document.getElementById('gridlyCommunityPulseSubline')?.innerText},top:document.querySelector('.gridly-v2-status-pill')?.innerText,story:buildGridlyAwarenessStory(),confidence:gridlyTravelBriefConfidenceLine(buildGridlyAwarenessStory())}));
  states.push({name,fixture:{...fixture},...value});write(`${out}/provider-health-matrix.json`,{states,network:s.evidence});console.log(JSON.stringify({name,complete:value.coverage.complete,authority:Object.fromEntries(Object.entries(value.coverage.authority).map(([k,v])=>[k,v.state])),location:value.snapshot.location.issues,pulse:value.pulse,confidence:value.confidence}));
  await p.screenshot({path:`${artifacts}/provider-${name}.png`});await p.locator('#gridlyPortraitV2SheetClose').evaluate(n=>n.click());
  if(await p.locator('#gridlyBriefFoundationHandle').getAttribute('aria-expanded')!=='true')await p.locator('#gridlyBriefFoundationHandle').evaluate(n=>n.click());await p.waitForTimeout(250);
  states.at(-1).kbygVisible=await p.locator('#gridlyBriefInteractionPanel').isVisible();
  states.at(-1).kbygExpanded=await p.locator('#gridlyBriefFoundationHandle').getAttribute('aria-expanded')==='true';
  states.at(-1).visibleKbyg=await p.locator('#gridlyBriefInteractionPanel').innerText();
  await p.screenshot({path:`${artifacts}/provider-${name}-kbyg.png`});await p.locator('#gridlyBriefFoundationHandle').evaluate(n=>n.click());
  write(`${out}/provider-health-matrix.json`,{states,network:s.evidence});
 }
 await refresh();await capture('healthy-empty');
 fixture.road='unavailable';await refresh();await capture('road-unavailable');
 fixture={road:'empty',weather:'unavailable',alerts:'empty'};await refresh();await capture('weather-unavailable');
 fixture={road:'empty',weather:'empty',alerts:'unavailable'};await refresh();await capture('alerts-unavailable');
 fixture={road:'unavailable',weather:'unavailable',alerts:'unavailable'};await refresh();await capture('multiple-unavailable');
 const report=await p.evaluate(()=>gridlyLocalTestReports.add('flooded-roadway',{lat:gridlyGetCurrentAwarenessContext().lat,lng:gridlyGetCurrentAwarenessContext().lng,ageMinutes:0}));await p.evaluate(()=>lp24449b.settle());await capture('community-active-unavailable');
 await p.evaluate(id=>gridlyLocalTestReports.clearOne(id),report.id);
 fixture={road:'active',weather:'unavailable',alerts:'empty'};await refresh();await capture('road-active-weather-unavailable');
 fixture.road='loading';const pending=p.evaluate(()=>gridlyDriveTexasConnector.fetchNow());while(!releaseLoading)await new Promise(r=>setTimeout(r,25));await capture('loading-retained-active');fixture.road='active';releaseLoading();await pending;
 fixture={road:'unavailable',weather:'unavailable',alerts:'empty'};await refresh();fixture={road:'empty',weather:'empty',alerts:'empty'};await refresh();await capture('recovery-empty');
 fixture.road='unavailable';await refresh();fixture.road='active';await refresh();await capture('recovery-active');
 const activeNames=new Set(['community-active-unavailable','road-active-weather-unavailable','loading-retained-active','recovery-active']);
 const completeNames=new Set(['healthy-empty','recovery-empty','recovery-active']);
 for(const state of states){const active=activeNames.has(state.name),complete=completeNames.has(state.name),text=[state.top,state.pulse.headline,state.pulse.subline,state.snapshot.location.issues,state.visibleKbyg].join(' ');state.checks={expectedCompleteness:state.coverage.complete===complete,activeCount:state.snapshot.pulse.count===(active?1:0),locationCount:active?/^1 roadway issue/.test(state.snapshot.location.issues):/^No active issues/.test(state.snapshot.location.issues),noFalseQuiet:complete||active||!/(?:Community is quiet|Quiet conditions|No active issues nearby)/i.test(text),uncertaintyVisible:complete||/sources.*(?:unavailable|checked)|temporarily unavailable/i.test(text),loadingRetainsActive:state.name!=='loading-retained-active'||state.snapshot.rows.locationContext.length===1};state.pass=Object.values(state.checks).every(Boolean);}
 for(const state of states){
  const count=activeNames.has(state.name)?1:0;
  state.checks.consumerCountParity=['locationContext','communityPulse','alerts'].every(key=>state.snapshot.rows[key].length===count)&&state.snapshot.rows.kbygCommunity.length+state.snapshot.rows.kbygOfficialRoadways.length===count;
  const visible=[state.top,state.pulse.headline,state.pulse.subline,state.snapshot.location.issues,state.visibleKbyg].join(' ');
  state.checks.noFalseQuiet=state.coverage.complete||!/(?:Community is quiet|Quiet conditions|No active issues nearby)/i.test(visible);
  state.checks.expandedKbygObserved=state.kbygVisible===true&&state.kbygExpanded===true&&state.visibleKbyg.trim().length>0;
  state.pass=Object.values(state.checks).every(Boolean);
 }
 write(`${out}/provider-health-matrix.json`,{states,network:s.evidence,passed:states.length===10&&states.every(s=>s.pass)&&s.evidence.errors.length===0});
 if(states.some(s=>!s.pass))process.exitCode=1;
}finally{await session.close();}
