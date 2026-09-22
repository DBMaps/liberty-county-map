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
