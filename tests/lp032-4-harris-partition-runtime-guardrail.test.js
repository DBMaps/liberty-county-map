const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const manifestText = fs.readFileSync('data/roadway-runtime-manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);
const harris = manifest.counties['harris-tx'];
const originalExternalCounties = ['chambers-tx', 'jefferson-tx', 'hardin-tx', 'polk-tx', 'walker-tx', 'orange-tx', 'jasper-tx', 'newton-tx', 'tyler-tx', 'galveston-tx', 'brazoria-tx', 'fort-bend-tx', 'waller-tx', 'austin-tx', 'washington-tx', 'brazos-tx', 'grimes-tx', 'wharton-tx', 'colorado-tx', 'fayette-tx', 'lavaca-tx', 'jackson-tx', 'matagorda-tx', 'calhoun-tx'];

assert.strictEqual(harris.status, 'partition_runtime_integrated', 'Harris uses partition runtime integration state');
assert.strictEqual(harris.url, null, 'Harris does not use a single county package URL');
assert.strictEqual(harris.integrationGateEnabled, true, 'Harris integration gate remains enabled');
assert.strictEqual(harris.packageVersion, 'lp032.2', 'Harris package version is LP032.2');
assert.ok(harris.manifestUrl.endsWith('/roadways/harris-tx/lp032.2/manifest.json'), 'Harris uses a partition manifest URL');
assert.ok(app.includes('GRIDLY_HARRIS_PARTITION_RUNTIME_COUNTY_ID = "harris-tx"'), 'runtime is explicitly Harris-only');
assert.ok(app.includes('GRIDLY_HARRIS_PARTITION_RUNTIME_CONCURRENCY_LIMIT'), 'bounded queue concurrency exists');
assert.ok(app.includes('GRIDLY_HARRIS_PARTITION_RUNTIME_CACHE_LIMIT'), 'bounded package cache exists');
assert.ok(app.includes('state.queue.sort((a, b) => a.priority - b.priority)'), 'request queue prioritizes visible packages');
assert.ok(app.includes('state.activeGeneration') && app.includes('staleRequestSuppressions'), 'stale-request protection exists');
assert.ok(app.includes('gridlyGetHarrisSegmentId') && app.includes('stableSegmentId'), 'stable segment-ID deduplication exists');
assert.ok(app.includes('gridlyHarrisPackageOwnsSegment') && app.includes('canonicalOwnerPackageId'), 'canonical ownership is respected');
assert.ok(app.includes('gridlyScheduleHarrisPartitionVisibleBoundsLoad'), 'visible-bounds loader is installed');
assert.ok(app.includes('prefetchReasonByPackage') && app.includes('neighbors'), 'edge-neighbor prefetch is audited from manifest neighbors');
assert.ok(app.includes('gridlyLp032HarrisPartitionRuntimeAudit'), 'audit helper is exposed');
assert.ok(app.includes('window.gridlyLp032HarrisPartitionRuntimeAudit = gridlyLp032HarrisPartitionRuntimeAudit'), 'browser audit helper is attached');
assert.ok(!/harris-tx[\s\S]{0,220}data\/liberty-county-road-segments\.geojson/.test(app), 'no Liberty fallback is introduced for Harris');
assert.ok(!/service_role|service-role|SUPABASE_SERVICE_ROLE|sb_secret|supabase[^\n]{0,120}Authorization\s*:/i.test(app + manifestText), 'no Supabase credentials or authorization secret are embedded');
assert.ok(!/storage\/v1\/object\/(?:upload|sign|move|copy)|createSignedUrl|upload\(/i.test(app), 'no Supabase upload code is added to browser runtime');
originalExternalCounties.forEach((countyId) => {
  assert.strictEqual(manifest.counties[countyId].status, 'external_runtime', `${countyId} remains external runtime`);
  assert.ok(manifest.counties[countyId].url.includes(`/roadways/${countyId}/lp030-v1/`), `${countyId} external URL remains unchanged`);
});

console.log('LP032.4 Harris partition runtime static guardrail tests passed');
