const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const bridgeSource = fs.readFileSync('js/gridlyRuntimeSourceRegistryBridge.js', 'utf8');
const activationSource = fs.readFileSync('js/gridlyRuntimeSourceBridgeActivation.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

const canonical = Object.freeze({
  'liberty-tx': Object.freeze({ countyId: 'liberty-tx', boundarySource: 'assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson', roadSource: 'data/liberty-county-road-segments.geojson', crossingSource: 'Crossing-Packages/liberty/liberty-crossings.geojson' }),
  'dallas-tx': Object.freeze({ countyId: 'dallas-tx', boundarySource: 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json', roadSource: null, crossingSource: null }),
  'montgomery-tx': Object.freeze({ countyId: 'montgomery-tx', boundarySource: 'assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson', roadSource: 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-lp1833-v1.geojson.gz', crossingSource: 'Crossing-Packages/montgomery/montgomery-crossings.geojson' })
});

const registry = { packages: [
  { packageType: 'Community', county: 'Liberty', manifest: 'Community-Packages/liberty/package-manifest.json' },
  { packageType: 'Crossing', county: 'Liberty', manifest: 'Crossing-Packages/liberty/package-manifest.json' },
  { packageType: 'Community', county: 'Montgomery', manifest: 'Community-Packages/montgomery/package-manifest.json' },
  { packageType: 'Crossing', county: 'Montgomery', manifest: 'Crossing-Packages/montgomery/package-manifest.json' }
] };
const payloads = {
  'assets/package-registry/runtime-package-registry.json': registry,
  'Community-Packages/liberty/package-manifest.json': { packageType: 'Community', county: 'Liberty', boundaryFile: 'Community-Packages/liberty/liberty-boundary.geojson', packageFile: 'Community-Packages/liberty/liberty-roads.geojson' },
  'Crossing-Packages/liberty/package-manifest.json': { packageType: 'Crossing', county: 'Liberty', packageFile: 'Crossing-Packages/liberty/liberty-crossings.geojson' },
  'Community-Packages/montgomery/package-manifest.json': { packageType: 'Community', county: 'Montgomery', boundaryFile: 'Community-Packages/montgomery/montgomery-boundary.geojson', packageFile: 'Community-Packages/montgomery/montgomery-roads.geojson' },
  'Crossing-Packages/montgomery/package-manifest.json': { packageType: 'Crossing', county: 'Montgomery', packageFile: 'Crossing-Packages/montgomery/montgomery-crossings.geojson' },
  'Crossing-Packages/production-crossing-manifest.json': { records: [{ county: 'Liberty', status: 'PASS', crossingCount: 115, packageFile: 'Crossing-Packages/liberty/Production/liberty-production-crossings.geojson' }] }
};

function makeRuntime({ rejectWarmup = false } = {}) {
  let countyId = 'liberty-tx';
  let fetchCount = 0;
  const scheduled = [];
  const window = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY: canonical };
  const context = vm.createContext({ window, Date, console, structuredClone, setTimeout: (fn) => { scheduled.push(fn); return scheduled.length; }, fetch: async (path, options) => {
    fetchCount += 1;
    assert.equal(options?.cache, 'no-store');
    const value = payloads[path];
    return { ok: Boolean(value), status: value ? 200 : 404, json: async () => structuredClone(value) };
  } });
  window.gridlyGetActiveCountyId = () => countyId;
  window.gridlyGetActiveCountyRuntimeSources = () => canonical[countyId];
  vm.runInContext(bridgeSource, context);
  if (rejectWarmup) window.gridlyRuntimeSourceRegistryBridgeAudit = async () => { throw new Error('package discovery unavailable'); };
  vm.runInContext(activationSource, context);
  return { window, scheduled, fetchCount: () => fetchCount, setCounty: (value) => { countyId = value; } };
}

test('default module startup does not schedule or execute candidate warmup', () => {
  const runtime = makeRuntime();
  assert.equal(runtime.scheduled.length, 0);
  assert.equal(runtime.fetchCount(), 0);
  assert.equal(runtime.window.gridlyRuntimeSourceBridgeActivation.stateSnapshot().warmupState, 'not_requested');
});

test('runtime source authority audit is read-only and does not warm', () => {
  const runtime = makeRuntime();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(runtime.fetchCount(), 0);
  assert.equal(audit.warmupState, 'not_requested');
  assert.equal(audit.overallPass, true);
});

test('explicit Liberty warmup discovers candidates without applying authority', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(audit.packageCandidateAvailable, true);
  assert.equal(audit.packageAuthorityApplied, false);
  assert.equal(audit.warmupState, 'succeeded');
});

test('a second explicit warmup preserves existing repeat semantics', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.warmPackageSources('Liberty');
  await runtime.window.gridlyRuntimeSourceBridgeActivation.warmPackageSources('Liberty');
  assert.equal(runtime.window.gridlyRuntimeSourceAuthorityAudit().explicitWarmupCount, 2);
  assert.equal(runtime.fetchCount(), 8);
});

test('failed explicit warmup is observable while authority stays canonical', async () => {
  const runtime = makeRuntime({ rejectWarmup: true });
  await assert.rejects(runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty'), /package discovery unavailable/);
  assert.equal(runtime.window.gridlyRuntimeSourceAuthorityAudit().warmupState, 'failed');
  assert.equal(runtime.window.gridlyGetActiveCountyRuntimeSources().boundarySource, canonical['liberty-tx'].boundarySource);
});

test('Liberty canonical boundary remains available before warmup', () => {
  const runtime = makeRuntime();
  assert.equal(runtime.window.gridlyGetActiveCountyRuntimeSources().boundarySource, canonical['liberty-tx'].boundarySource);
  assert.match(appSource, /activeRuntimeBoundarySource === expectedSourceLibraryBoundaryPath/);
});

test('Liberty roadway resolver remains independent of candidate warmup', () => {
  const runtime = makeRuntime();
  assert.equal(runtime.window.gridlyGetActiveCountyRuntimeSources().roadSource, canonical['liberty-tx'].roadSource);
  assert.match(appSource, /function gridlyResolveRoadwayRuntimeSource\(/);
});

test('Liberty governed Crossing resolution remains independently callable', async () => {
  const runtime = makeRuntime();
  const result = await runtime.window.gridlyRuntimeSourceRegistryBridge.resolveGovernedCrossingSource({ county: 'Liberty', countyFips: '48291' });
  assert.deepEqual([result.state, result.governedCount], ['ACTIVE_POSITIVE', 115]);
  assert.equal(runtime.window.gridlyRuntimeSourceBridgeActivation.stateSnapshot().warmupState, 'not_requested');
});

test('Liberty to Dallas to Montgomery to Liberty retains stable authorities cold', () => {
  const runtime = makeRuntime();
  for (const county of ['liberty-tx', 'dallas-tx', 'montgomery-tx', 'liberty-tx']) {
    runtime.setCounty(county);
    assert.equal(runtime.window.gridlyGetActiveCountyRuntimeSources(), canonical[county]);
  }
});

test('explicit non-Liberty warmup remains compatible and non-authoritative', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.warmPackageSources('Montgomery');
  runtime.setCounty('montgomery-tx');
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(audit.packageCandidateAvailable, true);
  assert.equal(audit.packageAuthorityApplied, false);
  assert.equal(runtime.window.gridlyGetActiveCountyRuntimeSources().roadSource, canonical['montgomery-tx'].roadSource);
});

test('normal startup eliminates all four candidate-build no-store requests', () => {
  const runtime = makeRuntime();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.deepEqual({ registry: audit.registryReadCount, manifests: audit.manifestReadCount, noStore: audit.noStoreFetchCount }, { registry: 0, manifests: 0, noStore: 0 });
});

test('explicit warmup exposes two registry, two manifest, and four no-store reads', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.warmPackageSources('Liberty');
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.deepEqual({ registry: audit.registryReadCount, manifests: audit.manifestReadCount, noStore: audit.noStoreFetchCount }, { registry: 2, manifests: 2, noStore: 4 });
});

test('LP244.10 instrumentation remains available without automatic warmup', () => {
  const runtime = makeRuntime();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(audit.automaticWarmupEnabled, false);
  assert.equal(audit.automaticWarmupCount, 0);
  assert.equal(audit.explicitWarmupCount, 0);
  assert.equal(audit.packageCandidateAvailable, false);
});

test('LP244.11 stable source-family authority remains package-independent', async () => {
  const runtime = makeRuntime();
  const cold = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  const warm = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(cold.stableAuthorityPass, true);
  assert.equal(warm.stableAuthorityPass, true);
  assert.equal(warm.packageAuthorityApplied, false);
});
