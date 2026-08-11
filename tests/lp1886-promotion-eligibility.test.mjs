import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildAuthorizationRequest, evaluatePromotion, stableJson } from '../tools/lp1886/review-promotion-eligibility.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const inventory = read('reports/lp1885/community-package-identity-inventory.json');
const certification = read('reports/lp1885/lp1885-identity-capture-certification.json');
const runtimeRegistry = read('data/lp149/runtime-county-registry.json');
const restrictions = read('reports/lp186/county-restriction-reconciliation.json');
const authorization = read('reports/lp1886/owner-promotion-authorization-request.json');
const review = read('reports/lp1886/county-promotion-eligibility-review.json');
const summary = read('reports/lp1886/lp1886-summary.json');
const evaluate = auth => evaluatePromotion({ inventory, certification, runtimeRegistry, restrictions, authorization: auth });

test('254 exact LP188.5 FIPS and SHA-256 identities are structurally eligible but not owner authorized', () => {
  assert.equal(review.records.length, 254);
  assert.equal(new Set(review.records.map(row => row.countyFips)).size, 254);
  assert.ok(review.records.every(row => /^48\d{3}$/.test(row.countyFips) && /^[a-f0-9]{64}$/.test(row.packageSha256)));
  assert.ok(review.records.every(row => row.packageIdentityReady && row.structuralPromotionEligibility === 'STRUCTURALLY_PROMOTION_ELIGIBLE'));
  assert.ok(review.records.every(row => row.ownerAuthorizationStatus === 'OWNER_AUTHORIZATION_REQUIRED' && row.promotionStatus === 'NOT_PROMOTED'));
  assert.deepEqual(review.records.map(row => row.packageSha256), inventory.packages.map(row => row.sha256));
});

test('identity capture, structural eligibility, owner authorization, promotion, and activation are distinct states', () => {
  const row = review.records[0];
  assert.equal(row.packageIdentityReady, true);
  assert.equal(row.structuralPromotionEligibility, 'STRUCTURALLY_PROMOTION_ELIGIBLE');
  assert.equal(row.ownerAuthorizationStatus, 'OWNER_AUTHORIZATION_REQUIRED');
  assert.equal(row.promotionStatus, 'NOT_PROMOTED');
  assert.equal(row.activationEligible, false);
  assert.equal(row.activationStatus, 'NOT_ACTIVATED');
});

test('authorization is exact FIPS, SHA-256, schema, capability, and explicit-status bound', () => {
  const base = authorization.records[0];
  const authorized = { ...authorization, records: [{ ...base, authorizationStatus: 'OWNER_AUTHORIZED' }] };
  assert.equal(evaluate(authorized).records[0].ownerAuthorizationStatus, 'OWNER_AUTHORIZED');
  for (const mutation of [
    { packageSha256: '0'.repeat(64) }, { packageSha256: null }, { countyFips: '48999' },
    { schemaVersion: 'wrong' }, { promotionScope: 'ACTIVATION' }, { authorizationStatus: 'NOT_AUTHORIZED' }
  ]) assert.equal(evaluate({ ...authorization, records: [{ ...base, authorizationStatus: 'OWNER_AUTHORIZED', ...mutation }] }).records[0].ownerAuthorizationStatus, 'OWNER_AUTHORIZATION_REQUIRED');
});

test('missing or defective LP188.5 certification fails structural eligibility closed', () => {
  for (const broken of [{ ...certification, capturedPackageCount: 253 }, { ...certification, missingSha256: ['48001'] }, { ...certification, runtimeIsolationPass: false }]) {
    const result = evaluatePromotion({ inventory, certification: broken, runtimeRegistry, restrictions, authorization });
    assert.equal(result.summary.structuralPromotionEligibleCount, 0);
    assert.match(result.summary.overallClassification, /^BLOCKED_/);
  }
});

