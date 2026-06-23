import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const outputPath = 'assets/directional-intelligence/evidence/v689-directional-governance-review.json';

const inputs = {
  v683: readJson('assets/directional-intelligence/evidence/v683-osm-metadata-coverage-audit.json'),
  v684: readJson('assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json'),
  v685: readJson('assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json'),
  v686r: readJson('assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json'),
  v688: readJson('assets/directional-intelligence/evidence/v688-directional-evidence-recovery-and-consolidation.json')
};

const summary = inputs.v688.consolidatedConfidenceSummary;
const reviewBucketDistribution = {
  reversible_lane: summary.reviewBucketDistribution.reversible_lane ?? 0,
  construction_segment: summary.reviewBucketDistribution.construction_segment ?? 0,
  hov_hot_lane: summary.reviewBucketDistribution.hov_hot_lane ?? 0,
  missing_county: summary.reviewBucketDistribution.missing_county ?? 0,
  missing_oneway: summary.reviewBucketDistribution.missing_oneway ?? 0,
  missing_ref: summary.reviewBucketDistribution.missing_ref ?? 0,
  manual_review_required: summary.reviewBucketDistribution.manual_review_required ?? 0
};

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false
};

const reviewRequiredExists = summary.reviewRequiredCandidates > 0;
const blockedExists = summary.blockedCandidates > 0;
const bearingPolicyPass = summary.bearingOnlyCandidates === 0 && summary.bearingOnlyPolicyPass === true;
const evidenceChainAllowed = inputs.v688.finalDetermination === 'DIRECTIONAL EVIDENCE CHAIN COMPLETE WITH REVIEW BUCKETS — GOVERNANCE REVIEW ALLOWED'
  || inputs.v688.finalDetermination === 'DIRECTIONAL EVIDENCE CHAIN COMPLETE — READY FOR GOVERNANCE REVIEW';

const governanceReadinessState = !evidenceChainAllowed || !bearingPolicyPass || blockedExists
  ? 'GOVERNANCE REVIEW INSUFFICIENT — GOVERNANCE PACKAGE BLOCKED'
  : reviewRequiredExists
    ? 'GOVERNANCE REVIEW COMPLETE WITH REVIEW BUCKETS — GOVERNANCE PACKAGE ALLOWED'
    : 'GOVERNANCE REVIEW COMPLETE — READY FOR GOVERNANCE PACKAGE';

const finalDetermination = governanceReadinessState;

const out = {
  milestone: 'V689',
  generatedAt: new Date().toISOString(),
  inputEvidence: [
    { milestone: 'V683', determination: inputs.v683.finalDetermination },
    { milestone: 'V684', determination: inputs.v684.finalDetermination },
    { milestone: 'V685', determination: inputs.v685.finalDetermination },
    { milestone: 'V686R', determination: inputs.v686r.finalDetermination },
    { milestone: 'V688', determination: inputs.v688.finalDetermination }
  ],
  directionalMissionAlignment: {
    posture: ['Awareness Platform First', 'Route Intelligence Second'],
    allowed: ['awareness improvement', 'corridor understanding', 'confidence evaluation', 'governance readiness'],
    notAllowed: ['navigation application behavior', 'turn-by-turn logic', 'route guidance', 'consumer directional display'],
    result: 'aligned_when_used_only_for_awareness_and_governance_review'
  },
  confidenceGovernance: {
    totalSegments: summary.totalSegments,
    strongCandidates: summary.strongConfidenceCandidates,
    reviewRequiredCandidates: summary.reviewRequiredCandidates,
    blockedCandidates: summary.blockedCandidates,
    trustedDirectionalEvidence: 'multiple non-bearing metadata signals with validated extraction continuity, no review bucket, no source instability, and no protected-system dependency',
    reviewRequiredDirectionalEvidence: 'any segment carrying reversible lane, construction, HOV/HOT, missing county, missing oneway, missing ref, manual review, or other uncertainty requiring human/governance review',
    unacceptableDirectionalEvidence: 'bearing-only evidence, corrupted source evidence, missing required metadata after prior coverage, silently promoted review records, or evidence that depends on runtime/display activation',
    strongCandidateTreatment: 'governance-eligible_not_runtime-approved',
    result: 'strong candidates are governance-eligible only; review-required candidates remain isolated for review'
  },
  reviewBucketGovernance: {
    buckets: reviewBucketDistribution,
    requiredTreatment: ['preserve', 'isolate', 'review', 'never silently promote'],
    protectedBuckets: Object.keys(reviewBucketDistribution),
    result: 'review buckets remain protected governance review items'
  },
  bearingGovernance: {
    bearingOnlyCandidates: summary.bearingOnlyCandidates,
    bearingOnlyPolicyPass: summary.bearingOnlyPolicyPass,
    allowedUse: 'geometry evidence',
    prohibitedUse: 'standalone directional confidence',
    result: bearingPolicyPass ? 'bearing-only directional evidence prohibited and absent' : 'bearing-only policy failure blocks governance package'
  },
  countyGovernance: {
    countyDistribution: summary.countyDistribution,
    sourceCountyPresenceDoesNotAuthorize: ['onboarding', 'activation', 'operational status'],
    countyEvidenceTreatment: 'informational only',
    result: 'county evidence does not change county status or activation posture'
  },
  readinessGovernance: {
    states: ['governance_candidate', 'governance_review_required', 'governance_blocked'],
    mapping: {
      strongConfidenceCandidates: 'governance_candidate',
      reviewRequiredCandidates: 'governance_review_required',
      blockedCandidates: 'governance_blocked'
    },
    counts: {
      governance_candidate: summary.strongConfidenceCandidates,
      governance_review_required: summary.reviewRequiredCandidates,
      governance_blocked: summary.blockedCandidates
    }
  },
  downgradeGovernance: {
    downgradeTriggers: ['confidence regression', 'source corruption', 'metadata loss', 'review bucket growth', 'bearing-only reliance', 'extraction instability'],
    requiredAction: 'downgrade affected records to governance_review_required or governance_blocked until evidence is revalidated'
  },
  expansionGovernance: {
    requiredChain: ['source asset', 'metadata coverage audit', 'extraction', 'extraction validation', 'confidence validation', 'evidence consolidation', 'governance review'],
    bypassProhibited: true,
    result: 'future corridors must not bypass the authoritative chain'
  },
  runtimeProtectionReview: {
    doesNotAuthorize: ['runtime integration', 'directional display', 'NB/SB/EB/WB', 'Route Watch integration', 'Awareness integration', 'Alerts integration', 'DriveTexas activation', 'Transportation Intelligence activation'],
    result: 'no runtime, UI, display, DriveTexas, or Transportation Intelligence authorization'
  },
  governanceReadinessState,
  governanceRecommendation: governanceReadinessState.includes('BLOCKED') ? 'Resolve governance blockers before packaging.' : 'V690 — Directional Governance Package',
  protectedSystemsVerified,
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination
};

fs.writeFileSync(path.join(root, outputPath), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify({ generated: outputPath, governanceReadinessState, finalDetermination }, null, 2));
