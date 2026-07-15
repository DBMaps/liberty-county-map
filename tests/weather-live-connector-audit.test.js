const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function loadContext(fetchImpl) {
  let timeoutCallback = null;
  class TestAbortController {
    constructor() {
      this.signal = { aborted: false };
    }
    abort() {
      this.signal.aborted = true;
      if (typeof this.signal.onabort === "function") this.signal.onabort();
    }
  }

  const context = {
    console,
    module: { exports: {} },
    fetch: fetchImpl,
    AbortController: TestAbortController,
    setTimeout(callback, delay) {
      assert.strictEqual(delay, 8000, "weather connector uses the required 8000 ms timeout");
      timeoutCallback = callback;
      return 1;
    },
    clearTimeout() {},
    triggerTimeout() {
      if (timeoutCallback) timeoutCallback();
    },
    GRIDLY_CONFIG: { weather: { enabled: false, endpointTemplate: "https://api.weather.gov/alerts/active?area=TX" } },
    getGridlySelectedAwarenessArea() { return { label: "Liberty County", storageValue: "liberty-tx", countyId: "liberty-tx", countyWide: true }; },
    gridlyPackageRegistry: {
      getPackage(id) {
        return id === "intelligence.weather"
          ? { packageType: "intelligence", intelligence: { providerId: "weather" } }
          : null;
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyWeatherProvider.js", "utf8"), context, { filename: "js/gridlyWeatherProvider.js" });
  vm.runInContext(fs.readFileSync("js/gridlyWeatherLiveConnector.js", "utf8"), context, { filename: "js/gridlyWeatherLiveConnector.js" });
  return context;
}

const sampleNwsGeoJson = {
  type: "FeatureCollection",
  features: [{
    id: "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.test",
    type: "Feature",
    properties: {
      id: "urn:oid:test-alert",
      event: "Flash Flood Warning",
      headline: "Flash Flood Warning issued for Liberty County",
      description: "Flooding is ongoing.",
      severity: "Severe",
      areaDesc: "Liberty; Harris",
      effective: "2026-06-30T12:00:00Z",
      expires: "2026-06-30T14:00:00Z"
    },
    geometry: null
  }]
};

const sampleJsonLd = {
  "@context": "https://schema.org",
  "@graph": [{
    identifier: "jsonld-alert-1",
    event: "Tornado Warning",
    headline: "Tornado Warning for Liberty County",
    severity: "Extreme",
    areaDesc: "Liberty"
  }]
};

(async () => {
  let fetchCalls = 0;
  const context = loadContext(async (url, options) => {
    fetchCalls += 1;
    assert.strictEqual(url, "https://api.weather.gov/alerts/active?area=TX");
    assert.strictEqual(options.method, "GET");
    assert.strictEqual(options.cache, "no-store");
    assert(options.headers.Accept.includes("application/geo+json"));
    return { ok: true, status: 200, json: async () => sampleNwsGeoJson };
  });

  assert.strictEqual(typeof context.gridlyWeatherConnector, "object");
  assert.strictEqual(typeof context.gridlyWeatherConnector.fetchNow, "function");
  assert.strictEqual(typeof context.gridlyWeatherConnector.getNormalizedRecords, "function");
  assert.strictEqual(typeof context.gridlyWeatherConnectorRuntimeAudit, "function");
  assert.strictEqual(fetchCalls, 0, "connector does not fetch during script load");
  assert.strictEqual(JSON.stringify(context.gridlyWeatherConnectorRuntimeAudit()), JSON.stringify({
    connected: false,
    networkingAvailable: true,
    automaticPolling: false,
    providerActivated: false,
    renderingPerformed: false,
    normalizedRecordCount: 0,
    refreshIntervalMs: 120000
  }));

  const providerBefore = context.gridlyWeatherProvider.getRuntimeState();
  const result = await context.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(result.connected, true);
  assert.strictEqual(fetchCalls, 1);
  assert.strictEqual(context.gridlyWeatherConnectorRuntimeAudit().normalizedRecordCount, 1);
  assert.strictEqual(context.gridlyWeatherConnectorRuntimeAudit().providerActivated, false);
  assert.strictEqual(context.gridlyWeatherConnectorRuntimeAudit().renderingPerformed, false);
  assert.deepStrictEqual(context.gridlyWeatherProvider.getRuntimeState(), providerBefore, "provider remains dormant and unmodified");

  const records = context.gridlyWeatherConnector.getNormalizedRecords();
  assert.strictEqual(records.length, 1);
  assert.strictEqual(records[0].providerId, "weather");
  assert.strictEqual(records[0].category, "Flash Flood Warning");
  assert.strictEqual(records[0].severity, "Severe");
  assert.strictEqual(JSON.stringify(records[0].affectedAreas), JSON.stringify(["Liberty", "Harris"]));
  assert.strictEqual(records[0].rawPayloadExposed, false);
  assert.strictEqual(records[0].properties, undefined, "raw NWS properties are not exposed");

  let jsonLdCalls = 0;
  const jsonLdContext = loadContext(async () => {
    jsonLdCalls += 1;
    return { ok: true, status: 200, json: async () => sampleJsonLd };
  });
  const jsonLdResult = await jsonLdContext.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(jsonLdResult.connected, true);
  assert.strictEqual(jsonLdCalls, 1);
  assert.strictEqual(jsonLdContext.gridlyWeatherConnector.getNormalizedRecords()[0].category, "Tornado Warning");

  let retryCalls = 0;
  const retryContext = loadContext(async () => {
    retryCalls += 1;
    if (retryCalls === 1) return { ok: false, status: 429, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => sampleNwsGeoJson };
  });
  const retryResult = await retryContext.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(retryResult.connected, true);
  assert.strictEqual(retryCalls, 2, "one retry is used for HTTP 429");

  let serverCalls = 0;
  const serverContext = loadContext(async () => {
    serverCalls += 1;
    if (serverCalls === 1) throw new TypeError("network failed");
    return { ok: true, status: 200, json: async () => sampleNwsGeoJson };
  });
  const serverResult = await serverContext.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(serverResult.connected, true);
  assert.strictEqual(serverCalls, 2, "one retry is used for network failures");

  let validationCalls = 0;
  const validationContext = loadContext(async () => {
    validationCalls += 1;
    return { ok: false, status: 400, json: async () => ({}) };
  });
  const validationResult = await validationContext.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(validationResult.connected, false);
  assert.strictEqual(validationCalls, 1, "4xx validation failures are not retried");

  let schemaCalls = 0;
  const schemaContext = loadContext(async () => {
    schemaCalls += 1;
    return { ok: true, status: 200, json: async () => ({ unsupported: true }) };
  });
  const schemaResult = await schemaContext.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(schemaResult.connected, false);
  assert.strictEqual(schemaCalls, 1, "schema failures are not retried");

  let timeoutAbortSignal = null;
  let timeoutCalls = 0;
  const timeoutContext = loadContext((_url, options) => {
    timeoutCalls += 1;
    timeoutAbortSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.onabort = () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      };
      timeoutContext.triggerTimeout();
    });
  });
  const timeoutResult = await timeoutContext.gridlyWeatherConnector.fetchNow();
  assert.strictEqual(timeoutAbortSignal.aborted, true, "timeout aborts the request");
  assert.strictEqual(timeoutCalls, 2, "timeout receives at most one retry");
  assert.strictEqual(timeoutResult.connected, false, "timeout fails closed after retry budget is exhausted");
  assert.strictEqual(timeoutContext.gridlyWeatherConnectorRuntimeAudit().normalizedRecordCount, 0);
  assert.strictEqual(timeoutContext.gridlyWeatherConnectorRuntimeAudit().providerActivated, false);
  assert.strictEqual(timeoutContext.gridlyWeatherConnectorRuntimeAudit().renderingPerformed, false);

  assert.strictEqual(context.document, undefined, "connector has no document/UI ownership in this audit context");
  const indexSource = fs.readFileSync("index.html", "utf8");
  assert(indexSource.includes("js/gridlyWeatherLiveConnector.js?v=841"));

  console.log(JSON.stringify({ ok: true, fetchCalls, retryCalls, serverCalls, validationCalls, schemaCalls, timeoutCalls }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
