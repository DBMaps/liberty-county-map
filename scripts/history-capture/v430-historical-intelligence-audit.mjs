import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(readFileSync('js/history-capture/historyIntelligenceEngine.js', 'utf8'), context);

const fixture = [
  {
    event_type: 'report_created',
    observed_at: '2026-06-15T12:00:00.000Z',
    source_report_id: 'crossing-1',
    payload: { crossingId: 'DOT-123', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
  },
  {
    event_type: 'report_cleared',
    observed_at: '2026-06-15T12:25:00.000Z',
    source_report_id: 'crossing-1',
    payload: { crossingId: 'DOT-123', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
  },
  {
    event_type: 'report_created',
    observed_at: '2026-06-16T22:05:00.000Z',
    source_report_id: 'hazard-1',
    payload: { hazardType: 'debris', roadName: 'Main St', lat: 30.10004, lng: -94.70004 }
  },
  {
    event_type: 'report_cleared',
    observed_at: '2026-06-16T23:50:00.000Z',
    source_report_id: 'hazard-1',
    payload: { hazardType: 'debris', roadName: 'Main St', lat: 30.10004, lng: -94.70004 }
  },
  {
    event_type: 'report_created',
    observed_at: '2026-06-17T12:10:00.000Z',
    source_report_id: 'crossing-2',
    payload: { crossingId: 'DOT-123', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
  }
];

const lowEvidenceFixture = [fixture[0]];
const audit = context.gridlyHistoricalIntelligenceEngine.auditHistoricalIntelligence(fixture);
const lowEvidenceAudit = context.gridlyHistoricalIntelligenceEngine.auditHistoricalIntelligence(lowEvidenceFixture);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(audit.recurrenceGenerated, 'recurrence generation failed');
assert(audit.durationGenerated, 'duration generation failed');
assert(audit.reliabilityGenerated, 'reliability generation failed');
assert(audit.patternGenerated, 'pattern generation failed');
assert(audit.intelligence.recurrence.some((item) => item.domain === 'crossing' && item.observedCount === 3), 'crossing recurrence output missing');
assert(audit.intelligence.duration.observedDurationCount === 2, 'duration observations missing');
assert(audit.intelligence.reliability.signal === 'emerging_historical_signal', 'unexpected reliability signal');
assert(audit.intelligence.patterns.recurringHazardTypes.length > 0, 'hazard pattern output missing');
assert(audit.intelligence.historicalReadsEnabled === false, 'historical reads must remain disabled');
assert(audit.intelligence.historicalUiEnabled === false, 'historical UI must remain disabled');
assert(audit.intelligence.apiExposed === false, 'historical API exposure must remain disabled');
assert(lowEvidenceAudit.intelligence.reliability.lowEvidence === true, 'low-evidence reliability behavior missing');
assert(lowEvidenceAudit.intelligence.duration.signal === 'no_observed_duration_evidence', 'low-evidence duration behavior missing');

console.log(JSON.stringify({
  recurrence: audit.intelligence.recurrence,
  duration: audit.intelligence.duration,
  reliability: audit.intelligence.reliability,
  patterns: audit.intelligence.patterns,
  lowEvidence: {
    reliability: lowEvidenceAudit.intelligence.reliability,
    duration: lowEvidenceAudit.intelligence.duration
  },
  protectedBoundaries: audit.protectedBoundaries
}, null, 2));
