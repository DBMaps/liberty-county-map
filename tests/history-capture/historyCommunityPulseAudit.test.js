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
  assert.strictEqual(audit.safeDisplayBehavior, true);
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

  console.log('historyCommunityPulseAudit.test.js passed');
})();
