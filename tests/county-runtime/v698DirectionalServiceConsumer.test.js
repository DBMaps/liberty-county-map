const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(repoRoot, 'js', 'gridlyDirectionalRuntimeCandidatePrototype.js');
const servicePath = path.join(repoRoot, 'js', 'gridlyDirectionalServiceLayer.js');
const consumerPath = path.join(repoRoot, 'js', 'gridlyDirectionalServiceConsumer.js');
const evidencePath = path.join(repoRoot, 'assets', 'directional-intelligence', 'evidence', 'v698-directional-service-consumer.json');
const indexPath = path.join(repoRoot, 'index.html');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), context, { filename: runtimePath });
vm.runInContext(fs.readFileSync(servicePath, 'utf8'), context, { filename: servicePath });
vm.runInContext(fs.readFileSync(consumerPath, 'utf8'), context, { filename: consumerPath });

const baseEvidence = {
  activeCounty: 'Liberty County',
  totalSegments: 245,
  strongCandidates: 164,
  reviewRequiredCandidates: 81,
  blockedCandidates: 0,
  bearingOnlyCandidates: 0,
  confidencePresent: true,
  sourceTraceable: true,
  evidencePresent: true,
  countyContained: true,
  countyAmbiguous: false,
  leakageDetected: false,
  reviewBucketDistribution: {
    reversible_lane: 7,
    construction_segment: 8,
    hov_hot_lane: 10,
    missing_county: 36,
    missing_oneway: 3,
    missing_ref: 0,
    manual_review_required: 17
  }
};

assert.strictEqual(typeof context.window.gridlyDirectionalConsumerAudit, 'function', 'consumer audit API is initialized');
assert.strictEqual(typeof context.window.gridlyDirectionalConsumerSnapshot, 'function', 'consumer snapshot API is initialized');
assert.strictEqual(typeof context.window.gridlyDirectionalServiceConsumerTestHarness, 'function', 'consumer test harness is initialized');

const audit = context.window.gridlyDirectionalConsumerAudit();
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit)), {
  available: true,
  serviceAvailable: true,
  candidateCount: 164,
  reviewExcludedCount: 81,
  blockedCount: 0,
  countyContained: true,
  failClosedState: false,
  userVisible: false,
  safeForConsumerPhase: true
});

const snapshot = context.window.gridlyDirectionalConsumerSnapshot();
assert.deepStrictEqual(JSON.parse(JSON.stringify(snapshot)), {
  source: 'directional-service-consumer',
  candidateCount: 164,
  excludedCount: 81,
  activeCounty: 'Liberty County',
  containmentPass: true,
  failClosedPass: true,
  userVisible: false
});
assert(!JSON.stringify(snapshot).match(/bearing|NB|SB|EB|WB|northbound|southbound|eastbound|westbound/i), 'snapshot does not expose bearings or directional labels');
assert(!JSON.stringify(audit).match(/NB|SB|EB|WB|northbound|southbound|eastbound|westbound/i), 'audit does not expose directional labels');

const serviceState = context.window.gridlyDirectionalServiceLayerTestHarness(baseEvidence);
const reviewEnforced = context.window.gridlyDirectionalServiceConsumerTestHarness(serviceState);
assert.strictEqual(reviewEnforced.audit.candidateCount, 164, 'review candidates do not enter consumer count');
assert.strictEqual(reviewEnforced.audit.reviewExcludedCount, 81, 'review exclusion count is preserved');
assert.deepStrictEqual(JSON.parse(JSON.stringify(reviewEnforced.protections.reviewBuckets)), [
  'reversible_lane',
  'construction_segment',
  'hov_hot_lane',
  'missing_county',
  'missing_oneway',
  'missing_ref',
  'manual_review_required'
]);
assert.strictEqual(reviewEnforced.snapshot.excludedCount, 81, 'review and blocked candidates remain excluded from consumer snapshot');

const escapedReviewBucket = context.window.gridlyDirectionalServiceConsumerTestHarness({
  ...serviceState,
  snapshot: {
    ...serviceState.snapshot,
    candidateIds: ['liberty-county-reversible_lane-escape'],
    candidateCount: 1
  }
});
assert.strictEqual(escapedReviewBucket.audit.candidateCount, 0, 'review bucket escape attempt returns zero candidates');
assert.strictEqual(escapedReviewBucket.audit.safeForConsumerPhase, false, 'review bucket escape is not consumer safe');

