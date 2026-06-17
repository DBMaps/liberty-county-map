(function attachHistoryCaptureWriter(globalScope) {
  'use strict';

  function getWriterState() {
    return Object.freeze({
      writesEnabled: false,
      lastWriteAttempted: false,
      lastWriteResult: 'noop'
    });
  }

  async function writePhase1AEnvelope() {
    try {
      return Object.freeze({
        ok: true,
        noop: true,
        writesEnabled: false,
        reason: 'passive_history_capture_sidecar_writer_disabled'
      });
    } catch (error) {
      return Object.freeze({
        ok: true,
        noop: true,
        writesEnabled: false,
        reason: 'passive_history_capture_sidecar_writer_fail_open'
      });
    }
  }

  const api = Object.freeze({
    getWriterState,
    writePhase1AEnvelope
  });

  globalScope.gridlyPassiveHistoryCaptureWriter = api;
})(typeof window !== 'undefined' ? window : globalThis);
