-- LP244.21: PREPARED ONLY. Destructive privacy migration; separate approval required.
-- Review docs/LEGAL/LP24421-REPORT-RETENTION.md before applying.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
lock table public.reports in access exclusive mode;

create schema if not exists report_retention;
revoke all on schema report_retention from public, anon, authenticated;

alter table public.reports add column original_submitted_at timestamptz;
alter table public.reports add column linkage_deadline timestamptz;
alter table public.reports add column cleanup_after timestamptz;
-- Missing/future legacy timestamps have no trustworthy origin. Never date them now.
update public.reports set original_submitted_at = case
  when created_at is not null and created_at <= statement_timestamp() then created_at
  else '-infinity'::timestamptz end;
update public.reports set linkage_deadline = original_submitted_at + interval '4320 hours',
  cleanup_after = original_submitted_at + interval '3576 hours';
-- Delete at day 149, reserving 31 days for scheduling/recovery and backup expiry.
-- This buffer is NOT proof of the actual provider's backup/log retention.
alter table public.reports alter column original_submitted_at set not null;
alter table public.reports alter column linkage_deadline set not null;
alter table public.reports alter column cleanup_after set not null;
create index reports_cleanup_after_idx on public.reports(cleanup_after);

create table report_retention.condition_month_counts (
  submission_month date not null,
  condition_family text not null check (condition_family in ('road', 'crossing')),
  report_count bigint not null check (report_count > 0),
  primary key (submission_month, condition_family)
);
create table report_retention.runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  status text not null check (status in ('running','succeeded','failed')),
  deleted_reports bigint not null default 0,
  error_code text -- SQLSTATE only; never SQLERRM, row data, IDs, or device values.
);
alter table report_retention.condition_month_counts enable row level security;
alter table report_retention.runs enable row level security;
revoke all on all tables in schema report_retention from public, anon, authenticated, service_role;
revoke all on all sequences in schema report_retention from public, anon, authenticated, service_role;

-- Legacy historical JSON has no enforced lineage or immutable original submission
-- timestamp. Do not infer an age from received_at, retain hashes, or copy it elsewhere.
delete from history_capture.historical_events;
delete from history_capture.writer_monitoring_events;
delete from history_capture.retention_runs;
revoke all on all tables in schema history_capture from public, anon, authenticated, service_role;
revoke all on schema history_capture from public, anon, authenticated, service_role;
create function report_retention.reject_legacy_history() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = '42501', message = 'Legacy report history capture is closed';
end $$;
create trigger history_capture_closed before insert or update on history_capture.historical_events
for each row execute function report_retention.reject_legacy_history();
create trigger history_monitoring_closed before insert or update on history_capture.writer_monitoring_events
for each row execute function report_retention.reject_legacy_history();

-- Prior unrestricted INSERT grants let clients set created_at. None of the legacy
-- rows has an enforced immutable origin, even when a plausible timestamp exists.
-- Conservatively remove ALL legacy associations, free text, coordinates and IDs.
-- Coarse counts may use plausible recorded months; they are not verified events.
-- The read-only audit found zero live rows; recheck before the approved cutover.
update public.reports set cleanup_after = '-infinity';

-- The private association exists only during the allowed live period. It is
-- deleted (not hashed or moved to an archive) by the report's cascading deletion.
-- Keeping it out of the condition row also prevents constraint-error row details
-- and generic condition serializers from including a device identifier.
create table report_retention.device_links (
  report_id uuid primary key references public.reports(id) on delete cascade deferrable initially deferred,
  device_id text not null
);
alter table report_retention.device_links enable row level security;
revoke all on report_retention.device_links from public,anon,authenticated,service_role;
insert into report_retention.device_links(report_id,device_id)
select id,device_id from public.reports where device_id is not null and cleanup_after>statement_timestamp();
update public.reports set device_id=null;
alter table public.reports add constraint reports_device_never_stored check (device_id is null);

create function report_retention.guard_report() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if TG_OP = 'INSERT' then
    if not exists (select 1 from report_retention.runs where status='succeeded'
      and completed_at > clock_timestamp()-interval '5 minutes') then
      raise exception using errcode = '55000', message = 'Report retention maintenance is unavailable';
    end if;
    -- A trusted import must supply the ORIGINAL created_at, never its import time.
    -- Client column grants prohibit setting created_at or any retention fields.
    new.original_submitted_at := case
      when new.created_at is not null and new.created_at <= clock_timestamp() then new.created_at
      else '-infinity'::timestamptz end;
    new.linkage_deadline := new.original_submitted_at + interval '4320 hours';
    new.cleanup_after := new.original_submitted_at + interval '3576 hours';
    if new.cleanup_after <= clock_timestamp() then
      raise exception using errcode = '22023', message = 'Report original submission is missing or outside retention';
    end if;
  else
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at
      or new.original_submitted_at is distinct from old.original_submitted_at
      or new.linkage_deadline is distinct from old.linkage_deadline
      or new.cleanup_after is distinct from old.cleanup_after
      or (new.device_id is distinct from old.device_id and new.device_id is not null) then
      raise exception using errcode = '22023', message = 'Report origin and device association cannot be reassigned';
    end if;
    if old.cleanup_after <= clock_timestamp() then
      raise exception using errcode = '22023', message = 'Report is outside retention';
    end if;
  end if;
  if new.crossing_id ~ '^hazard(?:-cleared)?-.+-[0-9]{10,}$'
    or (new.device_id is not null and new.device_id <> '' and
      position(new.device_id in concat_ws(' ',new.crossing_id,new.crossing_name,new.detail,new.railroad,new.confidence,new.source)) > 0) then
    raise exception using errcode = '22023', message = 'Device identifiers are forbidden in condition fields';
  end if;
  if TG_OP = 'INSERT' and new.device_id is not null then
    insert into report_retention.device_links(report_id,device_id) values (new.id,new.device_id);
  end if;
  new.device_id := null;
  return new;
