import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = relative => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'));
const matrix = read('reports/lp1884/texas-community-package-promotion-readiness.json');
const summary = read('reports/lp1884/lp1884-readiness-summary.json');

test('LP188.3 manufacturing evidence discovers exactly 254 FIPS identities without promoting them', () => {
  assert.equal(matrix.length, 254);
  assert.equal(new Set(matrix.map(row => row.countyFips)).size, 254);
  assert.ok(matrix.every(row => /^48\d{3}$/.test(row.countyFips)));
  assert.ok(matrix.every(row => row.communityPackageManufactured.startsWith('MANUFACTURED_')));
  assert.ok(matrix.every(row => row.communityPackageCertified === 'CERTIFIED'));
  assert.ok(matrix.every(row => row.communityPackagePromoted === 'NOT_PROMOTED'));
});

test('package existence, certification, and future promotion remain distinct from activation', () => {
  assert.equal(summary.communityPackagesManufactured, 254);
  assert.equal(summary.communityPackagesCertified, 254);
  assert.equal(summary.promotionEligibleCount, 0);
  assert.equal(summary.promotedCount, 0);
  assert.equal(summary.activationEligibleCount, 0);
  assert.ok(matrix.every(row => row.activationStatus !== 'ACTIVATED'));
});

test('current operational and restricted county baselines are unchanged', () => {
  assert.equal(matrix.filter(row => row.activationStatus === 'CURRENT_OPERATIONAL_BASELINE_PRESERVED').length, 28);
  assert.equal(matrix.filter(row => row.restrictionStatus === 'ACTIVE_PRESERVED').length, 11);
  assert.equal(summary.runtimeOperationalCountChanged, false);
  assert.equal(summary.restrictedCountyStateChanged, false);
  assert.ok(matrix.filter(row => row.restrictionStatus === 'ACTIVE_PRESERVED').every(row => row.activationEligible === 'BLOCKED'));
});

test('promotion fails closed without portable bytes and deterministic per-county hashes', () => {
  assert.ok(matrix.every(row => row.communityPackageSha256 === null));
  assert.ok(matrix.every(row => row.communityPackagePromotionEligible === 'BLOCKED_PENDING_PORTABLE_PACKAGE_HASH_EVIDENCE'));
  assert.ok(matrix.every(row => row.blockingReasons.includes('COMMUNITY_PACKAGE_BYTES_AND_PER_COUNTY_SHA256_NOT_PRESENT_IN_PORTABLE_GOVERNANCE')));
  assert.match(summary.promotionArchitecture.blocker, /ARCHITECTURE_REQUIRES_SEPARATION/);
});

test('every non-operational county is blocked with explicit dependency evidence', () => {
  const blocked = matrix.filter(row => row.activationStatus === 'NOT_ACTIVATED');
  assert.equal(blocked.length, 226);
  assert.ok(blocked.every(row => row.blockingReasons.length > 0));
  assert.deepEqual(summary.countiesMissingDependencies, blocked.map(row => row.countyFips));
});

test('LP188.4 tooling cannot manufacture or deploy data and does not name runtime manifests as outputs', () => {
  const source = fs.readFileSync(new URL('../tools/lp1884/build-community-promotion-readiness.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /manufacture-community-packages|ogr2ogr|ST_Intersection|supabase|upload/i);
  assert.doesNotMatch(source, /writeFileSync\([^\n]*(app\.js|county-manifest|runtime-package-registry|Crossing-Packages|Roadway-Packages)/i);
  assert.deepEqual([...source.matchAll(/reports\/lp1884\/[a-z0-9.-]+\.json/g)].map(match => match[0]).sort(), [
    'reports/lp1884/lp1884-readiness-summary.json',
    'reports/lp1884/texas-community-package-promotion-readiness.json'
  ]);
});
