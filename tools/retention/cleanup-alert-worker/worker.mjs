import pg from 'pg';
import { runScheduled } from './runner.mjs';

async function queryHealth(connectionString, sql) {
  const client = new pg.Client({ connectionString,
    connectionTimeoutMillis: 8_000, query_timeout: 8_000,
    statement_timeout: 5_000, application_name: 'gridly_cleanup_alert' });
  try {
    await client.connect();
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end().catch(() => {});
  }
}

export default {
  async scheduled(_controller, env) {
    try {
      if (!env?.HYPERDRIVE?.connectionString) throw new Error('monitor_configuration_missing');
      await runScheduled({
        env,
        queryHealth: sql => queryHealth(env.HYPERDRIVE.connectionString, sql),
      });
    } catch {
      // Never log the database error, response body, credentials, or stack.
      console.error('gridly_cleanup_alert_run_failed');
      throw new Error('gridly_cleanup_alert_run_failed');
    }
  },
};
