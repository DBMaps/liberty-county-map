import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildArtifacts, capturePackageDirectory, stableJson } from '../tools/lp1885/capture-community-package-identities.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const identity = JSON.parse(fs.readFileSync(path.join(root, 'data/lp149/runtime-county-registry.json'), 'utf8'));
const restriction = JSON.parse(fs.readFileSync(path.join(root, 'reports/lp186/county-restriction-reconciliation.json'), 'utf8'));
const registry = JSON.parse(fs.readFileSync(path.join(root, 'reports/lp1885/community-package-promotion-only-registry.json'), 'utf8'));
const certification = JSON.parse(fs.readFileSync(path.join(root, 'reports/lp1885/lp1885-identity-capture-certification.json'), 'utf8'));

function fixture(bytes, filenameFips = '48001') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1885-non-authoritative-'));
  fs.mkdirSync(path.join(directory, 'counties'));
  fs.writeFileSync(path.join(directory, 'counties', `${filenameFips}.json`), bytes);
  return directory;
}
const packageBytes = (fips, displayName) => Buffer.from(`{\r\n  "schemaVersion":"gridly.community-package.identity.v1", "county":{"countyFips":"${fips}","displayName":"${displayName}"}, "censusPlaces":[], "legacyAwarenessAreas":[], "communities":[]\r\n}\r\n`);
const valid = packageBytes('48001', 'Anderson');

test('capture hashes exact file bytes without rewriting or normalizing the package', () => {
  const directory = fixture(valid);
  const before = fs.readFileSync(path.join(directory, 'counties/48001.json'));
  const result = capturePackageDirectory({ sourceDirectory: directory, governedCounties: [identity.identities[0]] });
  assert.equal(result.records[0].sha256, crypto.createHash('sha256').update(valid).digest('hex'));
  assert.equal(result.records[0].byteLength, valid.byteLength);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'counties/48001.json')), before);
});

test('Liberty Census base display matches its FIPS-bound governed countyName', () => {
  const liberty = identity.identities.find(row => row.fips === '48291');
  const result = capturePackageDirectory({ sourceDirectory: fixture(packageBytes('48291', 'Liberty'), '48291'), governedCounties: [liberty] });
  assert.equal(result.records.length, 1);
  assert.equal(result.countyIdentityMismatch.length, 0);
});

test('correct FIPS with a genuinely wrong display name fails', () => {
  const result = capturePackageDirectory({ sourceDirectory: fixture(packageBytes('48291', 'Liberty Parish'), '48291'), governedCounties: [identity.identities.find(row => row.fips === '48291')] });
  assert.equal(result.records.length, 0);
  assert.match(result.packageValidationFailures[0].reason, /display-name mismatch: expected Liberty/);
});

test('correct-looking display name cannot substitute for a governed FIPS', () => {
  const result = capturePackageDirectory({ sourceDirectory: fixture(packageBytes('48999', 'Liberty'), '48999'), governedCounties: [identity.identities.find(row => row.fips === '48291')] });
  assert.equal(result.records.length, 0);
  assert.equal(result.countyIdentityMismatch.length, 1);
  assert.match(result.packageValidationFailures[0].reason, /absent from governed registry/);
});

test('filename FIPS must equal package county FIPS', () => {
  const result = capturePackageDirectory({ sourceDirectory: fixture(packageBytes('48291', 'Liberty'), '48001'), governedCounties: identity.identities });
  assert.equal(result.records.length, 0);
  assert.match(result.packageValidationFailures[0].reason, /expected 48001/);
});

test('exact terminal County projection preserves DeWitt and La Salle spelling and spacing', () => {
  for (const [fips, name] of [['48123', 'DeWitt'], ['48283', 'La Salle']]) {
    const governed = identity.identities.find(row => row.fips === fips);
    const result = capturePackageDirectory({ sourceDirectory: fixture(packageBytes(fips, name), fips), governedCounties: [governed] });
    assert.equal(result.records.length, 1, name);
  }
});

test('display-name validation is exact and performs no fuzzy or case-insensitive matching', () => {
  const liberty = identity.identities.find(row => row.fips === '48291');
  for (const name of ['liberty', 'Liberty County', 'Liberty C', 'LibertyCounty', 'Liberty Extra']) {
    const result = capturePackageDirectory({ sourceDirectory: fixture(packageBytes('48291', name), '48291'), governedCounties: [liberty] });
    assert.equal(result.records.length, 0, name);
  }
});

