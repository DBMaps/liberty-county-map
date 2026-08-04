#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateMembershipContract } from '../lp138/validate-county-geometry-membership.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const DEFAULT_SOURCE = 'assets/boundaries/texas-counties-boundaries.geojson';
const DEFAULT_MEMBERSHIP = 'evidence/lp148/statewide-geometry-membership.json';
const DEFAULT_PACKAGE = 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json';
const DEFAULT_MANIFEST = 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json';
const ROLLBACK_PACKAGE = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.json';
const ROLLBACK_MANIFEST = 'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json';
const BASELINE_CONTRACT = 'evidence/lp138/county-geometry-membership-contract.baseline.json';
const EXPECTED_TEXAS_COUNTIES = 254;
const GENERATED_AT = '1970-01-01T00:00:00.000Z';

function fail(message) { throw new Error(`[LP148] ${message}`); }
function abs(path) { return resolve(REPO_ROOT, path); }
function portable(path) { return relative(REPO_ROOT, path).replaceAll('\\', '/'); }
function readJson(path) { return JSON.parse(readFileSync(abs(path), 'utf8')); }
function sha256(buffer) { return createHash('sha256').update(buffer).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stable(value[key]); return out; }, {});
  return value;
}
function stableJson(value) { return `${JSON.stringify(stable(value))}\n`; }
function normFips(value) { return String(value ?? '').padStart(5, '0'); }
function sourceFips(feature) { return normFips(feature?.properties?.GEOID ?? feature?.properties?.geoid); }
function sourceName(feature) { return feature?.properties?.NAMELSAD ?? (feature?.properties?.NAME ? `${feature.properties.NAME} County` : feature?.properties?.name); }
function validateGeometry(geometry, fips) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) fail(`${fips} geometry must be Polygon or MultiPolygon`);
  if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) fail(`${fips} geometry coordinates are empty`);
  return geometry;
}
function loadMembership(membershipPath, expectedCount = EXPECTED_TEXAS_COUNTIES) {
  const contract = readJson(membershipPath);
  validateMembershipContract(contract, { expectedContractKind: 'FUTURE_APPROVAL_DRAFT' });
  if (contract.permissions?.deploy?.authorized || contract.permissions?.activateRuntime?.authorized || contract.permissions?.storageUpload?.authorized) fail('statewide package preparation must not authorize deploy, activation, or storage upload');
  if (contract.approvedCountyCount !== expectedCount || contract.approvedCounties.length !== expectedCount) fail(`statewide membership must contain exactly ${expectedCount} counties`);
  return contract;
}
function loadSource(sourcePath, expectedCount = EXPECTED_TEXAS_COUNTIES) {
  const body = readFileSync(abs(sourcePath));
  const geojson = JSON.parse(body.toString('utf8'));
  if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) fail('statewide source must be a GeoJSON FeatureCollection');
  const byFips = new Map();
  for (const feature of geojson.features) {
    const fips = sourceFips(feature);
    if (!/^48\d{3}$/.test(fips)) fail(`source contains invalid Texas FIPS: ${fips}`);
    if (byFips.has(fips)) fail(`source contains duplicate county FIPS: ${fips}`);
    byFips.set(fips, feature);
  }
  if (byFips.size !== expectedCount) fail(`statewide source must contain exactly ${expectedCount} counties; found ${byFips.size}`);
  return { body, byFips };
}
function collectPackage({ sourcePath = DEFAULT_SOURCE, membershipPath = DEFAULT_MEMBERSHIP, expectedCount = EXPECTED_TEXAS_COUNTIES } = {}) {
  const membership = loadMembership(membershipPath, expectedCount);
  const source = loadSource(sourcePath, expectedCount);
  let previous = '';
  const counties = membership.approvedCounties.map((member) => {
    if (member.fips <= previous) fail('membership must be sorted by ascending FIPS');
    previous = member.fips;
    const feature = source.byFips.get(member.fips);
    if (!feature) fail(`membership county missing from source: ${member.fips}`);
    const geometry = validateGeometry(feature.geometry, member.fips);
    return { countyId: member.countyId, displayName: member.displayName, fips: member.fips, sourceName: sourceName(feature), geometry };
  });
  const unexpected = [...source.byFips.keys()].filter(fips => !membership.approvedCounties.some(member => member.fips === fips));
  if (unexpected.length) fail(`source contains unexpected counties outside membership: ${unexpected.join(', ')}`);
  const sourceSha256 = sha256(source.body);
  const rollbackPackage = readFileSync(abs(ROLLBACK_PACKAGE));
  const rollbackManifest = readFileSync(abs(ROLLBACK_MANIFEST));
  const pkg = { schemaVersion: 'gridly.lp148.statewideCountyGeometry.runtime.v1', packageVersion: 'lp148-owner-built-statewide-runtime-geometry-v1', generatedAt: GENERATED_AT, countyCount: counties.length, sort: 'ascending-fips', source: { path: sourcePath, authority: 'LP137 authoritative statewide geometry source', sha256: sourceSha256, byteLength: source.body.length, geometryPreservation: 'source geometry copied without simplification or regeneration' }, membership: { path: membershipPath, sha256: membership.provenance.membershipSha256, approvalStatus: membership.approval.status, deployAuthorized: false, activateRuntimeAuthorized: false }, rollback: { packagePath: ROLLBACK_PACKAGE, packageSha256: sha256(rollbackPackage), packageByteLength: rollbackPackage.length, manifestPath: ROLLBACK_MANIFEST, manifestSha256: sha256(rollbackManifest), runtimeCountyCount: readJson(ROLLBACK_MANIFEST).packagedCountyCount }, counties };
  return { pkg, sourceSha256 };
}
function makeManifest(pkg, packageText, packagePath, manifestPath, expectedCount = EXPECTED_TEXAS_COUNTIES) {
  return { schemaVersion: 'gridly.lp148.statewideCountyGeometry.manifest.v1', packageVersion: pkg.packageVersion, generatedAt: GENERATED_AT, packagePath, packageSha256: sha256(Buffer.from(packageText)), packageByteLength: Buffer.byteLength(packageText), manifestPath, countyCount: pkg.countyCount, expectedCountyCount: expectedCount, sort: pkg.sort, source: pkg.source, membership: pkg.membership, rollback: pkg.rollback, validation: { exactTexasCountyCount: pkg.countyCount === expectedCount, deterministicFipsOrdering: pkg.counties.every((county, i, a) => i === 0 || a[i - 1].fips < county.fips), deploymentPerformed: false, activationPerformed: false } };
}
export function build({ write = false, sourcePath = DEFAULT_SOURCE, membershipPath = DEFAULT_MEMBERSHIP, packagePath = DEFAULT_PACKAGE, manifestPath = DEFAULT_MANIFEST, expectedCount = EXPECTED_TEXAS_COUNTIES } = {}) {
  const { pkg } = collectPackage({ sourcePath, membershipPath, expectedCount });
  const packageText = stableJson(pkg);
  const manifest = makeManifest(pkg, packageText, packagePath, manifestPath, expectedCount);
  const manifestText = stableJson(manifest);
  if (write) {
    mkdirSync(dirname(abs(packagePath)), { recursive: true });
    writeFileSync(abs(packagePath), packageText);
    writeFileSync(abs(manifestPath), manifestText);
  }
  return { manifest, packageText, manifestText };
}
export function verify(options = {}) {
  const first = build({ ...options, write: false });
  const second = build({ ...options, write: false });
  if (first.packageText !== second.packageText || first.manifestText !== second.manifestText) fail('deterministic verification rerun changed package or manifest bytes');
  if (existsSync(abs(options.packagePath ?? DEFAULT_PACKAGE))) {
    const actual = readFileSync(abs(options.packagePath ?? DEFAULT_PACKAGE), 'utf8');
    if (actual !== first.packageText) fail('tracked/generated package does not match deterministic rebuild');
  }
  if (existsSync(abs(options.manifestPath ?? DEFAULT_MANIFEST))) {
    const actual = readFileSync(abs(options.manifestPath ?? DEFAULT_MANIFEST), 'utf8');
    if (actual !== first.manifestText) fail('tracked/generated manifest does not match deterministic rebuild');
  }
  return { passed: true, countyCount: first.manifest.countyCount, packageByteLength: first.manifest.packageByteLength, packageSha256: first.manifest.packageSha256, rollbackRuntimeCountyCount: first.manifest.rollback.runtimeCountyCount };
}
export function auditRuntimeMembership() {
  const baseline = readJson(BASELINE_CONTRACT);
  validateMembershipContract(baseline, { expectedContractKind: 'CURRENT_OPERATIONAL_BASELINE' });
  const manifest = readJson(ROLLBACK_MANIFEST);
  if (manifest.packagedCountyCount !== baseline.approvedCountyCount) fail('current runtime package membership no longer equals LP138 baseline');
  return { passed: true, runtimeMembershipUnchanged: true, baselineCountyCount: baseline.approvedCountyCount, runtimePackagedCountyCount: manifest.packagedCountyCount, baselineMembershipSha256: baseline.provenance.membershipSha256 };
}
function parseArgs(argv) {
  const out = {}; for (let i = 0; i < argv.length; i += 1) { const a = argv[i]; if (a === '--source') out.sourcePath = argv[++i]; else if (a === '--membership') out.membershipPath = argv[++i]; else if (a === '--package') out.packagePath = argv[++i]; else if (a === '--manifest') out.manifestPath = argv[++i]; else if (a === '--expected-count') out.expectedCount = Number(argv[++i]); }
  return out;
}
if (resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const command = process.argv.find(arg => ['--plan', '--build', '--verify', '--audit-runtime'].includes(arg)) ?? '--plan';
    const result = command === '--audit-runtime' ? auditRuntimeMembership() : command === '--verify' ? verify(args) : command === '--build' ? build({ ...args, write: true }).manifest : build({ ...args, write: false }).manifest;
    console.log(JSON.stringify(result, null, 2));
  } catch (error) { console.error(error.message); process.exit(1); }
}
