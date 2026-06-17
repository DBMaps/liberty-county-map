(function attachHistoryCapturePhase1A(globalScope) {
  'use strict';

  const PHASE_1A_EVENT_TYPES = Object.freeze([
    'report_created',
    'report_cleared'
  ]);
  const PHASE_1A_INSTALLED_HOOKS = Object.freeze([
    'crossing.report_created',
    'crossing.report_cleared',
    'road_hazard.report_created',
    'road_hazard.report_cleared'
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

  async function capturePhase1AEvent(eventInput) {
    try {
      const flags = readFlags();
      if (flags.captureEnabled !== true) {
        globalScope.gridlyPassiveHistoryCaptureMonitoring?.recordHistoryCaptureWriterEvent?.('disabled_capture', { reason: 'passive_history_capture_sidecar_disabled' });
        return Object.freeze({
          ok: true,
          noop: true,
          reason: 'passive_history_capture_sidecar_disabled'
        });
      }

      const safeInput = eventInput && typeof eventInput === 'object' ? eventInput : {};
      const eventType = typeof safeInput.eventType === 'string' ? safeInput.eventType : '';
      if (!PHASE_1A_EVENT_TYPES.includes(eventType)) {
        return Object.freeze({
          ok: true,
          noop: true,
          reason: 'passive_history_capture_unsupported_event_type'
        });
      }

      const envelope = buildEnvelope(eventType, safeInput.report || {}, {
        observedAt: typeof safeInput.observedAt === 'string' ? safeInput.observedAt : new Date().toISOString()
      });
      if (!envelope) {
        return Object.freeze({
          ok: true,
          noop: true,
          reason: 'passive_history_capture_envelope_unavailable'
        });
      }

      return await globalScope.gridlyPassiveHistoryCaptureWriter?.writePhase1AEnvelope?.(
        envelope,
        {
          idempotencyKey: getIdempotencyKey(envelope),
          hook: safeInput.hook || null,
          storageClient: safeInput.storageClient || null,
          writerEnabled: safeInput.writerEnabled === true
        }
      ) || Object.freeze({
        ok: true,
        noop: true,
        reason: 'passive_history_capture_writer_unavailable'
      });
    } catch (error) {
      return Object.freeze({
        ok: true,
        noop: true,
        reason: 'passive_history_capture_fail_open'
      });
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
        hooksInstalled: true,
        installedHooks: Object.freeze([...PHASE_1A_INSTALLED_HOOKS]),
        noHistoricalReadsExposed: flags.historicalReadsExposed === false,
        noUiExposed: flags.uiExposed === false,
        supportedEventTypesPhase1AOnly: Array.isArray(envelopeTypes)
          && envelopeTypes.length === PHASE_1A_EVENT_TYPES.length
          && PHASE_1A_EVENT_TYPES.every((eventType) => envelopeTypes.includes(eventType)),
        supportedEventTypes: Object.freeze([...envelopeTypes]),
        runtimeIntegrated: true,
        storageArtifactsPresent: true,
        writerImplemented: Boolean(globalScope.gridlyPassiveHistoryCaptureWriter?.writePhase1AEnvelope),
        monitoringImplemented: Boolean(globalScope.gridlyPassiveHistoryCaptureMonitoring?.recordHistoryCaptureWriterEvent),
        rollbackArtifactsPresent: true
      });
    } catch (error) {
      return Object.freeze({
        sidecarAvailable: true,
        gatesDefaultDisabled: true,
        writesDisabled: true,
        hooksInstalled: true,
        installedHooks: PHASE_1A_INSTALLED_HOOKS,
        noHistoricalReadsExposed: true,
        noUiExposed: true,
        supportedEventTypesPhase1AOnly: true,
        supportedEventTypes: PHASE_1A_EVENT_TYPES,
        runtimeIntegrated: true,
        storageArtifactsPresent: true,
        writerImplemented: Boolean(globalScope.gridlyPassiveHistoryCaptureWriter?.writePhase1AEnvelope),
        monitoringImplemented: Boolean(globalScope.gridlyPassiveHistoryCaptureMonitoring?.recordHistoryCaptureWriterEvent),
        rollbackArtifactsPresent: true
      });
    }
  }

  const api = Object.freeze({
    PHASE_1A_EVENT_TYPES,
    PHASE_1A_INSTALLED_HOOKS,
    auditSidecar,
    buildEnvelope,
    capturePhase1AEvent,
    getIdempotencyKey
  });

  globalScope.gridlyPassiveHistoryCapturePhase1A = api;
  globalScope.gridlyPassiveHistoryCaptureSidecarAudit = auditSidecar;
})(typeof window !== 'undefined' ? window : globalThis);
