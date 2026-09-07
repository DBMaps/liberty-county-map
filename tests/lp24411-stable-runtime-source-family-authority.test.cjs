const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const bridgeSource = fs.readFileSync('js/gridlyRuntimeSourceRegistryBridge.js', 'utf8');
const activationSource = fs.readFileSync('js/gridlyRuntimeSourceBridgeActivation.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

const canonical = Object.freeze({
  'liberty-tx': Object.freeze({ countyId: 'liberty-tx', boundarySource: 'assets/county-implementation/liberty/boundary/liberty-county-boundary.geojson', roadSource: 'data/liberty-county-road-segments.geojson', roadSourceLoadable: true, crossingSource: 'Crossing-Packages/liberty/liberty-crossings.geojson', remoteCrossingSource: 'https://fra.example/liberty', crossingOverridesSource: 'data/gridly-crossing-review-overrides.json' }),
  'dallas-tx': Object.freeze({ countyId: 'dallas-tx', boundarySource: 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json', roadSource: null, roadSourceLoadable: false, crossingSource: null, remoteCrossingSource: null, crossingOverridesSource: null }),
  'montgomery-tx': Object.freeze({ countyId: 'montgomery-tx', boundarySource: 'assets/county-implementation/montgomery/boundary/montgomery-county-boundary.geojson', roadSource: 'assets/county-implementation/montgomery/runtime-assets/montgomery-roads-lp1833-v1.geojson.gz', roadSourceLoadable: true, crossingSource: 'Crossing-Packages/montgomery/montgomery-crossings.geojson', remoteCrossingSource: null, crossingOverridesSource: 'assets/county-implementation/montgomery/runtime-assets/montgomery-county-crossing-review-overrides.json' })
});

const packageCandidates = Object.freeze({
  Liberty: Object.freeze({ county: 'Liberty', boundarySource: 'Community-Packages/liberty/liberty-boundary.geojson', roadSource: 'Community-Packages/liberty/liberty-roads.geojson', crossingSource: 'Crossing-Packages/liberty/liberty-crossings.geojson' }),
  Dallas: Object.freeze({ county: 'Dallas', boundarySource: 'Community-Packages/dallas/dallas-boundary.geojson', roadSource: 'Community-Packages/dallas/dallas-roads.geojson', crossingSource: 'Crossing-Packages/dallas/dallas-crossings.geojson' }),
  Montgomery: Object.freeze({ county: 'Montgomery', boundarySource: 'Community-Packages/montgomery/montgomery-boundary.geojson', roadSource: 'Community-Packages/montgomery/montgomery-roads.geojson', crossingSource: 'Crossing-Packages/montgomery/montgomery-crossings.geojson' })
});

function makeBridgeAudit() {
  let callCount = 0;
  const audit = async (county = 'Liberty') => {
    callCount += 1;
    const runtimeSources = packageCandidates[county];
    return runtimeSources
      ? { finalDetermination: 'PASS_RUNTIME_PACKAGE_SOURCE_BRIDGE_READY', runtimeSources }
      : { finalDetermination: 'BLOCKED_RUNTIME_PACKAGE_SOURCE_BRIDGE_NOT_READY', runtimeSources: null };
  };
  audit.callCount = () => callCount;
  return audit;
}

function makeRuntime(options = {}) {
  let activeCountyId = 'liberty-tx';
  const scheduled = [];
  const window = { GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY: canonical };
  const context = vm.createContext({
    window,
    Date,
    console,
    setTimeout: (callback) => { scheduled.push(callback); return scheduled.length; },
    fetch: async () => { throw new Error('unexpected network read'); }
  });
  window.gridlyGetActiveCountyId = () => activeCountyId;
  window.gridlyGetActiveCountyRuntimeSources = () => canonical[activeCountyId];
  vm.runInContext(bridgeSource, context);
  const bridgeAudit = options.bridgeAudit || makeBridgeAudit();
  window.gridlyRuntimeSourceRegistryBridgeAudit = bridgeAudit;
  vm.runInContext(activationSource, context);
  return { window, scheduled, bridgeAudit, setCounty: (countyId) => { activeCountyId = countyId; } };
}

function authorityFields(value) {
  return {
    boundarySource: value?.boundarySource || null,
    roadSource: value?.roadSource || null,
    crossingSource: value?.crossingSource || null,
    crossingOverridesSource: value?.crossingOverridesSource || null
  };
}

test('cold and successful Liberty warmup retain canonical source-family authority while exposing candidates', async () => {
  const runtime = makeRuntime();
  const cold = runtime.window.gridlyGetActiveCountyRuntimeSources();
  assert.deepEqual(authorityFields(cold), authorityFields(canonical['liberty-tx']));

  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  const warm = runtime.window.gridlyGetActiveCountyRuntimeSources();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.deepEqual(authorityFields(warm), authorityFields(canonical['liberty-tx']));
  assert.equal(audit.packageCandidateAvailable, true);
  assert.equal(audit.packageAuthorityApplied, false);
  assert.equal(audit.bridgeAuthority.boundaryPath, packageCandidates.Liberty.boundarySource);
  assert.equal(audit.bridgeAuthority.roadsPath, packageCandidates.Liberty.roadSource);
  assert.equal(audit.startupTransition.authorityChangedDuringStartup, false);
  assert.deepEqual(Array.from(audit.startupTransition.changedFields), []);
  assert.equal(audit.stableAuthorityPass, true);
  assert.equal(audit.overallPass, true);
  const compatibilityAudit = await runtime.window.gridlyRuntimeSourceBridgeActivation.audit('Liberty');
  assert.equal(compatibilityAudit.validation.packageCandidateAvailable, true);
  assert.equal(compatibilityAudit.validation.packageAuthorityApplied, false);
  assert.equal(compatibilityAudit.validation.stableAuthority, true);
  assert.equal(compatibilityAudit.validation.crossingPreserved, true);
  assert.equal(compatibilityAudit.finalDetermination, 'PASS_PACKAGE_CANDIDATES_AVAILABLE_STABLE_AUTHORITY_CROSSINGS_PRESERVED');
});

test('delayed warmup cannot change authority before or after completion', async () => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const runtime = makeRuntime({ bridgeAudit: () => delayed });
  const activation = runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  assert.deepEqual(authorityFields(runtime.window.gridlyGetActiveCountyRuntimeSources()), authorityFields(canonical['liberty-tx']));
  release({ finalDetermination: 'PASS_RUNTIME_PACKAGE_SOURCE_BRIDGE_READY', runtimeSources: packageCandidates.Liberty });
  await activation;
  assert.deepEqual(authorityFields(runtime.window.gridlyGetActiveCountyRuntimeSources()), authorityFields(canonical['liberty-tx']));
  assert.equal(runtime.window.gridlyRuntimeSourceAuthorityAudit().startupTransition.authorityChangedDuringStartup, false);
});

test('failed and repeated warmup never oscillate source authority', async () => {
  const failed = makeRuntime({ bridgeAudit: async () => ({ finalDetermination: 'BLOCKED_RUNTIME_PACKAGE_SOURCE_BRIDGE_NOT_READY', runtimeSources: null }) });
  await failed.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  assert.deepEqual(authorityFields(failed.window.gridlyGetActiveCountyRuntimeSources()), authorityFields(canonical['liberty-tx']));
  assert.equal(failed.window.gridlyRuntimeSourceAuthorityAudit().packageAuthorityApplied, false);

  const rejected = makeRuntime({ bridgeAudit: async () => { throw new Error('package registry unavailable'); } });
  await assert.rejects(rejected.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty'), /package registry unavailable/);
  assert.deepEqual(authorityFields(rejected.window.gridlyGetActiveCountyRuntimeSources()), authorityFields(canonical['liberty-tx']));

  const repeated = makeRuntime();
  await repeated.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  await repeated.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  assert.deepEqual(authorityFields(repeated.window.gridlyGetActiveCountyRuntimeSources()), authorityFields(canonical['liberty-tx']));
  assert.equal(repeated.window.gridlyRuntimeSourceAuthorityAudit().startupTransition.authorityChangedDuringStartup, false);
  assert.equal(repeated.window.gridlyRuntimeSourceBridgeActivation.stateSnapshot().activationRevision, 2);
});

test('Liberty to Dallas to Montgomery to Liberty retains each canonical source-family selection', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.activate('Liberty');
  for (const countyId of ['liberty-tx', 'dallas-tx', 'montgomery-tx', 'liberty-tx']) {
    runtime.setCounty(countyId);
    assert.deepEqual(authorityFields(runtime.window.gridlyGetActiveCountyRuntimeSources()), authorityFields(canonical[countyId]), countyId);
  }
  assert.equal(runtime.window.gridlyGetActiveCountyRuntimeSources().boundarySource, canonical['liberty-tx'].boundarySource);
});

test('explicit non-Liberty warmup records candidates without replacing Montgomery gzip authority', async () => {
  const runtime = makeRuntime();
  await runtime.window.gridlyRuntimeSourceBridgeActivation.warmPackageSources('Montgomery');
  runtime.setCounty('montgomery-tx');
  const effective = runtime.window.gridlyGetActiveCountyRuntimeSources();
  const audit = runtime.window.gridlyRuntimeSourceAuthorityAudit();
  assert.equal(effective.roadSource, canonical['montgomery-tx'].roadSource);
  assert.equal(audit.bridgeAuthority.roadsPath, packageCandidates.Montgomery.roadSource);
  assert.equal(audit.packageCandidateAvailable, true);
  assert.equal(audit.packageAuthorityApplied, false);
});

test('Liberty boundary metadata, credibility pathname, and road payload remain governed', () => {
  const canonicalBoundary = JSON.parse(fs.readFileSync(canonical['liberty-tx'].boundarySource, 'utf8'));
  const properties = canonicalBoundary.features[0].properties;
  assert.equal(properties.GEOID, '48291');
  assert.equal(properties.NAMELSAD, 'Liberty County');
  assert.equal(properties.boundaryCredibilityMode, 'source-library');
  assert.equal(properties.sourceLibraryPath, 'Gridly-Source-Data/Census/liberty-county-2025-wgs84.geojson');
  assert.match(appSource, /activeRuntimeBoundarySource === expectedSourceLibraryBoundaryPath/);
  assert.match(appSource, /function gridlyResolveRoadwayRuntimeSource\(/);

  const canonicalRoads = fs.readFileSync(canonical['liberty-tx'].roadSource);
  const packageRoads = fs.readFileSync(packageCandidates.Liberty.roadSource);
  assert.equal(crypto.createHash('sha256').update(canonicalRoads).digest('hex'), crypto.createHash('sha256').update(packageRoads).digest('hex'));
  assert.equal(JSON.parse(canonicalRoads).features.length, 8407);
});

test('package and governed Crossing compatibility remain wired independently of boundary and roads', async () => {
  const runtime = makeRuntime();
  const warmup = await runtime.window.gridlyRuntimeSourceBridgeActivation.warmPackageSources('Liberty');
  assert.equal(warmup.warmed, true);
  assert.equal(warmup.boundarySource, packageCandidates.Liberty.boundarySource);
  assert.equal(warmup.roadSource, packageCandidates.Liberty.roadSource);
  assert.equal(warmup.crossingSourceObservedButNotActivated, canonical['liberty-tx'].crossingSource);
  assert.equal(runtime.bridgeAudit.callCount(), 1);
  assert.match(bridgeSource, /async function resolveGovernedCrossingSource\(identity\)/);
  assert.match(bridgeSource, /sourceResolutionMode: "statewide_governed_registry"/);
  assert.match(appSource, /gridlyRuntimeSourceRegistryBridge\.resolveGovernedCrossingSource/);
});
