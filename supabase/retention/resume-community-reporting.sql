\set ON_ERROR_STOP on
-- After a suspended launch, resume only following the full postflight again.
\if :{?resumption_id}
\else
  \echo 'resumption_id is required'
  select 1/0;
\endif
\if :{?project_ref}
\else
  \echo 'project_ref is required'
  select 1/0;
\endif
\if :{?owner_authorization_id}
\else
  \echo 'owner_authorization_id is required'
  select 1/0;
\endif

begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
set local search_path = pg_catalog;
do $$ begin
  if current_user <> 'postgres' then
    raise exception using errcode='42501', message='Community reporting resumption requires the database owner';
  end if;
end $$;
update report_retention.admission_state
set reporting_enabled=true,changed_at=clock_timestamp()
where singleton and protocol_version=2 and not reporting_enabled
  and exists(select 1 from gridly_control.prelaunch_reset_authorization
    where singleton and status='launched' and project_ref=:'project_ref'
      and owner_authorization_id=:'owner_authorization_id'::uuid);
do $$ begin
  if not exists (select 1 from report_retention.admission_state where singleton and protocol_version=2 and reporting_enabled) then
    raise exception 'Community reporting resumption did not reach launched state';
  end if;
end $$;
insert into report_retention.admission_events(event_id,action)
values (:'resumption_id'::uuid,'resume') on conflict (event_id) do nothing;
commit;
