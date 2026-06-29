import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = 'assets/directional-intelligence/evidence';
const outputPath = path.join(evidenceDir, 'v690-directional-governance-package.json');
const docPath = 'GRIDLY-V690-DIRECTIONAL-GOVERNANCE-PACKAGE.md';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const v683 = readJson(path.join(evidenceDir, 'v683-osm-metadata-coverage-audit.json'));
const v684 = readJson(path.join(evidenceDir, 'v684-osm-extraction-prototype-evidence.json'));
const v685 = readJson(path.join(evidenceDir, 'v685-osm-extraction-validation-audit.json'));
const v686r = readJson(path.join(evidenceDir, 'v686-osm-confidence-validation-prototype.json'));
const v688 = readJson(path.join(evidenceDir, 'v688-directional-evidence-recovery-and-consolidation.json'));
const v689 = readJson(path.join(evidenceDir, 'v689-directional-governance-review.json'));

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false,
};

const totalSegments = v689.confidenceGovernance.totalSegments;
const strongCandidates = v689.confidenceGovernance.strongCandidates;
const reviewRequiredCandidates = v689.confidenceGovernance.reviewRequiredCandidates;
const blockedCandidates = v689.confidenceGovernance.blockedCandidates;
const bearingOnlyPolicyPass = v689.bearingGovernance.bearingOnlyPolicyPass === true;

let governancePackageState = 'GOVERNANCE PACKAGE INCOMPLETE';
if (totalSegments > 0 && strongCandidates > 0 && blockedCandidates === 0 && reviewRequiredCandidates > 0 && bearingOnlyPolicyPass) {
  governancePackageState = 'GOVERNANCE PACKAGE COMPLETE WITH REVIEW BUCKETS';
} else if (totalSegments > 0 && strongCandidates > 0 && blockedCandidates === 0 && reviewRequiredCandidates === 0 && bearingOnlyPolicyPass) {
  governancePackageState = 'GOVERNANCE PACKAGE COMPLETE';
}

const finalDetermination = governancePackageState === 'GOVERNANCE PACKAGE INCOMPLETE'
  ? 'DIRECTIONAL GOVERNANCE PACKAGE INCOMPLETE — DO NOT PROCEED'
  : `${governancePackageState} — V691 ASSESSMENT ALLOWED`;

