#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const by = (rows, key) => new Map(rows.map(row => [row[key], row]));

export function prepareReadiness({ baseline, identities, promotion, membership, validation, enablement, execution }) {
  const identityByFips = by(identities.identities, 'fips');
  const promotionByFips = by(promotion.records, 'countyFips');
  const membershipByFips = by(membership.counties, 'fips');
  const validationByFips = by(validation.counties, 'fips');
  const enablementByFips = by(enablement.counties, 'fips');
  const executionByFips = by(execution.counties, 'fips');
  const targets = baseline.records.filter(row => row.currentOperationalStatus === 'NOT_OPERATIONAL' && row.restrictionStatus === 'NONE');
  if (targets.length !== 215) throw new Error(`LP188.9 expected 215 targets, observed ${targets.length}`);

  const proposedCandidacy = {
    schemaVersion: 'gridly.lp150.candidateMembershipContract.v1', milestone: 'LP188.9',
    generatedAt: '1970-01-01T00:00:00.000Z', contractKind: 'CANDIDATE_MEMBERSHIP_NON_AUTHORIZING', sort: 'ascending-fips',
    candidateCountyCount: targets.length,
    candidateCounties: targets.map(row => ({ fips: row.countyFips })),
    permissions: { approval: { authorized: false, authorityRef: null }, deployment: { authorized: false, authorityRef: null }, activation: { authorized: false, authorityRef: null }, runtimeSelection: { authorized: false, authorityRef: null } },
    boundary: { nonAuthorizing: true, nonDeploying: true, nonActivating: true, emptyContractPreservesCurrentRuntime: false },
    provenance: { lp149Registry: 'data/lp149/runtime-county-registry.json', lp138Baseline: 'evidence/lp138/county-geometry-membership-contract.baseline.json', targetAuthority: 'reports/lp1888/statewide-county-activation-readiness.json' }
  };

  const records = targets.map(base => {
    const identity = identityByFips.get(base.countyFips), promoted = promotionByFips.get(base.countyFips);
    const member = membershipByFips.get(base.countyFips), valid = validationByFips.get(base.countyFips);
    const enabled = enablementByFips.get(base.countyFips), executed = executionByFips.get(base.countyFips);
    if (!identity || !promoted || !member || !valid || !enabled || !executed || !/^48\d{3}$/.test(base.countyFips)) throw new Error(`missing governed authority for ${base.countyFips}`);
    const membershipApproved = member.approvedMembershipStatus === 'APPROVED';
    const deploymentPrepared = membershipApproved && enabled.deploymentReadiness?.state === 'READY';
    const deploymentConfirmed = enabled.deployment?.state === 'DEPLOYED';
    const runtimeValidated = deploymentConfirmed && enabled.operationalValidation?.state === 'READY';
    const operationalValidated = runtimeValidated && executed.activationDecision === 'ACTIVATION_CONFIRMED';
    return {
      countyFips: base.countyFips, countyName: base.countyName,
      currentOperationalStatus: 'NOT_OPERATIONAL', restrictionStatus: 'NONE',
      communityPackagePromoted: promoted.promotionStatus === 'PROMOTED_METADATA_ONLY', packageSha256: promoted.packageSha256,
      candidacyStatus: 'CANDIDATE_NON_AUTHORIZING_PROPOSAL_PREPARED',
      candidacyEvidence: ['reports/lp1889/proposed-candidate-membership-contract.json', 'data/lp150/candidate-membership-contract.json'],
      membershipStatus: membershipApproved ? 'MEMBERSHIP_APPROVED' : 'NOT_APPROVED_OWNER_DECISION_REQUIRED',
      membershipEvidence: ['data/lp150/membership-transition-registry.json', 'reports/lp1889/owner-membership-decision-request.json'],
      deploymentPreparationStatus: deploymentPrepared ? 'DEPLOYMENT_PREPARED' : 'BLOCKED_BY_MEMBERSHIP_APPROVAL',
      deploymentExecutionStatus: deploymentConfirmed ? 'DEPLOYMENT_CONFIRMED' : 'NOT_DEPLOYED',
      deploymentEvidence: ['data/lp152/operational-enablement-registry.json', 'data/lp153/operational-execution-registry.json', 'reports/lp1889/external-execution-evidence-request.json'],
      runtimeValidationStatus: runtimeValidated ? 'RUNTIME_VALIDATED' : 'NOT_RUN_EXTERNAL_EXECUTION_REQUIRED_AFTER_DEPLOYMENT',
      runtimeValidationEvidence: ['data/lp151/statewide-operational-validation-registry.json', 'reports/lp1889/external-execution-evidence-request.json'],
      operationalValidationStatus: operationalValidated ? 'OPERATIONALLY_VALIDATED' : 'NOT_VALIDATED',
      structuralActivationEligibility: operationalValidated ? 'STRUCTURALLY_ACTIVATION_ELIGIBLE' : 'NOT_STRUCTURALLY_ACTIVATION_ELIGIBLE',
      ownerActionRequired: !membershipApproved,
      externalActionRequired: !runtimeValidated,
      blockingReasons: !membershipApproved ? ['EXPLICIT_FIPS_MEMBERSHIP_APPROVAL_ABSENT', 'DEPLOYMENT_NOT_PREPARED_OR_CONFIRMED', 'RUNTIME_AND_OPERATIONAL_VALIDATION_NOT_EXECUTED'] : ['DEPLOYMENT_NOT_PREPARED_OR_CONFIRMED', 'RUNTIME_AND_OPERATIONAL_VALIDATION_NOT_EXECUTED'],
      nextRequiredAction: !membershipApproved ? 'OWNER_REVIEW_EXACT_FIPS_MEMBERSHIP_DECISION_REQUEST; DO_NOT AUTHORIZE ACTIVATION' : 'PREPARE_AND_AUTHORIZE_NON_PRODUCTION_DEPLOYMENT_VALIDATION'
    };
  }).sort((a, b) => a.countyFips.localeCompare(b.countyFips));

  const count = predicate => records.filter(predicate).length;
  const summary = {
    schemaVersion: 'gridly.lp1889.governed-readiness-summary.v1', milestone: 'LP188.9', mode: 'PREPARATION_ONLY_NO_ACTIVATION',
    targetCountyCount: records.length, candidacyCompleteCount: count(r => r.candidacyStatus.startsWith('CANDIDATE_')), candidacyBlockedCount: count(r => !r.candidacyStatus.startsWith('CANDIDATE_')),
    membershipCompleteCount: count(r => r.membershipStatus === 'MEMBERSHIP_APPROVED'), membershipBlockedCount: count(r => r.membershipStatus !== 'MEMBERSHIP_APPROVED'),
    deploymentPreparedCount: count(r => r.deploymentPreparationStatus === 'DEPLOYMENT_PREPARED'), deploymentConfirmedCount: count(r => r.deploymentExecutionStatus === 'DEPLOYMENT_CONFIRMED'), deploymentBlockedCount: count(r => r.deploymentExecutionStatus !== 'DEPLOYMENT_CONFIRMED'),
    runtimeValidatedCount: count(r => r.runtimeValidationStatus === 'RUNTIME_VALIDATED'), runtimeValidationBlockedCount: count(r => r.runtimeValidationStatus !== 'RUNTIME_VALIDATED'),
    structurallyActivationEligibleCount: count(r => r.structuralActivationEligibility === 'STRUCTURALLY_ACTIVATION_ELIGIBLE'), ownerActionRequiredCount: count(r => r.ownerActionRequired), externalActionRequiredCount: count(r => r.externalActionRequired), unresolvedCount: count(r => r.structuralActivationEligibility !== 'STRUCTURALLY_ACTIVATION_ELIGIBLE'),
    exclusiveEndStates: [{ state: 'CANDIDATE_AWAITING_EXPLICIT_MEMBERSHIP_APPROVAL', countyCount: count(r => r.membershipStatus !== 'MEMBERSHIP_APPROVED') }],
    currentlyOperationalCount: 28, restrictedCountyCount: 11, newActivatedCount: 0,
    potentialOperationalAfterSeparateOwnerAuthorizationAndActivation: 28 + count(r => r.structuralActivationEligibility === 'STRUCTURALLY_ACTIVATION_ELIGIBLE'),
    overlappingActionCounts: true,
    overlappingActionCountExplanation: 'Owner and external action counts are independent future requirements and may overlap; exclusiveEndStates is the non-overlapping reconciliation.',
    overallClassification: 'CANDIDACY_PREPARED_MEMBERSHIP_OWNER_DECISION_REQUIRED_NO_ACTIVATION',
    nextMilestone: 'LP188.10_OWNER_MEMBERSHIP_DECISION_AND_NON_PRODUCTION_VALIDATION_WAVE_AUTHORIZATION'
  };
  const ownerDecision = { schemaVersion: 'gridly.lp1889.owner-membership-decision-request.v1', milestone: 'LP188.9', decisionStatus: 'PENDING_OWNER_DECISION', scope: 'EXPLICIT_ASCENDING_COUNTY_FIPS', countyFips: records.map(r => r.countyFips), membershipApproved: false, deploymentAuthorized: false, activationAuthorized: false, runtimeMutationAuthorized: false, instruction: 'Approve or reject exact FIPS membership candidacy. This request does not request or grant activation.' };
  const externalRequest = { schemaVersion: 'gridly.lp1889.external-execution-evidence-request.v1', milestone: 'LP188.9', state: 'NOT_EXECUTED', countyFips: records.map(r => r.countyFips), prerequisite: 'EXPLICIT_MEMBERSHIP_APPROVAL_AND_SEPARATE_NON_PRODUCTION_DEPLOYMENT_AUTHORIZATION', procedure: ['Bind the approved exact-FIPS candidate scope to immutable package identities.', 'Deploy only to an authorized non-production or protected validation environment.', 'Run county-specific runtime, regression, consumer, boundary, error-handling, telemetry, and operational-readiness cases.', 'Record executor, reviewer, environment, immutable identities, results, and rollback evidence for every FIPS.', 'Stop on any missing, failed, unknown, or mismatched evidence; do not activate production membership.'], expectedEvidence: ['exact county FIPS', 'package SHA-256', 'environment and deployed identity', 'deployment acknowledgement', 'runtime/regression/consumer results', 'operational owner and rollback acknowledgements', 'executor and independent reviewer'], successClassification: 'COUNTY_SPECIFIC_NON_PRODUCTION_RUNTIME_AND_OPERATIONAL_VALIDATION_PASS', failureClassification: 'EXTERNAL_VALIDATION_BLOCKED_OR_FAILED', deploymentExecuted: false, runtimeValidationExecuted: false, productionDeploymentAuthorized: false };
  return { matrix: { schemaVersion: 'gridly.lp1889.county-readiness.v1', milestone: 'LP188.9', records }, summary, proposedCandidacy, ownerDecision, externalRequest };
}

