import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildRegistry, validateRegistry, CLASSIFICATIONS } from '../tools/lp149/build-runtime-identity-registry.mjs';

const LP148_ARTIFACTS = [
  'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json',
  'assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.manifest.json',
  'tools/lp148/build-statewide-runtime-geometry.mjs',
  'tests/lp148-statewide-geometry-builder.test.mjs'
];
function sha256(path) {
  return createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex');
}

const trackedRegistry = JSON.parse(readFileSync(new URL('../data/lp149/runtime-county-registry.json', import.meta.url), 'utf8'));

test('LP149 registry models all Texas runtime identities without expanding operational membership', () => {
  const registry = buildRegistry();
  assert.deepEqual(registry, trackedRegistry);
  assert.equal(registry.identityCount, 254);
  assert.equal(registry.operationalCountyCount, 28);
  assert.equal(registry.runtimeBoundary.identityDoesNotImplyMembership, true);
  assert.equal(registry.runtimeBoundary.statewideGeometryRecognizedOnly, true);
  assert.equal(registry.runtimeBoundary.activationPerformed, false);
  assert.equal(registry.runtimeBoundary.deploymentPerformed, false);
  assert.equal(registry.runtimeBoundary.runtimeSelectionChanged, false);
  assert.equal(registry.runtimeBoundary.plannerChanged, false);
});

test('LP149 registry is deterministic, FIPS ordered, and LP148 recognition only', () => {
  const registry = buildRegistry();
  const report = validateRegistry(registry);
  assert.equal(report.passed, true);
  assert.deepEqual(report.failures, []);
  assert.equal(report.checks.exactIdentityCount, true);
  assert.equal(report.checks.deterministicAscendingFipsOrdering, true);
  assert.equal(report.checks.everyLp148GeometryCountyRepresented, true);
  assert.equal(report.checks.statewideGeometryRecognitionOnly, true);
  const fips = registry.identities.map((county) => county.fips);
  assert.deepEqual(fips, [...fips].sort());
  assert.equal(new Set(fips).size, 254);
  assert.ok(registry.identities.every((county) => county.runtimeGeometry.present === true));
  assert.ok(registry.identities.every((county) => county.packageIdentity.operationalUseAuthorized === false));
});

test('LP149 classifications separate identity from LP138 membership', () => {
  const registry = buildRegistry();
  const classes = new Set(registry.identities.map((county) => county.operationalReadinessClassification));
  for (const value of classes) assert.ok(CLASSIFICATIONS.includes(value));
  assert.equal(registry.identities.filter((county) => county.operationalReadinessClassification === 'ACTIVE_OPERATIONAL').length, 28);
  assert.ok(registry.identities.some((county) => county.operationalReadinessClassification === 'KNOWN_NOT_OPERATIONAL'));
  assert.ok(CLASSIFICATIONS.includes('CERTIFICATION_BLOCKED'));
  assert.ok(registry.identities.some((county) => county.operationalMembership.active === false && county.runtimeGeometry.present === true));
});

test('LP149 build and validation do not write or repair LP148 artifacts', () => {
  const before = new Map(LP148_ARTIFACTS.map((path) => [path, sha256(path)]));
  const registry = buildRegistry();
  validateRegistry(registry);
  const after = new Map(LP148_ARTIFACTS.map((path) => [path, sha256(path)]));
  assert.deepEqual(after, before);
  assert.equal(registry.lp148PreflightReconciliation.preExistingBaselineCondition, true);
  assert.equal(registry.lp148PreflightReconciliation.introducedByLp149, false);
  assert.equal(registry.lp148PreflightReconciliation.lp149ConsumesTrackedLp148MetadataRecognitionOnly, true);
  assert.equal(registry.lp148PreflightReconciliation.repairDeferredToSeparateMilestone, true);
});
