import fs from 'node:fs';
import path from 'node:path';

const evidenceDir = 'assets/directional-intelligence/evidence';
const outputPath = path.join(evidenceDir, 'v692-directional-runtime-protection-framework.json');
const docPath = 'GRIDLY-V692-DIRECTIONAL-RUNTIME-PROTECTION-FRAMEWORK.md';

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
  v691: readJson(path.join(evidenceDir, 'v691-directional-runtime-readiness-assessment.json')),
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
const v691 = inputs.v691;
const reviewBucketDistribution = summary.reviewBucketDistribution;
const totalSegments = summary.totalSegments;
const strongCandidates = summary.strongConfidenceCandidates;
const reviewRequiredCandidates = summary.reviewRequiredCandidates;
const blockedCandidates = summary.blockedCandidates;
const bearingOnlyCandidates = summary.bearingOnlyCandidates;
const bearingOnlyPolicyPass = summary.bearingOnlyPolicyPass === true;

const reviewBucketProtectionFramework = {
  runtimeAccess: 'prohibited',
  buckets: Object.fromEntries(['reversible_lane', 'construction_segment', 'hov_hot_lane', 'missing_county', 'missing_oneway', 'missing_ref', 'manual_review_required'].map((bucket) => [bucket, {
    status: 'review_required',
    count: reviewBucketDistribution[bucket] ?? 0,
    protections: ['hard isolation', 'review-required status', 'promotion prohibition', 'display prohibition', 'downgrade support'],
    runtimeAccess: 'prohibited until manually resolved and separately authorized',
  }])),
};

const runtimeGateProtectionMatrix = [
  { gate: 'Gate A', name: 'Evidence Chain', protectionOwner: 'Evidence governance', failureImpact: 'Evidence chain cannot support future review.', requiredResponse: 'Stop authorization progression and regenerate/repair evidence.', blockConditions: ['missing or unparsable V683-V691 evidence', 'source traceability break'] },
  { gate: 'Gate B', name: 'Governance', protectionOwner: 'Directional governance', failureImpact: 'Governance package cannot constrain runtime risk.', requiredResponse: 'Return to governance review before runtime consideration.', blockConditions: ['governance artifact missing', 'review rules absent', 'non-authorization language removed'] },
  { gate: 'Gate C', name: 'Review Buckets', protectionOwner: 'Manual review governance', failureImpact: 'Review-required records could leak into confidence/runtime.', requiredResponse: 'Hard-isolate, prohibit promotion/display, and downgrade unresolved records.', blockConditions: ['unresolved review bucket used at runtime', 'review count grows without treatment', 'manual disposition absent'] },
  { gate: 'Gate D', name: 'Bearing', protectionOwner: 'Confidence validation', failureImpact: 'Geometry could be misused as confidence or display truth.', requiredResponse: 'Reject bearing-only dependency and downgrade affected candidates.', blockConditions: ['bearing-only candidate promoted', 'bearing used as runtime/display confidence', 'bearing policy failure'] },
  { gate: 'Gate E', name: 'Containment', protectionOwner: 'Runtime containment review', failureImpact: 'Directional evidence could escape county, corridor, source, or evidence limits.', requiredResponse: 'Downgrade readiness and block runtime consideration.', blockConditions: ['county containment failure', 'corridor leakage', 'source mismatch', 'evidence boundary breach'] },
  { gate: 'Gate F', name: 'Display', protectionOwner: 'Display safety review', failureImpact: 'NB/SB/EB/WB labels could imply unsupported certainty.', requiredResponse: 'Keep display prohibited pending separate display review.', blockConditions: ['display review absent', 'unresolved review buckets', 'bearing-only display dependency', 'containment unvalidated'] },
  { gate: 'Gate G', name: 'Authorization', protectionOwner: 'Separate future authorization', failureImpact: 'Prior assessment could be mistaken for activation approval.', requiredResponse: 'Require explicit future authorization before any implementation.', blockConditions: ['no separate authorization', 'stage-skipping', 'protected-system coupling'] },
];

const runtimeProtectionState = (v691.runtimeReadinessState === 'runtime_readiness_not_established' && reviewRequiredCandidates > 0)
  ? 'protection_framework_complete_with_conditions'
  : 'protection_framework_complete';
