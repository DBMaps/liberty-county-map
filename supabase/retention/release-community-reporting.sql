\set ON_ERROR_STOP on

-- NOT a migration and NOT authorized to run in this task.
-- Owner-only final release after postflight, client deployment, Cron activation,
-- and independent-monitor verification. It permanently closes the pre-launch gate.
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

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog;

do $$ begin
  if current_user <> 'postgres' then
    raise exception using errcode = '42501', message = 'Community reporting release requires the database owner';
  end if;
  if not exists (
    select 1 from report_retention.admission_state
    where singleton and protocol_version = 2 and not reporting_enabled
  ) then
    raise exception using errcode = '55000', message = 'Protocol-v2 maintenance checkpoint is not exact';
  end if;
end $$;

update gridly_control.prelaunch_reset_authorization
set status = 'launched', launched_at = clock_timestamp()
where singleton
  and migration_id = '20260908200554'
  and project_ref = :'project_ref'
  and owner_authorization_id = :'owner_authorization_id'::uuid
  and status = 'consumed'
  and consumed_at is not null
  and launched_at is null;

update report_retention.admission_state
set reporting_enabled = true, changed_at = clock_timestamp()
where singleton and protocol_version = 2 and not reporting_enabled
  and exists (
    select 1 from gridly_control.prelaunch_reset_authorization
    where singleton and status = 'launched'
      and project_ref = :'project_ref'
      and owner_authorization_id = :'owner_authorization_id'::uuid
  );

do $$ begin
  if not exists (
    select 1
    from gridly_control.prelaunch_reset_authorization a
    cross join report_retention.admission_state s
    where a.singleton and a.status = 'launched' and a.launched_at is not null
      and s.singleton and s.protocol_version = 2 and s.reporting_enabled
  ) then
    raise exception 'Community reporting release did not reach the exact launched state';
  end if;
end $$;

commit;
