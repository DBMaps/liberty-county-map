#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const stableJson = value => `${JSON.stringify(value, null, 2)}\n`;
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function assertPackageMetadata(value, expectedFips, expectedName) {
  if (!value || value.schemaVersion !== 'gridly.community-package.identity.v1') throw new Error('unsupported schemaVersion');
  if (!value.county || !/^48\d{3}$/.test(value.county.countyFips)) throw new Error('invalid county FIPS');
  if (value.county.countyFips !== expectedFips) throw new Error(`county identity mismatch: expected ${expectedFips}`);
  if (value.county.displayName !== expectedName) throw new Error(`county identity mismatch: expected ${expectedName}`);
  if (!Array.isArray(value.censusPlaces) || !Array.isArray(value.legacyAwarenessAreas) || !Array.isArray(value.communities)) throw new Error('invalid package collections');
}

export function capturePackageDirectory({ sourceDirectory, governedCounties }) {
  const records = [], packageValidationFailures = [], invalidCountyFips = [], countyIdentityMismatch = [];
  const expected = new Map(governedCounties.map(row => [row.fips, row]));
  const countyDirectory = path.join(sourceDirectory, 'counties');
  const names = fs.existsSync(countyDirectory) ? fs.readdirSync(countyDirectory).filter(name => name.endsWith('.json')).sort() : [];
  const seen = new Map();
  for (const filename of names) {
    const filenameFips = filename.slice(0, -5);
    if (!/^48\d{3}$/.test(filenameFips)) { invalidCountyFips.push(filename); continue; }
    seen.set(filenameFips, (seen.get(filenameFips) || 0) + 1);
    const relativePackagePath = `counties/${filename}`;
    const bytes = fs.readFileSync(path.join(countyDirectory, filename));
    try {
      const metadata = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
      assertPackageMetadata(metadata, filenameFips, expected.get(filenameFips)?.countyName);
      records.push({
        countyFips: filenameFips,
        countyName: metadata.county.displayName,
        schemaVersion: metadata.schemaVersion,
        relativePackagePath,
        byteLength: bytes.byteLength,
        sha256: digest(bytes)
      });
    } catch (error) {
      const detail = { relativePackagePath, reason: String(error.message) };
      packageValidationFailures.push(detail);
      if (/identity mismatch/.test(error.message)) countyIdentityMismatch.push(detail);
    }
  }
  records.sort((a, b) => a.countyFips.localeCompare(b.countyFips));
  const missingCountyPackages = [...expected.keys()].filter(fips => !records.some(row => row.countyFips === fips)).sort();
  const duplicateCountyPackages = [...seen].filter(([, count]) => count > 1).map(([fips]) => fips).sort();
  const hashes = new Map();
  for (const row of records) (hashes.get(row.sha256) || (hashes.set(row.sha256, []), hashes.get(row.sha256))).push(row.countyFips);
  const duplicatePackageHashes = [...hashes].filter(([, fips]) => fips.length > 1).map(([sha256, countyFips]) => ({ sha256, countyFips }));
  return { records, missingCountyPackages, duplicateCountyPackages, invalidCountyFips, countyIdentityMismatch, duplicatePackageHashes, packageValidationFailures };
}

