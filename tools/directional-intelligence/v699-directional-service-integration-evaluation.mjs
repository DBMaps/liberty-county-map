import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const evidenceDir = path.join('assets', 'directional-intelligence', 'evidence');
const outputPath = path.join(evidenceDir, 'v699-directional-service-integration-evaluation.json');

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(evidenceDir, file), 'utf8'));

const prototype = readJson('v695-directional-runtime-candidate-prototype.json');
const validation = readJson('v696-directional-prototype-runtime-validation.json');
const serviceLayer = readJson('v697-directional-service-layer.json');
const serviceConsumer = readJson('v698-directional-service-consumer.json');

const protectedSystemsVerified = {
  historicalReadsEnabled: false,
  historyUiEnabled: false,
  DriveTexasPaused: true,
  TransportationIntelligenceEnabled: false,
  TransportationIntelligenceDisplay: false,
  TransportationIntelligenceActivation: false,
};

const candidateCount = serviceConsumer.candidateCount;
const reviewExcludedCount = serviceConsumer.excludedCount;
const blockedCount = serviceConsumer.blockedCount;
const bearingOnlyCandidates = prototype.candidateCounts?.bearingOnlyRuntimeCandidates ?? 0;
const containmentPass = serviceConsumer.containmentPass === true && validation.runtimeValidation?.containmentValidation?.countyContained !== false;
const bearingProtectionPass = serviceConsumer.bearingProtectionPass === true && bearingOnlyCandidates === 0;
const failClosedPass = serviceConsumer.failClosedPass === true;
const reviewBucketExclusionPass = reviewExcludedCount === prototype.candidateCounts?.reviewExcludedCandidates;

const serviceReadyForEvaluationOnly = containmentPass && bearingProtectionPass && failClosedPass && reviewBucketExclusionPass && serviceLayer.userVisible === false && serviceConsumer.userVisible === false;

const serviceLayerReview = {
  reviewedArtifacts: [
    'assets/directional-intelligence/evidence/v695-directional-runtime-candidate-prototype.json',
    'assets/directional-intelligence/evidence/v696-directional-prototype-runtime-validation.json',
    'assets/directional-intelligence/evidence/v697-directional-service-layer.json',
    'assets/directional-intelligence/evidence/v698-directional-service-consumer.json',
  ],
  candidateCount,
  reviewExcludedCount,
  blockedCount,
  bearingOnlyCandidates,
  containmentProtection: containmentPass ? 'pass' : 'fail',
  bearingProtection: bearingProtectionPass ? 'pass' : 'fail',
  failClosedProtection: failClosedPass ? 'pass' : 'fail',
  reviewBucketExclusion: reviewBucketExclusionPass ? 'pass' : 'fail',
  serviceReadinessStatus: serviceReadyForEvaluationOnly ? 'evaluation_ready_internal_only' : 'not_ready',
  userVisible: false,
};

const routeWatchEvaluation = {
  potentialValue: 'moderate',
  theoreticalConsumption: 'possible_after_future_authorization_only',
  requiredProtections: ['containment', 'review exclusion', 'authorization'],
  futureEvaluationJustified: true,
  integrationAuthorized: false,
  rationale: 'Directional context could help internal route-watch interpretation, but review buckets and authorization gates prevent integration in V699.',
};

const awarenessEvaluation = {
  potentialValue: 'moderate',
  theoreticalConsumption: 'possible_after_future_authorization_only',
  requiredProtections: ['confidence requirements', 'containment', 'review exclusion'],
  futureEvaluationJustified: true,
  integrationAuthorized: false,
  rationale: 'Directional intelligence may improve awareness generation precision, but it must remain internal until confidence, containment, and review exclusions are fully authorized.',
};

const alertPrioritizationEvaluation = {
  potentialValue: 'low',
  theoreticalConsumption: 'possible_after_future_authorization_only',
  requiredProtections: ['confidence requirements', 'fail-closed protections', 'review exclusions'],
  futureEvaluationJustified: true,
  integrationAuthorized: false,
  rationale: 'Directional intelligence could eventually inform internal ranking, but alert impact is safety-sensitive and requires stronger authorization and fail-closed validation.',
};

const userFacingEvaluation = {
  safeToExposeToday: false,
  potentialValue: 'high',
  readiness: 'not_ready',
  reasons: [
    'review buckets remain',
    'display authorization not granted',
    'runtime authorization not granted',
    'containment validation incomplete for user display',
    'display validation incomplete',
  ],
  integrationAuthorized: false,
};