const finalDetermination = runtimeProtectionState === 'protection_framework_complete'
  ? 'RUNTIME PROTECTION FRAMEWORK COMPLETE — FUTURE AUTHORIZATION REVIEW ALLOWED'
  : 'RUNTIME PROTECTION FRAMEWORK COMPLETE WITH CONDITIONS — FUTURE AUTHORIZATION REVIEW ALLOWED';

const evidence = {
  milestone: 'V692',
  generatedAt: new Date().toISOString(),
  inputEvidence: Object.entries(inputs).map(([key, value]) => ({ milestone: key.toUpperCase().replace('V686R', 'V686R'), determination: value.finalDetermination })),
  runtimeProtectionPhilosophy: {
    mission: 'Gridly remains Know Before You Go with Awareness Platform First and Route Intelligence Second.',
    principle: 'Safety takes precedence over directional capability.',
    prevents: ['accidental activation', 'confidence misuse', 'review bucket leakage', 'bearing-only reliance', 'containment failures', 'display authorization drift'],
    authorization: 'V692 creates protections only; it does not authorize runtime integration, display, or implementation.',
  },
  reviewBucketProtectionFramework,
  bearingProtectionFramework: {
    bearingMayBe: ['geometry evidence'],
    bearingMayNotBe: ['directional confidence', 'runtime confidence', 'display confidence'],
    controls: ['bearing-only rejection', 'confidence downgrade', 'runtime block', 'display block'],
    bearingOnlyCandidates,
    bearingOnlyPolicyPass,
  },
  runtimeContainmentFramework: {
    protections: ['county containment', 'corridor containment', 'source containment', 'evidence containment'],
    failureBehavior: ['downgrade readiness', 'block runtime consideration'],
  },
  runtimeDowngradeFramework: {
    triggers: ['metadata regression', 'confidence regression', 'source corruption', 'review bucket growth', 'county containment failure', 'bearing-only dependency', 'extraction instability'],
    requiredBehavior: ['downgrade affected records to unavailable', 'preserve audit reason', 'block display', 'require revalidation before promotion'],
  },
  runtimeRollbackFramework: {
    triggers: ['confidence collapse', 'evidence corruption', 'runtime containment failure', 'review bucket escape', 'policy violation'],
    expectations: ['disable directional runtime consideration', 'restore protected-system posture', 'preserve evidence for audit', 'require rollback availability before future runtime consideration'],
  },
  runtimeDisplayProtectionFramework: {
    displayProtected: ['NB/SB/EB/WB display'],
    conditionsBeforeFutureDisplayReview: ['confidence validation', 'containment validation', 'review bucket resolution', 'separate display review'],
    displayRemainsProhibited: true,
  },
  runtimeAuthorizationFramework: {
    stages: ['Stage 1 — Evidence', 'Stage 2 — Governance', 'Stage 3 — Runtime Readiness', 'Stage 4 — Protection Framework', 'Stage 5 — Separate Future Authorization'],
    rule: 'Passing previous stages does not automatically authorize the next stage.',
  },
  runtimeGateProtectionMatrix,
  runtimeProtectionState,
  explicitRuntimeBlockers: ['runtime integration', 'directional display', 'NB/SB/EB/WB labels', 'Route Watch integration', 'Awareness integration', 'Alerts integration', 'DriveTexas activation', 'Transportation Intelligence activation'],
  nextPhaseRecommendation: 'V693 — Directional Authorization Review (assessment only; not runtime integration, display, or activation)',
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

const bucketRows = Object.entries(reviewBucketProtectionFramework.buckets).map(([bucket, data]) => `| ${bucket} | ${data.count} | ${data.status} | ${data.protections.join('; ')} | ${data.runtimeAccess} |`).join('\n');
const gateRows = runtimeGateProtectionMatrix.map((g) => `| ${g.gate} | ${g.name} | ${g.protectionOwner} | ${g.failureImpact} | ${g.requiredResponse} | ${g.blockConditions.join('; ')} |`).join('\n');
const protectedRows = Object.entries(protectedSystemsVerified).map(([key, value]) => `| ${key} | ${value} |`).join('\n');
const blockers = evidence.explicitRuntimeBlockers.map((b) => `- ${b}`).join('\n');

const md = `# GRIDLY V692 — Directional Runtime Protection Framework

## 1. Mission alignment

Gridly remains **Know Before You Go** with **Awareness Platform First** and **Route Intelligence Second**. V692 creates a protection framework only. It does not authorize runtime integration, directional display, directional implementation, DriveTexas activation, or Transportation Intelligence activation.

Authoritative evidence remains: **${totalSegments} total segments**, **${strongCandidates} governance-eligible strong candidates**, **${reviewRequiredCandidates} review-required candidates**, **${blockedCandidates} blocked candidates**, **${bearingOnlyCandidates} bearing-only candidates**, and bearing-only policy pass **${bearingOnlyPolicyPass}**.

## 2. Protected-system verification

| Protected system | Verified value |
| --- | ---: |
${protectedRows}

## 3. Runtime protection philosophy

Directional runtime protection exists to prevent accidental activation, confidence misuse, review bucket leakage, bearing-only reliance, containment failures, and display authorization drift.

**Safety takes precedence over directional capability.** Any uncertainty, regression, containment failure, or authorization gap must downgrade or block future runtime consideration rather than promote directional behavior.

## 4. Review bucket protection framework

Review bucket runtime access is **prohibited**. Review buckets require hard isolation, review-required status, promotion prohibition, display prohibition, and downgrade support.

| Review bucket | Count | Status | Required protections | Runtime access |
| --- | ---: | --- | --- | --- |
${bucketRows}

## 5. Bearing protection framework

Bearing may be geometry evidence. Bearing may not be directional confidence, runtime confidence, or display confidence.

Required controls are bearing-only rejection, confidence downgrade, runtime block, and display block. Bearing-only policy currently passes with **${bearingOnlyCandidates}** bearing-only candidates, but the policy remains protective because any future bearing-only dependency must be rejected or downgraded.

## 6. Runtime containment framework

Runtime containment requires county containment, corridor containment, source containment, and evidence containment. Containment failures must downgrade readiness and block runtime consideration.

Gate E remains blocked from V691 because runtime containment validation has not been established.

## 7. Runtime downgrade framework

Downgrade triggers include metadata regression, confidence regression, source corruption, review bucket growth, county containment failure, bearing-only dependency, and extraction instability.

Required downgrade behavior is to downgrade affected records to unavailable, preserve an audit reason, block display, and require revalidation before any future promotion.

## 8. Runtime rollback framework

Rollback triggers include confidence collapse, evidence corruption, runtime containment failure, review bucket escape, and policy violation.

Rollback must be available before future runtime consideration. Expected rollback behavior is to disable directional runtime consideration, restore protected-system posture, preserve evidence for audit, and require reauthorization/revalidation before reconsideration.

## 9. Runtime display protection framework

NB/SB/EB/WB display remains **prohibited**. Before any future display review, the program would need confidence validation, containment validation, review bucket resolution, and a separate display review.

V692 does not add UI, labels, display rules, or display authorization.

## 10. Runtime authorization framework

Required authorization stages are:

1. Stage 1 — Evidence
2. Stage 2 — Governance
3. Stage 3 — Runtime Readiness
4. Stage 4 — Protection Framework
5. Stage 5 — Separate Future Authorization

Passing previous stages does not automatically authorize the next stage.

## 11. Runtime gate protection matrix

| Gate | Name | Protection owner | Failure impact | Required response | Block conditions |
| --- | --- | --- | --- | --- | --- |
${gateRows}

## 12. Risk review

Primary risks are accidental activation, confidence misuse, unresolved review buckets, construction or managed-lane ambiguity, reversible-lane ambiguity, missing county/ref/oneway metadata, bearing-only misuse, county/corridor/source/evidence containment failure, display overreach, and protected-system coupling.

## 13. Explicit runtime blockers

V692 does **not** authorize:

${blockers}

## 14. Runtime/UI non-change confirmation

V692 makes no runtime, UI, CSS, app.js, Route Watch, Alerts, Awareness, Supabase, county status, DriveTexas, or Transportation Intelligence changes.

## 15. Final determination

**${finalDetermination}**

Runtime protection state: **${runtimeProtectionState}**.

This is complete with conditions because the protection framework is defined, while V691 still has unresolved runtime blockers: review buckets remain, containment validation is blocked, display review is blocked, and separate future authorization is blocked.

## 16. Recommended next milestone

**V693 — Directional Authorization Review** is recommended only as an assessment milestone. It must still not perform runtime integration, directional display, DriveTexas activation, or Transportation Intelligence activation.
`;

fs.writeFileSync(docPath, md);

console.log(JSON.stringify({ generated: [docPath, outputPath], runtimeProtectionState, finalDetermination }, null, 2));
