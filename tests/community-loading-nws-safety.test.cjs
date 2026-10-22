const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const initialTime = Date.parse('2026-10-22T16:00:00Z');
const A = { identityClass:'CANONICAL_PLACE', stableIdentity:'4817756', awarenessKey:'place-4817756', placeGeoid:'4817756', countyId:'harris-tx', lat:29.9119, lng:-95.0622 };
const B = { identityClass:'CANONICAL_PLACE', stableIdentity:'4819432', awarenessKey:'place-4819432', placeGeoid:'4819432', countyId:'liberty-tx', lat:30.0466, lng:-94.8852 };
const warning = (id='nws-warning', overrides={}) => ({ type:'Feature', id,
  geometry:{type:'Polygon',coordinates:[[[-107,25],[-93,25],[-93,37],[-107,37],[-107,25]]]},
  properties:{id,event:'Flash Flood Warning',headline:'Countywide warning',status:'Actual',messageType:'Alert',severity:'Severe',certainty:'Observed',urgency:'Immediate',areaDesc:'Harris County',affectedZones:['https://api.weather.gov/zones/county/TXC201'],effective:new Date(initialTime-60000).toISOString(),expires:new Date(initialTime+3600000).toISOString(),...overrides} });
const payload = (...features) => ({type:'FeatureCollection',features});
const response = data => ({ok:true,json:async()=>data});
const settle = () => new Promise(resolve=>setImmediate(resolve));
function deferred() { let resolve; const promise=new Promise(r=>{resolve=r;}); return {promise,resolve}; }
function harness() {
  let now=initialTime, point=A;
  class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
  const calls=[], notices=[];
  const control={points:()=>response({properties:{forecast:'https://api.weather.gov/gridpoints/HGX/1,1/forecast'}}),forecast:()=>response({properties:{periods:[]}}),alerts:()=>response(payload(warning()))};
  const context={console,Date:Clock,Promise,TypeError,Error,AbortController,setTimeout,clearTimeout,
    gridlyResolveGovernedWeatherPoint:()=>point,
    gridlyOfficialProviderConsumerRefresh:value=>notices.push(value),
    fetch:async(url,options)=>{const kind=url.includes('/points/')?'points':url.includes('/forecast')?'forecast':'alerts';calls.push({kind,url});return control[kind](url,options);} };
  context.window=context;context.globalThis=context;
  vm.createContext(context);
  for(const file of ['gridlyWeatherProvider.js','gridlyWeatherAuthorityFoundation.js','gridlyWeatherLiveConnector.js','gridlyWeatherAuthoritySourceIntegration.js','gridlyAlertsWeatherAuthorityHandoff.js','gridlyLP240WeatherAuthorityAudit.js'])vm.runInContext(fs.readFileSync('js/'+file,'utf8'),context,{filename:file});
  const app=fs.readFileSync('js/app.js','utf8');
  const helper=app.match(/function gridlyLP236RetainCommunityRowsDuringReadUncertainty\([^]*?^  }/m);
  assert.ok(helper);vm.runInContext(helper[0],context);
  const api=context.gridlyWeatherConnector;
  const audit=()=>context.gridlyWeatherConnectorRuntimeAudit();
  const records=()=>api.getNormalizedRecords();
  const selection=()=>context.gridlySelectConsumerVisibleWeatherSituations({selectedAwarenessArea:point});
  const handoff=(candidate=selection().consumerVisibleSituations[0])=>context.GridlyAlertsWeatherAuthorityHandoff.evaluate({candidate:{weatherFamilyIdentity:selection().weatherFamilyIdentity,...candidate},weatherSelection:selection(),connectorRuntime:audit()});
  return {context,api,audit,records,selection,handoff,calls,notices,control,setPoint:value=>{point=value;},advance:ms=>{now+=ms;}};
}

