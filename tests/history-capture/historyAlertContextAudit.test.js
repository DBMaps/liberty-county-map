const assert = require('assert');
require('../../js/history-capture/historyAwarenessAdapter.js');

(function run() {
  const adapter = globalThis.gridlyHistoricalAwarenessAdapter;
  assert.strictEqual(typeof adapter.auditHistoricalAlertContextOutput, 'function');
  assert.strictEqual(typeof globalThis.gridlyHistoricalAlertContextAudit, 'function');

  const audit = globalThis.gridlyHistoricalAlertContextAudit();
  assert.strictEqual(audit.auditVersion, 'historical_alert_context.v439.validation.v1');
  assert.strictEqual(audit.alertCardHistoricalContextAvailable, true);
  assert.strictEqual(audit.selectedSurface, 'Alert Cards');
  assert.strictEqual(audit.adapterSourced, true);
  assert.strictEqual(audit.safeDisplayBehavior, true);
  assert.strictEqual(audit.suppressionBehavior, true);
  assert.strictEqual(audit.lowEvidenceBehavior, true);
  assert.strictEqual(audit.prohibitedLanguageValidation.absent, true);
  assert.strictEqual(audit.rawHistorySuppression.absent, true);
  assert.strictEqual(audit.protectedBoundaryStatus.preserved, true);
  assert.strictEqual(audit.protectedSystems.awarenessBriefBehaviorPreserved, true);
  assert.strictEqual(audit.protectedSystems.communityPulseBehaviorPreserved, true);
  assert.strictEqual(audit.auditMetadata.adapterSourced, true);
  assert.strictEqual(audit.auditMetadata.secondary, true);
  assert.strictEqual(audit.auditMetadata.rawHistoryFree, true);
  assert.strictEqual(audit.auditMetadata.predictionFree, true);
  assert.strictEqual(audit.auditMetadata.prohibitedLanguageFree, true);

  const visible = adapter.evaluateVisibleHistoricalAlertCardLine(audit.context.surfaces.alertCards[0]);
  assert.strictEqual(visible.displayed, true);
  assert.strictEqual(visible.displayReason, 'safe_adapter_context_supported_for_alert_cards');
  assert.strictEqual(visible.hierarchy.doesNotReplaceTitle, true);

  const unsafe = adapter.evaluateVisibleHistoricalAlertCardLine({
    surface: 'alertCards',
    message: 'history_capture table predicts a guaranteed delay.',
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
  assert(unsafe.suppressionReasons.includes('raw_history_detected') || unsafe.suppressionReasons.includes('prediction_or_forecast_language_detected') || unsafe.suppressionReasons.includes('prohibited_language_detected'));

  console.log('historyAlertContextAudit.test.js passed');
})();
