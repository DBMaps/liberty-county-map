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
    setTimeout(callback) {
      timeoutCallback = callback;
      return 1;
    },
    clearTimeout() {},
    triggerTimeout() {
      if (timeoutCallback) timeoutCallback();
    },
    GRIDLY_TXDOT_API_KEY: "test-key",
    GRIDLY_CONFIG: { driveTexas: { apiKey: "test-key" } },
    gridlyPackageRegistry: {
      getPackage(id) {
        return id === "intelligence.drivetexas"
          ? { packageType: "intelligence", intelligence: { providerId: "drivetexas" } }
          : null;
      }
    }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("js/gridlyDriveTexasProvider.js", "utf8"), context, { filename: "js/gridlyDriveTexasProvider.js" });
  vm.runInContext(fs.readFileSync("js/gridlyDriveTexasLiveConnector.js", "utf8"), context, { filename: "js/gridlyDriveTexasLiveConnector.js" });
  return context;
}

const sampleGeoJson = {
  type: "FeatureCollection",
  features: [{
    type: "Feature",
    properties: {
      GLOBALID: "abc-123",
      roadway: "US 90",
      description: "Road closed due to flooding",
      start_time: "2026-06-30T12:00:00Z"
    },
    geometry: { type: "Point", coordinates: [-94.79, 30.05] }
  }]
};

(async () => {
  let fetchCalls = 0;
  const context = loadContext(async () => {
    fetchCalls += 1;
    return { ok: true, status: 200, json: async () => sampleGeoJson };
  });

  assert.strictEqual(typeof context.gridlyDriveTexasConnector, "object");
  assert.strictEqual(typeof context.gridlyDriveTexasConnector.fetchNow, "function");
  assert.strictEqual(typeof context.gridlyDriveTexasConnectorRuntimeAudit, "function");
  assert.strictEqual(fetchCalls, 0, "connector does not fetch during script load");
  assert.strictEqual(JSON.stringify(context.gridlyDriveTexasConnectorRuntimeAudit()), JSON.stringify({
    connected: false,
    networkingAvailable: true,
    automaticPolling: false,
    providerActivated: false,
    renderingPerformed: false,
    normalizedRecordCount: 0
  }));

  const providerBefore = context.gridlyDriveTexasProvider.getRuntimeState();
  const result = await context.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(result.connected, true);
  assert.strictEqual(fetchCalls, 1);
  assert.strictEqual(context.gridlyDriveTexasConnectorRuntimeAudit().normalizedRecordCount, 1);
  assert.strictEqual(context.gridlyDriveTexasConnector.getNormalizedRecords()[0].rawPayloadExposed, false);
  assert.strictEqual(context.gridlyDriveTexasConnector.getNormalizedRecords()[0].providerId, "drivetexas");
  assert.strictEqual(context.gridlyDriveTexasConnector.getNormalizedRecords()[0].routeName, "US 90");
  assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), providerBefore, "provider remains dormant and unmodified");

  let retryCalls = 0;
  const retryContext = loadContext(async () => {
    retryCalls += 1;
    if (retryCalls === 1) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => sampleGeoJson };
  });
  const retryResult = await retryContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(retryResult.connected, true);
  assert.strictEqual(retryCalls, 2, "one retry is used for transient server errors");

  let authCalls = 0;
  const authContext = loadContext(async () => {
    authCalls += 1;
    return { ok: false, status: 401, json: async () => ({}) };
  });
  const authResult = await authContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(authResult.connected, false);
  assert.strictEqual(authCalls, 1, "authentication failures are not retried");

  let schemaCalls = 0;
  const schemaContext = loadContext(async () => {
    schemaCalls += 1;
    return { ok: true, status: 200, json: async () => ({ records: [] }) };
  });
  const schemaResult = await schemaContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(schemaResult.connected, false);
  assert.strictEqual(schemaCalls, 1, "schema failures are not retried");

  let timeoutAbortSignal = null;
  const timeoutContext = loadContext((_url, options) => {
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
  const timeoutResult = await timeoutContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(timeoutAbortSignal.aborted, true, "timeout aborts the request");
  assert.strictEqual(timeoutResult.connected, false, "timeout fails closed after retry budget is exhausted");
  assert.strictEqual(timeoutContext.gridlyDriveTexasConnectorRuntimeAudit().providerActivated, false);
  assert.strictEqual(timeoutContext.gridlyDriveTexasConnectorRuntimeAudit().renderingPerformed, false);

  const indexSource = fs.readFileSync("index.html", "utf8");
  assert(indexSource.includes("js/gridlyDriveTexasLiveConnector.js?v=840"));

  console.log(JSON.stringify({ ok: true, fetchCalls, retryCalls, authCalls, schemaCalls }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
