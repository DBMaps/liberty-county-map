import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { discover, prefill, reports, verify } from '../../tools/lp1731/discover-operational-evidence.mjs';
import template from '../../evidence/lp173/owner-evidence.template.json' with { type: 'json' };

const provenance = { collectionMethod: 'read-only metadata export', evidenceType: 'project-level production metadata', source: 'authoritative provider project metadata', sourceArtifactIdentity: `sha256:${'a'.repeat(64)}`, sourceReportedTime: '2026-01-01T00:00:00Z', value: 'explicit governed value', verificationMethod: 'exact project metadata field comparison' };
const source = facts => ({ schemaVersion: 'gridly.lp1731.productionMetadata.v1', facts });

test('complete provenance creates MACHINE_VERIFIED and positive absence creates NOT_CONFIGURED', () => {
  const result = discover(undefined, source({ monitoring: { monitoringProviders: { status: 'VERIFIED_PRESENT', ...provenance }, alertDestinations: { status: 'VERIFIED_ABSENT', ...provenance, value: 'explicitly disabled' } } }));
  assert.equal(result.monitoring.monitoringProviders.classification, 'MACHINE_VERIFIED');
  assert.equal(result.monitoring.alertDestinations.classification, 'NOT_CONFIGURED');
  assert.throws(() => discover(undefined, source({ monitoring: { monitoringProviders: { status: 'VERIFIED_PRESENT', value: 'capability exists' } } })), /lacks provenance/);
});

test('uncertain and ambiguous metadata never proves configuration or absence', () => {
  const result = discover(undefined, source({ monitoring: { alertThresholds: { status: 'UNCERTAIN' } }, backup: { pitrAvailability: { status: 'UNCERTAIN', ...provenance, value: 'Pro plan' }, latestSuccessfulBackupMetadata: { status: 'UNCERTAIN', ...provenance, value: 'backup capability exists' } } }));
  assert.equal(result.monitoring.alertThresholds.classification, 'NOT_VERIFIED');
  assert.equal(result.backup.pitrAvailability.classification, 'NOT_VERIFIED');
  assert.equal(result.backup.latestSuccessfulBackupMetadata.classification, 'NOT_VERIFIED');
});

test('missing sources are unavailable while collected attestations are preserved and identities are not inferred', () => {
  const result = discover(undefined, source({}));
  assert.equal(result.backup.backupProvider.classification, 'SOURCE_UNAVAILABLE');
  assert.equal(result.operationalOwnership.primaryOperationalOwner.classification, 'OWNER_ATTESTED');
  assert.equal(result.rollbackOwnership.rollbackAuthority.classification, 'OWNER_ATTESTED');
  assert.equal(result.launchOperations.communicationReadiness.classification, 'OWNER_ATTESTED');
  assert.equal(result.monitoring.monitoringOwnership.classification, 'OWNER_ATTESTED');
  assert.equal(result.monitoring.monitoringOwnership.value, 'Denise Burns');
  assert.equal(JSON.stringify(result).includes('git author'), false);
});

test('secret shapes, tokens, and credential-bearing URLs fail closed without echoing values', () => {
  for (const value of ['password=hunter2', `ghp_${'x'.repeat(30)}`, 'https://user:password@example.test/path']) {
    assert.throws(() => discover(undefined, source({ backup: { backupProvider: { status: 'UNCERTAIN', ...provenance, value } } })), error => !error.message.includes(value));
  }
});

test('prefill preserves valid owner attestation and rejects conflicting machine completion', () => {
  const machine = discover(undefined, source({ monitoring: { monitoringProviders: { status: 'VERIFIED_PRESENT', ...provenance } } }));
  const owner = structuredClone(template);
  owner.operationalOwnership.primaryOperationalOwner = { classification: 'OWNER_ATTESTED', collectionMethod: 'owner review', evidenceType: 'governed role attestation', source: 'operations authority record', sourceArtifactIdentity: null, sourceReportedTime: null, value: 'primary operations role', verificationMethod: 'explicit owner attestation review' };
  assert.equal(prefill(undefined, machine, owner).operationalOwnership.primaryOperationalOwner.classification, 'OWNER_ATTESTED');
  const conflict = structuredClone(owner); conflict.monitoring.monitoringProviders = { ...machine.monitoring.monitoringProviders, value: 'different verified value' };
  assert.throws(() => prefill(undefined, machine, conflict), /conflict/);
});

test('zero and partial discovery classifications are truthful and authorization is unchanged', () => {
  const zero = reports(discover(undefined, source({})))['auto-discovery-summary.json'];
  assert.equal(zero.classification, 'AUTO_DISCOVERY_NO_EVIDENCE');
  const partial = reports(discover(undefined, source({ backup: { backupProvider: { status: 'VERIFIED_PRESENT', ...provenance } } })))['auto-discovery-report.json'];
  assert.equal(partial.classification, 'AUTO_DISCOVERY_PARTIAL');
  assert.ok(Object.values(partial.authorizations).every(value => value === 'NOT_AUTHORIZED'));
});

test('committed outputs are deterministic canonical UTF-8 and protected identity stays Git-blob based', () => {
  assert.equal(verify(), true);
  const summary = JSON.parse(fs.readFileSync(new URL('../../reports/lp1731/auto-discovery-summary.json', import.meta.url)));
  assert.equal(summary.validation.protectedGitBlobIdentities, 'PASS');
  assert.equal(summary.validation.protectedIdentitySource, 'CANONICAL_GIT_BLOB');
  assert.equal(summary.validation.workingTreeIgnored, true);
  for (const relative of ['evidence/lp173/owner-evidence.autodiscovered.json', 'reports/lp1731/auto-discovery-report.json', 'reports/lp1731/auto-discovery-summary.json']) { const bytes = fs.readFileSync(new URL(`../../${relative}`, import.meta.url)); assert.equal(bytes.includes(13), false); assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]); }
});
