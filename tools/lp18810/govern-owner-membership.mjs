#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const uniqueAscending = values => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function governMembership(candidacy, suppliedDecision = null, governedProposalFips = null) {
  const candidates = candidacy.records.map(({ countyFips, countyName, packageSha256 }) => ({ countyFips, countyName, packageSha256 }));
  const candidateFips = candidates.map(row => row.countyFips);
  if (candidates.length !== 215 || uniqueAscending(candidateFips).length !== 215 || candidateFips.some((fips, i) => fips !== uniqueAscending(candidateFips)[i])) throw new Error('LP188.10 requires exactly 215 unique ascending LP188.9 candidate FIPS');
  if (governedProposalFips && (governedProposalFips.length !== 215 || governedProposalFips.some((fips, i) => fips !== candidateFips[i]))) throw new Error('LP188.10 candidacy differs from the governed LP188.9 proposal');

  let approved = [], rejected = [], preparationAuthorized = false, validationAuthorized = false;
  if (suppliedDecision) {
    if (suppliedDecision.decisionStatus !== 'OWNER_APPROVED' || !['EXACT_COUNTY_FIPS', 'ALL_215_CANDIDATES_EXACT_FIPS'].includes(suppliedDecision.decisionScope)) throw new Error('explicit unambiguous owner approval is required');
    if (suppliedDecision.membershipOnly !== true || suppliedDecision.productionActivationAuthorized !== false || suppliedDecision.productionDeploymentAuthorized !== false || suppliedDecision.publicLaunchAuthorized !== false || suppliedDecision.supabaseProductionMutationAuthorized !== false || suppliedDecision.restrictionClearingAuthorized !== false) throw new Error('owner decision must be membership-only and explicitly non-production');
    approved = suppliedDecision.approvedCountyFips ?? [];
    rejected = suppliedDecision.rejectedCountyFips ?? [];
    if (suppliedDecision.approvedCountyCount !== approved.length || suppliedDecision.rejectedCountyCount !== rejected.length || suppliedDecision.pendingCountyCount !== 215 - approved.length - rejected.length) throw new Error('decision counts do not reconcile to 215');
    if (approved.length !== new Set(approved).size || rejected.length !== new Set(rejected).size) throw new Error('duplicate decision FIPS');
    if ([...approved, ...rejected].some(f => !candidateFips.includes(f)) || approved.some(f => rejected.includes(f))) throw new Error('decision contains wrong or overlapping FIPS');
    if (approved.some((f, i) => f !== uniqueAscending(approved)[i]) || rejected.some((f, i) => f !== uniqueAscending(rejected)[i])) throw new Error('decision FIPS must be ascending');
    if (suppliedDecision.decisionScope === 'ALL_215_CANDIDATES_EXACT_FIPS' && (rejected.length !== 0 || approved.length !== 215 || approved.some((f, i) => f !== candidateFips[i]))) throw new Error('ALL_215 scope must expand to the exact governed candidate list');
    preparationAuthorized = suppliedDecision.deploymentPreparationAuthorized === true;
    validationAuthorized = suppliedDecision.nonProductionValidationAuthorized === true;
  }
  const approvedSet = new Set(approved), rejectedSet = new Set(rejected);
  const preparationComplete = suppliedDecision && preparationAuthorized;
  const decision = {
    schemaVersion: 'gridly.lp18810.owner-membership-decision.v1', milestone: 'LP188.10',
    decisionStatus: suppliedDecision ? 'OWNER_APPROVED' : 'PENDING_EXPLICIT_OWNER_DECISION',
    decisionScope: suppliedDecision?.decisionScope ?? 'EXACT_ASCENDING_LP1889_CANDIDATE_FIPS_REQUIRED',
    approvedCountyCount: approved.length, approvedCountyFips: approved,
    rejectedCountyCount: rejected.length, rejectedCountyFips: rejected,
    pendingCountyCount: 215 - approved.length - rejected.length,
    membershipOnly: true, deploymentPreparationAuthorized: preparationAuthorized,
    nonProductionValidationAuthorized: validationAuthorized,
    productionActivationAuthorized: false, productionDeploymentAuthorized: false,
    publicLaunchAuthorized: false, supabaseProductionMutationAuthorized: false,
    restrictionClearingAuthorized: false
  };
  const records = candidates.map(row => {
    const yes = approvedSet.has(row.countyFips), no = rejectedSet.has(row.countyFips);
    return {
      ...row, candidateStatus: 'CANDIDATE_NON_AUTHORIZING_PROPOSAL_PREPARED',
      ownerMembershipDecision: yes ? 'OWNER_APPROVED' : no ? 'OWNER_REJECTED' : 'PENDING_EXPLICIT_OWNER_DECISION',
      membershipStatus: yes ? 'MEMBERSHIP_OWNER_APPROVED' : no ? 'MEMBERSHIP_OWNER_REJECTED' : 'NOT_APPROVED_OWNER_DECISION_REQUIRED',
      validationWave: yes && preparationComplete ? 'LP18810-NP-001' : null,
      deploymentPreparationAuthorization: yes && preparationAuthorized ? 'AUTHORIZED' : 'NOT_AUTHORIZED',
      deploymentPreparationStatus: yes && preparationComplete ? 'DEPLOYMENT_PREPARED' : yes ? 'BLOCKED_BY_DEPLOYMENT_PREPARATION_AUTHORITY' : 'BLOCKED_BY_MEMBERSHIP_APPROVAL',
      deploymentExecutionStatus: 'NOT_DEPLOYED',
      nonProductionExecutionAuthorization: yes && validationAuthorized ? 'AUTHORIZED_NOT_EXECUTED' : 'NOT_AUTHORIZED',
      productionDeploymentAuthorization: false,
      productionActivationAuthorization: false,
      runtimeValidationStatus: 'NOT_RUN_EXTERNAL_EXECUTION_REQUIRED', operationalValidationStatus: 'NOT_VALIDATED',
      structuralActivationEligibility: 'NOT_STRUCTURALLY_ACTIVATION_ELIGIBLE',
      finalActivationAuthorizationStatus: 'NOT_AUTHORIZED', activationStatus: 'NOT_ACTIVATED',
      blockingReasons: no ? ['OWNER_MEMBERSHIP_REJECTED'] : !yes ? ['EXPLICIT_FIPS_MEMBERSHIP_APPROVAL_ABSENT'] : !preparationAuthorized ? ['DEPLOYMENT_PREPARATION_AUTHORITY_ABSENT', 'EXTERNAL_VALIDATION_NOT_EXECUTED'] : ['EXTERNAL_PROTECTED_VALIDATION_EXECUTION_EVIDENCE_ABSENT', 'FINAL_ACTIVATION_OWNER_AUTHORIZATION_ABSENT'],
      nextRequiredAction: no ? 'NO_ADVANCEMENT_OWNER_REJECTED' : !yes ? 'OWNER_SUPPLY_EXPLICIT_EXACT_FIPS_MEMBERSHIP_DECISION' : 'EXECUTE_LP18810_NP_001_IN_OWNER_CONTROLLED_PROTECTED_ENVIRONMENT_AND_INGEST_EXACT_FIPS_EVIDENCE'
    };
  });
  const count = predicate => records.filter(predicate).length;
  const summary = {
    schemaVersion: 'gridly.lp18810.summary.v1', milestone: 'LP188.10', targetCountyCount: 215,
    ownerMembershipApprovedCount: approved.length, ownerMembershipRejectedCount: rejected.length,
    ownerMembershipPendingCount: 215 - approved.length - rejected.length,
    deploymentPreparationAuthorizedCount: count(r => r.deploymentPreparationAuthorization === 'AUTHORIZED'),
    nonProductionValidationAuthorizedCount: count(r => r.nonProductionExecutionAuthorization === 'AUTHORIZED_NOT_EXECUTED'),
    deploymentPreparedCount: count(r => r.deploymentPreparationStatus === 'DEPLOYMENT_PREPARED'), deploymentExecutionAuthorizedCount: count(r => r.nonProductionExecutionAuthorization === 'AUTHORIZED_NOT_EXECUTED'), deploymentConfirmedCount: 0,
    runtimeValidatedCount: 0, operationallyValidatedCount: 0, structurallyActivationEligibleCount: 0,
    externalExecutionPendingCount: 215 - rejected.length, finalActivationAuthorizationRequiredCount: approved.length,
    newActivatedCount: 0, currentOperationalCount: 28, restrictedCountyCount: 11,
    runtimeOperationalCountChanged: false, restrictedCountyStateChanged: false,
    overallClassification: suppliedDecision ? 'OWNER_MEMBERSHIP_APPROVED_NON_PRODUCTION_VALIDATION_AUTHORIZED_EXTERNAL_EXECUTION_REQUIRED_NO_ACTIVATION' : 'OWNER_MEMBERSHIP_DECISION_REQUIRED_NO_EXECUTION',
    nextMilestone: suppliedDecision ? 'LP188.11_AUTHORIZED_NON_PRODUCTION_VALIDATION_EXECUTION_AND_EVIDENCE_INGESTION' : 'LP188.10_OWNER_EXACT_FIPS_MEMBERSHIP_DECISION'
  };
  const waves = {
    schemaVersion: 'gridly.lp18810.validation-waves.v1', milestone: 'LP188.10',
    architecture: 'SINGLE_STATEWIDE_EXACT_FIPS_EXECUTION_COHORT',
    architectureAuthority: ['LP150_EXPLICIT_ASCENDING_FIPS_MEMBERSHIP_CONTRACT', 'LP153_STATEWIDE_SEQUENCE_AND_EXPLICIT_AUTHORIZATION_ARRAY'],
    architectureRationale: 'LP150 and LP153 evaluate explicit statewide FIPS arrays and impose no governed maximum cohort size; splitting would invent an unsupported limit.',
    waves: preparationComplete ? [{
      waveId: 'LP18810-NP-001', countyCount: approved.length, countyFips: approved,
      membershipApproved: true, deploymentPreparationAuthorized: true,
      nonProductionValidationAuthorized: validationAuthorized,
      productionDeploymentAuthorized: false, productionActivationAuthorized: false,
      deploymentPreparationStatus: 'DEPLOYMENT_PREPARED',
      externalExecutionAuthorizationStatus: validationAuthorized ? 'AUTHORIZED_PENDING_OWNER_CONTROLLED_EXECUTION' : 'NOT_AUTHORIZED',
      validationStatus: 'NOT_EXECUTED_NO_EXTERNAL_EVIDENCE',
      packageReferences: candidates.filter(row => approvedSet.has(row.countyFips)).map(row => ({ countyFips: row.countyFips, packageSha256: row.packageSha256, packageIdentitySource: 'reports/lp1889/county-readiness.json' })),
      expectedAssertions: ['exact FIPS and immutable package identity match', 'county boundary behavior passes', 'runtime and regression behavior passes', 'consumer behavior passes', 'telemetry evidence captured', 'rollback rehearsal passes', 'operational validation passes'],
      executionProcedure: ['Resolve every package identity from the governed LP188.9 matrix and reject any mismatch.', 'Deploy the exact wave only to the owner-controlled protected/non-production environment.', 'Execute runtime, regression, consumer, county-boundary, telemetry, rollback, and operational-validation checks for every FIPS.', 'Capture immutable environment and deployment identities plus per-FIPS results and independent review.', 'Ingest evidence into the next governed milestone; stop on missing, failed, unknown, duplicate, or mismatched evidence.'],
      rollbackPlan: ['Remove the protected deployment cohort.', 'Restore the pre-wave protected configuration.', 'Verify the production runtime membership remains the unchanged 28-county baseline.'],
      requiredEvidenceFields: ['countyFips', 'packageSha256', 'protectedEnvironmentIdentity', 'deploymentIdentity', 'deploymentAcknowledgement', 'runtimeResult', 'regressionResult', 'consumerResult', 'boundaryResult', 'telemetryResult', 'rollbackResult', 'operationalValidationResult', 'executor', 'independentReviewer'],
      blockingReasons: ['EXTERNAL_PROTECTED_VALIDATION_EXECUTION_EVIDENCE_ABSENT']
    }] : [],
    blockingReasons: suppliedDecision ? ['EXTERNAL_PROTECTED_VALIDATION_EXECUTION_EVIDENCE_ABSENT'] : ['EXPLICIT_OWNER_MEMBERSHIP_DECISION_ABSENT']
  };
  return { decision, matrix: { schemaVersion: 'gridly.lp18810.county-matrix.v1', milestone: 'LP188.10', records }, waves, summary };
}

export function buildArtifacts() {
  const decisionPath = path.join(root, 'evidence/lp18810/owner-membership-decision.input.json');
  const proposal = read('reports/lp1889/proposed-candidate-membership-contract.json');
  return governMembership(read('reports/lp1889/county-readiness.json'), fs.existsSync(decisionPath) ? read('evidence/lp18810/owner-membership-decision.input.json') : null, proposal.candidateCounties.map(row => row.fips));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!['build', 'verify'].includes(mode)) throw new Error('usage: govern-owner-membership.mjs <build|verify>');
  const result = buildArtifacts(), dir = path.join(root, 'reports/lp18810');
  const outputs = new Map([['owner-membership-decision.json', result.decision], ['county-membership-validation-matrix.json', result.matrix], ['validation-waves.json', result.waves], ['lp18810-summary.json', result.summary]]);
  if (mode === 'build') fs.mkdirSync(dir, { recursive: true });
  for (const [name, value] of outputs) { const expected = stableJson(value), target = path.join(dir, name); if (mode === 'build') fs.writeFileSync(target, expected); else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) throw new Error(`LP188.10 deterministic evidence mismatch: ${name}`); }
  process.stdout.write(stableJson(result.summary));
}
