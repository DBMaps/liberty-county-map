const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");

const feature = (id="nws-same") => ({ id, type:"Feature", geometry:null, properties:{ id, event:"Heat Advisory", headline:"Heat Advisory", status:"Actual", messageType:"Alert", severity:"Moderate", certainty:"Likely", urgency:"Expected", effective:"2026-08-26T00:00:00Z", expires:"2099-08-27T00:00:00Z", affectedZones:["TXZ291"] } });
const payload = (features=[]) => ({ type:"FeatureCollection", features });
function harness(initial, responders=[]) {
  let selected=initial; const pending=[];
  const context={ console, Date, Promise, TypeError, Error, AbortController, setTimeout, clearTimeout,
    gridlyResolveGovernedWeatherPoint:()=>selected,
    fetch:(url)=>url.includes("/points/")
      ? Promise.resolve({ok:true,json:async()=>({properties:{forecast:"https://api.weather.gov/gridpoints/HGX/1,1/forecast"}})})
      : url.includes("/gridpoints/")
        ? Promise.resolve({ok:true,json:async()=>({properties:{periods:[]}})})
        : new Promise((resolve,reject)=>pending.push({url,resolve,reject})),
    gridlyWeatherProvider:null
  };
  context.globalThis=context; vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js","utf8"),context);
  vm.runInContext(fs.readFileSync("js/gridlyWeatherLiveConnector.js","utf8"),context);
  context.gridlyWeatherConnector.refreshAwarenessView();
  return {context,pending,set:(v)=>{selected=v;}, audit:()=>context.gridlyWeatherConnectorRuntimeAudit()};
}
const dayton={awarenessKey:"dayton",identityClass:"CANONICAL_PLACE",countyId:"liberty-tx",stableIdentity:"4819492",lat:30.0466,lng:-94.8852,placeGeoid:"4819492"};
const tarkington={awarenessKey:"tarkington",identityClass:"GOVERNED_NON_PLACE",countyId:"liberty-tx",stableIdentity:"liberty-tx:tarkington",lat:30.3205,lng:-94.996,placeGeoid:null};
async function settle(){ await new Promise(r=>setImmediate(r)); }
async function take(h){ for(let i=0;i<20&&!h.pending.length;i+=1) await settle(); assert.ok(h.pending.length,"expected NWS request"); return h.pending.shift(); }

test("A/B/F/G/H/P: governed Dayton and non-PLACE Tarkington ACTIVE/QUIET preserve provider ID",async()=>{
  const h=harness(dayton); await settle(); assert.match(h.pending[0].url,/point=30.0466,-94.8852/); (await take(h)).resolve({ok:true,json:async()=>payload([feature()])}); await settle();
  assert.equal(h.audit().pointActiveAlertCount,1); assert.deepEqual([...h.audit().pointActiveAlertIds],["nws-same"]); assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords()[0].id,"nws-same");
  h.set(tarkington); const p=h.context.gridlyWeatherConnector.refreshAwarenessView(); await settle(); assert.match(h.pending[0].url,/30.3205,-94.996/); (await take(h)).resolve({ok:true,json:async()=>payload()}); await p;
  assert.equal(h.audit().freshEnough,true); assert.equal(h.audit().pointActiveAlertCount,0); assert.equal(h.audit().selectedPoint.identityClass,"GOVERNED_NON_PLACE"); assert.equal(h.audit().selectedPoint.placeGeoid,null);
});

test("C/D/O: request failures and malformed HTTP 200 fail closed",async()=>{
  for(const malformed of [false,true]) { const h=harness(dayton); await settle(); (await take(h)).resolve(malformed ? {ok:true,json:async()=>({})} : {ok:false,status:400,json:async()=>({})}); await settle(); assert.equal(h.audit().requestSucceeded,false); assert.equal(h.audit().responseValid,false); assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords().length,0); }
});

test("I/J: late Dayton/Tarkington responses are suppressed across both transition directions",async()=>{
  for (const [first,second,lateId,currentId] of [[dayton,tarkington,"dayton","tark"],[tarkington,dayton,"tarkington","dayton"]]) {
    const h=harness(first); await settle(); const late=await take(h); h.set(second); const current=h.context.gridlyWeatherConnector.refreshAwarenessView(); await settle(); (await take(h)).resolve({ok:true,json:async()=>payload([feature(currentId)])}); await current; late.resolve({ok:true,json:async()=>payload([feature(lateId)])}); await settle(); assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords()[0].id,currentId); assert.equal(h.audit().staleResponseSuppressedCount,1);
  }
});

