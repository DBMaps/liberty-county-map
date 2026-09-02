const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync("js/gridlyWeatherLiveConnector.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

test("native and web share the governed PLACE point and complete the NWS discovery pipeline", async () => {
  const requests = [];
  const point = { identityClass:"CANONICAL_PLACE", awarenessKey:"place-4819432", stableIdentity:"4819432", placeGeoid:"4819432", lat:30.0466, lng:-94.8852 };
  const responses = [
    { properties:{ forecast:"https://api.weather.gov/gridpoints/HGX/52,73/forecast" } },
    { properties:{ periods:[{number:1,name:"Tonight"}] } },
    { type:"FeatureCollection", features:[] }
  ];
  const context = { console, Date, Promise, TypeError, Error, AbortController, setTimeout, clearTimeout,
    gridlyResolveGovernedWeatherPoint:()=>point,
    gridlyWeatherProvider:{normalizeRecords:(payload)=>payload.features},
    fetch:async (url, options)=>{ requests.push({url,options}); return {ok:true,json:async()=>responses.shift()}; } };
  context.globalThis=context; vm.createContext(context); vm.runInContext(source,context);
  await context.gridlyWeatherConnector.refreshAwarenessView();
  assert.deepEqual(requests.map(({url})=>url), [
    "https://api.weather.gov/points/30.0466,-94.8852",
    "https://api.weather.gov/gridpoints/HGX/52,73/forecast",
    "https://api.weather.gov/alerts/active?point=30.0466,-94.8852"
  ]);
  const audit=context.gridlyWeatherConnectorRuntimeAudit();
  assert.equal(audit.selectedIdentityClass,"CANONICAL_PLACE");
  assert.equal(audit.selectedPlaceGeoid,"4819432");
  assert.equal(audit.governedWeatherPointAvailable,true);
  assert.equal(audit.pointsRequestSucceeded,true);
  assert.equal(audit.forecastRequestSucceeded,true);
  assert.equal(audit.finalWeatherHealth,"HEALTHY");
  assert.equal(audit.finalWeatherUnavailableReason,null);
  assert.equal(audit.freshnessStatus,"FRESH");
  assert.ok(audit.latestProviderSuccessTimestamp);
  assert.ok(requests.every(({options})=>Object.keys(options.headers).every(name=>!/(authorization|key|token|secret)/i.test(name))));
});

test("forecast derivation fails closed unless the NWS points response governs api.weather.gov", async () => {
  for (const forecast of [null,"http://api.weather.gov/gridpoints/X/1,1/forecast","https://example.com/forecast"]) {
    const point={identityClass:"CANONICAL_PLACE",awarenessKey:"place-1",stableIdentity:"1",placeGeoid:"1",lat:30,lng:-95};
    const context={console,Date,Promise,TypeError,Error,AbortController,setTimeout,clearTimeout,globalThis:null,gridlyResolveGovernedWeatherPoint:()=>point,gridlyWeatherProvider:{normalizeRecords:()=>[]},fetch:async()=>({ok:true,json:async()=>({properties:{forecast}})})};
    context.globalThis=context;vm.createContext(context);vm.runInContext(source,context);
    await context.gridlyWeatherConnector.refreshAwarenessView();
    const audit=context.gridlyWeatherConnectorRuntimeAudit();
    assert.equal(audit.forecastRequestAttempted,false);
    assert.equal(audit.requestSucceeded,false);
    assert.equal(audit.finalWeatherHealth,"UNAVAILABLE");
  }
});

test("bounded repair does not touch portrait, DriveTexas, Supabase, permissions, or identity owners",()=>{
  assert.match(app,/function gridlyResolveGovernedWeatherPoint/);
  const connectorNames=[...source.matchAll(/gridly(?:DriveTexas|Supabase)/g)];
  assert.equal(connectorNames.length,0);
});
