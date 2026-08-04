#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMembershipContract } from '../lp138/validate-county-geometry-membership.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const TEXAS_COUNTIES = 'data/lp104/texas-counties.json';
const LP138_BASELINE = 'evidence/lp138/county-geometry-membership-contract.baseline.json';
const LP148_PACKAGE = 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json';
const LP148_MANIFEST = 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json';
const RUNTIME_MANIFEST = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json';
const DEFAULT_REGISTRY = 'data/lp149/runtime-county-registry.json';
const DEFAULT_REPORT = 'reports/lp149/runtime-county-registry-validation.json';
const EXPECTED_TEXAS_COUNTIES = 254;
const EXPECTED_OPERATIONAL_COUNTIES = 28;
const GENERATED_AT = '1970-01-01T00:00:00.000Z';
const LP148_PREFLIGHT_RECONCILIATION = Object.freeze({
  testCommand: 'npm run test:lp148',
  observedOnAuthoritativeMain: true,
  observedOnCurrentLp149Branch: true,
  failureMessage: '[LP148] tracked/generated package does not match deterministic rebuild',
  preExistingBaselineCondition: true,
  introducedByLp149: false,
  lp149ModifiedLp148Package: false,
  lp149ModifiedLp148Manifest: false,
  lp149ModifiedLp148Builder: false,
  lp149ModifiedLp148Tests: false,
  lp149ConsumesTrackedLp148MetadataRecognitionOnly: true,
  repairDeferredToSeparateMilestone: true
});
export const CLASSIFICATIONS = Object.freeze(['ACTIVE_OPERATIONAL', 'KNOWN_NOT_OPERATIONAL', 'CERTIFICATION_BLOCKED']);