export function buildArtifacts() {
  return prepareReadiness({ baseline: read('reports/lp1888/statewide-county-activation-readiness.json'), identities: read('data/lp149/runtime-county-registry.json'), promotion: read('reports/lp1887/community-package-promotion-only-registry.json'), membership: read('data/lp150/membership-transition-registry.json'), validation: read('data/lp151/statewide-operational-validation-registry.json'), enablement: read('data/lp152/operational-enablement-registry.json'), execution: read('data/lp153/operational-execution-registry.json') });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]; if (!['build', 'verify'].includes(mode)) throw new Error('usage: prepare-governed-readiness.mjs <build|verify>');
  const result = buildArtifacts(), dir = path.join(root, 'reports/lp1889');
  const outputs = new Map([['county-readiness.json', result.matrix], ['lp1889-summary.json', result.summary], ['proposed-candidate-membership-contract.json', result.proposedCandidacy], ['owner-membership-decision-request.json', result.ownerDecision], ['external-execution-evidence-request.json', result.externalRequest]]);
  if (mode === 'build') fs.mkdirSync(dir, { recursive: true });
  for (const [name, value] of outputs) { const expected = stableJson(value), target = path.join(dir, name); if (mode === 'build') fs.writeFileSync(target, expected); else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) throw new Error(`LP188.9 deterministic evidence mismatch: ${name}`); }
  process.stdout.write(stableJson(result.summary));
}
