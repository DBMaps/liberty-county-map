import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const evidenceDir = 'assets/directional-intelligence/evidence';
const outputPath = path.join(evidenceDir, 'v694-directional-runtime-prototype-architecture.json');
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(evidenceDir, name), 'utf8'));

const inputs = {
  v683: readJson('v683-osm-metadata-coverage-audit.json'),
  v684: readJson('v684-osm-extraction-prototype-evidence.json'),
  v685: readJson('v685-osm-extraction-validation-audit.json'),
  v686r: readJson('v686-osm-confidence-validation-prototype.json'),
  v688: readJson('v688-directional-evidence-recovery-and-consolidation.json'),
  v689: readJson('v689-directional-governance-review.json'),
  v690: readJson('v690-directional-governance-package.json'),
  v691: readJson('v691-directional-runtime-readiness-assessment.json'),
  v692: readJson('v692-directional-runtime-protection-framework.json'),
  v693: readJson('v693-directional-program-go-no-go-review.json'),
};

const protectedSystemsVerified = Object.freeze({
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false,
});

const appSource = fs.readFileSync('js/app.js', 'utf8');
assert.match(appSource, /historicalReadsEnabled:\s*false/, 'historicalReadsEnabled must remain false');
assert.match(appSource, /historyUiEnabled:\s*false/, 'historyUiEnabled must remain false');
assert.match(appSource, /DriveTexasPaused:\s*true/, 'DriveTexasPaused must remain true');
assert.match(appSource, /TransportationIntelligenceEnabled:\s*false/, 'TransportationIntelligenceEnabled must remain false');
assert.match(appSource, /TransportationIntelligenceDisplay:\s*false/, 'TransportationIntelligenceDisplay must remain false');
assert.match(appSource, /TransportationIntelligenceActivation:\s*false/, 'TransportationIntelligenceActivation must remain false');

const protectedOk = Object.values(inputs).every((evidence) => {
  const actual = evidence.protectedSystemsVerified;
  return actual && Object.entries(protectedSystemsVerified).every(([key, value]) => actual[key] === value);
});

const strongCandidates = inputs.v689.confidenceGovernance?.strongCandidates ?? inputs.v693.confidenceReview?.strongCandidates;
const reviewRequiredCandidates = inputs.v689.confidenceGovernance?.reviewRequiredCandidates ?? inputs.v693.confidenceReview?.reviewRequiredCandidates;
const blockedCandidates = inputs.v689.confidenceGovernance?.blockedCandidates ?? inputs.v693.confidenceReview?.blockedCandidates;
const bearingOnlyCandidates = inputs.v686r.bearingOnlyPolicy?.bearingOnlyCandidateCount ?? inputs.v693.confidenceReview?.bearingOnlyCandidates;
const evidenceChainComplete = inputs.v693.finalDetermination === 'GO — DIRECTIONAL ASSESSMENT PHASE COMPLETE';

const requiredReviewBuckets = [
  'reversible_lane',
  'construction_segment',
  'hov_hot_lane',
  'missing_county',
  'missing_oneway',
  'missing_ref',
  'manual_review_required',
];

const architectureReadinessState = evidenceChainComplete && protectedOk && strongCandidates > 0 && reviewRequiredCandidates > 0 && blockedCandidates === 0 && bearingOnlyCandidates === 0
  ? 'architecture_ready_for_prototype_design'
  : evidenceChainComplete && protectedOk
    ? 'architecture_ready_with_constraints'
    : 'architecture_not_ready';

const finalDetermination = architectureReadinessState === 'architecture_ready_for_prototype_design'
  ? 'RUNTIME PROTOTYPE ARCHITECTURE COMPLETE'
  : architectureReadinessState === 'architecture_ready_with_constraints'
    ? 'RUNTIME PROTOTYPE ARCHITECTURE COMPLETE WITH CONSTRAINTS'
    : 'RUNTIME PROTOTYPE ARCHITECTURE INCOMPLETE';

