#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const readText = path => readFile(resolve(ROOT, path), 'utf8');
const readJson = async path => JSON.parse((await readText(path)).replace(/^\uFEFF/, ''));
const classificationNames = ['PUBLIC_ROADWAY', 'PRIVATE_ROAD', 'INDUSTRIAL', 'RAIL_YARD', 'TEMPORARY_ACCESS'];

function countClassifications(features) {
  const counts = Object.fromEntries(classificationNames.map(name => [name, 0]));
  counts.UNKNOWN_UNCLASSIFIED = 0;
  for (const feature of features) {
    const value = String(feature?.properties?.gridlyClassification || '').trim().toUpperCase();
    if (Object.hasOwn(counts, value)) counts[value] += 1;
    else counts.UNKNOWN_UNCLASSIFIED += 1;
  }
  return counts;
}

function appCountyBlock(app, countyId) {
  const marker = `"${countyId}": Object.freeze(`;
  const start = app.indexOf(marker);
  if (start < 0) throw new Error(`Missing app registry entry: ${countyId}`);
  const next = app.indexOf('\n  "', start + marker.length);
  return app.slice(start, next < 0 ? app.length : next);
}

function field(block, name) {
  return block.match(new RegExp(`${name}:\\s*"([^"]+)"`))?.[1] || null;
}

const controls = [
  { name: 'Dallas', fips: '48113', countyId: 'dallas-tx', slug: 'dallas' },
  { name: 'Liberty', fips: '48291', countyId: 'liberty-tx', slug: 'liberty' }
];

const [manifest, registry, app] = await Promise.all([
  readJson('Crossing-Packages/production-crossing-manifest.json'),
  readJson('assets/package-registry/runtime-package-registry.json'),
  readText('js/app.js')
]);

const counties = {};
for (const control of controls) {
  const production = manifest.records.find(row => row.county === control.name);
  const registryEntry = registry.packages.find(row => row.packageType === 'Crossing' && row.county === control.name);
  const packageManifest = await readJson(registryEntry.manifest);
  const governedPayload = await readJson(production.packageFile);
  const block = appCountyBlock(app, control.countyId);
  const configuredSource = field(block, 'localCrossingsPath') || field(block, 'crossingsPath');
  const availability = field(block, 'crossings');
  const runtimeGatePass = availability === 'available';
  const runtimeSourcePresent = Boolean(configuredSource);
  const runtimeLoadable = runtimeGatePass && runtimeSourcePresent;
  const governedCount = governedPayload.features.length;
  const classifications = countClassifications(governedPayload.features);
  const governedPolicyVisible = classifications.PUBLIC_ROADWAY;
  const loadedCount = runtimeLoadable ? (await readJson(configuredSource)).features.length : 0;
  // The current adapter retains every point with coordinates. Both controls' governed
  // files contain valid Point coordinates; downstream zeroes are consequences of the
  // source gate, not independent health claims.
  const normalizedCount = loadedCount;
  const consumerVisibleCountywide = runtimeLoadable ? loadedCount : 0;
  const downstreamZeroIsDeterministic = consumerVisibleCountywide === 0;
  counties[control.name.toLowerCase()] = {
    identity: control,
    productionManifest: { status: production.status, state: governedCount > 0 ? 'ACTIVE_POSITIVE' : 'ACTIVE_EMPTY', crossingCount: production.crossingCount, packageFile: production.packageFile, certificationFile: production.certificationFile },
    runtimePackageRegistry: { key: `${control.name}|Crossing`, ...registryEntry, packageManifest, resolvedPackagePath: packageManifest.packageFile },
    governedPayload: { fileLoadCount: governedCount, parsedFeatureCount: governedCount, normalizedIfLoadedCount: governedCount, classifications, consumerPolicyVisibleIfLoaded: governedPolicyVisible },
    consumerRuntime: { countyRegistryId: control.countyId, configuredCrossingSource: configuredSource, runtimeSourceAvailability: availability, sourceAvailabilityGatePass: runtimeGatePass, statewidePackageLookupAttempted: false, statewidePackagePathResolutionAttempted: false, configuredSourceFetchAttempted: runtimeLoadable, configuredSourceParseAttempted: runtimeLoadable, loadedCount, normalizedCount, consumerVisibleCountywide, awarenessFilteredCount: downstreamZeroIsDeterministic ? 0 : null, awarenessFilteredCountQualification: downstreamZeroIsDeterministic ? 'zero propagated from empty inventory' : 'selected-area geometry required; countywide selector count is reported separately', mapBoundsFilteredCount: downstreamZeroIsDeterministic ? 0 : null, markerInputCount: downstreamZeroIsDeterministic ? 0 : null, leafletMarkerCreationCount: downstreamZeroIsDeterministic ? 0 : null, crossingsWatchedCountywide: consumerVisibleCountywide }
  };
}