test("K/L/M/N: multi-county point is conserved; unsupported/county-wide fail closed; statewide endpoint retained",async()=>{
 const katy={awarenessKey:"place-4838476",identityClass:"CANONICAL_PLACE",countyId:"harris-tx",stableIdentity:"4838476",lat:29.7858,lng:-95.8244,placeGeoid:"4838476"}; const h=harness(katy); await settle(); assert.match(h.pending[0].url,/point=29.7858,-95.8244/); assert.equal(h.audit().selectedPoint.stableIdentity,"4838476"); assert.equal(h.audit().statewideDiagnosticEndpoint,"https://api.weather.gov/alerts/active?area=TX"); (await take(h)).resolve({ok:true,json:async()=>payload()}); await settle(); h.set(null); await h.context.gridlyWeatherConnector.refreshAwarenessView(); assert.equal(h.audit().currentAwarenessIdentity,null); assert.equal(h.audit().requestSucceeded,false);
});

test("B/N: identity transition atomically invalidates old authority before the new response",async()=>{
  const h=harness(dayton); await settle(); (await take(h)).resolve({ok:true,json:async()=>payload([feature("dayton")])}); await settle();
  const daytonFetchedAt=h.audit().fetchedAt;
  h.set(tarkington); const transition=h.context.gridlyWeatherConnector.refreshAwarenessView(); await settle();
  const pending=h.audit();
  assert.equal(pending.selectedPoint.identityClass,"GOVERNED_NON_PLACE");
  assert.equal(pending.selectedPoint.awarenessKey,"tarkington");
  assert.equal(pending.currentAwarenessIdentity,"liberty-tx:tarkington|tarkington|30.3205,-94.996");
  assert.equal(pending.pointRequestIdentity,pending.currentAwarenessIdentity);
  assert.equal(pending.responseIdentity,null);
  assert.equal(pending.requestSucceeded,false);
  assert.equal(pending.responseValid,false);
  assert.equal(pending.fetchedAt,null);
  assert.notEqual(pending.fetchedAt,daytonFetchedAt);
  assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords().length,0);
  (await take(h)).resolve({ok:true,json:async()=>payload([feature("tarkington")])}); await transition;
  assert.equal(h.audit().responseIdentity,h.audit().currentAwarenessIdentity);
});

test("G/H/O/P: bounded cache is retained but reused only by its exact identity",async()=>{
  const h=harness(dayton); await settle(); (await take(h)).resolve({ok:true,json:async()=>payload([feature("dayton")])}); await settle();
  h.set(tarkington); let transition=h.context.gridlyWeatherConnector.refreshAwarenessView(); await settle(); (await take(h)).resolve({ok:true,json:async()=>payload([feature("tarkington")])}); await transition;
  assert.equal(h.audit().cacheSize,2);
  h.set(dayton); const daytonReturn=await h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.equal(daytonReturn.cached,true); assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords()[0].id,"dayton");
  assert.equal(h.audit().responseIdentity,"4819492|dayton|30.0466,-94.8852");
  h.set(tarkington); const tarkingtonReturn=await h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.equal(tarkingtonReturn.cached,true); assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords()[0].id,"tarkington");
  assert.equal(h.audit().responseIdentity,"liberty-tx:tarkington|tarkington|30.3205,-94.996");
});

test("I/J/K: authority and Weather family reject mixed identity lineage",()=>{
  const selected="liberty-tx:tarkington|tarkington|30.3205,-94.996";
  const daytonIdentity="4819492|dayton|30.0466,-94.8852";
  const context={console,globalThis:null,gridlyWeatherConnector:{getNormalizedRecords:()=>[feature("dayton")]},gridlyWeatherProvider:{},gridlyResolveGovernedWeatherPoint:()=>tarkington,
    gridlyWeatherConnectorRuntimeAudit:()=>({applicabilityMode:"NWS_POINT_QUERY",requestSucceeded:true,responseValid:true,freshEnough:true,currentAwarenessIdentity:selected,pointRequestIdentity:selected,responseIdentity:daytonIdentity})};
  context.globalThis=context; vm.createContext(context); vm.runInContext(fs.readFileSync("js/gridlyWeatherAuthoritySourceIntegration.js","utf8"),context);
  const snapshot=context.gridlyGetWeatherAuthoritySnapshot({selectedAwarenessArea:{name:"Tarkington"}});
  assert.equal(snapshot.authorityIdentity,null); assert.equal(snapshot.authorityEligibleRecordCount,0);
  const family=context.gridlySelectConsumerVisibleWeatherSituations({snapshot});
  assert.equal(family.weatherFamilyIdentity,null); assert.equal(family.consumerVisibleSituationCount,0);
});
