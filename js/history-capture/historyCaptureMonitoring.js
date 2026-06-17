(function attachHistoryCaptureMonitoring(globalScope) {
  'use strict';

  const monitoringState = {
    sidecarAvailable: true,
    maintainerOnly: true,
    auditRequestedCount: 0,
    lastAuditAt: null
  };

  function getHistoryCaptureMonitoringState() {
    try {
      return Object.freeze({ ...monitoringState });
    } catch (error) {
      return Object.freeze({
        sidecarAvailable: true,
        maintainerOnly: true,
        auditRequestedCount: 0,
        lastAuditAt: null
      });
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
    recordHistoryCaptureAudit
  });

  globalScope.gridlyPassiveHistoryCaptureMonitoring = api;
})(typeof window !== 'undefined' ? window : globalThis);
