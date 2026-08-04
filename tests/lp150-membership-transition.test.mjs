import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildTransition, emptyContract, protectedHashes, stableJson, validateCandidate, validateTransition } from '../tools/lp150/build-membership-transition.mjs';

const registry = JSON.parse(readFileSync('data/lp149/runtime-county-registry.json', 'utf8'));
const committedContract = JSON.parse(readFileSync('data/lp150/candidate-membership-contract.json', 'utf8'));
const transition = JSON.parse(readFileSync('data/lp150/membership-transition-registry.json', 'utf8'));

function assertThrowsLp150(fn, pattern) { assert.throws(fn, pattern); }
function shaFile(path) { return createHash('sha256').update(readFileSync(path)).digest('hex'); }
function snapshot(paths) { return Object.fromEntries(paths.map((path) => [path, shaFile(path)])); }
const lp150GeneratedPaths = ['data/lp150/candidate-membership-contract.json', 'data/lp150/membership-transition-registry.json', 'reports/lp150/membership-transition-validation.json'];
const protectedUpstreamPaths = ['evidence/lp138/county-geometry-membership-contract.baseline.json', 'tools/lp140/activation-wave-planner.mjs', 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json', 'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json', 'data/lp149/runtime-county-registry.json'];

test('transition model includes all 254 LP149 identities in ascending FIPS order', () => {
  assert.equal(transition.countyCount, 254);
  assert.deepEqual(transition.counties.map((c) => c.fips), registry.identities.map((c) => c.fips));
  assert.deepEqual(transition.counties.map((c) => c.fips), [...transition.counties.map((c) => c.fips)].sort());
});

test('current operational membership remains exactly 28 and empty contract produces no transition', () => {
  assert.equal(transition.currentOperationalCountyCount, 28);
  assert.equal(committedContract.candidateCountyCount, 0);
  assert.equal(transition.candidateCountyCount, 0);
  assert.equal(transition.approvedCountyCount, 0);
  assert.equal(transition.deployedTransitionCountyCount, 0);
  assert.equal(transition.activeTransitionCountyCount, 0);
});

test('candidate contract fails closed for unknown, duplicate, blocked, unordered, and inferred approval entries', () => {
  const validFips = registry.identities.find((c) => !c.operationalMembership.active && c.certificateAvailability.available).fips;
  const blockedFips = registry.identities.find((c) => !c.certificateAvailability.available).fips;
  const base = emptyContract();
  assertThrowsLp150(() => validateCandidate({ ...base, candidateCountyCount: 1, candidateCounties: [{ fips: '48999' }] }, registry), /unknown/);
  assertThrowsLp150(() => validateCandidate({ ...base, candidateCountyCount: 2, candidateCounties: [{ fips: validFips }, { fips: validFips }] }, registry), /duplicate/);
  assertThrowsLp150(() => validateCandidate({ ...base, candidateCountyCount: 1, candidateCounties: [{ fips: blockedFips }] }, registry), /certification-blocked/);
  assertThrowsLp150(() => validateCandidate({ ...base, candidateCountyCount: 2, candidateCounties: [{ fips: '48003' }, { fips: '48001' }] }, registry), /ascending/);
  assertThrowsLp150(() => validateCandidate({ ...base, candidateCountyCount: 1, candidateCounties: [{ fips: validFips, approvalEvidenceRef: 'inferred' }] }, registry), /cannot carry approval/);
});

test('candidate does not imply approval, approval does not imply deployment, and deployment does not imply activation', () => {
  const fips = registry.identities.find((c) => !c.operationalMembership.active && c.certificateAvailability.available).fips;
  const contract = { ...emptyContract(), candidateCountyCount: 1, candidateCounties: [{ fips }] };
  const model = buildTransition(contract);
  const row = model.counties.find((c) => c.fips === fips);
  assert.equal(row.candidateMembershipStatus, 'CANDIDATE');
  assert.equal(row.approvedMembershipStatus, 'NOT_APPROVED');
  assert.equal(row.deployedMembershipStatus, 'NOT_DEPLOYED');
  assert.equal(row.activeRuntimeStatus, 'NOT_ACTIVE');
});

test('protected artifacts are derived from current committed authoritative inputs', () => {
  assert.deepEqual(transition.protectedArtifactHashes, protectedHashes());
  assert.equal(transition.protectedArtifactHashes.lp149Registry, shaFile('data/lp149/runtime-county-registry.json'));
  assert.equal(transition.protectedArtifactHashes.lp148Package, shaFile('assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json'));
});

test('protected artifacts and runtime selection remain unchanged', () => {
  const report = validateTransition(transition, committedContract);
  assert.equal(report.passed, true);
  assert.equal(report.checks.lp138BaselineUnchanged, true);
  assert.equal(report.checks.lp140PlannerUnchanged, true);
  assert.equal(report.checks.lp148ArtifactsUnchanged, true);
  assert.equal(report.checks.lp149RegistryUnchanged, true);
  assert.equal(report.checks.productionRuntimeManifestUnchanged, true);
  assert.equal(report.checks.runtimeSelectionUnchanged, true);
});

test('tracked LP150 artifacts match deterministic rebuild', () => {
  assert.equal(readFileSync('data/lp150/membership-transition-registry.json', 'utf8'), stableJson(buildTransition(committedContract)));
});

test('LP150 verification is read-only and repeated verification is byte-identical', () => {
  const beforeGenerated = snapshot(lp150GeneratedPaths);
  const beforeProtected = snapshot(protectedUpstreamPaths);
  execFileSync('node', ['tools/lp150/build-membership-transition.mjs'], { stdio: 'pipe' });
  execFileSync('node', ['tools/lp150/build-membership-transition.mjs'], { stdio: 'pipe' });
  assert.deepEqual(snapshot(lp150GeneratedPaths), beforeGenerated);
  assert.deepEqual(snapshot(protectedUpstreamPaths), beforeProtected);
});
