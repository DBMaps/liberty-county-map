#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

export function evaluatePromotion({ inventory, certification, runtimeRegistry, restrictions, authorization }) {
  const restrictionByFips = new Map(restrictions.map(row => [row.fips, row]));
  const runtimeByFips = new Map(runtimeRegistry.identities.map(row => [row.fips, row]));
  const inventoryByFips = new Map(inventory.packages.map(row => [row.countyFips, row]));
  const authorizationByFips = new Map((authorization?.records || []).map(row => [row.countyFips, row]));
  const certificationReady = certification.schemaVersion === 'gridly.community-package.identity-capture-certification.lp1885.v1'
    && certification.capturedPackageCount === 254 && certification.deterministicCapturePass === true
    && certification.runtimeIsolationPass === true
    && ['missingCountyPackages', 'duplicateCountyPackages', 'invalidCountyFips', 'countyIdentityMismatch', 'missingSha256', 'duplicatePackageHashes', 'packageValidationFailures'].every(key => Array.isArray(certification[key]) && certification[key].length === 0);

  const records = runtimeRegistry.identities.map(county => {
    const identity = inventoryByFips.get(county.fips);
    const validIdentity = certificationReady && identity?.countyFips === county.fips && identity?.schemaVersion === 'gridly.community-package.identity.v1' && /^[a-f0-9]{64}$/.test(identity?.sha256 || '');
    const auth = authorizationByFips.get(county.fips);
    const authorized = validIdentity && auth?.countyFips === county.fips && auth?.packageSha256 === identity.sha256
      && auth?.schemaVersion === identity.schemaVersion && auth?.promotionScope === 'METADATA_ONLY_PACKAGE_PROMOTION'
      && auth?.authorizationStatus === 'OWNER_AUTHORIZED';
    const restriction = restrictionByFips.get(county.fips);
    const operational = county.operationalMembership.active === true;
    const blockingReasons = [];
    if (!validIdentity) blockingReasons.push('AUTHORITATIVE_LP1885_PACKAGE_IDENTITY_NOT_READY');
    if (!authorized) blockingReasons.push('PROMOTION_OWNER_AUTHORIZATION_NOT_RECORDED');
    if (restriction) blockingReasons.push('ACTIVATION_BLOCKED_RESTRICTION_PRESERVED');
    if (!operational) blockingReasons.push('ACTIVATION_REMAINS_A_LATER_MILESTONE');
    return {
      countyFips: county.fips,
      countyName: identity?.countyName ?? county.countyName.replace(/ County$/, ''),
      packageSha256: identity?.sha256 ?? null,
      packageIdentityReady: validIdentity,
      structuralPromotionEligibility: validIdentity ? 'STRUCTURALLY_PROMOTION_ELIGIBLE' : 'NOT_STRUCTURALLY_PROMOTION_ELIGIBLE',
      ownerAuthorizationRequired: true,
      ownerAuthorizationStatus: authorized ? 'OWNER_AUTHORIZED' : 'OWNER_AUTHORIZATION_REQUIRED',
      promotionStatus: 'NOT_PROMOTED',
      restrictionStatus: restriction ? 'RESTRICTED_PRESERVED' : 'UNRESTRICTED',
      restrictionReason: restriction?.originalReason ?? null,
      currentOperationalStatus: operational ? 'CURRENT_OPERATIONAL_BASELINE_PRESERVED' : 'NOT_OPERATIONAL',
      activationEligible: false,
      activationStatus: operational ? 'CURRENT_OPERATIONAL_BASELINE_PRESERVED' : (restriction ? 'ACTIVATION_BLOCKED' : 'NOT_ACTIVATED'),
      blockingReasons
    };
  });
  const count = predicate => records.filter(predicate).length;
  const summary = {
    schemaVersion: 'gridly.community-package.promotion-eligibility-certification.lp1886.v1',
    expectedCountyCount: 254,
    evaluatedCountyCount: records.length,
    packageIdentityReadyCount: count(row => row.packageIdentityReady),
    structuralPromotionEligibleCount: count(row => row.structuralPromotionEligibility === 'STRUCTURALLY_PROMOTION_ELIGIBLE'),
    ownerAuthorizationRequiredCount: count(row => row.ownerAuthorizationRequired),
    ownerAuthorizationRecordedCount: count(row => row.ownerAuthorizationStatus === 'OWNER_AUTHORIZED'),
    promotionAuthorizedCount: count(row => row.ownerAuthorizationStatus === 'OWNER_AUTHORIZED'),
    promotedCount: 0,
    currentOperationalCount: count(row => row.currentOperationalStatus === 'CURRENT_OPERATIONAL_BASELINE_PRESERVED'),
    restrictedCountyCount: count(row => row.restrictionStatus === 'RESTRICTED_PRESERVED'),
    newActivationEligibleCount: 0,
    newActivatedCount: 0,
    runtimeOperationalCountChanged: false,
    restrictedCountyStateChanged: false,
    runtimeIsolationPass: certification.runtimeIsolationPass === true,
    blockedPromotionCount: count(row => row.promotionStatus !== 'PROMOTED'),
    overallClassification: certificationReady && records.every(row => row.packageIdentityReady)
      ? 'PROMOTION_ELIGIBILITY_CERTIFIED_OWNER_AUTHORIZATION_REQUIRED'
      : 'BLOCKED_PROMOTION_ELIGIBILITY_PREREQUISITES_INCOMPLETE'
  };
  return { schemaVersion: 'gridly.community-package.promotion-eligibility-review.lp1886.v1', purpose: 'METADATA_ONLY_NOT_RUNTIME_ACTIVATION', records, summary };
}

