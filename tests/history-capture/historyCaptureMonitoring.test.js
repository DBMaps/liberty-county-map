const assert = require('assert');
require('../../js/history-capture/historyCaptureMonitoring.js');

const api = globalThis.gridlyPassiveHistoryCaptureMonitoring;
const before = api.getHistoryCaptureMonitoringState();
assert.strictEqual(before.sidecarAvailable, true);
assert.strictEqual(before.maintainerOnly, true);
assert.strictEqual(before.auditRequestedCount, 0);
assert.strictEqual(before.lastAuditAt, null);
assert.strictEqual(Object.isFrozen(before), true, 'monitoring state is frozen');

const after = api.recordHistoryCaptureAudit();
assert.strictEqual(after.sidecarAvailable, true);
assert.strictEqual(after.maintainerOnly, true);
assert.strictEqual(after.auditRequestedCount, 1);
assert.match(after.lastAuditAt, /^\d{4}-\d{2}-\d{2}T/);
assert.strictEqual(after.captureAttemptCount, 0);
const writerEvent = api.recordHistoryCaptureWriterEvent('writer_disabled');
assert.strictEqual(writerEvent.writerDisabledCount, 1);
assert.strictEqual(writerEvent.lastEventType, 'writer_disabled');

console.log('historyCaptureMonitoring.test.js passed');
