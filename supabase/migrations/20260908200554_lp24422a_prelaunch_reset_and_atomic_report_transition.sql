-- LP244.22A: PREPARED ONLY. Owner-authorized pre-launch reset and atomic report transition.
-- Do not run after public launch. Requires a separately created, unconsumed
-- gridly_control.prelaunch_reset_authorization row with the approved fingerprint.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
set local search_path = pg_catalog;
select pg_advisory_xact_lock(24422, 1);

lock table public.reports,
  history_capture.historical_events,
  history_capture.writer_monitoring_events,
  history_capture.retention_runs
  in access exclusive mode;

do $$
declare
  reset_auth gridly_control.prelaunch_reset_authorization%rowtype;
  report_rows bigint;
  device_rows bigint;
  synthetic_rows bigint;
  embedded_device_rows bigint;
  cleared_rows bigint;
  historical_rows bigint;
  historical_clear_rows bigint;
  writer_rows bigint;
  retention_rows bigint;
  removed_reports bigint;
  removed_historical bigint;
  removed_writer bigint;
  removed_retention bigint;
begin
  if session_user <> 'postgres' then
    raise exception using errcode='42501', message='Pre-launch reset requires the postgres owner session';
  end if;
  select * into reset_auth
  from gridly_control.prelaunch_reset_authorization
  where singleton
  for update;
  if not found
     or reset_auth.status <> 'authorized'
     or reset_auth.migration_id <> '20260908200554'
     or reset_auth.project_ref <> 'nhwhkbkludzkuyxmkkcj'
     or reset_auth.consumed_at is not null
     or reset_auth.launched_at is not null then
    raise exception using errcode='55000', message='Pre-launch reset is not explicitly authorized';
  end if;
  if to_regnamespace('report_retention') is not null
     or to_regprocedure('public.submit_community_observation(text,jsonb,text)') is not null then
    raise exception using errcode='55000', message='Report transition is partially present; reconcile before reset';
  end if;

  select count(*),
    count(*) filter (where device_id is not null),
    count(*) filter (where crossing_id ~ '^hazard(?:-cleared)?-.+-[0-9]{10,}$'),
    count(*) filter (where device_id is not null and device_id <> ''
      and position(device_id in concat_ws(' ',crossing_id,crossing_name,detail,railroad,confidence,source)) > 0),
    count(*) filter (where report_type in ('cleared','hazard_cleared') or crossing_id like 'hazard-cleared-%')
  into report_rows,device_rows,synthetic_rows,embedded_device_rows,cleared_rows
  from public.reports;
  select count(*),count(*) filter (where event_type='report_cleared')
    into historical_rows,historical_clear_rows from history_capture.historical_events;
  select count(*) into writer_rows from history_capture.writer_monitoring_events;
  select count(*) into retention_rows from history_capture.retention_runs;

  if row(report_rows,device_rows,synthetic_rows,embedded_device_rows,cleared_rows,
         historical_rows,historical_clear_rows,writer_rows,retention_rows)
     is distinct from
     row(reset_auth.expected_reports,reset_auth.expected_device_reports,
         reset_auth.expected_synthetic_reports,reset_auth.expected_embedded_device_reports,
         reset_auth.expected_cleared_reports,reset_auth.expected_historical_events,
         reset_auth.expected_historical_clears,reset_auth.expected_writer_events,
         reset_auth.expected_retention_runs) then
    raise exception using errcode='22023', message='Pre-launch reset fingerprint mismatch';
  end if;

  delete from history_capture.historical_events;
  get diagnostics removed_historical = row_count;
  delete from history_capture.writer_monitoring_events;
  get diagnostics removed_writer = row_count;
  delete from history_capture.retention_runs;
  get diagnostics removed_retention = row_count;
  delete from public.reports;
  get diagnostics removed_reports = row_count;

  if row(removed_reports,removed_historical,removed_writer,removed_retention)
     is distinct from row(report_rows,historical_rows,writer_rows,retention_rows) then
    raise exception using errcode='40001', message='Pre-launch reset deletion count changed during transaction';
  end if;

  update gridly_control.prelaunch_reset_authorization
  set status='consumed', consumed_at=clock_timestamp(),
      deleted_reports=removed_reports,
      deleted_historical_events=removed_historical,
      deleted_writer_events=removed_writer,
      deleted_retention_runs=removed_retention
  where singleton;
  raise notice 'LP244.22A reset counts: reports=%, historical_events=%, writer_events=%, retention_runs=%',
    removed_reports,removed_historical,removed_writer,removed_retention;
end $$;

