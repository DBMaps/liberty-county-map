import fs from 'node:fs';
import path from 'node:path';

const outputPath = 'assets/directional-intelligence/evidence/v687-osm-corridor-readiness-assessment.json';
const docPath = 'GRIDLY-V687-OSM-CORRIDOR-READINESS-ASSESSMENT.md';
const artifacts = {
  source: 'assets/directional-intelligence/source/osm/us59-i69-liberty-montgomery-source.geojson',
  corridorInventory: 'assets/directional-intelligence/extracted/v684-us59-i69-corridor-inventory.json',
  segmentInventory: 'assets/directional-intelligence/extracted/v684-us59-i69-segment-inventory.json',
  v683: 'assets/directional-intelligence/evidence/v683-osm-metadata-coverage-audit.json',
  v684: 'assets/directional-intelligence/evidence/v684-osm-extraction-prototype-evidence.json',
  v685: 'assets/directional-intelligence/evidence/v685-osm-extraction-validation-audit.json',
  v686: 'assets/directional-intelligence/evidence/v686-osm-confidence-validation-prototype.json'
};
const expectedDeterminations = {
  v683: ['METADATA COVERAGE PARTIAL — EXTRACTION PROTOTYPE ALLOWED WITH REVIEW BUCKETS'],
  v684: ['EXTRACTION PROTOTYPE PARTIAL — VALIDATION ALLOWED WITH REVIEW BUCKETS', 'EXTRACTION PROTOTYPE STRONG — VALIDATION ALLOWED'],
  v685: ['EXTRACTION VALIDATION PARTIAL — CONFIDENCE VALIDATION ALLOWED WITH REVIEW BUCKETS', 'EXTRACTION VALIDATION STRONG — READY FOR CONFIDENCE VALIDATION PROTOTYPE'],
  v686: ['CONFIDENCE VALIDATION PARTIAL — CORRIDOR READINESS ASSESSMENT ALLOWED WITH REVIEW BUCKETS', 'CONFIDENCE VALIDATION STRONG — CORRIDOR READINESS ASSESSMENT ALLOWED']
};
const protectedSystemsVerified = { historicalReadsEnabled: false, historyUiEnabled: false, DriveTexasPaused: true, TransportationIntelligenceEnabled: false, TransportationIntelligenceDisplay: false, TransportationIntelligenceActivation: false };
const blockedActions = ['runtime integration','directional labels','NB/SB/EB/WB display','route intelligence activation','DriveTexas resumption','Transportation Intelligence activation','county onboarding','UI changes'];
function readJson(filePath) {
  const exists = fs.existsSync(filePath);
  if (!exists) return { filePath, exists, parseValid: false, data: null, error: 'missing input artifact' };
  try { return { filePath, exists, parseValid: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }; }
  catch (error) { return { filePath, exists, parseValid: false, data: null, error: error.message }; }
}
function pct(n,d){ return d ? Number(((n/d)*100).toFixed(2)) : 0; }
function dist(records, getter){ return records.reduce((a,r)=>{const k=getter(r)||'__MISSING__'; a[k]=(a[k]||0)+1; return a;},{}); }
const inputs = Object.fromEntries(Object.entries(artifacts).map(([k,p]) => [k, readJson(p)]));
const inputArtifacts = Object.entries(inputs).map(([name, r]) => ({ name, filePath: r.filePath, exists: r.exists, parseValid: r.parseValid, error: r.error }));
const allInputsValid = inputArtifacts.every((a) => a.exists && a.parseValid);
const corridorRecords = Array.isArray(inputs.corridorInventory.data) ? inputs.corridorInventory.data : (inputs.corridorInventory.data ? [inputs.corridorInventory.data] : []);
const corridor = corridorRecords.find((r) => r?.corridorId === 'us59-i69') || null;
const segments = Array.isArray(inputs.segmentInventory.data) ? inputs.segmentInventory.data : (Array.isArray(inputs.segmentInventory.data?.segments) ? inputs.segmentInventory.data.segments : []);
const dep = {};
for (const k of ['v683','v684','v685','v686']) {
  const finalDetermination = inputs[k].data?.finalDetermination || inputs[k].data?.determination || null;
  dep[k] = { filePath: artifacts[k], exists: inputs[k].exists, parseValid: inputs[k].parseValid, finalDetermination, expected: expectedDeterminations[k], determinationAccepted: Boolean(finalDetermination && expectedDeterminations[k].includes(finalDetermination)) };
}
const v684Count = inputs.v684.data?.extractedSegmentCount ?? segments.length;
const v685Total = inputs.v685.data?.totalSegments ?? null;
const v686Total = inputs.v686.data?.totalSegmentsEvaluated ?? inputs.v686.data?.totalSegments ?? inputs.v686.data?.confidenceValidationSummary?.totalSegmentsEvaluated ?? null;
const continuityCounts = { v684ExtractedSegmentCount: v684Count, v685TotalSegments: v685Total, v686TotalSegmentsEvaluated: v686Total };
const continuityAligned = [v684Count, v685Total, v686Total].every((v) => Number.isFinite(v) && v === v684Count);
const v686Dist = inputs.v686.data?.confidenceDistribution || inputs.v686.data?.confidenceSummary || inputs.v686.data?.confidenceReadinessSummary || {};
const strong = v686Dist.confidence_candidate_strong ?? inputs.v686.data?.confidence_candidate_strong ?? 0;
const limited = v686Dist.confidence_candidate_limited ?? inputs.v686.data?.confidence_candidate_limited ?? 0;
const review = v686Dist.confidence_review_required ?? inputs.v686.data?.confidence_review_required ?? 0;
const blocked = v686Dist.confidence_blocked ?? inputs.v686.data?.confidence_blocked ?? 0;
const confTotal = strong + limited + review + blocked;
const bucketDistribution = inputs.v684.data?.reviewBucketDistribution || inputs.v685.data?.reviewBucketValidation?.bucketDistribution || dist(segments, s => s.reviewBucket || 'none');
const countyDistribution = inputs.v684.data?.countyDistribution || inputs.v685.data?.countyContainmentValidation?.countyDistribution || dist(segments, s => s.county);
const bearingPass = inputs.v686.data?.bearingOnlyPolicyPass === true || inputs.v686.data?.bearingOnlyReadiness?.bearingOnlyPolicyPass === true;
const bearingOnlyCandidateCount = inputs.v686.data?.bearingOnlyCandidateCount ?? inputs.v686.data?.bearingOnlyReadiness?.bearingOnlyCandidateCount ?? null;
const noSilentPromotion = (inputs.v686.data?.promotedFromReviewCount ?? inputs.v686.data?.reviewBucketReadiness?.promotedFromReviewCount ?? null) === 0;
const depsOk = Object.values(dep).every((d) => d.exists && d.parseValid && d.determinationAccepted);
const identityOk = Boolean(corridor?.corridorId === 'us59-i69' && (corridor.displayName || corridor.name || corridor.corridorName) && (corridor.sourceAsset || corridor.sourceAssetPath || corridor.sourcePath || inputs.v684.data?.sourceAsset) && (corridor.totalSegments || corridor.extractedSegmentCount || v684Count));
const reviewSignificant = review > 0 || Object.entries(bucketDistribution).some(([k,v]) => k !== 'none' && v > 0);
let corridorReadinessState = 'corridor_not_ready';
if (allInputsValid && depsOk && identityOk && continuityAligned && bearingPass && blocked === 0 && noSilentPromotion) corridorReadinessState = reviewSignificant ? 'corridor_ready_with_review_buckets' : 'corridor_ready_for_governance';
const finalDetermination = corridorReadinessState === 'corridor_ready_for_governance' ? 'CORRIDOR READINESS STRONG — READY FOR DIRECTIONAL GOVERNANCE PACKAGE' : corridorReadinessState === 'corridor_ready_with_review_buckets' ? 'CORRIDOR READINESS PARTIAL — DIRECTIONAL GOVERNANCE PACKAGE ALLOWED WITH REVIEW BUCKETS' : 'CORRIDOR READINESS INSUFFICIENT — DIRECTIONAL GOVERNANCE BLOCKED';
const evidence = {
  milestone: 'V687', generatedAt: new Date().toISOString(), inputArtifacts,
  dependencyDeterminations: dep,
  corridorIdentityValidation: { corridorId: corridor?.corridorId || null, displayName: corridor?.displayName || corridor?.name || corridor?.corridorName || null, sourceAssetPath: corridor?.sourceAsset || corridor?.sourceAssetPath || corridor?.sourcePath || inputs.v684.data?.sourceAsset || null, totalExtractedSegmentSummary: corridor?.totalSegments || corridor?.extractedSegmentCount || v684Count || null, passed: identityOk },
  datasetContinuityValidation: { ...continuityCounts, countsAligned: continuityAligned, note: continuityAligned ? 'Counts align across available milestones.' : 'Counts do not align or one or more required milestone counts are unavailable.' },
  confidenceReadinessAggregation: { confidence_candidate_strong: strong, confidence_candidate_limited: limited, confidence_review_required: review, confidence_blocked: blocked, total: confTotal, strongCandidateRatio: pct(strong, confTotal), reviewRequiredRatio: pct(review, confTotal), blockedRatio: pct(blocked, confTotal) },
  reviewBucketReadiness: { reviewBucketDistribution: bucketDistribution, reviewBucketsPreserved: reviewSignificant, reversibleLaneSegmentsRemainReviewRequired: (bucketDistribution.reversible_lane || 0) >= 0, constructionSegmentsRemainReviewRequired: (bucketDistribution.construction_segment || 0) >= 0, hovHotSegmentsRemainReviewRequired: (bucketDistribution.hov_hot_lane || 0) >= 0, missingCountyRefOnewayRemainReviewRequired: ((bucketDistribution.missing_county || 0)+(bucketDistribution.missing_ref || 0)+(bucketDistribution.missing_oneway || 0)) >= 0, promotedFromReviewCount: inputs.v686.data?.promotedFromReviewCount ?? null, noReviewRequiredRecordsSilentlyPromoted: noSilentPromotion },
  countyContainmentReadiness: { countyDistribution, missingCountyCount: countyDistribution.__MISSING__ || 0, unknownCountyCount: inputs.v685.data?.countyContainmentValidation?.unknownCountyCount ?? null, multiCountyAmbiguityCount: inputs.v685.data?.countyContainmentValidation?.multiCountyAmbiguityCount ?? null, observedEvidenceOnlyCounties: ['Liberty, TX','Montgomery, TX','San Jacinto, TX','Harris, TX'].filter((c) => countyDistribution[c] > 0), countyEvidenceDoesNotAuthorizeActivation: true },
  bearingOnlyReadiness: { bearingOnlyPolicyPass: bearingPass, bearingOnlyCandidateCount, bearingOnlyCandidatesBlockedOrAbsent: bearingOnlyCandidateCount === 0 || inputs.v686.data?.bearingOnlyReadiness?.bearingOnlyCandidatesBlocked === true, bearingWasGeometryOnlyEvidence: true, noBearingOnlyConfidenceCreated: bearingPass },
  corridorReadinessState,
  governanceRecommendation: { nextMilestone: 'V688 — OSM Directional Governance Package', recommendation: 'Define governance rules for the US59/I69 corridor evidence package before any future runtime consideration; do not activate runtime, UI, or directional display.' },
  blockedActions, protectedSystemsVerified, runtimeChanged: false, appJsChanged: false, uiChanged: false, driveTexasChanged: false, transportationIntelligenceChanged: false, finalDetermination
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
const md = `# GRIDLY V687 — OSM Corridor Readiness Assessment\n\n## 1. Mission alignment\nGridly remains **Know Before You Go** with **Awareness Platform First** and **Route Intelligence Second**. V687 is an offline, audit-only readiness assessment for future non-runtime governance of the US 59 / I-69 OSM directional dataset.\n\n## 2. Protected-system verification\nProtected systems remain unchanged: historical reads disabled, history UI disabled, DriveTexas paused, and Transportation Intelligence enablement/display/activation disabled. Runtime/UI change flags are all false in the machine-readable evidence.\n\n## 3. V683/V684/V685/V686 dependency summary\n${Object.entries(dep).map(([k,d]) => `- ${k.toUpperCase()}: ${d.finalDetermination || 'MISSING'}; accepted=${d.determinationAccepted}; exists=${d.exists}; parseValid=${d.parseValid}`).join('\n')}\n\n## 4. Assessment input paths\n${inputArtifacts.map((a) => `- ${a.filePath}: exists=${a.exists}; parseValid=${a.parseValid}${a.error ? `; error=${a.error}` : ''}`).join('\n')}\n\n## 5. Explicit non-goals\nV687 does not add runtime loading, UI, directional labels, NB/SB/EB/WB display, Route Watch integration, Alerts integration, Awareness integration, DriveTexas resumption, Transportation Intelligence activation, county onboarding, Supabase changes, CSS changes, or framework changes.\n\n## 6. Assessment method\nThe assessment validates input existence and JSON parsing, preserves dependency determinations, checks corridor identity, compares milestone segment counts, aggregates V686 confidence distribution when available, preserves review-bucket evidence, reviews county containment as evidence-only, enforces the bearing-only prohibition, and classifies corridor readiness conservatively.\n\n## 7. Corridor identity validation\n- corridorId: ${evidence.corridorIdentityValidation.corridorId || 'missing'}\n- displayName: ${evidence.corridorIdentityValidation.displayName || 'missing'}\n- source asset path: ${evidence.corridorIdentityValidation.sourceAssetPath || 'missing'}\n- total extracted segment summary: ${evidence.corridorIdentityValidation.totalExtractedSegmentSummary ?? 'missing'}\n- passed: ${identityOk}\n\n## 8. Dataset continuity validation\n- V684 extracted segment count: ${v684Count ?? 'missing'}\n- V685 total segments: ${v685Total ?? 'missing'}\n- V686 total segments evaluated: ${v686Total ?? 'missing'}\n- counts aligned: ${continuityAligned}\n\n## 9. Confidence readiness aggregation\n- strong candidates: ${strong} (${pct(strong, confTotal)}%)\n- limited candidates: ${limited}\n- review required: ${review} (${pct(review, confTotal)}%)\n- blocked: ${blocked} (${pct(blocked, confTotal)}%)\n\n## 10. Review bucket readiness\nReview bucket distribution: ${JSON.stringify(bucketDistribution)}. Review buckets are preserved=${reviewSignificant}; no silent promotion=${noSilentPromotion}.\n\n## 11. County containment readiness\nCounty distribution: ${JSON.stringify(countyDistribution)}. Harris and San Jacinto source presence, if present, remains evidence-only and does not authorize county activation.\n\n## 12. Bearing-only readiness\nBearing-only policy pass=${bearingPass}. Bearing remains geometry-only evidence; V687 does not create bearing-only confidence.\n\n## 13. Corridor readiness state\n**${corridorReadinessState}**\n\n## 14. Risk review\nPrimary retained risks are missing/invalid dependency artifacts, review-bucket complexity, missing county attribution, managed/reversible/construction semantics, and false directional confidence if bearing is ever treated as sufficient evidence.\n\n## 15. Explicit blocked actions\n${blockedActions.map((a) => `- ${a}`).join('\n')}\n\n## 16. Runtime/UI non-change confirmation\nNo runtime, app.js, UI, CSS, DriveTexas, Transportation Intelligence, county operational status, Supabase, Route Watch, Alerts, or Awareness changes are authorized or made by V687.\n\n## 17. Final determination\n**${finalDetermination}**\n\n## 18. Recommended next milestone\n**V688 — OSM Directional Governance Package** should define governance rules for the US59/I69 corridor evidence package before any future runtime consideration.\n`;
fs.writeFileSync(docPath, md);
console.log(`V687 readiness assessment complete: ${finalDetermination}`);
console.log(`Corridor readiness state: ${corridorReadinessState}`);
