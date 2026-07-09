const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('js/gridlyEndToEndPerformanceAudit.js', 'utf8');
const appSource = fs.readFileSync('js/app.js', 'utf8');

assert(source.includes('completed: false'), 'runner initializes completed state');
assert(source.includes('iterationsCompleted'), 'runner reports completed iteration count');
assert(source.includes('exceptions'), 'runner exposes exceptions');
assert(source.includes('likelyOwner'), 'long-task attribution includes likely owner');
assert(source.includes('activeMeasure'), 'long-task attribution includes active measure');
assert(source.includes('listenerGroups'), 'scheduler audit returns grouped listener data');
assert(source.includes('pollingSuppressionWorking'), 'hidden-tab audit verifies suppression instead of interval existence only');
assert(!appSource.includes('console.table(alertsForRender.slice(0, 5)'), 'alerts fallback console.table is not emitted in production');

const listeners = [];
const context = {
  console: { log() { throw new Error('blank console flood detected'); }, warn() {}, debug() {}, table() { throw new Error('console.table flood detected'); } },
  Date,
  setTimeout(handler) { if (typeof handler === 'function') handler(); return 1; },
  setInterval(handler) { return 2; },
  requestAnimationFrame(handler) { if (typeof handler === 'function') handler(); return 3; },
  clearTimeout() {},
  clearInterval() {},
  performance: {
    _now: 0,
    now() { this._now += 3; return this._now; },
    mark() {},
    measure() {},
    getEntriesByType() { return []; }
  },
  navigator: { userAgent: 'node-test Mobile', hardwareConcurrency: 4, deviceMemory: 4, onLine: true },
  localStorage: { length: 0 },
  sessionStorage: { length: 0 },
  Event: function Event(type, init = {}) { this.type = type; this.bubbles = Boolean(init.bubbles); this.cancelable = Boolean(init.cancelable); },
  EventTarget: function EventTarget() {},
  PerformanceObserver: function PerformanceObserver(callback) { this.observe = () => { callback({ getEntries: () => [{ name: 'longtask', duration: 125, startTime: 1 }] }); }; },
};
context.EventTarget.prototype.addEventListener = function addEventListener(type, listener, options) { listeners.push({ type, listener, options }); };
const fakeButton = { dispatchEvent() {}, dataset: { v2Sheet: 'alerts' }, textContent: 'Alerts' };
context.document = Object.assign(new context.EventTarget(), {
  hidden: true,
  addEventListener: context.EventTarget.prototype.addEventListener,
  querySelector(selector) {
    if (selector.includes('data-v2-sheet')) return fakeButton;
    return null;
  }
});
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);

(async () => {
  const result = await context.gridlyRunPerformanceSimulation({ profile: 'unit', iterations: 3, includeReporting: true, includeAlerts: true, includeSearch: true, includeMapStress: true });
  assert.strictEqual(result.available, true, 'runner returns an available result');
  assert.strictEqual(result.completed, true, 'completed simulation is marked completed');
  assert.strictEqual(result.profile, 'unit', 'profile is persisted');
  assert(result.startedAt && result.completedAt, 'runner records timestamps');
  assert.strictEqual(result.iterationsRequested, 3, 'requested iterations are reported');
  assert(result.iterationsCompleted >= 3, 'completed iterations are counted');
  assert(result.scenarioResults.length > 0, 'scenario results are returned');
  assert(Object.keys(result.p50).length > 0, 'p50 populates after repeated samples');
  assert(Object.keys(result.p95).length > 0, 'p95 populates after repeated samples');
  assert(Array.isArray(result.exceptions), 'exceptions array is exposed');
  assert(result.longTasks.over100[0].likelyOwner, 'long tasks correlate with a likely owner');

  const summary = context.gridlyPerformanceSimulationSummary();
  assert.strictEqual(summary.hasSimulation, true, 'summary reads latest simulation');
  assert.strictEqual(summary.profile, 'unit', 'summary preserves profile');
  assert(Object.keys(summary.p95).length > 0, 'summary exposes p95');

  context.renderRoadHazards = () => { throw new Error('hazard render failure'); };
  const failed = await context.gridlyRunPerformanceSimulation({ profile: 'failed-unit', iterations: 1, includeHazards: true, includeAlerts: false, includeReporting: false, includeSearch: false, includeMapStress: false });
  assert.strictEqual(failed.completed, false, 'failed scenario marks simulation incomplete');
  assert(failed.scenarioResults.length > 0, 'failed simulation preserves partial results');
  assert(failed.exceptions.some((e) => e.scenario === 'hazard marker rendering' && e.message.includes('hazard render failure')), 'scenario exception is recorded');
  assert.strictEqual(context.gridlyPerformanceSimulationSummary().partialResultsAvailable, true, 'summary exposes partial results on failure');

  context.document.hidden = true;
  const audit = context.gridlyRuntimeSchedulerAudit();
  assert(Array.isArray(audit.listenerGroups), 'listener risks are grouped');
  assert.strictEqual(audit.hiddenTabWork.pollingSuppressionWorking, true, 'hidden skipped callbacks are not classified as executed work');
  console.log('v919r-performance-simulation-runner-repair.test.js passed');
})().catch((error) => { console.error(error); process.exit(1); });
