const assert = require('assert');
require('../../js/history-capture/historyAwarenessAdapter.js');

(() => {
  const adapter = globalThis.gridlyHistoricalAwarenessAdapter;
  assert.ok(adapter, 'Historical Awareness Adapter is loaded');
  assert.strictEqual(typeof adapter.auditHistoricalVisibleAwarenessOutput, 'function');
  assert.strictEqual(typeof globalThis.gridlyHistoricalVisibleAwarenessOutputAudit, 'function');

  const audit = globalThis.gridlyHistoricalVisibleAwarenessOutputAudit();
  assert.strictEqual(audit.visibleHistoricalContextAvailable, true);
  assert.strictEqual(audit.selectedSurface, 'Awareness Brief');
  assert.strictEqual(audit.displayed, true);
  assert.strictEqual(audit.displayReason, 'safe_adapter_context_supported_for_awareness_brief');
  assert.strictEqual(audit.suppressionReason, null);
  assert.strictEqual(audit.noProhibitedLanguage, true);
  assert.strictEqual(audit.rawHistoryAbsent, true);
  assert.strictEqual(audit.noPredictionLanguage, true);
  assert.strictEqual(audit.lowEvidenceState.lowEvidence, true);
  assert.strictEqual(audit.lowEvidenceState.caveated, true);
  assert.strictEqual(audit.lowEvidenceState.line, 'Historical evidence is still limited.');
  assert.deepStrictEqual(audit.protectedBoundaryStatus, {
    historicalReadsEnabled: false,
    historyUiEnabled: false,
    historicalApiExposure: false,
    consumerFacingHistoryDashboard: false,
    DriveTexasPaused: true,
    preserved: true
  });
  assert.strictEqual(audit.visualPlacement.secondarySupportingOnly, true);
  assert.strictEqual(audit.visualPlacement.primaryHeadlinePreserved, true);
  assert.strictEqual(audit.visualPlacement.activeConditionHeadlinePreserved, true);
  assert.strictEqual(audit.visualPlacement.trustFreshnessContextPreserved, true);
  assert.strictEqual(audit.visualPlacement.locationSupportCopyPreserved, true);
  assert.strictEqual(audit.negativeCaseValidation.allSuppressed, true);
  assert.strictEqual(audit.noNewHistoricalSurface, true);
  assert.strictEqual(audit.noHistoricalReads, true);
  assert.strictEqual(audit.noHistoryUiApiDashboard, true);

  const unsafe = adapter.evaluateVisibleHistoricalAwarenessLine({
    surface: 'awarenessBrief',
    message: 'history_capture table shows 5 raw events at 2026-06-17T12:00 and predicts a guaranteed delay.',
    source: 'historical_intelligence',
    consumerSafe: true,
    internalOnly: true,
    lowEvidence: false,
    suppressed: false,
    exposesRawHistory: false,
    predictive: false,
    forecasting: false
  });
  assert.strictEqual(unsafe.displayed, false);
  assert.ok(unsafe.suppressionReasons.includes('raw_history_detected'));
  assert.ok(unsafe.suppressionReasons.includes('prediction_or_forecast_language_detected'));
  assert.ok(unsafe.suppressionReasons.includes('prohibited_language_detected'));

  console.log(JSON.stringify(audit, null, 2));
  console.log('historyVisibleAwarenessOutputAudit.test.js passed');
})();
