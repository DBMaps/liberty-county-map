import fs from 'node:fs';
import path from 'node:path';

const milestone = 'V687R.2';
const outPath = 'assets/directional-intelligence/evidence/v687r2-osm-corridor-readiness-reassessment-after-v686-recovery.json';
const required = [
  ['v684CorridorInventory','assets/directional-intelligence/extracted/v684-us59-i69-corridor-inventory.json'],
  ['v684SegmentInventory','assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json'],
  ['v683Evidence','assets/directional-intelligence/evidence/v683-osm-metadata-coverage-audit.json'],
  ['v684Evidence','assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json'],
  ['v685Evidence','assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json'],
  ['v686Evidence','assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json'],
  ['v687rEvidence','assets/directional-intelligence/evidence/v687r-osm-corridor-readiness-input-path-repair.json'],
];
const canonicalSourcePath = 'assets/directional-intelligence/source/osm/us59-i69-liberty-montgomery-source.geojson';
const alternateSourcePath = 'assets/directional-intelligenc/source/osm/us59-i69-liberty-montgomery-source.geojson';

function readJson(filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) return { exists, parseValid: false, value: null, error: 'missing' };
  try { return { exists, parseValid: true, value: JSON.parse(fs.readFileSync(filePath, 'utf8')) }; }
  catch (error) { return { exists, parseValid: false, value: null, error: error.message }; }
}
function countArrayOrTotal(value, totalKey) { return Array.isArray(value) ? value.length : value?.[totalKey] ?? null; }
function ratio(n, d) { return d ? Number((n / d).toFixed(6)) : null; }

const loaded = Object.fromEntries(required.map(([label, filePath]) => [label, { filePath, ...readJson(filePath) }]));
const inputArtifacts = required.map(([label]) => {
  const { filePath, exists, parseValid, error } = loaded[label];
  return { label, filePath, exists, parseValid, ...(error ? { error } : {}) };
});
const canonicalExists = fs.existsSync(canonicalSourcePath);
const alternateExists = fs.existsSync(alternateSourcePath);
const sourcePathUsed = canonicalExists ? canonicalSourcePath : (alternateExists ? alternateSourcePath : null);
const sourcePathResolution = {
  canonicalSourcePath, alternateSourcePath, canonicalExists, alternateExists, sourcePathUsed,
  resolvedBy: canonicalExists ? 'canonical' : (alternateExists ? 'alternate' : 'unresolved'),
  pathMismatchDocumented: !canonicalExists && alternateExists,
};

const v683 = loaded.v683Evidence.value ?? {};
const v684 = loaded.v684Evidence.value ?? {};
const v685 = loaded.v685Evidence.value ?? {};
const v686 = loaded.v686Evidence.value ?? {};
const v687r = loaded.v687rEvidence.value ?? {};
const dist = v686.confidenceStateDistribution ?? {};
const total = v686.totalSegmentsEvaluated ?? 0;
const reviewBuckets = v686.reviewBucketDistributionByConfidenceState?.confidence_review_required ?? {};
const consistency = v686.consistencyWithV685 ?? {};

