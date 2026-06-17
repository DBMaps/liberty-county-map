(function attachHistoryCaptureMonitoring(globalScope) {
  'use strict';

  const monitoringState = {
    sidecarAvailable: true,
    maintainerOnly: true,
    auditRequestedCount: 0,
    lastAuditAt: null,
    captureAttemptCount: 0,
    disabledCaptureCount: 0,
    malformedPayloadCount: 0,
    duplicateSuppressionCount: 0,
    writeFailureCount: 0,
    writerDisabledCount: 0,
    sidecarFailureCount: 0,
    writeSuccessCount: 0,
    lastEventType: null,
    lastEventAt: null
  };

  const eventCounters = Object.freeze({
    capture_attempt: 'captureAttemptCount',
    disabled_capture: 'disabledCaptureCount',
    malformed_payload: 'malformedPayloadCount',
    duplicate_suppression: 'duplicateSuppressionCount',
    write_failure: 'writeFailureCount',
    writer_disabled: 'writerDisabledCount',
    sidecar_failure: 'sidecarFailureCount',
    write_success: 'writeSuccessCount'
  });

  function snapshotState() {
    return {
      sidecarAvailable: true,
      maintainerOnly: true,
      auditRequestedCount: monitoringState.auditRequestedCount,
      lastAuditAt: monitoringState.lastAuditAt,
      captureAttemptCount: monitoringState.captureAttemptCount,
      disabledCaptureCount: monitoringState.disabledCaptureCount,
      malformedPayloadCount: monitoringState.malformedPayloadCount,
      duplicateSuppressionCount: monitoringState.duplicateSuppressionCount,
      writeFailureCount: monitoringState.writeFailureCount,
      writerDisabledCount: monitoringState.writerDisabledCount,
      sidecarFailureCount: monitoringState.sidecarFailureCount,
      writeSuccessCount: monitoringState.writeSuccessCount,
      lastEventType: monitoringState.lastEventType,
      lastEventAt: monitoringState.lastEventAt
    };
  }

  function getHistoryCaptureMonitoringState() {
    try {
      return Object.freeze(snapshotState());
    } catch (error) {
      return Object.freeze({
        sidecarAvailable: true,
        maintainerOnly: true,
        auditRequestedCount: 0,
        lastAuditAt: null,
        captureAttemptCount: 0,
        disabledCaptureCount: 0,
        malformedPayloadCount: 0,
        duplicateSuppressionCount: 0,
        writeFailureCount: 0,
        writerDisabledCount: 0,
        sidecarFailureCount: 0,
        writeSuccessCount: 0,
        lastEventType: null,
        lastEventAt: null
      });
    }
  }

  function recordHistoryCaptureWriterEvent(eventType) {
    try {
      const key = eventCounters[eventType];
      if (key) monitoringState[key] += 1;
      monitoringState.lastEventType = key ? eventType : 'sidecar_failure';
      monitoringState.lastEventAt = new Date().toISOString();
      if (!key) monitoringState.sidecarFailureCount += 1;
      return getHistoryCaptureMonitoringState();
    } catch (error) {
      return getHistoryCaptureMonitoringState();
    }
  }

  function recordHistoryCaptureAudit() {
    try {
      monitoringState.auditRequestedCount += 1;
      monitoringState.lastAuditAt = new Date().toISOString();
      return getHistoryCaptureMonitoringState();
    } catch (error) {
      return getHistoryCaptureMonitoringState();
    }
  }

  const api = Object.freeze({
    getHistoryCaptureMonitoringState,
    recordHistoryCaptureAudit,
    recordHistoryCaptureWriterEvent
  });

  globalScope.gridlyPassiveHistoryCaptureMonitoring = api;
})(typeof window !== 'undefined' ? window : globalThis);
