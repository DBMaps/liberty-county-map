#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;

export function reconcileActivationEligibility({ identities, promotion, restrictions, addressManifest, certification, membership, enablement, execution }) {
  const keyed = (rows, key) => new Map(rows.map(row => [row[key], row]));
  const promoted = keyed(promotion.records, 'countyFips');
  const restricted = keyed(restrictions, 'fips');
  const addresses = keyed(addressManifest.packages, 'fips');
  const certified = keyed(certification.counties, 'fips');
  const members = keyed(membership.counties, 'fips');
  const enabled = keyed(enablement.counties, 'fips');
  const executed = keyed(execution.counties, 'fips');

  if (identities.identities.length !== 254 || new Set(identities.identities.map(row => row.fips)).size !== 254) throw new Error('LP188.8 requires 254 unique governed identities');
  const records = identities.identities.map(identity => {
    const p = promoted.get(identity.fips), restriction = restricted.get(identity.fips), address = addresses.get(identity.fips);
    const cert = certified.get(identity.fips), member = members.get(identity.fips), countyEnablement = enabled.get(identity.fips), countyExecution = executed.get(identity.fips);
    const evidenceComplete = Boolean(p && address && cert && member && countyEnablement && countyExecution && p.countyName === identity.countyName.replace(/ County$/, ''));
    const operational = identity.operationalMembership?.active === true && member?.currentOperationalMembership === true && countyExecution?.currentOperational === true;
    const promotionValid = p?.promotionStatus === 'PROMOTED_METADATA_ONLY' && /^[a-f0-9]{64}$/.test(p?.packageSha256 || '');
    const addressReady = cert?.certificationStatus === 'CERTIFIED' && !restriction;
    const runtimePrerequisitesReady = operational || (member?.candidateMembershipStatus === 'CANDIDATE'
      && member?.approvedMembershipStatus === 'APPROVED' && countyEnablement?.deployment?.state === 'DEPLOYED'
      && countyExecution?.operationalValidation?.state === 'READY');
    const structural = !operational && evidenceComplete && promotionValid && addressReady && runtimePrerequisitesReady;
    const blockers = [];
    if (!evidenceComplete) blockers.push('UNKNOWN_OR_MISSING_GOVERNED_AUTHORITY');
    if (!promotionValid) blockers.push('COMMUNITY_PROMOTION_IDENTITY_MISSING_OR_INVALID');
    if (restriction) blockers.push('EXACT_LP130_ADDRESS_PAYLOAD_RESTORATION_AND_UNCHANGED_LP134_DOUBLE_CERTIFICATION_REQUIRED');
    else if (!addressReady) blockers.push('REQUIRED_ADDRESS_CERTIFICATION_MISSING');
    if (!operational && !runtimePrerequisitesReady) blockers.push('CANDIDACY_MEMBERSHIP_DEPLOYMENT_AND_RUNTIME_VALIDATION_NOT_GOVERNED_COMPLETE');
    if (structural) blockers.push('EXPLICIT_OWNER_ACTIVATION_AUTHORIZATION_REQUIRED');
    return {
      countyFips: identity.fips,
      countyName: identity.countyName,
      communityPackagePromoted: promotionValid,
      packageSha256: p?.packageSha256 ?? null,
      countyIdentityStatus: evidenceComplete ? 'GOVERNED_CANONICAL_IDENTITY' : 'UNKNOWN_REQUIRES_REVIEW',
      currentOperationalStatus: operational ? 'ALREADY_OPERATIONAL' : 'NOT_OPERATIONAL',
      addressDependencyStatus: addressReady ? 'LP130_LP135_CERTIFIED' : restriction ? 'BLOCKED_EXACT_PAYLOAD_RESTORATION_REQUIRED' : 'UNKNOWN_REQUIRES_REVIEW',
      restrictionStatus: restriction ? 'ACTIVE_PRESERVED' : 'NONE',
      restrictionReason: restriction?.originalReason ?? null,
      crossingDependencyStatus: 'OPTIONAL_CAPABILITY_NOT_UNIVERSAL_ACTIVATION_GATE',
      roadwayDependencyStatus: 'NOT_ESTABLISHED_AS_UNIVERSAL_ACTIVATION_GATE',
      runtimePrerequisiteStatus: runtimePrerequisitesReady ? (operational ? 'SATISFIED_BY_OPERATIONAL_BASELINE' : 'SATISFIED') : 'MISSING_GOVERNED_CANDIDACY_MEMBERSHIP_DEPLOYMENT_AND_VALIDATION',
      structuralActivationEligibility: operational ? 'ALREADY_OPERATIONAL_NOT_NEW_ELIGIBILITY' : structural ? 'NEW_ACTIVATION_ELIGIBLE' : 'NOT_STRUCTURALLY_ACTIVATION_ELIGIBLE',
      ownerActivationAuthorizationStatus: operational ? 'NOT_REQUIRED_ALREADY_OPERATIONAL' : structural ? 'OWNER_ACTIVATION_AUTHORIZATION_REQUIRED' : 'NOT_REQUESTABLE_DEPENDENCIES_BLOCKED',
      activationStatus: operational ? 'ALREADY_OPERATIONAL' : 'NOT_ACTIVATED',
      blockingReasons: operational ? [] : blockers
    };
  }).sort((a, b) => a.countyFips.localeCompare(b.countyFips));

  const count = predicate => records.filter(predicate).length;
  const currentlyOperationalCount = count(row => row.currentOperationalStatus === 'ALREADY_OPERATIONAL');
  const ready = count(row => row.structuralActivationEligibility === 'NEW_ACTIVATION_ELIGIBLE');
  const summary = {
    schemaVersion: 'gridly.statewide-activation-eligibility-certification.lp1888.v1', milestone: 'LP188.8',
    mode: 'AUDIT_AND_OWNER_DECISION_PREPARATION_ONLY', expectedCountyCount: 254, evaluatedCountyCount: records.length,
    currentlyOperationalCount, newStructurallyActivationEligibleCount: ready,
    ownerActivationAuthorizationRequiredCount: ready, ownerActivationAuthorizedCount: 0,
    restrictedCountyCount: count(row => row.restrictionStatus === 'ACTIVE_PRESERVED'),
    addressBlockedCount: count(row => row.addressDependencyStatus.startsWith('BLOCKED_')),
    otherDependencyBlockedCount: count(row => !row.currentOperationalStatus.startsWith('ALREADY') && row.restrictionStatus === 'NONE' && row.runtimePrerequisiteStatus.startsWith('MISSING_')),
    requiresReviewCount: count(row => row.countyIdentityStatus === 'UNKNOWN_REQUIRES_REVIEW' || row.addressDependencyStatus === 'UNKNOWN_REQUIRES_REVIEW'),
    newActivatedCount: 0, totalPotentialOperationalAfterAuthorizedActivation: currentlyOperationalCount + ready,
    runtimeOperationalCountChanged: false, restrictedCountyStateChanged: false,
    overallClassification: ready ? 'ACTIVATION_ELIGIBILITY_CERTIFIED_OWNER_AUTHORIZATION_REQUIRED' : 'ACTIVATION_ELIGIBILITY_RECONCILED_NO_NEW_COUNTY_CURRENTLY_ACTIVATABLE',
    remainingPathTo254: [
      { blocker: 'GOVERNED_CANDIDACY_MEMBERSHIP_DEPLOYMENT_AND_RUNTIME_VALIDATION', countyCount: count(row => !row.currentOperationalStatus.startsWith('ALREADY') && row.runtimePrerequisiteStatus.startsWith('MISSING_')) },
      { blocker: 'RESTRICTED_EXACT_PAYLOAD_RECOVERY_AND_LP134_DOUBLE_CERTIFICATION', countyCount: count(row => row.restrictionStatus === 'ACTIVE_PRESERVED') },
      { blocker: 'EXPLICIT_FIPS_BASED_OWNER_ACTIVATION_AUTHORIZATION_AFTER_STRUCTURAL_READINESS', countyCount: 226 }
    ],
    supportedOwnerAuthorizationScope: 'EXPLICIT_COUNTY_FIPS_OR_EXPLICIT_FIPS_MEMBERSHIP_IN_A_GOVERNED_WAVE',
    nextMilestone: 'LP188.9_GOVERNED_CANDIDACY_MEMBERSHIP_DEPLOYMENT_AND_RUNTIME_VALIDATION_EVIDENCE'
  };
  const restrictedCounties = records.filter(row => row.restrictionStatus === 'ACTIVE_PRESERVED').map(row => {
    const restriction = restricted.get(row.countyFips);
    return { countyFips: row.countyFips, countyName: row.countyName, restrictionAuthority: `${restriction.restrictionId}; ${restriction.governanceSource}`,
      restrictionReason: restriction.originalReason, historicalRecoveryEvidence: 'LP188.1 records historical LP147 remote byte-size and SHA-256 matches; no current restoration is proven.',
      remainingExactPayloadRequirement: 'Restore or securely mount the exact immutable LP130 payload and verify governed byte size and SHA-256.',
      requiredCertificationPasses: 2, activationEligible: false,
      activationBlockedReason: 'RESTORATION_NOT_PROVEN_AND_ACTIVE_RESTRICTION_PRESERVED' };
  });
  const ownerAuthorization = { schemaVersion: 'gridly.owner-activation-authorization-request.lp1888.v1', milestone: 'LP188.8',
    authorizationStatus: 'NOT_REQUESTED_NO_STRUCTURALLY_ELIGIBLE_COUNTIES', authorizationScope: 'EXPLICIT_COUNTY_FIPS', countyFips: [],
    activationAuthorized: false, deploymentAuthorized: false, runtimeMutationAuthorized: false,
    requirement: 'After structural readiness, supply explicit owner authority and the exact ascending FIPS scope; promotion authorization is never accepted.' };
  return { matrix: { schemaVersion: 'gridly.statewide-county-activation-readiness.lp1888.v1', records }, summary, restrictedCounties, ownerAuthorization };
}

