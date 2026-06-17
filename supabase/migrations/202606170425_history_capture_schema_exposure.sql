-- V425 — Historical Schema Exposure Authorization Implementation
-- Applies the V424 approved least-privilege package for PostgREST access.
-- Production prerequisite: Supabase Data API/PostgREST exposed schemas include history_capture.

begin;

-- Allow only the verified browser writer role to resolve the approved schema.
grant usage on schema history_capture to anon;

-- Allow append-only historical evidence writes to the approved evidence table.
grant insert on table history_capture.historical_events to anon;

-- Explicitly prevent browser/client reads and non-insert mutations on evidence storage.
revoke select, update, delete, truncate, references, trigger
  on table history_capture.historical_events
  from anon;

-- Preserve monitoring and retention table isolation for the browser/client writer role.
revoke all on table history_capture.writer_monitoring_events from anon;
revoke all on table history_capture.retention_runs from anon;

-- Do not grant authenticated access unless a later milestone verifies it is required.
revoke all on table history_capture.historical_events from authenticated;
revoke all on table history_capture.writer_monitoring_events from authenticated;
revoke all on table history_capture.retention_runs from authenticated;
revoke usage on schema history_capture from authenticated;

-- Keep all historical tables protected by RLS.
alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

-- Replace only the scoped insert policy for the verified writer role.
drop policy if exists "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events;

create policy "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events
  for insert
  to anon
  with check (
    schema_version = 'history_capture.phase_1a.v1'
    and phase = '1A'
    and event_type in ('report_created', 'report_cleared')
    and idempotency_key is not null
    and observed_at is not null
    and envelope is not null
    and payload is not null
    and metadata is not null
    and jsonb_typeof(envelope) = 'object'
    and jsonb_typeof(payload) = 'object'
    and jsonb_typeof(metadata) = 'object'
  );

comment on policy "history_capture_anon_insert_phase1a_events"
  on history_capture.historical_events
  is 'V425: anon may insert only valid Phase 1A historical evidence envelopes; no reads or mutations are granted.';

commit;