export function buildArtifacts({ sourceDirectory, governedCounties, operationalCount, restrictedCount, runtimeIsolationPass = true }) {
  const result = capturePackageDirectory({ sourceDirectory, governedCounties });
  const authoritativePass = result.records.length === 254 && result.missingCountyPackages.length === 0 && result.duplicateCountyPackages.length === 0 && result.invalidCountyFips.length === 0 && result.countyIdentityMismatch.length === 0 && result.packageValidationFailures.length === 0;
  const inventory = { schemaVersion: 'gridly.community-package.portable-identity-inventory.lp1885.v1', source: 'LP188.3 authoritative statewide package manufacturing', expectedCountyCount: 254, packages: result.records };
  const promotionRegistry = {
    schemaVersion: 'gridly.community-package.promotion-only-registry.lp1885.v1',
    purpose: 'METADATA_ONLY_NOT_RUNTIME_ACTIVATION',
    records: governedCounties.map(county => {
      const identity = result.records.find(row => row.countyFips === county.fips);
      const blockingReasons = [];
      if (!identity) blockingReasons.push('AUTHORITATIVE_PACKAGE_IDENTITY_NOT_CAPTURED');
      blockingReasons.push('PROMOTION_OWNER_AUTHORIZATION_NOT_RECORDED');
      if (!county.operationalMembership.active) blockingReasons.push('ACTIVATION_GOVERNANCE_REMAINS_SEPARATE');
      return { countyFips: county.fips, packageIdentity: identity?.relativePackagePath ?? null, sha256: identity?.sha256 ?? null, schemaVersion: identity?.schemaVersion ?? null, certificationStatus: identity ? 'LP1883_CERTIFIED_IDENTITY_CAPTURED' : 'LP1883_CERTIFIED_IDENTITY_PENDING_CAPTURE', promotionEligibilityStatus: 'NOT_ELIGIBLE_OWNER_AUTHORIZATION_REQUIRED', promotionStatus: 'NOT_PROMOTED', activationStatus: county.operationalMembership.active ? 'CURRENT_OPERATIONAL_BASELINE_PRESERVED' : 'NOT_ACTIVATED', blockingReasons };
    })
  };
  const certification = {
    schemaVersion: 'gridly.community-package.identity-capture-certification.lp1885.v1', source: 'LP188.3 authoritative statewide package manufacturing', expectedCountyCount: 254,
    capturedPackageCount: result.records.length, missingCountyPackages: result.missingCountyPackages, duplicateCountyPackages: result.duplicateCountyPackages,
    invalidCountyFips: result.invalidCountyFips, countyIdentityMismatch: result.countyIdentityMismatch, missingSha256: [...new Set([...result.missingCountyPackages, ...result.records.filter(row => !row.sha256).map(row => row.countyFips)])].sort(), duplicatePackageHashes: result.duplicatePackageHashes,
    packageValidationFailures: result.packageValidationFailures, deterministicCapturePass: authoritativePass, runtimeIsolationPass,
    promotionEligibleCount: 0, promotedCount: 0, currentOperationalCount: operationalCount, restrictedCountyCount: restrictedCount,
    runtimeOperationalCountChanged: false, restrictedCountyStateChanged: false,
    overallClassification: authoritativePass && runtimeIsolationPass ? 'PASS_PORTABLE_PACKAGE_IDENTITY_CAPTURED_PROMOTION_REGISTRY_ISOLATED_ACTIVATION_UNCHANGED' : 'BLOCKED_AUTHORITATIVE_WINDOWS_PACKAGE_IDENTITY_CAPTURE_REQUIRED'
  };
  return { inventory, promotionRegistry, certification };
}

function writeArtifacts(outputRoot, artifacts) {
  const directory = path.join(outputRoot, 'reports/lp1885');
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, value] of [['community-package-identity-inventory.json', artifacts.inventory], ['community-package-promotion-only-registry.json', artifacts.promotionRegistry], ['lp1885-identity-capture-certification.json', artifacts.certification]]) fs.writeFileSync(path.join(directory, name), stableJson(value), { encoding: 'utf8' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceDirectory = process.argv[2];
  const outputRoot = process.argv[3] ? path.resolve(process.argv[3]) : repositoryRoot;
  if (!sourceDirectory || !fs.existsSync(path.join(sourceDirectory, 'counties'))) throw new Error('usage: node tools/lp1885/capture-community-package-identities.mjs <LP188.3-package-directory> [repository-output-root]');
  const registry = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'data/lp149/runtime-county-registry.json'), 'utf8'));
  const restrictions = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'reports/lp186/county-restriction-reconciliation.json'), 'utf8'));
  const artifacts = buildArtifacts({ sourceDirectory: path.resolve(sourceDirectory), governedCounties: registry.identities, operationalCount: registry.operationalCountyCount, restrictedCount: restrictions.length });
  writeArtifacts(outputRoot, artifacts);
  process.stdout.write(stableJson(artifacts.certification));
  if (!artifacts.certification.overallClassification.startsWith('PASS_')) process.exitCode = 1;
}
