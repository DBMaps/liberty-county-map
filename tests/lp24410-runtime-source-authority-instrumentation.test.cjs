const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const bridgeSource = fs.readFileSync('js/gridlyRuntimeSourceRegistryBridge.js', 'utf8');
const activationSource = fs.readFileSync('js/gridlyRuntimeSourceBridgeActivation.js', 'utf8');

const canonical = Object.freeze({
  'liberty-tx': Object.freeze({ countyId: 'liberty-tx', boundarySource: 'assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson', roadSource: 'data/liberty-county-road-segments.geojson', roadSourceLoadable: true, crossingSource: 'Crossing-Packages/liberty/liberty-crossings.geojson', remoteCrossingSource: 'https://fra.example/liberty', crossingOverridesSource: 'data/gridly-crossing-review-overrides.json' }),
  'dallas-tx': Object.freeze({ countyId: 'dallas-tx', boundarySource: 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json', roadSource: null, roadSourceLoadable: false, crossingSource: null, remoteCrossingSource: null, crossingOverridesSource: null }),
  'montgomery-tx': Object.freeze({ countyId: 'montgomery-tx', boundarySource: 'assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson', roadSource: null, roadSourceLoadable: false, crossingSource: 'Crossing-Packages/montgomery/montgomery-crossings.geojson', remoteCrossingSource: null, crossingOverridesSource: 'assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json' })
});

const runtimeRegistry = {
  packages: [
    { packageType: 'Community', county: 'Liberty', manifest: 'Community-Packages/liberty/package-manifest.json' },
    { packageType: 'Crossing', county: 'Liberty', manifest: 'Crossing-Packages/liberty/package-manifest.json' }
  ]
};
const manifests = {
  'assets/package-registry/runtime-package-registry.json': runtimeRegistry,
  'Community-Packages/liberty/package-manifest.json': { packageType: 'Community', county: 'Liberty', boundaryFile: 'Community-Packages/liberty/liberty-boundary.geojson', packageFile: 'Community-Packages/liberty/liberty-roads.geojson' },
  'Crossing-Packages/liberty/package-manifest.json': { packageType: 'Crossing', county: 'Liberty', packageFile: 'Crossing-Packages/liberty/liberty-crossings.geojson' }
};

function makeRuntime() {
  let activeCountyId = 'liberty-tx';
  let fetchCount = 0;
  const scheduled = [];
  const window = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY: canonical };
  const context = vm.createContext({
    window,
    Date,
    console,
    setTimeout: (callback) => { scheduled.push(callback); return scheduled.length; },
    fetch: async (path, options) => {
      fetchCount += 1;
      assert.equal(options?.cache, 'no-store');
      const value = manifests[path];
      return { ok: Boolean(value), status: value ? 200 : 404, json: async () => structuredClone(value) };
    }
  });
  window.gridlyGetActiveCountyId = () => activeCountyId;
  window.gridlyGetActiveCountyRuntimeSources = () => {
    const sources = canonical[activeCountyId];
    window.gridlyRuntimeSourceRegistryBridge?.recordRegistryRead({ countyId: activeCountyId });
    return sources;
  };
  vm.runInContext(bridgeSource, context);
  vm.runInContext(activationSource, context);
  return { window, scheduled, fetchCount: () => fetchCount, setCounty: (countyId) => { activeCountyId = countyId; } };
}

test('canonical Liberty baseline is explicit while package warmup remains deferred', () => {
  const runtime = makeRuntime();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(runtime.scheduled.length, 0, 'default Liberty activation is not scheduled');
  assert.deepEqual({ ...audit.registryAuthority }, {
    countyId: 'liberty-tx',
    boundaryPath: 'assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson',
    roadsPath: 'data/liberty-county-road-segments.geojson',
    crossingsPath: 'Crossing-Packages/liberty/liberty-crossings.geojson',
    remoteCrossingsPath: 'https://fra.example/liberty',
    crossingOverridesPath: 'data/gridly-crossing-review-overrides.json'
  });
  assert.equal(audit.bridge.installed, false);
  assert.equal(audit.warmupState, 'not_requested');
  assert.equal(audit.automaticWarmupEnabled, false);
  assert.equal(audit.overallPass, true);
  assert.equal(audit.startupTransition.preWarmAuthority.boundaryPath, audit.registryAuthority.boundaryPath);
  assert.equal(runtime.fetchCount(), 0, 'read-only audit does not start warmup or fetch');
});

test('post-warm instrumentation records package candidates while stable authority preserves crossings', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  const effective = runtime.window.gridlyGetActiveCountyRuntimeSources();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(effective.boundarySource, canonical['liberty-tx'].boundarySource);
  assert.equal(effective.roadSource, canonical['liberty-tx'].roadSource);
  assert.equal(effective.crossingSource, canonical['liberty-tx'].crossingSource);
  assert.equal(effective.crossingOverridesSource, canonical['liberty-tx'].crossingOverridesSource);
  assert.deepEqual(Array.from(audit.startupTransition.changedFields), []);
  assert.equal(audit.startupTransition.authorityChangedDuringStartup, false);
  assert.equal(audit.pathComparison.boundarySamePath, false);
  assert.equal(audit.pathComparison.roadsSamePath, false);
  assert.equal(audit.pathComparison.crossingsSamePath, true);
  assert.equal(audit.bridge.warmupSucceeded, true);
  assert.equal(audit.bridge.activationRevision, 1);
  assert.equal(audit.packageCandidateAvailable, true);
  assert.equal(audit.packageAuthorityApplied, false);
  assert.equal(audit.stableAuthorityPass, true);
  assert.equal(audit.overallAuthorityConsistent, true);
  assert.equal(audit.overallPass, true);
});

