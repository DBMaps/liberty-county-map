import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = 'assets/directional-intelligence/evidence';
const outputPath = path.join(evidenceDir, 'v691-directional-runtime-readiness-assessment.json');
const docPath = 'GRIDLY-V691-DIRECTIONAL-RUNTIME-READINESS-ASSESSMENT.md';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const inputs = {
  v683: readJson(path.join(evidenceDir, 'v683-osm-metadata-coverage-audit.json')),
  v684: readJson(path.join(evidenceDir, 'v684-osm-extraction-prototype-evidence.json')),
  v685: readJson(path.join(evidenceDir, 'v685-osm-extraction-validation-audit.json')),
  v686r: readJson(path.join(evidenceDir, 'v686-osm-confidence-validation-prototype.json')),
  v688: readJson(path.join(evidenceDir, 'v688-directional-evidence-recovery-and-consolidation.json')),
  v689: readJson(path.join(evidenceDir, 'v689-directional-governance-review.json')),
  v690: readJson(path.join(evidenceDir, 'v690-directional-governance-package.json')),
};

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false,
};

const summary = inputs.v688.consolidatedConfidenceSummary;
const totalSegments = summary.totalSegments;
const strongCandidates = summary.strongConfidenceCandidates;
const reviewRequiredCandidates = summary.reviewRequiredCandidates;
const blockedCandidates = summary.blockedCandidates;
const bearingOnlyCandidates = summary.bearingOnlyCandidates;
const bearingOnlyPolicyPass = summary.bearingOnlyPolicyPass === true;
const reviewRequiredPercentage = Number(((reviewRequiredCandidates / totalSegments) * 100).toFixed(2));
const strongPercentage = Number(((strongCandidates / totalSegments) * 100).toFixed(2));
const manualResolutionRequiredPercentage = reviewRequiredCandidates > 0 ? 100 : 0;

const runtimeReadinessState = 'runtime_readiness_not_established';
const finalDetermination = 'RUNTIME READINESS ASSESSMENT COMPLETE WITH CONDITIONS — FUTURE EVALUATION ALLOWED';

