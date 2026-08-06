import assert from 'node:assert/strict';
import test from 'node:test';
import { CAPTURE_SCHEMA, transform } from '../../tools/lp175/capture-production-metadata.mjs';

const input = () => Buffer.from(JSON.stringify({ schemaVersion: CAPTURE_SCHEMA, provider: 'Supabase', environment: 'production', source: 'Supabase production project metadata export', sourceReportedTime: '2026-08-06T00:00:00Z', backup: { managedScheduledBackups: true, schedule: 'daily', latestSuccessfulBackupMetadata: 'successful at provider timestamp', pointInTimeRecoveryEnabled: false, retentionPolicy: { plan: 'Pro', dailyBackupRetentionDays: 7, planEvidenceSource: 'production project dashboard plan evidence', policyEvidenceSource: 'authoritative Supabase backup-retention documentation' } }, monitoring: { product: 'Supabase Observability / Unified Logs', active: true, services: ['API Gateway', 'Auth', 'Database', 'Edge Functions', 'PostgREST', 'Realtime', 'Storage'], projectAlertConfigurationSurfaceExposed: false, alertDestinationsConfigured: false, alertThresholdsConfigured: false, projectConfigurationEvidenceSource: 'production dashboard review and provider capability evidence' } }));

test('maps an authoritative capture without inference and derives artifact identity', () => {
  const one = transform(input());
  const two = transform(input());
  assert.deepEqual(one, two);
  assert.equal(one.facts.backup.backupFrequency.status, 'VERIFIED_PRESENT');
  assert.match(one.facts.backup.backupFrequency.sourceArtifactIdentity, /^sha256:[a-f0-9]{64}$/);
  assert.equal(one.facts.backup.pitrAvailability.value, 'disabled');
  assert.equal(one.facts.monitoring.monitoredProductionServices.value, 'API Gateway, Auth, Database, Edge Functions, PostgREST, Realtime, Storage');
  assert.equal(one.facts.backup.retentionPolicy.value, '7 days of daily backups');
  assert.match(one.facts.backup.retentionPolicy.source, /production project dashboard plan evidence.*authoritative Supabase backup-retention documentation/);
  assert.equal(one.facts.monitoring.alertDestinations.status, 'VERIFIED_ABSENT');
  assert.equal(one.facts.monitoring.alertThresholds.status, 'VERIFIED_ABSENT');
});

test('does not infer retention from the Pro plan or invent alert configuration', () => {
  const value = JSON.parse(input()); delete value.backup.retentionPolicy.policyEvidenceSource;
  assert.throws(() => transform(Buffer.from(JSON.stringify(value))), /invalid|provenance/);
  value.backup.retentionPolicy.policyEvidenceSource = 'authoritative Supabase backup-retention documentation';
  value.monitoring.alertDestinationsConfigured = true;
  assert.throws(() => transform(Buffer.from(JSON.stringify(value))), /incomplete/);
});

test('fails closed on incomplete or non-production captures', () => {
  const value = JSON.parse(input()); value.environment = 'staging';
  assert.throws(() => transform(Buffer.from(JSON.stringify(value))), /invalid/);
  value.environment = 'production'; delete value.backup.latestSuccessfulBackupMetadata;
  assert.throws(() => transform(Buffer.from(JSON.stringify(value))), /invalid|incomplete/);
});
