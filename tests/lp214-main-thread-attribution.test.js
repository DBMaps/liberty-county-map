const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('js/gridlyOfficialProviderActivation.js', 'utf8');

function load(hostname) {
  let raf;
  const window = {
    location: { hostname }, performance: { now: (() => { let n = 0; return () => ++n; })() },
    requestAnimationFrame(callback) { raf = callback; return 1; },
    setTimeout(callback) { callback(); return 1; }, addEventListener() {},
    gridlyConfigurationReady: { then(callback) { callback(); } },
    gridlyDriveTexasConnector: { startPolling() {} },
    gridlyUnifiedIntelligencePrototype: { runtime() {} },
    gridlyRenderTravelBrief() {}, gridlyBriefInteractionRender() {},
    refreshGridlyCommunityPulseSharedModel() {}
  };
  vm.runInNewContext(source, { window, globalThis: window, Date, Object, Number, String, Boolean, Math });
  return { window, runFrame: () => raf?.(0) };
}

test('localhost audit is bounded and records the activation RAF without changing scheduling', () => {
  const { window, runFrame } = load('localhost');
  assert.equal(typeof window.gridlyMainThreadAttributionAudit, 'function');
  runFrame();
  const audit = window.gridlyMainThreadAttributionAudit();
  assert.equal(audit.entries.length, 1);
  assert.equal(audit.entries[0].writer, 'official-provider-activation:narrow-consumer-refresh');
  assert.equal(audit.entries[0].scheduler, 'requestAnimationFrame');
  assert.ok(audit.entries[0].duration >= 0);
});

test('production host exposes no attribution recorder', () => {
  const { window } = load('gridly.example');
  assert.equal(window.gridlyMainThreadAttributionAudit, undefined);
  assert.equal(window.gridlyRecordMainThreadAttribution, undefined);
});
