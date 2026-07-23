const assert = require('assert');
require('../../js/history-capture/historyCaptureFlags.js');
require('../../js/history-capture/historyIdentity.js');
require('../../js/history-capture/historyCaptureEnvelope.js');
require('../../js/history-capture/historyCaptureIdempotency.js');
require('../../js/history-capture/historyCaptureMonitoring.js');
require('../../js/history-capture/historyCaptureWriter.js');
require('../../js/history-capture/historyCapturePhase1A.js');

const api = globalThis.gridlyPassiveHistoryCapturePhase1A;
assert.ok(api, 'Phase 1A coordinator API is available');
assert.deepStrictEqual(api.PHASE_1A_EVENT_TYPES, ['report_created', 'report_cleared']);
assert.deepStrictEqual(api.PHASE_1A_INSTALLED_HOOKS, [
  'crossing.report_created',
  'crossing.report_cleared',
  'road_hazard.report_created',
  'road_hazard.report_cleared'
]);
assert.strictEqual(globalThis.gridlyPassiveHistoryCaptureSidecarAudit, api.auditSidecar);

const beforeCreateSharedReport = globalThis.createSharedReport;
const beforeCreateSharedHazardReport = globalThis.createSharedHazardReport;
const beforeLoadSharedReports = globalThis.loadSharedReports;

const envelope = api.buildEnvelope('report_cleared', { reportId: 'abc', reportType: 'hazard' }, { observedAt: '2026-02-03T04:05:06.000Z' });
assert.strictEqual(envelope.eventType, 'report_cleared');
assert.strictEqual(api.buildEnvelope('hazard_updated', { id: 'abc' }), null, 'unsupported events safe-fail through coordinator');
assert.match(api.getIdempotencyKey(envelope), /^phase1a:[0-9a-f]{8}$/);
assert.strictEqual(api.getIdempotencyKey(null), null);

assert.strictEqual(globalThis.createSharedReport, beforeCreateSharedReport, 'coordinator does not install createSharedReport hooks');
assert.strictEqual(globalThis.createSharedHazardReport, beforeCreateSharedHazardReport, 'coordinator does not install createSharedHazardReport hooks');
assert.strictEqual(globalThis.loadSharedReports, beforeLoadSharedReports, 'coordinator does not install read hooks');

const fakeStorageClient = {
  schema(schemaName) {
    assert.strictEqual(schemaName, 'history_capture');
    return {
      from(tableName) {
        assert.strictEqual(tableName, 'historical_events');
        return { insert: async () => ({ error: null }) };
      }
    };
  }
};

api.capturePhase1AEvent({ eventType: 'report_created', report: { id: 'abc' }, storageClient: fakeStorageClient }).then((captureResult) => {
  assert.strictEqual(captureResult.ok, true);
  assert.strictEqual(captureResult.noop, false);
  assert.strictEqual(captureResult.writesEnabled, true);
  assert.strictEqual(captureResult.reason, 'passive_history_capture_write_accepted');

  const audit = api.auditSidecar();
  assert.deepStrictEqual(audit, {
    sidecarAvailable: true,
    captureEnabled: true,
    writerEnabled: true,
    passiveEvidenceCollectionMode: true,
    hooksInstalled: true,
    installedHooks: [
      'crossing.report_created',
      'crossing.report_cleared',
      'road_hazard.report_created',
      'road_hazard.report_cleared'
    ],
    noHistoricalReadsExposed: true,
    noUiExposed: true,
    supportedEventTypesPhase1AOnly: true,
    supportedEventTypes: ['report_created', 'report_cleared'],
    runtimeIntegrated: true,
    storageArtifactsPresent: true,
    writerImplemented: true,
    monitoringImplemented: true,
    rollbackArtifactsPresent: true
  });
  assert.strictEqual(Object.isFrozen(audit), true, 'audit output is frozen');

  console.log('historyCapturePhase1A.test.js passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
