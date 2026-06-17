const assert = require('assert');
const fs = require('fs');

const migration = fs.readFileSync('supabase/migrations/202606170410_history_capture_storage.sql', 'utf8');
const rollback = fs.readFileSync('supabase/migrations/202606170411_rollback_history_capture_storage.sql', 'utf8');

assert.match(migration, /create schema if not exists history_capture/i);
assert.match(migration, /history_capture\.historical_events/i);
assert.match(migration, /history_capture\.writer_monitoring_events/i);
assert.match(migration, /history_capture\.retention_runs/i);
assert.match(migration, /interval '18 months'/i);
assert.doesNotMatch(migration, /public\.activeHazards|loadSharedReports\(|getLiveHazardIncidents\(/i);
assert.match(rollback, /drop table if exists history_capture\.retention_runs/i);
assert.match(rollback, /drop table if exists history_capture\.writer_monitoring_events/i);
assert.match(rollback, /drop table if exists history_capture\.historical_events/i);
assert.doesNotMatch(rollback, /public\./i);

console.log('historyCaptureRollback.test.js passed');
