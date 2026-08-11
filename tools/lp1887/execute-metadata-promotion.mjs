#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
export const SUPPORTED_SCOPES = Object.freeze(['ALL_254_IDENTITIES', 'ALL_243_UNRESTRICTED_IDENTITIES', 'EXPLICIT_COUNTY_FIPS', 'EXPLICIT_GOVERNED_BATCH']);
const IDENTITY_SCHEMA = 'gridly.community-package.identity.v1';

export function executeMetadataPromotion({ inventory, eligibilityReview, runtimeRegistry, restrictions, authorization = null }) {
  const inventoryByFips = new Map(inventory.packages.map(row => [row.countyFips, row]));
  const eligibilityByFips = new Map(eligibilityReview.records.map(row => [row.countyFips, row]));
  const runtimeByFips = new Map(runtimeRegistry.identities.map(row => [row.fips, row]));
  const restrictionByFips = new Map(restrictions.map(row => [row.fips, row]));
  const packages = authorization?.authorizedPackages;
  const duplicateFips = Array.isArray(packages) ? packages.length !== new Set(packages.map(row => row?.countyFips)).size : false;
  const explicitOwnerAuthorization = authorization?.authorizationStatus === 'OWNER_AUTHORIZED';
  const invariantFlagsValid = authorization?.promotionOnly === true && authorization?.activationAuthorized === false
    && authorization?.deploymentAuthorized === false && authorization?.publicationAuthorized === false
    && authorization?.supabaseChangeAuthorized === false && authorization?.restrictionClearingAuthorized === false;
  const supportedScope = SUPPORTED_SCOPES.includes(authorization?.promotionScope);
  const requested = Array.isArray(packages) ? packages : [];
  const requestedFips = requested.map(row => row?.countyFips);
  const stableFipsOrdering = requestedFips.every((fips, index) => index === 0 || requestedFips[index - 1] < fips);
  const unrestrictedFips = inventory.packages.filter(row => !restrictionByFips.has(row.countyFips)).map(row => row.countyFips);
  const expectedFips = authorization?.promotionScope === 'ALL_254_IDENTITIES' ? inventory.packages.map(row => row.countyFips)
    : authorization?.promotionScope === 'ALL_243_UNRESTRICTED_IDENTITIES' ? unrestrictedFips
      : authorization?.promotionScope === 'EXPLICIT_GOVERNED_BATCH' ? authorization?.governedBatch?.countyFips ?? [] : requestedFips;
  const scopeReconciles = supportedScope && Array.isArray(expectedFips) && expectedFips.length === requestedFips.length
    && expectedFips.every((fips, index) => fips === requestedFips[index]);
  const identityMismatches = requested.filter(row => {
    const exact = inventoryByFips.get(row?.countyFips);
    return !exact || row?.packageSha256 !== exact.sha256 || row?.schemaVersion !== exact.schemaVersion || row?.schemaVersion !== IDENTITY_SCHEMA;
  });
  const authorizationValid = explicitOwnerAuthorization && authorization?.schemaVersion === 'gridly.community-package.owner-promotion-authorization.lp1887.v1'
    && authorization?.milestone === 'LP188.7' && invariantFlagsValid && supportedScope && stableFipsOrdering && !duplicateFips
    && scopeReconciles && authorization?.authorizedPackageCount === requested.length && identityMismatches.length === 0;
  const authorizedFips = new Set(authorizationValid ? requestedFips : []);

  const records = inventory.packages.map(identity => {
    const eligibility = eligibilityByFips.get(identity.countyFips);
    const runtime = runtimeByFips.get(identity.countyFips);
    const restriction = restrictionByFips.get(identity.countyFips);
    const authorized = authorizedFips.has(identity.countyFips);
    const operational = runtime?.operationalMembership?.active === true;
    const blockingReasons = [];
    if (!authorized) blockingReasons.push('PROMOTION_OWNER_AUTHORIZATION_NOT_RECORDED');
    if (restriction) blockingReasons.push('ACTIVATION_BLOCKED_RESTRICTION_PRESERVED');
    if (!operational) blockingReasons.push('ACTIVATION_REMAINS_A_LATER_MILESTONE');
    return {
      countyFips: identity.countyFips,
      countyName: identity.countyName,
      packageSha256: identity.sha256,
      schemaVersion: identity.schemaVersion,
      structuralPromotionEligibility: eligibility?.structuralPromotionEligibility ?? 'NOT_STRUCTURALLY_PROMOTION_ELIGIBLE',
      ownerAuthorizationStatus: authorized ? 'OWNER_AUTHORIZED' : 'OWNER_AUTHORIZATION_REQUIRED',
      promotionStatus: authorized ? 'PROMOTED_METADATA_ONLY' : 'NOT_PROMOTED',
      restrictionStatus: restriction ? 'RESTRICTED_PRESERVED' : 'UNRESTRICTED',
      restrictionReason: restriction?.originalReason ?? null,
      currentOperationalStatus: operational ? 'CURRENT_OPERATIONAL_BASELINE_PRESERVED' : 'NOT_OPERATIONAL',
      activationStatus: operational ? 'CURRENT_OPERATIONAL_BASELINE_PRESERVED' : (restriction ? 'ACTIVATION_BLOCKED' : 'NOT_ACTIVATED'),
      activationAuthorized: false,
      blockingReasons
    };
  });
  const count = predicate => records.filter(predicate).length;
  const promotedCount = count(row => row.promotionStatus === 'PROMOTED_METADATA_ONLY');
  const mismatchCount = identityMismatches.length + (duplicateFips || (!scopeReconciles && explicitOwnerAuthorization) ? 1 : 0);
  const classification = !explicitOwnerAuthorization ? 'OWNER_PROMOTION_AUTHORIZATION_REQUIRED_NO_EXECUTION'
    : !authorizationValid ? 'BLOCKED_OWNER_AUTHORIZATION_IDENTITY_MISMATCH'
      : 'PASS_OWNER_PROMOTION_AUTHORIZED_METADATA_ONLY_PROMOTION_RECORDED_ACTIVATION_UNCHANGED';
  const summary = {
    schemaVersion: 'gridly.community-package.metadata-promotion-certification.lp1887.v1',
    milestone: 'LP188.7',
    explicitOwnerPromotionAuthorizationAvailable: explicitOwnerAuthorization,
    promotionScope: explicitOwnerAuthorization ? authorization.promotionScope : null,
    expectedCountyCount: 254,
    evaluatedCountyCount: records.length,
    packageIdentityReadyCount: count(row => row.structuralPromotionEligibility === 'STRUCTURALLY_PROMOTION_ELIGIBLE'),
    structuralPromotionEligibleCount: count(row => row.structuralPromotionEligibility === 'STRUCTURALLY_PROMOTION_ELIGIBLE'),
    ownerAuthorizationRequiredCount: 254 - authorizedFips.size,
    ownerAuthorizationRecordedCount: authorizedFips.size,
    promotionAuthorizedCount: authorizedFips.size,
    promotedCount,
    notPromotedCount: 254 - promotedCount,
    currentOperationalCount: count(row => row.currentOperationalStatus === 'CURRENT_OPERATIONAL_BASELINE_PRESERVED'),
    restrictedCountyCount: count(row => row.restrictionStatus === 'RESTRICTED_PRESERVED'),
    restrictedPromotedCount: count(row => row.restrictionStatus === 'RESTRICTED_PRESERVED' && row.promotionStatus === 'PROMOTED_METADATA_ONLY'),
    restrictedActivationBlockedCount: count(row => row.restrictionStatus === 'RESTRICTED_PRESERVED' && row.activationStatus === 'ACTIVATION_BLOCKED'),
    newActivationEligibleCount: 0,
    newActivatedCount: 0,
    runtimeOperationalCountChanged: false,
    restrictedCountyStateChanged: false,
    runtimeIsolationPass: true,
    packageBytesChanged: false,
    runtimeArtifactsChanged: false,
    authorizationIdentityMismatchCount: mismatchCount,
    promotionExecutionFailureCount: explicitOwnerAuthorization && !authorizationValid ? requested.length : 0,
    overallClassification: classification,
    nextMilestone: explicitOwnerAuthorization ? 'SEPARATE_OWNER_ACTIVATION_AUTHORIZATION_MILESTONE' : 'LP188.7_EXPLICIT_OWNER_PROMOTION_AUTHORIZATION_DECISION'
  };
  return { registry: { schemaVersion: 'gridly.community-package.promotion-only-registry.lp1887.v1', purpose: 'METADATA_ONLY_NOT_RUNTIME_ACTIVATION', records }, summary };
}

