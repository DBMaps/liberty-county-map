-- V410 future migration artifact only. Do not execute as part of this milestone.
-- Creates append-only, non-authoritative history_capture storage for passive Phase 1A events.

create schema if not exists history_capture;

create table if not exists history_capture.historical_events (
  id uuid primary key default gen_random_uuid(),
  schema_version text not null,
  phase text not null,
  event_type text not null check (event_type in ('report_created', 'report_cleared')),
  source_kind text,
  source_report_id text,
  idempotency_key text not null unique,
  observed_at timestamptz not null,
  received_at timestamptz not null default now(),
  hook_name text,
  envelope jsonb not null,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  retained_until timestamptz not null default (now() + interval '18 months')
);

create table if not exists history_capture.writer_monitoring_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  reason text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);

create table if not exists history_capture.retention_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  retention_target interval not null default interval '18 months',
  deleted_historical_event_count integer not null default 0,
  status text not null default 'planned',
  detail jsonb not null default '{}'::jsonb
);

create index if not exists historical_events_event_type_observed_at_idx
  on history_capture.historical_events (event_type, observed_at desc);

create index if not exists historical_events_source_report_id_idx
  on history_capture.historical_events (source_report_id)
  where source_report_id is not null;

create index if not exists historical_events_retained_until_idx
  on history_capture.historical_events (retained_until);

create index if not exists writer_monitoring_events_created_at_idx
  on history_capture.writer_monitoring_events (created_at desc);

alter table history_capture.historical_events enable row level security;
alter table history_capture.writer_monitoring_events enable row level security;
alter table history_capture.retention_runs enable row level security;

comment on schema history_capture is 'V410 future storage artifact for passive historical capture. Not deployed by this milestone.';
comment on table history_capture.historical_events is 'Append-only, non-authoritative Phase 1A event envelope storage with 18 month retention target. No app reads are added.';
comment on table history_capture.writer_monitoring_events is 'Maintainer-only writer diagnostics storage artifact. No user-visible monitoring.';
comment on table history_capture.retention_runs is 'Future retention bookkeeping artifact for the 18 month target.';
