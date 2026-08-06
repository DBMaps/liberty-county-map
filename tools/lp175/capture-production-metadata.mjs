import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encode, ROOT } from '../lp172/collect-owner-operational-evidence.mjs';
import { SOURCE, write } from '../lp1731/discover-operational-evidence.mjs';
import { SECRET_PATTERN } from '../lp173/complete-operational-evidence.mjs';

export const CAPTURE = 'evidence/lp175/supabase-production-metadata.capture.json';
export const CAPTURE_SCHEMA = 'gridly.lp175.supabaseProductionMetadataCapture.v1';

const services = ['API Gateway', 'Auth', 'Database', 'Edge Functions', 'PostgREST', 'Realtime', 'Storage'];
const scalar = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const identity = bytes => `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
const record = (value, source, artifactIdentity, reportedAt, verificationMethod) => ({
  collectionMethod: 'deterministic ingestion of sanitized Supabase production metadata capture',
  evidenceType: 'authoritative Supabase project metadata',
  source,
  sourceArtifactIdentity: artifactIdentity,
  sourceReportedTime: reportedAt,
  status: 'VERIFIED_PRESENT',
  value,
  verificationMethod
});

export function transform(bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes[0] === 0xef || bytes.includes(13) || SECRET_PATTERN.test(bytes.toString('utf8'))) throw Error('LP175 capture is non-canonical or contains secret-shaped material');
  const capture = JSON.parse(bytes.toString('utf8'));
  const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n');
  if (!exactKeys(capture, ['backup', 'environment', 'monitoring', 'provider', 'schemaVersion', 'source', 'sourceReportedTime']) ||
      !exactKeys(capture.backup, ['latestSuccessfulBackupMetadata', 'managedScheduledBackups', 'pointInTimeRecoveryEnabled', 'schedule']) ||
      !exactKeys(capture.monitoring, ['active', 'product', 'services'])) throw Error('LP175 capture envelope is invalid');
  if (capture.schemaVersion !== CAPTURE_SCHEMA || capture.provider !== 'Supabase' || capture.environment !== 'production') throw Error('LP175 capture envelope is invalid');
  const reportedAt = scalar(capture.sourceReportedTime);
  const source = scalar(capture.source);
  const backup = capture.backup;
  const monitoring = capture.monitoring;
  if (!reportedAt || !source || !backup || !monitoring) throw Error('LP175 capture provenance is incomplete');
  if (backup.managedScheduledBackups !== true || scalar(backup.schedule) !== 'daily' || !scalar(backup.latestSuccessfulBackupMetadata) || typeof backup.pointInTimeRecoveryEnabled !== 'boolean') throw Error('LP175 backup metadata is incomplete');
  if (monitoring.product !== 'Supabase Observability / Unified Logs' || monitoring.active !== true || !Array.isArray(monitoring.services) || services.some(name => !monitoring.services.includes(name)) || monitoring.services.some(name => !services.includes(name))) throw Error('LP175 monitoring metadata is incomplete');
  const id = identity(bytes);
  const exact = field => `exact comparison of ${field} in the identified Supabase capture artifact`;
  return {
    schemaVersion: 'gridly.lp1731.productionMetadata.v1',
    facts: {
      backup: {
        backupFrequency: record('daily', source, id, reportedAt, exact('backup.schedule')),
        backupProvider: record('Supabase managed scheduled backups', source, id, reportedAt, exact('backup.managedScheduledBackups')),
        latestSuccessfulBackupMetadata: record(backup.latestSuccessfulBackupMetadata.trim(), source, id, reportedAt, exact('backup.latestSuccessfulBackupMetadata')),
        pitrAvailability: record(backup.pointInTimeRecoveryEnabled ? 'enabled' : 'disabled', source, id, reportedAt, exact('backup.pointInTimeRecoveryEnabled'))
      },
      monitoring: {
        evidenceTimestamp: record(reportedAt, source, id, reportedAt, exact('sourceReportedTime')),
        monitoredProductionServices: record(services.join(', '), source, id, reportedAt, exact('monitoring.services')),
        monitoringProviders: record(monitoring.product, source, id, reportedAt, exact('monitoring.product and monitoring.active'))
      }
    }
  };
}

export function capture(root = ROOT) {
  const capturePath = path.join(root, CAPTURE);
  if (!fs.existsSync(capturePath)) throw Error('LP175 authoritative capture artifact is unavailable');
  const output = transform(fs.readFileSync(capturePath));
  fs.writeFileSync(path.join(root, SOURCE), encode(output), 'utf8');
  return write(root, output);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { capture(); console.log('LP175 authoritative production metadata captured and LP173.1 discovery regenerated.'); }
  catch { console.error('LP175 capture failed closed; source content was not displayed.'); process.exitCode = 1; }
}
