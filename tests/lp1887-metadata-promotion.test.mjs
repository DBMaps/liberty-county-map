import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { executeMetadataPromotion, stableJson, SUPPORTED_SCOPES } from '../tools/lp1887/execute-metadata-promotion.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const inventory = read('reports/lp1885/community-package-identity-inventory.json');
const eligibilityReview = read('reports/lp1886/county-promotion-eligibility-review.json');
const runtimeRegistry = read('data/lp149/runtime-county-registry.json');
const restrictions = read('reports/lp186/county-restriction-reconciliation.json');
const governedAuthorization = read('reports/lp1887/owner-promotion-authorization.json');
const inputs = { inventory, eligibilityReview, runtimeRegistry, restrictions };
const exact = row => ({ countyFips: row.countyFips, packageSha256: row.sha256, schemaVersion: row.schemaVersion });
const authorization = (promotionScope, rows, extra = {}) => ({
  schemaVersion: 'gridly.community-package.owner-promotion-authorization.lp1887.v1', milestone: 'LP188.7',
  authorizationStatus: 'OWNER_AUTHORIZED', promotionScope, authorizedPackageCount: rows.length,
  authorizedPackages: rows.map(exact), promotionOnly: true, activationAuthorized: false,
  deploymentAuthorized: false, publicationAuthorized: false, supabaseChangeAuthorized: false,
  restrictionClearingAuthorized: false, ...extra
});
const run = auth => executeMetadataPromotion({ ...inputs, authorization: auth });

test('governed owner authorization binds ALL_254_IDENTITIES exactly to LP188.5', () => {
  assert.equal(governedAuthorization.schemaVersion, 'gridly.community-package.owner-promotion-authorization.lp1887.v1');
  assert.equal(governedAuthorization.milestone, 'LP188.7');
  assert.equal(governedAuthorization.authorizationStatus, 'OWNER_AUTHORIZED');
  assert.equal(governedAuthorization.promotionScope, 'ALL_254_IDENTITIES');
  assert.equal(governedAuthorization.authorizedPackageCount, 254);
  assert.deepEqual(governedAuthorization.authorizedPackages, inventory.packages.map(exact));
  assert.deepEqual({
    promotionOnly: governedAuthorization.promotionOnly,
    activationAuthorized: governedAuthorization.activationAuthorized,
    deploymentAuthorized: governedAuthorization.deploymentAuthorized,
    publicationAuthorized: governedAuthorization.publicationAuthorized,
    supabaseChangeAuthorized: governedAuthorization.supabaseChangeAuthorized,
    restrictionClearingAuthorized: governedAuthorization.restrictionClearingAuthorized
  }, {
    promotionOnly: true,
    activationAuthorized: false,
    deploymentAuthorized: false,
    publicationAuthorized: false,
    supabaseChangeAuthorized: false,
    restrictionClearingAuthorized: false
  });
  const result = run(governedAuthorization);
  assert.equal(result.summary.authorizationIdentityMismatchCount, 0);
  assert.equal(result.summary.promotionExecutionFailureCount, 0);
  assert.equal(result.summary.overallClassification, 'PASS_OWNER_PROMOTION_AUTHORIZED_METADATA_ONLY_PROMOTION_RECORDED_ACTIVATION_UNCHANGED');
});

test('branch, milestone, structural eligibility, and prior launch or activation evidence never infer authorization', () => {
  for (const auth of [null, {}, { milestone: 'LP188.7' }, { structuralPromotionEligibility: true }, { activationAuthorized: true }, { launchAuthorized: true }]) {
    const result = run(auth);
    assert.equal(result.summary.ownerAuthorizationRecordedCount, 0);
    assert.equal(result.summary.promotedCount, 0);
    assert.equal(result.summary.overallClassification, 'OWNER_PROMOTION_AUTHORIZATION_REQUIRED_NO_EXECUTION');
  }
});

test('authorization requires explicit OWNER_AUTHORIZED and every promotion-only negative capability', () => {
  const valid = authorization('EXPLICIT_COUNTY_FIPS', [inventory.packages[0]]);
  assert.equal(run(valid).summary.promotedCount, 1);
  for (const mutation of [{ authorizationStatus: 'NOT_AUTHORIZED' }, { promotionOnly: false }, { activationAuthorized: true },
    { deploymentAuthorized: true }, { publicationAuthorized: true }, { supabaseChangeAuthorized: true }, { restrictionClearingAuthorized: true }]) {
    assert.equal(run({ ...valid, ...mutation }).summary.promotedCount, 0);
  }
});

test('authorization is exact FIPS, SHA-256, and supported-schema bound and fails closed', () => {
  const valid = authorization('EXPLICIT_COUNTY_FIPS', [inventory.packages[0]]);
  const mutations = [
    [{ countyFips: '48999' }], [{ packageSha256: '0'.repeat(64) }], [{ packageSha256: null }],
    [{ schemaVersion: 'unsupported' }]
  ];
  for (const [mutation] of mutations) {
    const broken = { ...valid, authorizedPackages: [{ ...valid.authorizedPackages[0], ...mutation }] };
    const result = run(broken);
    assert.equal(result.summary.promotedCount, 0);
    assert.equal(result.summary.overallClassification, 'BLOCKED_OWNER_AUTHORIZATION_IDENTITY_MISMATCH');
    assert.ok(result.summary.authorizationIdentityMismatchCount > 0);
  }
});

