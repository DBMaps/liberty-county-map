-- V425 rollback — revoke historical schema exposure writer authorization.
-- If required, also remove history_capture from Supabase Data API/PostgREST exposed schemas.

begin;

drop policy if exists "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events;

revoke insert on table history_capture.historical_events from anon;
revoke usage on schema history_capture from anon;
revoke all on table history_capture.writer_monitoring_events from anon;
revoke all on table history_capture.retention_runs from anon;

revoke all on table history_capture.historical_events from authenticated;
revoke all on table history_capture.writer_monitoring_events from authenticated;
revoke all on table history_capture.retention_runs from authenticated;
revoke usage on schema history_capture from authenticated;

alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

commit;
