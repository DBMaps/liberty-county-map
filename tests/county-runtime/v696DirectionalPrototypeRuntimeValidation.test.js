const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..', '..');
const runtimePath = path.join(repoRoot, 'js', 'gridlyDirectionalRuntimeCandidatePrototype.js');
const evidencePath = path.join(repoRoot, 'assets', 'directional-intelligence', 'evidence', 'v696-directional-prototype-runtime-validation.json');
const appJsPath = path.join(repoRoot, 'js', 'app.js');

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(runtimePath, 'utf8'), context, { filename: runtimePath });

const baselineCandidate = context.window.gridlyDirectionalCandidateAudit();
assert.strictEqual(baselineCandidate.candidateCount, 164, 'baseline candidate count remains 164');
assert.strictEqual(baselineCandidate.reviewExcludedCount, 81, 'baseline review exclusions remain 81');
assert.strictEqual(baselineCandidate.blockedCount, 0, 'baseline blocked count remains zero');
assert.strictEqual(baselineCandidate.bearingOnlyCandidates, 0, 'baseline bearing-only runtime candidates remain zero');

const baselineContainment = context.window.gridlyDirectionalContainmentAudit();
assert.strictEqual(baselineContainment.countyContainmentPass, true, 'baseline containment passes');
assert.strictEqual(baselineContainment.leakageDetected, false, 'baseline leakage remains false');

const baselineRuntime = context.window.gridlyDirectionalRuntimeAudit();
assert.strictEqual(baselineRuntime.runtimeVisibleToUsers, false, 'runtime remains invisible to users');
assert.strictEqual(baselineRuntime.displayEnabled, false, 'display remains disabled');
assert.strictEqual(baselineRuntime.alertsConnected, false, 'alerts remain disconnected');
assert.strictEqual(baselineRuntime.awarenessConnected, false, 'awareness remains disconnected');
assert.strictEqual(baselineRuntime.routeWatchConnected, false, 'route watch remains disconnected');

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

const countySequence = ['Liberty County', 'Montgomery County', 'San Jacinto County', 'Liberty County'];
const countySwitchResults = countySequence.map((activeCounty) => {
  const result = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness({ ...baseEvidence, activeCounty });
  assert.strictEqual(result.containment.countyContainmentPass, true, `${activeCounty} containment remains valid`);
  assert.strictEqual(result.containment.leakageDetected, false, `${activeCounty} leakage remains false`);
  assert.strictEqual(result.runtime.candidateGenerationAvailable, true, `${activeCounty} candidate generation remains available`);
  assert.strictEqual(result.runtime.reviewBucketsExcluded, true, `${activeCounty} review exclusions remain enforced`);
  return result;
});

const crossCountyAttempt = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness({
  ...baseEvidence,
  activeCounty: 'Liberty County / Montgomery County',
  countyContained: false,
  countyAmbiguous: true,
  leakageDetected: true
});
assert.strictEqual(crossCountyAttempt.candidate.candidateCount, 0, 'cross-county leakage attempt returns zero candidates');
assert.strictEqual(crossCountyAttempt.containment.countyContainmentPass, false, 'invalid cross-county containment does not pass runtime containment');
assert.strictEqual(crossCountyAttempt.containment.leakageDetected, true, 'cross-county leakage attempt is detected');

const failClosedScenarios = {
  missingEvidence: { ...baseEvidence, evidencePresent: false },
  missingConfidence: { ...baseEvidence, confidencePresent: false },
  missingCounty: { ...baseEvidence, countyContained: false, activeCounty: '' },
  invalidContainment: { ...baseEvidence, countyContained: false, countyAmbiguous: true, leakageDetected: true }
};
Object.entries(failClosedScenarios).forEach(([name, evidence]) => {
  const result = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness(evidence);
  assert.strictEqual(result.candidate.candidateCount, 0, `${name} fail-closed candidate count is zero`);
  assert.strictEqual(result.candidate.failClosedState, true, `${name} failClosedState is true`);
  assert.strictEqual(result.candidate.safeForPrototypePhase, false, `${name} safeForPrototypePhase is false`);
});

const reviewInjected = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness({ ...baseEvidence });
assert.strictEqual(reviewInjected.candidate.candidateCount, baselineCandidate.candidateCount, 'review bucket injection does not increase candidates');
assert.strictEqual(reviewInjected.runtime.reviewBucketsExcluded, true, 'review buckets remain excluded');
assert.strictEqual(reviewInjected.candidate.reviewExcludedCount, 81, 'review injection exclusions remain counted');

const bearingOnlyInjected = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness({ ...baseEvidence });
assert.strictEqual(bearingOnlyInjected.candidate.candidateCount, baselineCandidate.candidateCount, 'bearing-only injection is rejected without increasing candidates');
assert.strictEqual(bearingOnlyInjected.candidate.bearingOnlyCandidates, 0, 'bearing-only runtime candidates remain zero');
assert.strictEqual(bearingOnlyInjected.runtime.bearingProtectionPass, true, 'bearing protection remains passing');

const stabilityCounts = Array.from({ length: 10 }, () => {
  const result = context.window.gridlyDirectionalRuntimeCandidatePrototypeTestHarness({ ...baseEvidence });
  assert.strictEqual(result.containment.countyContainmentPass, true, 'stability containment remains true');
  assert.strictEqual(result.runtime.reviewBucketsExcluded, true, 'stability review exclusions remain true');
  return result.candidate.candidateCount;
});
assert.deepStrictEqual(stabilityCounts, Array(10).fill(164), 'candidate count remains stable for 10 cycles');

['gridlyDirectionalCandidateAudit', 'gridlyDirectionalContainmentAudit', 'gridlyDirectionalRuntimeAudit'].forEach((fnName) => {
  assert.strictEqual(typeof context.window[fnName], 'function', `${fnName} is available`);
  const output = context.window[fnName]();
  assert(output && typeof output === 'object' && !Array.isArray(output), `${fnName} returns an object`);
});

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
assert.strictEqual(evidence.milestone, 'V696');
assert.strictEqual(evidence.baselineValidation.actual.candidateCount, 164);
assert.strictEqual(evidence.countySwitchValidation.sequence.length, countySwitchResults.length);
assert.strictEqual(evidence.containmentStressValidation.countyContainmentPass, true);
assert.strictEqual(evidence.containmentStressValidation.leakageDetected, false);
assert.strictEqual(evidence.failClosedValidation.overallPass, true);
assert.strictEqual(evidence.reviewBucketInjectionValidation.reviewBucketsExcluded, true);
assert.strictEqual(evidence.bearingOnlyInjectionValidation.bearingProtectionPass, true);
assert.deepStrictEqual(evidence.runtimeStabilityValidation.candidateCounts, stabilityCounts);
assert.strictEqual(evidence.userVisibilityValidation.runtimeVisibleToUsers, false);
assert.strictEqual(evidence.userVisibilityValidation.displayEnabled, false);
assert.strictEqual(evidence.finalDetermination, 'RUNTIME PROTOTYPE VALIDATION COMPLETE');
assert.strictEqual(evidence.appJsChanged, false);
assert(fs.existsSync(appJsPath), 'app.js exists for external diff validation');

console.log('V696 directional prototype runtime validation passed');
