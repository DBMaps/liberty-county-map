const assert = require('assert');
const fs = require('fs');

const config = fs.readFileSync('supabase/config.toml', 'utf8');
const migration = fs.readFileSync('supabase/migrations/202606170425_history_capture_schema_exposure.sql', 'utf8');
const rollback = fs.readFileSync('supabase/migrations/202606170426_rollback_history_capture_schema_exposure.sql', 'utf8');

assert.match(config, /schemas\s*=\s*\[[^\]]*"public"[^\]]*"graphql_public"[^\]]*"history_capture"[^\]]*\]/s, 'history_capture is included in the tracked PostgREST schema exposure list');

assert.match(migration, /grant usage on schema history_capture to anon/i, 'anon receives only schema usage');
assert.match(migration, /grant insert on table history_capture\.historical_events to anon/i, 'anon receives insert on historical_events');
assert.match(migration, /revoke select, update, delete, truncate, references, trigger\s+on table history_capture\.historical_events\s+from anon/is, 'anon non-insert privileges are revoked');
assert.doesNotMatch(migration, /grant\s+(select|update|delete|truncate|all)\b[^;]*\bto anon/i, 'migration does not grant anon read or mutation privileges');
assert.match(migration, /revoke all on table history_capture\.writer_monitoring_events from anon/i, 'writer monitoring remains inaccessible to anon');
assert.match(migration, /revoke all on table history_capture\.retention_runs from anon/i, 'retention runs remain inaccessible to anon');
assert.match(migration, /revoke all on table history_capture\.historical_events from authenticated/i, 'authenticated receives no historical event table access by default');

for (const table of ['historical_events', 'writer_monitoring_events', 'retention_runs']) {
  assert.match(migration, new RegExp(`alter table history_capture\\.${table} enable row level security`, 'i'), `${table} keeps RLS enabled`);
}

assert.match(migration, /create policy "history_capture_anon_insert_phase1a_events"[\s\S]*for insert[\s\S]*to anon[\s\S]*with check/is, 'only scoped anon insert policy is created');
assert.match(migration, /schema_version = 'history_capture\.phase_1a\.v1'/i, 'insert policy is scoped to the Phase 1A schema version');
assert.match(migration, /event_type in \('report_created', 'report_cleared'\)/i, 'insert policy is scoped to approved event types');
assert.doesNotMatch(migration, /for\s+(select|update|delete|all)\b/i, 'migration creates no read or mutation policies');

assert.match(rollback, /drop policy if exists "history_capture_anon_insert_phase1a_events"/i, 'rollback removes the insert policy');
assert.match(rollback, /revoke insert on table history_capture\.historical_events from anon/i, 'rollback revokes anon insert');
assert.match(rollback, /revoke usage on schema history_capture from anon/i, 'rollback revokes anon schema usage');