const containmentFailureService = context.window.gridlyDirectionalServiceLayerTestHarness({ ...baseEvidence, countyContained: false, activeCounty: '', leakageDetected: true });
const containmentFailure = context.window.gridlyDirectionalServiceConsumerTestHarness(containmentFailureService);
assert.strictEqual(containmentFailure.audit.candidateCount, 0, 'containment failure returns zero consumer candidates');
assert.strictEqual(containmentFailure.audit.countyContained, false, 'containment failure is reflected in consumer audit');
assert.strictEqual(containmentFailure.audit.failClosedState, true, 'containment failure is fail-closed in consumer');
assert.strictEqual(containmentFailure.snapshot.containmentPass, false, 'containment failure does not pass snapshot');

const bearingOnlyService = context.window.gridlyDirectionalServiceLayerTestHarness({ ...baseEvidence, bearingOnlyCandidates: 1 });
const bearingOnly = context.window.gridlyDirectionalServiceConsumerTestHarness(bearingOnlyService);
assert.strictEqual(bearingOnly.audit.candidateCount, 0, 'bearing-only candidates are rejected by consumer');
assert.strictEqual(bearingOnly.audit.safeForConsumerPhase, false, 'bearing-only service state is not consumer safe');
assert.strictEqual(bearingOnly.protections.bearingDataExposed, false, 'bearing data is not exposed by consumer');

const failClosedScenarios = [
  null,
  { audit: { available: false }, snapshot: { source: 'directional-service-layer', candidateIds: [], candidateCount: 0 }, protections: {} },
  context.window.gridlyDirectionalServiceLayerTestHarness({ ...baseEvidence, sourceTraceable: false }),
  context.window.gridlyDirectionalServiceLayerTestHarness({ ...baseEvidence, evidencePresent: false }),
  context.window.gridlyDirectionalServiceLayerTestHarness({ ...baseEvidence, confidencePresent: false })
];
failClosedScenarios.forEach((state, index) => {
  const result = context.window.gridlyDirectionalServiceConsumerTestHarness(state);
  assert.strictEqual(result.audit.candidateCount, 0, `fail-closed scenario ${index} returns zero candidates`);
  assert.strictEqual(result.audit.failClosedState, true, `fail-closed scenario ${index} marks failClosedState true`);
  assert.strictEqual(result.audit.safeForConsumerPhase, false, `fail-closed scenario ${index} is not consumer safe`);
});

assert.strictEqual(audit.userVisible, false, 'consumer remains invisible to users');
assert.strictEqual(reviewEnforced.protections.displayEnabled, false, 'consumer does not enable display');
assert.strictEqual(reviewEnforced.protections.routeWatchConnected, false, 'consumer does not connect Route Watch');
assert.strictEqual(reviewEnforced.protections.alertsConnected, false, 'consumer does not connect Alerts');
assert.strictEqual(reviewEnforced.protections.awarenessConnected, false, 'consumer does not connect Awareness');
assert.strictEqual(reviewEnforced.protections.driveTexasConnected, false, 'consumer does not connect DriveTexas');
assert.strictEqual(reviewEnforced.protections.transportationIntelligenceConnected, false, 'consumer does not connect Transportation Intelligence');

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.strictEqual(evidence.candidateCount, 164);
assert.strictEqual(evidence.excludedCount, 81);
assert.strictEqual(evidence.blockedCount, 0);
assert.strictEqual(evidence.containmentPass, true);
assert.strictEqual(evidence.bearingProtectionPass, true);
assert.strictEqual(evidence.failClosedPass, true);
assert.strictEqual(evidence.serviceAvailable, true);
assert.strictEqual(evidence.userVisible, false);
assert.strictEqual(evidence.finalDetermination, 'DIRECTIONAL SERVICE CONSUMER COMPLETE');

const index = fs.readFileSync(indexPath, 'utf8');
assert(index.includes('js/gridlyDirectionalServiceConsumer.js?v=698'), 'index loads the audit-only V698 service consumer');
assert(index.indexOf('js/gridlyDirectionalServiceLayer.js?v=697') < index.indexOf('js/gridlyDirectionalServiceConsumer.js?v=698'), 'consumer loads after service layer');

console.log('V698 directional service consumer audit passed');
