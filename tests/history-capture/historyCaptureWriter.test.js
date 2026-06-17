const assert = require('assert');
require('../../js/history-capture/historyCaptureWriter.js');

(async () => {
  let supabaseCalls = 0;
  globalThis.supabase = new Proxy({}, {
    get() {
      supabaseCalls += 1;
      throw new Error('Supabase must not be touched by passive history writer tests');
    }
  });

  const api = globalThis.gridlyPassiveHistoryCaptureWriter;
  assert.deepStrictEqual(api.getWriterState(), {
    writesEnabled: false,
    lastWriteAttempted: false,
    lastWriteResult: 'noop'
  });

  const result = await api.writePhase1AEnvelope({ any: 'payload' });
  assert.deepStrictEqual(result, {
    ok: true,
    noop: true,
    writesEnabled: false,
    reason: 'passive_history_capture_sidecar_writer_disabled'
  });
  assert.strictEqual(supabaseCalls, 0, 'writer performs no Supabase calls');
  delete globalThis.supabase;
  console.log('historyCaptureWriter.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
