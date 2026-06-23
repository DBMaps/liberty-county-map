const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(repoRoot, 'js', 'gridlyDirectionalRuntimeCandidatePrototype.js');
const evidencePath = path.join(repoRoot, 'assets', 'directional-intelligence', 'evidence', 'v695-directional-runtime-candidate-prototype.json');
const indexPath = path.join(repoRoot, 'index.html');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), context, { filename: runtimePath });

const candidateAudit = context.window.gridlyDirectionalCandidateAudit();
assert.deepStrictEqual(JSON.parse(JSON.stringify(candidateAudit)), {
  available: true,
  candidateCount: 164,
  reviewExcludedCount: 81,
  blockedCount: 0,
  countyContained: true,
  bearingOnlyCandidates: 0,
  failClosedState: false,
  safeForPrototypePhase: true
});

const containmentAudit = context.window.gridlyDirectionalContainmentAudit();
assert.deepStrictEqual(JSON.parse(JSON.stringify(containmentAudit)), {
  countyContainmentPass: true,
  leakageDetected: false,
  invalidCandidates: 0,
  excludedCandidates: 81,
  activeCounty: 'Liberty County',
  safeForRuntimePrototype: true
});

const runtimeAudit = context.window.gridlyDirectionalRuntimeAudit();
assert.deepStrictEqual(JSON.parse(JSON.stringify(runtimeAudit)), {
  candidateGenerationAvailable: true,
  runtimeVisibleToUsers: false,
  displayEnabled: false,
  routeWatchConnected: false,
  alertsConnected: false,
  awarenessConnected: false,
  reviewBucketsExcluded: true,
  bearingProtectionPass: true,
  failClosedProtectionPass: true
});

const failClosed = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness(null);
assert.strictEqual(failClosed.candidate.candidateCount, 0, 'missing source returns zero candidates');
assert.strictEqual(failClosed.candidate.failClosedState, true, 'missing source sets failClosedState true');
assert.strictEqual(failClosed.runtime.failClosedProtectionPass, true, 'fail-closed protection passes when count is zero');

const bearingOnly = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness({
  activeCounty: 'Liberty County',
  totalSegments: 245,
  strongCandidates: 164,
  reviewRequiredCandidates: 81,
  blockedCandidates: 0,
  bearingOnlyCandidates: 1,
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
});
assert.strictEqual(bearingOnly.candidate.candidateCount, 0, 'bearing-only evidence cannot create runtime candidates');
assert.strictEqual(bearingOnly.runtime.bearingProtectionPass, false, 'bearing-only injection fails bearing protection');

const protectedState = context.window.gridlyDirectionalRuntimePrototypeProtectedState().protectedSystems;
assert.deepStrictEqual(JSON.parse(JSON.stringify(protectedState)), {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false
});

const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
assert.strictEqual(evidence.finalDetermination, 'RUNTIME CANDIDATE PROTOTYPE COMPLETE');
assert.strictEqual(evidence.candidateCounts.eligibleRuntimeCandidates, 164);
assert.strictEqual(evidence.reviewBucketExclusionCounts.totalExcluded, 81);
assert.strictEqual(evidence.runtimeProtectionVerification.directionalDisplayEnabled, false);

const index = fs.readFileSync(indexPath, 'utf8');
assert(index.includes('js/gridlyDirectionalRuntimeCandidatePrototype.js?v=695'), 'index loads the audit-only V695 runtime prototype');

console.log('V695 directional runtime candidate prototype audit passed');
