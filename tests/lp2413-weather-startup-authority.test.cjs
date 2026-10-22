const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const connectorSource = fs.readFileSync("js/gridlyWeatherLiveConnector.js", "utf8");
const appSource = fs.readFileSync("js/app.js", "utf8");
const payload = (features = []) => ({ type: "FeatureCollection", features });
const valid = { awarenessKey:"place-4870904", stableIdentity:"4870904", lat:33.1384, lng:-95.6011 };

function harness(initial) {
  let selected = initial;
  const requests = [];
  const context = { console, Date, Promise, TypeError, Error, AbortController, setTimeout, clearTimeout,
    gridlyResolveGovernedWeatherPoint: () => selected,
    gridlyWeatherProvider: { normalizeRecords: (body) => body.features },
    fetch: (url) => new Promise((resolve) => requests.push({ url, resolve })) };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(connectorSource, context);
  return { context, requests, select: (point) => { selected = point; } };
}
async function completeRequests(h) {
  const completed = new Set();
  for (let round=0;round<5;round++) {
    for (const request of h.requests) {
      if (completed.has(request)) continue;
      completed.add(request);
      request.resolve({ok:true,json:async()=>request.url.includes('/points/')?{properties:{forecast:'https://api.weather.gov/gridpoints/FWD/1,1/forecast'}}:request.url.includes('/forecast')?{properties:{periods:[]}}:payload()});
    }
    await new Promise(resolve=>setImmediate(resolve));
  }
}

test("unresolved and malformed startup authority waits without requesting NWS", async () => {
  for (const point of [null, {}, { ...valid, lat:null, lng:null }, { ...valid, lat:0, lng:0 }, { ...valid, lat:NaN }, { ...valid, lng:Infinity }, { ...valid, lat:"33.1" }, { ...valid, lat:91 }, { ...valid, lng:-181 }]) {
    const h = harness(point);
    const result = await h.context.gridlyWeatherConnector.refreshAwarenessView();
    assert.equal(result.notReady, true);
    assert.equal(result.reason, "WAITING_FOR_AUTHORITY");
    assert.equal(h.requests.length, 0);
    assert.equal(h.context.gridlyWeatherConnectorRuntimeAudit().requestAttempted, false);
  }
});

test("not-ready to governed Sulphur Springs transition starts with the governed NWS points request", async () => {
  const h = harness({ ...valid, lat:0, lng:0 });
  await h.context.gridlyWeatherConnector.refreshAwarenessView();
  h.select(valid);
  const run = h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.equal(h.requests.filter(request=>request.url.includes('/points/')).length, 1);
  assert.equal(h.requests[0].url, "https://api.weather.gov/points/33.1384,-95.6011");
  await completeRequests(h);
  await run;
  assert.equal(h.requests.length, 3, 'one request per points, forecast and alert source');
  assert.equal(h.context.gridlyWeatherConnectorRuntimeAudit().requestSucceeded, true);
});

test("one zero component remains a valid governed points lookup", async () => {
  const first = { ...valid, stableIdentity:"equator", lat:0, lng:-95.6011 };
  const second = { ...valid, stableIdentity:"meridian", lat:33.1384, lng:0 };
  const h = harness(first);
  const firstRun=h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.match(h.requests[0].url, /\/points\/0,-95\.6011$/);
  h.select(second); const secondRun=h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.match(h.requests.filter(request=>request.url.includes('/points/')).at(-1).url, /\/points\/33\.1384,0$/);
  await completeRequests(h); await Promise.all([firstRun,secondRun]);
});

test("governed resolver rejects null coercion and only the paired zero sentinel", () => {
  const start = appSource.indexOf("function gridlyResolveGovernedWeatherPoint");
  const end = appSource.indexOf("\nif (typeof window !== \"undefined\")", start);
  const resolver = appSource.slice(start, end);
  assert.match(resolver, /rawLat == null \|\| rawLng == null/);
  assert.match(resolver, /lat === 0 && lng === 0/);
  assert.doesNotMatch(resolver, /if \(lat === 0 \|\| lng === 0\)/);
});