test('inventory is ordered and two captures produce byte-identical deterministic evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1885-non-authoritative-'));
  fs.mkdirSync(path.join(dir, 'counties'));
  const second = packageBytes('48003', 'Andrews');
  fs.writeFileSync(path.join(dir, 'counties/48003.json'), second);
  fs.writeFileSync(path.join(dir, 'counties/48001.json'), valid);
  const counties = identity.identities.slice(0, 2);
  const one = buildArtifacts({ sourceDirectory: dir, governedCounties: counties, operationalCount: 28, restrictedCount: 11 });
  const two = buildArtifacts({ sourceDirectory: dir, governedCounties: counties, operationalCount: 28, restrictedCount: 11 });
  assert.deepEqual(one.inventory.packages.map(row => row.countyFips), ['48001', '48003']);
  assert.equal(stableJson(one.inventory), stableJson(two.inventory));
  assert.equal(stableJson(one.certification), stableJson(two.certification));
  assert.doesNotMatch(stableJson(one), /[A-Z]:\\|generatedAt|timestamp/i);
  assert.equal(Buffer.from(stableJson(one)).subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false);
  assert.doesNotMatch(stableJson(one), /\r/);
});

test('committed authoritative Windows capture contains exactly 254 identities and passes', () => {
  assert.equal(certification.expectedCountyCount, 254);
  assert.equal(certification.capturedPackageCount, 254);
  assert.equal(certification.missingCountyPackages.length, 0);
  assert.equal(certification.deterministicCapturePass, true);
  assert.equal(certification.overallClassification, 'PASS_PORTABLE_PACKAGE_IDENTITY_CAPTURED_PROMOTION_REGISTRY_ISOLATED_ACTIVATION_UNCHANGED');
});

test('promotion registry is metadata only, FIPS-keyed, blocked, and never implies promotion or activation', () => {
  assert.equal(registry.purpose, 'METADATA_ONLY_NOT_RUNTIME_ACTIVATION');
  assert.equal(registry.records.length, 254);
  assert.equal(new Set(registry.records.map(row => row.countyFips)).size, 254);
  assert.ok(registry.records.every(row => /^48\d{3}$/.test(row.countyFips)));
  assert.ok(registry.records.every(row => row.promotionStatus === 'NOT_PROMOTED' && row.promotionEligibilityStatus.startsWith('NOT_ELIGIBLE')));
  assert.ok(registry.records.every(row => row.blockingReasons.length > 0));
  assert.ok(registry.records.filter(row => row.activationStatus === 'NOT_ACTIVATED').every(row => row.blockingReasons.includes('ACTIVATION_GOVERNANCE_REMAINS_SEPARATE')));
});

test('runtime is structurally isolated and operational/restriction baselines remain untouched', () => {
  const runtimeFiles = fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).map(name => `js/${name}`);
  for (const relative of runtimeFiles) assert.doesNotMatch(fs.readFileSync(path.join(root, relative), 'utf8'), /lp1885|promotion-only-registry/i, relative);
  const countyRegistrySource = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  assert.doesNotMatch(countyRegistrySource, /lp1885|promotion-only-registry/i);
  assert.equal(identity.operationalCountyCount, 28);
  assert.equal(restriction.length, 11);
  assert.equal(certification.currentOperationalCount, 28);
  assert.equal(certification.restrictedCountyCount, 11);
  assert.equal(certification.runtimeOperationalCountChanged, false);
  assert.equal(certification.restrictedCountyStateChanged, false);
  assert.equal(certification.runtimeIsolationPass, true);
});

test('capture tooling has no manufacturing, geometry, deployment, upload, or package-regeneration capability', () => {
  const source = fs.readFileSync(path.join(root, 'tools/lp1885/capture-community-package-identities.mjs'), 'utf8');
  assert.doesNotMatch(source, /ogr2ogr|createClient\(|\.upload\(|fetch\(|execSync|spawnSync|manufacture-community-packages/i);
  assert.doesNotMatch(source, /writeFileSync\(path\.join\(countyDirectory/);
  assert.match(source, /fs\.readFileSync\(path\.join\(countyDirectory, filename\)\)/);
});