export function buildArtifacts() {
  return reconcileActivationEligibility({ identities: read('data/lp149/runtime-county-registry.json'), promotion: read('reports/lp1887/community-package-promotion-only-registry.json'),
    restrictions: read('reports/lp186/county-restriction-reconciliation.json'), addressManifest: read('data/generated/lp104/txgio-addresses/manifest.json'),
    certification: read('evidence/lp135/statewide-certification.json'), membership: read('data/lp150/membership-transition-registry.json'),
    enablement: read('data/lp152/operational-enablement-registry.json'), execution: read('data/lp153/operational-execution-registry.json') });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]; if (!['build', 'verify'].includes(mode)) throw new Error('usage: reconcile-activation-eligibility.mjs <build|verify>');
  const result = buildArtifacts(), dir = path.join(root, 'reports/lp1888');
  const outputs = new Map([['statewide-county-activation-readiness.json', result.matrix], ['lp1888-summary.json', result.summary], ['restricted-county-readiness.json', result.restrictedCounties], ['owner-activation-authorization-request.json', result.ownerAuthorization]]);
  if (mode === 'build') fs.mkdirSync(dir, { recursive: true });
  for (const [name, value] of outputs) { const expected = stableJson(value), target = path.join(dir, name); if (mode === 'build') fs.writeFileSync(target, expected); else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) throw new Error(`LP188.8 deterministic evidence mismatch: ${name}`); }
  process.stdout.write(stableJson(result.summary));
}