const evidence = {
  milestone: 'V694',
  generatedAt: new Date().toISOString(),
  runtimePhilosophy: {
    mission: 'Directional intelligence exists to improve awareness quality for Gridly Know Before You Go.',
    posture: ['Awareness Platform First', 'Route Intelligence Second'],
    nonNavigationBoundary: 'Directional intelligence must not become navigation, turn guidance, routing instruction, or user-facing NB/SB/EB/WB display without later authorization.',
    subordinationRule: 'Any future runtime prototype remains subordinate to awareness safety, protected-system boundaries, county containment, and fail-closed behavior.',
  },
  runtimeDataArchitecture: {
    pipeline: ['Source Asset', 'Extracted Inventory', 'Validated Inventory', 'Confidence Inventory', 'Runtime Candidate Set', '(Protected Runtime Layer)'],
    runtimeEligibleArtifacts: ['validated strong-confidence, county-owned, corridor-valid, non-review, non-bearing-only candidate records derived from V684/V685/V686R/V688 evidence after a future authorization gate'],
    prohibitedRuntimeArtifacts: ['source-only records', 'raw extracted inventory without validation', 'review bucket records', 'bearing-only records', 'blocked records', 'records missing county/corridor/confidence/source traceability', 'governance documents as runtime data'],
    currentMilestoneBehavior: 'V694 creates architecture evidence only and does not load any directional data into runtime.',
  },
  reviewBucketIsolationArchitecture: {
    isolatedClasses: requiredReviewBuckets,
    hardExclusionModel: 'A record with any review bucket, review reason, manual-review marker, reversible/construction/HOV-HOT signal, missing county, missing oneway, or missing ref is excluded before runtime candidate set construction.',
    escapeHandling: 'Any review-bucket escape attempt invalidates the full candidate set and returns no directional intelligence.',
  },
  runtimeCandidateArchitecture: {
    eligibilityRequirements: ['strong confidence', 'valid county', 'valid corridor', 'not review-required', 'not bearing-only', 'not blocked', 'source traceability present', 'county containment pass'],
    candidateLifecycle: ['offline source evidence', 'extracted inventory', 'validated inventory', 'confidence inventory', 'review-bucket exclusion', 'county containment check', 'runtime candidate set build', 'protected runtime layer audit', 'no user-facing output unless separately authorized'],
    currentEvidenceCounts: { strongCandidates, reviewRequiredCandidates, blockedCandidates, bearingOnlyCandidates },
  },
  countyContainmentArchitecture: {
    model: 'County-aware runtime containment owns each candidate by exactly one valid county and prevents cross-county mixing.',
    requirements: ['fail closed', 'county ownership', 'no county leakage', 'no cross-county contamination'],
    enforcement: 'Missing, ambiguous, invalid, or mismatched county ownership blocks the candidate and invalidates the runtime candidate set for the affected county scope.',
  },
  failClosedArchitecture: {
    defaultOutcome: 'No directional intelligence.',
    triggers: {
      sourceMissing: 'No directional intelligence.',
      confidenceMissing: 'No directional intelligence.',
      countyMissing: 'No directional intelligence.',
      corridorInvalid: 'No directional intelligence.',
      reviewBucketPresent: 'No directional intelligence.',
      containmentFails: 'No directional intelligence.',
    },
    degradedModeProhibited: true,
  },
  runtimeAuditArchitecture: {
    futureHelpers: ['window.gridlyDirectionalRuntimeAudit?.()', 'window.gridlyDirectionalContainmentAudit?.()', 'window.gridlyDirectionalCandidateAudit?.()', 'window.gridlyDirectionalReviewBucketAudit?.()'],
    expectedOutputs: ['authorization state', 'protected-system state', 'candidate counts', 'excluded review bucket counts', 'county containment pass/fail', 'fail-closed reason list', 'runtimeChanged false until separately authorized'],
    implementedInV694: false,
  },
  runtimeSafetyArchitecture: {
    downgradePath: 'Any confidence, containment, or audit regression downgrades to no directional intelligence.',
    rollbackPath: 'Remove candidate asset reference and return protected runtime layer to no directional intelligence.',
    containmentFailureResponse: 'Block affected scope, emit audit failure, and display nothing.',
    reviewBucketEscapeResponse: 'Invalidate candidate set, emit audit failure, and display nothing.',
    confidenceRegressionResponse: 'Demote affected records to review/offline status and display nothing.',
  },
  runtimeAuthorizationBoundaries: {
    doesNotAuthorize: ['runtime activation', 'runtime loading', 'display', 'NB/SB/EB/WB labels', 'Route Watch integration', 'Alerts integration', 'Awareness integration', 'DriveTexas activation', 'Transportation Intelligence activation'],
    runtimeAuthorization: 'NOT GRANTED',
    directionalDisplayAuthorization: 'NOT GRANTED',
  },
  futurePrototypeDefinition: {
    smallestPrototype: 'A non-user-facing, county-contained, fail-closed, audit-visible runtime candidate dry-run that excludes all review buckets and produces no labels or UI.',
    requirements: ['county-contained', 'fail-closed', 'review-bucket excluded', 'audit-visible', 'user-invisible'],
    nextMilestone: 'V695 — Directional Prototype Design Package',
  },
  architectureReadinessState,
  protectedSystemsVerified,
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination,
};

fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
console.log(evidence.architectureReadinessState);
console.log(evidence.finalDetermination);
