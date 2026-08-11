#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2] || 'verify';
if (!['build', 'verify'].includes(mode)) throw new Error('usage: build|verify');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, ''));
const stable = value => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const identity = read('data/lp149/runtime-county-registry.json');
const membership = read('data/lp150/membership-transition-registry.json');
const enablement = read('data/lp152/operational-enablement-registry.json');
const execution = read('data/lp153/operational-execution-registry.json');
const activation = read('reports/lp186/texas-county-activation-inventory.json');
const restrictions = read('reports/lp186/county-restriction-reconciliation.json');
const certification = read('evidence/lp1884/lp1883-authoritative-windows-certification.json');
const crossings = read('Crossing-Packages/production-crossing-manifest.json');

const uniqueMap = (rows, key, label) => {
  const result = new Map();
  for (const row of rows) { if (result.has(row[key])) throw new Error(`LP188.4 fail closed: duplicate ${label} ${row[key]}`); result.set(row[key], row); }
  return result;
};
if (identity.identityCount !== 254 || identity.identities.length !== 254 || certification.manufacturedCountyCount !== 254 || certification.overallClassification !== 'PASS') throw new Error('LP188.4 fail closed: statewide authorities are incomplete');
if (certification.schemaVersion !== 'gridly.community-package.certification.lp1883.v1' || certification.deterministicGenerationPass !== true || certification.validationFailureCount !== 0) throw new Error('LP188.4 fail closed: LP188.3 certification is not promotable evidence');

const memberByFips = uniqueMap(membership.counties, 'fips', 'membership FIPS');
const enablementByFips = uniqueMap(enablement.counties, 'fips', 'enablement FIPS');
const executionByFips = uniqueMap(execution.counties, 'fips', 'execution FIPS');
const activationByFips = uniqueMap(activation, 'fips', 'activation FIPS');
const restrictionByFips = uniqueMap(restrictions, 'fips', 'restriction FIPS');
const crossingByCounty = new Map(crossings.records.map(row => [`${row.county} County`, row]));
const portableBytesPresent = certification.portablePackageBytesPresent === true;

const matrix = identity.identities.map(county => {
  const member = memberByFips.get(county.fips), enabled = enablementByFips.get(county.fips), executed = executionByFips.get(county.fips), prior = activationByFips.get(county.fips);
  if (!member || !enabled || !executed || !prior) throw new Error(`LP188.4 fail closed: missing governed dependency for ${county.fips}`);
  const restriction = restrictionByFips.get(county.fips);
  const operational = county.operationalMembership.active === true && member.currentOperationalMembership === true && executed.currentOperational === true;
  const crossing = crossingByCounty.get(county.countyName);
  const blockingReasons = [];
  if (!portableBytesPresent) blockingReasons.push('COMMUNITY_PACKAGE_BYTES_AND_PER_COUNTY_SHA256_NOT_PRESENT_IN_PORTABLE_GOVERNANCE');
  if (restriction) blockingReasons.push('EXACT_LP130_ADDRESS_PAYLOAD_RESTORATION_AND_UNCHANGED_LP134_RECERTIFICATION_REQUIRED');
  if (!operational) blockingReasons.push('CANDIDACY_MEMBERSHIP_DEPLOYMENT_AND_ACTIVATION_OWNER_AUTHORIZATION_ABSENT');
  return {
    countyFips: county.fips,
    countyName: county.countyName,
    communityPackagePath: `counties/${county.fips}.json`,
    communityPackageSchemaVersion: 'gridly.community-package.identity.v1',
    communityPackageSha256: null,
    communityPackageManufactured: 'MANUFACTURED_CERTIFIED_BY_LP1883_WINDOWS_EVIDENCE',
    communityPackageCertified: 'CERTIFIED',
    communityPackagePromotionEligible: 'BLOCKED_PENDING_PORTABLE_PACKAGE_HASH_EVIDENCE',
    communityPackagePromoted: 'NOT_PROMOTED',
    addressDependencyStatus: restriction ? 'RESTRICTED_EXACT_PAYLOAD_RESTORATION_REQUIRED' : 'CERTIFIED',
    roadwayDependencyStatus: operational ? 'CURRENT_RUNTIME_PRESERVED' : 'NOT_PROVEN_REQUIRED_FOR_ACTIVATION',
    crossingDependencyStatus: crossing?.status === 'PASS' ? 'CERTIFIED_OPTIONAL_CAPABILITY' : 'ABSENT_OPTIONAL_CAPABILITY',
    restrictionStatus: restriction ? 'ACTIVE_PRESERVED' : 'NONE',
    activationEligible: operational ? 'NOT_APPLICABLE_ALREADY_OPERATIONAL' : 'BLOCKED',
    activationAuthorized: operational ? enabled.activationAuthorization.state : 'NOT_AUTHORIZED',
    activationStatus: operational ? 'CURRENT_OPERATIONAL_BASELINE_PRESERVED' : 'NOT_ACTIVATED',
    blockingReasons
  };
}).sort((a, b) => a.countyFips.localeCompare(b.countyFips));

