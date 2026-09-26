import { projectHealth } from './contract.mjs';
export const SUBSYSTEMS = ['report_retention', 'compliance_cleanup'];
export const ENVIRONMENT = 'Gridly production';
const MAX_COUNT = 1_000_000;

function utc(value) {
  if (value == null) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('invalid_health_projection');
  return date.toISOString();
}

function count(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    throw new Error('invalid_health_projection');
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || number > MAX_COUNT) {
    throw new Error('invalid_health_projection');
  }
  return number;
}

export function safePayload({ subsystem, state, observedAt, lastSuccessAt = null,
  overdueCount = 0, breachedCount = 0, errorCategory = null }) {
  if (![...SUBSYSTEMS, 'cleanup_monitor'].includes(subsystem)
      || !['healthy', 'stale', 'failed', 'overdue', 'monitor_error'].includes(state)
      || observedAt == null
      || (errorCategory !== null && ![
        'job_missing', 'job_inactive', 'job_misconfigured', 'job_failed',
        'compliance_health_missing', 'compliance_late_processed', 'recovery', 'retention_failed', 'query_failed', 'invalid_status', 'synthetic_test',
      ].includes(errorCategory))) throw new Error('invalid_alert_payload');
  return Object.freeze({
    environment: ENVIRONMENT,
    cleanup_subsystem: subsystem,
    health_state: state,
    observed_at: utc(observedAt),
    last_success_at: utc(lastSuccessAt),
    overdue_count: count(overdueCount),
    breached_count: count(breachedCount),
    error_category: errorCategory,
  });
}

export function monitorError(observedAt, errorCategory = 'query_failed') {
  return safePayload({ subsystem: 'cleanup_monitor', state: 'monitor_error',
    observedAt, errorCategory });
}

function classifyRow(row, now) {
  if (!row || !SUBSYSTEMS.includes(row.subsystem)
      || !['active', 'missing', 'inactive', 'misconfigured'].includes(row.job_state)
      || !['succeeded', 'running', 'failed', 'none'].includes(row.latest_run_state)
      || !['succeeded', 'failed', 'none'].includes(row.retention_state)) {
    throw new Error('invalid_health_projection');
  }
  const observedAt = utc(now);
  const lastSuccessAt = utc(row.last_success_at);
  const latestRunAt = utc(row.latest_run_at);
  const overdueCount = count(row.report_overdue_count);
  const breachedCount = count(row.report_breached_count);
  if (row.subsystem === 'compliance_cleanup'
      && (row.retention_state !== 'none' || overdueCount !== 0 || breachedCount !== 0)) {
    throw new Error('invalid_health_projection');
  }
  for (const timestamp of [lastSuccessAt, latestRunAt]) {
    if (timestamp && Date.parse(timestamp) > Date.parse(observedAt) + 60_000) {
      throw new Error('invalid_health_projection');
    }
  }
  const base = { subsystem: row.subsystem, observedAt, lastSuccessAt,
    overdueCount, breachedCount };
  const jobProblem = {
    missing: 'job_missing', inactive: 'job_inactive', misconfigured: 'job_misconfigured',
  }[row.job_state];
  if (jobProblem) return safePayload({ ...base, state: 'failed', errorCategory: jobProblem });
  if (row.latest_run_state === 'failed') {
    return safePayload({ ...base, state: 'failed', errorCategory: 'job_failed' });
  }
  if (row.subsystem === 'report_retention' && row.retention_state === 'failed') {
    return safePayload({ ...base, state: 'failed', errorCategory: 'retention_failed' });
  }
  if (overdueCount > 0 || breachedCount > 0) {
    return safePayload({ ...base, state: 'overdue' });
  }
  if(row.subsystem==='compliance_cleanup') {
    if(row.compliance_health_state==='missing') return safePayload({...base,state:'failed',errorCategory:'compliance_health_missing'});
    if(row.compliance_health_state!=='succeeded') return safePayload({...base,state:'stale'});
    const late=utc(row.compliance_late_processed_at);
    if(late && Date.parse(late)>Date.parse(observedAt)+60000) throw Error('invalid_health_projection');
    if(late && Date.parse(observedAt)-Date.parse(late)<5*60000 && row.compliance_late_processed_count>0) return safePayload({...base,state:'overdue',overdueCount:row.compliance_late_processed_count,errorCategory:'compliance_late_processed'});
  }
  const maxAgeMs = row.subsystem === 'report_retention' ? 5 * 60_000 : 3 * 60_000;
  if (!lastSuccessAt || !latestRunAt
      || Date.parse(observedAt) - Date.parse(lastSuccessAt) >= maxAgeMs
      || Date.parse(observedAt) - Date.parse(latestRunAt) >= 3 * 60_000) {
    return safePayload({ ...base, state: 'stale' });
  }
  if (row.subsystem === 'report_retention' && row.retention_state !== 'succeeded') {
    throw new Error('invalid_health_projection');
  }
  return safePayload({ ...base, state: 'healthy' });
}

export function classifyHealth(rows, now = new Date()) {
  if (!Array.isArray(rows) || rows.length !== 2
      || new Set(rows.map(row => row?.subsystem)).size !== 2) {
    throw new Error('invalid_health_projection');
  }
  rows=projectHealth(rows);
  const bySubsystem = new Map(rows.map(row => [row.subsystem, row]));
  return SUBSYSTEMS.map(subsystem => classifyRow(bySubsystem.get(subsystem), now));
}
