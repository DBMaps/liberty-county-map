const assert = require('assert');
require('../../js/history-capture/historyAwarenessAdapter.js');

(() => {
  const adapter = globalThis.gridlyHistoricalAwarenessAdapter;
  assert.ok(adapter, 'Historical Awareness Adapter is loaded');
  assert.strictEqual(typeof adapter.auditHistoricalCommunityPulseOutput, 'function');
  assert.strictEqual(typeof adapter.evaluateVisibleHistoricalCommunityPulseLine, 'function');

  const audit = adapter.auditHistoricalCommunityPulseOutput();
  assert.strictEqual(audit.communityPulseHistoricalContextAvailable, true);
  assert.strictEqual(audit.selectedSurface, 'Community Pulse');
  assert.strictEqual(audit.adapterSourced, true);
  assert.strictEqual(audit.auditVersion, 'historical_community_pulse.v437.validation.v1');
  assert.strictEqual(audit.safeDisplayBehavior, true);
  assert.strictEqual(audit.visibleLine, 'Community observations suggest this is a recurring location.');
  assert.strictEqual(audit.suppressionBehavior, true);
  assert.strictEqual(audit.lowEvidenceBehavior, true);
  assert.strictEqual(audit.prohibitedLanguageValidation.absent, true);
  assert.strictEqual(audit.prohibitedLanguageValidation.unsafeSuppressed, true);
  assert.strictEqual(audit.rawHistorySuppression.absent, true);
  assert.strictEqual(audit.rawHistorySuppression.unsafeSuppressed, true);
  assert.deepStrictEqual(audit.protectedBoundaryStatus, {
    historicalReadsEnabled: false,
    historyUiEnabled: false,
    historicalApiExposure: false,
    consumerFacingHistoryDashboard: false,
    DriveTexasPaused: true,
    preserved: true
  });
  assert.strictEqual(audit.protectedSystems.routeWatchPreserved, true);
  assert.strictEqual(audit.protectedSystems.awarenessBriefBehaviorPreserved, true);

  const displayed = adapter.evaluateVisibleHistoricalCommunityPulseLine(audit.context.surfaces.communityPulse[0]);
  assert.strictEqual(displayed.displayed, true);
  assert.strictEqual(displayed.displayReason, 'safe_adapter_context_supported_for_community_pulse');
  assert.strictEqual(displayed.hierarchy.secondarySupportingOnly, true);
  assert.strictEqual(displayed.hierarchy.doesNotReplaceHeadline, true);
  assert.strictEqual(displayed.hierarchy.doesNotReplaceSubline, true);

  const prohibitedCandidates = [
    'Raw timestamp 2026-06-17T12:00:00Z appeared in history_capture.',
    'Historical database table shows 7 raw events.',
    'Confidence score predicts this crossing will happen again.',
    'Forecast says this will happen again tomorrow.',
    'User reliability reputation is low for this report.'
  ];
  for (const message of prohibitedCandidates) {
    const result = adapter.evaluateVisibleHistoricalCommunityPulseLine({
      surface: 'communityPulse',
      message,
      source: 'historical_intelligence',
      consumerSafe: true,
      internalOnly: true,
      lowEvidence: false,
      suppressed: false,
      exposesRawHistory: false,
      predictive: false,
      forecasting: false
    });
    assert.strictEqual(result.displayed, false, `unsafe candidate must be suppressed: ${message}`);
  }

  const lowEvidenceUncaveated = adapter.evaluateVisibleHistoricalCommunityPulseLine({
    surface: 'communityPulse',
    message: 'Community observations suggest this is a recurring location.',
    source: 'historical_intelligence',
    consumerSafe: true,
    internalOnly: true,
    lowEvidence: true,
    suppressed: false,
    exposesRawHistory: false,
    predictive: false,
    forecasting: false
  });
  assert.strictEqual(lowEvidenceUncaveated.displayed, false);
  assert.ok(lowEvidenceUncaveated.suppressionReasons.includes('low_evidence_not_caveated'));

  const lowEvidenceCaveat = adapter.evaluateVisibleHistoricalCommunityPulseLine({
    surface: 'communityPulse',
    message: 'Community observations are still limited at this location.',
    source: 'historical_intelligence',
    consumerSafe: true,
    internalOnly: true,
    lowEvidence: true,
    suppressed: false,
    exposesRawHistory: false,
    predictive: false,
    forecasting: false
  });
  assert.strictEqual(lowEvidenceCaveat.displayed, true);

  console.log('historyCommunityPulseAudit.test.js passed');
})();
