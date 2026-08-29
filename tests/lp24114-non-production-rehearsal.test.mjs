import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { EXPECTED, RehearsalBlocked, artifacts, guardEnvironment, initialize, inspectRuntimeShards, rollback, validateLegal, validateRelease, verifyReports } from '../tools/lp24114/non-production-rehearsal.mjs';

const release = path.resolve('poi', EXPECTED.authorityReleaseId);
const copyRelease = () => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lp24114-')); fs.cpSync(release, dir, { recursive: true }); return dir; };
const blocked = (fn, code) => assert.throws(fn, error => error instanceof RehearsalBlocked && error.code === code);

test('explicit NON_PRODUCTION guard rejects production, unknown, wrong mode, and an enabled production gate', () => {
  assert.doesNotThrow(() => guardEnvironment({ environment: 'NON_PRODUCTION', rehearsalMode: 'NON_PRODUCTION', productionProviderGate: 'OFF' }));
  for (const environment of ['PRODUCTION', 'UNKNOWN', undefined]) blocked(() => guardEnvironment({ environment, rehearsalMode: 'NON_PRODUCTION', productionProviderGate: 'OFF' }), 'REHEARSAL_BLOCKED_NON_PRODUCTION_GUARD');
  blocked(() => guardEnvironment({ environment: 'NON_PRODUCTION', rehearsalMode: 'OFF', productionProviderGate: 'OFF' }), 'REHEARSAL_BLOCKED_NON_PRODUCTION_GUARD');
  blocked(() => guardEnvironment({ environment: 'NON_PRODUCTION', rehearsalMode: 'NON_PRODUCTION', productionProviderGate: 'ON' }), 'REHEARSAL_BLOCKED_PRODUCTION_BOUNDARY');
});

test('certified manifest and all legal material validate before runtime inspection', () => {
  const manifest = validateRelease(); const legal = validateLegal();
  assert.equal(manifest.manifest.authorityReleaseId, EXPECTED.authorityReleaseId);
  assert.equal(manifest.manifest.runtimeSchemaVersion, EXPECTED.runtimeSchemaVersion);
  assert.equal(manifest.manifest.reviewedSourceInventoryHash, EXPECTED.reviewedSourceInventoryHash);
  assert.deepEqual(legal, { legalMaterialsVerified: true, noticeVerified: true, noticeSha256: EXPECTED.foursquareNoticeSha256, noticeBytes: 1805 });
});

test('release and schema/hash mismatches fail closed', () => {
  for (const key of ['authorityReleaseId', 'runtimeSchemaVersion', 'reviewedSourceInventoryHash', 'foursquareNoticeSha256', 'foursquareSourceSnapshotSha256', 'overtureAttributionSnapshotSha256'])
    blocked(() => validateRelease(release, { ...EXPECTED, [key]: 'wrong' }), 'REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH');
});

test('missing/corrupt NOTICE, notices index, and license manifest fail closed', () => {
  for (const relative of ['legal/foursquare/NOTICE.txt', 'legal/THIRD-PARTY-NOTICES.txt', 'legal/license-reference-manifest.json']) {
    const dir = copyRelease(); fs.rmSync(path.join(dir, relative));
    blocked(() => validateLegal(dir), 'REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID'); fs.rmSync(dir, { recursive: true });
  }
  const dir = copyRelease(); fs.appendFileSync(path.join(dir, 'legal/foursquare/NOTICE.txt'), '\r');
  blocked(() => validateLegal(dir), 'REHEARSAL_BLOCKED_COMPLIANCE_MATERIAL_MISSING_OR_INVALID'); fs.rmSync(dir, { recursive: true });
});

test('runtime shards are truthfully absent and initialization stops before search', () => {
  blocked(() => inspectRuntimeShards(), 'REHEARSAL_BLOCKED_RUNTIME_SHARDS_NOT_MATERIALIZED');
  blocked(() => initialize({ environment: 'NON_PRODUCTION', rehearsalMode: 'NON_PRODUCTION', productionProviderGate: 'OFF', authorityReleaseId: EXPECTED.authorityReleaseId, runtimeSchemaVersion: EXPECTED.runtimeSchemaVersion, lp24113ComplianceEligible: true }), 'REHEARSAL_BLOCKED_RUNTIME_SHARDS_NOT_MATERIALIZED');
});

test('wrong initialization bindings fail before shard access', () => {
  for (const patch of [{ authorityReleaseId: 'wrong' }, { runtimeSchemaVersion: 'wrong' }, { lp24113ComplianceEligible: false }])
    blocked(() => initialize({ environment: 'NON_PRODUCTION', rehearsalMode: 'NON_PRODUCTION', productionProviderGate: 'OFF', authorityReleaseId: EXPECTED.authorityReleaseId, runtimeSchemaVersion: EXPECTED.runtimeSchemaVersion, lp24113ComplianceEligible: true, ...patch }), 'REHEARSAL_BLOCKED_RELEASE_BINDING_MISMATCH');
});

test('bounded evidence does not claim search, cohort, cache, shard, or browser success', () => {
  const evidence = artifacts(); const runtime = evidence['lp24114-runtime-shard-availability.json']; const certification = evidence['lp24114-certification.json'];
  assert.equal(runtime.fixtureAdapterCreated, false); assert.equal(runtime.shardManufacturingPerformed, false); assert.equal(runtime.searchExecuted, false);
  assert.equal(certification.phaseState, 'REHEARSAL_BLOCKED_RUNTIME_SHARDS_NOT_MATERIALIZED'); assert.equal(certification.nonProductionProviderRehearsalPassed, false);
  assert.equal(certification.productionProviderEligible, false); assert.equal(certification.providerGate, 'OFF'); assert.equal(certification.runtimeActive, false);
  assert.equal(certification.deployed, false); assert.equal(certification.productionSupabaseMutation, false); assert.equal(certification.remoteOvertureFetch, false); assert.equal(certification.osmMerged, false); assert.equal(certification.phoneTesting, false);
});

test('rollback is deterministic and restores the inactive pre-rehearsal boundary', () => {
  assert.deepEqual(rollback(), { providerIdentity: 'PRE_REHEARSAL_PROVIDER', providerMode: 'DISABLED', cacheState: 'TEMPORARY_REHEARSAL_STATE_CLEARED', productionProviderGate: 'OFF', runtimeActive: false, rehearsalProviderEnabled: false, productionStateMutation: false, diagnostic: 'ROLLBACK_CONFIRMED_PRE_REHEARSAL_STATE' });
});

test('committed evidence exactly matches deterministic generation', () => assert.doesNotThrow(verifyReports));
