const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('js/app.js','utf8');
const source=name=>{const match=app.match(new RegExp(`function ${name}\\([^]*?^\\}`,'m'));assert.ok(match,name);return match[0];};
function coverageHarness(){let families={official_roadway:{available:true,state:'QUIET'},community_report:{available:true,state:null},weather:{available:true,state:'QUIET'}},forecast=true,crossing=true;
 const box={gridlyReadAlertsFamilyAuthority:()=>families,gridlyWeatherConnectorRuntimeAudit:()=>({forecastRequestSucceeded:forecast}),getGridlyAwarenessCoverageState:()=>({crossingAvailable:crossing,semanticCoverageState:crossing?'AVAILABLE_NO_GOVERNED_CROSSINGS':'LOADING'})};box.window=box;vm.createContext(box);vm.runInContext(source('gridlyGetLocalSourceCoverage')+'\n'+source('buildGridlyLocationContextMetricLines'),box);return {box,families,setForecast:v=>forecast=v,setCrossing:v=>crossing=v};}
test('healthy empty and governed empty crossings permit quiet; every unavailable family blocks it without hiding active count',()=>{
 const h=coverageHarness();assert.equal(h.box.gridlyGetLocalSourceCoverage().complete,true);assert.equal(h.box.buildGridlyLocationContextMetricLines().activeIssuesLine,'No active issues nearby');
 for(const key of Object.keys(h.families)){const old=h.families[key];for(const state of ['LOADING','STALE','UNAVAILABLE']){h.families[key]={available:false,state};assert.equal(h.box.gridlyGetLocalSourceCoverage().complete,false);assert.equal(h.box.buildGridlyLocationContextMetricLines().activeIssuesLine,'No active issues currently shown');assert.equal(h.box.buildGridlyLocationContextMetricLines({activeIssueCount:3}).activeIssuesLine,'3 roadway issues nearby');}h.families[key]=old;}
 h.setForecast(false);assert.equal(h.box.gridlyGetLocalSourceCoverage().complete,false);h.setForecast(true);h.setCrossing(false);assert.equal(h.box.gridlyGetLocalSourceCoverage().complete,false);
});
test('County filter retains accepted Home, Search, Around Me and Route Watch ownership over centroid and persisted Home',()=>{
 let accepted={countyId:'aransas-tx',type:'SEARCH'};const box={gridlyActiveGeographicPresentation:{semanticLevel:'PLACE',lat:27.9,lng:-97.15},gridlyGetPersistedAwarenessCountyId:()=> 'liberty-tx',gridlyGetCurrentAwarenessContext:()=>accepted,GRIDLY_COUNTY_REGISTRY:{'aransas-tx':{},'san-patricio-tx':{},'liberty-tx':{}},gridlyNormalizeCountyId:x=>x,gridlyResolveCountyIdForCoordinate:()=>({countyId:'san-patricio-tx'}),gridlyGetActiveCountyId:()=> 'aransas-tx'};vm.createContext(box);vm.runInContext(source('gridlyResolveCountyModeActiveContext'),box);
 for(const type of ['HOME','SEARCH','AROUND_ME','ROUTE_WATCH']){accepted={countyId:'aransas-tx',type};assert.equal(box.gridlyResolveCountyModeActiveContext().resolvedCountyId,'aransas-tx');}accepted={countyId:'liberty-tx',type:'HOME'};assert.equal(box.gridlyResolveCountyModeActiveContext().resolvedCountyId,'liberty-tx');
});
test('weather failed recheck cannot be resurrected by cached success; recovery restores current authority',async()=>{
 let failed=false;const point={awarenessKey:'place-4819432',stableIdentity:'4819432',lat:30.04725,lng:-94.88737};const box={Date,Promise,Error,TypeError,AbortController,setTimeout,clearTimeout,gridlyResolveGovernedWeatherPoint:()=>point,gridlyWeatherProvider:{normalizeRecords:p=>p.features},fetch:async url=>failed?{ok:false,status:503}:{ok:true,json:async()=>url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/TEST/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[]}}:{type:'FeatureCollection',features:[]}}};vm.createContext(box);vm.runInContext(fs.readFileSync('js/gridlyWeatherLiveConnector.js','utf8'),box);
 await box.gridlyWeatherConnector.fetchNow();assert.equal(box.gridlyWeatherConnectorRuntimeAudit().requestSucceeded,true);
 failed=true;await box.gridlyWeatherConnector.fetchNow();assert.equal(box.gridlyWeatherConnectorRuntimeAudit().requestSucceeded,false);
 const cached=await box.gridlyWeatherConnector.refreshAwarenessView();assert.equal(cached.connected,false);assert.equal(box.gridlyWeatherConnectorRuntimeAudit().requestSucceeded,false);assert.match(box.gridlyWeatherConnectorRuntimeAudit().lastError,/503/);
 failed=false;await box.gridlyWeatherConnector.fetchNow();assert.equal(box.gridlyWeatherConnectorRuntimeAudit().requestSucceeded,true);assert.equal(box.gridlyWeatherConnectorRuntimeAudit().lastError,null);
});

test('late obsolete weather success cannot replace a newer same-place failure after A-B-A transitions',async()=>{
 const a={awarenessKey:'place-a',stableIdentity:'a',lat:30.04,lng:-94.88},b={awarenessKey:'place-b',stableIdentity:'b',lat:31.04,lng:-95.88};
 let point=a,pointCalls=0,releaseOld;
 const healthy=url=>({ok:true,json:async()=>url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/TEST/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[]}}:{type:'FeatureCollection',features:[]}});
 const box={Date,Promise,Error,TypeError,AbortController,setTimeout,clearTimeout,gridlyResolveGovernedWeatherPoint:()=>point,gridlyWeatherProvider:{normalizeRecords:p=>p.features},fetch:async url=>{
  if(url.includes('/points/')){pointCalls++;if(pointCalls===1)return new Promise(resolve=>{releaseOld=()=>resolve(healthy(url));});if(pointCalls===3||pointCalls===4)return {ok:false,status:503};}
  return healthy(url);
 }};
 vm.createContext(box);vm.runInContext(fs.readFileSync('js/gridlyWeatherLiveConnector.js','utf8'),box);
 const old=box.gridlyWeatherConnector.fetchNow();point=b;await box.gridlyWeatherConnector.fetchNow();point=a;await box.gridlyWeatherConnector.fetchNow();
 assert.equal(box.gridlyWeatherConnectorRuntimeAudit().requestSucceeded,false);
 releaseOld();await old;await box.gridlyWeatherConnector.refreshAwarenessView();
 assert.equal(box.gridlyWeatherConnectorRuntimeAudit().requestSucceeded,false);
 assert.match(box.gridlyWeatherConnectorRuntimeAudit().lastError,/503/);
});