-- The automatic public-schema RLS event trigger is redundant with explicit
-- migration RLS and is an exposed SECURITY DEFINER surface. Drop only event
-- triggers that directly call this exact zero-argument function; unexpected
-- dependencies make DROP FUNCTION fail and roll back the complete migration.
do $$
declare event_name text;
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public,anon,authenticated,service_role;
    for event_name in
      select e.evtname from pg_event_trigger e
      where e.evtfoid=to_regprocedure('public.rls_auto_enable()')
      order by e.evtname
    loop
      execute format('drop event trigger %I',event_name);
    end loop;
    drop function public.rls_auto_enable();
  end if;
end $$;

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

-- Legacy history was explicitly removed by the guarded pre-launch reset above.
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

-- The guarded pre-launch reset left public.reports empty before this schema transition.

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
do $$
declare monitor pg_roles%rowtype;
begin
  begin
    create role gridly_retention_monitor nologin nosuperuser nocreatedb
      nocreaterole noinherit noreplication nobypassrls connection limit 0;
  exception
    when duplicate_object or unique_violation then null;
  end;
  select * into monitor from pg_roles where rolname='gridly_retention_monitor';
  if not found then
    raise exception 'gridly_retention_monitor was not created';
  end if;
  if monitor.rolcanlogin or monitor.rolsuper or monitor.rolcreatedb
     or monitor.rolcreaterole or monitor.rolinherit or monitor.rolreplication or monitor.rolbypassrls
     or monitor.rolconnlimit <> 0 or monitor.rolconfig is not null
     or exists (select 1 from pg_db_role_setting where setrole=monitor.oid)
     or exists (
       -- PostgreSQL 16+ grants a non-superuser creator ADMIN on its new role.
       -- This is owner administration OF the monitor, never monitor membership
       -- IN an operational role. Do not permit SET/INHERIT or API members.
       select 1 from pg_auth_members m
       where (m.roleid=monitor.oid or m.member=monitor.oid)
         and not (m.roleid=monitor.oid
           and m.member=(select oid from pg_roles where rolname='postgres')
           and m.admin_option and not m.inherit_option and not m.set_option
           and exists(select 1 from pg_roles g where g.oid=m.grantor and g.rolsuper))
     ) then
    raise exception using errcode='42501',
      message='gridly_retention_monitor has incompatible or elevated role attributes';
  end if;
end $$;
grant usage on schema report_retention to gridly_retention_monitor;
grant select on report_retention.health to gridly_retention_monitor;
do $$
declare monitor_oid oid;
begin
  select oid into strict monitor_oid from pg_roles where rolname='gridly_retention_monitor';
  if exists (select 1 from pg_shdepend where refclassid='pg_authid'::regclass
       and refobjid=monitor_oid and deptype='o')
     or not has_schema_privilege(monitor_oid,'report_retention','USAGE')
     or has_schema_privilege(monitor_oid,'report_retention','CREATE')
     or not has_table_privilege(monitor_oid,'report_retention.health','SELECT')
     or has_table_privilege(monitor_oid,'report_retention.health','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or exists (
       select 1 from pg_namespace n cross join lateral aclexplode(n.nspacl) a
       where a.grantee=monitor_oid
         and not (n.nspname='report_retention' and a.privilege_type='USAGE' and not a.is_grantable)
     )
     or exists (
       select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
       cross join lateral aclexplode(c.relacl) a
       where a.grantee=monitor_oid
         and not (n.nspname='report_retention' and c.relname='health' and a.privilege_type='SELECT' and not a.is_grantable)
     )
     or exists (
       select 1 from pg_attribute c cross join lateral aclexplode(c.attacl) a
       where a.grantee=monitor_oid
     )
     or exists (
       select 1 from pg_proc p cross join lateral aclexplode(p.proacl) a
       where a.grantee=monitor_oid
     )
     or exists (
       select 1 from pg_database d cross join lateral aclexplode(d.datacl) a
       where a.grantee=monitor_oid
     ) then
    raise exception using errcode='42501',
      message='gridly_retention_monitor privileges exceed the monitoring minimum';
  end if;
end $$;
-- Migration must abort if initial cleanup cannot complete.
do $$ begin
  if report_retention.run_cleanup() < 0 then raise exception 'Initial report cleanup failed'; end if;
end $$;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table report_retention.admission_state (
  singleton boolean primary key default true check (singleton),
  protocol_version integer not null check (protocol_version = 2),
  reporting_enabled boolean not null default false,
  changed_at timestamptz not null default clock_timestamp()
);
insert into report_retention.admission_state(singleton,protocol_version,reporting_enabled)
values (true,2,false);
alter table report_retention.admission_state enable row level security;
revoke all on report_retention.admission_state from public,anon,authenticated,service_role;

