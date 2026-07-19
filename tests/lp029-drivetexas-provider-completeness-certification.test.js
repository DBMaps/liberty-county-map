const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function feature(id, routeName, categoryText, coordinates) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: {
      GLOBALID: id,
      route_name: routeName,
      condition: categoryText,
      description: categoryText,
      start_time: '2026-07-18T12:00:00-05:00',
      end_time: '2026-07-19T12:00:00-05:00'
    }
  };
}

async function loadRuntime() {
  let fetchCount = 0;
  const context = {
    window: {},
    globalThis: {},
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    GRIDLY_CONFIG: { driveTexas: { apiKey: 'secret-test-key', endpointTemplate: 'https://api.drivetexas.org/api/conditions.geojson?key={api_key}' } },
    getGridlySelectedAwarenessArea: () => ({ countyId: 'montgomery-tx', label: 'Conroe', lat: 30.3119, lng: -95.4558, radiusMiles: 9 }),
    fetch: async () => {
      fetchCount += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          type: 'FeatureCollection',
          metadata: { totalCount: 4, pageSize: 4 },
          features: [
            feature('dup-1', 'IH0045', 'unexpected provider category', [-95.4558, 30.3119]),
            feature('dup-1', 'SH0105', 'Road Closure', [-95.46, 30.32]),
            feature('row-3', '', 'Construction', [-94.9329, 30.7110]),
            feature('row-4', 'FM1488', 'Lane Closure', [-94.8852, 30.0466])
          ]
        })
      };
    }
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/gridlyDriveTexasProvider.js', 'utf8'), context, { filename: 'js/gridlyDriveTexasProvider.js' });
  vm.runInContext(fs.readFileSync('js/gridlyDriveTexasLiveConnector.js', 'utf8'), context, { filename: 'js/gridlyDriveTexasLiveConnector.js' });
  const beforeFetchCount = fetchCount;
  const fetchResult = await context.gridlyDriveTexasConnector.fetchNow();
  return { context, fetchResult, getFetchCount: () => fetchCount, beforeFetchCount };
}

(async () => {
  const runtime = await loadRuntime();
  assert.strictEqual(runtime.fetchResult.retainedNormalizedRecordCount, 4, 'LP028.8 complete source cache remains separate from awareness view');
  assert.strictEqual(runtime.context.gridlyDriveTexasConnector.getAllNormalizedRecords().length, 4, 'complete retained records are measurable separately');

  const before = JSON.stringify(runtime.context.gridlyDriveTexasConnector.areaLifecycleAudit());
  const fetchCountBeforeAudit = runtime.getFetchCount();
  const audit = runtime.context.gridlyLp029DriveTexasProviderCompletenessAudit();
  const after = JSON.stringify(runtime.context.gridlyDriveTexasConnector.areaLifecycleAudit());

  assert.strictEqual(audit.passive, true, 'LP029 audit is passive');
  assert.strictEqual(audit.fetchPerformed, false, 'LP029 audit reports no fetch');
  assert.strictEqual(runtime.getFetchCount(), fetchCountBeforeAudit, 'LP029 audit does not fetch');
  assert.strictEqual(after, before, 'LP029 audit does not mutate connector state');
  assert.strictEqual(JSON.stringify(audit).includes('secret-test-key'), false, 'LP029 audit never exposes the API key');

  assert.strictEqual(audit.rawResponseCount, null, 'raw count is not fabricated from normalized retention');
  assert.strictEqual(audit.normalizedCompleteCount, 4, 'normalized complete count is measurable');
  assert.strictEqual(audit.normalizationDropCount, null, 'drop count is truthful when raw retention is unavailable');
  assert.strictEqual(audit.duplicateIdCount, 1, 'duplicate provider IDs are measured');
  assert.strictEqual(audit.recordsWithValidCoordinates, 4, 'coordinate coverage is measurable');
  assert.strictEqual(audit.coordinateCoveragePercent, 100, 'coordinate coverage percent is measurable');
  assert.strictEqual(audit.recordsWithMissingRoute, 1, 'missing routes are measured');
  assert.strictEqual(audit.categoryCounts['Travel Advisory'], 1, 'unknown categories remain retained as Travel Advisory');
  assert.strictEqual(audit.routeCounts.IH0045, 1, 'route counts are measurable');
  assert.strictEqual(audit.paginationMetadata, null, 'missing pagination metadata is reported truthfully');
  assert(audit.sourceCompletenessClassification.startsWith('J_UNABLE_TO_CERTIFY'), 'provider completeness is not marked PASS without evidence');
  assert(audit.conroeProximityCounts['10mi'] >= 2, 'Conroe proximity search uses retained complete records');
  assert(audit.daytonProximityCounts['50mi'] >= 1, 'Dayton proximity search uses retained complete records');
  assert(audit.livingstonProximityCounts['50mi'] >= 1, 'Livingston proximity search uses retained complete records');
  assert.strictEqual(audit.endpointContract.endpointPath, '/api/conditions.geojson', 'endpoint contract exposes path only with secret removed');

  const serviceWorkerBefore = fs.readFileSync('service-worker.js', 'utf8');
  assert(serviceWorkerBefore.length > 0, 'service worker exists and remains covered by required checks');
  console.log('LP029 DriveTexas provider completeness certification checks passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
