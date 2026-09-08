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
    getGridlySelectedAwarenessArea() {
      return { label: "Liberty County", countyId: "liberty-tx", lat: 30.0572, lng: -94.795, radiusMiles: 35, countyWide: true };
    },
    getDistanceMiles() {
      return 1;
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

// Exact public diagnostic contract, independent of object insertion order.
// Spreading the VM object preserves missing/extra keys and value types while
// avoiding a cross-realm prototype comparison. No fields are filtered out.
function assertHealth(context, expectedChanges = {}) {
  assert.deepStrictEqual({ ...context.gridlyDriveTexasConnectorRuntimeAudit() }, {
    connected: false,
    networkingAvailable: true,
    automaticPolling: false,
    providerActivated: false,
    renderingPerformed: false,
    normalizedRecordCount: 0,
    refreshIntervalMs: 180000,
    apiKeyConfigured: true,
    configurationSource: "GRIDLY_CONFIG.driveTexas.apiKey",
    initialFetchAttempted: false,
    requestInFlight: false,
    lastFetchSucceeded: false,
    lastSuccessfulAt: null,
    retainedRecordCount: 0,
    lastError: null,
    ...expectedChanges
  });
}

function successfulTimestamp(context, requestStartedAt) {
  const value = context.gridlyDriveTexasConnectorRuntimeAudit().lastSuccessfulAt;
  assert.strictEqual(typeof value, "string");
  const timestamp = Date.parse(value);
  assert(Number.isFinite(timestamp), "successful fetch has a parseable timestamp");
  assert.strictEqual(new Date(timestamp).toISOString(), value, "timestamp is canonical ISO UTC");
  assert(timestamp >= requestStartedAt && timestamp <= Date.now(), "success belongs to this request window");
  return value;
}

(async () => {
  let fetchCalls = 0;
  let failNextFetch = false;
  const context = loadContext(async () => {
    fetchCalls += 1;
    if (failNextFetch) return { ok: false, status: 401, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => sampleGeoJson };
  });

  assert.strictEqual(typeof context.gridlyDriveTexasConnector, "object");
  assert.strictEqual(context.gridlyDriveTexasConnector.providerId, "drivetexas");
  assert.strictEqual(context.gridlyDriveTexasConnector.providerName, "DriveTexas");
  assert.strictEqual(typeof context.gridlyDriveTexasConnector.fetchNow, "function");
  assert.strictEqual(typeof context.gridlyDriveTexasConnectorRuntimeAudit, "function");
  assert.strictEqual(fetchCalls, 0, "connector does not fetch during script load");
  assertHealth(context);

  const providerBefore = context.gridlyDriveTexasProvider.getRuntimeState();
  const firstRequestStartedAt = Date.now();
  const firstRequest = context.gridlyDriveTexasConnector.fetchNow();
  assertHealth(context, { initialFetchAttempted: true, requestInFlight: true });
  const result = await firstRequest;
  const firstSuccessAt = successfulTimestamp(context, firstRequestStartedAt);
  assertHealth(context, { connected: true, initialFetchAttempted: true, lastFetchSucceeded: true,
    normalizedRecordCount: 1, retainedRecordCount: 1, lastSuccessfulAt: firstSuccessAt });
  assert.strictEqual(result.connected, true);
  assert.strictEqual(fetchCalls, 1);
  assert.strictEqual(context.gridlyDriveTexasConnectorRuntimeAudit().normalizedRecordCount, 1);
  assert.strictEqual(context.gridlyDriveTexasConnector.getNormalizedRecords()[0].rawPayloadExposed, false);
  assert.strictEqual(context.gridlyDriveTexasConnector.getNormalizedRecords()[0].providerId, "drivetexas");
  assert.strictEqual(context.gridlyDriveTexasConnector.getNormalizedRecords()[0].routeName, "US 90");
  assert.deepStrictEqual(context.gridlyDriveTexasProvider.getRuntimeState(), providerBefore, "provider remains dormant and unmodified");

  const retainedRecords = JSON.stringify(context.gridlyDriveTexasConnector.getNormalizedRecords());
  failNextFetch = true;
  const failedRefresh = await context.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(failedRefresh.connected, false);
  assert.strictEqual(fetchCalls, 2, "failed authentication refresh is not retried");
  assertHealth(context, { initialFetchAttempted: true, normalizedRecordCount: 1, retainedRecordCount: 1,
    lastSuccessfulAt: firstSuccessAt, lastError: "DriveTexas connector request failed: 401" });
  assert.strictEqual(JSON.stringify(context.gridlyDriveTexasConnector.getNormalizedRecords()), retainedRecords,
    "retained data survives failure without claiming current connected/successful health");

  let retryCalls = 0;
  const retryContext = loadContext(async () => {
    retryCalls += 1;
    if (retryCalls === 1) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => sampleGeoJson };
  });
  const retryStartedAt = Date.now();
  const retryResult = await retryContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(retryResult.connected, true);
  assert.strictEqual(retryCalls, 2, "one retry is used for transient server errors");
  assertHealth(retryContext, { connected: true, initialFetchAttempted: true, lastFetchSucceeded: true,
    normalizedRecordCount: 1, retainedRecordCount: 1, lastSuccessfulAt: successfulTimestamp(retryContext, retryStartedAt) });

  let authCalls = 0;
  const authContext = loadContext(async () => {
    authCalls += 1;
    return { ok: false, status: 401, json: async () => ({}) };
  });
  const authResult = await authContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(authResult.connected, false);
  assert.strictEqual(authCalls, 1, "authentication failures are not retried");
  assertHealth(authContext, { initialFetchAttempted: true, lastError: "DriveTexas connector request failed: 401" });

  let schemaCalls = 0;
  const schemaContext = loadContext(async () => {
    schemaCalls += 1;
    return { ok: true, status: 200, json: async () => ({ records: [] }) };
  });
  const schemaResult = await schemaContext.gridlyDriveTexasConnector.fetchNow();
  assert.strictEqual(schemaResult.connected, false);
  assert.strictEqual(schemaCalls, 1, "schema failures are not retried");
  assertHealth(schemaContext, { initialFetchAttempted: true, lastError: "DriveTexas connector schema validation failed" });

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
  // The fixture rejects with a host-realm Error; the VM serializes its name too.
  assertHealth(timeoutContext, { initialFetchAttempted: true, lastError: "AbortError: aborted" });

  const unavailableContext = loadContext(undefined);
  assertHealth(unavailableContext, { networkingAvailable: false });
  await unavailableContext.gridlyDriveTexasConnector.fetchNow();
  assertHealth(unavailableContext, { networkingAvailable: false, initialFetchAttempted: true,
    lastError: "DriveTexas connector fetch is unavailable" });

  const emptyContext = loadContext(async () => ({ ok: true, status: 200,
    json: async () => ({ type: "FeatureCollection", features: [] }) }));
  const emptyStartedAt = Date.now();
  const emptyRequest = emptyContext.gridlyDriveTexasConnector.fetchNow();
  assertHealth(emptyContext, { initialFetchAttempted: true, requestInFlight: true });
  await emptyRequest;
  const emptySuccess = { connected: true, initialFetchAttempted: true, lastFetchSucceeded: true,
    lastSuccessfulAt: successfulTimestamp(emptyContext, emptyStartedAt) };
  assertHealth(emptyContext, emptySuccess);
  assert.strictEqual(emptyContext.gridlyDriveTexasConnector.getNormalizedRecords().length, 0,
    "a completed valid empty response is distinguishable from unrequested, pending and failed checks");
  emptyContext.gridlyDriveTexasConnector.startPolling();
  assertHealth(emptyContext, { ...emptySuccess, providerActivated: true, automaticPolling: true });
  emptyContext.gridlyDriveTexasConnector.stopPolling();
  assertHealth(emptyContext, { ...emptySuccess, providerActivated: true });

  const indexSource = fs.readFileSync("index.html", "utf8");
  assert(indexSource.includes("js/gridlyDriveTexasLiveConnector.js?v=840"));

  console.log(JSON.stringify({ ok: true, fetchCalls, retryCalls, authCalls, schemaCalls }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
