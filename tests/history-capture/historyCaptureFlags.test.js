const assert = require('assert');
require('../../js/history-capture/historyCaptureFlags.js');

const api = globalThis.gridlyPassiveHistoryCaptureFlags;
assert.ok(api, 'flags sidecar API is available');

const defaults = api.getHistoryCaptureFlags();
assert.deepStrictEqual(defaults, {
  captureEnabled: true,
  writesEnabled: true,
  productionHooksInstalled: true,
  historicalReadsExposed: false,
  uiExposed: false,
  passiveEvidenceCollectionMode: true,
  canaryMode: false
});
assert.notStrictEqual(defaults, api.DEFAULT_FLAGS, 'flags are returned as a defensive clone');

defaults.captureEnabled = true;
assert.strictEqual(api.getHistoryCaptureFlags().captureEnabled, true, 'capture remains enabled for passive evidence collection');
assert.strictEqual(api.getHistoryCaptureFlags().writesEnabled, true, 'writes remain enabled for passive evidence collection');
assert.strictEqual(api.getHistoryCaptureFlags().canaryMode, false, 'canary remains inactive by default');

console.log('historyCaptureFlags.test.js passed');