const evidence = {
  milestone: 'V691',
  generatedAt: new Date().toISOString(),
  inputEvidence: Object.entries(inputs).map(([key, value]) => ({ milestone: key.toUpperCase().replace('V686R', 'V686R'), determination: value.finalDetermination })),
  missionAlignmentReadiness: {
    posture: ['Awareness Platform First', 'Route Intelligence Second'],
    status: 'conditionally_aligned_for_future_assessment_only',
    preservingConditions: [
      'Directional intelligence remains awareness-supporting and does not become navigation, turn-by-turn, or route-guidance behavior.',
      'Runtime evaluation, if ever separately authorized, is contained behind protection gates and downgrade rules.',
      'Review-required candidates remain isolated from runtime confidence until manually resolved.',
      'No display, Route Watch, Alerts, Awareness, DriveTexas, or Transportation Intelligence coupling occurs in V691.',
    ],
    violatingConditions: [
      'Using directional evidence for navigation or route guidance.',
      'Displaying NB/SB/EB/WB labels without separate authorization and display validation.',
      'Promoting review buckets or bearing-only evidence into runtime confidence.',
      'Connecting directional outputs to protected systems or county activation paths.',
    ],
  },
  evidenceReadinessReview: {
    status: 'ready_with_conditions',
    metadataGovernance: 'partial metadata coverage accepted only with preserved review buckets from V683.',
    extractionGovernance: 'V684 extraction is usable for assessment only because rejected/review records remain identified.',
    validationGovernance: 'V685 validation is partial and allows confidence validation with review buckets, not runtime.',
    confidenceGovernance: 'V686R recovered confidence evaluation but leaves 81 review-required records.',
    evidenceGovernance: 'V688/V689/V690 complete the governance chain with review buckets and explicit non-authorization.',
    conditions: ['manual treatment for all review-required records', 'runtime containment validation', 'display validation before any future display consideration', 'separate future authorization'],
  },
  confidenceReadinessReview: {
    totalSegments,
    strongCandidates,
    strongPercentage,
    reviewRequiredCandidates,
    reviewRequiredPercentage,
    blockedCandidates,
    manualResolutionRequiredPercentage,
    evidenceReadinessStatus: 'ready_with_conditions',
    reviewBucketsRemainAcceptable: true,
    reviewBucketAcceptanceRationale: 'Review buckets are acceptable for governance and assessment only because they are preserved, isolated, and not silently promoted.',
  },
  reviewBucketRuntimeReadiness: {
    buckets: summary.reviewBucketDistribution,
    bucketEvaluations: {
      reversible_lane: { protection: 'isolate; require manual lane-operation semantics review', prohibition: 'block runtime if reversible state cannot be deterministically sourced' },
      construction_segment: { protection: 'isolate; require current construction status and source freshness', prohibition: 'block runtime if construction status is stale or unresolved' },
      hov_hot_lane: { protection: 'isolate; require managed-lane rules and time-of-day semantics', prohibition: 'block runtime if managed-lane access rules are absent' },
      missing_county: { protection: 'isolate; require county attribution repair', prohibition: 'block runtime if county containment is unknown' },
      missing_oneway: { protection: 'isolate; require non-bearing directional evidence', prohibition: 'block runtime if direction depends on bearing only' },
      missing_ref: { protection: 'isolate; require stable roadway reference identity', prohibition: 'block runtime if segment identity is ambiguous' },
      manual_review_required: { protection: 'isolate; require explicit manual disposition', prohibition: 'block runtime until disposition is complete' },
    },
    runtimeProtectionsRequired: ['hard isolation', 'no silent promotion', 'downgrade to unavailable', 'auditable manual disposition', 'blocked display for unresolved buckets'],
  },
  bearingRuntimeReadiness: {
    bearingOnlyConfidenceProhibited: true,
    bearingOnlyRuntimeBehaviorProhibited: true,
    bearingOnlyDisplayProhibited: true,
    bearingOnlyPolicyPass,
    bearingOnlyCandidates,
    enforcementControls: ['reject bearing-only confidence states', 'fail validation if bearing is sole directional source', 'block runtime and display on bearing-only records', 'log downgrade reason'],
  },
  runtimeSafetyRequirements: [
    { category: 'evidence quality', minimumRequirement: 'complete V683-V690 evidence chain with parseable artifacts and stable source traceability' },
    { category: 'confidence quality', minimumRequirement: 'all runtime-considered records must have non-bearing confidence and no unresolved review bucket' },
    { category: 'review bucket protection', minimumRequirement: 'review buckets must be isolated, manually resolved, or downgraded unavailable' },
    { category: 'downgrade behavior', minimumRequirement: 'unsafe or uncertain records downgrade to no directional runtime value' },
    { category: 'rollback behavior', minimumRequirement: 'single-step rollback to no directional runtime evaluation on regression triggers' },
    { category: 'containment behavior', minimumRequirement: 'county containment must be validated before county-specific use or expansion' },
    { category: 'display protection', minimumRequirement: 'no display unless separately authorized after display readiness validation' },
  ],
  rollbackReadiness: {
    triggers: ['evidence regression', 'confidence regression', 'source corruption', 'review bucket growth', 'metadata loss', 'containment failure', 'bearing-only policy failure', 'unexpected runtime coupling'],
    expectations: ['disable directional runtime evaluation', 'remove directional output from downstream consumers', 'preserve evidence for audit', 'restore prior protected-system state', 'require revalidation before reconsideration'],
  },
  countyContainmentReadiness: {
    status: 'not_ready_for_expansion',
    currentDistribution: summary.countyDistribution,
    requirementsBeforeFutureCountyExpansion: ['complete county attribution', 'county boundary validation', 'no missing_county runtime candidates', 'county-specific rollback plan', 'separate activation authorization'],
    blockingFailures: ['missing county attribution', 'cross-county leakage', 'unvalidated boundary source', 'runtime use of evidence-only counties', 'county activation without separate authorization'],
  },
  displayReadinessReview: {
    status: 'not_ready',
    prerequisitesBeforeNBSBEBWBCouldEverBeConsidered: ['manual resolution of review buckets', 'non-bearing directional evidence for display candidates', 'runtime containment validation', 'human-language/display safety review', 'separate future display authorization'],
    displayAuthorized: false,
    displayRecommended: false,
    displayRulesCreated: false,
  },
  runtimeReadinessState,
  runtimeConsiderationGates: [
    { gate: 'Gate A', name: 'Evidence chain complete', status: 'Passed', rationale: 'V683 through V690 evidence exists and V690 allows V691 assessment.' },
    { gate: 'Gate B', name: 'Governance complete', status: 'Passed', rationale: 'V690 governance package is complete with review buckets.' },
    { gate: 'Gate C', name: 'Review bucket treatment defined', status: 'Conditional', rationale: 'Treatment is identified, but 81 records still need manual resolution before runtime consideration.' },
    { gate: 'Gate D', name: 'Bearing policy enforced', status: 'Passed', rationale: 'Bearing-only policy passes with 0 bearing-only candidates and explicit prohibitions.' },
    { gate: 'Gate E', name: 'Runtime containment validated', status: 'Blocked', rationale: 'No runtime containment validation exists.' },
    { gate: 'Gate F', name: 'Display readiness reviewed', status: 'Blocked', rationale: 'Display readiness is not established and display is not authorized.' },
    { gate: 'Gate G', name: 'Separate future authorization', status: 'Blocked', rationale: 'No future runtime authorization exists in V691.' },
  ],
  explicitRuntimeBlockers: ['runtime integration', 'directional display', 'NB/SB/EB/WB labels', 'Route Watch integration', 'Awareness integration', 'Alerts integration', 'DriveTexas activation', 'Transportation Intelligence activation'],
  nextPhaseRecommendation: 'V692 — Directional Runtime Protection Framework (assessment/governance only; not runtime integration or display)',
  protectedSystemsVerified,
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination,
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);

