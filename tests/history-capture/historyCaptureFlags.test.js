const assert = require('assert');
require('../../js/history-capture/historyCaptureFlags.js');

const api = globalThis.gridlyPassiveHistoryCaptureFlags;
assert.ok(api, 'flags sidecar API is available');

const defaults = api.getHistoryCaptureFlags();
assert.deepStrictEqual(defaults, {
  captureEnabled: false,
  writesEnabled: false,
  productionHooksInstalled: false,
  historicalReadsExposed: false,
  uiExposed: false
});
assert.notStrictEqual(defaults, api.DEFAULT_FLAGS, 'flags are returned as a defensive clone');

defaults.captureEnabled = true;
assert.strictEqual(api.getHistoryCaptureFlags().captureEnabled, false, 'capture remains disabled by default');
assert.strictEqual(api.getHistoryCaptureFlags().writesEnabled, false, 'writes remain disabled by default');

console.log('historyCaptureFlags.test.js passed');
