const assert = require('assert');
require('../../js/history-capture/historyCaptureMonitoring.js');
require('../../js/history-capture/historyCaptureIdempotency.js');
require('../../js/history-capture/historyCaptureWriter.js');
// LP244.21 replaces legacy success/failure/duplicate write outcomes with a hard
// closure. Even explicit overrides must never reach storage or diagnostic errors.
(async () => {
  let calls = 0;
  const storageClient = new Proxy({}, {get(){calls++;throw new Error('Must never access storage');}});
  globalThis.supabase = storageClient;
  const api=globalThis.gridlyPassiveHistoryCaptureWriter;
  const envelope={schemaVersion:'history_capture.phase_1a.v1',phase:'1A',eventType:'report_created',report:{id:'synthetic'},metadata:{passive:true}};
  for(const payload of [null,{any:'malformed'},envelope,envelope]) {
    for(const writerEnabled of [false,true]) {
      const result=await api.writePhase1AEnvelope(payload,{writerEnabled,storageClient,idempotencyKey:'same-key'});
      assert.deepStrictEqual(result,{ok:true,noop:true,writesEnabled:false,reason:'passive_history_capture_sidecar_writer_disabled'});
    }
  }
  assert.equal(calls,0);
  assert.equal(api.getWriterState().lastWriteAttempted,false);
  assert.equal(api.getWriterState().writeSuccessCount,0);
  assert.deepStrictEqual(api.getWriterDiagnostic(),{available:true,lastFailureAt:null,canaryStopReason:null,safeForFixAnalysis:true});
  assert.deepStrictEqual(api.getLastFailureDiagnostic(),api.getWriterDiagnostic());
  delete globalThis.supabase;
})().catch(error=>{console.error(error);process.exitCode=1;});
