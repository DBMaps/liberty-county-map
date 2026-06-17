import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ENGINE_PATH = 'js/history-capture/historyIntelligenceEngine.js';

const runtimeContext = { console };
runtimeContext.globalThis = runtimeContext;
vm.createContext(runtimeContext);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

vm.runInContext(readFileSync(ENGINE_PATH, 'utf8'), runtimeContext, { filename: ENGINE_PATH });

const engine = runtimeContext.gridlyHistoricalIntelligenceEngine;

assert(engine, 'Historical Intelligence Engine did not attach to runtime context');
assert(typeof engine.generateHistoricalIntelligence === 'function', 'generateHistoricalIntelligence is not callable');
assert(typeof engine.auditHistoricalIntelligence === 'function', 'auditHistoricalIntelligence is not callable');
assert(typeof engine.auditHistoricalIntelligenceRuntimeValidation === 'function', 'runtime validation helper is not callable');

const accumulatedEvidenceFixture = [
  {
    event_type: 'report_created',
    observed_at: '2026-06-10T12:00:00.000Z',
    source_report_id: 'crossing-main-1',
    payload: { crossingId: 'DOT-123', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
  },
  {
    event_type: 'report_cleared',
    observed_at: '2026-06-10T12:25:00.000Z',
    source_report_id: 'crossing-main-1',
    payload: { crossingId: 'DOT-123', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
  },
  {
    event_type: 'report_created',
    observed_at: '2026-06-11T22:05:00.000Z',
    source_report_id: 'hazard-main-1',
    payload: { hazardType: 'debris', roadName: 'Main St', lat: 30.10004, lng: -94.70004 }
  },
  {
    event_type: 'report_cleared',
    observed_at: '2026-06-12T00:05:00.000Z',
    source_report_id: 'hazard-main-1',
    payload: { hazardType: 'debris', roadName: 'Main St', lat: 30.10004, lng: -94.70004 }
  },
  {
    event_type: 'report_created',
    observed_at: '2026-06-17T12:10:00.000Z',
    source_report_id: 'crossing-main-2',
    payload: { crossingId: 'DOT-123', reportType: 'blocked_crossing', roadName: 'Main St', lat: 30.10001, lng: -94.70001 }
  },
  {
    event_type: 'report_created',
    observed_at: '2026-06-17T17:45:00.000Z',
    source_report_id: 'roadway-main-2',
    payload: { hazardType: 'flooding', roadName: 'Main St', lat: 30.10006, lng: -94.70006 }
  }
];

const lowEvidenceFixture = [accumulatedEvidenceFixture[0]];
const runtimeAudit = engine.auditHistoricalIntelligenceRuntimeValidation(accumulatedEvidenceFixture, lowEvidenceFixture);

assert(runtimeAudit.runtime.engineLoaded === true, 'engine did not load');
assert(runtimeAudit.runtime.engineAvailable === true, 'engine is not available');
assert(runtimeAudit.runtime.engineCallable === true, 'engine is not callable');
assert(runtimeAudit.runtime.runtimeExceptions === 0, 'runtime exception was recorded');
assert(runtimeAudit.runtime.startupRegressions === false, 'startup regression detected');

assert(runtimeAudit.recurrence.status === 'generated', 'recurrence status not generated');
assert(runtimeAudit.recurrence.hasScore === true, 'recurrence score missing');
assert(runtimeAudit.recurrence.hasSignal === true, 'recurrence signal missing');
assert(runtimeAudit.recurrence.hasClassification === true, 'recurrence classification missing');
assert(runtimeAudit.recurrence.lowEvidenceBehavior === true, 'recurrence low-evidence behavior missing');

assert(runtimeAudit.duration.status === 'generated', 'duration status not generated');
assert(runtimeAudit.duration.observedDurationCount === 2, 'duration aggregation count unexpected');
assert(runtimeAudit.duration.noSyntheticDurations === true, 'synthetic duration detected');
assert(runtimeAudit.duration.missingDurationHandling === true, 'missing-duration handling missing');

assert(runtimeAudit.reliability.status === 'generated', 'reliability status not generated');
assert(runtimeAudit.reliability.noReputationSystem === true, 'reputation system boundary violated');
assert(runtimeAudit.reliability.noUserScoring === true, 'user scoring boundary violated');
assert(runtimeAudit.lowEvidence.stable === true, 'low-evidence validation was not stable');

assert(runtimeAudit.patterns.status === 'generated', 'pattern status not generated');
assert(runtimeAudit.patterns.hazardPatternGenerated === true, 'hazard pattern missing');
assert(runtimeAudit.patterns.crossingPatternGenerated === true, 'crossing pattern missing');
assert(runtimeAudit.patterns.roadwayPatternGenerated === true, 'roadway pattern missing');
assert(runtimeAudit.patterns.hourClusteringGenerated === true, 'hour clustering missing');
assert(runtimeAudit.patterns.dayOfWeekClusteringGenerated === true, 'day-of-week clustering missing');
assert(runtimeAudit.patterns.noForecasting === true, 'forecasting boundary violated');
assert(runtimeAudit.patterns.noPrediction === true, 'prediction boundary violated');

assert(runtimeAudit.protectedBoundaries.historicalReadsEnabled === false, 'historical reads must remain disabled');
assert(runtimeAudit.protectedBoundaries.historyUiEnabled === false, 'history UI must remain disabled');
assert(runtimeAudit.protectedBoundaries.historicalApiExposure === false, 'historical API exposure must remain disabled');
assert(runtimeAudit.protectedBoundaries.consumerFacingHistory === false, 'consumer-facing history must remain disabled');
assert(runtimeAudit.protectedBoundaries.DriveTexasPaused === true, 'DriveTexas must remain paused');

console.log(JSON.stringify(runtimeAudit, null, 2));