test('consumer and direct-registry paths remain separately observable', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  runtime.window.gridlyGetActiveCountyRuntimeSources();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  const getterConsumer = audit.consumerObservations.find((row) => row.consumer === 'loadGridlyActiveCountyBoundaryIdentity');
  const directConsumer = audit.consumerObservations.find((row) => row.consumer === 'gridlyBuildRegionalRuntimeAssetOwnershipAudit');
  assert.equal(getterConsumer.authoritySource, 'canonical_source_family');
  assert.equal(getterConsumer.authorityPathUsed.boundaryPath, canonical['liberty-tx'].boundarySource);
  assert.equal(directConsumer.authoritySource, 'registry');
  assert.equal(directConsumer.authorityPathUsed.boundaryPath, canonical['liberty-tx'].boundarySource);
});

test('Liberty to Dallas to a third county and back retains stable source-family authority', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  assert.equal(runtime.window.gridlyRuntimeSourceAuthorityAudit().packageAuthorityApplied, false);
  runtime.setCounty('dallas-tx');
  assert.deepEqual({ ...runtime.window.gridlyGetActiveCountyRuntimeSources() }, { ...canonical['dallas-tx'] });
  assert.equal(runtime.window.gridlyRuntimeSourceAuthorityAudit().bridgeAuthority, null);
  runtime.setCounty('montgomery-tx');
  assert.deepEqual({ ...runtime.window.gridlyGetActiveCountyRuntimeSources() }, { ...canonical['montgomery-tx'] });
  runtime.setCounty('liberty-tx');
  const restored = runtime.window.gridlyGetActiveCountyRuntimeSources();
  assert.equal(restored.packageBridgeApplied, undefined);
  assert.equal(restored.boundarySource, canonical['liberty-tx'].boundarySource);
  assert.equal(restored.roadSource, canonical['liberty-tx'].roadSource);
});