function artifacts() {
  const authorizationPath = path.join(root, 'reports/lp1887/owner-promotion-authorization.json');
  return executeMetadataPromotion({
    inventory: read('reports/lp1885/community-package-identity-inventory.json'),
    eligibilityReview: read('reports/lp1886/county-promotion-eligibility-review.json'),
    runtimeRegistry: read('data/lp149/runtime-county-registry.json'),
    restrictions: read('reports/lp186/county-restriction-reconciliation.json'),
    authorization: fs.existsSync(authorizationPath) ? JSON.parse(fs.readFileSync(authorizationPath, 'utf8')) : null
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!['build', 'verify'].includes(mode)) throw new Error('usage: execute-metadata-promotion.mjs <build|verify>');
  const values = artifacts();
  const outputs = new Map([['community-package-promotion-only-registry.json', values.registry], ['lp1887-summary.json', values.summary]]);
  const directory = path.join(root, 'reports/lp1887');
  if (mode === 'build') fs.mkdirSync(directory, { recursive: true });
  for (const [name, value] of outputs) {
    const target = path.join(directory, name), expected = stableJson(value);
    if (mode === 'build') fs.writeFileSync(target, expected, 'utf8');
    else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) throw new Error(`LP188.7 deterministic evidence mismatch: ${name}`);
  }
  process.stdout.write(stableJson(values.summary));
}