export function buildAuthorizationRequest(inventory) {
  return {
    schemaVersion: 'gridly.community-package.owner-promotion-authorization.lp1886.v1',
    authority: 'OWNER_DECISION_REQUIRED_NON_AUTHORIZING_TEMPLATE',
    promotionScope: 'METADATA_ONLY_PACKAGE_PROMOTION',
    effect: 'PROMOTION_METADATA_ONLY_ACTIVATION_UNCHANGED',
    supportedSelectionScopes: ['ALL_254_IDENTITIES', 'ALL_243_UNRESTRICTED_IDENTITIES', 'EXPLICIT_COUNTY_FIPS', 'EXPLICIT_GOVERNED_BATCH'],
    ownerDecisionInstructions: 'Change no status indirectly. An owner decision must explicitly select a scope and set each selected exact FIPS plus SHA-256 record to OWNER_AUTHORIZED in a later governed authorization milestone.',
    authorizationStatus: 'OWNER_AUTHORIZATION_REQUIRED',
    records: inventory.packages.map(row => ({ countyFips: row.countyFips, packageSha256: row.sha256, schemaVersion: row.schemaVersion, promotionScope: 'METADATA_ONLY_PACKAGE_PROMOTION', authorizationStatus: 'NOT_AUTHORIZED' }))
  };
}

function artifacts() {
  const inventory = read('reports/lp1885/community-package-identity-inventory.json');
  const authorization = buildAuthorizationRequest(inventory);
  const review = evaluatePromotion({ inventory, certification: read('reports/lp1885/lp1885-identity-capture-certification.json'), runtimeRegistry: read('data/lp149/runtime-county-registry.json'), restrictions: read('reports/lp186/county-restriction-reconciliation.json'), authorization });
  return { authorization, review, summary: review.summary };
}

function outputFiles(values) {
  return new Map([
    ['owner-promotion-authorization-request.json', values.authorization],
    ['county-promotion-eligibility-review.json', { schemaVersion: values.review.schemaVersion, purpose: values.review.purpose, records: values.review.records }],
    ['lp1886-summary.json', values.summary]
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2];
  if (!['build', 'verify'].includes(mode)) throw new Error('usage: review-promotion-eligibility.mjs <build|verify>');
  const files = outputFiles(artifacts());
  const directory = path.join(root, 'reports/lp1886');
  if (mode === 'build') fs.mkdirSync(directory, { recursive: true });
  for (const [name, value] of files) {
    const expected = stableJson(value), target = path.join(directory, name);
    if (mode === 'build') fs.writeFileSync(target, expected);
    else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== expected) throw new Error(`LP188.6 deterministic evidence mismatch: ${name}`);
  }
  process.stdout.write(stableJson(artifacts().summary));
}
