const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const app = fs.readFileSync('js/app.js', 'utf8');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');

assert(app.includes('window.gridlyLp0522UpdateLifecycleAudit = function gridlyLp0522UpdateLifecycleAudit()'), 'LP052.2 passive update lifecycle audit exists');
assert(app.includes('exposeGridlyAuditHelper("gridlyLp0522UpdateLifecycleAudit", window.gridlyLp0522UpdateLifecycleAudit);'), 'LP052.2 audit helper is registered');
assert(app.includes('gridlyShowPwaUpdateAvailable'), 'update notification helper is present');
assert(app.includes('A new version of Gridly is available.'), 'consumer-friendly update messaging exists');
assert(app.includes('Update now for the latest improvements.'), 'update message avoids service-worker/cache terminology');
assert(app.includes('gridlyIsActiveSubmissionInProgress()'), 'update apply flow checks active submissions before reload');
assert(app.includes('gridlyPwaInstallReadinessState.autoPromptPrevented = true'), 'install workflow still prevents automatic browser banners');
assert(app.includes('gridlyHandlePwaInstallButtonClick'), 'user-initiated install button workflow is preserved');
assert(app.includes('gridlyIsStandaloneMode()'), 'standalone launch detection remains in use');

assert(serviceWorker.includes('const GRIDLY_SW_VERSION = "lp052.2-update-lifecycle";'), 'service worker exposes lightweight LP052.2 version identifier');
assert(serviceWorker.includes('const GRIDLY_CLOSURE_CACHE_NAME = "gridly-pwa-shell-lp0522-v1";'), 'cache name safely advances out of beta-era naming');
assert(serviceWorker.includes('fetch(request, { cache: "no-store" })'), 'navigation network-first strategy remains valid');
assert(serviceWorker.includes('caches.delete(cacheName)'), 'obsolete cache cleanup remains active');
assert(serviceWorker.includes('GRIDLY_GET_SW_VERSION'), 'service worker supports passive version inspection');
assert(serviceWorker.includes('GRIDLY_SKIP_WAITING'), 'service worker supports user-requested update activation');
assert(!serviceWorker.includes('setInterval'), 'service worker does not introduce polling');

const stateStart = app.indexOf('const gridlyPwaInstallReadinessState = {');
const stateEnd = app.indexOf('\n\nfunction gridlyIsActiveSubmissionInProgress', stateStart);
const helperStart = app.indexOf('function gridlyIsActiveSubmissionInProgress');
const helperEnd = app.indexOf('\n\nfunction gridlyBindPwaInstallUx', helperStart);
const auditStart = app.indexOf('window.gridlyLp0522UpdateLifecycleAudit = function');
const auditEnd = app.indexOf('\n\nwindow.gridlyCapacitorFoundationAudit', auditStart);
const source = [app.slice(stateStart, stateEnd), app.slice(helperStart, helperEnd), app.slice(auditStart, auditEnd)].join('\n');
const sandbox = {
  window: {},
  navigator: { serviceWorker: { addEventListener() {}, removeEventListener() {}, controller: {} } },
  document: {
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute() {}, style: {}, hidden: true, querySelector: () => null }),
    body: { appendChild() {} }
  }
};
sandbox.window = sandbox;
sandbox.window.matchMedia = () => ({ matches: false });
sandbox.window.addEventListener = () => {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
assert.strictEqual(typeof sandbox.window.gridlyLp0522UpdateLifecycleAudit, 'function');
const audit = sandbox.window.gridlyLp0522UpdateLifecycleAudit();
assert.strictEqual(audit.passive, true);
assert.strictEqual(audit.updateLifecycle.updateDetection, true);
assert.strictEqual(audit.updateLifecycle.userNotification, true);
assert.strictEqual(audit.updateLifecycle.forcedReloadsAvoided, true);
assert.strictEqual(audit.cacheManagement.strategyPreserved, true);
assert.strictEqual(audit.cacheManagement.obsoleteCachesHandled, true);
assert.strictEqual(audit.offlineBoundary.offlineFirstAttempted, false);
assert.strictEqual(audit.blockers.length, 0);
assert.strictEqual(audit.certificationStatus, 'pass');
assert.strictEqual(audit.recommendedNextMilestone, 'LP052.3');

assert(!app.includes('lp0522-protected-system-mutation-sentinel'), 'protected systems unchanged by LP052.2 regression sentinel');

console.log('lp0522-pwa-update-lifecycle-audit.test.js passed');
