import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deriveActivationWavePlan } from '../tools/lp140/activation-wave-planner.mjs';

const root = new URL('../', import.meta.url);
const json = async path => JSON.parse(await readFile(new URL(path, root)));
const inputs = {
  integrity: await json('evidence/lp130/final-reconciliation.json'),
  readiness: await json('evidence/lp131/statewide-readiness-audit.json'),
  certification: await json('evidence/lp135/statewide-certification.json'),
  operational: await json('evidence/lp136/statewide-operational-readiness.json'),
  membershipDraft: await json('evidence/lp138/county-geometry-membership-contract.draft.json')
};
const artifact = await json('evidence/lp140/activation-wave-planning.json');
const contract = await json('evidence/lp140/non-authorizing-wave-membership-contract.json');
const clone = structuredClone;

test('plan is entirely reproduced from authoritative evidence with deterministic FIPS ordering', () => {
  const first = deriveActivationWavePlan(inputs);
  const second = deriveActivationWavePlan(inputs);
  assert.deepEqual(first, second);
  assert.deepEqual(first.counties, artifact.counties);
  assert.deepEqual(first.waves, artifact.waves);
  assert.deepEqual(first.statewideTotals, { READY_FOR_FUTURE_WAVE: 0, CONDITIONALLY_READY: 243, BLOCKED: 11 });
  assert.deepEqual(first.counties.map(row => row.fips), first.counties.map(row => row.fips).sort());
});

test('every county has one class and no duplicate or cross-wave membership is possible', () => {
  assert.equal(artifact.counties.length, 254);
  assert.equal(new Set(artifact.counties.map(row => row.fips)).size, 254);
  assert.ok(artifact.counties.every(row => ['READY_FOR_FUTURE_WAVE', 'CONDITIONALLY_READY', 'BLOCKED'].includes(row.readinessClass)));
  const members = artifact.waves.flatMap(wave => wave.members);
  assert.equal(new Set(members.map(row => row.fips)).size, members.length);
  assert.ok(members.every(row => row.readinessClass !== 'BLOCKED'));
});

test('changing governed readiness evidence changes membership without manual selection', () => {
  const changed = clone(inputs);
  const county = changed.readiness.counties.find(row => row.fips === '48001');
  county.activationEligible = true;
  county.tier = 'TIER_2';
  county.lp132Gates = Array.from({ length: 7 }, (_, index) => ({ gate: index + 1, name: `Gate ${index + 1}`, status: index < 6 ? 'PASS' : 'NOT_EVALUATED' }));
  county.operationalPrerequisites = 'PASS';
  county.deploymentPrerequisites = 'PASS';
  changed.membershipDraft.approvedCounties.push({ countyId: county.countyId, fips: county.fips });
  const plan = deriveActivationWavePlan(changed);
  assert.deepEqual(plan.waves[1].members.map(row => row.fips), ['48001']);
  assert.equal(plan.counties[0].readinessClass, 'READY_FOR_FUTURE_WAVE');

  changed.certification.counties.find(row => row.fips === '48001').certificationStatus = 'CERTIFICATION_BLOCKED';
  const blocked = deriveActivationWavePlan(changed);
  assert.equal(blocked.counties[0].readinessClass, 'BLOCKED');
  assert.ok(blocked.waves.every(wave => wave.members.length === 0));
});

test('contract is empty, deterministic, and strictly non-authorizing', () => {
  assert.equal(contract.authority, 'NON_AUTHORIZING');
  assert.deepEqual(contract.waves.map(wave => wave.countyCount), [0, 0, 0, 0, 0]);
  assert.ok(Object.values(contract.permissions).every(value => value === false));
  assert.match(contract.statement, /no approval/);
});

test('planner performs no writes, deployment, or activation and runtime artifacts remain byte-identical', async () => {
  const paths = [
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.json',
    'assets/location-resolution/gridly-authoritative-county-geometry-v1.manifest.json',
    'data/generated/lp104/txgio-addresses/runtime-manifest.json', 'js/app.js',
    'evidence/lp138/county-geometry-membership-contract.baseline.json',
    'evidence/lp138/county-geometry-membership-contract.draft.json'
  ];
  const hashes = async () => Promise.all(paths.map(async path => createHash('sha256').update(await readFile(new URL(path, root))).digest('hex')));
  const before = await hashes();
  deriveActivationWavePlan(inputs);
  assert.deepEqual(await hashes(), before);
  assert.doesNotMatch(deriveActivationWavePlan.toString(), /writeFile\s*\(|fetch\s*\(|supabase\.|storage\.|deploy\s*\(|activateRuntime\s*\(/);
  assert.ok(Object.values(artifact.permissions).every(value => value === false));
});