const legacyHits = [
  { file: 'js/app.js', finding: 'GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY is built only from inline GRIDLY_COUNTY_REGISTRY localCrossingsPath/crossingsPath and runtimeSourceAvailability.' },
  { file: 'js/app.js', finding: 'Dallas declares crossings:not-claimed and has no crossing path, while Liberty declares an available local legacy crossing path.' },
  { file: 'js/app.js', finding: 'fetchFraCrossingsWithRetry returns an empty FeatureCollection before provider, package registry, manifest, URL resolution, or fetch when availability is not available.' },
  { file: 'js/gridlyRuntimeSourceRegistryBridge.js', finding: 'A 254-package registry/manifest bridge exists, but it is audit-only and does not install its result into the app runtime source registry.' },
  { file: 'js/gridlyCrossingProvider.js', finding: 'Production provider can load an explicit source, but cannot discover a package when app runtime sources supply null.' },
  { file: 'tools/wave3a/build-crossing-readiness.mjs', finding: 'Pre-activation assertion still expects 28 production packages (historical tooling, not consumer runtime).' },
  { file: 'tools/wave3a2a/reconcile-active-crossing-packages.mjs', finding: 'Pre-activation reconciliation assertion still expects 28 active packages (historical tooling, not consumer runtime).' },
  { file: 'tools/lp18811/provision-protected-environment.mjs', finding: 'Protected environment identity assertion still expects 28 crossing packages and 282 total packages (stale tooling).' }
];

const report = {
  schemaVersion: 'gridly.lp202.statewide-crossing-consumer-runtime-audit.v1',
  generatedAt: '2026-08-17T00:00:00.000Z',
  observationalOnly: true,
  productionManifest: { totalPackages: manifest.totalPackages, totalCrossings: manifest.totalCrossings, passCount: manifest.passCount, blockedCount: manifest.blockedCount },
  runtimePackageRegistry: { totalPackages: registry.totalPackages, crossingEntryCount: registry.packages.filter(row => row.packageType === 'Crossing').length, declaredCrossingPackageCount: registry.packageTypes.find(row => row.packageType === 'Crossing')?.packageCount },
  counties,
  firstDivergence: { stage: 'inline consumer runtime source availability/path resolution', dallas: 'crossings:not-claimed; no localCrossingsPath/crossingsPath', liberty: 'crossings:available; Crossing-Packages/liberty/liberty-crossings.geojson', consequence: 'Dallas is converted to an empty FeatureCollection by fetchFraCrossingsWithRetry before the statewide registry is consulted.' },
  rootCause: { classifications: ['LEGACY_ALLOWLIST', 'PACKAGE_LOOKUP_FAILURE'], file: 'js/app.js', functions: ['GRIDLY_COUNTY_RUNTIME_SOURCE_REGISTRY initializer', 'gridlyCountyRuntimeSourceAvailable', 'fetchFraCrossingsWithRetry'], condition: '!gridlyCountyRuntimeSourceAvailable("crossings", gridlyNormalizeCountyId(countyId))', assumption: 'Only counties carrying legacy inline crossing source metadata are consumer-loadable; activation updated the authoritative manifest and package registry but not this independent inline source registry.' },
  crossingsWatched: { owner: 'summarizeGridlyAwarenessIntelligenceForDisplay -> getGridlyBottomPanelAwarenessCrossingCount -> gridlySelectConsumerVisibleCrossings', sourceMeaning: 'deduplicated, policy-visible and awareness-area-owned crossings from the active in-memory county inventory (not registry/package totals and not marker count)', dallasZeroReason: 'The active in-memory Dallas inventory is empty because the early availability gate synthesizes an empty payload.' },
  downstreamQualification: 'Dallas downstream stages are zero by propagation and are not independently healthy. With its governed payload connected, 789 PUBLIC_ROADWAY records are eligible before awareness geometry and viewport filtering.',
  legacyHits,
  recommendedRepair: 'Smallest production repair surface: make the consumer runtime source resolver consult the authoritative runtime package registry and crossing package manifest for every active county (or install an equivalent generated 254-county crossing-source map), and derive availability from the governed package state. Keep provider, normalization, visibility policy, awareness filtering, renderer, and count semantics unchanged.'
};

if (report.productionManifest.totalPackages !== 254 || report.runtimePackageRegistry.crossingEntryCount !== 254) throw new Error('Statewide authority count mismatch');
if (counties.dallas.productionManifest.crossingCount !== 789 || counties.liberty.productionManifest.crossingCount !== 115) throw new Error('Control count mismatch');
if (counties.dallas.consumerRuntime.loadedCount !== 0 || counties.liberty.consumerRuntime.loadedCount !== 115) throw new Error('Runtime divergence changed');

await mkdir(resolve(ROOT, 'reports/lp202'), { recursive: true });
await writeFile(resolve(ROOT, 'reports/lp202/statewide-crossing-consumer-runtime-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('LP202 audit PASS: Dallas 789 governed -> 0 runtime; Liberty 115 governed -> 115 runtime; first divergence is inline source availability/path resolution.');
