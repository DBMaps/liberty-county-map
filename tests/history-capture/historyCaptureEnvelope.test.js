const assert = require('assert');
require('../../js/history-capture/historyCaptureEnvelope.js');

const api = globalThis.gridlyPassiveHistoryCaptureEnvelope;
assert.ok(api, 'envelope sidecar API is available');
assert.deepStrictEqual(api.SUPPORTED_PHASE_1A_EVENT_TYPES, ['report_created', 'report_cleared']);
assert.strictEqual(api.isSupportedPhase1AEventType('report_created'), true);
assert.strictEqual(api.isSupportedPhase1AEventType('report_cleared'), true);
assert.strictEqual(api.isSupportedPhase1AEventType('hazard_updated'), false);

const envelope = api.buildPhase1AEnvelope('report_created', { id: 'r1', type: 'road' }, { observedAt: '2026-01-02T03:04:05.000Z' });
assert.deepStrictEqual(envelope, {
  schemaVersion: 'history_capture.phase_1a.v1',
  phase: '1A',
  eventType: 'report_created',
  observedAt: '2026-01-02T03:04:05.000Z',
  source: 'passive_history_capture_sidecar',
  report: { id: 'r1', type: 'road' },
  metadata: {
    passive: true,
    writesDisabled: true,
    runtimeIntegrated: false
  }
});
assert.strictEqual(Object.isFrozen(envelope), true, 'envelope is frozen');
assert.strictEqual(Object.isFrozen(envelope.report), true, 'report snapshot is frozen');
assert.strictEqual(Object.isFrozen(envelope.metadata), true, 'metadata is frozen');

assert.strictEqual(api.buildPhase1AEnvelope('hazard_updated', { id: 'h1' }), null, 'unsupported event safe-fails');
assert.strictEqual(api.buildPhase1AEnvelope(null, { id: 'r1' }), null, 'malformed event safe-fails');
const malformedSnapshotEnvelope = api.buildPhase1AEnvelope('report_cleared', null, null);
assert.deepStrictEqual(malformedSnapshotEnvelope.report, {}, 'malformed snapshot becomes safe empty object');
assert.strictEqual(malformedSnapshotEnvelope.metadata.passive, true);
assert.strictEqual(malformedSnapshotEnvelope.metadata.writesDisabled, true);

console.log('historyCaptureEnvelope.test.js passed');