test('restricted counties remain restricted and activation-blocked even when promotion-authorized', () => {
  const restricted = restrictions[0];
  const exact = authorization.records.find(row => row.countyFips === restricted.fips);
  const result = evaluate({ ...authorization, records: [{ ...exact, authorizationStatus: 'OWNER_AUTHORIZED' }] });
  const row = result.records.find(item => item.countyFips === restricted.fips);
  assert.equal(row.ownerAuthorizationStatus, 'OWNER_AUTHORIZED');
  assert.equal(row.restrictionStatus, 'RESTRICTED_PRESERVED');
  assert.equal(row.restrictionReason, restricted.originalReason);
  assert.equal(row.activationEligible, false);
  assert.equal(row.activationStatus, 'ACTIVATION_BLOCKED');
  assert.ok(row.blockingReasons.includes('ACTIVATION_BLOCKED_RESTRICTION_PRESERVED'));
});

test('baselines remain 28 operational, 11 restricted, and zero new activation or promotion', () => {
  assert.equal(summary.currentOperationalCount, 28);
  assert.equal(summary.restrictedCountyCount, 11);
  assert.equal(summary.newActivationEligibleCount, 0);
  assert.equal(summary.newActivatedCount, 0);
  assert.equal(summary.promotedCount, 0);
  assert.equal(summary.runtimeOperationalCountChanged, false);
  assert.equal(summary.restrictedCountyStateChanged, false);
  assert.equal(summary.runtimeIsolationPass, true);
  assert.equal(review.records.filter(row => row.currentOperationalStatus === 'CURRENT_OPERATIONAL_BASELINE_PRESERVED').length, 28);
});

test('authorization request is deterministic, non-authorizing, and exact-identity bound', () => {
  assert.equal(stableJson(buildAuthorizationRequest(inventory)), stableJson(authorization));
  assert.equal(authorization.authority, 'OWNER_DECISION_REQUIRED_NON_AUTHORIZING_TEMPLATE');
  assert.equal(authorization.records.length, 254);
  assert.ok(authorization.records.every(row => row.authorizationStatus === 'NOT_AUTHORIZED'));
  assert.ok(authorization.records.every((row, index) => row.countyFips === inventory.packages[index].countyFips && row.packageSha256 === inventory.packages[index].sha256));
});

test('LP188.6 is metadata-only and contains no runtime, awareness, Supabase, deployment, or manufacturing capability', () => {
  const tool = fs.readFileSync(path.join(root, 'tools/lp1886/review-promotion-eligibility.mjs'), 'utf8');
  assert.doesNotMatch(tool, /GRIDLY_COUNTY_REGISTRY|defaultAwarenessAreas|createClient\(|supabase|\.upload\(|fetch\(|deploy|execSync|spawnSync|manufacture-community-packages/i);
  assert.doesNotMatch(tool, /writeFileSync\([^\n]*(lp1883|lp1885|counties)/i);
  for (const relative of fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js'))) {
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'js', relative), 'utf8'), /lp1886|county-promotion-eligibility-review|owner-promotion-authorization/i, relative);
  }
  assert.equal(review.purpose, 'METADATA_ONLY_NOT_RUNTIME_ACTIVATION');
});

test('authoritative LP188.3 package bytes and LP188.5 evidence are not modified by evaluation', () => {
  const protectedFiles = ['reports/lp1885/community-package-identity-inventory.json', 'reports/lp1885/community-package-promotion-only-registry.json', 'reports/lp1885/lp1885-identity-capture-certification.json'];
  const before = protectedFiles.map(file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'));
  evaluate(authorization);
  const after = protectedFiles.map(file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'));
  assert.deepEqual(after, before);
  assert.ok(review.records.filter(row => row.currentOperationalStatus === 'NOT_OPERATIONAL').every(row => row.blockingReasons.includes('ACTIVATION_REMAINS_A_LATER_MILESTONE')));
  assert.ok(review.records.every(row => row.blockingReasons.length > 0));
});
