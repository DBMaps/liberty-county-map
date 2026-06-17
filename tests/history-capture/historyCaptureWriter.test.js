const assert = require('assert');
require('../../js/history-capture/historyCaptureMonitoring.js');
require('../../js/history-capture/historyCaptureIdempotency.js');
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
  assert.strictEqual(api.getWriterState().writesEnabled, false);
  assert.strictEqual(api.getWriterState().lastWriteAttempted, false);
  assert.deepStrictEqual(api.getWriterDiagnostic(), {
    available: true,
    lastFailureAt: null,
    canaryStopReason: null,
    safeForFixAnalysis: true
  });
  assert.deepStrictEqual(api.getLastFailureDiagnostic(), api.getWriterDiagnostic());

  const disabledResult = await api.writePhase1AEnvelope({ any: 'payload' });
  assert.deepStrictEqual(disabledResult, {
    ok: true,
    noop: true,
    writesEnabled: false,
    reason: 'passive_history_capture_sidecar_writer_disabled'
  });
  assert.strictEqual(supabaseCalls, 0, 'writer performs no global Supabase calls while disabled');

  const malformedResult = await api.writePhase1AEnvelope({ any: 'payload' }, { writerEnabled: true });
  assert.deepStrictEqual(malformedResult, {
    ok: true,
    noop: true,
    writesEnabled: true,
    reason: 'passive_history_capture_malformed_envelope'
  });

  const envelope = Object.freeze({
    schemaVersion: 'history_capture.phase_1a.v1',
    phase: '1A',
    eventType: 'report_created',
    observedAt: '2026-06-17T00:00:00.000Z',
    report: Object.freeze({ id: 'writer-test-1', reportType: 'crossing' }),
    metadata: Object.freeze({ passive: true })
  });
  const inserts = [];
  const schemaCalls = [];
  const fromCalls = [];
  const storageClient = {
    from() {
      throw new Error('writer must not use default-schema from() for history_capture');
    },
    schema(schemaName) {
      schemaCalls.push(schemaName);
      assert.strictEqual(schemaName, 'history_capture');
      return {
        from(table) {
          fromCalls.push(table);
          assert.strictEqual(table, 'historical_events');
          return {
            async insert(row) {
              inserts.push(row);
              return { data: null, error: null };
            }
          };
        }
      };
    }
  };

  const successResult = await api.writePhase1AEnvelope(envelope, {
    writerEnabled: true,
    storageClient,
    idempotencyKey: 'phase1a:test-success',
    hook: 'crossing.report_created'
  });
  assert.strictEqual(successResult.ok, true);
  assert.strictEqual(successResult.noop, false);
  assert.strictEqual(successResult.reason, 'passive_history_capture_write_accepted');
  assert.deepStrictEqual(schemaCalls, ['history_capture']);
  assert.deepStrictEqual(fromCalls, ['historical_events']);
  assert.strictEqual(inserts.length, 1);

  const duplicateResult = await api.writePhase1AEnvelope(envelope, {
    writerEnabled: true,
    storageClient,
    idempotencyKey: 'phase1a:test-success'
  });
  assert.deepStrictEqual(duplicateResult, {
    ok: true,
    noop: true,
    writesEnabled: true,
    duplicate: true,
    reason: 'passive_history_capture_duplicate_suppressed'
  });
  assert.strictEqual(inserts.length, 1, 'duplicate key does not write twice');

  const failureResult = await api.writePhase1AEnvelope({ ...envelope, report: { id: 'writer-test-2' } }, {
    writerEnabled: true,
    idempotencyKey: 'phase1a:test-failure',
    storageClient: {
      schema(schemaName) {
        assert.strictEqual(schemaName, 'history_capture');
        return {
          from(table) {
            assert.strictEqual(table, 'historical_events');
            return {
              async insert() {
                const error = new Error('sidecar storage failure');
                error.code = 'PGRST106';
                error.details = 'schema not exposed';
                error.hint = 'Check exposed schemas';
                error.status = 404;
                throw error;
              }
            };
          }
        };
      }
    }
  });
  assert.strictEqual(failureResult.ok, true);
  assert.strictEqual(failureResult.noop, true);
  assert.strictEqual(failureResult.writesEnabled, true);
  assert.strictEqual(failureResult.reason, 'passive_history_capture_sidecar_writer_fail_open');
  assert.strictEqual(failureResult.writerDiagnostic.available, true);
  assert.strictEqual(failureResult.writerDiagnostic.writerStage, 'write_attempt');
  assert.strictEqual(failureResult.writerDiagnostic.storageStage, 'historical_events_insert');
  assert.strictEqual(failureResult.writerDiagnostic.errorMessage, 'sidecar storage failure');
  assert.strictEqual(failureResult.writerDiagnostic.errorCode, 'PGRST106');
  assert.strictEqual(failureResult.writerDiagnostic.errorDetails, 'schema not exposed');
  assert.strictEqual(failureResult.writerDiagnostic.errorHint, 'Check exposed schemas');
  assert.strictEqual(failureResult.writerDiagnostic.errorStatus, '404');
  assert.strictEqual(failureResult.writerDiagnostic.exceptionName, 'Error');
  assert.strictEqual(failureResult.writerDiagnostic.canaryStopReason, 'writer_error');
  assert.strictEqual(failureResult.writerDiagnostic.safeForFixAnalysis, true);
  assert.deepStrictEqual(api.getLastFailureDiagnostic(), failureResult.writerDiagnostic);

  const monitoring = globalThis.gridlyPassiveHistoryCaptureMonitoring.getHistoryCaptureMonitoringState();
  assert.ok(monitoring.captureAttemptCount >= 5);
  assert.ok(monitoring.writerDisabledCount >= 1);
  assert.ok(monitoring.malformedPayloadCount >= 1);
  assert.ok(monitoring.duplicateSuppressionCount >= 1);
  assert.ok(monitoring.writeFailureCount >= 1);
  assert.ok(monitoring.writeSuccessCount >= 1);

  delete globalThis.supabase;
  console.log('historyCaptureWriter.test.js passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
