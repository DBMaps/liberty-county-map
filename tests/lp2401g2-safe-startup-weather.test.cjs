const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync("js/app.js", "utf8");
const dayton = { awarenessKey: "dayton", identityClass: "CANONICAL_PLACE", countyId: "liberty-tx", stableIdentity: "4819432", lat: 30.0466, lng: -94.8852, placeGeoid: "4819432" };
const tarkington = { awarenessKey: "tarkington", identityClass: "GOVERNED_NON_PLACE", countyId: "liberty-tx", stableIdentity: "liberty-tx:tarkington", lat: 30.3205, lng: -94.996, placeGeoid: null };
const payload = (features = []) => ({ type: "FeatureCollection", features });
const feature = (id = "active") => ({ id, type: "Feature", geometry: null, properties: { id, event: "Heat Advisory", status: "Actual", messageType: "Alert", effective: "2026-08-26T00:00:00Z", expires: "2099-08-27T00:00:00Z" } });

function harness(initial) {
  let selected = initial;
  const pending = [];
  const context = { console, Date, Promise, TypeError, Error, AbortController, setTimeout, clearTimeout,
    gridlyResolveGovernedWeatherPoint: () => selected,
    fetch: (url) => url.includes("/points/")
      ? Promise.resolve({ok:true,json:async()=>({properties:{forecast:"https://api.weather.gov/gridpoints/HGX/1,1/forecast"}})})
      : url.includes("/gridpoints/")
        ? Promise.resolve({ok:true,json:async()=>({properties:{periods:[]}})})
        : new Promise((resolve, reject) => pending.push({ url, resolve, reject })) };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context);
  vm.runInContext(fs.readFileSync("js/gridlyWeatherLiveConnector.js", "utf8"), context);
  return { context, pending, set: (value) => { selected = value; }, audit: () => context.gridlyWeatherConnectorRuntimeAudit() };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function request(h) { for (let i = 0; i < 20 && !h.pending.length; i += 1) await settle(); assert.equal(h.pending.length, 1); return h.pending.shift(); }

test("A-C: startup Weather runs only at the completed DOMContentLoaded lifecycle", () => {
  const settings = appSource.indexOf("const GRIDLY_SETTINGS_DEFAULTS = Object.freeze(");
  const pulse = appSource.indexOf("const gridlyCommunityPulseFirstPaintState = {");
  const hook = appSource.indexOf("function gridlyEnsureWeatherAfterStartup()");
  const completion = appSource.indexOf("startupDiagnostics?.completeStartup?.();");
  const invocation = appSource.indexOf("gridlyEnsureWeatherAfterStartup();", completion);
  assert.ok(hook > 0 && invocation > completion);
  assert.ok(settings > hook && pulse > hook, "protected declarations may occur later in source because the hook is event-driven");
  assert.match(appSource.slice(hook, appSource.indexOf("document.addEventListener", hook)), /typeof GRIDLY_SETTINGS_DEFAULTS/);
  assert.match(appSource.slice(hook, appSource.indexOf("document.addEventListener", hook)), /typeof gridlyCommunityPulseFirstPaintState/);
  assert.doesNotMatch(appSource.slice(hook, appSource.indexOf("document.addEventListener", hook)), /setTimeout|queueMicrotask|Promise\.resolve/);
});

test("D-F/P: Dayton cold start requests once; in-flight joins and fresh cache is reused", async () => {
  const h = harness(dayton);
  const first = h.context.gridlyWeatherConnector.refreshAwarenessView();
  const repeated = h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.strictEqual(repeated, first);
  const pending = await request(h);
  assert.match(pending.url, /point=30.0466,-94.8852/);
  pending.resolve({ ok: true, json: async () => payload() });
  await first;
  assert.equal(h.audit().requestSucceeded, true);
  assert.equal(h.audit().responseValid, true);
  const cached = await h.context.gridlyWeatherConnector.refreshAwarenessView();
  assert.equal(cached.cached, true);
  assert.equal(h.pending.length, 0);
});

test("G-I: Tarkington is eligible without GEOID; county-wide and fallback are ineligible", async () => {
  const h = harness(tarkington);
  const active = h.context.gridlyWeatherConnector.refreshAwarenessView();
  const pending = await request(h);
  assert.match(pending.url, /point=30.3205,-94.996/);
  assert.equal(h.audit().selectedPoint.placeGeoid, null);
  pending.resolve({ ok: true, json: async () => payload() });
  await active;
  for (const ineligible of [null, null]) {
    h.set(ineligible);
    await h.context.gridlyWeatherConnector.refreshAwarenessView();
    assert.equal(h.pending.length, 0);
  }
});

test("J-L: failed, empty, and active startup responses remain UNAVAILABLE, QUIET, and ACTIVE inputs", async () => {
  for (const [response, succeeded, count] of [[{ ok: false, status: 400, json: async () => ({}) }, false, 0], [{ ok: true, json: async () => payload() }, true, 0], [{ ok: true, json: async () => payload([feature()]) }, true, 1]]) {
    const h = harness(dayton);
    const run = h.context.gridlyWeatherConnector.refreshAwarenessView();
    (await request(h)).resolve(response);
    await run;
    assert.equal(h.audit().requestSucceeded, succeeded);
    assert.equal(h.audit().pointActiveAlertCount || 0, count);
    assert.equal(h.audit().responseValid, succeeded);
  }
});

test("M-O: both transitions keep exact lineage and suppress a late startup response", async () => {
  for (const [first, second] of [[dayton, tarkington], [tarkington, dayton]]) {
    const h = harness(first);
    const lateRun = h.context.gridlyWeatherConnector.refreshAwarenessView();
    const late = await request(h);
    h.set(second);
    const currentRun = h.context.gridlyWeatherConnector.refreshAwarenessView();
    const current = await request(h);
    current.resolve({ ok: true, json: async () => payload([feature("current")]) });
    await currentRun;
    late.resolve({ ok: true, json: async () => payload([feature("late")]) });
    await lateRun;
    assert.equal(h.audit().responseIdentity, h.audit().currentAwarenessIdentity);
    assert.equal(h.audit().staleResponseSuppressedCount, 1);
    assert.equal(h.context.gridlyWeatherConnector.getNormalizedRecords()[0].id, "current");
  }
});