const integrationReadinessMatrix = [
  {
    system: 'Route Watch',
    potentialValue: routeWatchEvaluation.potentialValue,
    readiness: 'future_evaluation_only',
    requiredProtections: routeWatchEvaluation.requiredProtections,
    authorizationStatus: 'not_authorized',
  },
  {
    system: 'Awareness Engine',
    potentialValue: awarenessEvaluation.potentialValue,
    readiness: 'future_evaluation_only',
    requiredProtections: awarenessEvaluation.requiredProtections,
    authorizationStatus: 'not_authorized',
  },
  {
    system: 'Alert Prioritization',
    potentialValue: alertPrioritizationEvaluation.potentialValue,
    readiness: 'future_evaluation_only',
    requiredProtections: alertPrioritizationEvaluation.requiredProtections,
    authorizationStatus: 'not_authorized',
  },
  {
    system: 'User Display',
    potentialValue: userFacingEvaluation.potentialValue,
    readiness: userFacingEvaluation.readiness,
    requiredProtections: ['review bucket resolution', 'runtime authorization', 'display authorization', 'containment validation', 'display validation'],
    authorizationStatus: 'not_authorized',
  },
];

const integrationAuthorizationRequirements = [
  'review bucket resolution',
  'runtime authorization',
  'display authorization before any user-facing exposure',
  'containment validation',
  'confidence validation for the target consuming system',
  'fail-closed validation for the target consuming system',
  'future approval milestone explicitly authorizing the named integration',
];

const explicitIntegrationRestrictions = [
  'V699 does not authorize Route Watch integration',
  'V699 does not authorize Awareness integration',
  'V699 does not authorize Alert integration',
  'V699 does not authorize Display integration',
  'V699 does not authorize directional display',
  'V699 does not authorize NB/SB/EB/WB labels',
  'V699 does not authorize DriveTexas activation',
  'V699 does not authorize Transportation Intelligence activation',
];

const integrationEvaluationState = serviceReadyForEvaluationOnly
  ? 'integration_evaluation_complete_with_constraints'
  : 'integration_evaluation_incomplete';
const finalDetermination = serviceReadyForEvaluationOnly
  ? 'SERVICE INTEGRATION EVALUATION COMPLETE WITH CONSTRAINTS'
  : 'SERVICE INTEGRATION EVALUATION INCOMPLETE';

const evidence = {
  milestone: 'V699',
  generatedAt: new Date().toISOString(),
  serviceLayerReview,
  routeWatchEvaluation,
  awarenessEvaluation,
  alertPrioritizationEvaluation,
  userFacingEvaluation,
  integrationReadinessMatrix,
  integrationAuthorizationRequirements,
  explicitIntegrationRestrictions,
  integrationEvaluationState,
  nextMilestoneRecommendation: integrationEvaluationState !== 'integration_evaluation_incomplete'
    ? {
        milestone: 'V700 — Directional Product Strategy Review',
        purpose: 'Determine whether directional intelligence should remain an internal capability or become a future product capability.',
        restrictions: ['No implementation', 'No integration', 'No display'],
      }
    : null,
  protectedSystemsVerified,
  runtimeChanged: false,
  appJsChanged: false,
  uiChanged: false,
  driveTexasChanged: false,
  transportationIntelligenceChanged: false,
  finalDetermination,
};

assert.equal(evidence.milestone, 'V699');
assert.equal(evidence.runtimeChanged, false);
assert.equal(evidence.appJsChanged, false);
assert.equal(evidence.uiChanged, false);
assert.equal(evidence.driveTexasChanged, false);
assert.equal(evidence.transportationIntelligenceChanged, false);
assert.equal(evidence.userFacingEvaluation.safeToExposeToday, false);
assert.equal(evidence.serviceLayerReview.userVisible, false);
assert.ok(['integration_evaluation_complete', 'integration_evaluation_complete_with_constraints', 'integration_evaluation_incomplete'].includes(evidence.integrationEvaluationState));
assert.ok(['SERVICE INTEGRATION EVALUATION COMPLETE', 'SERVICE INTEGRATION EVALUATION COMPLETE WITH CONSTRAINTS', 'SERVICE INTEGRATION EVALUATION INCOMPLETE'].includes(evidence.finalDetermination));
assert.deepEqual(evidence.protectedSystemsVerified, protectedSystemsVerified);

fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
console.log(evidence.finalDetermination);