test('forecast 503 retries independently while the current warning reaches consumer and Alerts authority',async()=>{
  const h=harness();h.control.forecast=()=>({ok:false,status:503});await h.api.fetchNow();
  assert.equal(h.calls.filter(c=>c.kind==='forecast').length,2);
  assert.equal(h.calls.filter(c=>c.kind==='alerts').length,1);
  assert.equal(h.audit().forecastRequestSucceeded,false);assert.match(h.audit().forecastError,/503/);
  assert.equal(h.audit().requestSucceeded,true);assert.equal(h.audit().freshEnough,true);
  assert.equal(h.audit().finalWeatherHealth,'DEGRADED');assert.equal(h.handoff().accepted,true);
  assert.deepEqual([...h.selection().consumerVisibleSituations].map(r=>r.id),['nws-warning']);
});
test('a pending forecast cannot delay publication of applicable alerts',async()=>{
  const h=harness(),held=deferred();h.control.forecast=()=>held.promise;
  const pending=h.api.fetchNow();await settle();
  assert.equal(h.records()[0].id,'nws-warning');assert.equal(h.handoff().accepted,true);
  assert.equal(h.audit().forecastRequestInFlight,true);
  assert.equal(h.audit().finalWeatherUnavailableReason,'FORECAST_ENRICHMENT_PENDING');
  held.resolve(response({properties:{periods:[]}}));await pending;
  assert.equal(h.audit().forecastRequestSucceeded,true);
});
test('points discovery failure does not prevent the governed point alert request',async()=>{
  const h=harness();h.control.points=()=>({ok:false,status:503});await h.api.fetchNow();
  assert.equal(h.calls.filter(c=>c.kind==='alerts').length,1);assert.equal(h.audit().pointsRequestSucceeded,false);
  assert.equal(h.handoff().accepted,true);assert.equal(h.audit().forecastRequestAttempted,false);
});
test('alert transport failure retains original warning identity, location, lineage and expiry with degraded health',async()=>{
  const h=harness();await h.api.fetchNow();const original=JSON.stringify(h.records()[0]),verified=h.audit().lastSuccessAt;
  h.advance(130000);h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  assert.equal(JSON.stringify(h.records()[0]),original);assert.equal(h.audit().lastSuccessAt,verified);
  assert.equal(h.audit().requestSucceeded,false);assert.equal(h.audit().freshEnough,false);
  assert.equal(h.audit().retainedWarningEvidence,true);assert.equal(h.audit().finalWeatherHealth,'DEGRADED');
  assert.equal(h.selection().freshnessStatus,'retained_unexpired_warning');assert.equal(h.handoff().accepted,true);
  const envelope=h.context.gridlyGetWeatherRuntimeAuthorityEnvelope();
  assert.equal(envelope.healthy,false);assert.equal(envelope.freshEnoughForAuthority,false);assert.equal(envelope.freshness,'STALE');
});
test('the authoritative expiry is enforced at read, cached refresh, consumer selection and handoff without another fetch',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  const candidate=h.selection().consumerVisibleSituations[0];h.advance(3600000);
  assert.equal(h.records().length,0);assert.equal(h.audit().retainedWarningEvidence,false);
  assert.equal(h.selection().consumerVisibleSituationCount,0);assert.equal(h.handoff(candidate).accepted,false);
  await h.api.refreshAwarenessView();assert.equal(h.records().length,0);
});
test('successful cancellation clears a retained warning and cannot be undone by a later outage',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  h.control.alerts=()=>response(payload(warning('cancel',{messageType:'Cancel',references:[{identifier:'nws-warning'}]})));
  await h.api.fetchNow();assert.equal(h.records().length,0);assert.equal(h.audit().freshEnough,true);
  h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();assert.equal(h.records().length,0);
});
test('cancellation references suppress an older warning even when both are in a successful payload',async()=>{
  const h=harness();h.control.alerts=()=>response(payload(warning(),warning('https://api.weather.gov/alerts/replaced'),warning('cancel',{messageType:'Cancel',references:[{identifier:'nws-warning'},{'@id':'https://api.weather.gov/alerts/replaced',identifier:'prior-cap-identifier'}]}),warning('other'),warning('test-cancel',{status:'Test',messageType:'Cancel',references:[{identifier:'other'}]})));
  await h.api.fetchNow();assert.deepEqual([...h.records()].map(r=>r.id),['other']);
});
test('successful empty recovery clears retained evidence and establishes only a fresh confirmed empty alert result',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  h.control.alerts=()=>response(payload());await h.api.fetchNow();
  assert.equal(h.records().length,0);assert.equal(h.audit().retainedWarningEvidence,false);
  assert.equal(h.audit().freshEnough,true);assert.equal(h.audit().lastError,null);assert.equal(h.audit().finalWeatherHealth,'HEALTHY');
});
test('recovery replaces retained records with the complete new authoritative alert set',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  h.control.alerts=()=>response(payload(warning('replacement'),warning('advisory',{event:'Flood Advisory'})));await h.api.fetchNow();
  assert.deepEqual([...h.records()].map(r=>r.id),['replacement','advisory']);assert.equal(h.audit().retainedWarningEvidence,false);
});
test('missing expiry, future, test, cancelled and non-warning records cannot become retained warning authority',async()=>{
  const h=harness();h.control.alerts=()=>response(payload(warning('valid'),warning('no-expiry',{expires:null}),warning('future',{effective:new Date(initialTime+600000).toISOString()}),warning('test',{status:'Test'}),warning('cancel',{messageType:'Cancel'}),warning('advisory',{event:'Flood Advisory'})));
  await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  assert.deepEqual([...h.records()].map(r=>r.id),['valid']);
});
test('malformed alert responses remain unavailable and retain a valid earlier warning',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>response({features:[]});await h.api.fetchNow();
  assert.equal(h.audit().responseValid,false);assert.equal(h.records()[0].id,'nws-warning');assert.equal(h.handoff().accepted,true);
});
test('fresh-install outage never establishes healthy empty authority',async()=>{
  const h=harness();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  assert.equal(h.records().length,0);assert.equal(h.audit().retainedWarningEvidence,false);assert.equal(h.audit().finalWeatherHealth,'UNAVAILABLE');
  assert.equal(h.context.gridlyGetWeatherRuntimeAuthorityEnvelope().healthy,false);
});
test('A-B-A late alert and forecast responses cannot overwrite the new A authority or source health',async()=>{
  const h=harness(),old=deferred(),forecast=deferred();let count=0;
  h.control.alerts=()=>++count===1?old.promise:response(payload(warning('current-'+count)));
  h.control.forecast=()=>forecast.promise;const first=h.api.fetchNow();await settle();
  h.setPoint(B);h.control.forecast=()=>response({properties:{periods:[]}});await h.api.refreshAwarenessView();
  h.setPoint(A);await h.api.fetchNow();const current=h.audit().lastSuccessAt;
  old.resolve(response(payload(warning('late-A'))));forecast.resolve({ok:false,status:400});await first;
  assert.equal(h.records()[0].id,'current-3');assert.equal(h.audit().lastSuccessAt,current);assert.equal(h.audit().forecastRequestSucceeded,true);
  assert.equal(h.audit().lastError,null);assert.ok(h.audit().staleResponseSuppressedCount>0);
});
test('A-invalid-A does not share an obsolete same-point promise',async()=>{
  const h=harness(),old=deferred();h.control.alerts=()=>old.promise;const first=h.api.fetchNow();await settle();
  h.setPoint(null);await h.api.fetchNow();h.setPoint(A);h.control.alerts=()=>response(payload(warning('new')));
  await h.api.fetchNow();old.resolve(response(payload(warning('old'))));await first;assert.equal(h.records()[0].id,'new');
});
test('context changes immediately hide old records, and a failed different point cannot inherit them',async()=>{
  const h=harness();await h.api.fetchNow();h.setPoint(B);assert.equal(h.records().length,0);
  h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();assert.equal(h.records().length,0);assert.equal(h.audit().retainedWarningEvidence,false);
});
test('same-generation in-flight requests share work, failed cached checks are bounded, and forced retries recover',async()=>{
  const h=harness(),held=deferred();h.control.alerts=()=>held.promise;
  const a=h.api.fetchNow();assert.equal(h.api.fetchNow(),a);held.resolve({ok:false,status:400});await a;
  const calls=h.calls.length;const cached=await h.api.refreshAwarenessView();assert.equal(cached.cached,true);assert.equal(h.calls.length,calls);
  h.control.alerts=()=>response(payload(warning('retry')));await h.api.fetchNow();assert.equal(h.records()[0].id,'retry');
});
test('retention does not authorize a different candidate, identity, expiry or source mode',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  const selection=h.selection(),runtime=h.audit(),candidate={...selection.consumerVisibleSituations[0],weatherFamilyIdentity:selection.weatherFamilyIdentity};
  for(const patch of [{sourceProviderRecordId:'other',providerRecordId:'other'},{weatherFamilyIdentity:'other'}])assert.equal(h.handoff({...candidate,...patch}).accepted,false);
  for(const patch of [{applicabilityMode:'NWS_COUNTY_QUERY'},{responseIdentity:'other'},{retainedWarningExpiries:{'nws-warning':new Date(initialTime-1).toISOString()}}])assert.equal(h.context.GridlyAlertsWeatherAuthorityHandoff.evaluate({candidate,weatherSelection:selection,connectorRuntime:{...runtime,...patch}}).accepted,false);
});
test('Alerts uncertainty presentation retains only handoff-qualified warnings while preserving stale source state',async()=>{
  const h=harness();await h.api.fetchNow();h.control.alerts=()=>({ok:false,status:503});await h.api.fetchNow();
  const candidate={...h.selection().consumerVisibleSituations[0],weatherFamilyIdentity:h.selection().weatherFamilyIdentity};
  const section={sourceClass:'weather',authorityState:'STALE',activeConditionCount:1,groups:[{rows:[{alert:candidate}]}]};
  const retain=h.context.gridlyLP236RetainCommunityRowsDuringReadUncertainty;
  assert.equal(retain(section),true);assert.equal(section.authorityState,'STALE');
  assert.equal(retain({...section,groups:[{rows:[{alert:{...candidate,providerRecordId:'other'}}]}]}),false);
  h.advance(3600000);assert.equal(retain(section),false);
});
test('weather retention does not expand community or roadway uncertainty eligibility',()=>{
  const h=harness(),retain=h.context.gridlyLP236RetainCommunityRowsDuringReadUncertainty;
  assert.equal(retain({sourceClass:'community_report',authorityState:'STALE',activeConditionCount:1}),true);
  assert.equal(retain({sourceClass:'official_roadway',authorityState:'STALE',activeConditionCount:1}),false);
  assert.equal(retain({sourceClass:'weather',authorityState:'QUIET',activeConditionCount:0}),false);
});
test('authoritative expiry publishes a consumer refresh without waiting for the next network poll',async()=>{
  const h=harness(),timers=new Map();
  const alertsUpdates=[];h.context.gridlySynchronizeOpenAlertsPortrait=reason=>alertsUpdates.push({reason,ids:h.records().map(record=>record.id)});
  h.context.setTimeout=(fn,ms)=>{const handle={unref(){}};timers.set(handle,{fn,ms});return handle;};
  h.context.clearTimeout=handle=>timers.delete(handle);
  await h.api.fetchNow();assert.equal(timers.size,1);
  const expiry=[...timers.values()][0];assert.equal(expiry.ms,3600000);
  const requests=h.calls.length;h.advance(3600000);expiry.fn();
  assert.equal(h.notices.at(-1).reason,'weather-alert-expired');assert.equal(h.records().length,0);
  assert.equal(alertsUpdates.at(-1).reason,'weather-alert-expired');assert.equal(alertsUpdates.at(-1).ids.length,0);
  assert.equal(h.selection().consumerVisibleSituationCount,0);assert.equal(h.calls.length,requests);
});
test('pending refresh keeps verified alerts visible and response changes synchronize the guarded Alerts owner',async()=>{
  const h=harness();await h.api.fetchNow();const held=deferred(),updates=[];
  h.context.gridlySynchronizeOpenAlertsPortrait=reason=>updates.push(reason);
  h.control.alerts=()=>held.promise;const pending=h.api.fetchNow();await settle();
  const selection=h.selection(),candidate={...selection.consumerVisibleSituations[0],weatherFamilyIdentity:selection.weatherFamilyIdentity};
  const section={sourceClass:'weather',authorityState:'LOADING',activeConditionCount:1,groups:[{rows:[{alert:candidate}]}]};
  assert.equal(h.context.gridlyLP236RetainCommunityRowsDuringReadUncertainty(section),true);
  held.resolve({ok:false,status:503});await pending;
  assert.ok(updates.includes('weather-point-fetch-failure'));assert.equal(h.records()[0].id,'nws-warning');
});
test('an obsolete expiry callback cannot refresh a different point generation',async()=>{
  const h=harness(),timers=new Map();
  h.context.setTimeout=(fn,ms)=>{const handle={unref(){}};timers.set(handle,{fn,ms});return handle;};
  h.context.clearTimeout=handle=>timers.delete(handle);
  await h.api.fetchNow();const old=[...timers.values()][0].fn;
  h.setPoint(B);h.control.alerts=()=>response(payload(warning('B')));await h.api.fetchNow();
  const notices=h.notices.length;old();assert.equal(h.notices.length,notices);assert.equal(h.records()[0].id,'B');
});
