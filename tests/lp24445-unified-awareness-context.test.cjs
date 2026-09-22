const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('js/app.js','utf8');
const foundation = app.slice(app.indexOf('// LP244.45: runtime-only selection owner.'),app.indexOf('// End LP244.45 context foundation.'));
const counties = JSON.parse(fs.readFileSync('data/generated/lp214-county-community-inventory.json')).counties;
const coordinates = JSON.parse(fs.readFileSync('data/generated/gridly-statewide-place-presentation-v1.json')).places;
const registry = Object.fromEntries(counties.map(c=>[c.countyId,{name:c.countyName,countyFips:c.countyFips}]));
const areas = [];
for(const county of counties)for(const row of county.communities)if(!areas.some(a=>a.placeGeoid===row.placeGeoid)){
  const point=coordinates[row.placeGeoid];
  areas.push({key:row.canonicalKey,label:row.consumerLabel,countyId:county.countyId,placeGeoid:row.placeGeoid,countyMemberships:row.memberCountyFips,
    canonicalMultiCountyPlace:row.memberCountyFips.length>1,lat:point?.lat,lng:point?.lon,radiusMiles:7});
}
const areaFor=name=>areas.find(a=>a.label===name);
function runtime(){
  const home=areaFor('Cleveland');let county=home.countyId;
  const refreshes={weather:0,roads:0,poi:0,summary:0};
  const storage=JSON.stringify({gridlyHomeTown:'Cleveland',countyId:home.countyId});
  const h={Date,Object,Number,window:{},GRIDLY_COUNTY_REGISTRY:registry,GRIDLY_AWARENESS_AREA_DEFINITIONS:areas,GRIDLY_AWARENESS_AREA_BY_KEY:Object.fromEntries(areas.map(a=>[a.key,a])),DEFAULT_NEARBY_RADIUS_MILES:7,
    resolveGridlyCanonicalPlacePresentationFocus:a=>a?.placeGeoid?{lat:coordinates[a.placeGeoid].lat,lng:coordinates[a.placeGeoid].lon}:null,
    gridlyResolveCanonicalPlaceGeoid:a=>a?.placeGeoid||null,gridlyResolveCanonicalPlaceRegistryIdentity:a=>a,
    gridlyResolveCanonicalCountyIdForOperationalContext:(a,c)=>registry[c]&&(!a.countyMemberships?.length||a.countyMemberships.includes(registry[c].countyFips))?c:null,
    gridlyProjectCanonicalPlaceOperationalCounty:(a,c)=>({...a,countyId:c}),
    resolveGridlyAwarenessAreaForCounty:name=>areaFor(name),getDistanceMiles:()=>0,
    gridlyResolveCountyIdForCoordinate:()=>({countyId:'harris-tx'}),gridlyGetActiveCountyId:()=>county,
    gridlySetActiveCountyContext:(c,o)=>{assert.equal(o.preservePersistedAwareness,true);county=c;},
    invalidateGridlySelectedAwarenessAreaResolutionCache:()=>{},invalidateGridlyPortraitAwarenessSnapshotsForAreaChange:()=>{},
    syncGridlyAwarenessAreaSurfacesImmediately:()=>refreshes.summary++,scheduleRenderCrossings:()=>{},updateMobileWatchHeader:()=>{},gridlyDispatchSemanticCamera:()=>{},
    activeGeoFilter:'town',crossingRenderFilterVersion:0,
    localStorage:{getItem:()=>storage,setItem:()=>assert.fail('Temporary context wrote storage'),removeItem:()=>assert.fail('Temporary context removed storage')}
  };
  h.window.gridlyWeatherConnector={refreshAwarenessView:()=>refreshes.weather++};
  h.window.gridlyDriveTexasConnector={refreshAwarenessView:()=>refreshes.roads++};
  h.window.GridlyPoiBrowserProvider={refreshAwarenessContext:()=>refreshes.poi++};
  h.getGridlySelectedAwarenessArea=()=>h.gridlyReadTemporaryAwarenessArea()||home;
  vm.createContext(h);vm.runInContext(foundation,h);
  h.select=(name,countyId)=>{const a=areaFor(name);return h.gridlySelectSearchAwarenessContext({id:a.key,title:a.label,placeGeoid:a.placeGeoid,countyMemberships:a.countyMemberships,lat:a.lat,lng:a.lng,requestedOperationalCountyId:countyId,raw:{}});};
  return {h,refreshes,storage};
}
test('HOME snapshot is stable, canonical and persistent owner remains separate',()=>{const{h}=runtime();const a=h.gridlyGetCurrentAwarenessContext();assert.equal(a.type,'HOME');assert.equal(a.placeName,'Cleveland');assert.equal(a,h.gridlyGetCurrentAwarenessContext());assert.ok(a.memberships.length);});
test('Cleveland to Crosby is SEARCH and preserves Home storage',()=>{const{h,storage}=runtime();const c=h.select('Crosby');assert.equal(c.type,'SEARCH');assert.equal(c.placeName,'Crosby');assert.equal(c.countyId,'harris-tx');assert.equal(h.localStorage.getItem(),storage);assert.equal(c.source,'canonical-destination');});
test('Clear restores Cleveland and one coherent refresh per transition',()=>{const{h,refreshes}=runtime();h.select('Crosby');const c=h.gridlyClearTemporaryAwarenessContext();assert.equal(c.type,'HOME');assert.equal(c.placeName,'Cleveland');assert.deepEqual(refreshes,{weather:2,roads:2,poi:2,summary:2});});
test('Dayton replaces Crosby with a newer context generation',()=>{const{h}=runtime();const a=h.select('Crosby');const b=h.select('Dayton');assert.ok(b.generation>a.generation);assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Dayton');assert.equal(a.placeName,'Crosby');assert.ok(Object.isFrozen(a));});
test('Austin/Hays and Austin/Travis retain independent membership qualification',()=>{const{h}=runtime();for(const id of ['hays-tx','travis-tx']){const c=h.select('Austin',id);assert.equal(c.countyId,id);assert.ok(c.memberships.includes(registry[id].countyFips));}assert.equal(h.gridlyClearTemporaryAwarenessContext().placeName,'Cleveland');});
test('Abilene/Jones and Taylor plus Dallas use existing governed fixtures',()=>{const{h}=runtime();for(const id of ['jones-tx','taylor-tx'])assert.equal(h.select('Abilene',id).countyId,id);assert.equal(h.select('Dallas','dallas-tx').placeName,'Dallas');});
test('invalid explicit membership fails unavailable instead of substituting Home',()=>{const{h}=runtime();const c=h.select('Austin','harris-tx');assert.equal(c.type,'SEARCH');assert.equal(c.health,'UNAVAILABLE');assert.equal(c.countyId,null);assert.notEqual(c.placeName,'Cleveland');});
test('POI source locality resolves surrounding community without changing destination',()=>{const{h}=runtime(),a=areaFor('Crosby');const input={id:'poi:a&b',title:'A & B',lat:a.lat,lng:a.lng,address:{city:'Crosby'},raw:{countyId:'harris-tx'}};const before=JSON.stringify(input);const c=h.gridlySelectSearchAwarenessContext(input);assert.equal(c.placeName,'Crosby');assert.equal(c.destinationId,input.id);assert.equal(JSON.stringify(input),before);});
test('POI without locality retains coordinate scope, never POI-as-PLACE',()=>{const{h}=runtime();const c=h.gridlySelectSearchAwarenessContext({id:'poi',title:'Shop',lat:29.91,lng:-95.06,raw:{}});assert.equal(c.placeName,'Selected location');assert.equal(c.area.coordinateOnly,true);assert.equal(c.area.placeGeoid,undefined);});
test('120-second fix boundary, future timestamps, and missing timestamps fail truthfully',()=>{const{h}=runtime();assert.equal(h.gridlyIsForegroundAwarenessFixFresh({timestamp:1000},121000),true);assert.equal(h.gridlyIsForegroundAwarenessFixFresh({timestamp:1000},121001),false);assert.equal(h.gridlyIsForegroundAwarenessFixFresh({timestamp:1001},1000),false);assert.equal(h.gridlyIsForegroundAwarenessFixFresh({},1000),false);});
test('Around Me snapshot is ephemeral compatibility, not implicit activation',()=>{const{h}=runtime();h.select('Crosby');const c=h.gridlyCreateForegroundAwarenessContext({timestamp:Date.now(),coords:{latitude:30,longitude:-94}});assert.equal(c.type,'AROUND_ME');assert.equal(c.lat,30);assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Crosby');assert.equal(h.gridlyCreateForegroundAwarenessContext({timestamp:1,coords:{latitude:30,longitude:-94}}).health,'STALE');});
test('Route placeholder never activates and restarting loses Search, not Home',()=>{const{h}=runtime();assert.equal(h.gridlyGetAwarenessContextStore().types.ROUTE_WATCH,'ROUTE_WATCH');h.select('Crosby');assert.equal(runtime().h.gridlyGetCurrentAwarenessContext().placeName,'Cleveland');assert.equal(h.gridlyGetCurrentAwarenessContext().type,'SEARCH');});
test('diagnostics are bounded and carry no precise position history',()=>{const{h}=runtime();for(let i=0;i<30;i++)h.select(i%2?'Crosby':'Dayton');const rows=h.gridlyGetAwarenessContextStore().transitions;assert.equal(rows.length,20);assert.ok(rows.every(r=>!('lat'in r)&&!('lng'in r)));});
test('late Crosby NWS publication cannot replace Dayton; unavailable context clears records',async()=>{
  const connector=fs.readFileSync('js/gridlyWeatherLiveConnector.js','utf8');
  let point={awarenessKey:'crosby',stableIdentity:'4817756',lat:29.91,lng:-95.06},release;
  const h={Date,Promise,AbortController,setTimeout,clearTimeout,gridlyResolveGovernedWeatherPoint:()=>point,
    gridlyWeatherProvider:{normalizeRecords:b=>b.features},fetch:async url=>{
      if(url.includes('/points/29.91'))await new Promise(r=>release=r);
      return{ok:true,json:async()=>url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/T/1,1/forecast'}}:url.includes('/forecast')?{properties:{periods:[]}}:{type:'FeatureCollection',features:[{id:url}]}};
    }};
  vm.createContext(h);vm.runInContext(connector,h);
  const old=h.gridlyWeatherConnector.refreshAwarenessView();
  point={awarenessKey:'dayton',stableIdentity:'4819432',lat:30.04,lng:-94.89};
  await h.gridlyWeatherConnector.refreshAwarenessView();release();await old;
  assert.match(h.gridlyWeatherConnector.getNormalizedRecords()[0].id,/30\.04/);
  assert.ok(h.gridlyWeatherConnectorRuntimeAudit().staleResponseSuppressedCount>0);
  point=null;await h.gridlyWeatherConnector.refreshAwarenessView();assert.equal(h.gridlyWeatherConnector.getNormalizedRecords().length,0);
});


test('Home-only adapter bypasses active Search for Settings without clearing it',()=>{
  const {h}=runtime();h.select('Crosby');
  Object.assign(h,{gridlySelectedAwarenessAreaResolutionCache:{totalGetterCalls:0},gridlyRecordSelectedAwarenessAreaGetterCaller:()=>{},gridlyReadHomePersonalizationRecord:()=>null,getGridlySettingsPreferences:()=>({community:{homeTown:'Cleveland'}}),gridlyUserProfile:{},resolveGridlyAwarenessArea:()=>areaFor('Cleveland')});
  const start=app.indexOf('function getGridlySelectedAwarenessArea('),end=app.indexOf('// Read-only consumer projection',start);
  vm.runInContext(app.slice(start,end),h);
  assert.equal(h.getGridlySelectedAwarenessArea().label,'Crosby');
  assert.equal(h.getGridlySelectedAwarenessArea({homeOnly:true}).label,'Cleveland');
  assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Crosby');
});

test('late POI result cannot overwrite the newer context audit',async()=>{
  let generation=1,release,started;
  const began=new Promise(r=>started=r),held=new Promise(r=>release=r);
  const h={URL,TextDecoder,Response,Blob,DecompressionStream,crypto:globalThis.crypto,__GRIDLY_POI_NON_PRODUCTION__:true,gridlyGetCurrentAwarenessContext:()=>({generation}),fetch:async url=>{
    if(url.includes('.json.gz')&&generation===1){started();await held;}
    return new Response(fs.readFileSync('.'+new URL(url).pathname));
  }};
  vm.createContext(h);vm.runInContext(fs.readFileSync('js/gridlyPoiBrowserProvider.js','utf8'),h);
  const api=h.GridlyPoiBrowserProvider;
  const old=api.search(api.requestForCohort('Dayton',5));await began;
  generation=2;await api.search(api.requestForCohort('Dallas',5));
  assert.equal(api.audit().requestCountyContextId,'dallas-tx');
  release();await old;
  assert.equal(api.audit().requestCountyContextId,'dallas-tx');
});

// LP244.48 extends the original foundation fixture and consumer contract.
function aroundRuntime(){const r=runtime(),h=r.h;const timers=new Map();let id=0;h.window.setTimeout=(fn,ms)=>{timers.set(++id,{fn,ms});return id;};h.window.clearTimeout=id=>timers.delete(id);h.markerPoints=[];h.setGridlyUserLocation=p=>{h.markerPoints.push(p);return true;};h.softlyCenterMapOnGridlyUserLocation=p=>{h.camera=p;};h.document={querySelector:()=>({setAttribute:()=>{},removeAttribute:()=>{}})};h.recordGridlyGeolocationRequest=()=>{};h.messages=[];h.setConfirmation=m=>h.messages.push(m);h.requestGridlyForegroundPosition=(success,failure,options)=>{h.request={success,failure,options};return 'test';};const a=app.indexOf('function requestGridlyUserLocationFromControl(');vm.runInContext(app.slice(a,app.indexOf('\n}',a)+2),h);return {...r,timers};}
const fix=(timestamp=Date.now())=>({timestamp,coords:{latitude:29.91154,longitude:-95.06325}});
test('Around Me explicit success commits temporary scope, focuses fix, preserves Home',()=>{const{h,storage}=aroundRuntime();h.requestGridlyUserLocationFromControl();assert.equal(h.gridlyGetCurrentAwarenessContext().type,'HOME');assert.equal(h.request.options.maximumAge,0);h.request.success(fix());const c=h.gridlyGetCurrentAwarenessContext();assert.equal(c.type,'AROUND_ME');assert.equal(c.placeName,'Around Me');assert.equal(c.countyId,'harris-tx');assert.equal(c.area.coordinateOnly,true);assert.equal(c.health,'FRESH');assert.equal(h.camera.lat,c.lat);assert.equal(h.markerPoints.length,1);assert.equal(h.localStorage.getItem(),storage);assert.equal(h.gridlyClearTemporaryAwarenessContext().placeName,'Cleveland');});
test('Search → Around Me → Search → Home preserves one canonical Home',()=>{const{h,storage}=aroundRuntime();h.select('Dayton');h.gridlyActivateForegroundAwarenessContext(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().type,'AROUND_ME');h.select('Crosby');assert.equal(h.gridlyGetCurrentAwarenessContext().type,'SEARCH');assert.equal(h.gridlyClearTemporaryAwarenessContext().placeName,'Cleveland');assert.equal(h.localStorage.getItem(),storage);});
for(const [label,error]of [['denied',{code:1}],['timeout',{code:3}],['unavailable bridge',{code:'location_unavailable'}]])test('Around Me '+label+' preserves context and Home without a false marker',()=>{const{h,storage}=aroundRuntime();h.select('Crosby');const before=h.gridlyGetCurrentAwarenessContext();h.requestGridlyUserLocationFromControl();h.request.failure(error);assert.equal(h.gridlyGetCurrentAwarenessContext(),before);assert.equal(h.markerPoints.length,0);assert.equal(h.localStorage.getItem(),storage);assert.equal(h.gridlyGetAwarenessContextStore().foregroundPending,false);assert.match(h.messages.at(-1),/unchanged/);});
test('stale and invalid fixes never commit Around Me',()=>{const{h}=aroundRuntime();for(const position of [fix(Date.now()-120001),fix(Date.now()+10000),{coords:{latitude:30,longitude:-95}}, {timestamp:Date.now(),coords:{latitude:100,longitude:-95}}]){assert.equal(h.gridlyActivateForegroundAwarenessContext(position),null);assert.equal(h.gridlyGetCurrentAwarenessContext().type,'HOME');}});
test('one-shot expiry marks the prior area stale without recentering or location polling',()=>{const{h,timers}=aroundRuntime();const c=h.gridlyActivateForegroundAwarenessContext(fix());assert.equal(timers.size,1);assert.equal(h.gridlyExpireForegroundAwarenessContext(c,c.expiresAt),false);const camera=h.camera;assert.equal(h.gridlyExpireForegroundAwarenessContext(c,c.expiresAt+1),true);assert.equal(h.gridlyGetCurrentAwarenessContext().health,'STALE');assert.equal(h.gridlyReadTemporaryAwarenessArea().unavailable,true);assert.equal(h.camera,camera);assert.equal(h.markerPoints.length,1);});
test('a new explicit foreground request reacquires after expiry',()=>{const{h}=aroundRuntime();const c=h.gridlyActivateForegroundAwarenessContext(fix());h.gridlyExpireForegroundAwarenessContext(c,c.expiresAt+1);h.requestGridlyUserLocationFromControl();h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().health,'FRESH');assert.equal(h.markerPoints.length,2);});
test('late location callback cannot replace a newer Search selection',()=>{const{h}=aroundRuntime();h.requestGridlyUserLocationFromControl();h.select('Dayton');h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Dayton');assert.equal(h.markerPoints.length,0);});
test('late location callback cannot replace Return Home',()=>{const{h}=aroundRuntime();h.select('Crosby');h.requestGridlyUserLocationFromControl();h.gridlyClearTemporaryAwarenessContext();h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().type,'HOME');assert.equal(h.markerPoints.length,0);});
test('duplicate taps and late callbacks settle once; watchdog is bounded',()=>{const{h,timers}=aroundRuntime();assert.equal(h.requestGridlyUserLocationFromControl(),true);assert.equal(h.requestGridlyUserLocationFromControl(),false);assert.equal(timers.size,1);[...timers.values()][0].fn();h.request.success(fix());assert.equal(h.markerPoints.length,0);assert.equal(h.gridlyGetCurrentAwarenessContext().type,'HOME');});
test('Route Watch remains distinct and temporary activations cannot steal its owner',()=>{const{h}=aroundRuntime();h.select('Crosby');h.window.__gridlyRouteWatchActive=true;assert.equal(h.gridlyGetCurrentAwarenessContext().type,'ROUTE_WATCH');assert.equal(h.requestGridlyUserLocationFromControl(),false);assert.equal(h.gridlyActivateForegroundAwarenessContext(fix()),null);h.select('Dayton');assert.equal(h.gridlyGetCurrentAwarenessContext().type,'ROUTE_WATCH');h.window.__gridlyRouteWatchActive=false;assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Crosby');});
test('Route Watch geometry/endpoints/stop lifecycle and approved marker registry are untouched',()=>{const cp=require('child_process');const old=cp.execFileSync('git',['show','7c79a649:js/app.js'],{encoding:'utf8',maxBuffer:30e6});for(const n of ['renderRoutePreviewLine','gridlyCreateRouteEndpointMarker','getGridlyNavigationMarkerIcon','stopGridlyRouteWatch','clearGridlyRoute']){const extract=s=>{const a=s.indexOf('function '+n+'(');return s.slice(a,s.indexOf('\n}',a)+2);};assert.equal(extract(app),extract(old),n);}assert.equal(fs.readFileSync('js/gridlyMarkerRegistry.js','utf8').replace(/\r\n/g,'\n'),cp.execFileSync('git',['show','7c79a649:js/gridlyMarkerRegistry.js'],{encoding:'utf8'}).replace(/\r\n/g,'\n'));});

test('Around Me uses existing native foreground bridge and web fallback without watchers',async()=>{function functionSource(name){const a=app.indexOf('function '+name+'(');return app.slice(a,app.indexOf('\n}',a)+2);}const calls=[];const h={window:{Capacitor:{isNativePlatform:()=>true,Plugins:{GridlyGeolocation:{getCurrentPosition:options=>{calls.push(options);return Promise.resolve(fix());}}}}},navigator:{geolocation:{getCurrentPosition:(ok,fail,options)=>{calls.push(options);ok(fix());}}},Promise};vm.createContext(h);vm.runInContext(functionSource('getGridlyForegroundLocationProvider')+functionSource('requestGridlyForegroundPosition'),h);let success=0;assert.equal(h.requestGridlyForegroundPosition(()=>success++,assert.fail,{timeout:10000,maximumAge:0}),'capacitor_native');await new Promise(resolve=>setImmediate(resolve));assert.equal(success,1);h.window.Capacitor=undefined;assert.equal(h.requestGridlyForegroundPosition(()=>success++,assert.fail,{timeout:10000,maximumAge:0}),'browser');assert.equal(success,2);delete h.navigator.geolocation;let unavailable;assert.equal(h.requestGridlyForegroundPosition(assert.fail,e=>unavailable=e),'unavailable');assert.equal(unavailable.code,'location_unavailable');assert.ok(calls.every(o=>o.maximumAge===0));assert.doesNotMatch(functionSource('requestGridlyUserLocationFromControl'),/watchPosition|requestPermissions|Always|background/i);});

test('expiry during explicit reacquisition does not discard a fresh replacement fix',()=>{const{h}=aroundRuntime();const c=h.gridlyActivateForegroundAwarenessContext(fix());h.requestGridlyUserLocationFromControl();h.gridlyExpireForegroundAwarenessContext(c,c.expiresAt+1);h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().health,'FRESH');assert.equal(h.markerPoints.length,2);});

// LP244.48 Area ownership: exercise the real selector and camera with retained Home presentation.
function areaFilterRuntime(){
 const r=aroundRuntime(),h=r.h;
 const extract=n=>{const a=app.indexOf('function '+n+'(');return app.slice(a,app.indexOf('\n}',a)+2);};
 for(const n of ['gridlyGetTemporaryAreaFilterTarget','gridlyReissueActiveAreaPresentation','gridlyApplyZeroCrossingViewportContract','fitMapToCrossingsForActiveFilter','getVisibleCrossingsForFilter'])vm.runInContext(extract(n),h);
 h.GRIDLY_TOWN_STARTUP_ZOOM=13;h.gridlyActiveGeographicPresentation={semanticLevel:'PLACE',lat:30.3413,lng:-95.0858};h.gridlyCommittedSemanticCamera={zoom:13};h.gridlyPlacePresentationTargets={};
 h.gridlyGetGovernedPlaceConsumerPresentationCamera=id=>({lat:coordinates[id].lat,lng:coordinates[id].lon,zoom:13});
 h.getGridlyHomeTownAwarenessAnchor=()=>h.gridlyReadTemporaryAwarenessArea()||areaFor('Cleveland');
 h.setGridlyAwarenessView=(p,z)=>{h.camera={...p,zoom:z};return true;};
 h.map={fitBounds:(b)=>{h.fitted=b;}};h.L={latLngBounds:p=>({points:p,isValid:()=>true})};h.getFilterFitPadding=()=>({});h.getGridlyFilterViewportMaxZoom=()=>13;h.highlightNearestCrossingOnFirstLoad=()=>{};
 h.crossings=[{id:'dayton',lat:30.0466,lng:-94.8852}];h.debugGeoFilter=()=>{};h.getGridlyHomeTownCrossings=a=>{h.evaluation=a;return [{...h.crossings[0],lat:a.lat,lng:a.lng}];};h.findNearestCrossings=(lat,lng)=>{h.nearest={lat,lng};return h.crossings;};h.getGridlyAwarenessAnchor=()=>h.getGridlyHomeTownAwarenessAnchor();h.getDefaultRelevantCrossings=()=>h.crossings;h.gridlyGetActiveCountyCrossingInventory=()=>h.crossings;
 h.gridlyBuildCountywideAwarenessFallbackOption=c=>({countyId:c,countyWide:true});h.gridlySelectConsumerVisibleCrossings=a=>{h.evaluation=a;return h.crossings;};
 h.gridlyCountyBoundaryOverlayLayersById={'liberty-tx':{getBounds:()=>({county:'liberty-tx',isValid:()=>true})}};h.renderGridlyCountyBoundaryOverlay=()=>{};h.gridlyGetCountyBounds=()=>({county:h.gridlyGetActiveCountyId(),isValid:()=>true});
 h.applyArea=()=>{h.activeGeoFilter='town';const rows=h.getVisibleCrossingsForFilter();h.fitMapToCrossingsForActiveFilter(rows);};return r;
}
for(const [name,county]of [['Dayton','liberty-tx'],['Crosby','harris-tx']])test('Area uses temporary '+name+' for camera and crossing evaluation despite retained Cleveland presentation',()=>{
 const{h,storage}=areaFilterRuntime();h.select(name);const before=h.gridlyGetCurrentAwarenessContext();h.applyArea();assert.equal(h.gridlyGetCurrentAwarenessContext(),before);assert.equal(before.countyId,county);assert.equal(h.evaluation.placeGeoid,before.placeId);assert.equal(h.camera.lat,coordinates[before.placeId].lat);assert.notEqual(h.camera.lat,30.3413);assert.equal(h.localStorage.getItem(),storage);
});
test('Dayton County, All and Nearby retain their selectors and fitting behavior',()=>{const{h}=areaFilterRuntime();h.select('Dayton');for(const filter of ['county','all','nearby']){h.activeGeoFilter=filter;h.camera=null;h.fitted=null;const rows=h.getVisibleCrossingsForFilter();h.fitMapToCrossingsForActiveFilter(rows);assert.equal(h.camera,null);assert.ok(h.fitted);assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Dayton');if(filter==='county')assert.equal(h.fitted.county,'liberty-tx');if(filter==='nearby')assert.equal(h.nearest.lat,areaFor('Dayton').lat);}});
test('Return Home removes temporary Area ownership and restores Cleveland',()=>{const{h,storage}=areaFilterRuntime();h.select('Dayton');h.gridlyClearTemporaryAwarenessContext();h.applyArea();assert.equal(h.gridlyGetTemporaryAreaFilterTarget(),null);assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Cleveland');assert.equal(h.evaluation.lat,30.3413);assert.equal(h.fitted.points[0][0],30.3413);assert.equal(h.localStorage.getItem(),storage);});
test('Around Me Area uses the accepted fix for camera and evaluation',()=>{const{h}=areaFilterRuntime();const c=h.gridlyActivateForegroundAwarenessContext(fix());h.applyArea();assert.equal(h.camera.lat,c.lat);assert.equal(h.camera.lng,c.lng);assert.equal(h.evaluation.key,c.area.key);assert.equal(h.evaluation.countyId,'harris-tx');});
test('stale Around Me and active Route Watch cannot claim temporary Area ownership',()=>{const{h}=areaFilterRuntime();const c=h.gridlyActivateForegroundAwarenessContext(fix());h.gridlyExpireForegroundAwarenessContext(c,c.expiresAt+1);assert.equal(h.gridlyGetTemporaryAreaFilterTarget(),null);h.select('Dayton');h.window.__gridlyRouteWatchActive=true;assert.equal(h.gridlyGetTemporaryAreaFilterTarget(),null);h.applyArea();assert.equal(h.gridlyGetCurrentAwarenessContext().type,'ROUTE_WATCH');assert.equal(h.evaluation.lat,30.3413);});

test('Area camera stays on temporary Dayton even without visible crossings',()=>{const{h}=areaFilterRuntime();h.select('Dayton');h.activeGeoFilter='town';h.fitMapToCrossingsForActiveFilter([]);assert.equal(h.camera.lat,coordinates[areaFor('Dayton').placeGeoid].lat);assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Dayton');});

// Consumer Search invokes the same guarded foreground transaction.
function searchLocationRuntime(){const r=areaFilterRuntime(),h=r.h;const start=app.indexOf('function requestGridlyUserLocationFromSearch(');vm.runInContext(app.slice(start,app.indexOf('\n}',start)+2),h);h.closed=0;h.closeGridlyDestinationSearchSurface=()=>{h.closed++;};return r;}
test('Search exposes one named native Around Me button before results and binds once',()=>{const html=fs.readFileSync('index.html','utf8');assert.equal((html.match(/id="gridlySearchAroundMeBtn"/g)||[]).length,1);assert.match(html,/<button id="gridlySearchAroundMeBtn"[^>]+type="button">Around Me<\/button>/);assert.ok(html.indexOf('id="gridlySearchAroundMeBtn"')<html.indexOf('id="gridlySearchResults"'));assert.ok(app.includes('aroundMeBtn.addEventListener("click", requestGridlyUserLocationFromSearch)'));assert.match(app,/!aroundMeBtn.dataset.gridlyAroundMeBound/);});
test('Search Around Me requests foreground once, publishes progress, activates and preserves Home',()=>{const{h,storage}=searchLocationRuntime();assert.equal(h.requestGridlyUserLocationFromSearch(),true);assert.equal(h.closed,1);assert.match(h.messages.at(-1),/Finding your location/);assert.equal(h.requestGridlyUserLocationFromSearch(),false);assert.equal(h.closed,1);h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().type,'AROUND_ME');h.applyArea();assert.equal(h.camera.lat,29.91154);assert.equal(h.localStorage.getItem(),storage);assert.equal(h.gridlyClearTemporaryAwarenessContext().placeName,'Cleveland');});
for(const [name,error]of [['denial',{code:1}],['timeout',{code:3}],['unavailable',{code:'location_unavailable'}]])test('Search Around Me '+name+' retains prior destination',()=>{const{h}=searchLocationRuntime();h.select('Dayton');const prior=h.gridlyGetCurrentAwarenessContext();h.requestGridlyUserLocationFromSearch();h.request.failure(error);assert.equal(h.gridlyGetCurrentAwarenessContext(),prior);assert.match(h.messages.at(-1),/unchanged/);});
test('Search Around Me rejects route takeover and late completion after a newer Search',()=>{const{h}=searchLocationRuntime();h.window.__gridlyRouteWatchActive=true;assert.equal(h.requestGridlyUserLocationFromSearch(),false);assert.equal(h.request,undefined);assert.equal(h.closed,0);h.window.__gridlyRouteWatchActive=false;h.requestGridlyUserLocationFromSearch();h.select('Dayton');h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().placeName,'Dayton');});
test('Search Around Me explicitly reacquires after expiry',()=>{const{h}=searchLocationRuntime();h.requestGridlyUserLocationFromSearch();h.request.success(fix());const c=h.gridlyGetCurrentAwarenessContext();h.gridlyExpireForegroundAwarenessContext(c,c.expiresAt+1);assert.equal(h.gridlyGetCurrentAwarenessContext().health,'STALE');h.requestGridlyUserLocationFromSearch();h.request.success(fix());assert.equal(h.gridlyGetCurrentAwarenessContext().health,'FRESH');assert.equal(h.markerPoints.length,2);});
