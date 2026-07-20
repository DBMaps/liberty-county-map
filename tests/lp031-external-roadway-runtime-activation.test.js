const assert = require('assert');
const fs = require('fs');

const appSource = fs.readFileSync('js/app.js', 'utf8');
const manifestText = fs.readFileSync('data/roadway-runtime-manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);

['jefferson-tx', 'fort-bend-tx'].forEach((countyId) => {
  assert.strictEqual(manifest.counties[countyId].status, 'external_runtime', `${countyId} is externally active`);
  assert.ok(manifest.counties[countyId].url.includes(`/roadways/${countyId}/lp030-v1/`), `${countyId} resolves a versioned package URL`);
});
assert.strictEqual(manifest.counties['liberty-tx'].url, 'data/liberty-county-road-segments.geojson');
assert.strictEqual(manifest.counties['harris-tx'].status, 'partition_runtime_ready');
assert.strictEqual(manifest.counties['harris-tx'].url, null);

const resolverStart = appSource.indexOf('function gridlyResolveRoadwayRuntimeSource');
const resolverBody = appSource.slice(resolverStart, appSource.indexOf('function gridlyBuildRoadwayPackageCacheKey'));
assert.ok(resolverBody.includes('manifestStatus === "external_runtime"'), 'resolver selects external runtime entries');
assert.ok(resolverBody.includes('gridlyValidateRoadwayRuntimeAssetUrl(manifestEntry?.url)'), 'external URLs are validated before use');
assert.ok(resolverBody.indexOf('registryRoadSource') < resolverBody.indexOf('manifestStatus === "external_runtime"'), 'local runtime sources remain first for Liberty/Montgomery/San Jacinto');

const loaderStart = appSource.indexOf('async function loadRoadwayDataset');
const loaderBody = appSource.slice(loaderStart, appSource.indexOf('function gridlyCollectLoadedRoadwayGeometryTypes'));
assert.ok(loaderBody.includes('roadwayDatasetLoaded && gridlyRoadwayPackageRuntimeState.loadedCounty === roadwaySource?.countyId'), 'already-loaded package cache prevents duplicate download');
assert.ok(loaderBody.includes('return gridlyRoadwayPackageRuntimeState.currentLoadPromise'), 'in-flight duplicate package requests are reused');
assert.ok(loaderBody.includes('const requestStillActive = () => gridlyGetActiveCountyId() === requestedCountyId && gridlyRoadwayPackageRuntimeState.activeActivationSequence === activationSequence'), 'stale request guard binds county and activation sequence');
assert.ok(loaderBody.includes('staleCompletionIgnoredCount += 1'), 'stale request completions are counted and suppressed');
assert.ok(loaderBody.includes('roadwaySegmentFeatures = []'), 'loads clear prior county geometry before replacement/failure');
assert.ok(loaderBody.includes('roadwaySegmentFeatures = lineFeatures;'), 'successful loads replace the active roadway feature collection');
assert.ok(loaderBody.includes('gridlyResetRoadNameResolverRuntimeCache("roadway_dataset_loaded")'), 'dependent road-name cache refreshes after load');
assert.ok(loaderBody.includes('gridlyResetRoadNameResolverRuntimeCache("roadway_dataset_reset")'), 'dependent road-name cache refreshes after reset');
assert.ok(!loaderBody.includes('data/liberty-county-road-segments.geojson'), 'loader does not hardcode the Liberty roadway path');

const auditStart = appSource.indexOf('function gridlyLp031ExternalRoadwayRuntimeAudit');
const auditBody = appSource.slice(auditStart, appSource.indexOf('function findNearestRoadwaySegment'));
[
  'available', 'activeCountyId', 'runtimeClassification', 'resolvedSourceType', 'resolvedUrl', 'resolvedVersion',
  'loadStatus', 'loadedCountyId', 'featureCount', 'geometryTypes', 'cacheHit', 'requestStarted', 'requestCompleted',
  'staleRequestSuppressed', 'fallbackUsed', 'legacyLibertyPathUsedForNonLiberty', 'lastError', 'pass'
].forEach((field) => assert.ok(auditBody.includes(field), `LP031 audit exposes ${field}`));
assert.ok(appSource.includes('gridlyLp032HarrisPartitionRuntimeAudit'), 'LP032 audit handles Harris partition runtime separately');
assert.ok(!auditBody.includes('fetch('), 'LP031 audit is passive and does not fetch');

const nonLibertyManifest = Object.entries(manifest.counties).filter(([id]) => id !== 'liberty-tx');
assert.strictEqual(nonLibertyManifest.some(([, entry]) => entry.url === 'data/liberty-county-road-segments.geojson'), false, 'manifest does not assign Liberty path to non-Liberty counties');
assert.ok(!/service_role|service-role|SUPABASE_SERVICE_ROLE|sb_secret/i.test(appSource + manifestText), 'no service-role credentials were added');

console.log('LP031 external roadway runtime activation static tests passed');
