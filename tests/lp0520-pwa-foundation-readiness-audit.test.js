const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('js/app.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert(app.includes('window.gridlyLp0520PwaFoundationReadinessAudit = function gridlyLp0520PwaFoundationReadinessAudit()'), 'LP052.0 passive PWA foundation audit exists');
assert(app.includes('exposeGridlyAuditHelper("gridlyLp0520PwaFoundationReadinessAudit", window.gridlyLp0520PwaFoundationReadinessAudit);'), 'LP052.0 audit helper is registered');
assert(app.includes('investigationOnly: true'), 'LP052.0 audit is explicitly investigation-only');
assert(app.includes('strategyUnchangedByThisAudit: true'), 'LP052.0 audit certifies no service worker strategy changes');
assert(app.includes('recommendedNextMilestone: "LP052"'), 'LP052.0 points to LP052 next');
assert(app.includes('partial_offline_shell'), 'LP052.0 documents partial offline behavior');
assert(app.includes('missingSizes: missingIconSizes'), 'LP052.0 reports missing icon sizes');
assert.strictEqual(manifest.display, 'standalone', 'manifest keeps standalone display mode');
assert.strictEqual(manifest.start_url, './', 'manifest start_url remains relative');
assert.strictEqual(manifest.scope, './', 'manifest scope remains relative');
assert(manifest.icons.some((icon) => icon.sizes === '512x512' && /maskable/.test(icon.purpose || '')), 'manifest includes a maskable 512 icon');
assert(serviceWorker.includes('const GRIDLY_CLOSURE_CACHE_NAME = "gridly-beta-closure-v1";'), 'service worker cache name unchanged');
assert(serviceWorker.includes('fetch(request, { cache: "no-store" })'), 'navigation network-first behavior unchanged');
