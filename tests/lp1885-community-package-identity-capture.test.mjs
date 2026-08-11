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

function fixture(bytes, fips = '48001', name = 'Anderson County') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1885-non-authoritative-'));
  fs.mkdirSync(path.join(directory, 'counties'));
  fs.writeFileSync(path.join(directory, 'counties', `${fips}.json`), bytes);
  return directory;
}
const valid = Buffer.from('{\r\n  "schemaVersion":"gridly.community-package.identity.v1", "county":{"countyFips":"48001","displayName":"Anderson County"}, "censusPlaces":[], "legacyAwarenessAreas":[], "communities":[]\r\n}\r\n');

test('capture hashes exact file bytes without rewriting or normalizing the package', () => {
  const directory = fixture(valid);
  const before = fs.readFileSync(path.join(directory, 'counties/48001.json'));
  const result = capturePackageDirectory({ sourceDirectory: directory, governedCounties: [identity.identities[0]] });
  assert.equal(result.records[0].sha256, crypto.createHash('sha256').update(valid).digest('hex'));
  assert.equal(result.records[0].byteLength, valid.byteLength);
  assert.deepEqual(fs.readFileSync(path.join(directory, 'counties/48001.json')), before);
});

test('identity is governed by FIPS and metadata must match filename and county authority', () => {
  const bad = Buffer.from(valid.toString().replace('48001', '48003'));
  const result = capturePackageDirectory({ sourceDirectory: fixture(bad), governedCounties: [identity.identities[0]] });
  assert.equal(result.records.length, 0);
  assert.equal(result.countyIdentityMismatch.length, 1);
});

test('inventory is ordered and two captures produce byte-identical deterministic evidence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp1885-non-authoritative-'));
  fs.mkdirSync(path.join(dir, 'counties'));
  const second = Buffer.from(valid.toString().replaceAll('48001', '48003').replace('Anderson County', 'Andrews County'));
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

test('authoritative PASS requires exactly 254 identities and remains fail closed without Windows bytes', () => {
  assert.equal(certification.expectedCountyCount, 254);
  assert.equal(certification.capturedPackageCount, 0);
  assert.equal(certification.missingCountyPackages.length, 254);
  assert.equal(certification.deterministicCapturePass, false);
  assert.equal(certification.overallClassification, 'BLOCKED_AUTHORITATIVE_WINDOWS_PACKAGE_IDENTITY_CAPTURE_REQUIRED');
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
