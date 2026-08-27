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

test("not-ready to governed Sulphur Springs transition makes exactly one valid request", async () => {
  const h = harness({ ...valid, lat:0, lng:0 });
  await h.context.gridlyWeatherConnector.refreshAwarenessView();
  h.select(valid);
  const run = h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].url, "https://api.weather.gov/alerts/active?point=33.1384,-95.6011");
  h.requests[0].resolve({ ok:true, json:async () => payload() });
  await run;
  assert.equal(h.context.gridlyWeatherConnectorRuntimeAudit().requestSucceeded, true);
});

test("one zero component is valid and does not weaken stale-response suppression", async () => {
  const first = { ...valid, stableIdentity:"equator", lat:0, lng:-95.6011 };
  const second = { ...valid, stableIdentity:"meridian", lat:33.1384, lng:0 };
  const h = harness(first);
  const lateRun = h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.match(h.requests[0].url, /point=0,-95\.6011$/);
  h.select(second);
  const currentRun = h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.match(h.requests[1].url, /point=33\.1384,0$/);
  h.requests[1].resolve({ ok:true, json:async () => payload([{ id:"current" }]) });
  await currentRun;
  h.requests[0].resolve({ ok:true, json:async () => payload([{ id:"stale" }]) });
  await lateRun;
  assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords()[0].id, "current");
  assert.equal(h.context.gridlyWeatherConnectorRuntimeAudit().staleResponseSuppressedCount, 1);
});

test("governed resolver rejects null coercion and only the paired zero sentinel", () => {
  const start = appSource.indexOf("function gridlyResolveGovernedWeatherPoint");
  const end = appSource.indexOf("\nif (typeof window !== \"undefined\")", start);
  const resolver = appSource.slice(start, end);
  assert.match(resolver, /rawLat == null \|\| rawLng == null/);
  assert.match(resolver, /lat === 0 && lng === 0/);
  assert.doesNotMatch(resolver, /if \(lat === 0 \|\| lng === 0\)/);
});