const packageEvidence = {
  milestone: 'V690',
  generatedAt: new Date().toISOString(),
  inputEvidence: [
    { milestone: 'V683', path: path.join(evidenceDir, 'v683-osm-metadata-coverage-audit.json'), determination: v683.finalDetermination },
    { milestone: 'V684', path: path.join(evidenceDir, 'v684-osm-extraction-prototype-evidence.json'), determination: v684.finalDetermination },
    { milestone: 'V685', path: path.join(evidenceDir, 'v685-osm-extraction-validation-audit.json'), determination: v685.finalDetermination },
    { milestone: 'V686R', path: path.join(evidenceDir, 'v686-osm-confidence-validation-prototype.json'), determination: v686r.finalDetermination },
    { milestone: 'V688', path: path.join(evidenceDir, 'v688-directional-evidence-recovery-and-consolidation.json'), determination: v688.finalDetermination },
    { milestone: 'V689', path: path.join(evidenceDir, 'v689-directional-governance-review.json'), determination: v689.finalDetermination },
  ],
  directionalMissionStandard: {
    posture: ['Awareness Platform First', 'Route Intelligence Second'],
    purpose: 'Directional intelligence exists to improve awareness quality and does not transform Gridly into a navigation platform.',
    allowed: ['awareness enhancement', 'corridor intelligence', 'confidence evaluation', 'governance review'],
    notAllowed: ['navigation behavior', 'route guidance', 'turn-by-turn instructions', 'consumer directional display'],
  },
  metadataGovernance: {
    sourceMilestone: 'V683',
    requiredCategories: ['corridor identity', 'county attribution', 'roadway classification', 'geometry evidence', 'directional evidence', 'lane evidence'],
    coverageRequiredBeforeFutureCorridorProgression: true,
    summary: { totalFeatures: v683.totalFeatures, counts: v683.counts, confidenceRiskCounts: v683.confidenceRiskCounts },
  },
  extractionGovernance: {
    sourceMilestone: 'V684',
    requirements: ['source traceability', 'stable identifiers', 'geometry preservation', 'county preservation', 'review bucket assignment', 'evidence preservation'],
    blockingFailures: ['missing or unstable source identifiers', 'lost geometry', 'lost county attribution where source provided it', 'unassigned protected review evidence', 'rejected or unparseable extracted inventory', 'missing evidence chain'],
    summary: { extractedSegmentCount: v684.extractedSegmentCount, reviewSegmentCount: v684.reviewSegmentCount, rejectedSegmentCount: v684.rejectedSegmentCount },
  },
  validationGovernance: {
    sourceMilestone: 'V685',
    requiredCategories: ['identifier integrity', 'source traceability', 'geometry integrity', 'corridor membership', 'county containment', 'review bucket correctness', 'extraction status integrity'],
    summary: {
      totalSegments: v685.totalSegments,
      extractedCount: v685.extractedCount,
      extractedWithReviewCount: v685.extractedWithReviewCount,
      rejectedCount: v685.rejectedCount,
      bearingNote: v685.geometryValidation.bearingNote,
    },
  },
  confidenceGovernance: {
    sourceMilestone: 'V686R',
    states: ['confidence_candidate_strong', 'confidence_candidate_limited', 'confidence_review_required', 'confidence_blocked'],
    distribution: v686r.confidenceStateDistribution,
    strongCandidateTreatment: 'governance eligible, not runtime approved',
  },
  reviewBucketGovernance: {
    sourceMilestone: 'V689',
    protectedBuckets: ['reversible_lane', 'construction_segment', 'hov_hot_lane', 'missing_county', 'missing_oneway', 'missing_ref', 'manual_review_required'],
    bucketDistribution: v689.reviewBucketGovernance.buckets,
    requiredTreatment: ['preserve', 'isolate', 'review', 'never silently promote'],
    reviewBucketBypassProhibited: true,
  },
  bearingGovernance: {
    allowedUse: 'geometry evidence',
    prohibitedUses: ['standalone directional confidence', 'bearing-only runtime behavior', 'bearing-only display'],
    bearingOnlyConfidenceProhibited: true,
    bearingOnlyPolicyPass,
    bearingOnlyCandidates: v689.bearingGovernance.bearingOnlyCandidates,
  },
  readinessGovernance: {
    states: ['governance_candidate', 'governance_review_required', 'governance_blocked'],
    thresholds: {
      governance_candidate: 'validated extraction, non-bearing confidence evidence, no protected review bucket, no blocked condition',
      governance_review_required: 'valid evidence chain with protected review bucket or uncertainty requiring isolation and review',
      governance_blocked: 'missing or corrupted required evidence, bearing-only reliance, failed validation, or unsafe promotion attempt',
    },
    downgradeConditions: v689.downgradeGovernance.downgradeTriggers,
    counts: v689.readinessGovernance.counts,
  },
  evidenceGovernance: {
    requiredEvidenceChain: ['Metadata', 'Extraction', 'Validation', 'Confidence', 'Governance'],
    futureCorridorsMustNotBypassChain: true,
    sourceMilestone: 'V688',
  },
  expansionGovernance: {
    requiredSequence: ['Metadata Coverage Audit', 'Extraction', 'Extraction Validation', 'Confidence Validation', 'Evidence Consolidation', 'Governance Review', 'Governance Package'],
    noFastTrackBypassAllowed: true,
  },
  runtimeProtectionGovernance: {
    governanceCompletionDoesNotEqualRuntimeAuthorization: true,
    doesNotAuthorize: ['runtime integration', 'directional display', 'NB/SB/EB/WB labels', 'Route Watch integration', 'Awareness integration', 'Alerts integration', 'DriveTexas activation', 'Transportation Intelligence activation'],
  },
  governancePackageState,
  nextPhaseRecommendation: governancePackageState === 'GOVERNANCE PACKAGE INCOMPLETE' ? null : 'V691 — Directional Runtime Readiness Assessment (assessment only; not runtime integration, display, or activation)',
  protectedSystemsVerified,
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination,
};

fs.writeFileSync(outputPath, `${JSON.stringify(packageEvidence, null, 2)}\n`);

