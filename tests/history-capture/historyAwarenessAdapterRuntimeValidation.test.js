const assert = require('assert');
require('../../js/history-capture/historyIntelligenceEngine.js');
require('../../js/history-capture/historyAwarenessAdapter.js');

(() => {
  const engine = globalThis.gridlyHistoricalIntelligenceEngine;
  const adapter = globalThis.gridlyHistoricalAwarenessAdapter;

  assert.ok(adapter, 'Historical Awareness Adapter is loaded');
  assert.strictEqual(typeof adapter.buildHistoricalAwarenessContext, 'function');
  assert.strictEqual(typeof adapter.auditHistoricalAwarenessRuntimeValidation, 'function');

  const primaryEvents = [
    { eventType: 'report_created', observedAt: '2026-06-17T10:00:00.000Z', report: { id: 'fixture-1', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_cleared', observedAt: '2026-06-17T10:45:00.000Z', report: { id: 'fixture-1', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_created', observedAt: '2026-06-17T11:00:00.000Z', report: { id: 'fixture-2', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_cleared', observedAt: '2026-06-17T11:35:00.000Z', report: { id: 'fixture-2', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_created', observedAt: '2026-06-17T12:00:00.000Z', report: { id: 'fixture-3', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } },
    { eventType: 'report_cleared', observedAt: '2026-06-17T12:25:00.000Z', report: { id: 'fixture-3', crossingId: '760123A', reportType: 'blocked_crossing', lat: 30.0571, lng: -94.7955 } }
  ];
  const lowEvidenceEvents = primaryEvents.slice(0, 1);

  const primaryIntelligence = engine.generateHistoricalIntelligence(primaryEvents, { generatedAt: '2026-06-17T00:00:00.000Z' });
  const lowEvidenceIntelligence = engine.generateHistoricalIntelligence(lowEvidenceEvents, { generatedAt: '2026-06-17T00:00:00.000Z' });
  const validation = adapter.auditHistoricalAwarenessRuntimeValidation(primaryIntelligence, lowEvidenceIntelligence);

  assert.deepStrictEqual(validation.runtime, {
    adapterLoaded: true,
    adapterAvailable: true,
    adapterCallable: true,
    runtimeExceptions: 0,
    startupRegressions: false
  });
  assert.strictEqual(validation.awarenessBriefContext.status, 'generated');
  assert.strictEqual(validation.awarenessBriefContext.consumerSafe, true);
  assert.strictEqual(validation.awarenessBriefContext.internalOnly, true);
  assert.strictEqual(validation.awarenessBriefContext.rawHistoryAbsent, true);
  assert.strictEqual(validation.communityPulseContext.status, 'generated');
  assert.strictEqual(validation.communityPulseContext.consumerSafe, true);
  assert.strictEqual(validation.communityPulseContext.noStorageTerms, true);
  assert.strictEqual(validation.communityPulseContext.noRawTimestamps, true);
  assert.strictEqual(validation.communityPulseContext.noUserIdentifiers, true);
  assert.strictEqual(validation.activeConditionExplanation.status, 'generated');
  assert.strictEqual(validation.activeConditionExplanation.cautiousEvidenceLanguage, true);
  assert.strictEqual(validation.activeConditionExplanation.noPredictions, true);
  assert.strictEqual(validation.activeConditionExplanation.noCertaintyClaims, true);
  assert.strictEqual(validation.rankingInputs.status, 'generated_internal_only');
  assert.strictEqual(validation.rankingInputs.internalOnly, true);
  assert.strictEqual(validation.rankingInputs.notUiExposed, true);
  assert.strictEqual(validation.rankingInputs.noConfidenceMathDisplayed, true);
  assert.strictEqual(validation.rankingInputs.noUserScoring, true);
  assert.strictEqual(validation.lowEvidence.status, 'caveated_or_suppressed');
  assert.strictEqual(validation.lowEvidence.truthfulUncertainty, true);
  assert.strictEqual(validation.lowEvidence.noOverconfidentContext, true);
  assert.strictEqual(validation.lowEvidence.stableExecution, true);
  assert.strictEqual(validation.prohibitedLanguage.status, 'absent');
  assert.strictEqual(validation.prohibitedLanguage.absent, true);
  assert.deepStrictEqual(validation.protectedBoundaries, {
    historicalReadsEnabled: false,
    historyUiEnabled: false,
    historicalApiExposure: false,
    consumerFacingHistory: false,
    DriveTexasPaused: true,
    preserved: true
  });

  const serialized = JSON.stringify(validation);
  [
    'predicted',
    'guaranteed',
    'will happen',
    'history_capture',
    'user reliability',
    'reputation',
  ].forEach((phrase) => {
    assert.strictEqual(serialized.toLowerCase().includes(phrase), false, `validation output excludes ${phrase}`);
  });
  assert.strictEqual(/\bforecast\b/i.test(serialized), false, 'validation output excludes forecast as a claim');

  console.log('historyAwarenessAdapterRuntimeValidation.test.js passed');
})();
