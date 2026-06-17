(function attachHistoryCaptureIdempotency(globalScope) {
  'use strict';

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return `[${value.map(stableStringify).join(',')}]`;
    }

    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function hashString(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function createPhase1AIdempotencyKey(envelope) {
    try {
      if (!envelope || typeof envelope !== 'object') {
        return null;
      }

      const report = envelope.report && typeof envelope.report === 'object' ? envelope.report : {};
      const stableParts = {
        schemaVersion: envelope.schemaVersion || 'history_capture.phase_1a.v1',
        eventType: envelope.eventType || '',
        observedAt: envelope.observedAt || '',
        reportId: report.id || report.reportId || report.uuid || '',
        reportType: report.type || report.reportType || '',
        report: report.id || report.reportId || report.uuid ? undefined : report
      };

      return `phase1a:${hashString(stableStringify(stableParts))}`;
    } catch (error) {
      return null;
    }
  }

  const api = Object.freeze({
    createPhase1AIdempotencyKey
  });

  globalScope.gridlyPassiveHistoryCaptureIdempotency = api;
})(typeof window !== 'undefined' ? window : globalThis);
