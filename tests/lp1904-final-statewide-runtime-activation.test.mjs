import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  FINAL11,
  assertCommunityRegistry,
  assertOperationalRegistryUnique,
  authoritativeCountyIdentityResolver,
  communityRegistryAudit,
  operationalRegistryAudit,
  packageJsRegistryAudit,
  projectCommunityRegistry,
  projectedIdentityAudits,
  verify
} from '../scripts/lp1904-final-statewide-runtime-activation-guarded.mjs';

const production = [
  'js/app.js',
  'assets/package-registry/runtime-package-registry.json',
  'js/gridlyPackageRegistry.js',
  'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
  'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json'
];
const read = path => fs.readFileSync(path, 'utf8');
const app = () => read('js/app.js');
const statewide = () => JSON.parse(read('assets/location-resolution/gridly-authoritative-texas-county-geometry-v1.json'));
const runtime = () => JSON.parse(read('assets/package-registry/runtime-package-registry.json'));
const inventory = () => new Map(JSON.parse(read('reports/lp1885/community-package-identity-inventory.json')).packages.map(p => [p.countyFips, p]));

// Reconstruct the governed pre-activation state in memory. Live production is now
// the 254/0 target and must never be used as the input fixture for planning tests.
const stripGeneratedBlocks = (text, marker) => {
  const label = marker ? ` ${marker}` : '';
  return text.replace(new RegExp(`^\\s*// LP1904 GENERATED${label} START (48\\d{3})\\n[\\s\\S]*?^\\s*// LP1904 GENERATED${label} END \\1\\n?`, 'gm'), '');
};
const baselineApp = () => stripGeneratedBlocks(app(), '');
const baselineRuntime = () => {
  const fixture = runtime();
  fixture.packages = fixture.packages.filter(p => p.packageType !== 'Community' || !FINAL11.includes(p.countyFips));
  fixture.packageTypes.find(p => p.packageType === 'Community').packageCount = 243;
  fixture.totalPackages = fixture.packages.length;
  return fixture;
};
const baselineJs = () => stripGeneratedBlocks(read('js/gridlyPackageRegistry.js'), 'METADATA');

test('LP190.4 fixes the activation cohort and exposes all guarded modes', () => {
  assert.deepEqual(FINAL11, ['48061','48073','48113','48121','48135','48229','48329','48377','48401','48425','48441']);
  const source = read('scripts/lp1904-final-statewide-runtime-activation-guarded.mjs');
  for (const flag of ['--whatif', '--apply', '--verify', '--json']) assert.match(source, new RegExp(flag));
  assert.match(source, /countyRegistryRange/);
  assert.doesNotMatch(source, /gridlyResolveCountyIdForCoordinate\s*=/);
});

test('isolated pre-activation fixture is exactly 243 operational with the final 11 absent', () => {
  const audit = operationalRegistryAudit(baselineApp(), statewide().counties);
  assert.equal(audit.totalRecords, 243);
  assert.equal(audit.explicitCountyFipsCount, 215);
  assert.equal(audit.legacyWithoutExplicitCountyFips.length, 28);
  assert.equal(audit.uniqueFipsCount, 243);
  assert.ok(FINAL11.every(fips => !audit.operationalFips.has(fips)));
});

test('WHATIF accepts only the governed 243 fixture and projects exact 254/0 identities', () => {
  const result = projectCommunityRegistry(baselineRuntime(), statewide().counties, inventory());
  assert.equal(result.current.recordCount, 243);
  assert.equal(result.current.uniqueCountyCount, 243);
  assert.equal(result.projected.recordCount, 254);
  assert.equal(result.projected.uniqueCountyCount, 254);
  assert.ok(FINAL11.every(fips => result.projected.identities.has(fips)));
});

test('pre-activation planning rejects a current count other than 243', () => {
  const changed = baselineRuntime();
  changed.packages.splice(changed.packages.findIndex(p => p.packageType === 'Community'), 1);
  assert.throws(() => projectCommunityRegistry(changed, statewide().counties, inventory()), /current runtime community registry must be exact 243/);
  const expanded = baselineRuntime();
  expanded.packages.push(structuredClone(expanded.packages.find(p => p.packageType === 'Community')));
  assert.throws(() => projectCommunityRegistry(expanded, statewide().counties, inventory()), /duplicate county FIPS|must be exact 243/);
});

test('pre-activation planning and APPLY validation fail closed on missing or duplicate counties', () => {
  const projected = projectCommunityRegistry(baselineRuntime(), statewide().counties, inventory()).registry;
  const missing = structuredClone(projected);
  missing.packages.splice(missing.packages.findIndex(p => p.countyFips === FINAL11[0]), 1);
  assert.throws(() => assertCommunityRegistry(communityRegistryAudit(missing, statewide().counties), 254, 'projected runtime community registry'), /must be exact 254/);
  const duplicate = structuredClone(projected);
  duplicate.packages.push(structuredClone(duplicate.packages.find(p => p.countyFips === FINAL11[0])));
  assert.throws(() => assertCommunityRegistry(communityRegistryAudit(duplicate, statewide().counties), 254, 'projected runtime community registry'), /duplicate county FIPS/);
});

