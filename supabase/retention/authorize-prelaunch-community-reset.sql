\set ON_ERROR_STOP on

-- LP244.22A owner-controlled authorization bootstrap.
-- This file is intentionally psql-only and must be run in a separately approved
-- production change window before the atomic migration. It never deletes data.
\if :{?owner_authorization_id}
\else
  \echo 'owner_authorization_id is required'
  select 1/0;
\endif
\if :{?project_ref}
\else
  \echo 'project_ref is required'
  select 1/0;
\endif
\if :{?expected_reports}
\else
  \echo 'expected_reports is required'
  select 1/0;
\endif
\if :{?expected_device_reports}
\else
  \echo 'expected_device_reports is required'
  select 1/0;
\endif
\if :{?expected_synthetic_reports}
\else
  \echo 'expected_synthetic_reports is required'
  select 1/0;
\endif
\if :{?expected_embedded_device_reports}
\else
  \echo 'expected_embedded_device_reports is required'
  select 1/0;
\endif
\if :{?expected_cleared_reports}
\else
  \echo 'expected_cleared_reports is required'
  select 1/0;
\endif
\if :{?expected_historical_events}
\else
  \echo 'expected_historical_events is required'
  select 1/0;
\endif
\if :{?expected_historical_clears}
\else
  \echo 'expected_historical_clears is required'
  select 1/0;
\endif
\if :{?expected_writer_events}
\else
  \echo 'expected_writer_events is required'
  select 1/0;
\endif
\if :{?expected_retention_runs}
\else
  \echo 'expected_retention_runs is required'
  select 1/0;
\endif

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog;

create schema if not exists gridly_control;
revoke all on schema gridly_control from public, anon, authenticated, service_role;

create table if not exists gridly_control.prelaunch_reset_authorization (
  singleton boolean primary key default true check (singleton),
  migration_id text not null check (migration_id = '20260908200554'),
  project_ref text not null check (project_ref ~ '^[a-z0-9]{20}$'),
  owner_authorization_id uuid not null unique,
  status text not null check (status in ('authorized','consumed','launched')),
  authorized_at timestamptz not null default clock_timestamp(),
  consumed_at timestamptz,
  launched_at timestamptz,
  expected_reports bigint not null check (expected_reports >= 0),
  expected_device_reports bigint not null check (expected_device_reports >= 0),
  expected_synthetic_reports bigint not null check (expected_synthetic_reports >= 0),
  expected_embedded_device_reports bigint not null check (expected_embedded_device_reports >= 0),
  expected_cleared_reports bigint not null check (expected_cleared_reports >= 0),
  expected_historical_events bigint not null check (expected_historical_events >= 0),
  expected_historical_clears bigint not null check (expected_historical_clears >= 0),
  expected_writer_events bigint not null check (expected_writer_events >= 0),
  expected_retention_runs bigint not null check (expected_retention_runs >= 0),
  deleted_reports bigint,
  deleted_historical_events bigint,
  deleted_writer_events bigint,
  deleted_retention_runs bigint,
  check ((status = 'authorized' and consumed_at is null and launched_at is null)
      or (status = 'consumed' and consumed_at is not null and launched_at is null)
      or (status = 'launched' and consumed_at is not null and launched_at is not null))
);
alter table gridly_control.prelaunch_reset_authorization enable row level security;
revoke all on gridly_control.prelaunch_reset_authorization from public, anon, authenticated, service_role;

create or replace function gridly_control.guard_prelaunch_reset_authorization()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if TG_OP in ('DELETE','TRUNCATE') then
    raise exception using errcode = '42501', message = 'Pre-launch reset authorization is permanent';
  end if;
  if old.status in ('consumed','launched') then
    if old.status = 'consumed' and new.status = 'launched'
       and new.launched_at is not null
       and new.singleton = old.singleton
       and new.migration_id = old.migration_id
       and new.project_ref = old.project_ref
       and new.owner_authorization_id = old.owner_authorization_id
       and new.authorized_at = old.authorized_at
       and new.consumed_at = old.consumed_at
       and new.expected_reports = old.expected_reports
       and new.expected_device_reports = old.expected_device_reports
       and new.expected_synthetic_reports = old.expected_synthetic_reports
       and new.expected_embedded_device_reports = old.expected_embedded_device_reports
       and new.expected_cleared_reports = old.expected_cleared_reports
       and new.expected_historical_events = old.expected_historical_events
       and new.expected_historical_clears = old.expected_historical_clears
       and new.expected_writer_events = old.expected_writer_events
       and new.expected_retention_runs = old.expected_retention_runs
       and new.deleted_reports = old.deleted_reports
       and new.deleted_historical_events = old.deleted_historical_events
       and new.deleted_writer_events = old.deleted_writer_events
       and new.deleted_retention_runs = old.deleted_retention_runs then
      return new;
    end if;
    raise exception using errcode = '42501', message = 'Consumed pre-launch reset authorization cannot be reused or weakened';
  end if;
  if new.singleton is distinct from old.singleton
     or new.migration_id is distinct from old.migration_id
     or new.project_ref is distinct from old.project_ref
     or new.owner_authorization_id is distinct from old.owner_authorization_id
     or new.authorized_at is distinct from old.authorized_at
     or new.expected_reports is distinct from old.expected_reports
     or new.expected_device_reports is distinct from old.expected_device_reports
     or new.expected_synthetic_reports is distinct from old.expected_synthetic_reports
     or new.expected_embedded_device_reports is distinct from old.expected_embedded_device_reports
     or new.expected_cleared_reports is distinct from old.expected_cleared_reports
     or new.expected_historical_events is distinct from old.expected_historical_events
     or new.expected_historical_clears is distinct from old.expected_historical_clears
     or new.expected_writer_events is distinct from old.expected_writer_events
     or new.expected_retention_runs is distinct from old.expected_retention_runs
     or new.status <> 'consumed'
     or new.consumed_at is null
     or new.launched_at is not null then
    raise exception using errcode = '42501', message = 'Invalid pre-launch reset authorization transition';
  end if;
  return new;
end $$;
revoke all on function gridly_control.guard_prelaunch_reset_authorization() from public, anon, authenticated, service_role;

drop trigger if exists prelaunch_reset_authorization_guard on gridly_control.prelaunch_reset_authorization;
create trigger prelaunch_reset_authorization_guard
before update or delete on gridly_control.prelaunch_reset_authorization
for each row execute function gridly_control.guard_prelaunch_reset_authorization();
drop trigger if exists prelaunch_reset_authorization_no_truncate on gridly_control.prelaunch_reset_authorization;
create trigger prelaunch_reset_authorization_no_truncate
before truncate on gridly_control.prelaunch_reset_authorization
for each statement execute function gridly_control.guard_prelaunch_reset_authorization();

insert into gridly_control.prelaunch_reset_authorization (
  singleton, migration_id, project_ref, owner_authorization_id, status,
  expected_reports, expected_device_reports, expected_synthetic_reports,
  expected_embedded_device_reports, expected_cleared_reports,
  expected_historical_events, expected_historical_clears,
  expected_writer_events, expected_retention_runs
) values (
  true, '20260908200554', :'project_ref', :'owner_authorization_id'::uuid, 'authorized',
  :'expected_reports'::bigint, :'expected_device_reports'::bigint,
  :'expected_synthetic_reports'::bigint, :'expected_embedded_device_reports'::bigint,
  :'expected_cleared_reports'::bigint, :'expected_historical_events'::bigint,
  :'expected_historical_clears'::bigint, :'expected_writer_events'::bigint,
  :'expected_retention_runs'::bigint
);

commit;
