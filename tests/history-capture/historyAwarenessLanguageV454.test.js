const assert = require('assert');
require('../../js/history-capture/historyAwarenessAdapter.js');

const adapter = globalThis.gridlyHistoricalAwarenessAdapter;
assert(adapter, 'historical awareness adapter is exposed');
assert.strictEqual(typeof globalThis.gridlyHistoricalLanguageAudit, 'function');

const approved = adapter.runHistoricalLanguagePipeline({ category: 'RecurrenceAwareness' }, { surface: 'Awareness Brief' });
assert.strictEqual(approved.displayable, true);
assert.strictEqual(approved.approvedPhrase, 'This location is frequently reported by the community.');

const suppressedCategory = adapter.runHistoricalLanguagePipeline({ category: 'HistoricalDashboard', phrase: 'Open the history browser.' }, { surface: 'Awareness Brief' });
assert.strictEqual(suppressedCategory.displayable, false);
assert.strictEqual(suppressedCategory.suppressionReason, 'unsupported_historical_language_category');

const prohibited = adapter.runHistoricalLanguagePipeline({ category: 'RecurrenceAwareness' }, { surface: 'Awareness Brief', predictionRisk: true });
assert.strictEqual(prohibited.displayable, false);
assert.strictEqual(prohibited.predictionRisk, true);
assert.strictEqual(prohibited.suppressionReason, 'prediction_risk_detected');

const unsafeVisible = adapter.evaluateVisibleHistoricalAwarenessLine({
  surface: 'awarenessBrief',
  message: 'This route predicted 12 reports by 2026-06-17.',
  source: 'historical_intelligence',
  consumerSafe: true,
  internalOnly: true,
  lowEvidence: false,
  suppressed: false,
  exposesRawHistory: false,
  predictive: false,
  forecasting: false
});
assert.strictEqual(unsafeVisible.displayed, false);
assert(unsafeVisible.suppressionReasons.includes('phrase_not_in_approved_catalog'));
assert(unsafeVisible.suppressionReasons.includes('raw_history_detected'));
assert(unsafeVisible.suppressionReasons.includes('prediction_or_forecast_language_detected'));

const lowEvidenceCaveat = adapter.runHistoricalLanguagePipeline({ category: 'HistoricalContextSupport' }, { surface: 'Community Pulse', lowEvidence: true });
assert.strictEqual(lowEvidenceCaveat.displayable, true);
assert.strictEqual(lowEvidenceCaveat.approvedPhrase, 'Community observations are still limited at this location.');
assert.strictEqual(lowEvidenceCaveat.lowEvidenceState, 'low_evidence');

const lowEvidenceNonCaveat = adapter.runHistoricalLanguagePipeline({ category: 'HistoricalPresence' }, { surface: 'Community Pulse', lowEvidence: true });
assert.strictEqual(lowEvidenceNonCaveat.displayable, false);
assert.strictEqual(lowEvidenceNonCaveat.suppressionReason, 'low_evidence_requires_limited_evidence_caveat');

const routeRisk = adapter.runHistoricalLanguagePipeline({ category: 'HistoricalResolutionAwareness' }, { surface: 'Alert Cards', routeDecisionRisk: true });
assert.strictEqual(routeRisk.displayable, false);
assert.strictEqual(routeRisk.routeDecisionRisk, true);
assert.strictEqual(routeRisk.suppressionReason, 'route_decision_risk_detected');

const ineligibleSurface = adapter.runHistoricalLanguagePipeline({ category: 'HistoricalPresence' }, { surface: 'Historical Dashboard' });
assert.strictEqual(ineligibleSurface.displayable, false);
assert.strictEqual(ineligibleSurface.suppressionReason, 'surface_not_eligible');

const audit = globalThis.gridlyHistoricalLanguageAudit({ category: 'HistoricalPresence' }, { surface: 'Alert Cards' });
assert.strictEqual(audit.auditVersion, 'historical_awareness_language.v454.validation.v1');
assert.strictEqual(audit.approvedPhrase, 'Community observations suggest this is a recurring location.');
assert.strictEqual(audit.suppressedPhrase, null);
assert.strictEqual(audit.suppressionReason, null);
assert.strictEqual(audit.predictionRisk, false);
assert.strictEqual(audit.routeDecisionRisk, false);
assert.strictEqual(audit.surfaceEligibility, true);
assert.strictEqual(audit.lowEvidenceState, 'sufficient_evidence');
assert.deepStrictEqual(audit.protectedBoundaryStatus, {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  historicalApiExposure: false,
  consumerFacingHistoryDashboard: false,
  DriveTexasPaused: true,
  preserved: true
});

console.log('historyAwarenessLanguageV454.test.js passed');
