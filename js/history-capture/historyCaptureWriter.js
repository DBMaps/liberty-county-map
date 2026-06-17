(function attachHistoryCaptureWriter(globalScope) {
  'use strict';

  const WRITER_DISABLED_REASON = 'passive_history_capture_sidecar_writer_disabled';
  const WRITER_FAIL_OPEN_REASON = 'passive_history_capture_sidecar_writer_fail_open';
  const MALFORMED_REASON = 'passive_history_capture_malformed_envelope';
  const DUPLICATE_REASON = 'passive_history_capture_duplicate_suppressed';
  const WRITE_SUCCESS_REASON = 'passive_history_capture_write_accepted';
  const WRITE_FAILURE_REASON = 'passive_history_capture_write_failed';
  const SUPPORTED_EVENT_TYPES = Object.freeze(['report_created', 'report_cleared']);
  const attemptedKeys = new Set();
  const writerState = {
    writesEnabled: false,
    lastWriteAttempted: false,
    lastWriteResult: 'noop',
    lastReason: WRITER_DISABLED_REASON,
    duplicateSuppressionCount: 0,
    writeFailureCount: 0,
    writeSuccessCount: 0,
    malformedCount: 0
  };

  function freezeResult(result) {
    try { return Object.freeze(result); } catch (error) { return result; }
  }

  function recordMonitoring(eventType, detail) {
    try {
      globalScope.gridlyPassiveHistoryCaptureMonitoring?.recordHistoryCaptureWriterEvent?.(eventType, detail);
    } catch (error) {
      try {
        globalScope.gridlyPassiveHistoryCaptureMonitoring?.recordHistoryCaptureWriterEvent?.('sidecar_failure', {
          reason: 'monitoring_record_failed'
        });
      } catch (nestedError) {}
    }
  }

  function getWriterState() {
    try {
      return Object.freeze({ ...writerState });
    } catch (error) {
      return Object.freeze({
        writesEnabled: false,
        lastWriteAttempted: false,
        lastWriteResult: 'noop',
        lastReason: WRITER_DISABLED_REASON,
        duplicateSuppressionCount: 0,
        writeFailureCount: 0,
        writeSuccessCount: 0,
        malformedCount: 0
      });
    }
  }

  function isPlainObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function validateEnvelope(envelope) {
    if (!isPlainObject(envelope)) return false;
    if (envelope.schemaVersion !== 'history_capture.phase_1a.v1') return false;
    if (envelope.phase !== '1A') return false;
    if (!SUPPORTED_EVENT_TYPES.includes(envelope.eventType)) return false;
    if (typeof envelope.observedAt !== 'string' || !envelope.observedAt) return false;
    if (!isPlainObject(envelope.report)) return false;
    return true;
  }

  function writerExplicitlyEnabled(options) {
    try {
      return options?.writerEnabled === true;
    } catch (error) {
      return false;
    }
  }

  function getStorageClient(options) {
    try {
      if (options?.storageClient && typeof options.storageClient.from === 'function') return options.storageClient;
      return null;
    } catch (error) {
      return null;
    }
  }

  function buildRow(envelope, idempotencyKey, options) {
    return {
      schema_version: envelope.schemaVersion,
      phase: envelope.phase,
      event_type: envelope.eventType,
      source_kind: typeof envelope.report?.reportType === 'string' ? envelope.report.reportType : null,
      source_report_id: envelope.report?.id || envelope.report?.reportId || envelope.report?.uuid || null,
      idempotency_key: idempotencyKey,
      observed_at: envelope.observedAt,
      hook_name: typeof options?.hook === 'string' ? options.hook : null,
      envelope,
      payload: envelope.report || {},
      metadata: envelope.metadata || {}
    };
  }

  async function writePhase1AEnvelope(envelope, options) {
    try {
      recordMonitoring('capture_attempt', { phase: '1A' });
      writerState.writesEnabled = writerExplicitlyEnabled(options);

      if (writerState.writesEnabled !== true) {
        writerState.lastWriteAttempted = false;
        writerState.lastWriteResult = 'noop';
        writerState.lastReason = WRITER_DISABLED_REASON;
        recordMonitoring('writer_disabled', { reason: WRITER_DISABLED_REASON });
        return freezeResult({ ok: true, noop: true, writesEnabled: false, reason: WRITER_DISABLED_REASON });
      }

      if (!validateEnvelope(envelope)) {
        writerState.lastWriteAttempted = false;
        writerState.lastWriteResult = 'malformed';
        writerState.lastReason = MALFORMED_REASON;
        writerState.malformedCount += 1;
        recordMonitoring('malformed_payload', { reason: MALFORMED_REASON });
        return freezeResult({ ok: true, noop: true, writesEnabled: true, reason: MALFORMED_REASON });
      }

      const idempotencyKey = typeof options?.idempotencyKey === 'string' && options.idempotencyKey
        ? options.idempotencyKey
        : globalScope.gridlyPassiveHistoryCaptureIdempotency?.createPhase1AIdempotencyKey?.(envelope);

      if (!idempotencyKey) {
        writerState.lastWriteAttempted = false;
        writerState.lastWriteResult = 'malformed';
        writerState.lastReason = MALFORMED_REASON;
        writerState.malformedCount += 1;
        recordMonitoring('malformed_payload', { reason: 'missing_idempotency_key' });
        return freezeResult({ ok: true, noop: true, writesEnabled: true, reason: MALFORMED_REASON });
      }

      if (attemptedKeys.has(idempotencyKey)) {
        writerState.lastWriteAttempted = false;
        writerState.lastWriteResult = 'duplicate_suppressed';
        writerState.lastReason = DUPLICATE_REASON;
        writerState.duplicateSuppressionCount += 1;
        recordMonitoring('duplicate_suppression', { idempotencyKey });
        return freezeResult({ ok: true, noop: true, writesEnabled: true, duplicate: true, reason: DUPLICATE_REASON });
      }
      attemptedKeys.add(idempotencyKey);

      const storageClient = getStorageClient(options);
      if (!storageClient) throw new Error('history capture storage client unavailable');

      writerState.lastWriteAttempted = true;
      const insertResult = await storageClient
        .from('history_capture.historical_events')
        .insert(buildRow(envelope, idempotencyKey, options));

      if (insertResult?.error) throw insertResult.error;

      writerState.lastWriteResult = 'success';
      writerState.lastReason = WRITE_SUCCESS_REASON;
      writerState.writeSuccessCount += 1;
      recordMonitoring('write_success', { idempotencyKey });
      return freezeResult({ ok: true, noop: false, writesEnabled: true, idempotencyKey, reason: WRITE_SUCCESS_REASON });
    } catch (error) {
      writerState.lastWriteResult = 'fail_open';
      writerState.lastReason = WRITE_FAILURE_REASON;
      writerState.writeFailureCount += 1;
      recordMonitoring('write_failure', { reason: WRITE_FAILURE_REASON });
      return freezeResult({ ok: true, noop: true, writesEnabled: writerState.writesEnabled === true, reason: WRITER_FAIL_OPEN_REASON });
    }
  }

  const api = Object.freeze({
    getWriterState,
    writePhase1AEnvelope
  });

  globalScope.gridlyPassiveHistoryCaptureWriter = api;
})(typeof window !== 'undefined' ? window : globalThis);