test('duplicate no-store reads and wrapper operations are counted without audit side effects', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  runtime.window.gridlyGetActiveCountyRuntimeSources();
  const beforeState = runtime.window.gridlyRuntimeSourceBridgeActivation.stateSnapshot();
  const beforeFetchCount = runtime.fetchCount();
  const first = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  const second = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  const afterState = runtime.window.gridlyRuntimeSourceBridgeActivation.stateSnapshot();
  assert.deepEqual(afterState, beforeState);
  assert.equal(runtime.fetchCount(), beforeFetchCount);
  assert.equal(first.runtimeReads.runtimeRegistryFetchCount, 2);
  assert.equal(first.runtimeReads.packageManifestReadCount, 2);
  assert.equal(first.runtimeReads.noStoreFetchCount, 4);
  assert.equal(first.runtimeReads.effectiveGetterReadCount, 1);
  assert.equal(first.runtimeReads.bridgeReadCount, 1);
  assert.deepEqual(second.runtimeReads, first.runtimeReads);
  assert.equal(first.duplicateRuntimeWork.find((row) => row.operation === 'runtime registry no-store fetch').duplicationAppearsNecessary, false);
});

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
}
function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  return value;
}
function assetEvidence(leftPath, rightPath) {
  const left = fs.readFileSync(leftPath);
  const right = fs.readFileSync(rightPath);
  const leftJson = readJson(leftPath);
  const rightJson = readJson(rightPath);
  return {
    exists: true,
    byteIdentity: left.equals(right) ? 'same' : 'different',
    semanticComparison: JSON.stringify(canonicalJson(leftJson)) === JSON.stringify(canonicalJson(rightJson)) ? 'same' : 'different',
    geometrySame: JSON.stringify(leftJson.features?.map((feature) => feature.geometry)) === JSON.stringify(rightJson.features?.map((feature) => feature.geometry)),
    leftSha256: crypto.createHash('sha256').update(left).digest('hex'),
    rightSha256: crypto.createHash('sha256').update(right).digest('hex')
  };
}

test('local Liberty asset equivalence is deterministic and kept out of startup runtime', () => {
  const boundary = assetEvidence('assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson', 'Community-Packages/liberty/liberty-boundary.geojson');
  const roads = assetEvidence('data/liberty-county-road-segments.geojson', 'Community-Packages/liberty/liberty-roads.geojson');
  const crossings = assetEvidence('Crossing-Packages/liberty/liberty-crossings.geojson', 'Crossing-Packages/liberty/liberty-crossings.geojson');
  assert.deepEqual({ byteIdentity: boundary.byteIdentity, semanticComparison: boundary.semanticComparison, geometrySame: boundary.geometrySame }, { byteIdentity: 'different', semanticComparison: 'different', geometrySame: true });
  assert.deepEqual({ byteIdentity: roads.byteIdentity, semanticComparison: roads.semanticComparison }, { byteIdentity: 'same', semanticComparison: 'same' });
  assert.deepEqual({ byteIdentity: crossings.byteIdentity, semanticComparison: crossings.semanticComparison }, { byteIdentity: 'same', semanticComparison: 'same' });
  assert.notEqual(boundary.leftSha256, boundary.rightSha256);
  assert.equal(roads.leftSha256, roads.rightSha256);
});

test('production wiring exposes bounded instrumentation with stable source-family authority', () => {
  const app = fs.readFileSync('js/app.js', 'utf8');
  const index = fs.readFileSync('index.html', 'utf8');
  assert.match(app, /recordRegistryRead\(\{ countyId:/);
  assert.match(activationSource, /window\.gridlyRuntimeSourceAuthorityAudit = runtimeSourceAuthorityAudit/);
  assert.match(activationSource, /packageCandidateAvailable/);
  assert.match(activationSource, /packageAuthorityApplied/);
  assert.match(activationSource, /stableAuthorityPass/);
  assert.match(activationSource, /automaticWarmupEnabled: false/);
  assert.doesNotMatch(activationSource, /setTimeout\(function \(\) \{\s*activate\("Liberty"\)/);
  assert.match(index, /gridlyRuntimeSourceRegistryBridge\.js[\s\S]*js\/app\.js[\s\S]*gridlyRuntimeSourceBridgeActivation\.js/);
  assert.doesNotMatch(activationSource, /crypto|subtle\.digest|FileReader/);
});
