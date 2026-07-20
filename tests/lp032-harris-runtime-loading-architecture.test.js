const assert = require('assert');
const fs = require('fs');

const doc = fs.readFileSync('docs/LP032-HARRIS-RUNTIME-LOADING-ARCHITECTURE.md', 'utf8');
const manifest = JSON.parse(fs.readFileSync('data/roadway-runtime-manifest.json', 'utf8'));
const app = fs.readFileSync('js/app.js', 'utf8');
const analyzer = fs.readFileSync('scripts/Analyze-HarrisRoadwayPartitioning.ps1', 'utf8');

assert.equal(manifest.counties['harris-tx'].status, 'partition_runtime_integrated', 'Harris partition runtime is integrated behind a gate.');
assert.equal(manifest.counties['harris-tx'].url, null, 'Harris URL must remain null.');
assert.match(app, /function gridlyResolveRoadwayRuntimeSource/, 'LP031 single-package resolver must remain present.');
assert.match(app, /gridlyLp032HarrisPartitionRuntimeAudit/, 'LP032 Harris partition runtime audit is implemented.');
assert.match(analyzer, /TargetPackageSizesMb = @\(5, 10, 12, 15, 20\)/, 'Analyzer must expose target-size candidates.');
assert.match(analyzer, /estimate_only_not_spatial_grouping/, 'Analyzer target-size results must be labeled estimates.');

[
  'Executive decision',
  'Existing lifecycle trace',
  'Initial package-selection algorithm',
  'Community-to-package contract',
  'Map-bounds selection policy',
  'Package state machine',
  'Cache and in-flight architecture',
  'Concurrency and queue limits',
  'Eviction policy',
  'Active roadway view design',
  'Boundary deduplication contract',
  'Remote manifest lifecycle',
  'Focus-target package loading',
  'Failure and partial-readiness policy',
  'Future audit contract',
  'Exact LP032 phase boundaries',
  'Implementation pseudocode'
].forEach((heading) => assert(doc.includes(heading), `Architecture doc missing ${heading}`));

[
  'available', 'activeCountyId', 'harrisRuntimeStatus', 'countyVersion', 'remoteManifestStatus',
  'remoteManifestUrl', 'remoteManifestVersion', 'selectedCommunity', 'mapBounds', 'selectionReason',
  'requiredPackageIds', 'visibleBoundsPackageIds', 'prefetchPackageIds', 'queuedPackageIds',
  'loadingPackageIds', 'loadedPackageIds', 'failedPackageIds', 'activePackageIds', 'cachedPackageIds',
  'evictedPackageIds', 'activePackageCount', 'activeFeatureCount', 'dedupedFeatureCount',
  'duplicateSuppressedCount', 'concurrentRequestCount', 'cacheHitCount', 'staleRequestSuppressedCount',
  'lastSelectionStarted', 'lastSelectionCompleted', 'partialReadiness', 'legacyLibertyFallbackUsed',
  'lastError', 'pass'
].forEach((field) => assert(doc.includes(`\`${field}\``), `Audit contract missing ${field}`));

assert(!doc.includes('legacyLibertyFallbackUsed`, `lastError`, `pass`') || doc.includes('Never fall back to Liberty for Harris'), 'Doc must prohibit Liberty fallback.');
console.log('LP032.1A Harris runtime loading architecture contract checks passed.');