create table report_retention.replay_evidence (
  token_digest bytea primary key check (octet_length(token_digest)=32),
  first_accepted_at timestamptz not null default clock_timestamp()
);
alter table report_retention.replay_evidence enable row level security;
revoke all on report_retention.replay_evidence from public,anon,authenticated,service_role;

create function report_retention.preserve_replay_evidence() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin raise exception using errcode='42501',message='Replay evidence is append-only'; end $$;
create trigger replay_evidence_immutable before update or delete on report_retention.replay_evidence
for each row execute function report_retention.preserve_replay_evidence();
create trigger replay_evidence_no_truncate before truncate on report_retention.replay_evidence
for each statement execute function report_retention.preserve_replay_evidence();

-- LP244.21D: transient provenance for live observations. Cascades at cleanup;
-- it is NOT retained in the permanent replay ledger or historical aggregates.
create table report_retention.observation_receipts (
  report_id uuid primary key references public.reports(id) on delete cascade,
  token_digest bytea not null unique references report_retention.replay_evidence(token_digest),
  original_submitted_at timestamptz not null
);
alter table report_retention.observation_receipts enable row level security;
revoke all on report_retention.observation_receipts from public,anon,authenticated,service_role;
create trigger observation_receipt_immutable before update on report_retention.observation_receipts
for each row execute function report_retention.preserve_replay_evidence();

-- No raw token or device/condition reference is retained in this ledger.
-- UUID bytes are canonicalized before hashing (case cannot bypass uniqueness).
create function report_retention.claim_operation(token text) returns boolean
language plpgsql set search_path=pg_catalog as $$
declare claimed bytea;
begin
  if token is null or token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  insert into report_retention.replay_evidence(token_digest)
    values (extensions.digest(uuid_send(token::uuid),'sha256'))
    on conflict do nothing returning token_digest into claimed;
  return claimed is not null;
end $$;

-- Only bounded, non-identifying status and the normal public condition projection
-- leave the RPC. A retry never discloses the original submitter or original row.
create function report_retention.public_report(report_id uuid) returns jsonb
language sql stable set search_path=pg_catalog as $$
  select jsonb_build_object('id',r.id,'created_at',r.created_at,'crossing_id',r.crossing_id,
    'crossing_name',r.crossing_name,'railroad',r.railroad,'lat',r.lat,'lng',r.lng,
    'report_type',r.report_type,'severity',r.severity,'detail',r.detail,'source',r.source,
    'confidence',r.confidence,'expires_at',r.expires_at)
  from public.reports r where r.id=report_id
$$;

