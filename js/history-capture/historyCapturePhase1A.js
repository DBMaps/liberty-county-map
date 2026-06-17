(function attachHistoryCapturePhase1A(globalScope) {
  'use strict';

  const PHASE_1A_EVENT_TYPES = Object.freeze([
    'report_created',
    'report_cleared'
  ]);

  function readFlags() {
    try {
      return globalScope.gridlyPassiveHistoryCaptureFlags?.getHistoryCaptureFlags?.() || {
        captureEnabled: false,
        writesEnabled: false,
        productionHooksInstalled: false,
        historicalReadsExposed: false,
        uiExposed: false
      };
    } catch (error) {
      return {
        captureEnabled: false,
        writesEnabled: false,
        productionHooksInstalled: false,
        historicalReadsExposed: false,
        uiExposed: false
      };
    }
  }

  function buildEnvelope(eventType, reportSnapshot, options) {
    try {
      return globalScope.gridlyPassiveHistoryCaptureEnvelope?.buildPhase1AEnvelope?.(
        eventType,
        reportSnapshot,
        options
      ) || null;
    } catch (error) {
      return null;
    }
  }

  function getIdempotencyKey(envelope) {
    try {
      return globalScope.gridlyPassiveHistoryCaptureIdempotency?.createPhase1AIdempotencyKey?.(envelope) || null;
    } catch (error) {
      return null;
    }
  }

  function auditSidecar() {
    try {
      globalScope.gridlyPassiveHistoryCaptureMonitoring?.recordHistoryCaptureAudit?.();
      const flags = readFlags();
      const envelopeTypes = globalScope.gridlyPassiveHistoryCaptureEnvelope?.SUPPORTED_PHASE_1A_EVENT_TYPES || PHASE_1A_EVENT_TYPES;

      return Object.freeze({
        sidecarAvailable: true,
        gatesDefaultDisabled: flags.captureEnabled === false,
        writesDisabled: flags.writesEnabled === false,
        noProductionHooksInstalled: flags.productionHooksInstalled === false,
        noHistoricalReadsExposed: flags.historicalReadsExposed === false,
        noUiExposed: flags.uiExposed === false,
        supportedEventTypesPhase1AOnly: Array.isArray(envelopeTypes)
          && envelopeTypes.length === PHASE_1A_EVENT_TYPES.length
          && PHASE_1A_EVENT_TYPES.every((eventType) => envelopeTypes.includes(eventType)),
        supportedEventTypes: Object.freeze([...envelopeTypes]),
        runtimeIntegrated: false
      });
    } catch (error) {
      return Object.freeze({
        sidecarAvailable: true,
        gatesDefaultDisabled: true,
        writesDisabled: true,
        noProductionHooksInstalled: true,
        noHistoricalReadsExposed: true,
        noUiExposed: true,
        supportedEventTypesPhase1AOnly: true,
        supportedEventTypes: PHASE_1A_EVENT_TYPES,
        runtimeIntegrated: false
      });
    }
  }

  const api = Object.freeze({
    PHASE_1A_EVENT_TYPES,
    auditSidecar,
    buildEnvelope,
    getIdempotencyKey
  });

  globalScope.gridlyPassiveHistoryCapturePhase1A = api;
  globalScope.gridlyPassiveHistoryCaptureSidecarAudit = auditSidecar;
})(typeof window !== 'undefined' ? window : globalThis);