const md = `# GRIDLY V690 — Directional Governance Package

## 1. Mission alignment

Gridly remains **Know Before You Go**.

The permanent directional mission standard is:

1. **Awareness Platform First**
2. **Route Intelligence Second**

Directional intelligence exists to improve awareness quality. It does **not** transform Gridly into a navigation platform.

Allowed uses are awareness enhancement, corridor intelligence, confidence evaluation, and governance review. Prohibited uses are navigation behavior, route guidance, turn-by-turn instructions, and consumer directional display.

## 2. Protected-system verification

Protected systems remain unchanged:

| Protected system | Required value | V690 verified value |
| --- | ---: | ---: |
| historicalReadsEnabled | false | ${protectedSystemsVerified.historicalReadsEnabled} |
| historyUiEnabled | false | ${protectedSystemsVerified.historyUiEnabled} |
| DriveTexasPaused | true | ${protectedSystemsVerified.DriveTexasPaused} |
| TransportationIntelligenceEnabled | false | ${protectedSystemsVerified.TransportationIntelligenceEnabled} |
| TransportationIntelligenceDisplay | false | ${protectedSystemsVerified.TransportationIntelligenceDisplay} |
| TransportationIntelligenceActivation | false | ${protectedSystemsVerified.TransportationIntelligenceActivation} |

## 3. Directional evidence summary

Authoritative V690 evidence consolidates V683, V684, V685, V686R, V688, and V689.

- Total segments: **${totalSegments}**
- Governance-eligible strong candidates: **${strongCandidates}**
- Governance review-required candidates: **${reviewRequiredCandidates}**
- Blocked candidates: **${blockedCandidates}**
- Bearing-only candidates: **${packageEvidence.bearingGovernance.bearingOnlyCandidates}**
- Bearing-only policy pass: **${bearingOnlyPolicyPass}**

## 4. Metadata governance standard

Required metadata categories before future corridor progression:

- corridor identity
- county attribution
- roadway classification
- geometry evidence
- directional evidence
- lane evidence

V683 establishes that metadata coverage is required before future corridor progression. Partial metadata may proceed only with preserved review buckets and must not silently become runtime confidence.

## 5. Extraction governance standard

Extraction requirements:

- source traceability
- stable identifiers
- geometry preservation
- county preservation
- review bucket assignment
- evidence preservation

Extraction failures that block progression include missing or unstable source identifiers, lost geometry, lost source-provided county attribution, unassigned protected review evidence, rejected or unparseable extracted inventory, or missing evidence chain continuity.

## 6. Validation governance standard

Required validation categories:

- identifier integrity
- source traceability
- geometry integrity
- corridor membership
- county containment
- review bucket correctness
- extraction status integrity

Bearing remains geometry-only evidence during validation.

## 7. Confidence governance standard

Authoritative confidence states:

- confidence_candidate_strong
- confidence_candidate_limited
- confidence_review_required
- confidence_blocked

Strong candidates are **governance eligible**. They are **not runtime approved**.

Current confidence distribution:

| Confidence state | Count |
| --- | ---: |
| confidence_candidate_strong | ${v686r.confidenceStateDistribution.confidence_candidate_strong} |
| confidence_candidate_limited | ${v686r.confidenceStateDistribution.confidence_candidate_limited} |
| confidence_review_required | ${v686r.confidenceStateDistribution.confidence_review_required} |
| confidence_blocked | ${v686r.confidenceStateDistribution.confidence_blocked} |

## 8. Review bucket governance standard

Protected review buckets:

- reversible_lane
- construction_segment
- hov_hot_lane
- missing_county
- missing_oneway
- missing_ref
- manual_review_required

Required treatment is to **preserve**, **isolate**, **review**, and **never silently promote**. Review bucket bypass is prohibited.

## 9. Bearing governance standard

Bearing may be used only as geometry evidence.

Bearing may not be used as standalone directional confidence. Bearing-only confidence is prohibited. Bearing-only runtime behavior is prohibited. Bearing-only display is prohibited.

## 10. Readiness governance standard

Authoritative readiness states:

- governance_candidate
- governance_review_required
- governance_blocked

Evidence thresholds:

- governance_candidate requires validated extraction, non-bearing confidence evidence, no protected review bucket, and no blocked condition.
- governance_review_required applies to valid evidence with protected review buckets or uncertainty requiring isolation and review.
- governance_blocked applies to missing or corrupted required evidence, bearing-only reliance, failed validation, or unsafe promotion attempts.

Downgrade conditions include confidence regression, source corruption, metadata loss, review bucket growth, bearing-only reliance, and extraction instability.

## 11. Evidence governance standard

Required evidence chain:

Metadata
↓
Extraction
↓
Validation
↓
Confidence
↓
Governance

Future corridors must not bypass this chain.

## 12. Expansion governance standard

Minimum required sequence before future corridors may enter evaluation:

Metadata Coverage Audit
↓
Extraction
↓
Extraction Validation
↓
Confidence Validation
↓
Evidence Consolidation
↓
Governance Review
↓
Governance Package

No fast-track bypass is allowed.

## 13. Runtime protection governance standard

V690 does **not** authorize runtime integration, directional display, NB/SB/EB/WB labels, Route Watch integration, Awareness integration, Alerts integration, DriveTexas activation, or Transportation Intelligence activation.

Governance completion does not equal runtime authorization.

## 14. Risk review

Primary risks remain review-bucket promotion, bearing-only misuse, source metadata regression, county attribution gaps, construction/reversible-lane ambiguity, and accidental runtime coupling. V690 mitigates these risks by preserving review buckets, prohibiting bypass, restricting bearing to geometry evidence, and explicitly blocking runtime activation.

## 15. Explicit blocked actions

Blocked actions include runtime loading, UI changes, directional labels, NB/SB/EB/WB display, inferred displayed direction, Route Watch connection, Alerts connection, Awareness connection, DriveTexas resumption, Transportation Intelligence enablement, county operational status changes, Supabase changes, and framework introduction.

## 16. Runtime/UI non-change confirmation

V690 created governance documentation, a governance package generator, and governance evidence only. It does not modify \`js/app.js\`, \`index.html\`, CSS, runtime loading, UI, DriveTexas, Transportation Intelligence, Supabase, or county operational status.

## 17. Final determination

**${finalDetermination}**

Governance package state: **${governancePackageState}**

## 18. Recommended next milestone

${packageEvidence.nextPhaseRecommendation ?? 'No next milestone recommended until package deficiencies are resolved.'}
`;

fs.writeFileSync(docPath, md);
console.log(finalDetermination);
console.log(`Wrote ${outputPath}`);
console.log(`Wrote ${docPath}`);
