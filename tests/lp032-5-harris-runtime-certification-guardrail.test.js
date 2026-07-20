const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const manifestText = fs.readFileSync('data/roadway-runtime-manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);
const harris = manifest.counties['harris-tx'];

assert.strictEqual(harris.status, 'partition_runtime_integrated', 'Harris remains integrated but gated.');
assert.strictEqual(harris.integrationGateEnabled, true, 'Harris runtime gate must remain enabled.');
assert.strictEqual(harris.url, null, 'Harris must not be production-activated through a single package URL.');

assert.ok(app.includes('function gridlyLp032HarrisCertificationAudit()'), 'preferred certification helper exists.');
assert.ok(app.includes('window.gridlyLp032HarrisCertificationAudit = gridlyLp032HarrisCertificationAudit'), 'preferred certification helper is attached to window.');
assert.ok(app.includes('browserCertificationPass'), 'browser certification PASS logic is exposed.');
assert.ok(app.includes('activationReadinessPass'), 'activation readiness PASS logic is exposed.');
assert.ok(app.includes('criticalContractsPass = Object.values(contracts).every(Boolean)'), 'activation readiness depends on every critical runtime contract.');
assert.ok(app.includes('activationReadinessPass = Boolean(safeForBrowserCertification && criticalContractsPass'), 'activation readiness cannot become true while a critical contract fails.');

[
  'manifestLoading',
  'packageSelection',
  'visiblePackageCalculation',
  'neighborPrefetch',
  'boundedQueue',
  'boundedCache',
  'packageCompletion',
  'stableSegmentDeduplication',
  'canonicalOwnership',
  'countySwitchCleanup',
  'cachedReturn',
  'staleRequestSuppression',
  'geometryActivation',
  'geometryDeactivation',
  'runtimeGate',
  'runtimeReadiness'
].forEach((contract) => assert.ok(app.includes(contract), `Certification contract missing: ${contract}`));

[
  'manifestLoadDurationMs',
  'packageDownloadDurationMs',
  'packageParseDurationMs',
  'geometryAssemblyDurationMs',
  'totalActivationDurationMs',
  'cacheReuseCount',
  'cacheMissCount',
  'packagesRequested',
  'packagesReused',
  'packagesDownloaded',
  'packagesActivated',
  'packagesDeactivated',
  'geometryRebuildCount',
  'staleRequestSuppressions',
  'duplicateRequestSuppressions'
].forEach((metric) => assert.ok(app.includes(metric), `Runtime metric missing: ${metric}`));

assert.ok(!/storage\/v1\/object\/(?:upload|sign|move|copy)|createSignedUrl|upload\(/i.test(app), 'no browser upload logic exists.');
assert.ok(!/service_role|service-role|SUPABASE_SERVICE_ROLE|sb_secret|supabase[^\n]{0,120}Authorization\s*:/i.test(app + manifestText), 'no service-role credentials exist.');

console.log('LP032.5 Harris runtime certification guardrails passed');
