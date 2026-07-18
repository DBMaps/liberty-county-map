const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const swSource = fs.readFileSync('service-worker.js', 'utf8');
const manifestText = fs.readFileSync('data/roadway-runtime-manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);

assert.ok(appSource.includes('async function gridlyActivateRoadwayDatasetForActiveCounty'), 'LP028.6 active-county activation helper exists');
assert.ok(appSource.includes('gridlyActivateRoadwayDatasetForActiveCounty("startup")'), 'startup local county loads through activation helper');
assert.ok(appSource.includes('gridlyActivateRoadwayDatasetForActiveCounty("active-county-change")'), 'county selection invokes roadway activation');
assert.ok(appSource.indexOf('gridlyActivateRoadwayDatasetForActiveCounty("active-county-change")') > appSource.indexOf('function gridlySetActiveCountyContext'), 'activation hook is owned by county runtime activation path');
assert.ok(appSource.includes('const requestedCountyId = gridlyGetActiveCountyId();'), 'activation captures requested county');
assert.ok(appSource.includes('gridlyResolveRoadwayRuntimeSource(requestedCountyId)'), 'activation/loader resolves selected county source');
assert.ok(appSource.includes('gridlyRoadwayPackageRuntimeState.currentLoadPromise && gridlyRoadwayPackageRuntimeState.currentPackageCacheKey === cacheKey'), 'duplicate same-county activation reuses current Promise');
assert.ok(appSource.includes('duplicateLoadDetected = true'), 'duplicate-load metadata remains truthful');
assert.ok(appSource.includes('gridlyRoadwayPackageRuntimeState.staleCompletionIgnoredCount += 1'), 'stale async completions are counted and ignored');
assert.ok(appSource.includes('gridlyGetActiveCountyId() === requestedCountyId && gridlyRoadwayPackageRuntimeState.activeActivationSequence === activationSequence'), 'late loads must still match active county before install');
assert.ok(appSource.includes('roadwaySegmentFeatures = lineFeatures;'), 'valid active loads install line geometry once');
assert.ok(appSource.includes('roadwaySegmentFeatures = [];\n      roadwayDatasetLoaded = false;'), 'unavailable/pending/blocked active counties clear stale geometry');
assert.ok(appSource.includes('throw new Error("roadway_dataset_unavailable")'), 'pending and blocked counties fail safely without a URL fetch');
assert.strictEqual(manifest.counties['liberty-tx'].status, 'local_runtime');
assert.strictEqual(manifest.counties['montgomery-tx'].status, 'local_runtime');
assert.strictEqual(manifest.counties['san-jacinto-tx'].status, 'local_runtime');
assert.strictEqual(manifest.counties['polk-tx'].status, 'pending_external_upload');
assert.strictEqual(manifest.counties['polk-tx'].url, null);
assert.strictEqual(manifest.counties['harris-tx'].status, 'blocked_partition_required');
assert.strictEqual(manifest.counties['harris-tx'].url, null);
['activationRequestCount', 'lastRequestedCounty', 'lastCompletedCounty', 'staleCompletionIgnoredCount', 'countyActivationInProgress', 'activePackageMatchesSelectedCounty', 'countySwitchActivationHookInstalled'].forEach((field) => {
  assert.ok(appSource.includes(field), `audit exposes ${field}`);
});
const auditStart = appSource.indexOf('function gridlyLp028RegionalRoadwayRuntimeAudit');
const auditBody = appSource.slice(auditStart, auditStart + 4500);
assert.ok(!auditBody.includes('fetch('), 'LP028 audit remains passive: no fetch');
assert.ok(!auditBody.includes('loadRoadwayDataset('), 'LP028 audit remains passive: no loader invocation');
assert.ok(!auditBody.includes('resolveNearestRoadName('), 'LP028 audit remains passive: no road resolution');
['resolveNearestRoadName', 'resolveNearbyRoadPair'].forEach((name) => {
  const index = appSource.indexOf(`function ${name}`);
  assert.ok(index >= 0, `${name} exists`);
  assert.ok(!appSource.slice(index, index + 4000).includes('loadRoadwayDataset('), `${name} does not invoke roadway loader`);
});
assert.ok(!swSource.includes('roadway-runtime-manifest.json'), 'service worker does not precache roadway manifest');
assert.ok(!/road-segments.*geojson/i.test(swSource), 'service worker does not precache roadway packages');

console.log('LP028.6 active-county roadway activation tests passed');