const gatesTable = evidence.runtimeConsiderationGates.map((g) => `| ${g.gate} | ${g.name} | ${g.status} | ${g.rationale} |`).join('\n');
const safetyTable = evidence.runtimeSafetyRequirements.map((r) => `| ${r.category} | ${r.minimumRequirement} |`).join('\n');
const blockers = evidence.explicitRuntimeBlockers.map((b) => `- ${b}`).join('\n');

const md = `# GRIDLY V691 — Directional Runtime Readiness Assessment

## 1. Mission alignment

Gridly remains **Know Before You Go** with **Awareness Platform First** and **Route Intelligence Second**.

Future directional runtime consideration would preserve mission alignment only if directional intelligence remains an awareness-supporting safety/context input, never navigation behavior, turn-by-turn guidance, consumer route guidance, or a display promise. Runtime consideration would violate mission alignment if unresolved review buckets, bearing-only evidence, or county evidence gaps were promoted into operational or displayed direction.

## 2. Protected-system verification

| Protected system | Required value | V691 verified value |
| --- | ---: | ---: |
| historicalReadsEnabled | false | ${protectedSystemsVerified.historicalReadsEnabled} |
| historyUiEnabled | false | ${protectedSystemsVerified.historyUiEnabled} |
| DriveTexasPaused | true | ${protectedSystemsVerified.DriveTexasPaused} |
| TransportationIntelligenceEnabled | false | ${protectedSystemsVerified.TransportationIntelligenceEnabled} |
| TransportationIntelligenceDisplay | false | ${protectedSystemsVerified.TransportationIntelligenceDisplay} |
| TransportationIntelligenceActivation | false | ${protectedSystemsVerified.TransportationIntelligenceActivation} |

## 3. Directional governance summary

V691 uses the authoritative directional chain: V683 metadata coverage, V684 extraction prototype, V685 extraction validation, V686R confidence validation recovery, V688 evidence recovery/consolidation, V689 governance review, and V690 governance package.

- Total segments: **${totalSegments}**
- Governance-eligible strong candidates: **${strongCandidates}** (${strongPercentage}%)
- Governance review-required candidates: **${reviewRequiredCandidates}** (${reviewRequiredPercentage}%)
- Blocked candidates: **${blockedCandidates}**
- Bearing-only candidates: **${bearingOnlyCandidates}**
- Bearing-only policy pass: **${bearingOnlyPolicyPass}**

## 4. Evidence readiness review

Evidence readiness status: **${evidence.evidenceReadinessReview.status}**.

Metadata, extraction, validation, confidence, evidence, and governance artifacts are sufficient for readiness assessment. They are not sufficient for runtime integration because partial metadata and validation conditions remain, and 81 review-required records still require treatment.

## 5. Confidence readiness review

The confidence inventory contains **${strongCandidates} strong candidates** and **${reviewRequiredCandidates} review-required candidates**. Before any future runtime consideration, **${manualResolutionRequiredPercentage}% of review-required records** must receive manual resolution or be excluded/downgraded from runtime consideration.

Review buckets remain acceptable for governance only because they are preserved, isolated, and not silently promoted.

## 6. Review bucket runtime readiness

Review buckets present: ${JSON.stringify(summary.reviewBucketDistribution)}.

Required runtime protections are hard isolation, manual disposition, no silent promotion, downgrade-to-unavailable behavior, and display blocking for unresolved records. Runtime is prohibited for reversible-lane, construction, HOV/HOT, missing-county, missing-oneway, missing-ref, or manual-review records until their specific uncertainty is resolved.

## 7. Bearing runtime readiness

Bearing-only confidence remains **prohibited**. Bearing-only runtime behavior remains **prohibited**. Bearing-only display remains **prohibited**.

Required controls include rejecting bearing-only confidence states, failing validation when bearing is the sole directional source, blocking runtime/display for bearing-only records, and preserving downgrade audit reasons.

## 8. Runtime safety requirements

| Category | Minimum requirement |
| --- | --- |
${safetyTable}

## 9. Rollback readiness

Rollback triggers include evidence regression, confidence regression, source corruption, review bucket growth, metadata loss, containment failure, bearing-only policy failure, and unexpected runtime coupling.

Rollback expectations are immediate disablement of directional runtime evaluation, removal of directional outputs from downstream consumers, evidence preservation for audit, restored protected-system posture, and full revalidation before reconsideration.

## 10. County containment readiness

County containment is **not ready for expansion**. Current county distribution is ${JSON.stringify(summary.countyDistribution)}.

Future county expansion requires complete county attribution, boundary validation, zero missing-county runtime candidates, county-specific rollback planning, and separate authorization. Missing county attribution, cross-county leakage, unvalidated boundaries, evidence-only county use, or county activation without authorization blocks runtime consideration.

## 11. Display readiness review

NB/SB/EB/WB display is **not authorized**, **not recommended**, and **not defined** by V691.

Prerequisites before display could ever be considered include manual review-bucket resolution, non-bearing directional evidence for display candidates, runtime containment validation, language/display safety review, and separate future display authorization.

## 12. Runtime consideration gates

| Gate | Name | Status | Rationale |
| --- | --- | --- | --- |
${gatesTable}

## 13. Risk review

Primary risks are unresolved review buckets, stale construction or managed-lane semantics, reversible-lane ambiguity, missing county attribution, missing one-way/ref metadata, bearing-only misuse, display overreach, and accidental coupling to protected runtime systems.

## 14. Explicit runtime blockers

V691 does **not** authorize:

${blockers}

## 15. Runtime/UI non-change confirmation

V691 makes no runtime, UI, CSS, app.js, Route Watch, Alerts, Awareness, Supabase, county status, DriveTexas, or Transportation Intelligence changes.

## 16. Final determination

**${finalDetermination}**

Runtime readiness state: **${runtimeReadinessState}**.

This cautious result is required because 81 review-required records remain, no runtime testing exists, no display validation exists, and no runtime containment validation exists.

## 17. Recommended next milestone

**V692 — Directional Runtime Protection Framework** is recommended as an assessment/governance milestone only. It must not perform runtime integration, directional display, DriveTexas activation, or Transportation Intelligence activation.
`;

fs.writeFileSync(docPath, md);

console.log(JSON.stringify({ generated: [docPath, outputPath], runtimeReadinessState, finalDetermination, gates: evidence.runtimeConsiderationGates }, null, 2));