function fail(message) { throw new Error(`[LP149] ${message}`); }
function abs(path) { return resolve(REPO_ROOT, path); }
function portable(path) { return relative(REPO_ROOT, path).replaceAll('\\', '/'); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function sha256Text(text) { return createHash('sha256').update(text).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}
function stableJson(value) { return `${JSON.stringify(stable(value))}\n`; }
function slug(name) { return String(name ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.runtime-certificate.json')) out.push(portable(full));
  }
  return out;
}
function buildCertificateIndex() {
  const byFips = new Map();
  for (const path of walk(abs('reports'))) {
    const match = path.match(/-((?:48)\d{3})\.runtime-certificate\.json$/);
    if (!match) continue;
    if (!byFips.has(match[1])) byFips.set(match[1], []);
    byFips.get(match[1]).push(path);
  }
  return byFips;
}

export function buildRegistry() {
  const texas = readJson(TEXAS_COUNTIES);
  const baseline = readJson(LP138_BASELINE);
  validateMembershipContract(baseline, { expectedContractKind: 'CURRENT_OPERATIONAL_BASELINE' });
  const lp148 = readJson(LP148_PACKAGE);
  const lp148Manifest = readJson(LP148_MANIFEST);
  const runtimeManifest = readJson(RUNTIME_MANIFEST);
  if (texas.count !== EXPECTED_TEXAS_COUNTIES || texas.counties.length !== EXPECTED_TEXAS_COUNTIES) fail('Texas county identity source must contain 254 counties');
  if (lp148.countyCount !== EXPECTED_TEXAS_COUNTIES || lp148Manifest.countyCount !== EXPECTED_TEXAS_COUNTIES) fail('LP148 statewide runtime package must contain 254 counties');
  if (runtimeManifest.packagedCountyCount !== EXPECTED_OPERATIONAL_COUNTIES) fail('current runtime deployment package count changed');
  const operationalByFips = new Map(baseline.approvedCounties.map((county) => [county.fips, county]));
  const geometryByFips = new Map(lp148.counties.map((county) => [county.fips, county]));
  const certsByFips = buildCertificateIndex();
  const identities = texas.counties.slice().sort((a, b) => a.fips.localeCompare(b.fips)).map((county) => {
    const geometry = geometryByFips.get(county.fips);
    if (!geometry) fail(`LP148 geometry missing for ${county.fips}`);
    const operational = operationalByFips.has(county.fips);
    const certRefs = (certsByFips.get(county.fips) ?? []).sort();
    const certificateAvailable = certRefs.length > 0;
    return {
      countyName: `${county.countyName} County`,
      countyId: operationalByFips.get(county.fips)?.countyId ?? `${slug(county.countyName)}-tx`,
      fips: county.fips,
      runtimeGeometry: { present: true, source: 'LP148', packagePath: LP148_PACKAGE, packageVersion: lp148.packageVersion },
      packageIdentity: { recognized: true, packagePath: LP148_PACKAGE, packageSha256: lp148Manifest.packageSha256, operationalUseAuthorized: false },
      certificateAvailability: { available: certificateAvailable, certificateRefs: certRefs },
      operationalMembership: { active: operational, authority: 'LP138', membershipRef: LP138_BASELINE },
      operationalReadinessClassification: operational ? 'ACTIVE_OPERATIONAL' : certificateAvailable ? 'KNOWN_NOT_OPERATIONAL' : 'CERTIFICATION_BLOCKED'
    };
  });
  return {
    schemaVersion: 'gridly.lp149.runtimeCountyIdentityRegistry.v1',
    milestone: 'LP149',
    generatedAt: GENERATED_AT,
    sort: 'ascending-fips',
    identityCount: identities.length,
    operationalCountyCount: identities.filter(c => c.operationalMembership.active).length,
    authorities: { identitySource: TEXAS_COUNTIES, membership: LP138_BASELINE, statewideRuntimeGeometry: LP148_MANIFEST, deployedRuntimeGeometry: RUNTIME_MANIFEST },
    runtimeBoundary: { identityDoesNotImplyMembership: true, statewideGeometryRecognizedOnly: true, activationPerformed: false, deploymentPerformed: false, runtimeSelectionChanged: false, plannerChanged: false },
    lp148PreflightReconciliation: LP148_PREFLIGHT_RECONCILIATION,
    identities
  };
}

export function validateRegistry(registry = buildRegistry()) {
  const fips = registry.identities.map(c => c.fips);
  const names = registry.identities.map(c => c.countyName.toLowerCase());
  const lp148 = readJson(LP148_PACKAGE);
  const lp148Fips = lp148.counties.map(c => c.fips).sort();
  const checks = {
    exactIdentityCount: registry.identityCount === EXPECTED_TEXAS_COUNTIES && registry.identities.length === EXPECTED_TEXAS_COUNTIES,
    uniqueRuntimeIdentities: new Set(fips).size === EXPECTED_TEXAS_COUNTIES && new Set(names).size === EXPECTED_TEXAS_COUNTIES,
    deterministicAscendingFipsOrdering: fips.every((value, index, all) => index === 0 || all[index - 1] < value),
    noDuplicateCounties: new Set(registry.identities.map(c => `${c.countyName}|${c.fips}`)).size === EXPECTED_TEXAS_COUNTIES,
    everyLp148GeometryCountyRepresented: JSON.stringify(fips) === JSON.stringify(lp148Fips),
    operationalMembershipRemains28: registry.operationalCountyCount === EXPECTED_OPERATIONAL_COUNTIES,
    noCountyActivationPerformed: registry.runtimeBoundary.activationPerformed === false && registry.identities.filter(c => c.operationalMembership.active).length === EXPECTED_OPERATIONAL_COUNTIES,
    runtimeSelectionUnchanged: registry.runtimeBoundary.runtimeSelectionChanged === false,
    plannerUnchanged: registry.runtimeBoundary.plannerChanged === false,
    deploymentUnchanged: registry.runtimeBoundary.deploymentPerformed === false,
    statewideGeometryRecognitionOnly: registry.identities.every(c => c.packageIdentity.recognized === true && c.packageIdentity.operationalUseAuthorized === false),
    lp148PreExistingBaselineFailureRecorded: registry.lp148PreflightReconciliation?.preExistingBaselineCondition === true && registry.lp148PreflightReconciliation?.introducedByLp149 === false,
    lp148ArtifactsUnmodifiedByLp149: registry.lp148PreflightReconciliation?.lp149ModifiedLp148Package === false && registry.lp148PreflightReconciliation?.lp149ModifiedLp148Manifest === false && registry.lp148PreflightReconciliation?.lp149ModifiedLp148Builder === false && registry.lp148PreflightReconciliation?.lp149ModifiedLp148Tests === false,
    lp148RepairDeferredOutsideLp149: registry.lp148PreflightReconciliation?.repairDeferredToSeparateMilestone === true
  };
  const failures = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const report = { schemaVersion: 'gridly.lp149.runtimeCountyIdentityRegistry.validation.v1', generatedAt: GENERATED_AT, registrySha256: sha256Text(stableJson(registry)), checks, failures, passed: failures.length === 0 };
  if (!report.passed) fail(`validation failed: ${failures.join(', ')}`);
  return report;
}

export function writeArtifacts({ registryPath = DEFAULT_REGISTRY, reportPath = DEFAULT_REPORT } = {}) {
  const registry = buildRegistry();
  const report = validateRegistry(registry);
  for (const path of [registryPath, reportPath]) mkdirSync(dirname(abs(path)), { recursive: true });
  writeFileSync(abs(registryPath), stableJson(registry));
  writeFileSync(abs(reportPath), stableJson(report));
  return { registryPath, reportPath, ...report };
}

if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv.includes('--write') ? 'write' : 'verify';
    const result = command === 'write' ? writeArtifacts() : validateRegistry();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exit(1); }
}