create function public.submit_community_observation(submission_token text, report jsonb, reporter_device_id text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare new_id uuid; key text;
begin
  if not exists (select 1 from report_retention.admission_state
    where singleton and protocol_version=2 and reporting_enabled) then
    return jsonb_build_object('status','maintenance');
  end if;
  if submission_token is null or submission_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(report) is distinct from 'object' or octet_length(report::text)>12000
    or reporter_device_id is null or length(reporter_device_id) not between 1 and 128
    or position(lower(submission_token) in lower(report::text))>0
    or position(lower(submission_token) in lower(reporter_device_id))>0 then
    return jsonb_build_object('status','invalid_request');
  end if;
  for key in select jsonb_object_keys(report) loop
    if key <> all(array['crossing_id','crossing_name','railroad','lat','lng','report_type','severity','detail','source','confidence','expires_at']) then
      return jsonb_build_object('status','invalid_request');
    end if;
  end loop;
  if coalesce(report->>'report_type','') in ('','cleared','hazard_cleared')
    or coalesce(report->>'crossing_id','')=''
    or coalesce(report->>'crossing_name','')=''
    or coalesce(report->>'severity','')=''
    or coalesce(report->>'detail','') ~* 'lifecycle_report_id:' then
    return jsonb_build_object('status','invalid_request');
  end if;
  -- A supplied UUIDv4 is independent protocol input; never synthesize one for legacy callers.
  -- Unique insert waits for a concurrent claimant's commit/rollback, atomically.
  if not report_retention.claim_operation(submission_token) then
    return jsonb_build_object('status','already_processed');
  end if;
  insert into public.reports(crossing_id,crossing_name,railroad,lat,lng,report_type,severity,
    detail,source,confidence,device_id,expires_at)
  values (report->>'crossing_id',report->>'crossing_name',report->>'railroad',
    (report->>'lat')::double precision,(report->>'lng')::double precision,report->>'report_type',
    report->>'severity',report->>'detail','user',report->>'confidence',reporter_device_id,
    least(coalesce((report->>'expires_at')::timestamptz,clock_timestamp()+interval '90 minutes'),clock_timestamp()+interval '90 minutes'))
  returning id into new_id;
  insert into report_retention.observation_receipts(report_id,token_digest,original_submitted_at)
    select id,extensions.digest(uuid_send(submission_token::uuid),'sha256'),original_submitted_at
    from public.reports where id=new_id;
  return jsonb_build_object('status','accepted','report',report_retention.public_report(new_id));
exception when others then
  -- PL/pgSQL exception subtransaction rolls back BOTH ledger claim and row/link.
  -- Never propagate row, body, token, SQLERRM or device information in an error.
  return jsonb_build_object('status','retryable_failure');
end $$;

create function public.mutate_community_observation(operation_id text, observation_id uuid,
  action text, changes jsonb default '{}'::jsonb, reporter_device_id text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare original public.reports%rowtype; key text;
begin
  if not exists (select 1 from report_retention.admission_state
    where singleton and protocol_version=2 and reporting_enabled) then
    return jsonb_build_object('status','maintenance');
  end if;
  if operation_id is null or operation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or action is null or action not in ('confirm','edit','clear') or observation_id is null
    or jsonb_typeof(changes) is distinct from 'object' or octet_length(changes::text)>8000
    or position(lower(operation_id) in lower(changes::text))>0 then
    return jsonb_build_object('status','invalid_request');
  end if;
  for key in select jsonb_object_keys(changes) loop
    if action<>'edit' or key<>all(array['detail','severity']) then
      return jsonb_build_object('status','invalid_request');
    end if;
  end loop;
  if not report_retention.claim_operation(operation_id) then
    return jsonb_build_object('status','already_processed');
  end if;
  select * into original from public.reports where id=observation_id for update;
  if not found or original.cleanup_after<=clock_timestamp() then
    return jsonb_build_object('status','gone');
  end if;
  -- Community confirmations/clears preserve the existing community workflow.
  -- Edits require the original device association while it exists. This remains
  -- pseudonymous device possession, not a claim of registered-account identity.
  if action='edit' and not exists (select 1 from report_retention.device_links
    where report_id=observation_id and device_id=reporter_device_id) then
    return jsonb_build_object('status','forbidden');
  end if;
  if action='clear' then
    update public.reports set report_type=case when crossing_id like 'hazard-%' then 'hazard_cleared' else 'cleared' end,
      confidence='Community clearing received',expires_at=least(cleanup_after,clock_timestamp()+interval '30 minutes')
      where id=observation_id;
  elsif action='confirm' then
    if original.report_type in ('cleared','hazard_cleared') then return jsonb_build_object('status','gone'); end if;
    update public.reports set confidence='Community confirmation received' where id=observation_id;
  else
    update public.reports set detail=coalesce(changes->>'detail',detail),severity=coalesce(changes->>'severity',severity)
      where id=observation_id;
  end if;
  return jsonb_build_object('status','accepted','report',report_retention.public_report(observation_id));
exception when others then
  return jsonb_build_object('status','retryable_failure');
end $$;

-- Terminal cancellation consumes an operation identity without storing its payload.
-- It lets a bounded client discard a stale pending payload without making its ID reusable.
create function public.cancel_community_operation(operation_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if not exists (select 1 from report_retention.admission_state
    where singleton and protocol_version=2 and reporting_enabled) then
    return jsonb_build_object('status','maintenance');
  end if;
  if operation_id is null or operation_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return jsonb_build_object('status','invalid_request');
  end if;
  if report_retention.claim_operation(operation_id) then return jsonb_build_object('status','cancelled'); end if;
  return jsonb_build_object('status','already_processed');
end $$;

-- Hard cutover: existing direct INSERT and UPDATE cannot reach the owner RPC path.
revoke insert on public.reports from public,anon,authenticated,service_role;
do $$ declare c record; begin
  for c in select attname from pg_attribute where attrelid='public.reports'::regclass and attnum>0 and not attisdropped loop
    execute format('revoke insert (%I) on public.reports from public,anon,authenticated,service_role',c.attname);
  end loop;
end $$;
revoke all on all functions in schema report_retention from public,anon,authenticated,service_role;
revoke all on function public.submit_community_observation(text,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.mutate_community_observation(text,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.submit_community_observation(text,jsonb,text) to anon,authenticated;
grant execute on function public.mutate_community_observation(text,uuid,text,jsonb,text) to anon,authenticated;
revoke all on function public.cancel_community_operation(text) from public,anon,authenticated,service_role;
grant execute on function public.cancel_community_operation(text) to anon,authenticated;

-- Fail closed after the atomic transition. A separate postflight-approved owner
-- action may enable protocol v2 only after compatible assets and Cron are live.
update report_retention.admission_state
set reporting_enabled=false,changed_at=clock_timestamp()
where singleton;

commit;
