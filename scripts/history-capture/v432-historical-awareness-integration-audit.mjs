import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync('js/history-capture/historyIntelligenceEngine.js', 'utf8'), context);
vm.runInContext(readFileSync('js/history-capture/historyAwarenessAdapter.js', 'utf8'), context);

const fixture = [
  ['report_created', '2026-06-15T12:00:00.000Z', 'crossing-1'],
  ['report_cleared', '2026-06-15T12:25:00.000Z', 'crossing-1'],
  ['report_created', '2026-06-16T12:00:00.000Z', 'crossing-2'],
  ['report_cleared', '2026-06-16T12:35:00.000Z', 'crossing-2'],
  ['report_created', '2026-06-17T12:00:00.000Z', 'crossing-3'],
  ['report_cleared', '2026-06-17T12:45:00.000Z', 'crossing-3']
].map(([event_type, observed_at, source_report_id]) => ({
  event_type,
  observed_at,
  source_report_id,
  payload: { crossingId: 'DOT-432', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
}));

const lowEvidenceFixture = [fixture[0]];
const intelligence = context.gridlyHistoricalIntelligenceEngine.generateHistoricalIntelligence(fixture, { generatedAt: '2026-06-17T00:00:00.000Z' });
const lowEvidenceIntelligence = context.gridlyHistoricalIntelligenceEngine.generateHistoricalIntelligence(lowEvidenceFixture, { generatedAt: '2026-06-17T00:00:00.000Z' });
const audit = context.gridlyHistoricalAwarenessAdapter.auditHistoricalAwarenessIntegration(intelligence, lowEvidenceIntelligence);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(audit.adapterAvailable === true, 'historical awareness adapter unavailable');
assert(audit.recurrenceContextGeneratedSafely === true, 'safe recurrence awareness context missing');
assert(audit.durationContextGeneratedSafely === true, 'safe duration awareness context missing');
assert(audit.reliabilityContextGeneratedSafely === true, 'safe reliability/community context missing');
assert(audit.lowEvidenceSuppressionOrCaveat === true, 'low-evidence caveat or suppression missing');
assert(audit.prohibitedLanguageAbsent === true, 'prohibited language detected');
assert(audit.rawHistoryAbsent === true, 'raw history detected in awareness context');
assert(audit.protectedBoundariesPreserved === true, 'protected historical boundaries changed');
assert(audit.context.protectedBoundaries.historicalReadsEnabled === false, 'historical reads must remain disabled');
assert(audit.context.protectedBoundaries.historyUiEnabled === false, 'history UI must remain disabled');
assert(audit.context.protectedBoundaries.historicalApiExposure === false, 'historical API exposure must remain disabled');
assert(audit.context.protectedBoundaries.consumerFacingHistory === false, 'consumer-facing history must remain disabled');
assert(audit.context.protectedBoundaries.DriveTexasPaused === true, 'DriveTexas must remain paused');

console.log(JSON.stringify(audit, null, 2));