end $$;
create trigger report_retention_origin before insert or update on public.reports
for each row execute function report_retention.guard_report();

create function report_retention.run_cleanup() returns bigint
language plpgsql security definer set search_path = pg_catalog as $$
declare run_id bigint; deleted_count bigint; failure_code text;
begin
  -- One cleanup at a time. Concurrent/repeated calls cannot double-count history.
  perform pg_advisory_xact_lock(24421,180);
  insert into report_retention.runs(status) values ('running') returning id into run_id;
  begin
    with removed as (
      delete from public.reports where cleanup_after <= clock_timestamp()
      returning original_submitted_at, crossing_id
    ), counted as (
      insert into report_retention.condition_month_counts(submission_month,condition_family,report_count)
      select date_trunc('month',original_submitted_at at time zone 'UTC')::date,
        case when crossing_id like 'hazard-%' then 'road' else 'crossing' end, count(*)
      from removed where isfinite(original_submitted_at)
      group by 1,2
      on conflict (submission_month,condition_family) do update
        set report_count = condition_month_counts.report_count + excluded.report_count
      returning 1
    ) select count(*) into deleted_count from removed;
    update report_retention.runs set status='succeeded',completed_at=clock_timestamp(),deleted_reports=deleted_count where id=run_id;
  exception when others then
    get stacked diagnostics failure_code = returned_sqlstate;
    update report_retention.runs set status='failed',completed_at=clock_timestamp(),error_code=failure_code where id=run_id;
    -- Return failure WITHOUT raising: preserve the failure record when cron commits.
    -- A killed session/transaction rollback is detected by the stale-heartbeat check.
    return -1;
  end;
  delete from report_retention.runs where started_at < clock_timestamp()-interval '30 days';
  return deleted_count;
end $$;
revoke all on all functions in schema report_retention from public, anon, authenticated, service_role;

-- Remove table AND inherited/default column grants before installing least privilege.
revoke all on public.reports from public, anon, authenticated, service_role;
do $$ declare col record; begin
  for col in select attname from pg_attribute where attrelid='public.reports'::regclass and attnum>0 and not attisdropped loop
    execute format('revoke all (%I) on public.reports from public, anon, authenticated, service_role', col.attname);
  end loop;
end $$;
grant select (id,created_at,crossing_id,crossing_name,railroad,lat,lng,report_type,severity,detail,source,confidence,expires_at)
  on public.reports to anon, authenticated;
grant insert (crossing_id,crossing_name,railroad,lat,lng,report_type,severity,detail,source,confidence,device_id,expires_at)
  on public.reports to anon, authenticated;
alter table public.reports enable row level security;
create policy report_retention_read_boundary on public.reports as restrictive for select to anon,authenticated
  using (cleanup_after > statement_timestamp() and linkage_deadline > statement_timestamp());
-- Realtime can retain the existing condition feed: device_id is always NULL in
-- its source row. The private link table must never enter a publication.
do $$ begin
  if exists (select 1 from pg_publication where puballtables) then
    raise exception 'All-table replication requires a separate privacy review';
  end if;
end $$;

create view report_retention.health as
select (select max(completed_at) from report_retention.runs where status='succeeded') as last_success_at,
  (select count(*) from public.reports where cleanup_after<=statement_timestamp()) as overdue_cleanup_count,
  (select count(*) from public.reports where linkage_deadline<=statement_timestamp()) as breached_deadline_count,
  (select status from report_retention.runs order by id desc limit 1) as last_status;
revoke all on report_retention.health from public,anon,authenticated,service_role;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='gridly_retention_monitor') then
    create role gridly_retention_monitor nologin;
  end if;
end $$;
grant usage on schema report_retention to gridly_retention_monitor;
grant select on report_retention.health to gridly_retention_monitor;
-- Migration must abort if initial cleanup cannot complete.
do $$ begin
  if report_retention.run_cleanup() < 0 then raise exception 'Initial report cleanup failed'; end if;
end $$;
commit;
