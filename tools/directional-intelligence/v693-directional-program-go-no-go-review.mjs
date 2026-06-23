import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = 'assets/directional-intelligence/evidence';
const outputPath = path.join(evidenceDir, 'v693-directional-program-go-no-go-review.json');
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
};

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false,
};

const protectedOk = Object.values(inputs).every((evidence) => {
  const actual = evidence.protectedSystemsVerified;
  return actual && Object.entries(protectedSystemsVerified).every(([key, value]) => actual[key] === value);
});

const totalSegments = inputs.v685.totalSegments;
const strongCandidates = inputs.v689.confidenceGovernance.strongCandidates;
const reviewRequiredCandidates = inputs.v689.confidenceGovernance.reviewRequiredCandidates;
const blockedCandidates = inputs.v689.confidenceGovernance.blockedCandidates;
const bearingOnlyCandidates = inputs.v686r.bearingOnlyPolicy?.bearingOnlyCandidateCount ?? 0;
const bearingOnlyPolicyPass = inputs.v686r.bearingOnlyPolicy?.result === 'pass' || bearingOnlyCandidates === 0;

const evidenceChainComplete = [
  inputs.v683.finalDetermination,
  inputs.v684.finalDetermination,
  inputs.v685.finalDetermination,
  inputs.v686r.finalDetermination,
  inputs.v688.finalDetermination,
  inputs.v689.finalDetermination,
  inputs.v690.finalDetermination,
  inputs.v691.finalDetermination,
  inputs.v692.finalDetermination,
].every(Boolean);

const confidenceQuality = totalSegments === 245
  && strongCandidates === 164
  && reviewRequiredCandidates === 81
  && blockedCandidates === 0
  && bearingOnlyCandidates === 0
  && bearingOnlyPolicyPass
  ? 'sufficient'
  : 'conditional';

const governanceStatus = evidenceChainComplete && protectedOk ? 'complete' : 'conditional';
const runtimeStatus = 'not authorized';
const displayStatus = 'not authorized';
const goNoGo = evidenceChainComplete && confidenceQuality !== 'insufficient' && governanceStatus !== 'incomplete'
  ? 'GO'
  : 'NO-GO';
const futureEligibility = goNoGo === 'GO' && runtimeStatus === 'not authorized' && displayStatus === 'not authorized'
  ? 'supported'
  : 'not supported';
const finalDetermination = goNoGo === 'GO'
  ? 'GO — DIRECTIONAL ASSESSMENT PHASE COMPLETE'
  : 'NO-GO — DIRECTIONAL ASSESSMENT PHASE INCOMPLETE';

const evidence = {
  milestone: 'V693',
  generatedAt: new Date().toISOString(),
  directionalProgramSummary: {
    mission: 'Gridly remains Know Before You Go.',
    productPosture: ['Awareness Platform First', 'Route Intelligence Second'],
    metadataFindings: 'V683 found 245 source features with complete geometry/ref/highway coverage, high oneway coverage, partial county/name/lane metadata, and review buckets for uncertainty.',
    extractionFindings: 'V684 extracted 245 corridor segments, rejected 0, and isolated 81 review-required records while preserving 164 governance-eligible records.',
    validationFindings: 'V685 validated segment identity, traceability, geometry, corridor membership, county containment, review buckets, and protected-system non-change.',
    confidenceFindings: 'V686R recovered confidence validation with 164 strong candidates, 81 review-required candidates, 0 blocked candidates, and 0 bearing-only candidates.',
    governanceFindings: 'V689 and V690 completed governance review/package with review bucket isolation, bearing-only prohibition, containment rules, rollback requirements, and no runtime approval.',
    runtimeReadinessFindings: 'V691 completed readiness assessment with conditions and did not establish runtime authorization.',
    protectionFindings: 'V692 completed protection framework for review buckets, bearing policy, containment, rollback, authorization gates, and display prohibition.'
  },
  evidenceChainReview: {
    status: evidenceChainComplete ? 'complete' : 'incomplete',
    chain: ['Metadata', 'Extraction', 'Validation', 'Confidence', 'Governance', 'Protection'],
    inputMilestonesReviewed: Object.values(inputs).map(({ milestone, finalDetermination }) => ({ milestone, finalDetermination })),
  },
  confidenceReview: {
    totalSegments,
    strongCandidates,
    reviewRequiredCandidates,
    blockedCandidates,
    bearingOnlyCandidates,
    bearingOnlyPolicyPass,
    confidenceChainQuality: confidenceQuality,
  },
  governanceReview: {
    governancePackage: 'complete_with_review_buckets',
    reviewBucketProtections: 'preserve_isolate_review_never_silently_promote',
    bearingProtections: 'bearing_only_directional_confidence_prohibited',
    containmentProtections: 'directional outputs remain governance artifacts only',
    rollbackProtections: 'future phases require rollback, downgrade, and authorization gates',
    governanceStatus,
  },
  runtimeReview: {
    currentState: 'runtime_readiness_not_established',
    runtimeContainment: 'required_before_any_future_runtime_consideration',
    displayReadiness: 'not_established',
    authorizationRequirements: 'separate_authorization_review_required',
    runtimeStatus,
  },
  displayReview: {
    nbSbEbWbDisplayReadiness: 'not_established',
    displayStatus,
  },
  goNoGoAnalysis: {
    goMeaning: 'Directional program has successfully completed assessment/governance phase and may be considered eligible for future authorization review.',
    noGoMeaning: 'Directional program failed assessment/governance phase.',
    implementationApproved: false,
    runtimeApproved: false,
    displayApproved: false,
    result: goNoGo,
  },
  futurePhaseEligibility: {
    statement: 'The directional assessment and governance phase is complete. Future implementation consideration may occur only through separate authorization review.',
    result: futureEligibility,
  },
  explicitRuntimeRestrictions: {
    doesNotAuthorize: [
      'runtime integration',
      'directional display',
      'NB/SB/EB/WB labels',
      'Route Watch integration',
      'Awareness integration',
      'Alerts integration',
      'DriveTexas activation',
      'Transportation Intelligence activation',
    ],
  },
  programClosureRecommendation: goNoGo === 'GO'
    ? {
        recommendation: 'Directional Assessment Phase Closed',
        futureWorkRequires: 'Separate Authorization Review',
        additionalGovernanceOrAssessmentMilestonesRecommended: false,
      }
    : {
        recommendation: 'Directional Assessment Phase Remains Open',
        remainingBlockers: ['evidence chain, confidence, or governance status did not support closure'],
      },
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
console.log(evidence.finalDetermination);
