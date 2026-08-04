import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';
import { canonicalJson, membershipSha256, validateMembershipContract } from '../tools/lp138/validate-county-geometry-membership.mjs';

const require = createRequire(import.meta.url);
const builder = require('../tools/build-gridly-authoritative-county-geometry.js');
const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const baseline = await json('evidence/lp138/county-geometry-membership-contract.baseline.json');
const pkg = await json('assets/location-resolution/gridly-authoritative-county-geometry-v1.json');
const manifest = await json('assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json');
const clone = value => structuredClone(value);
const boundaryJson = path => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const identities = baseline.approvedCounties.map(({ countyId, fips }) => ({ countyId, fips }));
const packageIdentities = pkg.counties.map(({ countyId, source }) => {
  const boundary = boundaryJson(source.boundaryPath);
  const props = (boundary.type === 'FeatureCollection' ? boundary.features[0] : boundary).properties;
  return { countyId, fips: String(props.GEOID || props.FIPS) };
});

async function withTemporaryContract(mutator, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'lp139-'));
  try {
    const contract = clone(baseline);
    mutator(contract);
    const path = join(directory, 'contract.json');
    await writeFile(path, JSON.stringify(contract));
    return await callback(path, contract);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('builder loads only a valid baseline contract', async () => {
  assert.equal(builder.loadMembershipContract().contractKind, 'CURRENT_OPERATIONAL_BASELINE');
  assert.throws(() => builder.loadMembershipContract('/definitely/missing/lp139.json'), /ENOENT/);
  await withTemporaryContract(() => {}, async path => { await writeFile(path, '{'); assert.throws(() => builder.loadMembershipContract(path), /JSON/); });
  for (const mutate of [
    c => { c.contractKind = 'FUTURE_APPROVAL_DRAFT'; },
    c => { c.schemaVersion = '2.0.0'; },
    c => { c.contractVersion = '2.0.0'; },
    c => { c.provenance.membershipSha256 = '0'.repeat(64); }
  ]) await withTemporaryContract(mutate, path => assert.throws(() => builder.loadMembershipContract(path)));
});

test('contract, live registry, and committed package have exact identity equality', () => {
  const registry = builder.extractRegistry();
  const registryIdentities = Object.entries(registry).filter(([, row]) => row.operational === true).map(([countyId, row]) => {
    const boundary = boundaryJson(row.boundaryPath);
    const props = (boundary.type === 'FeatureCollection' ? boundary.features[0] : boundary).properties;
    return { countyId, fips: String(props.GEOID || props.FIPS) };
  });
  assert.equal(validateMembershipContract(baseline, { registryMembers: registryIdentities, packageMembers: packageIdentities }), true);
  assert.deepEqual([...registryIdentities].sort((a, b) => a.fips.localeCompare(b.fips)), packageIdentities);
  const cases = [
    identities.slice(1),
    [...identities, { countyId: 'unauthorized-tx', fips: '48999' }],
    [identities[0], ...identities],
    identities.map((x, i) => i ? x : { ...x, countyId: 'mismatch-tx' }),
    identities.map((x, i) => i ? x : { ...x, fips: '48999' })
  ];
  for (const rows of cases) assert.throws(() => validateMembershipContract(baseline, { packageMembers: rows }), /does not equal/);
  for (const mutate of [c => c.approvedCounties.reverse(), c => c.approvedCountyCount--]) {
    const changed = clone(baseline); mutate(changed); changed.provenance.membershipSha256 = membershipSha256(changed.approvedCounties);
    assert.throws(() => validateMembershipContract(changed));
  }
});

test('fixed-count authority is retired and contract cardinality changes without code edits', async () => {
  const builderSource = await readFile(new URL('tools/build-gridly-authoritative-county-geometry.js', root), 'utf8');
  const browserSource = await readFile(new URL('js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js', root), 'utf8');
  assert.doesNotMatch(builderSource, /EXPECTED_(?:OPERATIONAL_)?COUNTY_COUNT\s*=\s*28/);
  assert.doesNotMatch(browserSource, /EXPECTED_(?:OPERATIONAL_)?COUNTY_COUNT\s*=\s*28/);
  assert.equal(builder.buildPackage().expectedOperationalCountyCount, baseline.approvedCounties.length);
  await withTemporaryContract(c => {
    c.approvedCounties.pop(); c.approvedCountyCount--; c.existingBaselineCountyCount--;
    c.provenance.membershipSha256 = membershipSha256(c.approvedCounties);
  }, path => assert.equal(builder.loadMembershipContract(path).approvedCounties.length, baseline.approvedCounties.length - 1));
});

test('browser audit derives membership and reports all permissions without activating its loader', async () => {
  const source = await readFile(new URL('js/gridlyLp0361cRuntimeCountyGeometryPackageAudit.js', root), 'utf8');
  const responses = new Map([
    ['evidence/lp138/county-geometry-membership-contract.baseline.json', baseline],
    ['assets/location-resolution/gridly-authoritative-county-geometry-v1.json', pkg],
    ['assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json', manifest]
  ]);
  let fetches = 0;
  const window = {};
  vm.runInNewContext(source, { window, console, TextEncoder, Uint8Array, crypto: webcrypto, Set, fetch: async path => { fetches++; return { ok: responses.has(path), status: responses.has(path) ? 200 : 404, json: async () => clone(responses.get(path)) }; } });
  assert.equal(fetches, 0, 'audit contract path is dormant until explicitly invoked');
  const result = await window.gridlyLp0361cRuntimeCountyGeometryPackageAudit();
  assert.equal(result.contractAvailable, true); assert.equal(result.contractValid, true);
  assert.equal(result.expectedOperationalCountyCount, baseline.approvedCounties.length);
  assert.equal(result.contractMembershipSha256, membershipSha256(baseline.approvedCounties));
  assert.equal(result.contractPackageExactEquality, true);
  assert.equal(result.fixedCountGovernanceActive, false);
  for (const permission of ['preparationAuthorized', 'packageGenerationAuthorized', 'storageUploadAuthorized', 'deploymentAuthorized', 'runtimeActivationAuthorized']) assert.equal(result[permission], false);
  assert.equal(result.runtimeActivationAttempted, false);
});

test('verification is read-only while governed writes remain unauthorized', () => {
  assert.equal(builder.verifyDeterministic().deterministicBuildPassed, true);
  assert.equal(builder.auditRuntimeGeometry().passed, true);
  assert.throws(() => builder.writeOutputs(), /writes are not authorized/);
  const p = baseline.permissions;
  assert.deepEqual(['prepareGeometry', 'generateRuntimePackage', 'storageUpload', 'deploy', 'activateRuntime'].map(name => p[name].authorized), [false, false, false, false, false]);
});

test('LP139 operations leave protected and governed inputs byte-identical', async () => {
  const paths = [
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json',
    'evidence/lp138/county-geometry-membership-contract.baseline.json',
    'evidence/lp138/county-geometry-membership-contract.draft.json', 'js/app.js',
    'assets/boundaries/texas-counties-boundaries.geojson',
    'assets/state-boundaries/Texas_Counties_Cartographic_Boundary_Map_20260620.geojson',
    'service-worker.js'
  ];
  const hash = async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex');
  const before = await Promise.all(paths.map(hash));
  builder.auditRuntimeGeometry(); builder.verifyDeterministic();
  assert.deepEqual(await Promise.all(paths.map(hash)), before);
  assert.equal(manifest.packageSha256, await hash(paths[0]));
});
