import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildArtifacts, governMembership, stableJson } from '../tools/lp18810/govern-owner-membership.mjs';

const root = new URL('../', import.meta.url);
const json = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const sha = async name => createHash('sha256').update(await readFile(new URL(name, root))).digest('hex');
const protectedFiles = ['js/app.js', 'data/lp150/candidate-membership-contract.json', 'reports/lp1889/proposed-candidate-membership-contract.json', 'reports/lp1888/restricted-county-readiness.json', 'data/generated/lp104/txgio-addresses/manifest.json'];

test('uses exactly the governed 215 LP188.9 FIPS and excludes operational and restricted counties', async () => {
  const { matrix, summary } = buildArtifacts(), source = await json('reports/lp1889/county-readiness.json'), proposal = await json('reports/lp1889/proposed-candidate-membership-contract.json'), baseline = await json('reports/lp1888/statewide-county-activation-readiness.json');
  assert.deepEqual(matrix.records.map(r => r.countyFips), source.records.map(r => r.countyFips));
  assert.deepEqual(matrix.records.map(r => r.countyFips), proposal.candidateCounties.map(r => r.fips));
  assert.equal(matrix.records.length, 215); assert.equal(baseline.records.filter(r => r.currentOperationalStatus === 'ALREADY_OPERATIONAL').length, 28); assert.equal(baseline.records.filter(r => r.restrictionStatus === 'ACTIVE_PRESERVED').length, 11);
  assert.deepEqual([summary.currentOperationalCount, summary.restrictedCountyCount, summary.newActivatedCount, summary.runtimeOperationalCountChanged, summary.restrictedCountyStateChanged], [28, 11, 0, false, false]);
});

test('records exact owner authority, prepares one governed cohort, and never fabricates execution', () => {
  const { decision, matrix, waves, summary } = buildArtifacts();
  assert.equal(decision.decisionStatus, 'OWNER_APPROVED'); assert.equal(decision.approvedCountyCount, 215); assert.equal(decision.decisionScope, 'ALL_215_CANDIDATES_EXACT_FIPS');
  assert.ok(matrix.records.every(r => r.ownerMembershipDecision === 'OWNER_APPROVED' && r.membershipStatus === 'MEMBERSHIP_OWNER_APPROVED' && r.validationWave === 'LP18810-NP-001' && r.deploymentPreparationAuthorization === 'AUTHORIZED' && r.deploymentPreparationStatus === 'DEPLOYMENT_PREPARED' && r.deploymentExecutionStatus === 'NOT_DEPLOYED' && r.nonProductionExecutionAuthorization === 'AUTHORIZED_NOT_EXECUTED' && r.productionDeploymentAuthorization === false && r.productionActivationAuthorization === false && r.runtimeValidationStatus.startsWith('NOT_RUN_') && r.finalActivationAuthorizationStatus === 'NOT_AUTHORIZED' && r.activationStatus === 'NOT_ACTIVATED' && r.blockingReasons.length));
  assert.equal(waves.waves.length, 1); assert.deepEqual(waves.waves[0].countyFips, decision.approvedCountyFips); assert.equal(waves.waves[0].countyCount, 215); assert.equal(waves.waves[0].validationStatus, 'NOT_EXECUTED_NO_EXTERNAL_EVIDENCE');
  assert.deepEqual([summary.ownerMembershipApprovedCount, summary.ownerMembershipRejectedCount, summary.ownerMembershipPendingCount, summary.deploymentPreparationAuthorizedCount, summary.nonProductionValidationAuthorizedCount, summary.deploymentPreparedCount, summary.deploymentExecutionAuthorizedCount, summary.deploymentConfirmedCount, summary.runtimeValidatedCount, summary.operationallyValidatedCount, summary.structurallyActivationEligibleCount], [215, 0, 0, 215, 215, 215, 215, 0, 0, 0, 0]);
});

test('explicit exact-FIPS authority is validated; wrong, duplicate, and ambiguous decisions fail closed', async () => {
  const source = await json('reports/lp1889/county-readiness.json'), one = source.records[0].countyFips;
  const base = { decisionStatus: 'OWNER_APPROVED', decisionScope: 'EXACT_COUNTY_FIPS', approvedCountyCount: 1, approvedCountyFips: [one], rejectedCountyCount: 0, rejectedCountyFips: [], pendingCountyCount: 214, membershipOnly: true, deploymentPreparationAuthorized: false, nonProductionValidationAuthorized: false, productionActivationAuthorized: false, productionDeploymentAuthorized: false, publicLaunchAuthorized: false, supabaseProductionMutationAuthorized: false, restrictionClearingAuthorized: false };
  const approved = governMembership(source, base); assert.equal(approved.summary.ownerMembershipApprovedCount, 1); assert.equal(approved.summary.deploymentPreparedCount, 0); assert.equal(approved.matrix.records[0].nonProductionExecutionAuthorization, 'NOT_AUTHORIZED');
  assert.throws(() => governMembership(source, { ...base, decisionStatus: 'PENDING' }));
  assert.throws(() => governMembership(source, { ...base, approvedCountyFips: ['48999'] }));
  assert.throws(() => governMembership(source, { ...base, approvedCountyFips: [one, one], approvedCountyCount: 2, pendingCountyCount: 213 }));
  assert.throws(() => governMembership(source, { ...base, productionActivationAuthorized: true }));
  assert.throws(() => governMembership(source, { ...base, decisionScope: 'ALL_215_CANDIDATES_EXACT_FIPS' }));
  const rejected = governMembership(source, { ...base, approvedCountyCount: 0, approvedCountyFips: [], rejectedCountyCount: 1, rejectedCountyFips: [one] }); assert.equal(rejected.matrix.records[0].membershipStatus, 'MEMBERSHIP_OWNER_REJECTED'); assert.equal(rejected.matrix.records[0].deploymentExecutionStatus, 'NOT_DEPLOYED');
  const absent = governMembership(source); assert.equal(absent.summary.ownerMembershipPendingCount, 215); assert.equal(absent.waves.waves.length, 0);
});

test('deterministic builds preserve runtime registry, awareness, Supabase, package, address, and prior artifacts', async () => {
  const before = await Promise.all(protectedFiles.map(sha));
  assert.equal(stableJson(buildArtifacts()), stableJson(buildArtifacts()));
  assert.deepEqual(await Promise.all(protectedFiles.map(sha)), before);
});