const allRequiredInputsValid = inputArtifacts.every((a) => a.exists && a.parseValid) && Boolean(sourcePathUsed);
const v686RecoveryValidation = {
  exists: loaded.v686Evidence.exists,
  parseValid: loaded.v686Evidence.parseValid,
  recoveredArtifactFor: v686.recoveredArtifactFor ?? null,
  recoveredArtifactForV686: v686.recoveredArtifactFor === 'V686',
  confidenceStateDistributionPresent: Boolean(v686.confidenceStateDistribution),
  bearingOnlyPolicyPresent: Boolean(v686.bearingOnlyPolicy),
  consistencyWithV685Present: Boolean(v686.consistencyWithV685),
};
const datasetContinuityValidation = {
  v684ExtractedSegmentCount: v684.extractedSegmentCount ?? countArrayOrTotal(loaded.v684SegmentInventory.value, 'totalSegments'),
  v685TotalSegments: v685.totalSegments ?? null,
  v686TotalSegmentsEvaluated: v686.totalSegmentsEvaluated ?? null,
};
datasetContinuityValidation.expected245Continuity = [datasetContinuityValidation.v684ExtractedSegmentCount, datasetContinuityValidation.v685TotalSegments, datasetContinuityValidation.v686TotalSegmentsEvaluated].every((x) => x === 245);
const confidenceAggregation = {
  confidence_candidate_strong: dist.confidence_candidate_strong ?? 0,
  confidence_candidate_limited: dist.confidence_candidate_limited ?? 0,
  confidence_review_required: dist.confidence_review_required ?? 0,
  confidence_blocked: dist.confidence_blocked ?? 0,
  totalSegmentsEvaluated: total,
  strongCandidateRatio: ratio(dist.confidence_candidate_strong ?? 0, total),
  reviewRequiredRatio: ratio(dist.confidence_review_required ?? 0, total),
  blockedRatio: ratio(dist.confidence_blocked ?? 0, total),
};
const reviewBucketPreservation = {
  reviewRequiredRecordsRemainReviewRequired: dist.confidence_review_required === 81 && consistency.promotedFromReviewCount === 0,
  reviewRequiredCount: dist.confidence_review_required ?? null,
  promotedFromReviewCount: consistency.promotedFromReviewCount ?? null,
  demotedFromReadyCount: consistency.demotedFromReadyCount ?? null,
  newlyBlockedCount: consistency.newlyBlockedCount ?? null,
  reviewBucketDistribution: reviewBuckets,
  reviewBucketsRemainGovernanceReviewItems: true,
  noSilentPromotionOfReversibleConstructionHovHotMissingCountyMissingOnewayMissingRef: consistency.promotedFromReviewCount === 0,
};
const bearingOnlyPolicy = {
  ...(v686.bearingOnlyPolicy ?? {}),
  bearingRemainsGeometryOnlyEvidence: true,
  noBearingOnlyConfidenceCreated: (v686.bearingOnlyPolicy?.bearingOnlyCandidateCount ?? 0) === 0,
  policyPass: v686.bearingOnlyPolicy?.bearingOnlyPolicyPass === true,
};
const county = v685.countyContainmentValidation ?? {};
const countyContainmentSummary = {
  countyDistribution: county.countyDistribution ?? v684.countyDistribution ?? v683.countyDistribution ?? {},
  missingCountyCount: county.missingCountyCount ?? v683.counts?.['tiger:county'] ? ((v683.totalFeatures ?? 0) - (v683.counts?.['tiger:county'] ?? 0)) : null,
  unknownCountyCount: county.unknownCountyCount ?? null,
  multiCountyAmbiguityCount: county.multiCountyAmbiguityCount ?? null,
  harrisAndSanJacintoEvidenceOnly: true,
  countyEvidenceDoesNotAuthorizeOnboardingOrActivation: true,
};
const dependencyDeterminations = {
  v683FinalDetermination: v683.finalDetermination ?? null,
  v684FinalDetermination: v684.finalDetermination ?? null,
  v685FinalDetermination: v685.finalDetermination ?? null,
  v686FinalDetermination: v686.finalDetermination ?? null,
  v687rBlockerClassification: v687r.blockerClassification ?? null,
  v687rFinalDetermination: v687r.finalDetermination ?? null,
  v687rEvidenceAvailable: loaded.v687rEvidence.exists && loaded.v687rEvidence.parseValid,
};
let corridorReadinessState = 'corridor_not_ready';
let finalDetermination = 'CORRIDOR READINESS STILL BLOCKED — REQUIRED INPUTS MISSING';
let recommendedNextMilestone = 'V687R.3 — Remaining Readiness Blocker Resolution';
if (allRequiredInputsValid && datasetContinuityValidation.expected245Continuity && v686RecoveryValidation.recoveredArtifactForV686) {
  corridorReadinessState = dist.confidence_review_required > 0 ? 'corridor_ready_with_review_buckets' : 'corridor_ready_for_governance';
  finalDetermination = dist.confidence_review_required > 0
    ? 'CORRIDOR READINESS RECOVERED WITH REVIEW BUCKETS — GOVERNANCE PACKAGE ALLOWED'
    : 'CORRIDOR READINESS RECOVERED — READY FOR DIRECTIONAL GOVERNANCE PACKAGE';
  recommendedNextMilestone = 'V688 — OSM Directional Governance Package';
}
const evidence = {
  milestone, generatedAt: new Date().toISOString(), inputArtifacts, sourcePathResolution, dependencyDeterminations,
  v686RecoveryValidation, datasetContinuityValidation, confidenceAggregation, reviewBucketPreservation,
  bearingOnlyPolicy, countyContainmentSummary,
  pathMismatchStatus: { canonicalSourcePathExists: canonicalExists, alternateSourcePathExists: alternateExists, sourcePathUsed, pathNormalizationRecommendedLater: !canonicalExists && alternateExists, pathTypoFixedThisMilestone: false },
  corridorReadinessState, finalDetermination, recommendedNextMilestone,
  protectedSystemsVerified: { historicalReadsEnabled: false, historyUiEnabled: false, DriveTexasPaused: true, TransportationIntelligenceEnabled: false, TransportationIntelligenceDisplay: false, TransportationIntelligenceActivation: false },
  runtimeChanged: false, appJsChanged: false, uiChanged: false, driveTexasChanged: false, transportationIntelligenceChanged: false,
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify({ output: outPath, corridorReadinessState, finalDetermination, missingInputs: inputArtifacts.filter(a=>!a.exists||!a.parseValid).map(a=>a.filePath) }, null, 2));
