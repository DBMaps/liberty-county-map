const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const connectorSource = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'gridlyDriveTexasLiveConnector.js'), 'utf8');

function createRuntime() {
  let selected = null;
  let getterCalls = 0;
  const context = {
    console,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    JSON,
    Math,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    AbortController,
    GRIDLY_CONFIG: { driveTexas: { apiKey: 'test-key', endpointTemplate: 'https://example.test/conditions?key={api_key}' } },
    gridlySelectedAwarenessAreaResolutionCache: {
      totalGetterCalls: 0,
      cacheHits: 0,
      underlyingResolverCalls: 0,
      driveTexasFilterOperationCount: 0,
      driveTexasPerRecordAwarenessLookupCount: 0
    },
    getGridlySelectedAwarenessArea() {
      getterCalls += 1;
      context.gridlySelectedAwarenessAreaResolutionCache.totalGetterCalls += 1;
      return selected;
    },
    getDistanceMiles(lat1, lng1, lat2, lng2) {
      const dx = Number(lat1) - Number(lat2);
      const dy = Number(lng1) - Number(lng2);
      return Math.sqrt((dx * dx) + (dy * dy)) * 69;
    },
    gridlyDriveTexasProvider: {
      normalizeRecords(payload) {
        return payload.features.map((feature) => ({ ...feature.properties, raw: feature }));
      }
    },
    fetch: async () => ({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) })
  };
  context.window = context;
  context.globalThis = context;
  context.module = { exports: {} };
  vm.createContext(context);
  vm.runInContext(connectorSource, context, { filename: 'js/gridlyDriveTexasLiveConnector.js' });
  return {
    context,
    setSelected(area) { selected = area; },
    getGetterCalls() { return getterCalls; },
    async run(records) {
      context.fetch = async () => ({
        ok: true,
        json: async () => ({
          type: 'FeatureCollection',
          features: records.map((properties) => ({ type: 'Feature', properties, geometry: null }))
        })
      });
      await context.gridlyDriveTexasConnector.fetchNow();
      return context.gridlyDriveTexasConnector.getNormalizedRecords();
    }
  };
}

const alpha = Object.freeze({
  label: 'Alpha Prairie',
  storageValue: 'alpha-prairie',
  key: 'alpha-prairie-key',
  countyId: 'future-alpha-county',
  countyWide: false,
  lat: 30,
  lng: -95,
  radiusMiles: 5
});
const beta = Object.freeze({
  label: 'Beta Junction',
  storageValue: 'beta-junction',
  key: 'beta-junction-key',
  countyId: 'future-beta-county',
  countyWide: false,
  lat: 31,
  lng: -96,
  radiusMiles: 4
});
const countyWide = Object.freeze({
  label: 'Gamma County',
  storageValue: 'gamma-county',
  key: 'gamma-county-key',
  countyId: 'future-gamma-county',
  countyWide: true,
  lat: 32,
  lng: -97,
  radiusMiles: 9
});

(async () => {
  const runtime = createRuntime();

  runtime.setSelected(alpha);
  let results = await runtime.run([
    { id: 'alpha-coordinate', latitude: 30.01, longitude: -95.01, title: 'Road work' },
    { id: 'beta-coordinate', latitude: 31.01, longitude: -96.01, title: 'Road work' },
    { id: 'alpha-text', title: 'Closure near Alpha Prairie' }
  ]);
  assert.deepStrictEqual(results.map((record) => record.id).sort(), ['alpha-coordinate', 'alpha-text']);
  assert.strictEqual(runtime.getGetterCalls(), 1, 'community operation resolves awareness once for all records');

  runtime.setSelected(beta);
  results = await runtime.run([
    { id: 'alpha-coordinate', latitude: 30.01, longitude: -95.01, title: 'Road work' },
    { id: 'beta-coordinate', latitude: 31.01, longitude: -96.01, title: 'Road work' },
    { id: 'beta-text', description: 'Incident affecting beta-junction traffic' }
  ]);
  assert.deepStrictEqual(results.map((record) => record.id).sort(), ['beta-coordinate', 'beta-text']);
  assert.strictEqual(runtime.getGetterCalls(), 2, 'different community selection is resolved once on the next operation');

  runtime.setSelected(countyWide);
  results = await runtime.run([
    { id: 'county-radius', latitude: 32.4, longitude: -97.1, title: 'Within county-wide radius' },
    { id: 'outside-county-radius', latitude: 34, longitude: -99, title: 'Remote item' },
    { id: 'county-text', county: 'Gamma County' }
  ]);
  assert.deepStrictEqual(results.map((record) => record.id).sort(), ['county-radius', 'county-text']);
  assert.strictEqual(runtime.getGetterCalls(), 3, 'county-wide operation resolves awareness once');

  assert.strictEqual(runtime.context.gridlySelectedAwarenessAreaResolutionCache.driveTexasFilterOperationCount, 3);
  assert.strictEqual(runtime.context.gridlySelectedAwarenessAreaResolutionCache.driveTexasPerRecordAwarenessLookupCount, 0);
  assert.strictEqual(runtime.context.gridlySelectedAwarenessAreaResolutionCache.totalGetterCalls, 3);
  function bodyOf(functionName) {
    const marker = `function ${functionName}`;
    const start = connectorSource.indexOf(marker);
    assert.notStrictEqual(start, -1, `${functionName} exists`);
    const bodyStart = connectorSource.indexOf('{', connectorSource.indexOf(')', start));
    let depth = 0;
    for (let index = bodyStart; index < connectorSource.length; index += 1) {
      const char = connectorSource[index];
      if (char === '{') depth += 1;
      if (char === '}') depth -= 1;
      if (depth === 0) return connectorSource.slice(bodyStart + 1, index);
    }
    throw new Error(`Unable to parse ${functionName}`);
  }
  const matchesBody = bodyOf('matchesAwarenessArea');
  assert(!matchesBody.includes('activeAwarenessArea('), 'matchesAwarenessArea never calls activeAwarenessArea');
  assert(!matchesBody.includes('getGridlySelectedAwarenessArea('), 'matchesAwarenessArea never calls selected-area getter');

  console.log('LP016 DriveTexas awareness operation-scope regression checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
