(function attachHistoryCaptureEnvelope(globalScope) {
  'use strict';

  const SUPPORTED_PHASE_1A_EVENT_TYPES = Object.freeze([
    'report_created',
    'report_cleared'
  ]);

  function isSupportedPhase1AEventType(eventType) {
    return SUPPORTED_PHASE_1A_EVENT_TYPES.includes(eventType);
  }

  function safePlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...value };
  }

  function buildPhase1AEnvelope(eventType, reportSnapshot, options) {
    try {
      if (!isSupportedPhase1AEventType(eventType)) {
        return null;
      }

      const snapshot = safePlainObject(reportSnapshot);
      const safeOptions = safePlainObject(options);
      const observedAt = typeof safeOptions.observedAt === 'string'
        ? safeOptions.observedAt
        : new Date(0).toISOString();

      return Object.freeze({
        schemaVersion: 'history_capture.phase_1a.v1',
        phase: '1A',
        eventType,
        observedAt,
        source: 'passive_history_capture_sidecar',
        report: Object.freeze(snapshot),
        metadata: Object.freeze({
          passive: true,
          writesDisabled: true,
          runtimeIntegrated: false
        })
      });
    } catch (error) {
      return null;
    }
  }

  const api = Object.freeze({
    SUPPORTED_PHASE_1A_EVENT_TYPES,
    buildPhase1AEnvelope,
    isSupportedPhase1AEventType
  });

  globalScope.gridlyPassiveHistoryCaptureEnvelope = api;
})(typeof window !== 'undefined' ? window : globalThis);