test('duplicate FIPS and unstable ordering fail closed', () => {
  const two = inventory.packages.slice(0, 2);
  const duplicate = authorization('EXPLICIT_COUNTY_FIPS', [two[0], two[0]]);
  assert.equal(run(duplicate).summary.promotedCount, 0);
  const reversed = authorization('EXPLICIT_COUNTY_FIPS', two.slice().reverse());
  assert.equal(run(reversed).summary.promotedCount, 0);
});

test('ALL_254_IDENTITIES reconciles and promotes exactly 254 metadata identities', () => {
  const result = run(authorization('ALL_254_IDENTITIES', inventory.packages));
  assert.equal(result.summary.promotionAuthorizedCount, 254);
  assert.equal(result.summary.promotedCount, 254);
  assert.equal(result.summary.notPromotedCount, 0);
  assert.equal(result.registry.records.length, 254);
  assert.ok(result.registry.records.every(row => row.promotionStatus === 'PROMOTED_METADATA_ONLY'));
});

test('ALL_243_UNRESTRICTED_IDENTITIES reconciles only the 243 unrestricted identities', () => {
  const restricted = new Set(restrictions.map(row => row.fips));
  const rows = inventory.packages.filter(row => !restricted.has(row.countyFips));
  const result = run(authorization('ALL_243_UNRESTRICTED_IDENTITIES', rows));
  assert.equal(rows.length, 243);
  assert.equal(result.summary.promotedCount, 243);
  assert.equal(result.summary.notPromotedCount, 11);
  assert.equal(result.summary.restrictedPromotedCount, 0);
});

test('explicit-list and governed-batch scopes promote only exact selected members', () => {
  const rows = inventory.packages.slice(5, 8);
  const listed = run(authorization('EXPLICIT_COUNTY_FIPS', rows));
  assert.deepEqual(listed.registry.records.filter(row => row.promotionStatus === 'PROMOTED_METADATA_ONLY').map(row => row.countyFips), rows.map(row => row.countyFips));
  const batch = run(authorization('EXPLICIT_GOVERNED_BATCH', rows, { governedBatch: { batchId: 'GOVERNED_BATCH_001', countyFips: rows.map(row => row.countyFips) } }));
  assert.deepEqual(batch.registry.records.filter(row => row.promotionStatus === 'PROMOTED_METADATA_ONLY').map(row => row.countyFips), rows.map(row => row.countyFips));
  const ambiguous = authorization('EXPLICIT_GOVERNED_BATCH', rows, { governedBatch: { batchId: 'GOVERNED_BATCH_001', countyFips: rows.slice(1).map(row => row.countyFips) } });
  assert.equal(run(ambiguous).summary.promotedCount, 0);
  assert.deepEqual(SUPPORTED_SCOPES, ['ALL_254_IDENTITIES', 'ALL_243_UNRESTRICTED_IDENTITIES', 'EXPLICIT_COUNTY_FIPS', 'EXPLICIT_GOVERNED_BATCH']);
});

test('restricted metadata promotion retains all 11 restrictions and activation blocks', () => {
  const result = run(authorization('ALL_254_IDENTITIES', inventory.packages));
  assert.equal(result.summary.restrictedPromotedCount, 11);
  assert.equal(result.summary.restrictedActivationBlockedCount, 11);
  for (const row of result.registry.records.filter(row => row.restrictionStatus === 'RESTRICTED_PRESERVED')) {
    assert.equal(row.activationStatus, 'ACTIVATION_BLOCKED');
    assert.equal(row.activationAuthorized, false);
    assert.ok(row.restrictionReason);
    assert.ok(row.blockingReasons.includes('ACTIVATION_BLOCKED_RESTRICTION_PRESERVED'));
  }
});

test('promotion preserves operational, restriction, activation, runtime, package, Supabase, and deployment invariants', () => {
  const result = run(authorization('ALL_254_IDENTITIES', inventory.packages));
  assert.equal(result.summary.currentOperationalCount, 28);
  assert.equal(result.summary.restrictedCountyCount, 11);
  assert.equal(result.summary.newActivationEligibleCount, 0);
  assert.equal(result.summary.newActivatedCount, 0);
  assert.equal(result.summary.runtimeOperationalCountChanged, false);
  assert.equal(result.summary.restrictedCountyStateChanged, false);
  assert.equal(result.summary.runtimeIsolationPass, true);
  assert.equal(result.summary.packageBytesChanged, false);
  assert.equal(result.summary.runtimeArtifactsChanged, false);
  assert.equal(result.summary.nextMilestone, 'SEPARATE_OWNER_ACTIVATION_AUTHORIZATION_MILESTONE');
  const source = fs.readFileSync(path.join(root, 'tools/lp1887/execute-metadata-promotion.mjs'), 'utf8');
  assert.doesNotMatch(source, /GRIDLY_COUNTY_REGISTRY|defaultAwarenessAreas|createClient\(|\.upload\(|fetch\(|execSync|spawnSync|manufacture|census/i);
});

test('execution does not rewrite package, LP188.5, runtime, awareness, or Supabase artifacts and is deterministic', () => {
  const protectedPaths = ['Community-Packages/counties/48001.json', 'reports/lp1885/community-package-identity-inventory.json',
    'data/lp149/runtime-county-registry.json', 'js/config.js'];
  const existing = protectedPaths.filter(relative => fs.existsSync(path.join(root, relative)));
  const hashes = () => existing.map(relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex'));
  const before = hashes();
  const auth = authorization('ALL_254_IDENTITIES', inventory.packages);
  assert.equal(stableJson(run(auth)), stableJson(run(auth)));
  assert.deepEqual(hashes(), before);
  assert.ok(run(null).registry.records.every(row => row.promotionStatus === 'NOT_PROMOTED'));
});
