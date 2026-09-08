import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const HEALTH_SQL = `select json_build_object(
 'healthy', coalesce(last_status='succeeded' and last_success_at > statement_timestamp()-interval '5 minutes'
   and overdue_cleanup_count=0 and breached_deadline_count=0,false),
 'lastStatus',last_status,'lastSuccessAt',last_success_at,
 'overdueCleanupCount',overdue_cleanup_count,'breachedDeadlineCount',breached_deadline_count)
 from report_retention.health;`;

export function evaluateRetentionHealth(value) {
  return value?.healthy === true && value.lastStatus === 'succeeded'
    && Number(value.overdueCleanupCount) === 0 && Number(value.breachedDeadlineCount) === 0;
}

export function checkRetention({ env = process.env, run = spawnSync } = {}) {
  // Use a dedicated login granted ONLY gridly_retention_monitor, configured
  // through libpq environment/secret storage. Never pass a password in argv.
  // Connection errors and malformed results fail closed without printing stderr,
  // URLs, credentials, SQL statements, or database error messages.
  if (!env.PGHOST || !env.PGUSER || !env.PGDATABASE || env.PGSSLMODE !== 'verify-full') {
    return { healthy:false, reason:'monitor_connection_configuration_missing' };
  }
  const result = run(env.GRIDLY_RETENTION_PSQL || 'psql', ['-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],
    { input: HEALTH_SQL, encoding:'utf8', env:{ ...env, PGCONNECT_TIMEOUT:'10' }, windowsHide:true, timeout:20000 });
  if (result.status !== 0) return { healthy:false, reason:'monitor_query_failed' };
  try {
    const value = JSON.parse(result.stdout.trim());
    return { healthy:evaluateRetentionHealth(value), reason:evaluateRetentionHealth(value) ? 'retention_current' : 'retention_attention_required' };
  } catch { return { healthy:false, reason:'monitor_result_invalid' }; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const status = checkRetention();
  console.log(JSON.stringify(status));
  process.exitCode = status.healthy ? 0 : 1;
}
