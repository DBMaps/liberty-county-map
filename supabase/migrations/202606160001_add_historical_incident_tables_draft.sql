-- V371 — Additive Historical Schema Migration Draft
-- Draft only: do not apply without future approval.
-- This migration creates additive historical incident tables only.
-- It does not modify public.reports or any existing production table.
-- It does not add triggers, backfill data, or enable historical app reads/writes.

create table if not exists public.historical_incidents (
  id uuid primary key default gen_random_uuid(),
  incident_type text not null,
  incident_kind text,
  status text not null default 'closed',
  primary_location_label text,
  area_label text,
  lat double precision,
  lng double precision,
  first_observed_at timestamptz,
  last_observed_at timestamptz,
  closed_at timestamptz,
  duration_seconds integer,
  report_count integer default 0,
  confirmation_count integer default 0,
  clear_count integer default 0,
  source_report_ids uuid[] default '{}',
  recurrence_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  model_version text not null default 'historical-v1'
);

create table if not exists public.incident_events (
  id uuid primary key default gen_random_uuid(),
  historical_incident_id uuid references public.historical_incidents(id) on delete cascade,
  source_report_id uuid,
  event_type text not null,
  event_time timestamptz,
  event_source text,
  lat double precision,
  lng double precision,
  location_label text,
  device_hash text,
  created_at timestamptz default now(),
  model_version text not null default 'historical-v1'
);

create table if not exists public.incident_recurrence_index (
  id uuid primary key default gen_random_uuid(),
  recurrence_key text not null,
  incident_type text,
  area_label text,
  primary_location_label text,
  lat_bucket text,
  lng_bucket text,
  incident_count integer default 0,
  average_duration_seconds integer,
  last_seen_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  model_version text not null default 'historical-v1'
);

create index if not exists historical_incidents_recurrence_key_idx
  on public.historical_incidents (recurrence_key);
create index if not exists historical_incidents_incident_type_idx
  on public.historical_incidents (incident_type);
create index if not exists historical_incidents_area_label_idx
  on public.historical_incidents (area_label);
create index if not exists historical_incidents_closed_at_idx
  on public.historical_incidents (closed_at);
create index if not exists historical_incidents_first_observed_at_idx
  on public.historical_incidents (first_observed_at);

create index if not exists incident_events_historical_incident_id_idx
  on public.incident_events (historical_incident_id);
create index if not exists incident_events_source_report_id_idx
  on public.incident_events (source_report_id);
create index if not exists incident_events_event_type_idx
  on public.incident_events (event_type);

create index if not exists incident_recurrence_index_recurrence_key_idx
  on public.incident_recurrence_index (recurrence_key);

alter table public.historical_incidents enable row level security;
alter table public.incident_events enable row level security;
alter table public.incident_recurrence_index enable row level security;

-- Conservative draft RLS: client reads are explicitly denied until a future
-- milestone approves history reads/UI. No anonymous or authenticated write
-- policies are created; service-role/back-office writes require future review
-- before this draft may be applied.
drop policy if exists "Deny client historical incident reads" on public.historical_incidents;
create policy "Deny client historical incident reads"
  on public.historical_incidents
  for select
  to anon, authenticated
  using (false);

drop policy if exists "Deny client incident event reads" on public.incident_events;
create policy "Deny client incident event reads"
  on public.incident_events
  for select
  to anon, authenticated
  using (false);

drop policy if exists "Deny client recurrence index reads" on public.incident_recurrence_index;
create policy "Deny client recurrence index reads"
  on public.incident_recurrence_index
  for select
  to anon, authenticated
  using (false);

comment on table public.historical_incidents is 'V371 draft additive historical incident summary table. Draft only; not applied; no app read/write dependency approved.';
comment on table public.incident_events is 'V371 draft additive incident event table. Draft only; not applied; no app read/write dependency approved.';
comment on table public.incident_recurrence_index is 'V371 draft additive recurrence lookup table. Draft only; not applied; no app read/write dependency approved.';
