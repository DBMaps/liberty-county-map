const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const manifestText = fs.readFileSync('manifest.json', 'utf8');
const manifest = JSON.parse(manifestText);
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert.strictEqual(manifest.name, 'Gridly');
assert.strictEqual(manifest.short_name, 'Gridly');
assert.strictEqual(manifest.description, 'Know Before You Go');
assert(!manifestText.includes('Beta Complete'));
assert(!/preparing for launch/i.test(manifestText));
assert(app.includes('window.gridlyLp0521PwaManifestLaunchAssetAudit = function gridlyLp0521PwaManifestLaunchAssetAudit()'), 'LP052.1 audit helper exists');
assert(app.includes('exposeGridlyAuditHelper("gridlyLp0521PwaManifestLaunchAssetAudit", window.gridlyLp0521PwaManifestLaunchAssetAudit);'), 'LP052.1 audit helper is registered');
assert(serviceWorker.includes('const GRIDLY_CLOSURE_CACHE_NAME = "gridly-beta-closure-v1";'), 'service-worker strategy cache name remains unchanged');
assert(serviceWorker.includes('self.skipWaiting()'), 'service-worker lifecycle strategy remains unchanged');
assert(serviceWorker.includes('self.clients.claim()'), 'service-worker clients claim strategy remains unchanged');
assert(serviceWorker.includes('./assets/icon-180.png') && serviceWorker.includes('./assets/icon-192.png') && serviceWorker.includes('./assets/icon-512.png'), 'service-worker precache inventory reports icon additions');

const start = app.indexOf('window.gridlyLp0521PwaManifestLaunchAssetAudit = function');
const end = app.indexOf('\n\nwindow.gridlyCapacitorFoundationAudit', start);
const source = app.slice(start, end);
const links = [
  { rel: 'manifest', href: 'manifest.json' },
  { rel: 'apple-touch-icon', sizes: '180x180', href: 'assets/store/icons/gridly-icon-master-1024.png' },
  { rel: 'apple-touch-icon', sizes: '167x167', href: 'assets/icons/incoming/gridly-icon-master-167.png' },
  { rel: 'apple-touch-icon', sizes: '152x152', href: 'assets/icons/incoming/gridly-icon-master-152.png' },
  { rel: 'icon', sizes: '128x128', href: 'assets/icons/incoming/gridly-icon-master-128.png' },
  { rel: 'icon', sizes: '96x96', href: 'assets/icons/incoming/gridly-icon-master-96.png' },
  { rel: 'icon', sizes: '72x72', href: 'assets/icons/incoming/gridly-icon-master-72%20.png' },
  { rel: 'icon', sizes: '192x192', href: 'assets/store/icons/gridly-icon-master-1024.png' },
  { rel: 'icon', sizes: '512x512', href: 'assets/store/icons/gridly-icon-master-1024.png' }
];
const sandbox = { window: {}, document: { querySelector: (selector) => selector.includes('manifest') ? { getAttribute: (name) => name === 'href' ? 'manifest.json' : 'manifest' } : null, querySelectorAll: () => links.map((attrs) => ({ getAttribute: (name) => attrs[name] || '' })) } };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
assert.strictEqual(typeof sandbox.window.gridlyLp0521PwaManifestLaunchAssetAudit, 'function');
const audit = sandbox.window.gridlyLp0521PwaManifestLaunchAssetAudit();
assert.strictEqual(audit.passive, true);
assert.strictEqual(audit.manifest.name, 'Gridly');
assert.strictEqual(audit.manifest.shortName, 'Gridly');
assert.strictEqual(audit.manifest.description, 'Know Before You Go');
assert.strictEqual(audit.manifest.iconDeclarationsValid, true);
assert.strictEqual(JSON.stringify(audit.iconInventory.missingSizes), JSON.stringify([]));
assert.strictEqual(audit.appleSupport.startupImagesPresent, false);
assert.strictEqual(audit.appleSupport.startupImagesStatus, 'pending_future_milestone');
assert.strictEqual(audit.screenshots.present, false);
assert.strictEqual(audit.screenshots.status, 'pending_future_milestone');
assert.strictEqual(audit.serviceWorker.strategyUnchanged, true);
assert.strictEqual(audit.serviceWorker.precacheInventoryChanged, true);
assert.strictEqual(audit.serviceWorker.lifecycleWorkDeferred, true);
assert.strictEqual(audit.certificationStatus, 'pass');
assert.strictEqual(audit.safeToProceedToNextLp052Milestone, true);
