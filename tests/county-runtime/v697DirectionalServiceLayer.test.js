const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(repoRoot, 'js', 'gridlyDirectionalRuntimeCandidatePrototype.js');
const servicePath = path.join(repoRoot, 'js', 'gridlyDirectionalServiceLayer.js');
const evidencePath = path.join(repoRoot, 'assets', 'directional-intelligence', 'evidence', 'v697-directional-service-layer.json');
const indexPath = path.join(repoRoot, 'index.html');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), context, { filename: runtimePath });
vm.runInContext(fs.readFileSync(servicePath, 'utf8'), context, { filename: servicePath });

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

assert.strictEqual(typeof context.window.gridlyDirectionalServiceAudit, 'function', 'service audit API is initialized');
assert.strictEqual(typeof context.window.gridlyDirectionalServiceSnapshot, 'function', 'service snapshot API is initialized');

const audit = context.window.gridlyDirectionalServiceAudit();
assert.deepStrictEqual(JSON.parse(JSON.stringify(audit)), {
  available: true,
  candidateCount: 164,
  reviewExcludedCount: 81,
  blockedCount: 0,
  countyContained: true,
  failClosedState: false,
  userVisible: false,
  displayEnabled: false,
  safeForServiceLayer: true
});

const snapshot = context.window.gridlyDirectionalServiceSnapshot();
assert.strictEqual(snapshot.candidateCount, 164, 'snapshot exposes validated service candidates only');
assert.strictEqual(snapshot.candidateIds.length, 164, 'snapshot includes one audit-only id per safe candidate');
assert.strictEqual(snapshot.excludedCount, 81, 'snapshot excludes review bucket candidates');
assert.strictEqual(snapshot.activeCounty, 'Liberty County', 'snapshot preserves active county containment');
assert.strictEqual(snapshot.source, 'directional-service-layer', 'snapshot is source-scoped to service layer');

const reviewEnforced = context.window.gridlyDirectionalServiceLayerTestHarness(baseEvidence);
assert.deepStrictEqual(JSON.parse(JSON.stringify(reviewEnforced.protections.reviewBuckets)), [
  'reversible_lane',
  'construction_segment',
  'hov_hot_lane',
  'missing_county',
  'missing_oneway',
  'missing_ref',
  'manual_review_required'
]);
assert.strictEqual(reviewEnforced.audit.candidateCount, 164, 'review candidates do not enter service count');
assert.strictEqual(reviewEnforced.audit.reviewExcludedCount, 81, 'review bucket exclusions are preserved');
assert.strictEqual(reviewEnforced.protections.reviewBucketsExcluded, true, 'review bucket exclusion remains enforced');

const containmentFailures = [
  { ...baseEvidence, activeCounty: '', countyContained: false },
  { ...baseEvidence, activeCounty: 'Liberty County / Montgomery County', countyContained: false, countyAmbiguous: true },
  { ...baseEvidence, leakageDetected: true, countyContained: false }
];
containmentFailures.forEach((evidence, index) => {
  const result = context.window.gridlyDirectionalServiceLayerTestHarness(evidence);
  assert.strictEqual(result.audit.candidateCount, 0, `containment failure ${index} returns zero candidates`);
  assert.strictEqual(result.audit.failClosedState, true, `containment failure ${index} is fail-closed`);
  assert.strictEqual(result.audit.safeForServiceLayer, false, `containment failure ${index} is not service-safe`);
});

const bearingOnly = context.window.gridlyDirectionalServiceLayerTestHarness({ ...baseEvidence, bearingOnlyCandidates: 1 });
assert.strictEqual(bearingOnly.audit.candidateCount, 0, 'bearing-only candidates are prohibited from service layer');
assert.strictEqual(bearingOnly.audit.failClosedState, true, 'bearing-only evidence forces service fail-closed');
assert.strictEqual(bearingOnly.protections.bearingProtectionPass, false, 'bearing protection reports failure for bearing-only evidence');

const failClosedScenarios = [
  null,
  { ...baseEvidence, sourceTraceable: false },
  { ...baseEvidence, evidencePresent: false },
  { ...baseEvidence, confidencePresent: false },
  { ...baseEvidence, countyContained: false, activeCounty: '' }
];
failClosedScenarios.forEach((evidence, index) => {
  const result = context.window.gridlyDirectionalServiceLayerTestHarness(evidence);
  assert.strictEqual(result.audit.candidateCount, 0, `fail-closed scenario ${index} returns zero candidates`);
  assert.strictEqual(result.audit.failClosedState, true, `fail-closed scenario ${index} marks failClosedState true`);
  assert.strictEqual(result.snapshot.candidateCount, 0, `fail-closed scenario ${index} snapshot has zero candidates`);
});

assert.strictEqual(audit.userVisible, false, 'service audit remains non-user-facing');
assert.strictEqual(audit.displayEnabled, false, 'service layer display remains disabled');
assert.strictEqual(reviewEnforced.protections.routeWatchConnected, false, 'service layer does not connect Route Watch');
assert.strictEqual(reviewEnforced.protections.alertsConnected, false, 'service layer does not connect Alerts');
assert.strictEqual(reviewEnforced.protections.awarenessConnected, false, 'service layer does not connect Awareness');

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.strictEqual(evidence.candidateCount, 164);
assert.strictEqual(evidence.excludedCount, 81);
assert.strictEqual(evidence.blockedCount, 0);
assert.strictEqual(evidence.containmentPass, true);
assert.strictEqual(evidence.bearingProtectionPass, true);
assert.strictEqual(evidence.failClosedPass, true);
assert.strictEqual(evidence.userVisible, false);
assert.strictEqual(evidence.finalDetermination, 'DIRECTIONAL SERVICE LAYER COMPLETE');

const index = fs.readFileSync(indexPath, 'utf8');
assert(index.includes('js/gridlyDirectionalServiceLayer.js?v=697'), 'index loads the audit-only V697 service layer');

console.log('V697 directional service layer audit passed');