test('malformed, conflicting, and duplicate identities fail closed', () => {
  const counties = statewide().counties;
  const resolve = authoritativeCountyIdentityResolver(counties);
  assert.equal(resolve({county: 'Anderson', countyFips: '4800'}).fips, null);
  assert.equal(resolve({county: 'Anderson', countyFips: '48003'}).fips, null);
  assert.equal(resolve({county: 'Anderson'}).fips, '48001');
  assert.throws(() => authoritativeCountyIdentityResolver([...counties, {...counties[0]}]), /duplicate authoritative county FIPS/);

  const malformed = baselineRuntime();
  malformed.packages.find(p => p.packageType === 'Community').countyFips = '4800';
  assert.throws(() => projectCommunityRegistry(malformed, counties, inventory()), /unresolved|FIPS/);
});

test('duplicate app identities and duplicate registry keys fail before activation', () => {
  const fixture = baselineApp();
  const duplicatedFips = fixture.replace(/(  "anderson-tx": Object\.freeze\(\{[^\n]+\n)/, '$1  "anderson-alias-tx": Object.freeze({ id: "anderson-alias-tx", countyFips: "48001", operational: true }),\n');
  assert.throws(() => assertOperationalRegistryUnique(operationalRegistryAudit(duplicatedFips, statewide().counties)), /operational FIPS must be unique: 48001/);
  const duplicatedKey = fixture.replace(/(  "anderson-tx": Object\.freeze\(\{[^\n]+\n)/, '$1  "anderson-tx": Object.freeze({ id: "anderson-tx", countyFips: "48001", operational: true }),\n');
  assert.throws(() => operationalRegistryAudit(duplicatedKey, statewide().counties), /runtime registry duplicate keys: anderson-tx/);
});

test('live post-activation registries are synchronized at 254 resolved unique FIPS', () => {
  const counties = statewide().counties;
  const appAudit = operationalRegistryAudit(app(), counties);
  const runtimeAudit = communityRegistryAudit(runtime(), counties);
  const jsAudit = packageJsRegistryAudit(read('js/gridlyPackageRegistry.js'), counties);
  for (const audit of [runtimeAudit, jsAudit]) {
    assert.equal(audit.recordCount, 254);
    assert.equal(audit.explicitCountyFipsCount, 226);
    assert.equal(audit.legacyWithoutExplicitCountyFips.length, 28);
    assert.equal(audit.resolvedFipsCount, 254);
    assert.equal(audit.uniqueCountyCount, 254);
    assert.deepEqual(audit.unresolved, []);
    assert.deepEqual(audit.duplicateFips, []);
  }
  assert.equal(appAudit.totalRecords, 254);
  assert.equal(appAudit.registryKeyCount, 254);
  assert.equal(appAudit.explicitCountyFipsCount, 226);
  assert.equal(appAudit.legacyWithoutExplicitCountyFips.length, 28);
  assert.equal(appAudit.resolvedFipsCount, 254);
  assert.equal(appAudit.uniqueFipsCount, 254);
  assert.deepEqual(appAudit.unresolvedIdentities, []);
  assert.deepEqual(appAudit.duplicateFips, []);
  assert.deepEqual([...runtimeAudit.identities].sort(), [...jsAudit.identities].sort());
});

test('the exact 28 legacy counties remain authoritative without literal FIPS', () => {
  const expected = ['48015','48039','48041','48057','48071','48089','48149','48157','48167','48185','48199','48201','48239','48241','48245','48285','48291','48321','48339','48351','48361','48373','48407','48457','48471','48473','48477','48481'];
  const counties = statewide().counties;
  const resolve = authoritativeCountyIdentityResolver(counties);
  const records = runtime().packages.filter(p => p.packageType === 'Community' && !p.countyFips);
  assert.deepEqual(records.map(p => resolve(p).fips).sort(), expected);
});

test('idempotent projected audits recognize the live post-activation target', () => {
  const projected = projectedIdentityAudits();
  assert.equal(projected.app.uniqueFipsCount, 254);
  assert.equal(projected.runtime.uniqueCountyCount, 254);
  assert.equal(projected.js.uniqueCountyCount, 254);
});

test('live VERIFY requires every post-activation invariant', () => {
  const result = verify();
  assert.equal(result.pass, true);
  assert.equal(result.operationalUniqueFips, 254);
  assert.equal(result.runtimeRestrictedCountyCount, 0);
  for (const key of ['original243Operational','final11Operational','communityMetadata','communityAvailability','countyIdentityFips','censusIdentityPlaceGeoid','runtimeJsRegistrySynchronized']) assert.equal(result[key], true, key);
  assert.equal(result.crossingRegression.libertyCrossingCount, 115);
  assert.equal(result.crossingRegression.tylerClassification, 'PRE_EXISTING_CERTIFIED_ZERO_CROSSING_DATA_QUALITY_CONDITION');
  assert.equal(result.protectedSystemChangeCount, 0);
});

test('guard preserves production bytes during fixture tests and verification', () => {
  const before = production.map(path => fs.readFileSync(path));
  baselineApp(); baselineRuntime(); baselineJs(); verify();
  assert.deepEqual(production.map(path => fs.readFileSync(path)), before);
});

test('completed report records the exact activation and verified invariants', () => {
  const report = JSON.parse(read('reports/lp1904/final-statewide-runtime-activation.json'));
  assert.equal(report.preActivationOperationalCount, 243);
  assert.equal(report.preActivationRestrictedCount, 11);
  assert.equal(report.activatedCountyCount, 11);
  assert.equal(report.postActivationOperationalCount, 254);
  assert.equal(report.postActivationRestrictedCount, 0);
  assert.deepEqual(report.exactActivatedFips, FINAL11);
  assert.equal(report.activationPerformed, true);
  assert.equal(report.overallClassification, 'TEXAS_STATEWIDE_RUNTIME_ACTIVATION_COMPLETE');
  assert.equal(report.verification.pass, true);
});