if (matrix.length !== 254 || new Set(matrix.map(row => row.countyFips)).size !== 254) throw new Error('LP188.4 fail closed: readiness matrix does not cover 254 unique FIPS');
const operationalRows = matrix.filter(row => row.activationStatus === 'CURRENT_OPERATIONAL_BASELINE_PRESERVED');
const restrictedRows = matrix.filter(row => row.restrictionStatus === 'ACTIVE_PRESERVED');
if (operationalRows.length !== 28 || restrictedRows.length !== 11) throw new Error('LP188.4 fail closed: operational or restricted baseline changed');
if (matrix.some(row => row.communityPackagePromoted !== 'NOT_PROMOTED') || matrix.some(row => row.activationStatus === 'ACTIVATED')) throw new Error('LP188.4 fail closed: promotion or activation attempted');

const summary = {
  schemaVersion: 'gridly.community-package.promotion-readiness.lp1884.v1', milestone: 'LP188.4', mode: 'PROMOTION_ACTIVATION_READINESS_AUDIT_ONLY',
  expectedCountyCount: 254, evaluatedCountyCount: matrix.length, communityPackagesManufactured: 254, communityPackagesCertified: 254,
  promotionEligibleCount: 0, promotedCount: 0, activationEligibleCount: 0, activatedCount: operationalRows.length, currentlyOperationalCount: operationalRows.length,
  restrictedCountyCount: restrictedRows.length, blockedCountyCount: matrix.filter(row => row.activationStatus === 'NOT_ACTIVATED').length,
  missingCommunityPackages: 0, invalidCommunityPackages: 0,
  countiesMissingDependencies: matrix.filter(row => row.activationStatus === 'NOT_ACTIVATED').map(row => row.countyFips),
  countiesWithRestrictions: restrictedRows.map(row => row.countyFips), runtimeOperationalCountChanged: false, restrictedCountyStateChanged: false,
  promotionArchitecture: { registrationSeparatedFromActivation: false, finding: 'The existing community registry is executable runtime configuration; no governed promotion-only inventory consumes LP188.3 identities. LP188.4 therefore records readiness outside runtime and does not promote.', blocker: 'PROMOTION_BLOCKED_ARCHITECTURE_REQUIRES_SEPARATION_AND_PORTABLE_PACKAGE_HASH_EVIDENCE' },
  packageInventoryIdentitySha256: sha256(stable(matrix)),
  overallClassification: 'PASS_PROMOTION_READINESS_AUDITED_ACTIVATION_REMAINS_GOVERNED',
  nextMilestone: 'LP188.5 — capture the 254 authoritative package bytes and SHA-256 inventory into portable governance, design and certify a metadata-only promotion registry that runtime cannot consume, then reassess promotion. Do not authorize activation.'
};

const outputs = new Map([['reports/lp1884/texas-community-package-promotion-readiness.json', matrix], ['reports/lp1884/lp1884-readiness-summary.json', summary]]);
for (const [relative, value] of outputs) {
  const target = path.join(root, relative), content = stable(value);
  if (mode === 'build') { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
  else if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) throw new Error(`LP188.4 fail closed: ${relative} is missing or stale`);
}
console.log(`LP188.4 ${mode} PASS: 254 certified; 0 promoted; 28 operational preserved; 11 restricted preserved; 226 activation-blocked`);
